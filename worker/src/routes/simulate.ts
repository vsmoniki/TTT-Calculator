// =============================================
// POST /simulate — TTTシミュレーション
// =============================================
// 物理モデル（コミュニティ近似）:
//   P = P_gravity + P_roll + P_aero
//
//   P_gravity = M * g * v * sin(atan(G))
//   P_roll    = M * g * v * Crr
//   P_aero    = 0.5 * rho * CdA * v^3
//
//   M = rider_weight + bike_weight
//   G = grade_ratio（5% -> 0.05）
//
//   Frontal area:
//   A_road = 0.0276 * h^0.725 * m^0.425 + 0.1647
//   A_tt   = 0.0293 * h^0.725 * m^0.425 + 0.0604
//
//   Cd (初期近似):
//   road = 0.63, tt = 0.55
//   CdA = Cd * A
//
//   ドラフト（CdA倍率で近似）:
//   先頭: 1.0 / 後続: 0.715 / TT: 1.0（ドラフト無効）
// =============================================

import { Env, SimulateBody } from '../types';
import { ok, badRequest, notFound } from '../response';

// バイク重量 [kg]
const BIKE_KG = 8;
// 空気密度 [kg/m³]
const RHO = 1.225;
// 転がり抵抗係数
const CRR = 0.004;
// 重力加速度 [m/s²]
const G = 9.80665;
// Cd 初期近似
const ROAD_CD = 0.63;
const TT_CD = 0.55;
// 機材の平坦性能差（flat_delta_sec）をCdA倍率へ換算する係数
// 1 lap (Tempus Fugit 25:58=1558s) を基準に、ΔCdA/CdA ≈ 3 * Δt/t で近似
const EQUIPMENT_REFERENCE_TIME_SEC = 1558;
const EQUIPMENT_CDA_SENSITIVITY = 3;
// ドラフト CdA 係数（後続）
const DEFAULT_DRAFT_CDA_MULTIPLIER = 0.715;
// 身長未設定時の代替値 [m]
const DEFAULT_HEIGHT_M = 1.75;

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

function getRiderHeightM(member: MemberWithDetails): number {
  const heightCm = member.height_cm ?? 0;
  return (heightCm > 0 ? heightCm : DEFAULT_HEIGHT_M * 100) / 100;
}

function isTtBike(member: MemberWithDetails): boolean {
  return (member.bike_type ?? 'road').toLowerCase() === 'tt';
}

function calcFrontalArea(member: MemberWithDetails): number {
  const h = getRiderHeightM(member);
  const m = member.weight_kg;
  const { coeff, offset } = isTtBike(member)
    ? { coeff: 0.0293, offset: 0.0604 }
    : { coeff: 0.0276, offset: 0.1647 };
  return coeff * Math.pow(h, 0.725) * Math.pow(m, 0.425) + offset;
}

function calcBaseCdA(member: MemberWithDetails): number {
  const area = calcFrontalArea(member);
  const cd = isTtBike(member) ? TT_CD : ROAD_CD;
  return cd * area;
}

function calcEquipmentCdAMultiplier(member: MemberWithDetails): number {
  const frameFlatDeltaSec = Number(member.frame_flat_delta_sec ?? NaN);
  const wheelFlatDeltaSec = Number(member.wheel_flat_delta_sec ?? NaN);
  const hasFlatDelta = Number.isFinite(frameFlatDeltaSec) || Number.isFinite(wheelFlatDeltaSec);

  const flatDeltaSec = hasFlatDelta
    ? (Number.isFinite(frameFlatDeltaSec) ? frameFlatDeltaSec : 0)
      + (Number.isFinite(wheelFlatDeltaSec) ? wheelFlatDeltaSec : 0)
    : -(((member.frame_aero_score ?? 5) - 5) * 4 + ((member.wheel_aero_score ?? 5) - 5) * 4);

  const multiplier = 1 + (EQUIPMENT_CDA_SENSITIVITY * flatDeltaSec) / EQUIPMENT_REFERENCE_TIME_SEC;
  return Math.max(0.7, Math.min(1.3, multiplier));
}

