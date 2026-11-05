import { normalize, type SearchEntry } from './countrySearch';
import { searchTopics, type TopicHit } from './topicSearch';

/**
 * 指令面板的組合搜尋（2026-11-05，參5，參考 tickerkarte 的搜尋把地點、時間拆成篩選條件）：
 * 「日本 2010 人口」「人口日本2010年」「japan 2010 population」拆成年份、國家與主題，面板最上面多一個
 * 「人口 · 日本 · 2010 年」，選了一次打開主題、選取國家、跳到那一年。
 * - 年份：1500–2100 的四位數（後面可以有「年」）
 * - 國家：國名（繁中、英文、別名，跟搜尋框同一份 countrySearch 的索引）。中文不必空格，找最長的那一個；
 *   英文要是完整的字（「india」不會比對到「indiana」）
 * - 主題：剩下的字照一般的主題搜尋（topicSearch），比對不到就不給組合（剩下的字不知道是什麼）
 * 只有國家沒有年份、也沒有主題時不給（一般的國家搜尋就是）；只有年份時是目前的主題跳到那一年。
 */
export interface ComboQuery {
  /** 主題、指標或子項目；null 是目前的主題 */
  topic: TopicHit | null;
  iso3: string | null;
  year: number | null;
}

const YEAR = /(^|\D)(1[5-9]\d\d|20\d\d|2100)(\s*年)?(?=\D|$)/;

/** 國家：最長的國名（同長時權重高的：繁中 > 英文 > 別名）與拿掉它之後剩下的字 */
function findCountry(text: string, index: SearchEntry[]): { iso3: string; rest: string } | null {
  const spaced = normalize(text);
  const compact = spaced.replace(/ /g, '');
  const padded = ` ${spaced} `;
  let best: { iso3: string; len: number; weight: number; rest: string } | null = null;
  for (const entry of index) {
    for (const key of entry.keys) {
      const len = key.compact.length;
      if (best && (len < best.len || (len === best.len && key.weight <= best.weight))) continue;
      if (key.latin) {
        // 英文：依字的起點還原成有空格的名稱，前後都要是字的邊界
        if (len < 3) continue;
        const words = key.starts.map((s, i) => key.compact.slice(s, key.starts[i + 1] ?? len)).join(' ');
        const at = padded.indexOf(` ${words} `);
        if (at < 0) continue;
        best = { iso3: entry.iso3, len, weight: key.weight, rest: `${padded.slice(0, at)} ${padded.slice(at + words.length + 2)}` };
      } else {
        if (len < 2) continue;
        const at = compact.indexOf(key.compact);
        if (at < 0) continue;
        best = { iso3: entry.iso3, len, weight: key.weight, rest: compact.slice(0, at) + ' ' + compact.slice(at + len) };
      }
    }
  }
  return best && { iso3: best.iso3, rest: best.rest.replace(/\s+/g, ' ').trim() };
}

export function parseCombo(query: string, index: SearchEntry[]): ComboQuery | null {
  let text = query;
  let year: number | null = null;
  const m = YEAR.exec(text);
  if (m) {
    year = Number(m[2]);
    text = text.slice(0, m.index) + m[1] + ' ' + text.slice(m.index + m[0].length);
  }
  const country = findCountry(text, index);
  const rest = (country ? country.rest : normalize(text)).replace(/^(的|在|之)|(的|在|之)$/g, '').trim();
  let topic: TopicHit | null = null;
  if (rest) {
    topic = searchTopics(rest, 1)[0] ?? null;
    if (!topic) return null;
  }
  if (year === null && !(country && topic)) return null;
  return { topic, iso3: country?.iso3 ?? null, year };
}
