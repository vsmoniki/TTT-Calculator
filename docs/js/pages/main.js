// =============================================
// メイン画面 — フル機能 TTTシミュレーター
// ・ライダー選択・プル時間・機材設定
// ・ドラッグ&ドロップ並び替え
// ・Auto Order / Auto Optimize
// ・URLステート復元
// =============================================
import { fetchRiders, fetchFrames, fetchWheels, fetchSettings } from '../api.js';

// ---- 物理定数 ----
const G         = 9.81;
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
  equipment_status_tri_dtswiss: 'enabled',
  equipment_status_tron: 'enabled',
  default_frame_flat_delta_sec: 0,
  default_wheel_flat_delta_sec: 0,
};
const TRON_FRAME_CANDIDATES = ['Zwift Concept Z1 (Tron)', 'Tron'];
const CADEX_FRAME_CANDIDATES = ['Cadex Tri', 'CADEX tri'];
const DT85_WHEEL_CANDIDATES = ['DT Swiss ARC 1100 DICUT 85/Disc', 'DTSwiss ARC 1100 DICUT 85/Disc'];
const TARGET_WKG_MIN = 3.0;
const TARGET_WKG_MAX = 7.0;
const TARGET_WKG_STEP = 0.1;
const TARGET_WKG_BAND = 0.5;
const ROTATION_CYCLE_SEC = 120; // Auto Optimize のベース回転時間 (秒)

let state = {
  riders: [], frames: [], wheels: [],
  members: [],        // [{ rider, frameId, wheelId, order, pull_sec }]
  targetWkgMin: 5.0,
  draftFactors: buildDraftFactors(DEFAULT_SETTINGS),
  settings: { ...DEFAULT_SETTINGS },
  defaultFrameId: null,
  defaultWheelId: null,
};

// ============================================================
// 物理計算ヘルパー
// ============================================================

function calcHeadPower(member, v) {
  const frame = state.frames.find((f) => f.id === member.frameId);
  const wheel = state.wheels.find((w) => w.id === member.wheelId);
  const cda  = calcAdjustedCdA(member, frame, wheel);
  const fAero = 0.5 * state.settings.rho * cda * v * v;
  return fAero * v;
}

function getRiderHeightM(member) {
  const heightCm = Number(member?.rider?.height_cm ?? 0);
  return (heightCm > 0 ? heightCm : state.settings.default_height_m * 100) / 100;
}

function isTtBike(frame) {
  return String(frame?.bike_type ?? 'road').toLowerCase() === 'tt';
}

function calcFrontalArea(member, frame) {
  const h = getRiderHeightM(member);
  const m = Number(member?.rider?.weight_kg ?? 0);
  const coeff = isTtBike(frame) ? 0.0293 : 0.0276;
  const offset = isTtBike(frame) ? 0.0604 : 0.1647;
  return coeff * Math.pow(h, 0.725) * Math.pow(m, 0.425) + offset;
}

function calcBaseCdA(member, frame) {
  const cd = isTtBike(frame) ? state.settings.tt_cd : state.settings.road_cd;
  return cd * calcFrontalArea(member, frame) * state.settings.cda_calibration_multiplier;
}

function calcEquipmentCdAMultiplier() {
  return 1;
}

function calcAdjustedCdA(member, frame, wheel) {
  const baseCdA = calcBaseCdA(member, frame);
  const equipmentCdAMultiplier = calcEquipmentCdAMultiplier(frame, wheel);
  return Math.max(0.15, baseCdA * equipmentCdAMultiplier);
}

function buildDraftFactors(settings) {
  return {
    2: Number(settings.draft_factor_2),
    3: Number(settings.draft_factor_3),
    4: Number(settings.draft_factor_4),
    5: Number(settings.draft_factor_5),
    6: Number(settings.draft_factor_6),
    7: Number(settings.draft_factor_7),
    8: Number(settings.draft_factor_8),
  };
}

function draftFactorByOrder(order) {
  if (order <= 1) return 1.0;
  if (order >= 8) return state.draftFactors[8];
  return state.draftFactors[order] ?? state.draftFactors[8];
}

// ドラフト恩恵の平均係数（先頭以外の全ポジション平均）
function draftFactorAvg(n) {
  if (n <= 1) return 1.0;
  const factors = [];
  for (let order = 2; order <= n; order += 1) {
    factors.push(draftFactorByOrder(order));
  }
  return rowsAverage(factors);
}

