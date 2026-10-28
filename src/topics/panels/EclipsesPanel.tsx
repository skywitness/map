import { useEffect, useMemo, useState } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { dateText, durationText, HISTORY_ANNULAR, HISTORY_TOTAL, KIND, KIND_COLORS, kindName, PATHS } from '../eclipses';
import type { PanelExtraProps } from '../types';

/**
 * pipeline/topics/eclipses.py 的 panel.json：
 * - eclipses：每次日食 [日期 YYYYMMDD, 類型, 沙羅週期, 食甚時中心線上的持續時間（秒）, 路徑寬度 km, 範圍 [西, 南, 東, 北]]，
 *   索引就是 paths.json 的組別 e
 * - countries：每國經過的日食 [日食編號, 這裡看到的（1 日環食、2 日全食、3 都有）, 這裡最長的持續時間（秒，估計）]
 */
type Eclipse = [number, number, number, number | null, number | null, [number, number, number, number] | null];
interface PanelData {
  eclipses: Eclipse[];
  countries: Record<string, [number, number, number][]>;
}

const LOCAL_ANNULAR = 1;
const LOCAL_TOTAL = 2;
/** 經過的日食多的國家（俄羅斯、美國、南極洲…）先列下一次附近的這幾次，其他的收起來 */
const SHOWN = 12;

const TEXT = defineMessages({
  zh: {
    title: '經過這裡的日食（1900–2100 年）',
    summary: (total: number, annular: number) => `日全食 ${fixed(total, 0)} 次、日環食 ${fixed(annular, 0)} 次經過這裡的陸地。`,
    none: '1900–2100 年沒有日全食或日環食的路徑經過這裡的陸地，只看得到偏食。',
    nextTotal: '下一次日全食',
    lastTotal: '上一次日全食',
    noNext: '到 2100 年都沒有',
    noLast: '1900 年以來沒有',
    yearsAway: (n: number) => (n <= 0 ? '就在今年' : `距今 ${fixed(n, 0)} 年`),
    yearsAgo: (n: number) => (n <= 0 ? '今年' : `${fixed(n, 0)} 年前`),
    localTotal: '全食',
    localAnnular: '環食',
    localBoth: '全食與環食',
    hybridPart: (part: string) => `（這裡是${part}）`,
    longest: (d: string) => `這裡最長 ${d}`,
    next: '下一次',
    shownYear: '時間軸的這一年',
    showAll: (n: number) => `顯示全部 ${fixed(n, 0)} 次`,
    showFewer: '收起',
    note: '點一下：時間軸換到那一年，地圖標出那一次的路徑並移過去。「這裡最長」是這個國家境內的最長持續時間（沿路徑估計，誤差約幾秒）；「下一次」從今天算起。',
  },
  en: {
    title: 'Eclipses crossing the country (1900–2100)',
    summary: (total, annular) =>
      `${fixed(total, 0)} total and ${fixed(annular, 0)} annular ${total + annular === 1 ? 'eclipse crosses' : 'eclipses cross'} its land.`,
    none: 'No total or annular eclipse path crosses its land from 1900 to 2100; only partial eclipses are seen.',
    nextTotal: 'Next total eclipse',
    lastTotal: 'Last total eclipse',
    noNext: 'none through 2100',
    noLast: 'none since 1900',
    yearsAway: (n) => (n <= 0 ? 'this year' : `${fixed(n, 0)} ${n === 1 ? 'year' : 'years'} from now`),
    yearsAgo: (n) => (n <= 0 ? 'this year' : `${fixed(n, 0)} ${n === 1 ? 'year' : 'years'} ago`),
    localTotal: 'total',
    localAnnular: 'annular',
    localBoth: 'total and annular',
    hybridPart: (part) => ` (${part} here)`,
    longest: (d) => `up to ${d} here`,
    next: 'Next',
    shownYear: 'Year on the slider',
    showAll: (n) => `Show all ${fixed(n, 0)}`,
    showFewer: 'Show fewer',
    note: 'Click a row to jump the time slider to that year, highlight that path and move the map to it. “Up to … here” is the longest duration inside the country (estimated along the path, to within a few seconds); “Next” counts from today.',
  },
});

