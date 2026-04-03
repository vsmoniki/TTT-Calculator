// =============================================
// メイン画面 — フル機能 TTTシミュレーター
// ・ライダー選択・プル時間・機材設定
// ・ドラッグ&ドロップ並び替え
// ・Auto Speed / Auto Order / Auto Optimize
// ・JSON/リンク/画像エクスポート
// ・URLステート復元
// =============================================
import { fetchRiders, fetchFrames, fetchWheels } from '../api.js';

// ---- 物理定数 ----
const CDA_BASE  = 0.32;
const AERO_BASE = 5.0;
const BIKE_KG   = 8;
const RHO       = 1.225;
const CRR       = 0.004;
const G         = 9.81;
const DEFAULT_FRAME_NAME = 'CADEX tri';
const DEFAULT_WHEEL_NAME = 'DT Swiss ARC 1100 DICUT 85/Disc';
const ROTATION_CYCLE_SEC = 120; // Auto Optimize のベース回転時間 (秒)

let state = {
  riders: [], frames: [], wheels: [],
  members: [],        // [{ rider, frameId, wheelId, order, pull_sec }]
  speed: 44,
  draft2: 0.80,
  draftN: 0.75,
  intensityTarget: 0.85,
  defaultFrameId: null,
  defaultWheelId: null,
};

// ============================================================
// 物理計算ヘルパー
// ============================================================

function calcHeadPower(member, v) {
  const frame = state.frames.find((f) => f.id === member.frameId);
  const wheel = state.wheels.find((w) => w.id === member.wheelId);
  const fAdj = ((frame?.aero_score ?? AERO_BASE) - AERO_BASE) * 0.005;
  const wAdj = ((wheel?.aero_score ?? AERO_BASE) - AERO_BASE) * 0.004;
  const cda  = Math.max(0.15, CDA_BASE - fAdj - wAdj);
  const fAero = 0.5 * RHO * cda * v * v;
  const fRoll = CRR * (member.rider.weight_kg + BIKE_KG) * G;
  return (fAero + fRoll) * v;
}

// ドラフト恩恵の平均係数（先頭以外の全ポジション平均）
function draftFactorAvg(n) {
  if (n <= 1) return 1.0;
  if (n === 2) return state.draft2;
  return (state.draft2 + (n - 2) * state.draftN) / (n - 1);
}

// 均衡 IF（全ライダーのFTP加重で理論的に達成可能な最良 IF）
function balancedIF(v) {
  const sorted = sortedMembers();
  if (sorted.length === 0) return 0;
  const n    = sorted.length;
  const dfAvg = draftFactorAvg(n);
  const sumFtpPerHead = sorted.reduce((s, m) => s + m.rider.ftp_w / calcHeadPower(m, v), 0);
  return (1 + (n - 1) * dfAvg) / sumFtpPerHead;
}

function calcResults() {
  const sorted = sortedMembers();
  if (sorted.length === 0) return [];
  const n     = sorted.length;
  const v     = state.speed / 3.6;
  const dfAvg = draftFactorAvg(n);
  const totalPull = sorted.reduce((s, m) => s + m.pull_sec, 0) || 1;

  const rows = sorted.map((m) => {
    const headW = calcHeadPower(m, v);
    const draftW = headW * (m.order === 1 ? 1.0 : m.order === 2 ? state.draft2 : state.draftN);
    const headPct  = Math.round((headW  / m.rider.ftp_w) * 1000) / 10;
    const draftPct = Math.round((draftW / m.rider.ftp_w) * 1000) / 10;
    const pullRatio = m.pull_sec / totalPull;
    const avgPower  = headW * (dfAvg + (1 - dfAvg) * pullRatio);
    const avgIF     = Math.round((avgPower / m.rider.ftp_w) * 1000) / 10;
    return { m, headW: Math.round(headW), draftW: Math.round(draftW), headPct, draftPct, pullRatio, avgIF };
  });

  const bottleneck = rows.reduce((max, r) => (r.avgIF > max.avgIF ? r : max), rows[0]);
  rows.forEach((r) => { r.isBottleneck = r === bottleneck; });
  return rows;
}

// ============================================================
// 最適化
// ============================================================

// 二分法: f(lo)<0, f(hi)>0 を前提に根を求める
function bisect(f, lo, hi) {
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid; else lo = mid;
    if (hi - lo < 0.005) break;
  }
  return (lo + hi) / 2;
}

