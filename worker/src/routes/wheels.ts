// =============================================
// GET /wheels — ホイール一覧
// =============================================
import { Env, WheelRow } from '../types';
import { ok, serverError } from '../response';

export async function listWheels(_request: Request, env: Env): Promise<Response> {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM wheels ORDER BY id'
    ).all<WheelRow>();

    return ok(results);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
