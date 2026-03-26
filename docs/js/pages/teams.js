// =============================================
// チーム管理画面
// - チーム作成 / ライダー作成
// - チームへのメンバー追加・削除
// - 8人制約をUIで表示
// =============================================
import { fetchTeams, createTeam, createRider, addTeamMember, removeTeamMember } from '../api.js';

const MAX_MEMBERS = 8;

export async function renderTeams(container) {
  await refreshTeams(container);
}

async function refreshTeams(container) {
  const teams = await fetchTeams();

  container.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">チーム管理</h2>
    </div>

    <!-- ライダー作成 -->
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

    <!-- チーム作成 -->
    <div class="section">
      <div class="section-title">新規チーム作成</div>
      <div class="card">
        <div class="form-row">
          <div class="form-group">
            <label>チーム名 *</label>
            <input type="text" id="team-name" placeholder="例: Team Alpha" />
          </div>
          <div class="form-group">
            <label>メモ</label>
            <input type="text" id="team-notes" placeholder="任意メモ" />
          </div>
        </div>
        <div id="team-error" class="error-msg" style="display:none"></div>
        <button class="btn btn-primary" id="team-submit">チームを作成</button>
      </div>
    </div>

    <!-- チーム一覧 -->
    <div class="section">
      <div class="section-title">チーム一覧</div>
      ${teams.length === 0
        ? '<p class="text-muted">チームがありません。上のフォームから作成してください。</p>'
        : teams.map((t) => renderTeamCard(t)).join('')
      }
    </div>
  `;

  // ライダー登録
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
      ['rider-name','rider-weight','rider-ftp','rider-height','rider-notes'].forEach(id => document.getElementById(id).value = '');
      await refreshTeams(container);
    } catch (e) {
      errEl.textContent = e.message ?? 'エラーが発生しました'; errEl.style.display = 'block';
    }
  });

  // チーム作成
  document.getElementById('team-submit').addEventListener('click', async () => {
    const errEl = document.getElementById('team-error');
    errEl.style.display = 'none';
    const name  = document.getElementById('team-name').value.trim();
    const notes = document.getElementById('team-notes').value.trim();

    if (!name) { errEl.textContent = 'チーム名は必須です。'; errEl.style.display = 'block'; return; }

    try {
      await createTeam({ name, notes: notes || undefined });
      document.getElementById('team-name').value = '';
      document.getElementById('team-notes').value = '';
      await refreshTeams(container);
    } catch (e) {
      errEl.textContent = e.message ?? 'エラーが発生しました'; errEl.style.display = 'block';
    }
  });

  // メンバー追加・削除ボタン（グローバル公開）
  window.addMemberToTeam = async (teamId) => {
    const sel = document.getElementById(`add-member-sel-${teamId}`);
    const riderId = parseInt(sel.value);
    if (!riderId) return;

    const errEl = document.getElementById(`team-err-${teamId}`);
    errEl.style.display = 'none';

    try {
      await addTeamMember(teamId, { rider_id: riderId });
      await refreshTeams(container);
    } catch (e) {
      errEl.textContent = e.message ?? 'エラーが発生しました'; errEl.style.display = 'block';
    }
  };

  window.removeMemberFromTeam = async (teamId, riderId) => {
    if (!confirm('このメンバーをチームから削除しますか?')) return;
    try {
      await removeTeamMember(teamId, riderId);
      await refreshTeams(container);
    } catch (e) {
      alert(e.message ?? 'エラーが発生しました');
    }
  };
}

function renderTeamCard(team) {
  const memberCount = team.members?.length ?? 0;
  const atLimit = memberCount >= MAX_MEMBERS;
  const countBadge = atLimit
    ? `<span class="badge badge-danger">${memberCount}/${MAX_MEMBERS}</span>`
    : `<span class="badge badge-info">${memberCount}/${MAX_MEMBERS}</span>`;

  // メンバーではないライダーの選択肢（API上は全riders必要だが、MVPではteam.members以外を選択肢に）
  // ここでは簡略化のため、rider_id を手入力 → 選択UIにはteam.members外ライダーが必要なので
  // rider_id直接入力 → 拡張のためにselectはINPUT TYPE=NUMBERで代替
  return `
    <div class="card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <span class="card-title" style="margin:0">${esc(team.name)}</span>
        ${countBadge}
        ${team.notes ? `<span class="text-muted text-sm">${esc(team.notes)}</span>` : ''}
      </div>

      <!-- メンバーリスト -->
      <ul class="member-list mb-8">
        ${(team.members ?? []).map((m) => `
          <li>
            <span class="member-name">${esc(m.name)}</span>
            <span class="member-meta">${m.weight_kg}kg / FTP ${m.ftp_w}W</span>
            <button class="btn btn-danger btn-sm" onclick="removeMemberFromTeam(${team.id}, ${m.rider_id})">削除</button>
          </li>
        `).join('') || '<li class="text-muted text-sm" style="display:block;padding:4px 0;">メンバーなし</li>'}
      </ul>

      <!-- メンバー追加（rider_id 直接入力） -->
      ${!atLimit ? `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="number" id="add-member-sel-${team.id}" placeholder="ライダーID" style="width:130px;background:var(--color-surface2);border:1px solid var(--color-border);border-radius:var(--radius);color:var(--color-text);padding:6px 8px;font-size:0.88rem;" />
          <button class="btn btn-secondary btn-sm" onclick="addMemberToTeam(${team.id})">追加</button>
        </div>
        <div id="team-err-${team.id}" class="error-msg mt-8" style="display:none"></div>
        <p class="text-muted text-sm mt-8">※ ライダーID は「ライダー登録後に表示」またはAPIで確認してください。</p>
      ` : `<p class="badge badge-danger">メンバー上限（${MAX_MEMBERS}人）に達しています</p>`}
    </div>
  `;
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