function autoSpeed() {
  const sorted = sortedMembers();
  if (sorted.length === 0) return;
  const target = state.intensityTarget;
  // balancedIF は速度が上がるほど増加するので lo=5kph, hi=90kph で探索
  const f = (v) => balancedIF(v) - target;
  if (f(5 / 3.6) > 0) { alert('目標 IF が低すぎます（5 kph でも超過）。'); return; }
  if (f(90 / 3.6) < 0) { alert('目標 IF が高すぎます（90 kph でも未達）。'); return; }
  const vOpt = bisect(f, 5 / 3.6, 90 / 3.6);
  state.speed = Math.round(vOpt * 3.6 * 10) / 10;
}

function autoOrder() {
  const sorted = [...state.members].sort((a, b) => b.rider.ftp_w - a.rider.ftp_w);
  sorted.forEach((m, i) => { m.order = i + 1; });
}

function autoOptimizeFixed() {
  const sorted = sortedMembers();
  if (sorted.length === 0) return;
  const v     = state.speed / 3.6;
  const n     = sorted.length;
  const dfAvg = draftFactorAvg(n);
  const ifTarget = balancedIF(v);

  const ratios = sorted.map((m) => {
    const headW = calcHeadPower(m, v);
    const r = (ifTarget * m.rider.ftp_w / headW - dfAvg) / (1 - dfAvg);
    return Math.max(0.05, r); // 最低 5% は確保
  });
  const sumR = ratios.reduce((s, r) => s + r, 0);
  sorted.forEach((m, i) => {
    m.pull_sec = Math.max(10, Math.round((ratios[i] / sumR) * ROTATION_CYCLE_SEC));
  });
}

function autoOptimizeVariable() {
  autoSpeed();
  autoOptimizeFixed();
}

// ============================================================
// URLステート
// ============================================================

function encodeState() {
  const s = {
    m: state.members.map((m) => ({ id: m.rider.id, f: m.frameId, w: m.wheelId, p: m.pull_sec, o: m.order })),
    spd: state.speed, d2: state.draft2, dN: state.draftN, it: state.intensityTarget,
  };
  return btoa(encodeURIComponent(JSON.stringify(s)));
}

function decodeState(hash) {
  try {
    return JSON.parse(decodeURIComponent(atob(hash)));
  } catch { return null; }
}

function applyURLState(decoded) {
  if (!decoded?.m) return;
  state.speed           = decoded.spd ?? state.speed;
  state.draft2          = decoded.d2  ?? state.draft2;
  state.draftN          = decoded.dN  ?? state.draftN;
  state.intensityTarget = decoded.it  ?? state.intensityTarget;
  state.members = decoded.m.map((entry) => {
    const rider = state.riders.find((r) => r.id === entry.id);
    if (!rider) return null;
    return { rider, frameId: entry.f ?? null, wheelId: entry.w ?? null, order: entry.o, pull_sec: entry.p ?? 30 };
  }).filter(Boolean);
}

// ============================================================
// エクスポート
// ============================================================

