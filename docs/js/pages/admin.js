import { fetchSettings, updateSettings } from '../api.js';

const DEFAULT_SETTINGS = {
  draft_factor_2: 0.8,
  draft_factor_3: 0.75,
  draft_factor_4: 0.75,
  draft_factor_5: 0.75,
  draft_factor_6: 0.75,
  draft_factor_7: 0.75,
  draft_factor_8: 0.75,
  bike_kg: 8,
  rho: 1.225,
  crr: 0.004,
  road_cd: 0.63,
  tt_cd: 0.55,
  cda_calibration_multiplier: 0.76,
  equipment_reference_time_sec: 1668,
  equipment_cda_sensitivity: 3,
  default_height_m: 1.75,
};

export async function renderAdmin(container) {
  const settings = { ...DEFAULT_SETTINGS, ...(await fetchSettings()) };

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">管理</h2>
      <span class="text-muted text-sm">ドラフト係数・計算定数を編集</span>
    </div>

    <div class="section">
      <div class="section-title">シミュレーション共通設定</div>
      <div class="card">
        <div class="form-row">
          <div class="form-group"><label>2番手ドラフト係数</label><input type="number" step="0.01" id="s-draft2" value="${settings.draft_factor_2}" /></div>
          <div class="form-group"><label>3番手ドラフト係数</label><input type="number" step="0.01" id="s-draft3" value="${settings.draft_factor_3}" /></div>
          <div class="form-group"><label>4番手ドラフト係数</label><input type="number" step="0.01" id="s-draft4" value="${settings.draft_factor_4}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>5番手ドラフト係数</label><input type="number" step="0.01" id="s-draft5" value="${settings.draft_factor_5}" /></div>
          <div class="form-group"><label>6番手ドラフト係数</label><input type="number" step="0.01" id="s-draft6" value="${settings.draft_factor_6}" /></div>
          <div class="form-group"><label>7番手ドラフト係数</label><input type="number" step="0.01" id="s-draft7" value="${settings.draft_factor_7}" /></div>
          <div class="form-group"><label>8番手ドラフト係数</label><input type="number" step="0.01" id="s-draft8" value="${settings.draft_factor_8}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Bike重量 (kg)</label><input type="number" step="0.1" id="s-bike" value="${settings.bike_kg}" /></div>
          <div class="form-group"><label>空気密度 ρ</label><input type="number" step="0.001" id="s-rho" value="${settings.rho}" /></div>
          <div class="form-group"><label>Crr</label><input type="number" step="0.0001" id="s-crr" value="${settings.crr}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Road Cd</label><input type="number" step="0.01" id="s-road-cd" value="${settings.road_cd}" /></div>
          <div class="form-group"><label>TT Cd</label><input type="number" step="0.01" id="s-tt-cd" value="${settings.tt_cd}" /></div>
          <div class="form-group"><label>CdA較正倍率</label><input type="number" step="0.01" id="s-cda-cal" value="${settings.cda_calibration_multiplier}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>機材基準タイム(sec)</label><input type="number" step="1" id="s-eq-ref" value="${settings.equipment_reference_time_sec}" /></div>
          <div class="form-group"><label>機材感度</label><input type="number" step="0.1" id="s-eq-sens" value="${settings.equipment_cda_sensitivity}" /></div>
          <div class="form-group"><label>デフォルト身長(m)</label><input type="number" step="0.01" id="s-height" value="${settings.default_height_m}" /></div>
        </div>

        <div class="flex gap-8 wrap mt-12">
          <button class="btn btn-primary" id="s-save">保存</button>
          <button class="btn btn-secondary" id="s-reset">初期値に戻す</button>
        </div>
        <p class="text-muted text-sm mt-8" id="s-msg"></p>
      </div>
    </div>
  `;

  container.querySelector('#s-save')?.addEventListener('click', async () => {
    const payload = {
      draft_factor_2: valNum(container, '#s-draft2'),
      draft_factor_3: valNum(container, '#s-draft3'),
      draft_factor_4: valNum(container, '#s-draft4'),
      draft_factor_5: valNum(container, '#s-draft5'),
      draft_factor_6: valNum(container, '#s-draft6'),
      draft_factor_7: valNum(container, '#s-draft7'),
      draft_factor_8: valNum(container, '#s-draft8'),
      bike_kg: valNum(container, '#s-bike'),
      rho: valNum(container, '#s-rho'),
      crr: valNum(container, '#s-crr'),
      road_cd: valNum(container, '#s-road-cd'),
      tt_cd: valNum(container, '#s-tt-cd'),
      cda_calibration_multiplier: valNum(container, '#s-cda-cal'),
      equipment_reference_time_sec: valNum(container, '#s-eq-ref'),
      equipment_cda_sensitivity: valNum(container, '#s-eq-sens'),
      default_height_m: valNum(container, '#s-height'),
    };

    const msg = container.querySelector('#s-msg');
    try {
      await updateSettings(payload);
      if (msg) {
        msg.textContent = '保存しました。シミュレーション画面を再表示すると反映されます。';
        msg.style.color = 'var(--color-primary)';
      }
    } catch (e) {
      if (msg) {
        msg.textContent = `保存失敗: ${e?.message ?? String(e)}`;
        msg.style.color = '#f87171';
      }
    }
  });

  container.querySelector('#s-reset')?.addEventListener('click', () => {
    renderWithSettings(container, DEFAULT_SETTINGS);
  });
}

function renderWithSettings(container, settings) {
  Object.entries(settings).forEach(([key, value]) => {
    const map = {
      draft_factor_2: '#s-draft2',
      draft_factor_3: '#s-draft3',
      draft_factor_4: '#s-draft4',
      draft_factor_5: '#s-draft5',
      draft_factor_6: '#s-draft6',
      draft_factor_7: '#s-draft7',
      draft_factor_8: '#s-draft8',
      bike_kg: '#s-bike',
      rho: '#s-rho',
      crr: '#s-crr',
      road_cd: '#s-road-cd',
      tt_cd: '#s-tt-cd',
      cda_calibration_multiplier: '#s-cda-cal',
      equipment_reference_time_sec: '#s-eq-ref',
      equipment_cda_sensitivity: '#s-eq-sens',
      default_height_m: '#s-height',
    };
    const selector = map[key];
    if (!selector) return;
    const el = container.querySelector(selector);
    if (el) el.value = String(value);
  });
}

function valNum(container, selector) {
  const raw = container.querySelector(selector)?.value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}