function calcResults() {
  const sorted = sortedMembers();
  if (sorted.length === 0) return [];
  const n     = sorted.length;
  const v     = calcTargetSpeedKph(sorted) / 3.6;
  const dfAvg = draftFactorAvg(n);
  const totalPull = sorted.reduce((s, m) => s + m.pull_sec, 0) || 1;

  const rows = sorted.map((m) => {
    const headW = calcHeadPower(m, v);
    const draftW = headW * draftFactorByOrder(m.order);
    const headPct  = Math.round((headW  / m.rider.ftp_w) * 1000) / 10;
    const draftPct = Math.round((draftW / m.rider.ftp_w) * 1000) / 10;
    const pullRatio = m.pull_sec / totalPull;
    const avgPower  = headW * (dfAvg + (1 - dfAvg) * pullRatio);
    const avgPct    = Math.round((avgPower / m.rider.ftp_w) * 1000) / 10;
    const headWkg = round1(headW / m.rider.weight_kg);
    const draftWkg = round1(draftW / m.rider.weight_kg);
    const avgWkg = round1(avgPower / m.rider.weight_kg);
    return { m, headW: Math.round(headW), draftW: Math.round(draftW), headPct, draftPct, pullRatio, avgPct, headWkg, draftWkg, avgWkg };
  });

  const bottleneck = rows.reduce((max, r) => (r.avgPct > max.avgPct ? r : max), rows[0]);
  rows.forEach((r) => { r.isBottleneck = r === bottleneck; });
  return rows;
}

// ============================================================
// 最適化
// ============================================================

function autoOrder() {
  const sorted = [...state.members].sort((a, b) => b.rider.ftp_w - a.rider.ftp_w);
  sorted.forEach((m, i) => { m.order = i + 1; });
}

