import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Lang, type Text } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Tokens } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

/** 六個面向（id 跟 governance.ts 的指標、pipeline/topics/governance.py 的 DIMENSIONS 一致），WGI 自己的順序 */
const DIMENSIONS: { id: string; label: Text }[] = [
  { id: 'voice', label: { zh: '發聲與課責', en: 'Voice and accountability' } },
  { id: 'stability', label: { zh: '政治穩定', en: 'Political stability' } },
  { id: 'effectiveness', label: { zh: '政府效能', en: 'Government effectiveness' } },
  { id: 'regulatory', label: { zh: '法規品質', en: 'Regulatory quality' } },
  { id: 'rule-of-law', label: { zh: '法治', en: 'Rule of law' } },
  { id: 'corruption', label: { zh: '貪腐控制', en: 'Control of corruption' } },
];

/**
 * countries/<ISO3>.json：每個面向的 90% 信賴區間（lb、ub）、估計值（est）、估計值的標準誤（se）與資料來源數（n），
 * 鍵是「面向.欄位」，跟 years 對齊（差分編碼，fetchJson 會還原）
 */
interface DetailFile {
  iso3: string;
  years: number[];
  values: Record<string, (number | null)[]>;
}

const TEXT = defineMessages({
  zh: {
    title: (year: number) => `六個面向（${year} 年）`,
    shownInstead: (year: number, shown: number) => `${year} 年沒有資料，顯示 ${shown} 年。`,
    interval: (low: string, high: string) => `（${low}–${high}）`,
    median: (v: string) => `世界中位數 ${v}`,
    rowAria: (label: string, score: string, low: string, high: string, median: string) =>
      `${label} ${score} 分，90% 信賴區間 ${low} 到 ${high}，世界中位數 ${median}`,
    keyScore: '分數',
    keyInterval: '90% 信賴區間',
    keyMedian: '世界中位數',
    tableCaption: (country: string, year: number) => `${country} ${year} 年 WGI 六個面向的估計值、標準誤與資料來源數`,
    colDimension: '面向',
    colEstimate: '估計值 ± 標準誤',
    colSources: '來源數',
    estimateNote:
      '估計值是統計模型的原始結果（標準常態的單位，約 −2.5 到 2.5，0 大約是各經濟體的平均），分數是它的線性換算。資料來源少的經濟體標準誤大、區間寬；區間重疊的經濟體，高低不一定有意義。',
    trendTitle: '歷年變化',
    chartAria: (country: string, label: string) => `${country}歷年的 WGI ${label}分數、90% 信賴區間與世界中位數`,
    medianNote: '世界中位數是當年有資料的經濟體的中位數（每個經濟體一樣重）；1996–2002 年每兩年一次，之後每年。',
  },
  en: {
    title: (year) => `Six dimensions (${year})`,
    shownInstead: (year, shown) => `No data for ${year}; showing ${shown}.`,
    interval: (low, high) => ` (${low}–${high})`,
    median: (v) => `world median ${v}`,
    rowAria: (label, score, low, high, median) =>
      `${label}: ${score}, 90% confidence interval ${low} to ${high}, world median ${median}`,
    keyScore: 'Score',
    keyInterval: '90% confidence interval',
    keyMedian: 'World median',
    tableCaption: (country, year) => `WGI estimates, standard errors and number of sources for ${country}, ${year}`,
    colDimension: 'Dimension',
    colEstimate: 'Estimate ± SE',
    colSources: 'Sources',
    estimateNote:
      'The estimate is the raw output of the statistical model (in standard normal units, roughly −2.5 to 2.5, with 0 near the average economy); the score is a linear transformation of it. Economies with few sources have larger standard errors and wider intervals; where intervals overlap, economies may not really differ.',
    trendTitle: 'Over time',
    chartAria: (country, label) => `WGI ${label.toLowerCase()} score for ${country} over time, with the 90% confidence interval and the world median`,
    medianNote: 'The world median is the median of economies with data that year (each economy counts equally). Data are every two years in 1996–2002 and annual after that.',
  },
});

