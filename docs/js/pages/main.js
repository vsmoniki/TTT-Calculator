// =============================================
// メイン画面 — オールインワン TTTシミュレーター
// ・ライダー選択（最大8人）
// ・目標速度 / ドラフト設定
// ・必要パワーをフロントで即時計算（バックエンド不要）
// =============================================
import { fetchRiders, fetchFrames, fetchWheels } from '../api.js';

// ----- 物理定数（バックエンド simulate.ts と同一） -----
const CDA_BASE  = 0.32;
const AERO_BASE = 5.0;
const BIKE_KG   = 8;
const RHO       = 1.225;
const CRR       = 0.004;
const G         = 9.81;

let state = {
  riders:  [],
  frames:  [],
  wheels:  [],
  members: [], // [{ rider, frameId, wheelId, order }]
  speed:   45,
  draft2:  0.80,
  draftN:  0.75,
};

// ---- エントリーポイント ----
export async function renderMain(container) {
  const [riders, frames, wheels] = await Promise.all([
    fetchRiders(), fetchFrames(), fetchWheels(),
  ]);
  state = { ...state, riders, frames, wheels, members: [] };
  render(container);
}

// ---- フルレンダリング ----
function render(container) {
  const memberCount = state.members.length;
  const riderIds    = new Set(state.members.map((m) => m.rider.id));
  const sorted      = [...state.members].sort((a, b) => a.order - b.order);

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">メイン</h2>
      <span class="text-muted text-sm">ライダーを選んで速度を設定するだけで必要パワーを即確認</span>
    </div>

    <!-- 目標速度・ドラフト設定 -->
    <div class="section">
      <div class="section-title">設定</div>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>目標速度 (kph) *</label>
            <input type="number" id="m-speed" value="${state.speed}" step="0.5" min="1" max="100" />
          </div>
          <div class="form-group">
            <label>ドラフト係数: 2番手</label>
            <input type="number" id="m-draft2" value="${state.draft2}" step="0.01" min="0" max="1" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>ドラフト係数: 3番手以降</label>
            <input type="number" id="m-draftN" value="${state.draftN}" step="0.01" min="0" max="1" />
          </div>
        </div>
      </div>
    </div>

    <!-- メンバー選択 -->
    <div class="section">
      <div class="section-title">
        メンバー選択
        <span class="badge ${memberCount >= 8 ? 'badge-danger' : 'badge-info'}" style="margin-left:8px">${memberCount}/8</span>
      </div>
      <div class="card">
        ${state.riders.length === 0
          ? '<p class="text-muted text-sm">ライダーが登録されていません。<a href="#/teams" style="color:var(--color-primary)">チーム画面</a>からライダーを追加してください。</p>'
          : `<p class="text-muted text-sm mb-8">クリックして追加 / もう一度クリックで削除（最大8人）</p>
             <div style="display:flex;flex-wrap:wrap;gap:8px;">
               ${state.riders.map((r) => {
                 const inTeam = riderIds.has(r.id);
                 const m = state.members.find((m) => m.rider.id === r.id);
                 return `
                   <button
                     class="roster-chip ${inTeam ? 'roster-chip--active' : ''}"
                     onclick="mainToggleRider(${r.id})"
                     ${memberCount >= 8 && !inTeam ? 'disabled' : ''}
                   >
                     ${inTeam ? `<span class="chip-order">${m.order}</span>` : ''}
                     <span>${esc(r.name)}</span>
                     <span class="chip-meta">${r.weight_kg}kg / FTP ${r.ftp_w}W</span>
                   </button>
                 `;
               }).join('')}
             </div>
             ${memberCount >= 8 ? '<p class="text-muted text-sm mt-8">上限（8人）に達しています。</p>' : ''}`
        }
      </div>
    </div>

    <!-- ラインナップ構成（機材設定） -->
    ${memberCount > 0 ? `
    <div class="section">
      <div class="section-title">ラインナップ構成</div>
      <div id="m-member-cards">
        ${sorted.map((m, idx) => renderMemberCard(m, idx, sorted.length)).join('')}
      </div>
    </div>
    ` : ''}

    <!-- 必要パワー（即時計算） -->
    <div class="section" id="m-results">
      ${memberCount > 0 ? calcAndRenderResults() : '<p class="text-muted">メンバーを選択するとパワー計算が表示されます。</p>'}
    </div>
  `;

  bindEvents(container);
}

// ---- メンバーカード ----
function renderMemberCard(m, idx, total) {
  return `
    <div class="member-card" id="m-mcard-${m.rider.id}">
      <div class="member-card-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="order-badge">${m.order}</div>
          <div>
            <div class="member-card-name">${esc(m.rider.name)}</div>
            <div class="member-card-meta">${m.rider.weight_kg}kg &nbsp;/&nbsp; FTP ${m.rider.ftp_w}W</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-icon" onclick="mainMoveUp(${m.rider.id})"   ${idx === 0           ? 'disabled' : ''} title="上へ">↑</button>
          <button class="btn btn-icon" onclick="mainMoveDown(${m.rider.id})" ${idx === total - 1   ? 'disabled' : ''} title="下へ">↓</button>
          <button class="btn btn-danger btn-sm" onclick="mainRemoveMember(${m.rider.id})">外す</button>
        </div>
      </div>
      <div class="member-card-gear">
        <div class="form-group" style="margin:0">
          <label>フレーム</label>
          <select id="m-frame-${m.rider.id}" onchange="mainUpdateGear(${m.rider.id})">
            <option value="">— なし —</option>
            ${state.frames.map((f) => `<option value="${f.id}" ${f.id === m.frameId ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>ホイール</label>
          <select id="m-wheel-${m.rider.id}" onchange="mainUpdateGear(${m.rider.id})">
            <option value="">— なし —</option>
            ${state.wheels.map((w) => `<option value="${w.id}" ${w.id === m.wheelId ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
  `;
}

// ---- 必要パワー計算 + テーブルHTML生成 ----
function calcAndRenderResults() {
  const sorted = [...state.members].sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return '';

  const v = state.speed / 3.6;

  const results = sorted.map((m) => {
    const frame = state.frames.find((f) => f.id === m.frameId);
    const wheel = state.wheels.find((w) => w.id === m.wheelId);

    const frameAdj = ((frame?.aero_score ?? AERO_BASE) - AERO_BASE) * 0.005;
    const wheelAdj = ((wheel?.aero_score ?? AERO_BASE) - AERO_BASE) * 0.004;
    const cda = Math.max(0.15, CDA_BASE - frameAdj - wheelAdj);

    const fAero = 0.5 * RHO * cda * v * v;
    const fRoll = CRR * (m.rider.weight_kg + BIKE_KG) * G;
    const headW = (fAero + fRoll) * v;

    const draftFactor = m.order === 1 ? 1.0 : m.order === 2 ? state.draft2 : state.draftN;
    const draftW = headW * draftFactor;

    return {
      rider:    m.rider,
      order:    m.order,
      headW:    Math.round(headW),
      draftW:   Math.round(draftW),
      headPct:  Math.round((headW  / m.rider.ftp_w) * 1000) / 10,
      draftPct: Math.round((draftW / m.rider.ftp_w) * 1000) / 10,
    };
  });

  const bottleneck = results.reduce(
    (max, r) => (r.draftPct > max.draftPct ? r : max),
    results[0],
  );

  return `
    <div class="section-title">必要パワー — ${state.speed} kph</div>

    <div class="card mb-8" style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">
      <div>
        <div class="text-muted text-sm">ボトルネック</div>
        <div class="card-title" style="color:var(--color-primary);margin-bottom:0">
          ${esc(bottleneck.rider.name)}
          <span class="tag-bottleneck">BOTTLENECK</span>
        </div>
      </div>
      <div>
        <div class="text-muted text-sm">最大FTP比（後続時）</div>
        <div class="card-title ${ftpClass(bottleneck.draftPct)}" style="margin-bottom:0">${bottleneck.draftPct}%</div>
      </div>
      <div>
        <div class="text-muted text-sm">最大FTP比（先頭時）</div>
        <div class="card-title ${ftpClass(Math.max(...results.map((r) => r.headPct)))}" style="margin-bottom:0">${Math.max(...results.map((r) => r.headPct))}%</div>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>順</th>
            <th>ライダー</th>
            <th>先頭 W</th>
            <th>後続 W</th>
            <th>先頭 FTP%</th>
            <th>後続 FTP%</th>
          </tr>
        </thead>
        <tbody>
          ${results.map((r) => {
            const isBottleneck = r.rider.id === bottleneck.rider.id;
            return `
              <tr class="${isBottleneck ? 'bottleneck' : ''}">
                <td>${r.order}</td>
                <td>
                  <strong>${esc(r.rider.name)}</strong>
                  ${isBottleneck ? '<span class="tag-bottleneck">BOTTLENECK</span>' : ''}
                </td>
                <td>${r.headW} W</td>
                <td>${r.draftW} W</td>
                <td><span class="${ftpClass(r.headPct)}">${r.headPct}%</span></td>
                <td><span class="${ftpClass(r.draftPct)}">${r.draftPct}%</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="text-muted text-sm mt-8">
      ※ 先頭 W = 目標速度を単独で維持するための推定パワー。後続 W = ドラフティング恩恵を加味した推定パワー。<br>
      ※ 機材未設定の場合は基準値（aero_score = 5）で計算。
    </p>
  `;
}

// ---- イベントバインド ----
function bindEvents(container) {
  document.getElementById('m-speed').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0) { state.speed = v; refreshResults(); }
  });

  document.getElementById('m-draft2').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) { state.draft2 = v; refreshResults(); }
  });

  document.getElementById('m-draftN').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v)) { state.draftN = v; refreshResults(); }
  });

  window.mainToggleRider = (riderId) => {
    const existing = state.members.find((m) => m.rider.id === riderId);
    if (existing) {
      state.members = state.members.filter((m) => m.rider.id !== riderId);
      reorderMembers();
    } else {
      if (state.members.length >= 8) return;
      const rider = state.riders.find((r) => r.id === riderId);
      if (!rider) return;
      state.members.push({ rider, frameId: null, wheelId: null, order: state.members.length + 1 });
    }
    render(container);
  };

  window.mainMoveUp = (riderId) => {
    const sorted = [...state.members].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((m) => m.rider.id === riderId);
    if (idx <= 0) return;
    [sorted[idx].order, sorted[idx - 1].order] = [sorted[idx - 1].order, sorted[idx].order];
    render(container);
  };

  window.mainMoveDown = (riderId) => {
    const sorted = [...state.members].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((m) => m.rider.id === riderId);
    if (idx < 0 || idx >= sorted.length - 1) return;
    [sorted[idx].order, sorted[idx + 1].order] = [sorted[idx + 1].order, sorted[idx].order];
    render(container);
  };

  window.mainRemoveMember = (riderId) => {
    state.members = state.members.filter((m) => m.rider.id !== riderId);
    reorderMembers();
    render(container);
  };

  window.mainUpdateGear = (riderId) => {
    const frameVal = document.getElementById(`m-frame-${riderId}`)?.value;
    const wheelVal = document.getElementById(`m-wheel-${riderId}`)?.value;
    const member   = state.members.find((m) => m.rider.id === riderId);
    if (member) {
      member.frameId = frameVal ? parseInt(frameVal) : null;
      member.wheelId = wheelVal ? parseInt(wheelVal) : null;
      refreshResults();
    }
  };
}

// ---- 結果エリアだけ再描画（入力変更時） ----
function refreshResults() {
  const el = document.getElementById('m-results');
  if (!el) return;
  el.innerHTML = state.members.length > 0
    ? calcAndRenderResults()
    : '<p class="text-muted">メンバーを選択するとパワー計算が表示されます。</p>';
}

// ---- order 連番を振り直す ----
function reorderMembers() {
  [...state.members]
    .sort((a, b) => a.order - b.order)
    .forEach((m, i) => { m.order = i + 1; });
}

// ---- FTP比による色分け ----
function ftpClass(pct) {
  if (pct >= 110) return 'pct-danger';
  if (pct >= 95)  return 'pct-warn';
  return '';
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