function todayYmd(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

export default function EclipsesPanel({ topic, indicator, iso3, year, highlightLine, focusBox, selectYear }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, loading } = useJson<PanelData>(`topics/${topic.id}/panel.json`);
  const [picked, setPicked] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const rows = data?.countries[iso3] ?? null;
  const today = useMemo(todayYmd, []);
  // 次數的指標畫的是累積的中心線（HISTORY），其他指標是那一年的路徑（PATHS）：標出的線要在畫面上那一層
  const overlay = indicator.id === 'total-count' ? HISTORY_TOTAL.id : indicator.id === 'annular-count' ? HISTORY_ANNULAR.id : PATHS.id;
  const cumulative = overlay !== PATHS.id;

  // 換國家：取消標出的路徑、收起清單
  useEffect(() => {
    setPicked(null);
    setAll(false);
    return () => highlightLine?.(overlay, null);
  }, [iso3, overlay, highlightLine]);
  // 時間軸換到別的年份：那一次的路徑不在地圖上了，取消標出
  useEffect(() => {
    if (picked === null || !data) return;
    const y = Math.floor(data.eclipses[picked][0] / 10000);
    if (cumulative ? y > year : y !== year) {
      setPicked(null);
      highlightLine?.(overlay, null);
    }
  }, [year, picked, data, overlay, cumulative, highlightLine]);

  if (loading) return <p className="empty">{t.loading}</p>;
  if (!data) return null;

  const list = rows ?? [];
  const totals = list.filter(([, local]) => local !== LOCAL_ANNULAR);
  const annulars = list.filter(([, local]) => local !== LOCAL_TOTAL);
  const dateOf = (e: number) => data.eclipses[e][0];
  const nextTotal = totals.find(([e]) => dateOf(e) >= today);
  const lastTotal = [...totals].reverse().find(([e]) => dateOf(e) < today);
  const nextAny = list.findIndex(([e]) => dateOf(e) >= today);
  const thisYear = Math.floor(today / 10000);

  // 多的時候先列下一次附近的（之前 3 次、之後 8 次左右）
  const start = list.length > SHOWN && !all ? Math.max(0, Math.min((nextAny < 0 ? list.length : nextAny) - 3, list.length - SHOWN)) : 0;
  const shown = list.length > SHOWN && !all ? list.slice(start, start + SHOWN) : list;

  const show = (e: number) => highlightLine?.(overlay, e);
  const restore = () => highlightLine?.(overlay, picked);
  const localText = (local: number) =>
    local === LOCAL_TOTAL ? text.localTotal : local === LOCAL_ANNULAR ? text.localAnnular : text.localBoth;

  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {list.length === 0 ? (
        <p className="note">{text.none}</p>
      ) : (
        <>
          <p className="eclipse-summary">{text.summary(totals.length, annulars.length)}</p>
          <dl className="eclipse-facts">
            <dt>{text.nextTotal}</dt>
            <dd>
              {nextTotal ? (
                <>
                  <strong>{dateText(dateOf(nextTotal[0]))}</strong> · {text.yearsAway(Math.floor(dateOf(nextTotal[0]) / 10000) - thisYear)}
                </>
              ) : (
                text.noNext
              )}
            </dd>
            <dt>{text.lastTotal}</dt>
            <dd>
              {lastTotal ? (
                <>
                  <strong>{dateText(dateOf(lastTotal[0]))}</strong> · {text.yearsAgo(thisYear - Math.floor(dateOf(lastTotal[0]) / 10000))}
                </>
              ) : (
                text.noLast
              )}
            </dd>
          </dl>
          <ol className="eclipse-list">
            {shown.map(([e, local, dur]) => {
              const [ymd, kind] = data.eclipses[e];
              const box = data.eclipses[e][5];
              const y = Math.floor(ymd / 10000);
              const isNext = list[nextAny]?.[0] === e;
              return (
                <li key={e}>
                  <button
                    type="button"
                    className={`eclipse-row${picked === e ? ' is-picked' : ''}${ymd < today ? ' is-past' : ''}`}
                    aria-pressed={picked === e}
                    onMouseEnter={() => show(e)}
                    onMouseLeave={restore}
                    onFocus={() => show(e)}
                    onBlur={restore}
                    onClick={() => {
                      setPicked(e);
                      selectYear?.(y);
                      show(e);
                      if (box) focusBox?.(box);
                    }}
                  >
                    <span className="bar-key" style={{ background: KIND_COLORS[kind].color }} />
                    <span className="eclipse-date">{dateText(ymd)}</span>
                    <span className="eclipse-kind">
                      {kindName(kind)}
                      {kind === KIND.hybrid && text.hybridPart(localText(local))}
                    </span>
                    <span className="stat-meta">
                      {dur > 0 && <span>{text.longest(durationText(dur))}</span>}
                      {isNext && <span className="year-tag">{text.next}</span>}
                      {y === year && <span className="year-tag is-shown">{text.shownYear}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {list.length > SHOWN && (
            <button type="button" className="eclipse-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? text.showFewer : text.showAll(list.length)}
            </button>
          )}
          <p className="note">{text.note}</p>
        </>
      )}
    </section>
  );
}
