import { Env, AppSettingsRow, UpdateSettingsBody } from '../types';
import { badRequest, ok } from '../response';

const DEFAULT_SETTINGS = {
  draft_factor_2: 0.8,
  draft_factor_3: 0.75,
  draft_factor_4: 0.75,
  draft_factor_5: 0.75,
  draft_factor_6: 0.75,
  draft_factor_7: 0.75,
  draft_factor_8: 0.75,
  rho: 1.225,
  road_cd: 0.63,
  tt_cd: 0.55,
  cda_calibration_multiplier: 0.76,
  equipment_reference_time_sec: 1668,
  default_height_m: 1.75,
  default_frame_name: 'CADEX tri',
  default_wheel_name: 'DT Swiss ARC 1100 DICUT 85/Disc',
  equipment_preset: 'tri_dtswiss',
  default_frame_flat_delta_sec: 0,
  default_wheel_flat_delta_sec: 0,
};

type Settings = typeof DEFAULT_SETTINGS;

const NUMERIC_KEYS = [
  'draft_factor_2',
  'draft_factor_3',
  'draft_factor_4',
  'draft_factor_5',
  'draft_factor_6',
  'draft_factor_7',
  'draft_factor_8',
  'rho',
  'road_cd',
  'tt_cd',
  'cda_calibration_multiplier',
  'equipment_reference_time_sec',
  'default_height_m',
  'default_frame_flat_delta_sec',
  'default_wheel_flat_delta_sec',
] as const;

const STRING_KEYS = ['default_frame_name', 'default_wheel_name', 'equipment_preset'] as const;

function toSettings(row: AppSettingsRow | null): Settings {
  if (!row?.settings_json) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(row.settings_json) as Partial<Settings> & {
      draft_factor_second?: number;
      draft_factor_other?: number;
    };

    const factorSecond = Number(parsed.draft_factor_2 ?? parsed.draft_factor_second ?? DEFAULT_SETTINGS.draft_factor_2);
    const factorOther = Number(parsed.draft_factor_other ?? DEFAULT_SETTINGS.draft_factor_3);

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      draft_factor_2: factorSecond,
      draft_factor_3: Number(parsed.draft_factor_3 ?? factorOther),
      draft_factor_4: Number(parsed.draft_factor_4 ?? factorOther),
      draft_factor_5: Number(parsed.draft_factor_5 ?? factorOther),
      draft_factor_6: Number(parsed.draft_factor_6 ?? factorOther),
      draft_factor_7: Number(parsed.draft_factor_7 ?? factorOther),
      draft_factor_8: Number(parsed.draft_factor_8 ?? factorOther),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function validateNumericField(key: (typeof NUMERIC_KEYS)[number], value: unknown): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return `${key} must be a number`;
  if (key.startsWith('draft_factor_') && (value <= 0 || value > 1.2)) return `${key} must be between 0 and 1.2`;
  if ((key === 'rho' || key === 'road_cd' || key === 'tt_cd' || key === 'default_height_m') && value <= 0) {
    return `${key} must be positive`;
  }
  if ((key === 'cda_calibration_multiplier' || key === 'equipment_reference_time_sec') && value <= 0) {
    return `${key} must be positive`;
  }
  return null;
}

function validateStringField(key: (typeof STRING_KEYS)[number], value: unknown): string | null {
  if (typeof value !== 'string') return `${key} must be a string`;
  if (!value.trim()) return `${key} must not be empty`;
  if (key === 'equipment_preset' && !['tri_dtswiss', 'tron'].includes(value.trim())) {
    return `${key} must be one of tri_dtswiss, tron`;
  }
  return null;
}


async function ensureSettingsTable(env: Env): Promise<void> {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      settings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
}

export async function getSettings(_request: Request, env: Env): Promise<Response> {
  await ensureSettingsTable(env);
  const row = await env.DB.prepare('SELECT id, settings_json, updated_at FROM app_settings WHERE id = 1').first<AppSettingsRow>();
  return ok(toSettings(row));
}

export async function updateSettings(request: Request, env: Env): Promise<Response> {
  await ensureSettingsTable(env);

  let body: UpdateSettingsBody;
  try {
    body = await request.json<UpdateSettingsBody>();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const currentRow = await env.DB.prepare('SELECT id, settings_json, updated_at FROM app_settings WHERE id = 1').first<AppSettingsRow>();
  const next = toSettings(currentRow);

  for (const key of NUMERIC_KEYS) {
    const value = body[key];
    if (value === undefined) continue;
    const error = validateNumericField(key, value);
    if (error) return badRequest(error);
    next[key] = value;
  }

  for (const key of STRING_KEYS) {
    const value = body[key];
    if (value === undefined) continue;
    const error = validateStringField(key, value);
    if (error) return badRequest(error);
    next[key] = value.trim();
  }

  await env.DB.prepare(`
    INSERT INTO app_settings (id, settings_json)
    VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = CURRENT_TIMESTAMP
  `).bind(JSON.stringify(next)).run();

  return ok(next);
}
