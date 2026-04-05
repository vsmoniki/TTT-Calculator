// =============================================
// シミュレーション結果画面
// - lineup_id / route_id / target_speed_kph 入力
// - POST /simulate → 結果テーブル表示
// - bottleneck ライダーを強調表示
// - route profile チャートも表示
// =============================================
import { fetchRoutes, fetchLineup, simulate } from '../api.js';

let chartInstance = null;

export async function renderSimulate(container) {
  const routes = await fetchRoutes();

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">シミュレーション</h2>
    </div>

    <div class="section">
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>ラインナップID *</label>
            <input type="number" id="sim-lineup-id" placeholder="例: 1" />
          </div>
          <div class="form-group">
            <label>コース *</label>
            <select id="sim-route">
              <option value="">— 選択 —</option>
              ${routes.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>目標速度 (kph) *</label>
            <input type="number" id="sim-speed" placeholder="例: 45" step="0.5" value="45" />
          </div>
        </div>
        <div id="sim-error" class="error-msg" style="display:none"></div>
        <button class="btn btn-primary" id="sim-run">シミュレーション実行</button>
      </div>
    </div>

    <div id="sim-result"></div>
  `;

  document.getElementById('sim-run').addEventListener('click', runSimulate);

  async function runSimulate() {
    const errEl = document.getElementById('sim-error');
    errEl.style.display = 'none';

    const lineupId = parseInt(document.getElementById('sim-lineup-id').value);
    const routeId  = parseInt(document.getElementById('sim-route').value);
    const speed    = parseFloat(document.getElementById('sim-speed').value);

    if (!lineupId || !routeId || !speed) {
      errEl.textContent = 'ラインナップID・コース・目標速度は必須です。'; errEl.style.display = 'block'; return;
    }

    const resultEl = document.getElementById('sim-result');
    resultEl.innerHTML = '<div class="loading">計算中...</div>';

    try {
      const data = await simulate({
        lineup_id: lineupId,
        route_id:  routeId,
        target_speed_kph: speed,
      });
      renderResult(resultEl, data, routes);
    } catch (e) {
      resultEl.innerHTML = '';
      errEl.textContent = e.message ?? 'シミュレーションに失敗しました'; errEl.style.display = 'block';
    }
  }
}

function renderResult(el, data, routes) {
  const { route, lineup, target_speed_kph, results, summary } = data;

  // 既存チャート破棄
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  el.innerHTML = `
    <div class="section">
      <div class="section-title">シミュレーション結果</div>

      <!-- サマリー -->
      <div class="card">
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
          <div>
            <div class="text-muted text-sm">コース</div>
            <div class="card-title">${esc(route.name)}</div>
          </div>
          <div>
            <div class="text-muted text-sm">ラインナップ</div>
            <div class="card-title">${esc(lineup.name)}</div>
          </div>
          <div>
            <div class="text-muted text-sm">目標速度</div>
            <div class="card-title">${target_speed_kph} kph</div>
          </div>
          <div>
            <div class="text-muted text-sm">ボトルネック</div>
            <div class="card-title" style="color:var(--color-primary)">
              ${esc(summary.bottleneck_name)}
              <span class="tag-bottleneck">BOTTLENECK</span>
            </div>
          </div>
          <div>
            <div class="text-muted text-sm">最大FTP比 (後続時)</div>
            <div class="card-title ${ftpClass(summary.max_draft_pct_ftp)}">${summary.max_draft_pct_ftp}%</div>
          </div>
        </div>
      </div>

      <!-- 結果テーブル -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>順</th>
              <th>ライダー</th>
              <th>先頭必要W</th>
              <th>後続必要W</th>
              <th>先頭FTP比</th>
              <th>後続FTP比</th>
            </tr>
          </thead>
          <tbody>
            ${results.map((r) => {
              const isBottleneck = r.rider_id === summary.bottleneck_rider_id;
              return `
                <tr class="${isBottleneck ? 'bottleneck' : ''}">
                  <td>${r.order_index}</td>
                  <td>
                    <strong>${esc(r.name)}</strong>
                    ${isBottleneck ? '<span class="tag-bottleneck">BOTTLENECK</span>' : ''}
                  </td>
                  <td>${r.head_required_w} W</td>
                  <td>${r.draft_required_w} W</td>
                  <td><span class="${ftpClass(r.head_required_pct_ftp)}">${r.head_required_pct_ftp}%</span></td>
                  <td><span class="${ftpClass(r.draft_required_pct_ftp)}">${r.draft_required_pct_ftp}%</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p class="text-muted text-sm mt-8">
        ※ 先頭必要W = 目標速度を単独で維持するための推定パワー。後続必要W = ドラフティング恩恵を加味した推定パワー。
      </p>
    </div>

    <!-- Route profile チャート -->
    ${route.profile_points && route.profile_points.length > 0 ? `
    <div class="section">
      <div class="section-title">コースプロフィール — ${esc(route.name)}</div>
      <div class="chart-wrap">
        <canvas id="profile-chart" height="150"></canvas>
      </div>
      <div class="text-muted text-sm">距離: ${route.distance_km} km / 獲得標高: ${route.elevation_m} m</div>
    </div>
    ` : ''}
  `;

  // Route profile チャート描画
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
          x: { ticks: { color: '#7a9ab5', maxTicksLimit: 8 }, grid: { color: 'rgba(46,66,96,0.5)' } },
          y: { ticks: { color: '#7a9ab5' }, grid: { color: 'rgba(46,66,96,0.5)' } },
        },
      },
    });
  }
}

// FTP比による色分け
function ftpClass(pct) {
  if (pct >= 110) return 'pct-danger';
  if (pct >= 95)  return 'pct-warn';
  return '';
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
