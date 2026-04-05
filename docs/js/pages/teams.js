// =============================================
// チーム管理画面
// - ライダー一覧・登録・編集・削除
// - メンバー管理
// =============================================
import {
  fetchRiders, createRider, updateRider, deleteRider,
} from '../api.js';

let _container = null;
let _allRiders = [];

export async function renderTeams(container) {
  _container = container;
  await refresh();
}

async function refresh() {
  _allRiders = await fetchRiders();
  render();
}

function render() {
  _container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">メンバー</h2>
    </div>

    <!-- ライダー登録 -->
    <div class="section">
      <div class="section-title">新規ライダー登録</div>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>名前 *</label>
            <input type="text" id="rider-name" placeholder="例: Alice" />
          </div>
          <div class="form-group">
            <label>体重 (kg) *</label>
            <input type="number" id="rider-weight" placeholder="例: 65" step="0.1" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>FTP (W) *</label>
            <input type="number" id="rider-ftp" placeholder="例: 280" />
          </div>
          <div class="form-group">
            <label>身長 (cm)</label>
            <input type="number" id="rider-height" placeholder="例: 170" />
          </div>
        </div>
        <div class="form-group">
          <label>メモ</label>
          <input type="text" id="rider-notes" placeholder="任意メモ" />
        </div>
        <div id="rider-error" class="error-msg" style="display:none"></div>
        <button class="btn btn-primary" id="rider-submit">ライダーを登録</button>
      </div>
    </div>

    <!-- ライダー一覧 -->
    <div class="section">
      <div class="section-title">ライダー一覧 <span class="badge badge-info">${_allRiders.length}人</span></div>
      ${_allRiders.length === 0
        ? '<p class="text-muted">ライダーがいません。上のフォームから登録してください。</p>'
        : `<div class="table-wrap"><table>
            <thead><tr>
              <th>名前</th><th>メモ</th><th></th>
            </tr></thead>
            <tbody>
              ${_allRiders.map((r) => `
                <tr>
                  <td><strong>${esc(r.name)}</strong></td>
                  <td class="text-sm text-muted">${r.notes ? esc(r.notes) : ''}</td>
                  <td style="white-space:nowrap">
                    <button class="btn btn-secondary btn-sm" data-edit-id="${r.id}">編集</button>
                    <button class="btn btn-danger btn-sm" style="margin-left:4px" data-delete-id="${r.id}">削除</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>`
      }
    </div>

    <!-- ライダー編集モーダル -->
    <div id="rider-edit-modal" class="modal-overlay" style="display:none">
      <div class="modal">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div class="modal-title">ライダー情報を編集</div>
          <button class="modal-close" id="edit-modal-close">✕</button>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>名前 *</label>
            <input type="text" id="edit-rider-name" />
          </div>
          <div class="form-group">
            <label>体重 (kg) *</label>
            <input type="number" id="edit-rider-weight" step="0.1" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>FTP (W) *</label>
            <input type="number" id="edit-rider-ftp" />
          </div>
          <div class="form-group">
            <label>身長 (cm)</label>
            <input type="number" id="edit-rider-height" />
          </div>
        </div>
        <div class="form-group">
          <label>メモ</label>
          <input type="text" id="edit-rider-notes" />
        </div>
        <div id="edit-rider-error" class="error-msg" style="display:none"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <button class="btn btn-secondary" id="edit-modal-cancel">キャンセル</button>
          <button class="btn btn-primary" id="edit-rider-submit">保存</button>
        </div>
      </div>
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  // ---- ライダー登録 ----
  document.getElementById('rider-submit').addEventListener('click', async () => {
    const errEl = document.getElementById('rider-error');
    errEl.style.display = 'none';
    const name   = document.getElementById('rider-name').value.trim();
    const weight = parseFloat(document.getElementById('rider-weight').value);
    const ftp    = parseInt(document.getElementById('rider-ftp').value);
    const height = document.getElementById('rider-height').value;
    const notes  = document.getElementById('rider-notes').value.trim();

    if (!name || isNaN(weight) || isNaN(ftp)) {
      errEl.textContent = '名前・体重・FTPは必須です。'; errEl.style.display = 'block'; return;
    }
    try {
      await createRider({ name, weight_kg: weight, ftp_w: ftp, height_cm: height ? parseInt(height) : undefined, notes: notes || undefined });
      ['rider-name','rider-weight','rider-ftp','rider-height','rider-notes'].forEach((id) => { document.getElementById(id).value = ''; });
      await refresh();
    } catch (e) {
      errEl.textContent = e.message ?? 'エラーが発生しました'; errEl.style.display = 'block';
    }
  });

  // ---- ライダー一覧の編集・削除（イベント委譲で特殊文字問題を回避） ----
  _container.addEventListener('click', async (e) => {
    const editBtn   = e.target.closest('[data-edit-id]');
    const deleteBtn = e.target.closest('[data-delete-id]');

    if (editBtn) {
      const riderId = parseInt(editBtn.dataset.editId);
      openEditModal(riderId);
    }

    if (deleteBtn) {
      const riderId = parseInt(deleteBtn.dataset.deleteId);
      const rider   = _allRiders.find((r) => r.id === riderId);
      if (!rider) return;
      if (!confirm(`「${rider.name}」を削除しますか？チームやラインナップからも除外されます。`)) return;
      try {
        await deleteRider(riderId);
        await refresh();
      } catch (e) {
        alert(e.message ?? 'エラーが発生しました');
      }
    }
  });

  // ---- 編集モーダル ----
  function openEditModal(riderId) {
    const rider = _allRiders.find((r) => r.id === riderId);
    if (!rider) return;

    document.getElementById('edit-rider-name').value   = rider.name;
    document.getElementById('edit-rider-weight').value = rider.weight_kg;
    document.getElementById('edit-rider-ftp').value    = rider.ftp_w;
    document.getElementById('edit-rider-height').value = rider.height_cm ?? '';
    document.getElementById('edit-rider-notes').value  = rider.notes ?? '';
    document.getElementById('edit-rider-error').style.display = 'none';
    document.getElementById('rider-edit-modal').style.display = 'flex';

    // 保存ボタンのハンドラを毎回付け替え（前回のライダーIDが残らないよう clone）
    const submitBtn = document.getElementById('edit-rider-submit');
    const newBtn = submitBtn.cloneNode(true);
    submitBtn.replaceWith(newBtn);

    newBtn.addEventListener('click', async () => {
      const errEl  = document.getElementById('edit-rider-error');
      errEl.style.display = 'none';
      const name   = document.getElementById('edit-rider-name').value.trim();
      const weight = parseFloat(document.getElementById('edit-rider-weight').value);
      const ftp    = parseInt(document.getElementById('edit-rider-ftp').value);
      const height = document.getElementById('edit-rider-height').value;
      const notes  = document.getElementById('edit-rider-notes').value.trim();

      if (!name || isNaN(weight) || isNaN(ftp)) {
        errEl.textContent = '名前・体重・FTPは必須です。'; errEl.style.display = 'block'; return;
      }
      try {
        await updateRider(rider.id, {
          name,
          weight_kg:  weight,
          ftp_w:      ftp,
          height_cm:  height  ? parseInt(height) : null,
          notes:      notes   || null,
        });
        closeEditModal();
        await refresh();
      } catch (e) {
        errEl.textContent = e.message ?? 'エラーが発生しました'; errEl.style.display = 'block';
      }
    });
  }

  function closeEditModal() {
    document.getElementById('rider-edit-modal').style.display = 'none';
  }

  document.getElementById('edit-modal-close').addEventListener('click', closeEditModal);
  document.getElementById('edit-modal-cancel').addEventListener('click', closeEditModal);
  document.getElementById('rider-edit-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('rider-edit-modal')) closeEditModal();
  });

}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
