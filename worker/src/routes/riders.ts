// =============================================
// POST /riders      — ライダー作成
// PUT  /riders/:id  — ライダー更新
// =============================================
import { Env, CreateRiderBody, UpdateRiderBody } from '../types';
import { ok, badRequest, notFound, serverError } from '../response';

export async function createRider(request: Request, env: Env): Promise<Response> {
  let body: CreateRiderBody;
  try {
    body = await request.json<CreateRiderBody>();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { name, weight_kg, ftp_w, height_cm, preferred_pull_sec, notes } = body;

  if (!name || typeof name !== 'string') return badRequest('name is required');
  if (typeof weight_kg !== 'number' || weight_kg <= 0) return badRequest('weight_kg must be a positive number');
  if (typeof ftp_w !== 'number' || ftp_w <= 0) return badRequest('ftp_w must be a positive number');

  try {
    const result = await env.DB.prepare(`
      INSERT INTO riders (name, weight_kg, height_cm, ftp_w, preferred_pull_sec, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      name.trim(),
      weight_kg,
      height_cm ?? null,
      ftp_w,
      preferred_pull_sec ?? null,
      notes ?? null
    ).run();

    const rider = await env.DB.prepare(
      'SELECT * FROM riders WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    return ok(rider, 201);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function updateRider(request: Request, env: Env, id: number): Promise<Response> {
  const existing = await env.DB.prepare('SELECT id FROM riders WHERE id = ?').bind(id).first();
  if (!existing) return notFound('Rider');

  let body: UpdateRiderBody;
  try {
    body = await request.json<UpdateRiderBody>();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name.trim()); }
  if (body.weight_kg !== undefined) { fields.push('weight_kg = ?'); values.push(body.weight_kg); }
  if (body.height_cm !== undefined) { fields.push('height_cm = ?'); values.push(body.height_cm); }
  if (body.ftp_w !== undefined) { fields.push('ftp_w = ?'); values.push(body.ftp_w); }
  if (body.preferred_pull_sec !== undefined) { fields.push('preferred_pull_sec = ?'); values.push(body.preferred_pull_sec); }
  if (body.notes !== undefined) { fields.push('notes = ?'); values.push(body.notes); }

  if (fields.length === 0) return badRequest('No fields to update');

  fields.push("updated_at = datetime('now')");
  values.push(id);

  try {
    await env.DB.prepare(
      `UPDATE riders SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    const rider = await env.DB.prepare('SELECT * FROM riders WHERE id = ?').bind(id).first();
    return ok(rider);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
