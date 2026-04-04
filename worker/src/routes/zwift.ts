// =============================================
// GET /zwift-rider?id={zwift_id}
// ZwiftPower からライダーデータを取得するプロキシ
// =============================================
import { Env } from '../types';
import { ok, error } from '../response';

export async function getZwiftRider(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const zwiftId = url.searchParams.get('id');

  if (!zwiftId || isNaN(Number(zwiftId))) {
    return error('BAD_REQUEST', 'id パラメータに有効な数値を指定してください', 400);
  }

  const apiUrl = `https://zwiftpower.com/cache3/profile/${encodeURIComponent(zwiftId)}_all.json`;

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; TTT-Calculator/1.0)',
      },
    });
  } catch {
    return error('FETCH_ERROR', 'ZwiftPower への接続に失敗しました', 502);
  }

  if (res.status === 404) {
    return error('NOT_FOUND', `Zwift ID ${zwiftId} のライダーが見つかりません`, 404);
  }
  if (!res.ok) {
    return error('UPSTREAM_ERROR', `ZwiftPower がエラーを返しました (HTTP ${res.status})`, 502);
  }

  let raw: Record<string, unknown>;
  try {
    raw = await res.json() as Record<string, unknown>;
  } catch {
    return error('PARSE_ERROR', 'ZwiftPower のレスポンスを解析できませんでした', 502);
  }

  // ZwiftPower は { data: [ {...} ] } 形式で返す
  const dataArr = Array.isArray(raw.data) ? raw.data : null;
  const rider   = dataArr?.[0] as Record<string, unknown> | undefined;

  if (!rider) {
    return error('NOT_FOUND', `Zwift ID ${zwiftId} のライダーが見つかりません`, 404);
  }

  const name     = String(rider.name     ?? rider.name_f   ?? '');
  // ZwiftPower の体重は グラム 単位の場合あり → kg に変換
  const rawWeight = parseFloat(String(rider.weight_kg ?? rider.weight ?? '0'));
  const weightKg  = rawWeight > 500 ? Math.round(rawWeight / 1000 * 10) / 10 : rawWeight || null;
  // 身長は cm または m で返ることがある
  const rawHeight = parseFloat(String(rider.height_cm ?? rider.height ?? '0'));
  const heightCm  = rawHeight > 0 && rawHeight < 3 ? Math.round(rawHeight * 100) : (rawHeight || null);
  const ftpW      = parseInt(String(rider.ftp_w ?? rider.ftp ?? '0')) || null;

  return ok({ zwift_id: zwiftId, name, weight_kg: weightKg, height_cm: heightCm, ftp_w: ftpW });
}

