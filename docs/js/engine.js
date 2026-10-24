// =============================================
// TTT 物理エンジン（全クライアント版）
// DOM に一切依存しない純粋モジュール。node でもそのまま動く（テスト用）。
//
// 計算モデルの出典:
// - パワー式・CdA 推定式・較正係数 0.76: README「シミュレーション計算モデル」と
//   旧 worker/src/routes/simulate.ts（calcFrontalArea / calcBaseCdA）を踏襲。
//   ただし旧実装の欠陥（転がり抵抗なし・平均勾配・機材スタブ）は修正している。
// - 機材補正: README 記載の式を 0005 の設定値（感度・基準タイム）で実装。
// - ドラフト係数とローテーション/脱落/WTRL 4番手計時は本再構築で導入した
//   Zwift TTT 向けの近似モデル（下記定数のコメント参照）。
// =============================================

// ---- 物理定数（0005 app_settings のデフォルトと一致） ----
export const PHYSICS = {
  G: 9.81,               // 重力加速度 [m/s^2]
  RHO: 1.225,            // 空気密度 [kg/m^3]
  CRR: 0.004,            // 転がり抵抗係数（旧実装で抜けていた項）
  BIKE_KG: 8,            // バイク重量 [kg]（総質量 = ライダー + バイク）
  CDA_CALIBRATION: 0.76, // CdA 較正係数（Tempus Fugit 実測較正、README 記載）
  ROAD_CD: 0.63,         // ロードバイクの Cd
  TT_CD: 0.55,           // TT バイクの Cd
  DEFAULT_HEIGHT_M: 1.75,
  EQUIPMENT_REFERENCE_TIME_SEC: 1668, // 機材補正の基準タイム（0005）
  EQUIPMENT_CDA_SENSITIVITY: 3,       // 機材補正の感度（0005 / README）
};

// ドラフト係数（CdA への乗数）。Zwift TTT の実感に合わせた近似値:
// 先頭は当然 1.0、2番手で大きく効き、後方ほど逓減する。
// ※ 通常の Zwift 走行では TT バイクはドラフトを受けないが、TTT イベントに
//   限っては TT バイクでもドラフトが効く仕様のため、バイク種別で区別しない。
export const DRAFT_MULTIPLIERS = [1.0, 0.78, 0.74, 0.72]; // 1番手, 2番手, 3番手, 4番手以降

export function draftMultiplier(position, bikeType) {
  if (position <= 1) return DRAFT_MULTIPLIERS[0];
  if (position === 2) return DRAFT_MULTIPLIERS[1];
  if (position === 3) return DRAFT_MULTIPLIERS[2];
  return DRAFT_MULTIPLIERS[3];
}

// ---- CdA 推定（旧 simulate.ts の式を踏襲） ----
// 前面投影面積 A = coeff * h^0.725 * m^0.425 + offset（h: 身長[m], m: 体重[kg]）
// CdA = Cd * A * 0.76
export function estimateCdA(rider) {
  const heightCm = Number(rider.heightCm) || 0;
  const h = (heightCm > 0 ? heightCm : PHYSICS.DEFAULT_HEIGHT_M * 100) / 100;
  const m = Number(rider.weightKg) || 0;
  const isTt = rider.bikeType === 'tt';
  const { coeff, offset } = isTt
    ? { coeff: 0.0293, offset: 0.0604 }
    : { coeff: 0.0276, offset: 0.1647 };
  const area = coeff * Math.pow(h, 0.725) * Math.pow(m, 0.425) + offset;
  const cd = isTt ? PHYSICS.TT_CD : PHYSICS.ROAD_CD;
  return cd * area * PHYSICS.CDA_CALIBRATION;
}

// ---- 機材補正（README の設計式を実装。旧実装は return 1 のスタブだった） ----
// flat_delta_sec は「基準機材比の平坦タイム差[秒]、マイナスほど速い」。
//   CdA_multiplier = 1 + sensitivity * (delta_total / reference_time_sec)
//   delta_total = frame.flat_delta_sec + wheel.flat_delta_sec
// README の式は "+" で、delta がマイナス（速い機材）ほど倍率は 1 未満になる。
// （「速い秒数」を正の量として書けば 1 - sensitivity * (saved / reference) と等価）
// 結果は README と同じく [0.7, 1.3] にクランプする。
export function gearCdAMultiplier(frame, wheel) {
  if (!frame && !wheel) return 1;
  const delta = (Number(frame?.flatDeltaSec) || 0) + (Number(wheel?.flatDeltaSec) || 0);
  const raw = 1 + PHYSICS.EQUIPMENT_CDA_SENSITIVITY * (delta / PHYSICS.EQUIPMENT_REFERENCE_TIME_SEC);
  return Math.min(1.3, Math.max(0.7, raw));
}