const score = (v: number) => fixed(v, 1);

/**
 * 分數的範圍與寫法：WGI 是 0–100、小數一位；V-Dem 的指數是 0–1、小數兩位（2026-11-05 加的行政權制衡）；
 * 宗教主題的 V-Dem 估計值（2026-11-07）是 −4 到 +4 的區間尺度，min、ticks 另外給
 */
export interface Scale {
  min?: number;
  max: number;
  format: (v: number) => string;
  /** y 軸與點圖下方的刻度，沒寫是 0、一半、max */
  ticks?: number[];
}
const scaleTicks = (scale: Scale) => scale.ticks ?? [0, scale.max / 2, scale.max];
const WGI: Scale = { max: 100, format: score };
const VDEM: Scale = { max: 1, format: (v) => fixed(v, 2) };
/** 估計值寫正負號：+1.20、−0.35 */
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fixed(Math.abs(v), 2)}`;

/** 信賴區間色帶的不透明度：深色背景上同樣的透明度幾乎看不見 */
const bandOpacity = (tokens: Tokens) => (tokens.mode === 'dark' ? 0.42 : 0.22);

interface Row {
  id: string;
  label: string;
  score: number;
  low: number | null;
  high: number | null;
  median: number | null;
  estimate: number | null;
  se: number | null;
  sources: number | null;
}

interface Trend {
  id: string;
  label: string;
  option: ChartSpec;
}

/**
 * 一個面向的小圖：國家的分數（實線）、90% 信賴區間（淡色帶）與世界中位數（虛線），y 軸固定 0–100。
 * x 軸用數值軸（年份），1996、1998、2000 年的兩年間隔才不會畫得跟一年一樣寬；WGI 有的年份裡這個國家沒有值的放 null，線在那裡斷開。
 * 信賴區間用兩條堆疊的線畫：下限（不填色）＋ 上限減下限（填色）。數值軸的堆疊依資料的順序，兩條的年份一樣。
 */
function trendOption(
  years: number[],
  own: (number | null)[],
  low: (number | null)[],
  high: (number | null)[],
  median: (number | null)[],
  year: number,
  tokens: Tokens,
  names: { country: string; interval: string; median: string; range: (low: string, high: string) => string },
  scale: Scale = WGI,
): ChartSpec {
  const score = scale.format;
  const idx = own.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0);
  // 從這個國家第一筆畫到最後一筆；中間沒有資料的年份是 null，線在那裡斷開（不會把空白的年份連起來）
  const span = years.map((_y, i) => i).filter((i) => i >= idx[0] && i <= idx[idx.length - 1]);
  const xs = span.map((i) => years[i]);
  const pick = (series: (number | null)[]) => span.map((i) => (own[i] == null ? null : (series[i] ?? null)));
  const first = years[idx[0]];
  const last = years[idx[idx.length - 1]];
  // 只在 10 的倍數寫字（跨度短的國家改成每 5 年或 2 年：南蘇丹 2011 年起、法屬玻里尼西亞只有近幾年），頭尾不寫；
  // 宗教主題從 1789 年起，超過 150 年的改成每 50 年
  const step = last - first > 150 ? 50 : last - first > 15 ? 10 : last - first > 6 ? 5 : 2;
  const ticks = xs.filter((y) => y % step === 0 && y !== first && y !== last);
  const byYear = new Map(idx.map((i) => [years[i], i]));
  return {
    x: { type: 'value', min: first, max: last, ticks },
    y: { format: (v) => (v < 0 ? `−${-v}` : String(v)), min: scale.min ?? 0, max: scale.max, ticks: scaleTicks(scale) },
    series: [
      { type: 'band', name: names.interval, low: pick(low), high: pick(high), xs, color: tokens.accent, opacity: bandOpacity(tokens), legend: false },
      { type: 'line', name: names.median, values: pick(median), xs, color: tokens.context, width: 1.5, dashed: true, legend: false },
      { type: 'line', name: names.country, values: span.map((i) => own[i]), xs, color: tokens.accent, legend: false },
    ],
    refs: year >= first && year <= last ? [{ x: year }] : [],
    tooltipXs: idx.map((i) => years[i]),
    tooltip: (y) => {
      const i = byYear.get(y);
      if (i === undefined || own[i] == null) return null;
      const interval = low[i] != null && high[i] != null ? names.range(score(low[i]!), score(high[i]!)) : '';
      return {
        head: String(years[i]),
        rows: [
          { color: tokens.accent, value: `${score(own[i]!)}${interval}`, name: names.country },
          ...(median[i] != null ? [{ color: tokens.context, value: score(median[i]!), name: names.median }] : []),
        ],
      };
    },
  };
}

/** 分數在 min–max 的位置（%） */
const pctOf = (v: number, max: number, min = 0) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`;
const pct = (v: number) => pctOf(v, 100);

