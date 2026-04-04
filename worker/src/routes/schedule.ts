import { Env } from '../types';
import { ok, serverError } from '../response';

const WTRL_TTT_URL = 'https://www.wtrl.racing/ttt-home/#tttschedule';

interface ScheduleSpecial {
  date: string;
  title: string;
  raw: string;
}

function parseUpcomingSpecials(html: string): ScheduleSpecial[] {
  const anchor = 'Upcoming WTRL TTT Specials';
  const startAt = html.indexOf(anchor);
  if (startAt < 0) return [];

  const sliced = html.slice(startAt, startAt + 12000);
  const rows = sliced
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const results: ScheduleSpecial[] = [];
  const pattern = /^(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})\s*-\s*(.+)$/;

  for (const row of rows) {
    const matched = row.match(pattern);
    if (!matched) continue;

    results.push({
      date: matched[1],
      title: matched[2],
      raw: row,
    });
  }

  return results.slice(0, 12);
}

export async function getWtrlSchedule(_request: Request, _env: Env): Promise<Response> {
  try {
    const upstream = await fetch(WTRL_TTT_URL, {
      headers: {
        'User-Agent': 'TTT-Calculator/1.0 (+https://www.wtrl.racing/)',
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
