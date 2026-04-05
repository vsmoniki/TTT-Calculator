// =============================================
// ラインナップ作成・管理画面
// - ラインナップ一覧 / 新規作成
// - メンバー選択（チームロスターからワンタップ）
// - メンバーカードで機材インライン編集
// =============================================
import {
  fetchTeams, fetchRoutes, fetchFrames, fetchWheels, fetchLineups,
  createLineup, fetchLineup, updateLineup,
  addLineupMember, updateLineupMember, removeLineupMember, swapLineupMembers,
  fetchSettings,
} from '../api.js';

let state = {
  teams: [], routes: [], frames: [], wheels: [], lineups: [],
  lineupId: null,
  lineup: null,
  saving: new Set(),
  settings: {
    tri_frame_name: 'CADEX tri',
    tri_wheel_name: 'DT Swiss ARC 1100 DICUT 85/Disc',
    tron_frame_name: 'Zwift Concept Z1 (Tron)',
    default_frame_name: 'CADEX tri',
    default_wheel_name: 'DT Swiss ARC 1100 DICUT 85/Disc',
    equipment_preset: 'tri_dtswiss',
    equipment_status_tri_dtswiss: 'enabled',
    equipment_status_tron: 'enabled',
  },
};
const TRON_FRAME_CANDIDATES = ['Zwift Concept Z1 (Tron)', 'Tron'];

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
  return findDefaultGearId(frames, [state.settings.tron_frame_name, ...TRON_FRAME_CANDIDATES].filter(Boolean));
}

function defaultFrameCandidates() {
  return [state.settings.tri_frame_name, state.settings.default_frame_name, 'Cadex Tri', 'CADEX tri', 'Canyon Aeroad 2021'].filter(Boolean);
}

function defaultWheelCandidates() {
  return [state.settings.tri_wheel_name, state.settings.default_wheel_name, 'DTSwiss ARC 1100 DICUT 85/Disc', 'DT Swiss ARC 1100 DICUT 85/Disc', 'DT Swiss ARC 62 DICUT'].filter(Boolean);
}

function isTriEnabled() {
  return state.settings.equipment_status_tri_dtswiss !== 'disabled';
}

function isTronEnabled() {
  return state.settings.equipment_status_tron !== 'disabled';
}

function getSelectableEquipments() {
  const defaultFrameId = findDefaultGearId(state.frames, defaultFrameCandidates());
  const defaultWheelId = findDefaultGearId(state.wheels, defaultWheelCandidates());
  const tronFrameId = findTronFrameId(state.frames);
  const equipments = [];

  if (isTriEnabled() && defaultFrameId && defaultWheelId) {
    const triFrame = state.frames.find((f) => f.id === defaultFrameId);
    const triWheel = state.wheels.find((w) => w.id === defaultWheelId);
    equipments.push({
      key: 'cadex_dt85',
      label: `${triFrame?.name ?? 'Tri frame'} × ${triWheel?.name ?? 'Tri wheel'}`,
      frame_id: defaultFrameId,
      wheel_id: defaultWheelId,
    });
  }
  if (isTronEnabled() && tronFrameId) {
    const tronFrame = state.frames.find((f) => f.id === tronFrameId);
    equipments.push({
      key: 'tron',
      label: tronFrame?.name ?? 'Tron',
      frame_id: tronFrameId,
      wheel_id: null,
    });
  }
  return equipments;
}