function autoOptimizeFixed() {
  const sorted = sortedMembers();
  if (sorted.length === 0) return;
  const v = calcTargetSpeedKph(sorted) / 3.6;
  const n = sorted.length;
  const dfAvg = draftFactorAvg(n);
  const avgRatioTarget = rowsAverage(sorted.map((m) => m.rider.ftp_w / calcHeadPower(m, v)));

  const ratios = sorted.map((m) => {
    const headW = calcHeadPower(m, v);
    const targetAvgPct = 100 / avgRatioTarget;
    const r = ((targetAvgPct / 100) * m.rider.ftp_w / headW - dfAvg) / (1 - dfAvg);
    return Math.max(0.05, r); // 最低 5% は確保
  });
  const sumR = ratios.reduce((s, r) => s + r, 0);
  sorted.forEach((m, i) => {
    m.pull_sec = Math.max(10, Math.round((ratios[i] / sumR) * ROTATION_CYCLE_SEC));
  });
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function clampTargetWkg(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return state.targetWkgMin;
  return round1(Math.min(TARGET_WKG_MAX, Math.max(TARGET_WKG_MIN, numericValue)));
}

function targetWkgMax() {
  return round1(state.targetWkgMin + TARGET_WKG_BAND);
}

function targetWkgMid() {
  return round1(state.targetWkgMin + TARGET_WKG_BAND / 2);
}

function averageHeadWkgAtSpeed(members, speedKph) {
  if (members.length === 0) return 0;
  const v = speedKph / 3.6;
  return rowsAverage(members.map((m) => calcHeadPower(m, v) / Number(m.rider.weight_kg)));
}

function calcTargetSpeedKph(members = sortedMembers()) {
  if (members.length === 0) return 0;
  const target = targetWkgMid();
  let low = 1;
  let high = 80;
  for (let i = 0; i < 36; i += 1) {
    const mid = (low + high) / 2;
    if (averageHeadWkgAtSpeed(members, mid) < target) low = mid;
    else high = mid;
  }
  return round1((low + high) / 2);
}

function wkgBandClass(value) {
  if (value < state.targetWkgMin) return 'wkg-under';
  if (value > targetWkgMax()) return 'wkg-over';
  return 'wkg-in';
}

function wkgBandRowClass(value) {
  return `wkg-row-${wkgBandClass(value).replace('wkg-', '')}`;
}

function wkgBandLabel(value) {
  if (value < state.targetWkgMin) return '目安より低め';
  if (value > targetWkgMax()) return '目安より高め';
  return '目安内';
}

function rowsAverage(values) {
  if (values.length === 0) return 1;
  return values.reduce((s, value) => s + value, 0) / values.length;
}

// ============================================================
// URLステート
// ============================================================

function decodeState(hash) {
  try {
    return JSON.parse(decodeURIComponent(atob(hash)));
  } catch { return null; }
}

function applyURLState(decoded) {
  if (!decoded?.m) return;
  state.targetWkgMin    = clampTargetWkg(decoded.wkg ?? state.targetWkgMin);
  state.members = decoded.m.map((entry) => {
    const rider = state.riders.find((r) => r.id === entry.id);
    if (!rider) return null;
    return { rider, frameId: entry.f ?? null, wheelId: entry.w ?? null, order: entry.o, pull_sec: entry.p ?? 30 };
  }).filter(Boolean);
}

function showToast(msg) {
  const t = Object.assign(document.createElement('div'), { textContent: msg });
  Object.assign(t.style, {
    position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
    background:'var(--color-primary)', color:'#000', padding:'10px 20px',
    borderRadius:'8px', fontWeight:'600', zIndex:'9999', pointerEvents:'none',
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ============================================================
// ユーティリティ
// ============================================================

function sortedMembers() {
  return [...state.members].sort((a, b) => a.order - b.order);
}

function reorderMembers() {
  sortedMembers().forEach((m, i) => { m.order = i + 1; });
}

function ftpClass(pct) {
  if (pct >= 110) return 'pct-danger';
  if (pct >= 95)  return 'pct-warn';
  return '';
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function normalizeName(name) {
  return String(name ?? '').toLowerCase().replace(/[\s_-]/g, '');
}

function findDefaultGearId(items, candidates) {
  for (const candidate of candidates) {
    const exact = items.find((item) => item.name === candidate);
    if (exact) return exact.id;
  }
  const normalizedCandidates = new Set(candidates.map(normalizeName));
  const normalized = items.find((item) => normalizedCandidates.has(normalizeName(item.name)));
  if (normalized) return normalized.id;
  return items[0]?.id ?? null;
}

function findTronFrameId(frames) {
  return findDefaultGearId(frames, TRON_FRAME_CANDIDATES);
}

function getSelectableEquipments() {
  const cadexFrameId = findDefaultGearId(state.frames, CADEX_FRAME_CANDIDATES);
  const dt85WheelId = findDefaultGearId(state.wheels, DT85_WHEEL_CANDIDATES);
  const tronFrameId = findTronFrameId(state.frames);
  const equipments = [];
  if (cadexFrameId && dt85WheelId) {
    equipments.push({
      key: 'cadex_dt85',
      label: 'Cadex Tri × DT Swiss ARC 1100 DICUT 85/Disc',
      frameId: cadexFrameId,
      wheelId: dt85WheelId,
    });
  }
  if (tronFrameId) {
    equipments.push({
      key: 'tron',
      label: 'Zwift Concept Z1 (Tron)',
      frameId: tronFrameId,
      wheelId: null,
    });
  }
  return equipments;
}

function getInitialEquipmentSelection() {
  const selectableEquipments = getSelectableEquipments();
  const firstEquipment = selectableEquipments[0];
  if (firstEquipment) {
    return { frameId: firstEquipment.frameId, wheelId: firstEquipment.wheelId };
  }
  return { frameId: null, wheelId: null };
}

// ============================================================
// エントリーポイント
// ============================================================

export async function renderMain(container) {
  const [riders, frames, wheels, settings] = await Promise.all([fetchRiders(), fetchFrames(), fetchWheels(), fetchSettings()]);
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
  const defaultFrameCandidates = [mergedSettings.default_frame_name, 'Cadex Tri', 'Canyon Aeroad 2021'];
  const defaultWheelCandidates = [mergedSettings.default_wheel_name, 'DTSwiss ARC 1100 DICUT 85/Disc', 'DT Swiss ARC 62 DICUT'];
  const defaultFrameId = findDefaultGearId(frames, defaultFrameCandidates);
  const defaultWheelId = findDefaultGearId(wheels, defaultWheelCandidates);
  state = { ...state, riders, frames, wheels, members: [], defaultFrameId, defaultWheelId, settings: mergedSettings, draftFactors: buildDraftFactors(mergedSettings) }; 

  // URLステート復元
  const hashMatch = location.hash.match(/[#&]state=([^&]*)/);
  if (hashMatch) applyURLState(decodeState(hashMatch[1]));

  render(container);
}

// ============================================================
// レンダリング
// ============================================================

function render(container) {
  const memberCount = state.members.length;
  const riderIds    = new Set(state.members.map((m) => m.rider.id));
  const sorted      = sortedMembers();

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">チーム目標W/kg計算</h2>
      <span class="text-muted text-sm">目標W/kg帯とメンバー体格から、同じ速度になる各ライダーの必要W/kgを確認</span>
    </div>

    <!-- 設定 -->
    <div class="section">
      <div class="section-title">チーム目標パワー目安</div>
      <div class="card">
        <div class="target-wkg-panel">
          <div>
            <div class="text-muted text-sm">チーム目標パワー</div>
            <div class="target-wkg-value" id="m-target-wkg-display">${state.targetWkgMin.toFixed(1)}〜${targetWkgMax().toFixed(1)} wkg</div>
            <p class="text-muted text-sm mt-8">0.5wkg幅の目安です。メンバーの体重差・身長差により、個人の必要W/kgが範囲外になっても問題ありません。</p>
          </div>
          <div class="target-wkg-inputs">
            <div class="form-group">
              <label>目安の下限 (wkg)</label>
              <input type="range" id="m-target-wkg-range" value="${state.targetWkgMin.toFixed(1)}" step="${TARGET_WKG_STEP}" min="${TARGET_WKG_MIN}" max="${TARGET_WKG_MAX}" />
            </div>
            <div class="form-group">
              <label>数値入力 (3.0〜7.0 / 0.1刻み)</label>
              <input type="number" id="m-target-wkg" value="${state.targetWkgMin.toFixed(1)}" step="${TARGET_WKG_STEP}" min="${TARGET_WKG_MIN}" max="${TARGET_WKG_MAX}" />
            </div>
          </div>
        </div>
        <div class="flex gap-8 wrap mt-12">
          <button class="btn btn-secondary btn-sm" id="m-auto-order" title="FTP降順で走順を並び替え">↕ Auto Order</button>
          <button class="btn btn-secondary btn-sm" id="m-opt-fixed" title="目安W/kgから求めた速度でプル時間を最適化">🔧 プル時間最適化</button>
        </div>
      </div>
    </div>

    <!-- メンバー選択 -->
    <div class="section">
      <div class="section-title">
        メンバー選択
        <span class="badge ${memberCount>=8?'badge-danger':'badge-info'}" style="margin-left:8px">${memberCount}/8</span>
      </div>
      <div class="card">
        ${state.riders.length === 0
          ? '<p class="text-muted text-sm">ライダーが登録されていません。<a href="#/teams" style="color:var(--color-primary)">チーム画面</a>からライダーを追加してください。</p>'
          : `<p class="text-muted text-sm mb-8">クリックして追加 / もう一度クリックで削除（最大8人）</p>
             <div style="display:flex;flex-wrap:wrap;gap:8px;">
               ${state.riders.map((r) => {
                 const inTeam = riderIds.has(r.id);
                 const m = state.members.find((m) => m.rider.id === r.id);
                 return `<button class="roster-chip ${inTeam?'roster-chip--active':''}" onclick="mainToggleRider(${r.id})" ${memberCount>=8&&!inTeam?'disabled':''}>
                   ${inTeam?`<span class="chip-order">${m.order}</span>`:''}
                   <span>${esc(r.name)}</span>
                   <span class="chip-meta">${r.weight_kg}kg / ${r.ftp_w}W</span>
                 </button>`;
               }).join('')}
             </div>
             ${memberCount>=8?'<p class="text-muted text-sm mt-8">上限（8人）に達しています。</p>':''}`
        }
      </div>
    </div>

    <!-- ラインナップ（ドラッグ&ドロップ + プル時間） -->
    ${memberCount > 0 ? `
    <div class="section">
      <div class="section-title">ラインナップ構成 <span class="text-muted text-sm" style="font-weight:normal">ドラッグで並び替え可</span></div>
      <div id="m-member-cards">
        ${sorted.map((m, idx) => renderMemberCard(m, idx, sorted.length)).join('')}
      </div>
    </div>
    ` : ''}

    <!-- W/kg計算結果 -->
    <div id="m-results">
      ${memberCount > 0 ? renderResults() : '<p class="text-muted">メンバーを選択するとパワー計算が表示されます。</p>'}
    </div>
  `;

  bindEvents(container);
  setupDragDrop();
}

// ============================================================
// メンバーカード
// ============================================================

function renderMemberCard(m, idx, total) {
  const selectableEquipments = getSelectableEquipments();
  const selectedEquipment = selectableEquipments.find((eq) => eq.frameId === m.frameId && eq.wheelId === (m.wheelId ?? null));
  return `
    <div class="member-card" id="m-mcard-${m.rider.id}" draggable="true" data-rider-id="${m.rider.id}"
         style="cursor:grab">
      <div class="member-card-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="order-badge">${m.order}</div>
          <div>
            <div class="member-card-name">${esc(m.rider.name)}</div>
            <div class="member-card-meta">${m.rider.weight_kg}kg &nbsp;/&nbsp; FTP ${m.rider.ftp_w}W</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <button class="btn btn-icon" onclick="mainMoveUp(${m.rider.id})"   ${idx===0?'disabled':''}>↑</button>
          <button class="btn btn-icon" onclick="mainMoveDown(${m.rider.id})" ${idx===total-1?'disabled':''}>↓</button>
          <button class="btn btn-danger btn-sm" onclick="mainRemoveMember(${m.rider.id})">外す</button>
        </div>
      </div>
      <div class="member-card-gear">
        <div class="form-group" style="margin:0">
          <label>機材</label>
          <select id="m-equipment-${m.rider.id}" onchange="mainUpdateGear(${m.rider.id})">
            ${selectableEquipments.map((eq)=>`<option value="${eq.key}" ${eq.key===selectedEquipment?.key?'selected':''}>${esc(eq.label)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>プル時間 (秒)</label>
          <input type="number" id="m-pull-${m.rider.id}" value="${m.pull_sec}" min="5" max="300" step="5"
                 onchange="mainUpdatePull(${m.rider.id}, this.value)" />
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// 結果テーブル + エクスポートボタン
// ============================================================

function renderResults() {
  const rows = calcResults();
  if (rows.length === 0) return '';

  const targetSpeedKph = calcTargetSpeedKph();
  const averageHeadWkg = round1(rowsAverage(rows.map((r) => r.headWkg)));
  const strongest = rows.reduce((max, r) => (r.headWkg > max.headWkg ? r : max), rows[0]);

  return `
    <div class="section">
      <div class="section-title">同一速度に必要なW/kg — 目安 ${state.targetWkgMin.toFixed(1)}〜${targetWkgMax().toFixed(1)} wkg</div>

      <!-- サマリー -->
      <div class="card mb-8 result-summary-grid">
        <div>
          <div class="text-muted text-sm">推定同一速度</div>
          <div class="card-title" style="color:var(--color-primary);margin-bottom:0">${targetSpeedKph} kph</div>
        </div>
        <div>
          <div class="text-muted text-sm">平均 先頭W/kg</div>
          <div class="card-title ${wkgBandClass(averageHeadWkg)}" style="margin-bottom:0">${averageHeadWkg.toFixed(1)} wkg</div>
        </div>
        <div>
          <div class="text-muted text-sm">最も高い必要W/kg</div>
          <div class="card-title ${wkgBandClass(strongest.headWkg)}" style="margin-bottom:0">
            ${esc(strongest.m.rider.name)} ${strongest.headWkg.toFixed(1)} wkg
          </div>
        </div>
      </div>

      <!-- 結果テーブル -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>順</th><th>ライダー</th><th>体重</th>
              <th>必要W/kg</th><th>必要W</th><th>目安</th>
              <th>後続W/kg</th><th>平均W/kg</th><th>FTP%</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr class="${wkgBandRowClass(r.headWkg)}">
                <td>${r.m.order}</td>
                <td><strong>${esc(r.m.rider.name)}</strong></td>
                <td>${r.m.rider.weight_kg} kg</td>
                <td><strong class="${wkgBandClass(r.headWkg)}">${r.headWkg.toFixed(1)} wkg</strong></td>
                <td>${r.headW} W</td>
                <td><span class="wkg-status ${wkgBandClass(r.headWkg)}">${wkgBandLabel(r.headWkg)}</span></td>
                <td>${r.draftWkg.toFixed(1)} wkg</td>
                <td>${r.avgWkg.toFixed(1)} wkg</td>
                <td><span class="${ftpClass(r.headPct)}">${r.headPct}%</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p class="text-muted text-sm mt-8">
        ※ 「必要W/kg」は先頭で同じ推定速度になるための値です。体重・身長・機材差により、個人ごとのW/kgはチーム目標範囲から外れることがあります。<br>
        ※ 後続W/kg/平均W/kgはドラフトとプル時間を加味した参考値です。
      </p>

    </div>
  `;
}

// ============================================================
// イベントバインド
// ============================================================

function bindEvents(container) {
  // 設定変更
  const updateTargetWkg = (value) => {
    state.targetWkgMin = clampTargetWkg(value);
    const range = document.getElementById('m-target-wkg-range');
    const number = document.getElementById('m-target-wkg');
    if (range) range.value = state.targetWkgMin.toFixed(1);
    if (number) number.value = state.targetWkgMin.toFixed(1);
    const display = document.getElementById('m-target-wkg-display');
    if (display) display.textContent = `${state.targetWkgMin.toFixed(1)}〜${targetWkgMax().toFixed(1)} wkg`;
    refreshResults();
  };
  document.getElementById('m-target-wkg-range')?.addEventListener('input', (e) => updateTargetWkg(e.target.value));
  document.getElementById('m-target-wkg')?.addEventListener('input', (e) => updateTargetWkg(e.target.value));

  // 自動化ボタン
  document.getElementById('m-auto-order')?.addEventListener('click', () => {
    autoOrder(); render(container); showToast('FTP降順で並び替えました');
  });
  document.getElementById('m-opt-fixed')?.addEventListener('click', () => {
    autoOptimizeFixed(); render(container); showToast('プル時間を最適化しました');
  });

  // グローバル関数（innerHTML onXxx 用）
  window.mainToggleRider = (riderId) => {
    const existing = state.members.find((m) => m.rider.id === riderId);
    if (existing) {
      state.members = state.members.filter((m) => m.rider.id !== riderId);
      reorderMembers();
    } else {
      if (state.members.length >= 8) return;
      const rider = state.riders.find((r) => r.id === riderId);
      if (!rider) return;
      const initialEquipment = getInitialEquipmentSelection();
      state.members.push({
        rider, frameId: initialEquipment.frameId, wheelId: initialEquipment.wheelId,
        order: state.members.length + 1, pull_sec: 30,
      });
    }
    render(container);
  };

  window.mainMoveUp = (riderId) => {
    const sorted = sortedMembers();
    const idx = sorted.findIndex((m) => m.rider.id === riderId);
    if (idx <= 0) return;
    [sorted[idx].order, sorted[idx-1].order] = [sorted[idx-1].order, sorted[idx].order];
    render(container);
  };

  window.mainMoveDown = (riderId) => {
    const sorted = sortedMembers();
    const idx = sorted.findIndex((m) => m.rider.id === riderId);
    if (idx < 0 || idx >= sorted.length - 1) return;
    [sorted[idx].order, sorted[idx+1].order] = [sorted[idx+1].order, sorted[idx].order];
    render(container);
  };

  window.mainRemoveMember = (riderId) => {
    state.members = state.members.filter((m) => m.rider.id !== riderId);
    reorderMembers();
    render(container);
  };

  window.mainUpdateGear = (riderId) => {
    const equipmentKey = document.getElementById(`m-equipment-${riderId}`)?.value;
    const selectedEquipment = getSelectableEquipments().find((eq) => eq.key === equipmentKey);
    const member = state.members.find((m) => m.rider.id === riderId);
    if (member) {
      member.frameId = selectedEquipment?.frameId ?? null;
      member.wheelId = selectedEquipment?.wheelId ?? null;
      const containerEl = document.getElementById('content');
      if (containerEl) render(containerEl); else refreshResults();
    }
  };

  window.mainUpdatePull = (riderId, val) => {
    const member = state.members.find((m) => m.rider.id === riderId);
    if (member) {
      member.pull_sec = Math.max(5, parseInt(val) || 30);
      refreshResults();
    }
  };
}

// ============================================================
// ドラッグ&ドロップ
// ============================================================

let dragSrcId = null;

function setupDragDrop() {
  document.querySelectorAll('[data-rider-id]').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      dragSrcId = parseInt(card.dataset.riderId);
      card.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => { card.style.opacity = ''; });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.style.outline = '2px solid var(--color-primary)';
    });
    card.addEventListener('dragleave', () => { card.style.outline = ''; });
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.style.outline = '';
      const targetId = parseInt(card.dataset.riderId);
      if (dragSrcId === null || dragSrcId === targetId) return;
      const src = state.members.find((m) => m.rider.id === dragSrcId);
      const tgt = state.members.find((m) => m.rider.id === targetId);
      if (src && tgt) {
        [src.order, tgt.order] = [tgt.order, src.order];
        const container = document.getElementById('content');
        render(container);
      }
    });
  });
}

// ============================================================
// 結果エリア差分更新
// ============================================================

function refreshResults() {
  const el = document.getElementById('m-results');
  if (!el) return;
  el.innerHTML = state.members.length > 0
    ? renderResults()
    : '<p class="text-muted">メンバーを選択するとパワー計算が表示されます。</p>';
}
