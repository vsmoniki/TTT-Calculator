// =============================================
// ラインナップ作成・管理画面
// - ラインナップ一覧 / 作成
// - メンバー追加（チームメンバーからドロップダウン選択）
// - メンバー編集（機材・順番）
// =============================================
import {
  fetchTeams, fetchRoutes, fetchFrames, fetchWheels, fetchLineups,
  createLineup, fetchLineup, updateLineup,
  addLineupMember, updateLineupMember, removeLineupMember,
} from '../api.js';

let state = {
  teams: [], routes: [], frames: [], wheels: [], lineups: [],
  lineupId: null,
  lineup: null,
};

export async function renderLineups(container) {
  const [teams, routes, frames, wheels, lineups] = await Promise.all([
    fetchTeams(), fetchRoutes(), fetchFrames(), fetchWheels(), fetchLineups(),
  ]);
  state = { ...state, teams, routes, frames, wheels, lineups };

  const hash = location.hash;
  const match = hash.match(/^#\/lineups\/(\d+)$/);
  if (match) {
    state.lineupId = parseInt(match[1]);
    await renderLineupDetail(container);
    return;
  }

  renderLineupForm(container);
}

// ---- ラインナップ作成フォーム ----
function renderLineupForm(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">ラインナップ</h2>
    </div>

    <!-- 新規作成フォーム -->
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
        <div class="form-group">
          <label>メモ</label>
          <input type="text" id="lu-notes" placeholder="任意メモ" />
        </div>
        <div id="lu-error" class="error-msg" style="display:none"></div>
        <button class="btn btn-primary" id="lu-submit">ラインナップを作成</button>
      </div>
    </div>

    <!-- 既存ラインナップ一覧 -->
    <div class="section">
      <div class="section-title">既存のラインナップ <span class="badge badge-info">${state.lineups.length}件</span></div>
      ${state.lineups.length === 0
        ? '<p class="text-muted">ラインナップがありません。上のフォームから作成してください。</p>'
        : `<div class="table-wrap"><table>
            <thead><tr>
              <th>名前</th><th>チーム</th><th>コース</th><th>目標速度</th><th></th>
            </tr></thead>
            <tbody>
              ${state.lineups.map((lu) => `
                <tr style="cursor:pointer;" onclick="location.hash='#/lineups/${lu.id}'">
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
    const notes   = document.getElementById('lu-notes').value.trim();

    if (!teamId || !name) {
      errEl.textContent = 'チームとラインナップ名は必須です。'; errEl.style.display = 'block'; return;
    }

    try {
      const lineup = await createLineup({
        team_id: teamId,
        name,
        route_id:         routeId ? parseInt(routeId) : undefined,
        target_speed_kph: speed   ? parseFloat(speed)  : undefined,
        notes: notes || undefined,
      });
      state.lineupId = lineup.id;
      location.hash = `#/lineups/${lineup.id}`;
    } catch (e) {
      errEl.textContent = e.message ?? 'エラーが発生しました'; errEl.style.display = 'block';
    }
  });
}

