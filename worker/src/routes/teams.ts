// =============================================
// GET    /teams                          — チーム一覧
// GET    /teams/:id                      — チーム詳細
// POST   /teams                          — チーム作成
// POST   /teams/:id/members              — メンバー追加
// DELETE /teams/:id/members/:riderId     — メンバー削除
// =============================================
import { Env, TeamRow, CreateTeamBody, AddTeamMemberBody } from '../types';
import { ok, badRequest, notFound, conflict, serverError } from '../response';

const MAX_TEAM_MEMBERS = 8;

/** チーム一覧（メンバー情報付き） */
export async function listTeams(_request: Request, env: Env): Promise<Response> {
  try {
    const { results: teams } = await env.DB.prepare(
      'SELECT * FROM teams ORDER BY id'
    ).all<TeamRow>();

    // 各チームのメンバーを取得
    const teamsWithMembers = await Promise.all(
      teams.map(async (team) => {
        const { results: members } = await env.DB.prepare(`
          SELECT tm.id, tm.rider_id, tm.created_at,
                 r.name, r.weight_kg, r.ftp_w
          FROM team_members tm
          JOIN riders r ON r.id = tm.rider_id
          WHERE tm.team_id = ?
          ORDER BY tm.id
        `).bind(team.id).all();

        return { ...team, members };
      })
    );

    return ok(teamsWithMembers);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

/** チーム詳細 */
export async function getTeam(_request: Request, env: Env, id: number): Promise<Response> {
  try {
    const team = await env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(id).first<TeamRow>();
    if (!team) return notFound('Team');

    const { results: members } = await env.DB.prepare(`
      SELECT tm.id, tm.rider_id, tm.created_at,
             r.name, r.weight_kg, r.height_cm, r.ftp_w, r.preferred_pull_sec, r.notes
      FROM team_members tm
      JOIN riders r ON r.id = tm.rider_id
      WHERE tm.team_id = ?
      ORDER BY tm.id
    `).bind(id).all();

    return ok({ ...team, members });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

/** チーム作成 */
export async function createTeam(request: Request, env: Env): Promise<Response> {
  let body: CreateTeamBody;
  try {
    body = await request.json<CreateTeamBody>();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { name, notes } = body;
  if (!name || typeof name !== 'string') return badRequest('name is required');

  try {
    const result = await env.DB.prepare(
      'INSERT INTO teams (name, notes) VALUES (?, ?)'
    ).bind(name.trim(), notes ?? null).run();

    const team = await env.DB.prepare('SELECT * FROM teams WHERE id = ?')
      .bind(result.meta.last_row_id).first();

    return ok(team, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return conflict('TEAM_NAME_CONFLICT', `Team name "${name}" already exists`);
    }
    console.error(e);
    return serverError();
  }
}

/** チームにメンバー追加 */
export async function addTeamMember(request: Request, env: Env, teamId: number): Promise<Response> {
  const team = await env.DB.prepare('SELECT id FROM teams WHERE id = ?').bind(teamId).first();
  if (!team) return notFound('Team');

  let body: AddTeamMemberBody;
  try {
    body = await request.json<AddTeamMemberBody>();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { rider_id } = body;
  if (!rider_id || typeof rider_id !== 'number') return badRequest('rider_id is required');

  // ライダー存在確認
  const rider = await env.DB.prepare('SELECT id FROM riders WHERE id = ?').bind(rider_id).first();
  if (!rider) return notFound('Rider');

  // 8人制約チェック
  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM team_members WHERE team_id = ?'
  ).bind(teamId).first<{ cnt: number }>();

  if ((countRow?.cnt ?? 0) >= MAX_TEAM_MEMBERS) {
    return conflict('TEAM_MEMBER_LIMIT_EXCEEDED', `team members cannot exceed ${MAX_TEAM_MEMBERS}`);
  }

  try {
    const result = await env.DB.prepare(
      'INSERT INTO team_members (team_id, rider_id) VALUES (?, ?)'
    ).bind(teamId, rider_id).run();

    const member = await env.DB.prepare('SELECT * FROM team_members WHERE id = ?')
      .bind(result.meta.last_row_id).first();

    return ok(member, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return conflict('TEAM_MEMBER_DUPLICATE', 'Rider is already a member of this team');
    }
    console.error(e);
    return serverError();
  }
}

/** チームからメンバー削除 */
export async function removeTeamMember(
  _request: Request, env: Env, teamId: number, riderId: number
): Promise<Response> {
  const team = await env.DB.prepare('SELECT id FROM teams WHERE id = ?').bind(teamId).first();
  if (!team) return notFound('Team');

  const member = await env.DB.prepare(
    'SELECT id FROM team_members WHERE team_id = ? AND rider_id = ?'
  ).bind(teamId, riderId).first();
  if (!member) return notFound('Team member');

  try {
    await env.DB.prepare(
      'DELETE FROM team_members WHERE team_id = ? AND rider_id = ?'
    ).bind(teamId, riderId).run();

    return ok({ message: 'Member removed' });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