function DimensionTrack({ row, tokens, max = 100, min = 0 }: { row: Row; tokens: Tokens; max?: number; min?: number }) {
  const pct = (v: number) => pctOf(v, max, min);
  return (
    <div className="gov-track" aria-hidden="true">
      <span className="gov-track-line" />
      {row.low != null && row.high != null && (
        <span
          className="gov-ci"
          style={{ left: pct(row.low), width: pctOf(row.high - row.low + min, max, min), background: tokens.accent, opacity: bandOpacity(tokens) }}
        />
      )}
      {row.median != null && <span className="gov-median" style={{ left: pct(row.median), background: tokens.context }} />}
      <span className="gov-dot" style={{ left: pct(row.score), background: tokens.accent }} />
    </div>
  );
}

export default function GovernancePanel(props: PanelExtraProps) {
  return VDEM_INDICES.some((d) => d.id === props.indicator.id) ? (
    <VdemIndices {...props} indices={VDEM_INDICES} text={VDEM_TEXT} scale={VDEM} />
  ) : (
    <WgiPanel {...props} />
  );
}

function WgiPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useMemo(() => DIMENSIONS.map((d) => `topics/${topic.id}/${d.id}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(files);
  const ready = loaded.every(Boolean);
  const covered = ready && loaded.some((d) => d!.values[iso3]);
  const detail = useJson<DetailFile>(covered ? `topics/${topic.id}/countries/${iso3}.json` : null);
  const details = detail.data?.iso3 === iso3 ? detail.data : null;

  const view = useMemo(() => {
    if (!ready || !covered) return null;
    const data = loaded as IndicatorData[];
    const years = data[0].years;
    const at = latestIndexAtOrBefore(years, year, (i) => data.some((d) => d.values[iso3]?.[i] != null));
    if (at < 0) return null;
    const get = (id: string, key: string, i: number) => details?.values[`${id}.${key}`]?.[i] ?? null;
    const rows: Row[] = DIMENSIONS.flatMap((dim, k) => {
      const v = data[k].values[iso3]?.[at];
      if (v == null) return [];
      return [
        {
          id: dim.id,
          label: tr(dim.label, lang),
          score: v,
          low: get(dim.id, 'lb', at),
          high: get(dim.id, 'ub', at),
          median: data[k].aggregates?.MEDIAN?.[at] ?? null,
          estimate: get(dim.id, 'est', at),
          se: get(dim.id, 'se', at),
          sources: get(dim.id, 'n', at),
        },
      ];
    });
    const trends: Trend[] = DIMENSIONS.flatMap((dim, k) => {
      const own = data[k].values[iso3];
      if (!own?.some((v) => v != null) || !details) return [];
      const label = tr(dim.label, lang);
      const series = (key: string) => details.values[`${dim.id}.${key}`] ?? years.map(() => null);
      return [
        {
          id: dim.id,
          label,
          option: trendOption(years, own, series('lb'), series('ub'), data[k].aggregates?.MEDIAN ?? [], year, tokens, {
            country: countryName,
            interval: text.keyInterval,
            median: text.keyMedian,
            range: text.interval,
          }),
        },
      ];
    });
    return { shown: years[at], rows, trends };
  }, [ready, covered, loaded, details, iso3, year, lang, tokens, countryName, text]);

  if (!ready) return <p className="empty">{t.loading}</p>;
  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title(view.shown)}</h3>
      {view.shown !== year && <p className="note">{text.shownInstead(year, view.shown)}</p>}
      <ul className="gov-dims">
        {view.rows.map((r) => (
          <li
            key={r.id}
            className="gov-dim"
            aria-label={text.rowAria(
              r.label,
              score(r.score),
              r.low == null ? '—' : score(r.low),
              r.high == null ? '—' : score(r.high),
              r.median == null ? '—' : score(r.median),
            )}
          >
            <div className="gov-dim-head">
              <span>{r.label}</span>
              <span>
                <strong>{score(r.score)}</strong>
                {r.low != null && r.high != null && (
                  <span className="gov-muted">{text.interval(score(r.low), score(r.high))}</span>
                )}
              </span>
            </div>
            <DimensionTrack row={r} tokens={tokens} />
            {r.median != null && <div className="gov-median-text">{text.median(score(r.median))}</div>}
          </li>
        ))}
      </ul>
      <div className="gov-scale" aria-hidden="true">
        {[0, 50, 100].map((v) => (
          <span key={v} style={{ left: pct(v) }}>
            {v}
          </span>
        ))}
      </div>
      <Legend tokens={tokens} lang={lang} first={text.keyScore} />
      {details && (
        <>
          <table className="mini-table gov-table" aria-label={text.tableCaption(countryName, view.shown)}>
            <thead>
              <tr>
                <th scope="col">{text.colDimension}</th>
                <th scope="col" className="num">
                  {text.colEstimate}
                </th>
                <th scope="col" className="num">
                  {text.colSources}
                </th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.label}</th>
                  <td className="num">
                    {r.estimate == null ? '—' : `${signed(r.estimate)}${r.se == null ? '' : ` ± ${fixed(r.se, 2)}`}`}
                  </td>
                  <td className="num">{r.sources ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.estimateNote}</p>
        </>
      )}
      {view.trends.length > 0 && (
        <>
          <h4>{text.trendTitle}</h4>
          <Legend tokens={tokens} lang={lang} first={countryName} line />
          <div className="gov-multiples">
            {view.trends.map((trend) => (
              <div key={trend.id}>
                <h5>{trend.label}</h5>
                <Chart spec={trend.option} height={110} ariaLabel={text.chartAria(countryName, trend.label)} />
              </div>
            ))}
          </div>
          <p className="note">{text.medianNote}</p>
        </>
      )}
    </section>
  );
}

/** 點圖與小圖共用的圖例：分數（點）或國家（實線）、90% 信賴區間（色帶）、世界中位數（短線或虛線） */
function Legend({
  tokens,
  lang,
  first,
  line = false,
  interval,
}: {
  tokens: Tokens;
  lang: Lang;
  first: string;
  line?: boolean;
  /** 區間的名稱（預設是 WGI 的 90% 信賴區間） */
  interval?: string;
}) {
  const text = TEXT[lang];
  return (
    <div className="gov-legend" aria-hidden="true">
      <span>
        <span className={line ? 'gov-key-line' : 'gov-key-dot'} style={{ background: tokens.accent }} />
        {first}
      </span>
      <span>
        <span className="gov-key-band" style={{ background: tokens.accent, opacity: bandOpacity(tokens) }} />
        {interval ?? text.keyInterval}
      </span>
      <span>
        <span
          className={line ? 'gov-key-dash' : 'gov-key-tick'}
          style={line ? { borderColor: tokens.context } : { background: tokens.context }}
        />
        {text.keyMedian}
      </span>
    </div>
  );
}

/** 一項 V-Dem 指標：id 是指標檔的名稱（topics/<主題>/<id>.json，有區間的另有 intervals/<id>-low、-high.json） */
export interface VdemIndex {
  id: string;
  label: Text;
  interval: boolean;
}

/** V-Dem 區段的文字（行政權制衡、宗教自由各一組） */
export type VdemText = Record<
  Lang,
  {
    title: (year: number) => string;
    interval: string;
    note: string;
    chartAria: (country: string, label: string) => string;
    rowAria: (label: string, value: string, low: string, high: string, median: string) => string;
  }
>;

/** V-Dem 的行政權制衡（id 跟 governance.ts、pipeline/topics/governance_vdem.py 一致）；地方分權沒有可信區間 */
const VDEM_INDICES: VdemIndex[] = [
  { id: 'judicial-constraints', label: { zh: '司法的制衡', en: 'Judicial constraints' }, interval: true },
  { id: 'legislative-constraints', label: { zh: '立法的制衡', en: 'Legislative constraints' }, interval: true },
  { id: 'division-of-power', label: { zh: '地方分權', en: 'Division of power' }, interval: false },
];

const VDEM_TEXT: VdemText = defineMessages({
  zh: {
    title: (year: number) => `行政權受到的制衡（${year} 年）`,
    interval: '68% 可信區間',
    note: 'V-Dem 的專家評分合成的估計值，0–1，越高制衡越強；區間重疊的國家，高低不一定有意義。地方分權 V-Dem 沒有給可信區間。世界中位數是當年有資料的國家的中位數。',
    chartAria: (country: string, label: string) => `${country}歷年的 V-Dem ${label}指數、68% 可信區間與世界中位數`,
    rowAria: (label: string, value: string, low: string, high: string, median: string) =>
      `${label} ${value}，68% 可信區間 ${low} 到 ${high}，世界中位數 ${median}`,
  },
  en: {
    title: (year) => `Constraints on the executive (${year})`,
    interval: '68% credible interval',
    note: 'Estimates combining V-Dem expert ratings, 0–1, higher means stronger constraints; where intervals overlap, countries may not really differ. V-Dem gives no credible interval for division of power. The world median is the median of countries with data that year.',
    chartAria: (country, label) => `V-Dem ${label.toLowerCase()} index for ${country} over time, with the 68% credible interval and the world median`,
    rowAria: (label, value, low, high, median) =>
      `${label}: ${value}, 68% credible interval ${low} to ${high}, world median ${median}`,
  },
});

/**
 * 幾項 V-Dem 指數：點圖（這一年的值、可信區間、世界中位數）加歷年的小圖，照 WGI 的做法、刻度照 scale。
 * 政府治理的行政權制衡（0–1）與宗教主題的宗教自由（−4 到 +4，ReligionPanel）共用
 */
export function VdemIndices({
  topic,
  iso3,
  year,
  countryName,
  tokens,
  indices,
  text: messages,
  scale,
}: PanelExtraProps & { indices: VdemIndex[]; text: VdemText; scale: Scale }) {
  const lang = useLang();
  const t = useT();
  const text = messages[lang];
  const files = useMemo(
    () =>
      indices.flatMap((d) =>
        d.interval
          ? [`topics/${topic.id}/${d.id}.json`, `topics/${topic.id}/intervals/${d.id}-low.json`, `topics/${topic.id}/intervals/${d.id}-high.json`]
          : [`topics/${topic.id}/${d.id}.json`],
      ),
    [topic.id, indices],
  );
  const loaded = useJsonMany<IndicatorData>(files);
  const ready = loaded.every(Boolean);

  const view = useMemo(() => {
    if (!ready) return null;
    // 每項指數在 loaded 裡的位置：估計值，有區間的再接下限、上限
    let k = 0;
    const sets = indices.map((d) => {
      const main = loaded[k++]!;
      const low = d.interval ? loaded[k++]! : null;
      const high = d.interval ? loaded[k++]! : null;
      return { d, main, low, high };
    });
    const years = sets[0].main.years;
    const at = latestIndexAtOrBefore(years, year, (i) => sets.some((x) => x.main.values[iso3]?.[i] != null));
    if (at < 0) return null;
    const empty = years.map(() => null);
    const rows: Row[] = sets.flatMap(({ d, main, low, high }) => {
      const v = main.values[iso3]?.[at];
      if (v == null) return [];
      return [
        {
          id: d.id,
          label: tr(d.label, lang),
          score: v,
          low: low?.values[iso3]?.[at] ?? null,
          high: high?.values[iso3]?.[at] ?? null,
          median: main.aggregates?.MEDIAN?.[at] ?? null,
          estimate: null,
          se: null,
          sources: null,
        },
      ];
    });
    const trends: Trend[] = sets.flatMap(({ d, main, low, high }) => {
      const own = main.values[iso3];
      if (!own?.some((v) => v != null)) return [];
      const label = tr(d.label, lang);
      return [
        {
          id: d.id,
          label,
          option: trendOption(
            years,
            own,
            low?.values[iso3] ?? empty,
            high?.values[iso3] ?? empty,
            main.aggregates?.MEDIAN ?? [],
            year,
            tokens,
            { country: countryName, interval: text.interval, median: TEXT[lang].keyMedian, range: TEXT[lang].interval },
            scale,
          ),
        },
      ];
    });
    return { shown: years[at], rows, trends };
  }, [ready, loaded, indices, iso3, year, lang, tokens, countryName, text, scale]);

  if (!ready) return <p className="empty">{t.loading}</p>;
  if (!view) return null;
  const f = scale.format;
  return (
    <section className="panel-section">
      <h3>{text.title(view.shown)}</h3>
      {view.shown !== year && <p className="note">{TEXT[lang].shownInstead(year, view.shown)}</p>}
      <ul className="gov-dims">
        {view.rows.map((r) => (
          <li
            key={r.id}
            className="gov-dim"
            aria-label={text.rowAria(
              r.label,
              f(r.score),
              r.low == null ? '—' : f(r.low),
              r.high == null ? '—' : f(r.high),
              r.median == null ? '—' : f(r.median),
            )}
          >
            <div className="gov-dim-head">
              <span>{r.label}</span>
              <span>
                <strong>{f(r.score)}</strong>
                {r.low != null && r.high != null && <span className="gov-muted">{TEXT[lang].interval(f(r.low), f(r.high))}</span>}
              </span>
            </div>
            <DimensionTrack row={r} tokens={tokens} max={scale.max} min={scale.min} />
            {r.median != null && <div className="gov-median-text">{TEXT[lang].median(f(r.median))}</div>}
          </li>
        ))}
      </ul>
      <div className="gov-scale" aria-hidden="true">
        {scaleTicks(scale).map((v) => (
          <span key={v} style={{ left: pctOf(v, scale.max, scale.min) }}>
            {v < 0 ? `−${-v}` : v}
          </span>
        ))}
      </div>
      <Legend tokens={tokens} lang={lang} first={TEXT[lang].keyScore} interval={text.interval} />
      {view.trends.length > 0 && (
        <>
          <h4>{TEXT[lang].trendTitle}</h4>
          <Legend tokens={tokens} lang={lang} first={countryName} line interval={text.interval} />
          <div className="gov-multiples">
            {view.trends.map((trend) => (
              <div key={trend.id}>
                <h5>{trend.label}</h5>
                <Chart spec={trend.option} height={110} ariaLabel={text.chartAria(countryName, trend.label)} />
              </div>
            ))}
          </div>
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
