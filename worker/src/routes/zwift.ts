// =============================================
// GET /zwift-rider?id={zwift_id}
// ZwiftRacing.app からライダーデータを取得するプロキシ
// =============================================
import { Env } from '../types';
import { ok, error } from '../response';

export async function getZwiftRider(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const zwiftId = url.searchParams.get('id');

  if (!zwiftId || isNaN(Number(zwiftId))) {
    return error('BAD_REQUEST', 'id パラメータに有効な数値を指定してください', 400);
  }

  // ZwiftRacing.app の公開 API
  const apiUrl = `https://www.zwiftracing.app/api/riders/${encodeURIComponent(zwiftId)}`;

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      headers: { Accept: 'application/json', 'User-Agent': 'TTT-Calculator/1.0' },
    });
  } catch {
    return error('FETCH_ERROR', 'ZwiftRacing.app への接続に失敗しました', 502);
  }

  if (res.status === 404) {
    return error('NOT_FOUND', `Zwift ID ${zwiftId} のライダーが見つかりません`, 404);
  }
  if (!res.ok) {
    return error('UPSTREAM_ERROR', `ZwiftRacing.app がエラーを返しました (HTTP ${res.status})`, 502);
  }

  let raw: Record<string, unknown>;
  try {
    raw = await res.json() as Record<string, unknown>;
  } catch {
    return error('PARSE_ERROR', 'ZwiftRacing.app のレスポンスを解析できませんでした', 502);
  }

  // ZwiftRacing.app のレスポンス形式に合わせてフィールドをマッピング
  // フィールド名が変わった場合はここを更新する
  const name      = (raw.athlete_name ?? raw.name ?? '') as string;
  const weightKg  = parseFloat(String(raw.weight_kg  ?? raw.weight  ?? '')) || null;
  const heightCm  = parseInt(String(raw.height_cm   ?? raw.height  ?? ''))  || null;
  const ftpW      = parseInt(String(raw.ftp_w        ?? raw.ftp     ?? ''))  || null;

  return ok({ zwift_id: zwiftId, name, weight_kg: weightKg, height_cm: heightCm, ftp_w: ftpW });
}