export async function renderLineups(container) {
  const [teams, routes, frames, wheels, lineups, settings] = await Promise.all([
    fetchTeams(), fetchRoutes(), fetchFrames(), fetchWheels(), fetchLineups(), fetchSettings(),
  ]);
  state = { ...state, teams, routes, frames, wheels, lineups, settings: { ...state.settings, ...settings }, saving: new Set() };

  const hash = location.hash;
  const match = hash.match(/^#\/lineups\/(\d+)$/);
  if (match) {
    state.lineupId = parseInt(match[1]);
    await renderDetail(container);
    return;
  }

  renderList(container);
}

function renderList(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">ラインナップ</h2>
    </div>

    <div class="section">
      <div class="section-title">新規作成</div>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>チーム *</label>
            <select id="lu-team">
              <option value="">— 選択 —</option>
              ${state.teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>ラインナップ名 *</label>
            <input type="text" id="lu-name" placeholder="例: Watopia平坦TT" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>コース</label>
            <select id="lu-route">
              <option value="">— 選択 —</option>
              ${state.routes.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>目標速度 (kph)</label>
            <input type="number" id="lu-speed" placeholder="例: 45" step="0.5" />
          </div>
        </div>
        <div id="lu-error" class="error-msg" style="display:none"></div>
        <button class="btn btn-primary" id="lu-submit">ラインナップを作成</button>
      </div>
    </div>

    <div class="section">
      <div class="section-title">
        既存のラインナップ <span class="badge badge-info">${state.lineups.length}件</span>
      </div>
      ${state.lineups.length === 0
        ? '<p class="text-muted">ラインナップがありません。</p>'
        : `<div class="table-wrap"><table>
            <thead><tr>
              <th>名前</th><th>チーム</th><th>コース</th><th>目標速度</th><th></th>
            </tr></thead>
            <tbody>
              ${state.lineups.map((lu) => `
                <tr style="cursor:pointer" onclick="location.hash='#/lineups/${lu.id}'">
                  <td><strong>${esc(lu.name)}</strong></td>
                  <td>${esc(lu.team_name)}</td>
                  <td class="text-sm">${lu.route_name ? esc(lu.route_name) : '<span class="text-muted">未設定</span>'}</td>
                  <td class="text-sm">${lu.target_speed_kph ? lu.target_speed_kph + ' kph' : '<span class="text-muted">未設定</span>'}</td>
                  <td><button class="btn btn-secondary btn-sm">開く →</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>`
      }
    </div>
  `;

  document.getElementById('lu-submit').addEventListener('click', async () => {
    const errEl = document.getElementById('lu-error');
    errEl.style.display = 'none';
    const teamId  = parseInt(document.getElementById('lu-team').value);
    const name    = document.getElementById('lu-name').value.trim();
    const routeId = document.getElementById('lu-route').value;
    const speed   = document.getElementById('lu-speed').value;
    if (!teamId || !name) {
      errEl.textContent = 'チームとラインナップ名は必須です。'; errEl.style.display = 'block'; return;
    }
    try {
      const lineup = await createLineup({
        team_id: teamId, name,
        route_id:         routeId ? parseInt(routeId) : undefined,
        target_speed_kph: speed   ? parseFloat(speed)  : undefined,
      });
      location.hash = `#/lineups/${lineup.id}`;
    } catch (e) {
      errEl.textContent = e.message ?? 'エラーが発生しました'; errEl.style.display = 'block';
    }
  });
}

async function renderDetail(container) {
  try {
    state.lineup = await fetchLineup(state.lineupId);
  } catch {
    container.innerHTML = `
      <div class="error-msg">ラインナップが見つかりません (ID: ${state.lineupId})</div>
      <button class="btn btn-secondary mt-12" onclick="location.hash='#/lineups'">一覧に戻る</button>`;
    return;
  }

  const lu   = state.lineup;
  const team  = state.teams.find((t) => t.id === lu.team_id);
  const memberCount = lu.members?.length ?? 0;
  const teamRiders = team?.members ?? [];
  const lineupRiderIds = new Set((lu.members ?? []).map((m) => m.rider_id));

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">${esc(lu.name)}</h2>
      <button class="btn btn-secondary btn-sm" onclick="location.hash='#/lineups'">← 一覧へ</button>
    </div>

    <div class="card mb-8">
      <div class="form-row">
        <div class="form-group">
          <label>コース</label>
          <select id="lu-upd-route">
            <option value="">— 未設定 —</option>
            ${state.routes.map((r) => `<option value="${r.id}" ${r.id === lu.route_id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>目標速度 (kph)</label>
          <input type="number" id="lu-upd-speed" value="${lu.target_speed_kph ?? ''}" step="0.5" placeholder="例: 45" />
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" id="lu-upd-submit">設定を保存</button>
        <span class="text-muted text-sm">
          チーム: <strong>${team ? esc(team.name) : lu.team_id}</strong> &nbsp;|&nbsp;
          メンバー: <span class="${memberCount >= 8 ? 'badge badge-danger' : 'badge badge-info'}">${memberCount}/8</span>
        </span>
      </div>
      <div id="lu-upd-error" class="error-msg mt-8" style="display:none"></div>
    </div>

    <div class="section">
      <div class="section-title">メンバー選択</div>
      <div class="card">
        ${teamRiders.length === 0
          ? '<p class="text-muted text-sm">チームにメンバーがいません。チーム管理画面でメンバーを追加してください。</p>'
          : `<p class="text-muted text-sm mb-8">クリックしてラインナップに追加・削除できます</p>
             <div style="display:flex;flex-wrap:wrap;gap:8px;">
               ${teamRiders.map((r) => {
                 const inLineup = lineupRiderIds.has(r.rider_id);
                 const luMember = lu.members?.find((m) => m.rider_id === r.rider_id);
                 return `
                   <button
                     class="roster-chip ${inLineup ? 'roster-chip--active' : ''}"
                     onclick="toggleRosterMember(${r.rider_id}, ${inLineup ? luMember?.id ?? 'null' : 'null'})"
                     ${memberCount >= 8 && !inLineup ? 'disabled' : ''}
                   >
                     ${inLineup ? `<span class="chip-order">${luMember?.order_index}</span>` : ''}
                     <span>${esc(r.name)}</span>
                     <span class="chip-meta">${r.weight_kg}kg/${r.ftp_w}W</span>
                   </button>
                 `;
               }).join('')}
             </div>
             ${memberCount >= 8 ? '<p class="text-muted text-sm mt-8">上限（8人）に達しています。</p>' : ''}`
        }
      </div>
    </div>

    <div class="section">
      <div class="section-title">ラインナップ構成</div>
      <div id="member-cards">
        ${(lu.members ?? []).map((m, idx, arr) => renderMemberCard(m, idx, arr.length)).join('') ||
          '<p class="text-muted">メンバーが選択されていません。</p>'}
      </div>
    </div>
  `;

  bindDetailEvents(container);
}

function renderMemberCard(m, idx, total) {
  const selectableEquipments = getSelectableEquipments();
  const selectedEquipment = selectableEquipments.find((eq) => eq.frame_id === m.frame_id && eq.wheel_id === (m.wheel_id ?? null));
  return `
    <div class="member-card" id="mcard-${m.id}">
      <div class="member-card-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="order-badge">${m.order_index}</div>
          <div>
            <div class="member-card-name">${esc(m.rider_name)}</div>
            <div class="member-card-meta">${m.weight_kg}kg &nbsp;/&nbsp; FTP ${m.ftp_w}W</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-icon" onclick="moveMember(${m.id}, -1)" ${idx === 0 ? 'disabled' : ''} title="上へ">↑</button>
          <button class="btn btn-icon" onclick="moveMember(${m.id}, 1)" ${idx === total - 1 ? 'disabled' : ''} title="下へ">↓</button>
          <button class="btn btn-danger btn-sm" onclick="removeMember(${m.id})">外す</button>
        </div>
      </div>
      <div class="member-card-gear">
        <div class="form-group" style="margin:0">
          <label>機材</label>
          <select id="equipment-sel-${m.id}" onchange="saveGear(${m.id})">
            <option value="">— なし —</option>
            ${selectableEquipments.map((eq) => `<option value="${eq.key}" ${selectedEquipment?.key === eq.key ? 'selected' : ''}>${esc(eq.label)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="gear-err-${m.id}" class="error-msg mt-4" style="display:none"></div>
    </div>
  `;
}

function bindDetailEvents(container) {
  document.getElementById('lu-upd-submit').addEventListener('click', async () => {
    const errEl = document.getElementById('lu-upd-error');
    errEl.style.display = 'none';
    const routeId = document.getElementById('lu-upd-route').value;
    const speed   = document.getElementById('lu-upd-speed').value;
    try {
      await updateLineup(state.lineupId, {
        route_id:         routeId ? parseInt(routeId) : undefined,
        target_speed_kph: speed   ? parseFloat(speed)  : undefined,
      });
      await renderDetail(container);
    } catch (e) {
      errEl.textContent = e.message ?? 'エラーが発生しました'; errEl.style.display = 'block';
    }
  });

  window.toggleRosterMember = async (riderId, existingMemberId) => {
    if (existingMemberId) {
      if (!confirm('このメンバーをラインナップから外しますか？')) return;
      try {
        await removeLineupMember(state.lineupId, existingMemberId);
        await renderDetail(container);
      } catch (e) { alert(e.message ?? 'エラーが発生しました'); }
    } else {
      const usedOrders = new Set((state.lineup.members ?? []).map((m) => m.order_index));
      const nextOrder  = [1,2,3,4,5,6,7,8].find((n) => !usedOrders.has(n)) ?? 1;
      const defaultFrameId = findDefaultGearId(state.frames, defaultFrameCandidates());
      const defaultWheelId = findDefaultGearId(state.wheels, defaultWheelCandidates());
      const tronFrameId = findTronFrameId(state.frames);
      const initialFrameId = isTriEnabled() ? defaultFrameId : (isTronEnabled() ? tronFrameId : null);
      const initialWheelId = isTriEnabled() ? defaultWheelId : null;
      try {
        await addLineupMember(state.lineupId, {
          rider_id: riderId,
          order_index: nextOrder,
          frame_id: initialFrameId,
          wheel_id: initialWheelId,
        });
        await renderDetail(container);
      } catch (e) { alert(e.message ?? 'エラーが発生しました'); }
    }
  };

  window.saveGear = async (memberId) => {
    const equipmentVal = document.getElementById(`equipment-sel-${memberId}`)?.value;
    const errEl = document.getElementById(`gear-err-${memberId}`);
    if (errEl) errEl.style.display = 'none';

    const header = document.querySelector(`#mcard-${memberId} .member-card-header`);
    const existing = header?.querySelector('.saving-indicator');
    if (!existing && header) {
      const span = document.createElement('span');
      span.className = 'text-muted text-sm saving-indicator';
      span.textContent = '保存中…';
      header.querySelector('div:last-child').prepend(span);
    }

    try {
      const selectedEquipment = getSelectableEquipments().find((eq) => eq.key === equipmentVal);
      const frameId = selectedEquipment?.frame_id ?? null;
      const wheelId = selectedEquipment?.wheel_id ?? null;
      await updateLineupMember(state.lineupId, memberId, {
        frame_id: frameId,
        wheel_id: wheelId,
      });
      const ind = header?.querySelector('.saving-indicator');
      if (ind) { ind.textContent = '✓ 保存'; setTimeout(() => ind.remove(), 1500); }
      await renderDetail(container);
    } catch (e) {
      if (errEl) { errEl.textContent = e.message ?? '保存エラー'; errEl.style.display = 'block'; }
    }
  };

  window.moveMember = async (memberId, direction) => {
    const members = [...(state.lineup.members ?? [])].sort((a, b) => a.order_index - b.order_index);
    const idx = members.findIndex((m) => m.id === memberId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= members.length) return;
    const a = members[idx];
    const b = members[swapIdx];
    try {
      await swapLineupMembers(state.lineupId, a.id, b.id);
      await renderDetail(container);
    } catch (e) { alert(e.message ?? 'エラーが発生しました'); }
  };

  window.removeMember = async (memberId) => {
    if (!confirm('このメンバーをラインナップから外しますか?')) return;
    try {
      await removeLineupMember(state.lineupId, memberId);
      await renderDetail(container);
    } catch (e) { alert(e.message ?? 'エラーが発生しました'); }
  };
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
