// =============================================
// POST /auth — パスワード認証
// SECRET_PASSWORD（環境変数）と照合し、
// 一致すればトークンを返す
// =============================================
import { Env } from '../types';
import { ok, error } from '../response';

export async function authLogin(request: Request, env: Env): Promise<Response> {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return error('BAD_REQUEST', 'Invalid JSON body', 400);
  }

  if (body.password === env.SECRET_PASSWORD) {
    return ok({ token: env.SECRET_PASSWORD });
  }
  return error('UNAUTHORIZED', 'パスワードが正しくありません', 401);
}
