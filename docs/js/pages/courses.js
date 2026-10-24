// =============================================
// コース一覧画面（閲覧専用）
// 同梱データ（WTRL TTT コース + seed コース）を表示する。
// 標高プロファイルは同梱データから SVG スパークラインで描く（外部ライブラリなし）。
// =============================================
import { COURSES } from '../data.js';

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sparkline(course, width = 140, height = 30) {
  const pts = course.profile;
  if (!Array.isArray(pts) || pts.length < 2) return '<span class="text-muted text-sm">-</span>';
  const maxD = Math.max(...pts.map((p) => p[0])) || 1;
  const alts = pts.map((p) => p[1]);
  const minA = Math.min(...alts);
  const maxA = Math.max(...alts);
  const range = (maxA - minA) || 1;
  const coords = pts
    .map(([d, a]) => `${((d / maxD) * width).toFixed(1)},${(height - 3 - ((a - minA) / range) * (height - 6)).toFixed(1)}`)
    .join(' ');
  return `<svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline points="${coords}" fill="none" stroke="var(--color-primary)" stroke-width="1.5" /></svg>`;
}

const TYPE_LABELS = { flat: '平坦', hilly: '丘陵', climbing: '山岳' };

export function renderCourses(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">コース一覧</h2>
      <span class="text-muted text-sm">同梱データ（全 ${COURSES.length} 件）</span>
    </div>
    <div class="section">
      <div class="table-wrap">
        <table>
          <thead><tr><th>コース</th><th>ワールド</th><th>距離</th><th>獲得標高</th><th>タイプ</th><th>プロファイル</th></tr></thead>
          <tbody>
            ${COURSES.map((c) => `
              <tr>
                <td><strong>${esc(c.name)}</strong>
                  ${c.sourceUrl ? `<div class="text-muted text-sm"><a class="schedule-link" href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.sourceName ?? '出典')}</a></div>` : ''}
                </td>
                <td>${esc(c.world)}</td>
                <td>${c.distanceKm} km</td>
                <td>${c.elevationM} m</td>
                <td>${TYPE_LABELS[c.routeType] ?? esc(c.routeType)}</td>
                <td>${sparkline(c)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="text-muted text-sm mt-8">※ プロファイルは同梱の標高点データから描いた概形です。シミュレーションはこのプロファイルを区間分割して勾配計算に使います。</p>
    </div>
  `;
}
