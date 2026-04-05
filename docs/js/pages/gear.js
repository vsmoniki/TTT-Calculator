// =============================================
// 機材一覧画面
// - frames / wheels タブ切り替えテーブル
// =============================================
import { fetchFrames, fetchWheels } from '../api.js';

export async function renderGear(container) {
  const [frames, wheels] = await Promise.all([fetchFrames(), fetchWheels()]);

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">機材一覧</h2>
    </div>
    <div class="inner-tabs">
      <button class="inner-tab active" id="tab-frames" onclick="switchGearTab('frames')">機材（フレーム）</button>
      <button class="inner-tab"        id="tab-wheels" onclick="switchGearTab('wheels')">機材（ホイール）</button>
    </div>
    <div id="gear-content"></div>
  `;

  function renderFrames() {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>名前</th>
              <th>タイプ</th>
              <th>Aeroスコア</th>
              <th>Climbスコア</th>
              <th>平坦Δ(秒)</th>
              <th>登りΔ(秒)</th>
              <th>価格(ドロップ)</th>
              <th>必要Lv</th>
            </tr>
          </thead>
          <tbody>
            ${frames.map((f) => `
              <tr>
                <td><strong>${esc(f.name)}</strong></td>
                <td><span class="badge badge-${f.bike_type === 'tt' ? 'warn' : 'info'}">${f.bike_type === 'tt' ? 'TT' : 'Road'}</span></td>
                <td>${scoreBar(f.aero_score)}</td>
                <td>${scoreBar(f.climb_score)}</td>
                <td>${deltaSec(f.flat_delta_sec)}</td>
                <td>${deltaSec(f.climb_delta_sec)}</td>
                <td>${f.drop_shop_price != null ? Number(f.drop_shop_price).toLocaleString() : '—'}</td>
                <td>${f.level_required ?? '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderWheels() {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>名前</th>
              <th>Aeroスコア</th>
              <th>Climbスコア</th>
              <th>平坦Δ(秒)</th>
              <th>登りΔ(秒)</th>
              <th>価格(ドロップ)</th>
              <th>必要Lv</th>
            </tr>
          </thead>
          <tbody>
            ${wheels.map((w) => `
              <tr>
                <td><strong>${esc(w.name)}</strong></td>
                <td>${scoreBar(w.aero_score)}</td>
                <td>${scoreBar(w.climb_score)}</td>
                <td>${deltaSec(w.flat_delta_sec)}</td>
                <td>${deltaSec(w.climb_delta_sec)}</td>
                <td>${w.drop_shop_price != null ? Number(w.drop_shop_price).toLocaleString() : '—'}</td>
                <td>${w.level_required ?? '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // 初期表示
  document.getElementById('gear-content').innerHTML = renderFrames();

  window.switchGearTab = (tab) => {
    document.getElementById('tab-frames').classList.toggle('active', tab === 'frames');
    document.getElementById('tab-wheels').classList.toggle('active', tab === 'wheels');
    document.getElementById('gear-content').innerHTML = tab === 'frames' ? renderFrames() : renderWheels();
  };
}

// ---- ヘルパー ----
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function scoreBar(score) {
  if (score == null) return '—';
  const pct = Math.min(100, (score / 10) * 100);
  return `
    <div style="display:flex;align-items:center;gap:6px;">
      <div style="width:60px;height:6px;background:var(--color-surface2);border-radius:3px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:var(--color-primary);border-radius:3px;"></div>
      </div>
      <span style="font-size:0.8rem;color:var(--color-text-muted)">${score}</span>
    </div>
  `;
}

function deltaSec(sec) {
  if (sec == null) return '—';
  const sign = sec < 0 ? '' : '+';
  const cls  = sec < 0 ? 'color:var(--color-success)' : 'color:var(--color-danger)';
  return `<span style="${cls}">${sign}${sec}s</span>`;
}
