import { Env, AppSettingsRow, UpdateSettingsBody } from '../types';
import { badRequest, ok } from '../response';

const DEFAULT_SETTINGS = {
  draft_factor_second: 0.8,
  draft_factor_other: 0.75,
  bike_kg: 8,
  rho: 1.225,
  crr: 0.004,
  road_cd: 0.63,
  tt_cd: 0.55,
  cda_calibration_multiplier: 0.76,
  equipment_reference_time_sec: 1668,
  equipment_cda_sensitivity: 3,
  default_height_m: 1.75,
  default_frame_name: 'CADEX tri',
  default_wheel_name: 'DT Swiss ARC 1100 DICUT 85/Disc',
  default_frame_flat_delta_sec: 0,
  default_wheel_flat_delta_sec: 0,
};

type Settings = typeof DEFAULT_SETTINGS;

const NUMERIC_KEYS = [
  'draft_factor_second',
  'draft_factor_other',
  'bike_kg',
  'rho',
  'crr',
  'road_cd',
  'tt_cd',
  'cda_calibration_multiplier',
  'equipment_reference_time_sec',
  'equipment_cda_sensitivity',
  'default_height_m',
  'default_frame_flat_delta_sec',
  'default_wheel_flat_delta_sec',
] as const;

const STRING_KEYS = ['default_frame_name', 'default_wheel_name'] as const;

function toSettings(row: AppSettingsRow | null): Settings {
  if (!row?.settings_json) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(row.settings_json) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function validateNumericField(key: (typeof NUMERIC_KEYS)[number], value: unknown): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return `${key} must be a number`;
  if (key.startsWith('draft_factor') && (value <= 0 || value > 1.2)) return `${key} must be between 0 and 1.2`;
  if ((key === 'bike_kg' || key === 'rho' || key === 'road_cd' || key === 'tt_cd' || key === 'default_height_m') && value <= 0) {
    return `${key} must be positive`;
  }
  if ((key === 'crr' || key === 'cda_calibration_multiplier' || key === 'equipment_reference_time_sec') && value <= 0) {
    return `${key} must be positive`;
  }
  return null;
}

function validateStringField(key: (typeof STRING_KEYS)[number], value: unknown): string | null {
  if (typeof value !== 'string') return `${key} must be a string`;
  if (!value.trim()) return `${key} must not be empty`;
  return null;
}

export async function getSettings(_request: Request, env: Env): Promise<Response> {
  const row = await env.DB.prepare('SELECT id, settings_json, updated_at FROM app_settings WHERE id = 1').first<AppSettingsRow>();
  return ok(toSettings(row));
}

export async function updateSettings(request: Request, env: Env): Promise<Response> {
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
