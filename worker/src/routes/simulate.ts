// =============================================
// POST /simulate — TTTシミュレーション
// =============================================

import { Env, AppSettingsRow, SimulateBody } from '../types';
import { ok, badRequest, notFound } from '../response';

const G = 9.80665;
const AERO_BASE = 5;

const DEFAULT_SETTINGS = {
  draft_factor_2: 0.8,
  draft_factor_3: 0.75,
  draft_factor_4: 0.75,
  draft_factor_5: 0.75,
  draft_factor_6: 0.75,
  draft_factor_7: 0.75,
  draft_factor_8: 0.75,
  bike_kg: 8,
  rho: 1.225,
  crr: 0.004,
  road_cd: 0.63,
  tt_cd: 0.55,
  cda_calibration_multiplier: 0.76,
  equipment_reference_time_sec: 1668,
  equipment_cda_sensitivity: 3,
  default_height_m: 1.75,
};

type SimulationSettings = typeof DEFAULT_SETTINGS;

interface MemberWithDetails {
  id: number;
  lineup_id: number;
  rider_id: number;
  order_index: number;
  rider_name: string;
  weight_kg: number;
  height_cm: number | null;
  ftp_w: number;
  bike_type: string | null;
  frame_aero_score: number | null;
  frame_flat_delta_sec: number | null;
  wheel_aero_score: number | null;
  wheel_flat_delta_sec: number | null;
}

