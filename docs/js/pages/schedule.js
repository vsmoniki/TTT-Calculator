const STORAGE_KEY = 'ttt_manual_schedule_v1';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nowIso() {
  return new Date().toISOString();
}

function formatDateTime(iso) {
  if (!iso) return '---';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(dt);
}

function toDateLabel(value) {
  if (!value) return '-';
  return value;
}

function normalizeItem(raw) {
  return {
    id: Number(raw.id),
    date: String(raw.date ?? '').trim(),
    title: String(raw.title ?? '').trim(),
    notes: String(raw.notes ?? '').trim(),
    created_at: raw.created_at || nowIso(),
  };
}

function loadManualSchedule() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeItem)
      .filter((item) => item.id > 0 && item.title);
  } catch (_err) {
    return [];
  }
}

function saveManualSchedule(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function renderRows(list) {
  if (list.length === 0) {
    return '<p class="text-muted">スケジュールはまだありません。上のフォームから追加してください。</p>';
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>イベント</th>
            <th>メモ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${list.map((item) => `
            <tr>
              <td>${escapeHtml(toDateLabel(item.date))}</td>
              <td>${escapeHtml(item.title)}</td>
              <td class="text-sm text-muted">${escapeHtml(item.notes || '')}</td>
              <td>
                <button class="btn btn-danger btn-sm" type="button" data-delete-id="${item.id}">削除</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export async function renderSchedule(container) {
  const list = loadManualSchedule();
  let updatedAt = nowIso();

  const render = () => {
    const sorted = [...list].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    container.innerHTML = `
      <section class="page-header">
        <h2 class="page-title">WTRL TTT スケジュール（手動管理）</h2>
      </section>

      <section class="card">
        <p class="text-sm text-muted">自動取得は無効化しました。必要なイベントを手動で登録してください。</p>
        <p id="schedule-updated" class="text-sm text-muted mt-8">最終更新: ${escapeHtml(formatDateTime(updatedAt))}</p>

        <div class="form-row mt-12">
          <div class="form-group">
            <label for="schedule-date">日付</label>
            <input id="schedule-date" type="date" />
          </div>
          <div class="form-group">
            <label for="schedule-title">イベント名 *</label>
            <input id="schedule-title" type="text" placeholder="例: TTT Round 5" />
          </div>
        </div>
        <div class="form-group">
          <label for="schedule-notes">メモ</label>
          <input id="schedule-notes" type="text" placeholder="任意" />
        </div>
        <div id="schedule-error" class="error-msg" style="display:none"></div>
        <button id="schedule-add" class="btn btn-primary" type="button">追加</button>
      </section>

      <section class="section">
        <div class="section-title">登録済みスケジュール <span class="badge badge-info">${sorted.length}件</span></div>
        <div id="schedule-list">${renderRows(sorted)}</div>
      </section>
    `;

    const errEl = container.querySelector('#schedule-error');

    container.querySelector('#schedule-add')?.addEventListener('click', () => {
      errEl.style.display = 'none';

      const date = container.querySelector('#schedule-date').value.trim();
      const title = container.querySelector('#schedule-title').value.trim();
      const notes = container.querySelector('#schedule-notes').value.trim();

      if (!title) {
        errEl.textContent = 'イベント名は必須です。';
        errEl.style.display = 'block';
        return;
      }

      const nextId = list.length === 0 ? 1 : Math.max(...list.map((item) => item.id)) + 1;
      list.push(normalizeItem({
        id: nextId,
        date,
        title,
        notes,
        created_at: nowIso(),
      }));

      saveManualSchedule(list);
      updatedAt = nowIso();
      render();
    });

    container.querySelectorAll('[data-delete-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.deleteId);
        const idx = list.findIndex((item) => item.id === id);
        if (idx < 0) return;
        list.splice(idx, 1);
        saveManualSchedule(list);
        updatedAt = nowIso();
        render();
      });
    });
  };

  render();
}