// ---- ラインナップ詳細 ----
async function renderLineupDetail(container) {
  try {
    state.lineup = await fetchLineup(state.lineupId);
  } catch {
    container.innerHTML = `<div class="error-msg">ラインナップが見つかりません (ID: ${state.lineupId})</div>
      <button class="btn btn-secondary mt-12" onclick="location.hash='#/lineups'">一覧に戻る</button>`;
    return;
  }

  const lu = state.lineup;
  const route  = state.routes.find((r) => r.id === lu.route_id);
  const team   = state.teams.find((t) => t.id === lu.team_id);
  const memberCount = lu.members?.length ?? 0;

  // チームメンバーのうち、ラインナップにまだいないライダー
  const lineupRiderIds = new Set((lu.members ?? []).map((m) => m.rider_id));
  const teamMembers = (team?.members ?? []).filter((m) => !lineupRiderIds.has(m.rider_id));

  // 使用済み order_index
  const usedOrders = new Set((lu.members ?? []).map((m) => m.order_index));
  const nextOrder  = [1,2,3,4,5,6,7,8].find((n) => !usedOrders.has(n)) ?? 1;

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">${esc(lu.name)}</h2>
      <button class="btn btn-secondary btn-sm" onclick="location.hash='#/lineups'">← 一覧へ</button>
    </div>

    <!-- ラインナップ情報 -->
    <div class="card mb-8">
      <div class="card-meta">
        チーム: <strong>${team ? esc(team.name) : lu.team_id}</strong> &nbsp;|&nbsp;
        コース: ${route ? esc(route.name) : '<span class="text-muted">未設定</span>'} &nbsp;|&nbsp;
        目標速度: ${lu.target_speed_kph ? lu.target_speed_kph + ' kph' : '<span class="text-muted">未設定</span>'} &nbsp;|&nbsp;
        メンバー: <span class="${memberCount >= 8 ? 'badge badge-danger' : 'badge badge-info'}">${memberCount}/8</span>
      </div>
      ${lu.notes ? `<p class="text-muted text-sm mt-8">${esc(lu.notes)}</p>` : ''}
    </div>

    <!-- 設定更新 -->
    <div class="section">
      <div class="section-title">設定更新</div>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>コース変更</label>
            <select id="lu-upd-route">
              <option value="">— 変更なし —</option>
              ${state.routes.map((r) => `<option value="${r.id}" ${r.id === lu.route_id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>目標速度 (kph)</label>
            <input type="number" id="lu-upd-speed" value="${lu.target_speed_kph ?? ''}" step="0.5" placeholder="例: 45" />
          </div>
        </div>
        <div id="lu-upd-error" class="error-msg" style="display:none"></div>
        <button class="btn btn-secondary btn-sm" id="lu-upd-submit">更新</button>
      </div>
    </div>

    <!-- メンバー一覧 -->
    <div class="section">
      <div class="section-title">ラインナップメンバー</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>順番</th><th>ライダー</th><th>体重 / FTP</th><th>フレーム</th><th>ホイール</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${(lu.members ?? []).map((m) => `
              <tr id="member-row-${m.id}">
                <td><div class="order-badge" style="width:28px;height:28px;border-radius:50%;background:var(--color-primary);color:#000;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;">${m.order_index}</div></td>
                <td><strong>${esc(m.rider_name)}</strong></td>
                <td class="text-muted text-sm">${m.weight_kg}kg / ${m.ftp_w}W</td>
                <td class="text-sm">${m.frame_name ? esc(m.frame_name) : '<span class="text-muted">未設定</span>'}</td>
                <td class="text-sm">${m.wheel_name ? esc(m.wheel_name) : '<span class="text-muted">未設定</span>'}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="editMember(${m.id})">編集</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteMember(${m.id})">削除</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6" class="text-muted">メンバーなし</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- メンバー追加フォーム -->
    ${memberCount < 8 ? `
    <div class="section">
      <div class="section-title">メンバー追加</div>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>ライダー *</label>
            <select id="add-rider-id">
              <option value="">— 選択 —</option>
              ${teamMembers.map((m) => `<option value="${m.rider_id}">${esc(m.name)} (${m.weight_kg}kg / ${m.ftp_w}W)</option>`).join('')}
            </select>
            ${teamMembers.length === 0 ? '<p class="text-muted text-sm mt-4">チームの全メンバーがすでに追加されています。</p>' : ''}
          </div>
          <div class="form-group">
            <label>順番 (1〜8) *</label>
            <select id="add-order">
              ${[1,2,3,4,5,6,7,8].filter((n) => !usedOrders.has(n)).map((n) => `<option value="${n}" ${n === nextOrder ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>フレーム</label>
            <select id="add-frame">
              <option value="">— 選択 —</option>
              ${state.frames.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>ホイール</label>
            <select id="add-wheel">
              <option value="">— 選択 —</option>
              ${state.wheels.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="add-member-error" class="error-msg" style="display:none"></div>
        <button class="btn btn-primary" id="add-member-submit">メンバーを追加</button>
      </div>
    </div>
    ` : `<div class="badge badge-danger mb-8">メンバー上限（8人）に達しています</div>`}

    <!-- シミュレーションへ -->
    <div class="mt-16">
      <button class="btn btn-primary" onclick="location.hash='#/simulate'">シミュレーション画面へ →</button>
    </div>

    <div id="edit-modal"></div>
  `;

  // 設定更新
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
      await renderLineupDetail(container);
    } catch (e) {
      errEl.textContent = e.message ?? 'エラーが発生しました'; errEl.style.display = 'block';
    }
  });

  // メンバー追加
  if (memberCount < 8) {
    document.getElementById('add-member-submit').addEventListener('click', async () => {
      const errEl = document.getElementById('add-member-error');
      errEl.style.display = 'none';
      const riderId    = parseInt(document.getElementById('add-rider-id').value);
      const orderIndex = parseInt(document.getElementById('add-order').value);
      const frameId    = document.getElementById('add-frame').value;
      const wheelId    = document.getElementById('add-wheel').value;

      if (!riderId || !orderIndex) {
        errEl.textContent = 'ライダーと順番は必須です。'; errEl.style.display = 'block'; return;
      }
      try {
        await addLineupMember(state.lineupId, {
          rider_id: riderId,
          order_index: orderIndex,
          frame_id: frameId ? parseInt(frameId) : undefined,
          wheel_id: wheelId ? parseInt(wheelId) : undefined,
        });
        await renderLineupDetail(container);
      } catch (e) {
        errEl.textContent = e.message ?? 'エラーが発生しました'; errEl.style.display = 'block';
      }
    });
  }

  // メンバー削除
  window.deleteMember = async (memberId) => {
    if (!confirm('このメンバーを削除しますか?')) return;
    try {
      await removeLineupMember(state.lineupId, memberId);
      await renderLineupDetail(container);
    } catch (e) {
      alert(e.message ?? 'エラーが発生しました');
    }
  };

  // メンバー編集
  window.editMember = (memberId) => {
    const member = lu.members.find((m) => m.id === memberId);
    if (!member) return;
    openEditModal(container, member, usedOrders);
  };
}

function openEditModal(container, member, usedOrders) {
  const modal = document.getElementById('edit-modal');
  // 編集中のメンバー自身の order は選択肢に含める
  const availableOrders = [1,2,3,4,5,6,7,8].filter((n) => !usedOrders.has(n) || n === member.order_index);

  modal.innerHTML = `
    <div class="modal-overlay" id="edit-overlay">
      <div class="modal">
        <button class="modal-close" onclick="closeEditModal()">✕</button>
        <div class="modal-title">${esc(member.rider_name)} の設定変更</div>
        <div class="form-group">
          <label>順番 (1〜8)</label>
          <select id="edit-order">
            ${availableOrders.map((n) => `<option value="${n}" ${n === member.order_index ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>フレーム</label>
          <select id="edit-frame">
            <option value="">— なし —</option>
            ${state.frames.map((f) => `<option value="${f.id}" ${f.id === member.frame_id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>ホイール</label>
          <select id="edit-wheel">
            <option value="">— なし —</option>
            ${state.wheels.map((w) => `<option value="${w.id}" ${w.id === member.wheel_id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
          </select>
        </div>
        <div id="edit-error" class="error-msg" style="display:none"></div>
        <button class="btn btn-primary mt-12" id="edit-save">保存</button>
      </div>
    </div>
  `;

  document.getElementById('edit-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeEditModal();
  });

  window.closeEditModal = () => { modal.innerHTML = ''; };

  document.getElementById('edit-save').addEventListener('click', async () => {
    const errEl = document.getElementById('edit-error');
    errEl.style.display = 'none';
    const orderIndex = parseInt(document.getElementById('edit-order').value);
    const frameId    = document.getElementById('edit-frame').value;
    const wheelId    = document.getElementById('edit-wheel').value;

    try {
      await updateLineupMember(state.lineupId, member.id, {
        order_index: orderIndex || undefined,
        frame_id:   frameId ? parseInt(frameId) : null,
        wheel_id:   wheelId ? parseInt(wheelId) : null,
      });
      closeEditModal();
      await renderLineupDetail(container);
    } catch (e) {
      errEl.textContent = e.message ?? 'エラーが発生しました'; errEl.style.display = 'block';
    }
  });
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
