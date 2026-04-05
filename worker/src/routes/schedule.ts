import { Env } from '../types';
import { ok, serverError } from '../response';

const WTRL_TTT_URL = 'https://www.wtrl.racing/ttt-home/#tttschedule';

interface ScheduleSpecial {
  date: string;
  title: string;
  raw: string;
}

function parseUpcomingSpecials(html: string): ScheduleSpecial[] {
  const anchors = [
    'Upcoming WTRL TTT Specials',
    'Upcoming TTT Specials',
    'TTT Specials',
  ];
  const startAt = anchors
    .map((anchor) => html.indexOf(anchor))
    .find((index) => index >= 0);

  // HTML構造変更時でも拾えるよう、アンカーが見つからない場合はページ全体を対象にする
  const sliced = startAt === undefined ? html : html.slice(startAt, startAt + 20000);
  // 改行の少ない（圧縮された）HTMLでも行単位で抽出できるよう、
  // 区切りになりやすいタグを先に改行へ変換する
  const preNormalized = sliced
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<\/(?:td|th)>/gi, ' ');

  const rows = preNormalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, '\'')
      .replace(/\s+/g, ' ')
      .trim())
    .filter(Boolean);

  const results: ScheduleSpecial[] = [];
  const pattern = /^((?:\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})|(?:[A-Za-z]+\s+\d{1,2}(?:,)?\s+\d{4})|(?:\d{4}-\d{2}-\d{2}))\s*[-–—:]\s*(.+)$/i;

  const seen = new Set<string>();

  const collect = (row: string) => {
    const matched = row.match(pattern);
    if (!matched) return;

    const normalized = `${matched[1]}::${matched[2]}`.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);

    results.push({
      date: matched[1],
      title: matched[2],
      raw: row,
    });
  };

  // まずは行単位抽出
  for (const row of rows) collect(row);

  // 行単位で拾えなかったケース向け: 1行に複数イベントが入る場合のフォールバック
  if (results.length === 0) {
    const plain = preNormalized
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const globalPattern = new RegExp(
      String.raw`((?:\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})|(?:[A-Za-z]+\s+\d{1,2}(?:,)?\s+\d{4})|(?:\d{4}-\d{2}-\d{2}))\s*[-–—:]\s*([^<]{3,120}?)(?=(?:\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})|(?:[A-Za-z]+\s+\d{1,2}(?:,)?\s+\d{4})|(?:\d{4}-\d{2}-\d{2})|$)`,
      'gi'
    );
    let matched: RegExpExecArray | null;
    while ((matched = globalPattern.exec(plain)) !== null) {
      collect(`${matched[1]} - ${matched[2].trim()}`);
    }
  }

  return results.slice(0, 12);
}

export async function getWtrlSchedule(_request: Request, _env: Env): Promise<Response> {
  try {
    const upstream = await fetch(WTRL_TTT_URL, {
      headers: {
        // 一部サイトは非ブラウザUAをブロック/簡略化するため、一般的なUAを使う
        'User-Agent': 'Mozilla/5.0 (compatible; TTT-Calculator/1.0; +https://github.com/)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
      }
    });

    if (!upstream.ok) {
      return serverError(`Failed to fetch WTRL schedule (${upstream.status})`);
    }

    const html = await upstream.text();
    const specials = parseUpcomingSpecials(html);

    return ok({
      source_url: WTRL_TTT_URL,
      fetched_at: new Date().toISOString(),
      specials,
      has_data: specials.length > 0,
    });
  } catch (err) {
    console.error('WTRL schedule fetch error', err);
    return serverError('Failed to fetch WTRL schedule');
  }
}