function exportJSON() {
  const rows = calcResults();
  const payload = {
    speed_kph: state.speed, draft_factor_2nd: state.draft2,
    draft_factor_other: state.draftN, intensity_target: state.intensityTarget,
    riders: rows.map((r) => ({
      order: r.m.order, name: r.m.rider.name,
      pull_sec: r.m.pull_sec, head_w: r.headW, draft_w: r.draftW,
      head_ftp_pct: r.headPct, draft_ftp_pct: r.draftPct, avg_if: r.avgIF,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'ttt-plan.json' });
  a.click(); URL.revokeObjectURL(a.href);
}

function exportLink() {
  const url = `${location.origin}${location.pathname}#state=${encodeState()}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('リンクをコピーしました');
  }).catch(() => {
    prompt('以下のURLをコピーしてください:', url);
  });
}

async function exportImage() {
  const el = document.getElementById('m-results');
  if (!el || !window.html2canvas) { alert('画像エクスポートが利用できません。'); return; }
  try {
    const canvas = await html2canvas(el, { backgroundColor: '#0f1923', scale: 2 });
    const a = Object.assign(document.createElement('a'), { href: canvas.toDataURL('image/png'), download: 'ttt-plan.png' });
    a.click();
  } catch (e) {
    alert('画像の生成に失敗しました: ' + e.message);
  }
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

function ifClass(ifVal) {
  if (ifVal >= 1.05) return 'pct-danger';
  if (ifVal >= state.intensityTarget) return 'pct-warn';
  return '';
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ============================================================
// エントリーポイント
// ============================================================

export async function renderMain(container) {
  const [riders, frames, wheels] = await Promise.all([fetchRiders(), fetchFrames(), fetchWheels()]);
  const defaultFrameId = frames.find((f) => f.name === DEFAULT_FRAME_NAME)?.id ?? null;
  const defaultWheelId = wheels.find((w) => w.name === DEFAULT_WHEEL_NAME)?.id ?? null;
  state = { ...state, riders, frames, wheels, members: [], defaultFrameId, defaultWheelId };

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
      <h2 class="page-title">シミュレーション</h2>
      <span class="text-muted text-sm">ライダーを選んで速度を設定するだけで必要パワーを即確認</span>
    </div>

    <!-- 設定 -->
    <div class="section">
      <div class="section-title">設定</div>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>目標速度 (kph)</label>
            <input type="number" id="m-speed" value="${state.speed}" step="0.5" min="1" max="100" />
          </div>
          <div class="form-group">
            <label>強度ターゲット (IF)</label>
            <select id="m-intensity">
              <option value="0.80" ${state.intensityTarget===0.80?'selected':''}>0.80 — イージー</option>
              <option value="0.85" ${state.intensityTarget===0.85?'selected':''}>0.85 — ノーマル</option>
              <option value="0.90" ${state.intensityTarget===0.90?'selected':''}>0.90 — ハード</option>
              <option value="0.95" ${state.intensityTarget===0.95?'selected':''}>0.95 — ベリーハード</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>ドラフト係数: 2番手</label>
            <input type="number" id="m-draft2" value="${state.draft2}" step="0.01" min="0" max="1" />
          </div>
          <div class="form-group">
            <label>ドラフト係数: 3番手以降</label>
            <input type="number" id="m-draftN" value="${state.draftN}" step="0.01" min="0" max="1" />
          </div>
        </div>

        <!-- 自動化ボタン -->
        <div class="flex gap-8 wrap mt-12">
          <button class="btn btn-secondary btn-sm" id="m-auto-speed" title="強度ターゲットに合わせて速度を自動計算">⚡ Auto Speed</button>
          <button class="btn btn-secondary btn-sm" id="m-auto-order" title="FTP降順で走順を並び替え">↕ Auto Order</button>
          <button class="btn btn-secondary btn-sm" id="m-opt-fixed"  title="現在の速度でプル時間を最適化">🔧 最適化（速度固定）</button>
          <button class="btn btn-secondary btn-sm" id="m-opt-var"    title="速度・プル時間をまとめて最適化">🚀 最適化（変速）</button>
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

    <!-- 必要パワー計算結果 -->
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
          <label>フレーム</label>
          <select id="m-frame-${m.rider.id}" onchange="mainUpdateGear(${m.rider.id})">
            <option value="">— なし —</option>
            ${state.frames.map((f)=>`<option value="${f.id}" ${f.id===m.frameId?'selected':''}>${esc(f.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>ホイール</label>
          <select id="m-wheel-${m.rider.id}" onchange="mainUpdateGear(${m.rider.id})">
            <option value="">— なし —</option>
            ${state.wheels.map((w)=>`<option value="${w.id}" ${w.id===m.wheelId?'selected':''}>${esc(w.name)}</option>`).join('')}
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
  const bif = balancedIF(state.speed / 3.6);

  return `
    <div class="section">
      <div class="section-title">必要パワー — ${state.speed} kph</div>

      <!-- サマリー -->
      <div class="card mb-8" style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">
        <div>
          <div class="text-muted text-sm">ボトルネック</div>
          <div class="card-title" style="color:var(--color-primary);margin-bottom:0">
            ${esc(rows.find(r=>r.isBottleneck)?.m.rider.name??'')}
            <span class="tag-bottleneck">BOTTLENECK</span>
          </div>
        </div>
        <div>
          <div class="text-muted text-sm">均衡 IF（理論値）</div>
          <div class="card-title ${ifClass(bif)}" style="margin-bottom:0">${bif.toFixed(3)}</div>
        </div>
        <div>
          <div class="text-muted text-sm">強度ターゲット</div>
          <div class="card-title" style="margin-bottom:0">${state.intensityTarget}</div>
        </div>
        <div>
          <div class="text-muted text-sm">最大先頭 FTP%</div>
          <div class="card-title ${ftpClass(Math.max(...rows.map(r=>r.headPct)))}" style="margin-bottom:0">
            ${Math.max(...rows.map(r=>r.headPct))}%
          </div>
        </div>
      </div>

      <!-- 結果テーブル -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>順</th><th>ライダー</th><th>プル(秒)</th>
              <th>先頭 W</th><th>後続 W</th>
              <th>先頭 FTP%</th><th>後続 FTP%</th><th>平均 IF</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr class="${r.isBottleneck?'bottleneck':''}">
                <td>${r.m.order}</td>
                <td>
                  <strong>${esc(r.m.rider.name)}</strong>
                  ${r.isBottleneck?'<span class="tag-bottleneck">BOTTLENECK</span>':''}
                </td>
                <td>${r.m.pull_sec}s <span class="text-muted text-sm">(${Math.round(r.pullRatio*100)}%)</span></td>
                <td>${r.headW} W</td>
                <td>${r.draftW} W</td>
                <td><span class="${ftpClass(r.headPct)}">${r.headPct}%</span></td>
                <td><span class="${ftpClass(r.draftPct)}">${r.draftPct}%</span></td>
                <td><span class="${ifClass(r.avgIF)}">${r.avgIF}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p class="text-muted text-sm mt-8">
        ※ 先頭W = 目標速度を単独維持するための推定パワー。後続W = ドラフト恩恵を加味した推定パワー。<br>
        ※ 平均IF = ローテーション中の平均強度。強度ターゲット(${state.intensityTarget})超えは<span class="pct-warn">橙</span>/<span class="pct-danger">赤</span>で警告。
      </p>

      <!-- エクスポート -->
      <div class="flex gap-8 wrap mt-12">
        <button class="btn btn-secondary btn-sm" id="m-export-json">📥 JSON</button>
        <button class="btn btn-secondary btn-sm" id="m-export-link">🔗 リンク共有</button>
        <button class="btn btn-secondary btn-sm" id="m-export-img">📸 画像保存</button>
      </div>
    </div>
  `;
}

// ============================================================
// イベントバインド
// ============================================================

function bindEvents(container) {
  // 設定変更
  document.getElementById('m-speed')?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0) { state.speed = v; refreshResults(); }
  });
  document.getElementById('m-draft2')?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) { state.draft2 = v; refreshResults(); }
  });
  document.getElementById('m-draftN')?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) { state.draftN = v; refreshResults(); }
  });
  document.getElementById('m-intensity')?.addEventListener('change', (e) => {
    state.intensityTarget = parseFloat(e.target.value);
    refreshResults();
  });

  // 自動化ボタン
  document.getElementById('m-auto-speed')?.addEventListener('click', () => {
    autoSpeed(); render(container); showToast(`速度を ${state.speed} kph に設定しました`);
  });
  document.getElementById('m-auto-order')?.addEventListener('click', () => {
    autoOrder(); render(container); showToast('FTP降順で並び替えました');
  });
  document.getElementById('m-opt-fixed')?.addEventListener('click', () => {
    autoOptimizeFixed(); render(container); showToast('プル時間を最適化しました');
  });
  document.getElementById('m-opt-var')?.addEventListener('click', () => {
    autoOptimizeVariable(); render(container);
    showToast(`速度 ${state.speed} kph・プル時間を最適化しました`);
  });

  // エクスポート（results セクション内のボタン）
  document.getElementById('m-export-json')?.addEventListener('click', exportJSON);
  document.getElementById('m-export-link')?.addEventListener('click', exportLink);
  document.getElementById('m-export-img')?.addEventListener('click', exportImage);

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
      state.members.push({
        rider, frameId: state.defaultFrameId, wheelId: state.defaultWheelId,
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
    const fv = document.getElementById(`m-frame-${riderId}`)?.value;
    const wv = document.getElementById(`m-wheel-${riderId}`)?.value;
    const member = state.members.find((m) => m.rider.id === riderId);
    if (member) {
      member.frameId = fv ? parseInt(fv) : null;
      member.wheelId = wv ? parseInt(wv) : null;
      refreshResults();
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
  // エクスポートボタンを再バインド
  document.getElementById('m-export-json')?.addEventListener('click', exportJSON);
  document.getElementById('m-export-link')?.addEventListener('click', exportLink);
  document.getElementById('m-export-img')?.addEventListener('click', exportImage);
}
