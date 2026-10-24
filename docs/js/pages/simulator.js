// =============================================
// シミュレーター画面（メイン）
// コース × 機材 × 編成 → 予想タイム（WTRL 4番手計時）をブラウザ内だけで計算する。
// 旧 Worker /simulate の後継。サーバー・認証は不要。
// =============================================
import { COURSES, FRAMES, WHEELS, findCourse, findFrame, findWheel } from '../data.js';
import { simulateRace, findIntensityForTargetTime, gearCdAMultiplier } from '../engine.js';
import { loadRiders, findRider, loadSimState, saveSimState } from '../store.js';

let registry = [];
let state = null;

// ---------- ユーティリティ ----------
function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtTime(sec) {
  if (sec == null || !Number.isFinite(sec)) return '--:--';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(ss).padStart(2, '0')}`;
}

function showToast(msg) {
  const t = Object.assign(document.createElement('div'), { textContent: msg });
  Object.assign(t.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: 'var(--color-primary)', color: '#000', padding: '10px 20px',
    borderRadius: '8px', fontWeight: '600', zIndex: '9999', pointerEvents: 'none',
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ---------- 共有リンク（URL ハッシュに状態を埋め込む） ----------
function encodeState(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(str) {
  try {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function applySharedState(shared) {
  if (!shared || !Array.isArray(shared.riders)) return false;
  state.courseId = shared.courseId ?? state.courseId;
  state.frameId = shared.frameId ?? state.frameId;
  state.wheelId = shared.wheelId ?? state.wheelId;
  state.pullSec = shared.pullSec ?? state.pullSec;
  state.pullPct = shared.pullPct ?? state.pullPct;
  state.dropPct = shared.dropPct ?? state.dropPct;
  state.mode = shared.mode === 'target' ? 'target' : 'predict';
  state.targetMin = shared.targetMin ?? state.targetMin;
  state.targetSec = shared.targetSec ?? state.targetSec;
  // 共有リンクではライダーをスナップショットとして埋め込む（受け取った人の登録簿に依存しない）
  state.lineup = shared.riders.map((r) => ({
    guest: {
      name: String(r.name ?? 'Guest'), weightKg: Number(r.weightKg) || 70,
      heightCm: Number(r.heightCm) || 175, ftpW: Number(r.ftpW) || 250,
    },
  }));
  return true;
}

// ---------- 編成の解決 ----------
function resolveEntry(entry) {
  if (entry.guest) return { ...entry.guest, isGuest: true };
  const r = findRider(registry, entry.riderId);
  if (!r) return null;
  return { id: r.id, name: r.name, weightKg: r.weightKg, heightCm: r.heightCm, ftpW: r.ftpW, isGuest: false };
}

function resolvedLineup() {
  return state.lineup.map(resolveEntry).filter(Boolean);
}

function persist() {
  saveSimState(state);
}

// ---------- エントリーポイント ----------
export function renderSimulator(container, params) {
  registry = loadRiders();
  state = loadSimState();

  const sharedParam = params?.get('state');
  if (sharedParam) {
    const shared = decodeState(sharedParam);
    if (shared && applySharedState(shared)) {
      persist();
      showToast('共有リンクの編成を復元しました');
    }
  }

  render(container);
  runCalculation(container);
}

// ---------- 画面描画 ----------
function render(container) {
  const course = findCourse(state.courseId) ?? COURSES[0];
  const frame = findFrame(state.frameId) ?? FRAMES[0];
  const wheel = findWheel(state.wheelId) ?? WHEELS[0];
  const gearMult = gearCdAMultiplier(frame, wheel);
  const lineup = resolvedLineup();
  const inLineupIds = new Set(state.lineup.filter((e) => e.riderId != null).map((e) => e.riderId));
  const addable = registry.filter((r) => !inLineupIds.has(r.id));
  const isTtFrame = frame?.bikeType === 'tt';

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">TTT シミュレーター</h2>
      <span class="text-muted text-sm">コースと編成から予想タイムを計算します（ブラウザ内計算）</span>
    </div>

    <div class="section">
      <div class="section-title">コース・機材</div>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>コース</label>
            <select id="sim-course">
              ${COURSES.map((c) => `<option value="${c.id}" ${c.id === course.id ? 'selected' : ''}>${esc(c.name)}（${c.distanceKm}km / ${c.elevationM}m）</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>フレーム（チーム共通）</label>
            <select id="sim-frame">
              ${FRAMES.map((f) => `<option value="${f.id}" ${f.id === frame.id ? 'selected' : ''}>${esc(f.name)}（${f.flatDeltaSec}秒）</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>ホイール（チーム共通）</label>
            <select id="sim-wheel">
              ${WHEELS.map((w) => `<option value="${w.id}" ${w.id === wheel.id ? 'selected' : ''}>${esc(w.name)}（${w.flatDeltaSec}秒）</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>機材の効き具合</label>
            <p class="text-sm" style="padding-top:8px">
              基準機材比 ${((frame?.flatDeltaSec ?? 0) + (wheel?.flatDeltaSec ?? 0))} 秒 → CdA × ${gearMult.toFixed(3)}
            </p>
          </div>
        </div>
        ${isTtFrame ? '<p class="text-sm text-muted">※ TTフレーム選択中: Zwift の TTT では TT バイクでもドラフトが効くため、その前提で計算します。</p>' : ''}
      </div>
    </div>

    <div class="section">
      <div class="section-title">ラインナップ <span class="badge ${lineup.length >= 8 ? 'badge-danger' : 'badge-info'}" style="margin-left:8px">${lineup.length}/8</span></div>
      <div id="sim-lineup">
        ${lineup.length === 0 ? '<p class="text-muted">ライダーがいません。下から追加してください。</p>' : ''}
        ${lineup.map((r, idx) => `
          <div class="member-card">
            <div class="member-card-header" style="margin-bottom:0">
              <div style="display:flex;align-items:center;gap:10px;">
                <div class="order-badge">${idx + 1}</div>
                <div>
                  <div class="member-card-name">${esc(r.name)}${r.isGuest ? ' <span class="badge badge-warn">ゲスト</span>' : ''}</div>
                  <div class="member-card-meta">${r.weightKg}kg / ${r.heightCm}cm / FTP ${r.ftpW}W（${(r.ftpW / r.weightKg).toFixed(2)} W/kg）</div>
                </div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;">
                <button class="btn btn-icon" data-move="-1" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}>↑</button>
                <button class="btn btn-icon" data-move="1" data-idx="${idx}" ${idx === lineup.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="btn btn-danger btn-sm" data-remove="${idx}">外す</button>
              </div>
            </div>
          </div>`).join('')}
      </div>
      <div class="card">
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0">
            <label>登録ライダーを追加</label>
            <select id="sim-add-rider">
              ${addable.length === 0 ? '<option value="">（追加できるライダーがいません）</option>' : addable.map((r) => `<option value="${r.id}">${esc(r.name)}（${r.weightKg}kg / FTP ${r.ftpW}W）</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;display:flex;align-items:flex-end;">
            <button class="btn btn-secondary" id="sim-add-rider-btn" ${addable.length === 0 || lineup.length >= 8 ? 'disabled' : ''}>追加</button>
          </div>
        </div>
        <div class="form-row mt-12">
          <div class="form-group" style="margin-bottom:0">
            <label>ゲストを追加（登録なしで1人分）</label>
            <input type="text" id="guest-name" placeholder="名前" />
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>体重kg / 身長cm / FTP</label>
            <div style="display:flex;gap:6px;">
              <input type="number" id="guest-weight" placeholder="70" min="30" max="150" />
              <input type="number" id="guest-height" placeholder="175" min="120" max="220" />
              <input type="number" id="guest-ftp" placeholder="250" min="50" max="600" />
            </div>
          </div>
        </div>
        <div class="mt-8">
          <button class="btn btn-secondary" id="sim-add-guest-btn" ${lineup.length >= 8 ? 'disabled' : ''}>ゲスト追加</button>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">走り方の設定</div>
      <div class="card">
        <div class="inner-tabs">
          <button class="inner-tab ${state.mode === 'predict' ? 'active' : ''}" data-mode="predict">予想タイム</button>
          <button class="inner-tab ${state.mode === 'target' ? 'active' : ''}" data-mode="target">目標タイムから逆算</button>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>プル時間（秒）</label>
            <input type="number" id="sim-pull-sec" value="${state.pullSec}" min="5" max="300" step="5" />
          </div>
          <div class="form-group">
            <label>プル強度（先頭の %FTP）</label>
            <input type="number" id="sim-pull-pct" value="${state.pullPct}" min="50" max="200" step="1" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>千切れる限界（後続の上限 %FTP）</label>
            <input type="number" id="sim-drop-pct" value="${state.dropPct}" min="50" max="150" step="1" />
          </div>
          ${state.mode === 'target' ? `
          <div class="form-group">
            <label>目標タイム（分：秒）</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="number" id="sim-target-min" value="${state.targetMin}" min="0" max="600" />
              <span>:</span>
              <input type="number" id="sim-target-sec" value="${state.targetSec}" min="0" max="59" />
            </div>
          </div>` : '<div class="form-group"></div>'}
        </div>
        <div class="flex gap-8 wrap mt-8">
          <button class="btn btn-primary" id="sim-run">計算する</button>
          <button class="btn btn-secondary" id="sim-share">共有リンクをコピー</button>
        </div>
      </div>
    </div>

    <div id="sim-results"></div>
  `;

  bindEvents(container);
}

// ---------- イベント ----------
function bindEvents(container) {
  const rerender = () => { persist(); render(container); runCalculation(container); };

  container.querySelector('#sim-course').addEventListener('change', (e) => { state.courseId = Number(e.target.value); rerender(); });
  container.querySelector('#sim-frame').addEventListener('change', (e) => { state.frameId = Number(e.target.value); rerender(); });
  container.querySelector('#sim-wheel').addEventListener('change', (e) => { state.wheelId = Number(e.target.value); rerender(); });

  container.querySelectorAll('[data-move]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      const dir = Number(btn.dataset.move);
      const j = idx + dir;
      if (j < 0 || j >= state.lineup.length) return;
      [state.lineup[idx], state.lineup[j]] = [state.lineup[j], state.lineup[idx]]; // 配列の入れ替えなので必ず成功する
      rerender();
    });
  });
  container.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.lineup.splice(Number(btn.dataset.remove), 1);
      rerender();
    });
  });

  container.querySelector('#sim-add-rider-btn')?.addEventListener('click', () => {
    const sel = container.querySelector('#sim-add-rider');
    const id = Number(sel?.value);
    if (!id || state.lineup.length >= 8) return;
    state.lineup.push({ riderId: id });
    rerender();
  });

  container.querySelector('#sim-add-guest-btn')?.addEventListener('click', () => {
    const name = container.querySelector('#guest-name').value.trim() || 'ゲスト';
    const weightKg = Number(container.querySelector('#guest-weight').value) || 70;
    const heightCm = Number(container.querySelector('#guest-height').value) || 175;
    const ftpW = Number(container.querySelector('#guest-ftp').value) || 250;
    if (state.lineup.length >= 8) return;
    state.lineup.push({ guest: { name, weightKg, heightCm, ftpW } });
    rerender();
  });

  container.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => { state.mode = btn.dataset.mode; rerender(); });
  });

  const readSettings = () => {
    state.pullSec = Math.max(5, Number(container.querySelector('#sim-pull-sec').value) || 30);
    state.pullPct = Math.min(200, Math.max(50, Number(container.querySelector('#sim-pull-pct').value) || 110));
    state.dropPct = Math.min(150, Math.max(50, Number(container.querySelector('#sim-drop-pct').value) || 95));
    if (state.mode === 'target') {
      state.targetMin = Math.max(0, Number(container.querySelector('#sim-target-min')?.value) || 0);
      state.targetSec = Math.min(59, Math.max(0, Number(container.querySelector('#sim-target-sec')?.value) || 0));
    }
    persist();
  };
  ['#sim-pull-sec', '#sim-pull-pct', '#sim-drop-pct', '#sim-target-min', '#sim-target-sec'].forEach((sel) => {
    container.querySelector(sel)?.addEventListener('change', readSettings);
  });

  container.querySelector('#sim-run').addEventListener('click', () => { readSettings(); runCalculation(container); });
  container.querySelector('#sim-share').addEventListener('click', async () => {
    readSettings();
    const riders = resolvedLineup().map((r) => ({
      name: r.name, weightKg: r.weightKg, heightCm: r.heightCm, ftpW: r.ftpW,
    }));
    const shared = {
      v: 2, courseId: state.courseId, frameId: state.frameId, wheelId: state.wheelId,
      pullSec: state.pullSec, pullPct: state.pullPct, dropPct: state.dropPct,
      mode: state.mode, targetMin: state.targetMin, targetSec: state.targetSec, riders,
    };
    const url = `${location.origin}${location.pathname}#/simulator?state=${encodeState(shared)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('共有リンクをコピーしました');
    } catch {
      window.prompt('共有リンク（コピーしてください）', url);
    }
  });
}

// ---------- 計算と結果表示 ----------
function runCalculation(container) {
  const resultsEl = container.querySelector('#sim-results');
  if (!resultsEl) return;
  const course = findCourse(state.courseId);
  const frame = findFrame(state.frameId);
  const wheel = findWheel(state.wheelId);
  const lineup = resolvedLineup();
  if (!course || lineup.length === 0) {
    resultsEl.innerHTML = '<p class="text-muted">ライダーを1人以上追加すると計算できます。</p>';
    return;
  }

  const bikeType = frame?.bikeType === 'tt' ? 'tt' : 'road'; // フレームがチーム全員のバイク種別を決める
  const engineRiders = lineup.map((r, i) => ({
    id: r.id ?? `guest-${i}`, name: r.name, weightKg: r.weightKg,
    heightCm: r.heightCm, ftpW: r.ftpW, bikeType,
  }));
  const input = {
    course, riders: engineRiders,
    gearMultiplier: gearCdAMultiplier(frame, wheel),
    pullSec: state.pullSec, pullPct: state.pullPct, dropPct: state.dropPct,
  };

  resultsEl.innerHTML = '<div class="loading">計算中...</div>';
  // 逆算モードは探索で少し時間がかかるため、描画を先に通してから計算する
  setTimeout(() => {
    try {
      let html = '';
      let result;
      if (state.mode === 'target') {
        const targetTimeSec = state.targetMin * 60 + state.targetSec;
        if (!(targetTimeSec > 0)) throw new Error('目標タイムを入力してください');
        const inv = findIntensityForTargetTime(input, targetTimeSec);
        result = inv.result;
        html += `
          <div class="section">
            <div class="section-title">逆算結果</div>
            <div class="card">
              <p>目標 ${fmtTime(targetTimeSec)} に対して必要なプル強度は
                <strong style="color:var(--color-primary)">全員 ${inv.effectivePullPct}%FTP</strong>
                （設定 ${state.pullPct}% × 係数 ${inv.intensityFactor.toFixed(2)}）です。</p>
              ${inv.converged
                ? '<p class="text-sm text-muted mt-8">この強度での予想タイムは下記の通りです。</p>'
                : '<p class="text-sm mt-8" style="color:var(--color-warn)">※ 目標に到達できる強度が見つかりませんでした（最も近かった結果を表示しています）。編成や機材を見直してください。</p>'}
            </div>
          </div>`;
      } else {
        result = simulateRace(input);
      }
      html += renderResults(result, course, bikeType);
      resultsEl.innerHTML = html;
    } catch (e) {
      resultsEl.innerHTML = `<div class="error-msg">計算できませんでした: ${esc(e.message ?? String(e))}</div>`;
    }
  }, 10);
}

function renderResults(result, course, bikeType) {
  const basisText = result.timingBasis === '4th'
    ? `WTRLルール: 4番目の完走者（${esc(result.timingRiderName ?? '')}）のタイムで計時`
    : `4名未満のため、最後の完走者（${esc(result.timingRiderName ?? '')}）のタイムで計時`;
  const startOrder = new Map(result.riders.map((r, i) => [r.id, i + 1]));

  return `
    <div class="section">
      <div class="section-title">結果 — ${esc(course.name)}</div>
      <div class="card result-summary-grid">
        <div>
          <div class="text-muted text-sm">予想タイム</div>
          <div class="big-time">${fmtTime(result.teamTimeSec)}</div>
        </div>
        <div>
          <div class="text-muted text-sm">平均速度</div>
          <div class="card-title" style="color:var(--color-primary)">${result.avgSpeedKph} km/h</div>
          <div class="text-muted text-sm">${course.distanceKm} km / 獲得標高 ${course.elevationM} m</div>
        </div>
        <div>
          <div class="text-muted text-sm">計時</div>
          <div class="text-sm">${basisText}</div>
          ${result.droppedCount > 0 ? `<div class="text-sm mt-8" style="color:var(--color-warn)">千切れ: ${result.droppedCount}名</div>` : ''}
        </div>
      </div>

      ${result.bottleneck ? `
      <div class="card" style="border-color:var(--color-primary)">
        <strong>ボトルネック: ${esc(result.bottleneck.name)}</strong>
        <span class="tag-bottleneck">平均 ${result.bottleneck.avgPctFtp}%FTP</span>
        <p class="text-sm text-muted mt-8">このライダーが最も高い負荷で走っています。プルを短くするか走順を入れ替えると全体が楽になります。</p>
      </div>` : ''}

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>走順</th><th>ライダー</th><th>プル回数</th><th>プル時間</th><th>平均W</th><th>W/kg</th><th>平均%FTP</th><th>状態</th></tr>
          </thead>
          <tbody>
            ${result.riders.map((r) => `
              <tr class="${result.bottleneck && r.id === result.bottleneck.id ? 'bottleneck' : ''}">
                <td>${startOrder.get(r.id)}</td>
                <td><strong>${esc(r.name)}</strong>${bikeType === 'tt' ? ' <span class="badge badge-info">TT</span>' : ''}</td>
                <td>${r.pulls} 回</td>
                <td>${fmtTime(r.pullTimeSec)}</td>
                <td>${r.avgW} W</td>
                <td>${r.avgWkg}</td>
                <td><span class="${r.avgPctFtp >= 110 ? 'pct-danger' : r.avgPctFtp >= 95 ? 'pct-warn' : ''}">${r.avgPctFtp}%</span></td>
                <td>${r.dropped ? `<span class="badge badge-danger">千切れ</span> <span class="text-sm">${r.dropped.distanceKm}km地点</span>` : '<span class="badge badge-success">完走（集団）</span>'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${result.droppedCount > 0 ? `<p class="text-muted text-sm mt-8">※ 千切れたライダーは、その地点から単独で「千切れる限界（${state.dropPct}%FTP）」のペースでゴールしたものとして個別タイムを計算し、4番手計時に含めています。</p>` : ''}

      <div class="section-title mt-16">ローテーション（先頭交代）${result.totalRotations > result.rotations.length ? ` — 全${result.totalRotations}回中 最初の${result.rotations.length}回` : ''}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>先頭ライダー</th><th>開始</th><th>プル時間</th><th>開始距離</th></tr></thead>
          <tbody>
            ${result.rotations.map((rot, i) => {
              // rot.riderIdx は計算に渡したライダー配列の添字（= result.riders の順序と一致）
              const name = result.riders[rot.riderIdx]?.name ?? `#${rot.riderIdx + 1}`;
              return `<tr><td>${i + 1}</td><td>${esc(name)}</td><td>${fmtTime(rot.startTimeSec)}</td><td>${Math.round(rot.durationSec)}秒</td><td>${(rot.startDistanceM / 1000).toFixed(1)} km</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p class="text-muted text-sm mt-8">※ 計算は Zwift 向け近似モデルです（ドラフト係数: 2番手×0.78 / 3番手×0.74 / 4番手以降×0.72。TTT では TT バイクでもドラフトが効く仕様で計算しています）。実走とは誤差があります。</p>
    </div>
  `;
}
