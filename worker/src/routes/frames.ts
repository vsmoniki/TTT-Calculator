// =============================================
// GET /frames — フレーム一覧
// =============================================
import { Env, FrameRow } from '../types';
import { ok, serverError } from '../response';

export async function listFrames(_request: Request, env: Env): Promise<Response> {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM frames ORDER BY id'
    ).all<FrameRow>();

    return ok(results);
  } catch (e) {
    console.error(e);
    return serverError();
  }
}
