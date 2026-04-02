// =============================================
// TTT Calculator - 統一レスポンスヘルパー
// =============================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** 成功レスポンス */
export function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** エラーレスポンス（統一フォーマット） */
export function error(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** CORSプリフライトレスポンス */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** 404 Not Found */
export function notFound(resource = 'Resource'): Response {
  return error('NOT_FOUND', `${resource} not found`, 404);
}

/** 400 Bad Request */
export function badRequest(message: string): Response {
  return error('BAD_REQUEST', message, 400);
}

/** 409 Conflict */
export function conflict(code: string, message: string): Response {
  return error(code, message, 409);
}

/** 500 Internal Server Error */
export function serverError(message = 'Internal server error'): Response {
  return error('INTERNAL_SERVER_ERROR', message, 500);
}
