import { fetchSettings, updateSettings } from '../api.js';

const DEFAULT_SETTINGS = {
  draft_factor_2: 0.8,
  draft_factor_3: 0.75,
  draft_factor_4: 0.75,
  draft_factor_5: 0.75,
  draft_factor_6: 0.75,
  draft_factor_7: 0.75,
  draft_factor_8: 0.75,
  road_cd: 0.63,
  tt_cd: 0.55,
  cda_calibration_multiplier: 0.76,
  equipment_reference_time_sec: 1668,
  default_height_m: 1.75,
  equipment_preset: 'tri_dtswiss',
};

export async function renderAdmin(container) {
  const settings = { ...DEFAULT_SETTINGS, ...(await fetchSettings()) };

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">管理</h2>
      <span class="text-muted text-sm">ドラフト係数・計算定数・機材セットを編集</span>
    </div>

    <div class="inner-tabs" role="tablist" aria-label="管理設定メニュー">
      <button class="inner-tab active" id="admin-tab-draft" type="button">ドラフト係数</button>
      <button class="inner-tab" id="admin-tab-equipment" type="button">機材設定</button>
    </div>

    <div id="admin-panel-draft" class="section">
      <div class="section-title">ドラフト係数</div>
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
      </div>
    </div>

    <div id="admin-panel-equipment" class="section" style="display:none;">
      <div class="section-title">機材設定</div>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>使用セット</label>
            <select id="s-gear-preset">
              <option value="tri_dtswiss" ${settings.equipment_preset === 'tri_dtswiss' ? 'selected' : ''}>Tri &amp; DTswiss セット</option>
              <option value="tron" ${settings.equipment_preset === 'tron' ? 'selected' : ''}>Tron</option>
            </select>
          </div>
        </div>
        <p class="text-muted text-sm">※ シミュレーション画面・ラインナップ画面の初期機材に反映されます。</p>
      </div>

      <div class="card">
        <div class="card-title">機材別 Cd 設定</div>
        <div class="form-row">
          <div class="form-group"><label>ロード機材 Cd</label><input type="number" step="0.01" id="s-road-cd" value="${settings.road_cd}" /></div>
          <div class="form-group"><label>TT機材 Cd</label><input type="number" step="0.01" id="s-tt-cd" value="${settings.tt_cd}" /></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">機材シミュレーション補正</div>
        <div class="form-row">
          <div class="form-group"><label>CdA較正倍率</label><input type="number" step="0.01" id="s-cda-cal" value="${settings.cda_calibration_multiplier}" /></div>
          <div class="form-group"><label>機材基準タイム(sec)</label><input type="number" step="1" id="s-eq-ref" value="${settings.equipment_reference_time_sec}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>デフォルト身長(m)</label><input type="number" step="0.01" id="s-height" value="${settings.default_height_m}" /></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="card">
        <div class="flex gap-8 wrap mt-12">
          <button class="btn btn-primary" id="s-save">保存</button>
          <button class="btn btn-secondary" id="s-reset">初期値に戻す</button>
        </div>
        <p class="text-muted text-sm mt-8" id="s-msg"></p>
      </div>
    </div>
  `;

  const draftTab = container.querySelector('#admin-tab-draft');
  const equipmentTab = container.querySelector('#admin-tab-equipment');
  const draftPanel = container.querySelector('#admin-panel-draft');
  const equipmentPanel = container.querySelector('#admin-panel-equipment');

  const switchAdminTab = (tab) => {
    const isDraft = tab === 'draft';
    draftTab?.classList.toggle('active', isDraft);
    equipmentTab?.classList.toggle('active', !isDraft);
    if (draftPanel) draftPanel.style.display = isDraft ? '' : 'none';
    if (equipmentPanel) equipmentPanel.style.display = isDraft ? 'none' : '';
  };

  draftTab?.addEventListener('click', () => switchAdminTab('draft'));
  equipmentTab?.addEventListener('click', () => switchAdminTab('equipment'));

  container.querySelector('#s-save')?.addEventListener('click', async () => {
    const equipmentPreset = container.querySelector('#s-gear-preset')?.value === 'tron' ? 'tron' : 'tri_dtswiss';
    const presetDefaults = equipmentPreset === 'tron'
      ? { default_frame_name: 'Zwift Concept Z1 (Tron)', default_wheel_name: 'DT Swiss ARC 1100 DICUT 85/Disc' }
      : { default_frame_name: 'CADEX tri', default_wheel_name: 'DT Swiss ARC 1100 DICUT 85/Disc' };
    const payload = {
      draft_factor_2: valNum(container, '#s-draft2'),
      draft_factor_3: valNum(container, '#s-draft3'),
      draft_factor_4: valNum(container, '#s-draft4'),
      draft_factor_5: valNum(container, '#s-draft5'),
      draft_factor_6: valNum(container, '#s-draft6'),
      draft_factor_7: valNum(container, '#s-draft7'),
      draft_factor_8: valNum(container, '#s-draft8'),
      road_cd: valNum(container, '#s-road-cd'),
      tt_cd: valNum(container, '#s-tt-cd'),
      cda_calibration_multiplier: valNum(container, '#s-cda-cal'),
      equipment_reference_time_sec: valNum(container, '#s-eq-ref'),
      default_height_m: valNum(container, '#s-height'),
      equipment_preset: equipmentPreset,
      ...presetDefaults,
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
      road_cd: '#s-road-cd',
      tt_cd: '#s-tt-cd',
      cda_calibration_multiplier: '#s-cda-cal',
      equipment_reference_time_sec: '#s-eq-ref',
      default_height_m: '#s-height',
      equipment_preset: '#s-gear-preset',
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
