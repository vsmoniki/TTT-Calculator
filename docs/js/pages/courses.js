// =============================================
// コース一覧画面
// - route一覧テーブル表示
// - 詳細モーダル + route profile チャート
// =============================================
import { fetchRoutes } from '../api.js';

let chartInstance = null;

export async function renderCourses(container) {
  const routes = await fetchRoutes();

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">コース一覧</h2>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>コース名</th>
            <th>ワールド</th>
            <th>距離</th>
            <th>獲得標高</th>
            <th>タイプ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${routes.map((r) => `
            <tr>
              <td>${r.id}</td>
              <td><strong>${esc(r.name)}</strong></td>
              <td>${esc(r.world)}</td>
              <td>${r.distance_km} km</td>
              <td>${r.elevation_m} m</td>
              <td>${routeTypeBadge(r.route_type)}</td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="showRouteDetail(${r.id})">詳細</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div id="route-modal"></div>
  `;

  // グローバルに関数を公開（onclick属性から呼び出すため）
  window.showRouteDetail = async (id) => {
    const route = routes.find((r) => r.id === id);
    if (!route) return;
    openRouteModal(route);
  };
}

function openRouteModal(route) {
  // 既存チャートを破棄
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  const modal = document.getElementById('route-modal');
  modal.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal">
        <button class="modal-close" onclick="closeRouteModal()">✕</button>
        <div class="modal-title">${esc(route.name)}</div>
        <div class="card-meta mb-8">
          ${esc(route.world)} &nbsp;|&nbsp;
          距離: ${route.distance_km} km &nbsp;|&nbsp;
          獲得標高: ${route.elevation_m} m &nbsp;|&nbsp;
          ${routeTypeBadge(route.route_type)}
        </div>
        ${route.source_url ? `<p class="text-sm text-muted mb-8">出典: <a href="${esc(route.source_url)}" target="_blank" rel="noopener" style="color:var(--color-primary)">${esc(route.source_name ?? route.source_url)}</a></p>` : ''}
        <div class="chart-wrap">
          <canvas id="profile-chart" height="160"></canvas>
        </div>
      </div>
    </div>
  `;

  // モーダル外クリックで閉じる
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeRouteModal();
  });

  window.closeRouteModal = () => {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    modal.innerHTML = '';
  };

  // profile chart を描画
  const points = route.profile_points ?? [];
  if (points.length > 0) {
    const ctx = document.getElementById('profile-chart').getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map((p) => `${p.distance_km}km`),
        datasets: [{
          label: '標高 (m)',
          data: points.map((p) => p.altitude_m),
          fill: true,
          backgroundColor: 'rgba(245,166,35,0.15)',
          borderColor: 'rgba(245,166,35,0.9)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: '#7a9ab5', maxTicksLimit: 8 },
            grid:  { color: 'rgba(46,66,96,0.5)' },
          },
          y: {
            ticks: { color: '#7a9ab5' },
            grid:  { color: 'rgba(46,66,96,0.5)' },
          },
        },
      },
    });
  }
}

// ---- ヘルパー ----
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function routeTypeBadge(type) {
  const map = { flat: ['info', '平坦'], hilly: ['warn', '丘陵'], climbing: ['danger', '登り'] };
  const [cls, label] = map[type] ?? ['info', type];
  return `<span class="badge badge-${cls}">${label}</span>`;
}
