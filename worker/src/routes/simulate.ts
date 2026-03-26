// =============================================
// POST /simulate — TTTシミュレーション
// =============================================
// 物理モデル（平坦近似）:
//   v       = target_speed_kph / 3.6   [m/s]
//   rho     = 1.225                    [kg/m³ 空気密度]
//   Crr     = 0.004                    [転がり抵抗係数]
//   g       = 9.81                     [m/s² 重力加速度]
//   bike_kg = 8                        [kg バイク重量固定]
//
//   CdA = CdA_base
//         - (frame.aero_score - 5) * 0.005   ← フレーム空力補正
//         - (wheel.aero_score - 5) * 0.004   ← ホイール空力補正
//
//   F_aero = 0.5 * rho * CdA * v²     [N]
//   F_roll = Crr * (weight_kg + bike_kg) * g  [N]
//   P_head = (F_aero + F_roll) * v    [W] 先頭時必要パワー
//
//   ドラフト（後続の空力抵抗軽減を一定係数で近似）:
//     order_index = 1 → P_head（ドラフトなし）
//     order_index = 2 → P_head * draft_factor_second（デフォルト 0.80）
//     order_index >= 3 → P_head * draft_factor_other（デフォルト 0.75）
// =============================================

import { Env, SimulateBody } from '../types';
import { ok, badRequest, notFound } from '../response';

// 基準 CdA（ロードポジション平均値）
const CDA_BASE = 0.32;
// 基準 aero_score（この値でCdA調整なし）
const AERO_SCORE_BASELINE = 5.0;
// バイク重量 [kg]
const BIKE_KG = 8;
// 空気密度 [kg/m³]
const RHO = 1.225;
// 転がり抵抗係数
const CRR = 0.004;
// 重力加速度 [m/s²]
const G = 9.81;

interface MemberWithDetails {
  id: number;
  lineup_id: number;
  rider_id: number;
  order_index: number;
  rider_name: string;
  weight_kg: number;
  ftp_w: number;
  frame_aero_score: number | null;
  wheel_aero_score: number | null;
}

/** ライダーの先頭必要パワーを計算 */
function calcHeadPower(member: MemberWithDetails, v: number): number {
  // フレーム・ホイールの aero_score でCdAを補正
  // aero_score が基準(5)より高い → CdA が小さくなる（空力優秀）
  const frameAdj = ((member.frame_aero_score ?? AERO_SCORE_BASELINE) - AERO_SCORE_BASELINE) * 0.005;
  const wheelAdj = ((member.wheel_aero_score ?? AERO_SCORE_BASELINE) - AERO_SCORE_BASELINE) * 0.004;
  const cda = Math.max(0.15, CDA_BASE - frameAdj - wheelAdj);

  const fAero = 0.5 * RHO * cda * v * v;
  const fRoll = CRR * (member.weight_kg + BIKE_KG) * G;
  return (fAero + fRoll) * v;
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
    draft_factor_second = 0.80,
    draft_factor_other = 0.75,
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
      r.ftp_w,
      f.aero_score AS frame_aero_score,
      w.aero_score AS wheel_aero_score
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

  // 各ライダーの必要パワーを計算
  const results = members.map((m) => {
    const headW = calcHeadPower(m, v);

    // ドラフト係数を適用して後続時の必要パワーを算出
    let draftFactor: number;
    if (m.order_index === 1) {
      draftFactor = 1.0;
    } else if (m.order_index === 2) {
      draftFactor = draft_factor_second;
    } else {
      draftFactor = draft_factor_other;
    }

    const draftW = headW * draftFactor;

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
