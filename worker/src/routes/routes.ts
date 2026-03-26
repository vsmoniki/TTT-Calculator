// =============================================
// GET /routes       — コース一覧
// GET /routes/:id   — コース詳細
// =============================================
import { Env, RouteRow } from '../types';
import { ok, notFound, serverError } from '../response';

export async function listRoutes(_request: Request, env: Env): Promise<Response> {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM routes ORDER BY id'
    ).all<RouteRow>();

    // profile_points_json を JSON にパース
    const routes = results.map((r) => ({
      ...r,
      profile_points: JSON.parse(r.profile_points_json),
    }));

    return ok(routes);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}

export async function getRoute(_request: Request, env: Env, id: number): Promise<Response> {
  try {
    const row = await env.DB.prepare(
      'SELECT * FROM routes WHERE id = ?'
    ).bind(id).first<RouteRow>();

    if (!row) return notFound('Route');

    return ok({ ...row, profile_points: JSON.parse(row.profile_points_json) });
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