async function loadSettings(env: Env): Promise<SimulationSettings> {
  const row = await env.DB.prepare('SELECT settings_json FROM app_settings WHERE id = 1').first<AppSettingsRow>();
  if (!row?.settings_json) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(row.settings_json) as Partial<SimulationSettings> & {
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

function getRiderHeightM(member: MemberWithDetails, settings: SimulationSettings): number {
  const heightCm = member.height_cm ?? 0;
  return (heightCm > 0 ? heightCm : settings.default_height_m * 100) / 100;
}

function isTtBike(member: MemberWithDetails): boolean {
  return (member.bike_type ?? 'road').toLowerCase() === 'tt';
}

function calcFrontalArea(member: MemberWithDetails, settings: SimulationSettings): number {
  const h = getRiderHeightM(member, settings);
  const m = member.weight_kg;
  const { coeff, offset } = isTtBike(member)
    ? { coeff: 0.0293, offset: 0.0604 }
    : { coeff: 0.0276, offset: 0.1647 };
  return coeff * Math.pow(h, 0.725) * Math.pow(m, 0.425) + offset;
}

function calcBaseCdA(member: MemberWithDetails, settings: SimulationSettings): number {
  const area = calcFrontalArea(member, settings);
  const cd = isTtBike(member) ? settings.tt_cd : settings.road_cd;
  return cd * area * settings.cda_calibration_multiplier;
}

function calcEquipmentCdAMultiplier(member: MemberWithDetails, settings: SimulationSettings): number {
  const frameFlatDeltaSec = Number(member.frame_flat_delta_sec ?? NaN);
  const wheelFlatDeltaSec = Number(member.wheel_flat_delta_sec ?? NaN);
  const hasFlatDelta = Number.isFinite(frameFlatDeltaSec) || Number.isFinite(wheelFlatDeltaSec);

  const flatDeltaSec = hasFlatDelta
    ? (Number.isFinite(frameFlatDeltaSec) ? frameFlatDeltaSec : 0)
      + (Number.isFinite(wheelFlatDeltaSec) ? wheelFlatDeltaSec : 0)
    : -(((member.frame_aero_score ?? AERO_BASE) - AERO_BASE) * 4
      + ((member.wheel_aero_score ?? AERO_BASE) - AERO_BASE) * 4);

  const multiplier = 1 + (settings.equipment_cda_sensitivity * flatDeltaSec) / settings.equipment_reference_time_sec;
  return Math.max(0.7, Math.min(1.3, multiplier));
}

function calcRequiredPower(
  v: number,
  massKg: number,
  gradeRatio: number,
  effectiveCdA: number,
  settings: SimulationSettings
): number {
  const pGravity = massKg * G * v * Math.sin(Math.atan(gradeRatio));
  const pRoll = massKg * G * v * settings.crr;
  const pAero = 0.5 * settings.rho * effectiveCdA * Math.pow(v, 3);
  return pGravity + pRoll + pAero;
}

function calcDraftMultiplier(member: MemberWithDetails, settings: SimulationSettings): number {
  if (isTtBike(member)) return 1.0;
  if (member.order_index <= 1) return 1.0;
  if (member.order_index >= 8) return settings.draft_factor_8;
  const key = `draft_factor_${member.order_index}` as keyof SimulationSettings;
  return Number(settings[key] ?? settings.draft_factor_8);
}

function calcAverageGradeRatio(route: Record<string, unknown>): number {
  const distanceKm = Number(route.distance_km);
  const elevationM = Number(route.elevation_m);
  const hasValidDistance = Number.isFinite(distanceKm) && distanceKm > 0;
  const hasValidElevation = Number.isFinite(elevationM) && elevationM > 0;
  return hasValidDistance && hasValidElevation ? elevationM / (distanceKm * 1000) : 0;
}

export async function simulate(request: Request, env: Env): Promise<Response> {
  let body: SimulateBody;
  try {
    body = await request.json<SimulateBody>();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const settings = await loadSettings(env);

  const {
    route_id,
    lineup_id,
    target_speed_kph,
    target_time_sec,
  } = body;

  if (!route_id || typeof route_id !== 'number') return badRequest('route_id is required');
  if (!lineup_id || typeof lineup_id !== 'number') return badRequest('lineup_id is required');
  const hasSpeed = typeof target_speed_kph === 'number' && target_speed_kph > 0;
  const hasTime = typeof target_time_sec === 'number' && target_time_sec > 0;
  if (!hasSpeed && !hasTime) {
    return badRequest('target_speed_kph or target_time_sec must be a positive number');
  }

  const route = await env.DB.prepare('SELECT * FROM routes WHERE id = ?').bind(route_id).first();
  if (!route) return notFound('Route');

  const lineup = await env.DB.prepare('SELECT * FROM lineups WHERE id = ?').bind(lineup_id).first();
  if (!lineup) return notFound('Lineup');

  const { results: rawMembers } = await env.DB.prepare(`
    SELECT
      lm.id, lm.lineup_id, lm.rider_id, lm.order_index,
      r.name  AS rider_name,
      r.weight_kg,
      r.height_cm,
      r.ftp_w,
      f.bike_type,
      f.aero_score AS frame_aero_score,
      f.flat_delta_sec AS frame_flat_delta_sec,
      w.aero_score AS wheel_aero_score,
      w.flat_delta_sec AS wheel_flat_delta_sec
    FROM lineup_members lm
    JOIN riders r ON r.id = lm.rider_id
    LEFT JOIN frames f ON f.id = lm.frame_id
    LEFT JOIN wheels w ON w.id = lm.wheel_id
    WHERE lm.lineup_id = ?
    ORDER BY lm.order_index
  `).bind(lineup_id).all();

  const members = rawMembers as unknown as MemberWithDetails[];

  if (members.length === 0) {
    return badRequest('Lineup has no members');
  }

  const resolvedTargetSpeedKph = hasSpeed
    ? Number(target_speed_kph)
    : (Number(route.distance_km) / Number(target_time_sec)) * 3600;
  const v = resolvedTargetSpeedKph / 3.6;
  const gradeRatio = calcAverageGradeRatio(route as Record<string, unknown>);

  const results = members.map((m) => {
    const totalMassKg = m.weight_kg + settings.bike_kg;
    const baseCdA = calcBaseCdA(m, settings);
    const equipmentCdAMultiplier = calcEquipmentCdAMultiplier(m, settings);
    const adjustedCdA = baseCdA * equipmentCdAMultiplier;

    const headW = calcRequiredPower(v, totalMassKg, gradeRatio, adjustedCdA, settings);
    const draftCdA = adjustedCdA * calcDraftMultiplier(m, settings);
    const draftW = calcRequiredPower(v, totalMassKg, gradeRatio, draftCdA, settings);

    return {
      rider_id: m.rider_id,
      name: m.rider_name,
      order_index: m.order_index,
      head_required_w: Math.round(headW),
      draft_required_w: Math.round(draftW),
      head_required_pct_ftp: Math.round((headW / m.ftp_w) * 1000) / 10,
      draft_required_pct_ftp: Math.round((draftW / m.ftp_w) * 1000) / 10,
    };
  });

  const bottleneck = results.reduce(
    (max, r) => (r.draft_required_pct_ftp > max.draft_required_pct_ftp ? r : max),
    results[0]
  );

  const maxHeadPctFtp = Math.max(...results.map((r) => r.head_required_pct_ftp));
  const maxDraftPctFtp = Math.max(...results.map((r) => r.draft_required_pct_ftp));

  return ok({
    route,
    lineup,
    target_speed_kph: Math.round(resolvedTargetSpeedKph * 100) / 100,
    target_time_sec: hasTime ? target_time_sec : null,
    grade_ratio: gradeRatio,
    draft_factor_2: settings.draft_factor_2,
    draft_factor_3: settings.draft_factor_3,
    draft_factor_4: settings.draft_factor_4,
    draft_factor_5: settings.draft_factor_5,
    draft_factor_6: settings.draft_factor_6,
    draft_factor_7: settings.draft_factor_7,
    draft_factor_8: settings.draft_factor_8,
    settings,
    results,
    summary: {
      bottleneck_rider_id: bottleneck.rider_id,
      bottleneck_name: bottleneck.name,
      max_head_pct_ftp: maxHeadPctFtp,
      max_draft_pct_ftp: maxDraftPctFtp,
    },
  });
}