function calcRequiredPower(v: number, massKg: number, gradeRatio: number, effectiveCdA: number): number {
  const pGravity = massKg * G * v * Math.sin(Math.atan(gradeRatio));
  const pRoll = massKg * G * v * CRR;
  const pAero = 0.5 * RHO * effectiveCdA * Math.pow(v, 3);
  return pGravity + pRoll + pAero;
}

function calcDraftMultiplier(
  member: MemberWithDetails,
  draftFactorSecond: number,
  draftFactorOther: number
): number {
  const orderDraftMultiplier: Record<number, number> = {
    1: 1.0,
    2: draftFactorSecond,
  };
  return isTtBike(member) ? 1.0 : (orderDraftMultiplier[member.order_index] ?? draftFactorOther);
}

function calcAverageGradeRatio(route: Record<string, unknown>): number {
  const distanceKm = Number(route.distance_km);
  const elevationM = Number(route.elevation_m);
  const hasValidDistance = Number.isFinite(distanceKm) && distanceKm > 0;
  const hasValidElevation = Number.isFinite(elevationM) && elevationM > 0;
  // 総獲得標高から代表勾配を作る（下り情報は未保持のため正側のみ）
  return hasValidDistance && hasValidElevation ? elevationM / (distanceKm * 1000) : 0;
}

export async function simulate(request: Request, env: Env): Promise<Response> {
  let body: SimulateBody;
  try {
    body = await request.json<SimulateBody>();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const {
    route_id,
    lineup_id,
    target_speed_kph,
    draft_factor_second = DEFAULT_DRAFT_CDA_MULTIPLIER,
    draft_factor_other = DEFAULT_DRAFT_CDA_MULTIPLIER,
  } = body;

  if (!route_id || typeof route_id !== 'number') return badRequest('route_id is required');
  if (!lineup_id || typeof lineup_id !== 'number') return badRequest('lineup_id is required');
  if (!target_speed_kph || typeof target_speed_kph !== 'number' || target_speed_kph <= 0) {
    return badRequest('target_speed_kph must be a positive number');
  }

  // コース取得
  const route = await env.DB.prepare('SELECT * FROM routes WHERE id = ?').bind(route_id).first();
  if (!route) return notFound('Route');

  // ラインナップ取得
  const lineup = await env.DB.prepare('SELECT * FROM lineups WHERE id = ?').bind(lineup_id).first();
  if (!lineup) return notFound('Lineup');

  // ラインナップメンバー取得（ライダー・フレーム・ホイール情報付き）
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

  // D1 の all() は unknown[] を返すので MemberWithDetails にキャスト
  const members = rawMembers as unknown as MemberWithDetails[];

  if (members.length === 0) {
    return badRequest('Lineup has no members');
  }

  // m/s に変換
  const v = target_speed_kph / 3.6;
  const gradeRatio = calcAverageGradeRatio(route as Record<string, unknown>);

  // 各ライダーの必要パワーを計算
  const results = members.map((m) => {
    const totalMassKg = m.weight_kg + BIKE_KG;
    const baseCdA = calcBaseCdA(m);
    const adjustedCdA = baseCdA * calcEquipmentCdAMultiplier(m);

    const headW = calcRequiredPower(v, totalMassKg, gradeRatio, adjustedCdA);
    const draftCdA = adjustedCdA * calcDraftMultiplier(m, draft_factor_second, draft_factor_other);
    const draftW = calcRequiredPower(v, totalMassKg, gradeRatio, draftCdA);

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

  // ボトルネックライダー = ドラフト時FTP比が最大のライダー
  const bottleneck = results.reduce(
    (max, r) => (r.draft_required_pct_ftp > max.draft_required_pct_ftp ? r : max),
    results[0]
  );

  const maxHeadPctFtp = Math.max(...results.map((r) => r.head_required_pct_ftp));
  const maxDraftPctFtp = Math.max(...results.map((r) => r.draft_required_pct_ftp));

  return ok({
    route,
    lineup,
    target_speed_kph,
    grade_ratio: gradeRatio,
    draft_factor_second,
    draft_factor_other,
    results,
    summary: {
      bottleneck_rider_id: bottleneck.rider_id,
      bottleneck_name: bottleneck.name,
      max_head_pct_ftp: maxHeadPctFtp,
      max_draft_pct_ftp: maxDraftPctFtp,
    },
  });
}
