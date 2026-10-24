// =============================================
// ライダー管理画面
// 登録簿は localStorage に保存される（サーバーなし）。
// シミュレーターの編成はこの登録簿を参照する。
// =============================================
import { loadRiders, saveRiders, nextId } from '../store.js';

let riders = [];
let editingId = null;

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderRiders(container) {
  riders = loadRiders();
  editingId = null;
  render(container);
}

function render(container) {
  const editing = editingId != null ? riders.find((r) => r.id === editingId) : null;

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">ライダー管理</h2>
      <span class="text-muted text-sm">このブラウザ内に保存されます</span>
    </div>

    <div class="section">
      <div class="section-title">${editing ? 'ライダーを編集' : 'ライダーを追加'}</div>
      <div class="card">
        <form id="rider-form">
          <div class="form-row">
            <div class="form-group">
              <label>名前</label>
              <input type="text" id="r-name" value="${editing ? esc(editing.name) : ''}" required maxlength="40" />
            </div>
            <div class="form-group">
              <label>体重 (kg)</label>
              <input type="number" id="r-weight" value="${editing ? editing.weightKg : ''}" required min="30" max="200" step="0.1" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>身長 (cm)</label>
              <input type="number" id="r-height" value="${editing ? (editing.heightCm ?? '') : ''}" min="120" max="230" step="1" placeholder="175（空欄なら 175 として計算）" />
            </div>
            <div class="form-group">
              <label>FTP (W)</label>
              <input type="number" id="r-ftp" value="${editing ? editing.ftpW : ''}" required min="50" max="700" step="1" />
            </div>
          </div>
          <div class="flex gap-8 wrap">
            <button type="submit" class="btn btn-primary">${editing ? '更新する' : '追加する'}</button>
            ${editing ? '<button type="button" class="btn btn-secondary" id="r-cancel">キャンセル</button>' : ''}
          </div>
        </form>
      </div>
    </div>

    <div class="section">
      <div class="section-title">登録ライダー（${riders.length}名）</div>
      ${riders.length === 0 ? '<p class="text-muted">ライダーが登録されていません。</p>' : `
      <div class="table-wrap">
        <table>
          <thead><tr><th>名前</th><th>体重</th><th>身長</th><th>FTP</th><th>W/kg</th><th></th></tr></thead>
          <tbody>
            ${riders.map((r) => `
              <tr>
                <td><strong>${esc(r.name)}</strong>${r.notes ? `<div class="text-muted text-sm">${esc(r.notes)}</div>` : ''}</td>
                <td>${r.weightKg} kg</td>
                <td>${r.heightCm ? `${r.heightCm} cm` : '-'}</td>
                <td>${r.ftpW} W</td>
                <td>${(r.ftpW / r.weightKg).toFixed(2)}</td>
                <td style="white-space:nowrap">
                  <button class="btn btn-secondary btn-sm" data-edit="${r.id}">編集</button>
                  <button class="btn btn-danger btn-sm" data-del="${r.id}">削除</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
      <p class="text-muted text-sm mt-8">※ バイク種別（ロード/TT）はシミュレーターのフレーム選択で決まります（TTフレーム = 全員ドラフト無効）。</p>
    </div>
  `;

  container.querySelector('#rider-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      name: container.querySelector('#r-name').value.trim(),
      weightKg: Number(container.querySelector('#r-weight').value),
      heightCm: Number(container.querySelector('#r-height').value) || null,
      ftpW: Number(container.querySelector('#r-ftp').value),
    };
    if (!data.name || !(data.weightKg > 0) || !(data.ftpW > 0)) return;
    if (editing) {
      Object.assign(editing, data);
    } else {
      riders.push({ id: nextId(), bikeType: 'road', preferredPullSec: 30, notes: '', ...data });
    }
    saveRiders(riders);
    editingId = null;
    render(container);
  });

  container.querySelector('#r-cancel')?.addEventListener('click', () => { editingId = null; render(container); });
  container.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => { editingId = Number(btn.dataset.edit); render(container); });
  });
  container.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.del);
      const target = riders.find((r) => r.id === id);
      if (!window.confirm(`「${target?.name ?? ''}」を削除しますか？`)) return;
      riders = riders.filter((r) => r.id !== id);
      saveRiders(riders);
      if (editingId === id) editingId = null;
      render(container);
    });
  });
}
