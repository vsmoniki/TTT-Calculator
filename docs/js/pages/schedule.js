import { fetchWtrlSchedule } from '../api.js';

const REFRESH_MS = 10 * 60 * 1000;

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

function renderSpecials(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return '<p class="text-muted">現在、特別イベント情報を取得できませんでした。下の公式ページをご確認ください。</p>';
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>イベント</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((item) => `
            <tr>
              <td>${item.date ?? '-'}</td>
              <td>${item.title ?? item.raw ?? '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export async function renderSchedule(container) {
  container.innerHTML = `
    <section class="page-header">
      <h2 class="page-title">WTRL TTT スケジュール</h2>
      <div class="flex gap-8 wrap items-center">
        <button id="schedule-refresh" class="btn btn-secondary btn-sm" type="button">手動更新</button>
        <label class="schedule-auto-toggle">
          <input id="schedule-auto" type="checkbox" />
          自動更新（10分）
        </label>
      </div>
    </section>

    <section class="card">
      <p class="text-sm text-muted">取得元: <a class="schedule-link" href="https://www.wtrl.racing/ttt-home/#tttschedule" target="_blank" rel="noreferrer">WTRL TTT Schedule</a></p>
      <p id="schedule-updated" class="text-sm text-muted mt-8">最終更新: ---</p>
      <div id="schedule-error" class="error-msg mt-12" hidden></div>
      <div id="schedule-specials" class="mt-12"><div class="loading">読み込み中...</div></div>
    </section>
  `;

  const refreshBtn = container.querySelector('#schedule-refresh');
  const autoToggle = container.querySelector('#schedule-auto');
  const updatedEl = container.querySelector('#schedule-updated');
  const errorEl = container.querySelector('#schedule-error');
  const specialsEl = container.querySelector('#schedule-specials');

  let timerId = null;

  const load = async () => {
    refreshBtn.disabled = true;
    errorEl.hidden = true;

    try {
      const data = await fetchWtrlSchedule();
      updatedEl.textContent = `最終更新: ${formatDateTime(data.fetched_at)}`;
      specialsEl.innerHTML = renderSpecials(data.specials);

      if (data.fetch_error) {
        errorEl.hidden = false;
        errorEl.textContent = `公式サイトからの取得に失敗したため、代替表示中です: ${data.fetch_error}`;
      }
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = `スケジュール取得に失敗しました: ${err?.message ?? '不明なエラー'}`;
      specialsEl.innerHTML = '<p class="text-muted">手動更新か、公式ページの確認をお願いします。</p>';
    } finally {
      refreshBtn.disabled = false;
    }
  };

  const stopAutoRefresh = () => {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  const startAutoRefresh = () => {
    stopAutoRefresh();
    timerId = setInterval(load, REFRESH_MS);
  };

  refreshBtn.addEventListener('click', load);
  autoToggle.addEventListener('change', () => {
    if (autoToggle.checked) {
      startAutoRefresh();
      return;
    }
    stopAutoRefresh();
  });

  window.addEventListener('hashchange', stopAutoRefresh, { once: true });

  await load();
}
