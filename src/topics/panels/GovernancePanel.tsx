import { useMemo } from 'react';
import type { LineSeriesOption } from 'echarts/charts';
import { EChart, escapeHtml, type ChartOption } from '../../charts/EChart';
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
  option: ChartOption;
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
): ChartOption {
  const at = (i: number) => years[i];
  const idx = own.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0);
  // 從這個國家第一筆畫到最後一筆；中間沒有資料的年份是 null，線在那裡斷開（不會把空白的年份連起來）
  const span = years.map((_y, i) => i).filter((i) => i >= idx[0] && i <= idx[idx.length - 1]);
  const pairs = (series: (number | null)[]) =>
    span.map((i) => [at(i), own[i] == null ? null : (series[i] ?? null)] as [number, number | null]);
  const hasBand = (i: number) => own[i] != null && low[i] != null && high[i] != null;
  const base: LineSeriesOption = {
    type: 'line',
    showSymbol: false,
    symbol: 'none',
    emphasis: { disabled: true },
    silent: true,
  };
  const series: LineSeriesOption[] = [
    {
      ...base,
      name: '_low',
      stack: 'interval',
      data: span.map((i) => [at(i), hasBand(i) ? low[i] : null]),
      lineStyle: { opacity: 0 },
    },
    {
      ...base,
      name: names.interval,
      stack: 'interval',
      data: span.map((i) => [at(i), hasBand(i) ? high[i]! - low[i]! : null]),
      lineStyle: { opacity: 0 },
      areaStyle: { color: tokens.accent, opacity: bandOpacity(tokens) },
    },
    {
      ...base,
      name: names.median,
      data: pairs(median),
      lineStyle: { width: 1.5, color: tokens.context, type: [4, 3] },
      color: tokens.context,
    },
    {
      ...base,
      name: names.country,
      data: span.map((i) => [at(i), own[i]]),
      lineStyle: { width: 2, color: tokens.accent },
      color: tokens.accent,
      markLine: {
        silent: true,
        symbol: 'none',
        label: { show: false },
        lineStyle: { color: tokens.inkMuted, type: 'solid', width: 1 },
        data: [{ xAxis: year }],
      },
    },
  ];
  const first = years[idx[0]];
  const last = years[idx[idx.length - 1]];
  const byYear = new Map(idx.map((i) => [at(i), i]));
  return {
    animation: false,
    grid: { left: 4, right: 8, top: 8, bottom: 4, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: tokens.axis, width: 1 } },
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      textStyle: { color: tokens.ink, fontSize: 12 },
      extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.12); border-radius: 6px;',
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const value = (list[0] as { value?: [number, number] }).value;
        const i = value ? byYear.get(value[0]) : undefined;
        if (i === undefined || own[i] == null) return '';
        const row = (color: string, text: string, name: string) =>
          `<div class="tt-row"><span class="tt-key" style="background:${color}"></span>` +
          `<strong>${escapeHtml(text)}</strong><span class="tt-name">${escapeHtml(name)}</span></div>`;
        const interval = low[i] != null && high[i] != null ? names.range(score(low[i]!), score(high[i]!)) : '';
        return (
          `<div class="tt-head">${years[i]}</div>` +
          row(tokens.accent, `${score(own[i]!)}${interval}`, names.country) +
          (median[i] != null ? row(tokens.context, score(median[i]!), names.median) : '')
        );
      },
    },
    xAxis: {
      type: 'value',
      min: first,
      max: last,
      // 每年一個刻度，只在 10 的倍數寫字（跨度短的國家改成每 5 年或 2 年：南蘇丹 2011 年起、法屬玻里尼西亞只有近幾年）
      interval: 1,
      axisLine: { lineStyle: { color: tokens.axis } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: tokens.inkMuted,
        fontSize: 10,
        showMinLabel: false,
        showMaxLabel: false,
        formatter: (v: number) => (v % (last - first > 15 ? 10 : last - first > 6 ? 5 : 2) === 0 ? String(v) : ''),
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      interval: 50,
      splitLine: { lineStyle: { color: tokens.grid, width: 1 } },
      axisLabel: { color: tokens.inkMuted, fontSize: 10 },
    },
    series,
  };
}

/** 分數在 0–100 的位置（%） */
const pct = (v: number) => `${Math.min(100, Math.max(0, v))}%`;

function DimensionTrack({ row, tokens }: { row: Row; tokens: Tokens }) {
  return (
    <div className="gov-track" aria-hidden="true">
      <span className="gov-track-line" />
      {row.low != null && row.high != null && (
        <span
          className="gov-ci"
          style={{ left: pct(row.low), width: pct(row.high - row.low), background: tokens.accent, opacity: bandOpacity(tokens) }}
        />
      )}
      {row.median != null && <span className="gov-median" style={{ left: pct(row.median), background: tokens.context }} />}
      <span className="gov-dot" style={{ left: pct(row.score), background: tokens.accent }} />
    </div>
  );
}

export default function GovernancePanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
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
                <EChart option={trend.option} height={110} ariaLabel={text.chartAria(countryName, trend.label)} />
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
function Legend({ tokens, lang, first, line = false }: { tokens: Tokens; lang: Lang; first: string; line?: boolean }) {
  const text = TEXT[lang];
  return (
    <div className="gov-legend" aria-hidden="true">
      <span>
        <span className={line ? 'gov-key-line' : 'gov-key-dot'} style={{ background: tokens.accent }} />
        {first}
      </span>
      <span>
        <span className="gov-key-band" style={{ background: tokens.accent, opacity: bandOpacity(tokens) }} />
        {text.keyInterval}
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
