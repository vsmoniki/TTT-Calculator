import { Env } from '../types';
import { ok } from '../response';

const WTRL_TTT_URL = 'https://www.wtrl.racing/ttt-home/';
const WTRL_TTT_PUBLIC_URL = 'https://www.wtrl.racing/ttt-home/#tttschedule';
const WTRL_TTT_JINA_MIRROR_URL = 'https://r.jina.ai/http://www.wtrl.racing/ttt-home/';
const FETCH_TIMEOUT_MS = 12000;

interface ScheduleSpecial {
  date: string;
  title: string;
  raw: string;
}

interface FetchAttemptResult {
  html: string;
  fetchedFrom: string;
}

interface FetchAttemptError {
  candidate_url: string;
  message: string;
}

const DATE_HEAD_PATTERN = String.raw`(?:\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,}\s+\d{4}|\d{1,2}\s+[A-Za-z]{3,}(?:\s+\d{4})?|[A-Za-z]{3,}\s+\d{1,2}(?:,?\s+\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)`;

function stripTagsAndDecode(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
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
    .map(stripTagsAndDecode)
    .filter(Boolean);

  const results: ScheduleSpecial[] = [];
  const pattern = new RegExp(
    String.raw`^(${DATE_HEAD_PATTERN})\s*(?:[-–—:|]|(?:\s{2,}))\s*(.+)$`,
    'i'
  );

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
    const plain = stripTagsAndDecode(preNormalized);
    const globalPattern = new RegExp(
      String.raw`(${DATE_HEAD_PATTERN})\s*(?:[-–—:|]|(?:\s{2,}))\s*(.{3,120}?)(?=(?:${DATE_HEAD_PATTERN})|$)`,
      'gi'
    );
    let matched: RegExpExecArray | null;
    while ((matched = globalPattern.exec(plain)) !== null) {
      collect(`${matched[1]} - ${matched[2].trim()}`);
    }
  }

  return results.slice(0, 12);
}

async function fetchScheduleHtml(url: string): Promise<FetchAttemptResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!upstream.ok) {
      throw new Error(`upstream status ${upstream.status}`);
    }

    return {
      html: await upstream.text(),
      fetchedFrom: upstream.url || url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getWtrlSchedule(_request: Request, _env: Env): Promise<Response> {
  const errors: FetchAttemptError[] = [];
  const candidateUrls = [
    WTRL_TTT_URL,
    WTRL_TTT_PUBLIC_URL,
    WTRL_TTT_JINA_MIRROR_URL,
  ];

  for (const candidateUrl of candidateUrls) {
    try {
      const { html, fetchedFrom } = await fetchScheduleHtml(candidateUrl);
      const specials = parseUpcomingSpecials(html);
      const excerpt = stripTagsAndDecode(html).slice(0, 500);

      return ok({
        source_url: WTRL_TTT_PUBLIC_URL,
        fetched_from: fetchedFrom,
        fetched_at: new Date().toISOString(),
        specials,
        has_data: specials.length > 0,
        fetch_error: specials.length > 0
          ? null
          : 'WTRLページへの接続は成功しましたが、特別イベント情報を抽出できませんでした（0件）。',
        fetch_error_details: specials.length > 0
          ? undefined
          : [
            {
              candidate_url: fetchedFrom,
              message: 'ページ取得は成功しましたが、パーサーが日付-イベント形式の行を検出できませんでした。',
            },
            {
              candidate_url: fetchedFrom,
              message: `先頭プレビュー: ${excerpt || '(空文字)'}${excerpt.length >= 500 ? '…' : ''}`,
            },
          ],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({
        candidate_url: candidateUrl,
        message,
      });
      console.error('WTRL schedule fetch attempt failed', candidateUrl, err);
    }
  }

  const fetchError = `WTRL schedule fetch failed (${errors.map((entry) => `${entry.candidate_url}: ${entry.message}`).join(' | ')})`;

  return ok({
    source_url: WTRL_TTT_PUBLIC_URL,
    fetched_from: null,
    fetched_at: new Date().toISOString(),
    specials: [],
    has_data: false,
    fetch_error: fetchError,
    fetch_error_details: errors,
    support_request: [
      '手動更新を押した時刻（タイムゾーン付き）',
      '表示されているエラーメッセージ全文',
      '利用しているブラウザ名とバージョン',
      '必要ならDevToolsのNetworkタブで /schedule/wtrl-ttt のレスポンス内容',
    ],
  });
}
