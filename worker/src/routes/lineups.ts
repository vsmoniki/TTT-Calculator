// =============================================
// GET    /lineups                            — ラインナップ一覧
// POST   /lineups                            — ラインナップ作成
// GET    /lineups/:id                        — ラインナップ詳細
// PUT    /lineups/:id                        — ラインナップ更新
// POST   /lineups/:id/members                — メンバー追加
// PUT    /lineups/:id/members/:memberId      — メンバー更新
// DELETE /lineups/:id/members/:memberId      — メンバー削除
// =============================================
import {
  Env, LineupRow,
  CreateLineupBody, UpdateLineupBody,
  AddLineupMemberBody, UpdateLineupMemberBody,
} from '../types';
import { ok, badRequest, notFound, conflict, serverError } from '../response';

const MAX_LINEUP_MEMBERS = 8;

/** ラインナップ一覧 */
export async function listLineups(_request: Request, env: Env): Promise<Response> {
  try {
    const { results } = await env.DB.prepare(`
      SELECT l.id, l.name, l.team_id, t.name AS team_name,
             l.route_id, r.name AS route_name, l.target_speed_kph, l.notes, l.created_at
      FROM lineups l
      JOIN teams t ON t.id = l.team_id
      LEFT JOIN routes r ON r.id = l.route_id
      ORDER BY l.id DESC
    `).all();
    return ok(results);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

/** ラインナップ作成 */
export async function createLineup(request: Request, env: Env): Promise<Response> {
  let body: CreateLineupBody;
  try {
    body = await request.json<CreateLineupBody>();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { team_id, name, route_id, target_speed_kph, notes } = body;
  if (!team_id || typeof team_id !== 'number') return badRequest('team_id is required');
  if (!name || typeof name !== 'string') return badRequest('name is required');

  const team = await env.DB.prepare('SELECT id FROM teams WHERE id = ?').bind(team_id).first();
  if (!team) return notFound('Team');

  try {
    const result = await env.DB.prepare(`
      INSERT INTO lineups (team_id, name, route_id, target_speed_kph, notes)
      VALUES (?, ?, ?, ?, ?)
    `).bind(team_id, name.trim(), route_id ?? null, target_speed_kph ?? null, notes ?? null).run();

    const lineup = await env.DB.prepare('SELECT * FROM lineups WHERE id = ?')
      .bind(result.meta.last_row_id).first();

    return ok(lineup, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return conflict('LINEUP_NAME_CONFLICT', `Lineup name "${name}" already exists in this team`);
    }
    console.error(e);
    return serverError();
  }
}

/** ラインナップ詳細（メンバー + ライダー/フレーム/ホイール情報付き） */
export async function getLineup(_request: Request, env: Env, id: number): Promise<Response> {
  try {
    const lineup = await env.DB.prepare('SELECT * FROM lineups WHERE id = ?').bind(id).first<LineupRow>();
    if (!lineup) return notFound('Lineup');

    const { results: members } = await env.DB.prepare(`
      SELECT
        lm.id, lm.order_index, lm.created_at,
        r.id   AS rider_id,   r.name   AS rider_name,
        r.weight_kg, r.ftp_w, r.preferred_pull_sec,
        f.id   AS frame_id,   f.name   AS frame_name,
        f.bike_type, f.aero_score AS frame_aero_score,
        f.flat_delta_sec AS frame_flat_delta_sec,
        w.id   AS wheel_id,   w.name   AS wheel_name,
        w.aero_score AS wheel_aero_score,
        w.flat_delta_sec AS wheel_flat_delta_sec
      FROM lineup_members lm
      JOIN riders r ON r.id = lm.rider_id
      LEFT JOIN frames f ON f.id = lm.frame_id
      LEFT JOIN wheels w ON w.id = lm.wheel_id
      WHERE lm.lineup_id = ?
      ORDER BY lm.order_index
    `).bind(id).all();

    return ok({ ...lineup, members });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

/** ラインナップ更新 */
export async function updateLineup(request: Request, env: Env, id: number): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM lineups WHERE id = ?').bind(id).first();
  if (!existing) return notFound('Lineup');

  let body: UpdateLineupBody;
  try {
    body = await request.json<UpdateLineupBody>();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name.trim()); }
  if (body.route_id !== undefined) { fields.push('route_id = ?'); values.push(body.route_id); }
  if (body.target_speed_kph !== undefined) { fields.push('target_speed_kph = ?'); values.push(body.target_speed_kph); }
  if (body.notes !== undefined) { fields.push('notes = ?'); values.push(body.notes); }

  if (fields.length === 0) return badRequest('No fields to update');

  fields.push("updated_at = datetime('now')");
  values.push(id);

  try {
    await env.DB.prepare(
      `UPDATE lineups SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    const lineup = await env.DB.prepare('SELECT * FROM lineups WHERE id = ?').bind(id).first();
    return ok(lineup);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return conflict('LINEUP_NAME_CONFLICT', 'Lineup name already exists in this team');
    }
    console.error(e);
    return serverError();
  }
}

/** ラインナップにメンバー追加 */
export async function addLineupMember(request: Request, env: Env, lineupId: number): Promise<Response> {
  const lineup = await env.DB.prepare('SELECT id FROM lineups WHERE id = ?').bind(lineupId).first();
  if (!lineup) return notFound('Lineup');

  let body: AddLineupMemberBody;
  try {
    body = await request.json<AddLineupMemberBody>();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { rider_id, frame_id, wheel_id, order_index } = body;
  if (!rider_id || typeof rider_id !== 'number') return badRequest('rider_id is required');
  if (!order_index || order_index < 1 || order_index > 8) return badRequest('order_index must be between 1 and 8');

  const rider = await env.DB.prepare('SELECT id FROM riders WHERE id = ?').bind(rider_id).first();
  if (!rider) return notFound('Rider');

  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM lineup_members WHERE lineup_id = ?'
  ).bind(lineupId).first<{ cnt: number }>();

  if ((countRow?.cnt ?? 0) >= MAX_LINEUP_MEMBERS) {
    return conflict('LINEUP_MEMBER_LIMIT_EXCEEDED', `lineup members cannot exceed ${MAX_LINEUP_MEMBERS}`);
  }

  const dupRider = await env.DB.prepare(
    'SELECT id FROM lineup_members WHERE lineup_id = ? AND rider_id = ?'
  ).bind(lineupId, rider_id).first();
  if (dupRider) return conflict('LINEUP_RIDER_DUPLICATE', 'Rider is already in this lineup');

  const dupOrder = await env.DB.prepare(
    'SELECT id FROM lineup_members WHERE lineup_id = ? AND order_index = ?'
  ).bind(lineupId, order_index).first();
  if (dupOrder) return conflict('LINEUP_ORDER_DUPLICATE', `order_index ${order_index} is already taken`);

  try {
    const result = await env.DB.prepare(`
      INSERT INTO lineup_members (lineup_id, rider_id, frame_id, wheel_id, order_index)
      VALUES (?, ?, ?, ?, ?)
    `).bind(lineupId, rider_id, frame_id ?? null, wheel_id ?? null, order_index).run();

    const member = await env.DB.prepare('SELECT * FROM lineup_members WHERE id = ?')
      .bind(result.meta.last_row_id).first();

    return ok(member, 201);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

/** ラインナップメンバー更新 */
export async function updateLineupMember(
  request: Request, env: Env, lineupId: number, memberId: number
): Promise<Response> {
  const member = await env.DB.prepare(
    'SELECT id FROM lineup_members WHERE id = ? AND lineup_id = ?'
  ).bind(memberId, lineupId).first();
  if (!member) return notFound('Lineup member');

  let body: UpdateLineupMemberBody;
  try {
    body = await request.json<UpdateLineupMemberBody>();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.frame_id !== undefined) { fields.push('frame_id = ?'); values.push(body.frame_id); }
  if (body.wheel_id !== undefined) { fields.push('wheel_id = ?'); values.push(body.wheel_id); }

  if (body.order_index !== undefined) {
    if (body.order_index < 1 || body.order_index > 8) {
      return badRequest('order_index must be between 1 and 8');
    }
    const dup = await env.DB.prepare(
      'SELECT id FROM lineup_members WHERE lineup_id = ? AND order_index = ? AND id != ?'
    ).bind(lineupId, body.order_index, memberId).first();
    if (dup) return conflict('LINEUP_ORDER_DUPLICATE', `order_index ${body.order_index} is already taken`);

    fields.push('order_index = ?');
    values.push(body.order_index);
  }

  if (fields.length === 0) return badRequest('No fields to update');

  values.push(memberId);

  try {
    await env.DB.prepare(
      `UPDATE lineup_members SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    const updated = await env.DB.prepare('SELECT * FROM lineup_members WHERE id = ?').bind(memberId).first();
    return ok(updated);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

/** ラインナップメンバーの順番を入れ替え（atomic swap） */
export async function swapLineupMemberOrder(
  request: Request, env: Env, lineupId: number
): Promise<Response> {
  let body: { a_id: number; b_id: number };
  try {
    body = await request.json<{ a_id: number; b_id: number }>();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { a_id, b_id } = body;
  if (!a_id || !b_id || typeof a_id !== 'number' || typeof b_id !== 'number') {
    return badRequest('a_id and b_id are required');
  }

  const [a, b] = await Promise.all([
    env.DB.prepare(
      'SELECT id, order_index FROM lineup_members WHERE id = ? AND lineup_id = ?'
    ).bind(a_id, lineupId).first<{ id: number; order_index: number }>(),
    env.DB.prepare(
      'SELECT id, order_index FROM lineup_members WHERE id = ? AND lineup_id = ?'
    ).bind(b_id, lineupId).first<{ id: number; order_index: number }>(),
  ]);

  if (!a || !b) return notFound('Lineup member');

  try {
    await env.DB.prepare(`
      UPDATE lineup_members
      SET order_index = CASE id
        WHEN ? THEN ?
        WHEN ? THEN ?
      END
      WHERE id IN (?, ?)
    `).bind(a.id, b.order_index, b.id, a.order_index, a.id, b.id).run();

    return ok({ message: 'Swapped' });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

/** ラインナップメンバー削除 */
export async function removeLineupMember(
  _request: Request, env: Env, lineupId: number, memberId: number
): Promise<Response> {
  const member = await env.DB.prepare(
    'SELECT id FROM lineup_members WHERE id = ? AND lineup_id = ?'
  ).bind(memberId, lineupId).first();
  if (!member) return notFound('Lineup member');

  try {
    await env.DB.prepare(
      'DELETE FROM lineup_members WHERE id = ?'
    ).bind(memberId).run();

    return ok({ message: 'Member removed' });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