// ---- 必要パワー ----
// P = M*g*(s*v + Crr*v) + 0.5*rho*CdA_eff*v^3
//   M: 総質量（ライダー+バイク）, s: 勾配（小数、例 0.03 = 3%）
// 下りなどで負になる場合は 0 にクランプする（惰行扱い）。
export function requiredPower({ speedMs, massKg, grade, cdaEff }) {
  const pGravRoll = massKg * PHYSICS.G * (grade + PHYSICS.CRR) * speedMs;
  const pAero = 0.5 * PHYSICS.RHO * cdaEff * Math.pow(speedMs, 3);
  return Math.max(0, pGravRoll + pAero);
}

// 目標パワーから速度を二分探索で解く（requiredPower は v に対して単調非減少）
export function solveSpeedForPower(targetPower, { massKg, grade, cdaEff }) {
  if (targetPower <= 0) return 0;
  let lo = 0;
  let hi = 30; // 108 km/h を上限とする
  if (requiredPower({ speedMs: hi, massKg, grade, cdaEff }) <= targetPower) return hi;
  for (let i = 0; i < 48; i += 1) {
    const mid = (lo + hi) / 2;
    if (requiredPower({ speedMs: mid, massKg, grade, cdaEff }) < targetPower) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---- コースの区間分割 ----
// profile（[距離km, 標高m] の配列）を targetSegmentM 間隔の区間に再サンプルし、
// 区間ごとの勾配を持つ配列を返す。プロファイルがない場合は
// 「中間で獲得標高まで登って戻る」三角形プロファイルで代用する。
export function buildSegments(course, targetSegmentM = 300) {
  const totalM = (Number(course.distanceKm) || 0) * 1000;
  if (totalM <= 0) return [];
  let profile = Array.isArray(course.profile) && course.profile.length >= 2
    ? course.profile
    : [[0, 0], [(totalM / 1000) / 2, Number(course.elevationM) || 0], [totalM / 1000, 0]];

  const altAt = (distM) => {
    const km = distM / 1000;
    if (km <= profile[0][0]) return profile[0][1];
    for (let i = 1; i < profile.length; i += 1) {
      if (km <= profile[i][0]) {
        const [x0, y0] = profile[i - 1];
        const [x1, y1] = profile[i];
        return x1 === x0 ? y1 : y0 + ((y1 - y0) * (km - x0)) / (x1 - x0);
      }
    }
    return profile[profile.length - 1][1];
  };

  const count = Math.min(400, Math.max(10, Math.round(totalM / targetSegmentM)));
  const segments = [];
  for (let i = 0; i < count; i += 1) {
    const startM = (totalM * i) / count;
    const endM = (totalM * (i + 1)) / count;
    segments.push({
      startM, endM, lengthM: endM - startM,
      grade: (altAt(endM) - altAt(startM)) / (endM - startM),
    });
  }
  return segments;
}

// ---- レースシミュレーション ----
// 入力:
//   course: { distanceKm, elevationM, profile }
//   riders: [{ id, name, weightKg, heightCm, ftpW, bikeType }]（配列順 = スタート走順）
//   gearMultiplier: 機材 CdA 倍率（全員共通、gearCdAMultiplier の結果）
//   pullSec: 1回のプル時間 [秒]（デフォルト 30）
//   pullPct: 先頭ライダーのプル強度 [%FTP]（デフォルト 110）
//   dropPct: 後続が維持できる上限 [%FTP]（デフォルト 95）。
//            後続の必要パワーがこれを超えたら千切れる（脱落）扱い。
//   dtSec: 内部ステップ [秒]（デフォルト 2）
//
// モデル:
// - チーム速度は「その時点の先頭ライダーが pullPct%FTP で引いたときの速度」で決まる。
//   先頭は自分の上限（pullPct）で走るため、登りでも速度はその上限から決まる
//   （= 仕様の「リーダーが上限で制限される」はこの構成で自動的に満たされる）。
// - 先頭は pullSec ごとに最後尾へ回る。
// - 脱落したライダーは集団から外れ、以後は dropPct%FTP の単独走で
//   ゴールするものとして個別に finish time を計算する（UI に明記する前提）。
// - チームタイムは WTRL ルール: 4番目の完走者のタイム。4人未満なら最後の完走者。
export function simulateRace({
  course, riders, gearMultiplier = 1,
  pullSec = 30, pullPct = 110, dropPct = 95, dtSec = 2,
}) {
  if (!course || !(Number(course.distanceKm) > 0)) throw new Error('course.distanceKm is required');
  if (!Array.isArray(riders) || riders.length === 0) throw new Error('riders must be a non-empty array');
  const pullTimeSec = pullSec > 0 ? pullSec : 30;
  const segments = buildSegments(course);
  const totalM = Number(course.distanceKm) * 1000;

  // ライダーの計算用ステート
  const S = riders.map((r, idx) => {
    const ftpW = Number(r.ftpW) || 0;
    if (ftpW <= 0) throw new Error(`rider ${r.name ?? idx} has no FTP`);
    return {
      id: r.id ?? idx, name: r.name ?? `Rider ${idx + 1}`,
      weightKg: Number(r.weightKg) || 0,
      ftpW, bikeType: r.bikeType === 'tt' ? 'tt' : 'road',
      massKg: (Number(r.weightKg) || 0) + PHYSICS.BIKE_KG,
      cda: estimateCdA(r) * gearMultiplier,
      energyJ: 0, rideTimeSec: 0, pulls: 0, pullTimeSec: 0,
      dropped: null, finishTimeSec: null,
    };
  });

  const queue = S.map((_, i) => i); // ローテーション順（先頭が [0]）
  const rotations = [];
  let t = 0;
  let dist = 0;
  let segIdx = 0;
  let pullClock = 0;
  let currentPull = null;

  const startPull = (riderIdx) => {
    currentPull = { riderIdx, startTimeSec: t, startDistanceM: dist, durationSec: 0 };
    S[riderIdx].pulls += 1;
  };
  const endPull = () => {
    if (currentPull) rotations.push({ ...currentPull });
    currentPull = null;
  };
  if (queue.length > 0) startPull(queue[0]);

  while (dist < totalM && queue.length > 0) {
    while (segIdx < segments.length - 1 && dist >= segments[segIdx].endM) segIdx += 1;
    const seg = segments[segIdx];
    const leader = S[queue[0]];
    const pullPower = (pullPct / 100) * leader.ftpW;
    const v = solveSpeedForPower(pullPower, { massKg: leader.massKg, grade: seg.grade, cdaEff: leader.cda });
    if (!(v > 0)) break; // 安全装置（通常は到達しない）

    // 後続の脱落判定（脱落すると後方のドラフト条件が変わるため安定するまで繰り返す）
    let droppedThisStep = false;
    for (let i = queue.length - 1; i >= 1; i -= 1) {
      const f = S[queue[i]];
      const req = requiredPower({
        speedMs: v, massKg: f.massKg, grade: seg.grade,
        cdaEff: f.cda * draftMultiplier(i + 1, f.bikeType),
      });
      if (req > (dropPct / 100) * f.ftpW) {
        f.dropped = { timeSec: t, distanceM: dist };
        queue.splice(i, 1);
        droppedThisStep = true;
      }
    }
    if (droppedThisStep) {
      // 先頭が変わった場合に備えてプル記録を付け替える（先頭脱落は起きないが安全側）
      if (currentPull && queue[0] !== currentPull.riderIdx) {
        endPull();
        if (queue.length > 0) startPull(queue[0]);
        pullClock = 0;
      }
      continue; // 速度と条件を再計算してから進む
    }

    // このステップで進む時間（ゴールを超えないようクランプ）
    const remainingM = totalM - dist;
    const stepTime = Math.min(dtSec, remainingM / v);
    const stepDist = v * stepTime;

    // 各ライダーの消費エネルギーを積算
    for (let pos = 0; pos < queue.length; pos += 1) {
      const r = S[queue[pos]];
      const p = requiredPower({
        speedMs: v, massKg: r.massKg, grade: seg.grade,
        cdaEff: r.cda * draftMultiplier(pos + 1, r.bikeType),
      });
      r.energyJ += p * stepTime;
      r.rideTimeSec += stepTime;
    }
    leader.pullTimeSec += stepTime;
    if (currentPull) currentPull.durationSec += stepTime;
    pullClock += stepTime;
    t += stepTime;
    dist += stepDist;

    // プル交代
    if (pullClock >= pullTimeSec && queue.length > 1 && dist < totalM) {
      endPull();
      queue.push(queue.shift());
      pullClock = 0;
      startPull(queue[0]);
    }
  }
  endPull();
  const groupFinishSec = t;
  for (const i of queue) S[i].finishTimeSec = groupFinishSec;

  // 脱落者の単独走フィニッシュ（dropPct%FTP の単独走、ドラフトなし）
  for (const r of S) {
    if (!r.dropped) continue;
    let rt = r.dropped.timeSec;
    let rd = r.dropped.distanceM;
    const soloPower = (dropPct / 100) * r.ftpW;
    let si = 0;
    while (si < segments.length - 1 && rd >= segments[si].endM) si += 1;
    while (rd < totalM) {
      const seg = segments[si];
      const sv = solveSpeedForPower(soloPower, { massKg: r.massKg, grade: seg.grade, cdaEff: r.cda });
      if (!(sv > 0)) break;
      const segRemaining = Math.min(seg.endM, totalM) - rd;
      const segTime = segRemaining / sv;
      const p = requiredPower({ speedMs: sv, massKg: r.massKg, grade: seg.grade, cdaEff: r.cda });
      r.energyJ += p * segTime;
      r.rideTimeSec += segTime;
      rt += segTime;
      rd += segRemaining;
      if (si < segments.length - 1) si += 1;
    }
    r.finishTimeSec = rt;
  }

  const finishers = S
    .filter((r) => r.finishTimeSec != null)
    .sort((a, b) => a.finishTimeSec - b.finishTimeSec);
  const teamIndex = Math.min(3, finishers.length - 1);
  const teamTimeSec = finishers.length > 0 ? finishers[teamIndex].finishTimeSec : groupFinishSec;
  const timingBasis = finishers.length >= 4 ? '4th' : 'last';

  const riderResults = S.map((r) => {
    const avgW = r.rideTimeSec > 0 ? r.energyJ / r.rideTimeSec : 0;
    return {
      id: r.id, name: r.name, bikeType: r.bikeType,
      pulls: r.pulls, pullTimeSec: Math.round(r.pullTimeSec),
      avgW: Math.round(avgW * 10) / 10,
      avgWkg: r.weightKg > 0 ? Math.round((avgW / r.weightKg) * 100) / 100 : 0,
      avgPctFtp: Math.round((avgW / r.ftpW) * 1000) / 10,
      dropped: r.dropped ? { timeSec: Math.round(r.dropped.timeSec), distanceKm: Math.round(r.dropped.distanceM / 100) / 10 } : null,
      finishTimeSec: r.finishTimeSec != null ? Math.round(r.finishTimeSec) : null,
    };
  });

  // ボトルネック = 集団に残った中で平均%FTPが最大のライダー（全員脱落時は全体の最大）
  const stayed = riderResults.filter((r) => !r.dropped);
  const pool = stayed.length > 0 ? stayed : riderResults;
  const bottleneck = pool.reduce((max, r) => (r.avgPctFtp > max.avgPctFtp ? r : max), pool[0]);

  return {
    teamTimeSec: Math.round(teamTimeSec),
    timingBasis,
    timingRiderName: finishers.length > 0 ? finishers[teamIndex].name : null,
    avgSpeedKph: teamTimeSec > 0 ? Math.round(((totalM / teamTimeSec) * 3.6) * 100) / 100 : 0,
    groupFinishSec: Math.round(groupFinishSec),
    riders: riderResults,
    bottleneck: bottleneck ? { id: bottleneck.id, name: bottleneck.name, avgPctFtp: bottleneck.avgPctFtp } : null,
    rotations: rotations.slice(0, 24),
    totalRotations: rotations.length,
    droppedCount: riderResults.filter((r) => r.dropped).length,
  };
}

// ---- 目標タイム逆算モード ----
// プル強度に一律の係数 k を掛け、チームタイムが目標に最も近づく k を探す。
// 注意: 素朴な二分探索は使えない。k を上げすぎると後続が千切れて集団が崩壊し、
// 「4番手のタイム」が単独走ペースに落ちて逆に遅くなる（単調でない）ため。
// そこで k を粗く走査 → 最良の近傍を細かく走査する2段階探索にする。
// 同点の場合は「脱落者が少ない方 → 小さい k」を優先する。
export function findIntensityForTargetTime(input, targetTimeSec) {
  if (!(targetTimeSec > 0)) throw new Error('targetTimeSec must be positive');
  const basePullPct = input.pullPct ?? 110;

  const evaluate = (k) => {
    const result = simulateRace({ ...input, pullPct: basePullPct * k });
    return { intensityFactor: k, effectivePullPct: Math.round(basePullPct * k * 10) / 10, result };
  };
  const score = (cand) => Math.abs(cand.result.teamTimeSec - targetTimeSec) / targetTimeSec;
  const better = (a, b) => {
    if (!a) return b;
    const sa = score(a); const sb = score(b);
    if (Math.abs(sa - sb) > 1e-9) return sa < sb ? a : b;
    if (a.result.droppedCount !== b.result.droppedCount) {
      return a.result.droppedCount < b.result.droppedCount ? a : b;
    }
    return a.intensityFactor <= b.intensityFactor ? a : b;
  };

  let best = null;
  for (let k = 0.5; k <= 2.0001; k += 0.05) best = better(best, evaluate(Math.round(k * 100) / 100));
  const center = best.intensityFactor;
  for (let k = Math.max(0.3, center - 0.05); k <= center + 0.0501; k += 0.005) {
    best = better(best, evaluate(Math.round(k * 1000) / 1000));
  }
  return { ...best, converged: score(best) <= 0.01 };
}
