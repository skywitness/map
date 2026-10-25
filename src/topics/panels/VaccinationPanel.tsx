import { useMemo } from 'react';
import { EChart, escapeHtml, type ChartOption } from '../../charts/EChart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import { HUE_ORDER, type Tokens } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * covid/<ISO3>.json（pipeline/topics/vaccination.py）：每個月月底的值，從 start（2020-01）起一個月一筆，結尾沒有值的月份去掉。
 * deaths 是通報的累計確診死亡、excess 是 The Economist 估計的累計超額死亡（都是每 10 萬人）；
 * vaccinated、fully 是至少打了一劑、完成基礎劑的人口比例（%）。台灣的 deaths 是疾管署通報的確診死亡（JHU 轉載，到 2023 年 2 月）。
 */
interface Timeline {
  start: string;
  deaths: (number | null)[];
  excess: (number | null)[];
  vaccinated: (number | null)[];
  fully: (number | null)[];
  /** 每年年底的超額死亡 95% 區間 [下限, 上限] */
  excessRange: Record<string, [number, number]>;
  /** 模型最後一筆：[日期, 估計, 下限, 上限] */
  excessLast?: [string, number, number, number];
  /** 台灣：衛福部死因統計每年死因是 COVID-19 的人數、疾管署通報的年底累計確診死亡、最後一筆 */
  certificates?: Record<string, number>;
  cecc?: Record<string, number>;
  ceccLast?: [string, number];
}

/** 接種率的折線：四種疫苗，顏色依類別色的固定順序 */
const COVERAGE = ['dtp3', 'mcv1', 'mcv2', 'hpv'] as const;
const EXCESS_LAST_YEAR = 2023;

const n1 = (v: number) => fixed(v, 1);
const pct = (v: number) => `${fixed(v, 1)}%`;
const count = (v: number) => fixed(v, 0);
/** 在呼叫當下讀目前的語言（ECharts 的 tooltip） */
const per100k = (v: number) => tr({ zh: `每 10 萬人 ${fixed(v, 1)} 人`, en: `${fixed(v, 1)} per 100,000` });

const TEXT = defineMessages({
  zh: {
    coverageTitle: '兒童常規疫苗的接種率',
    coverageLines: ['DTP3', '麻疹第一劑', '麻疹第二劑', 'HPV（女孩第一劑）'],
    coverageAria: (country: string) => `${country}歷年的兒童常規疫苗接種率`,
    coverageSummary: (year: number, parts: string[]) => `${year} 年：${parts.join('、')}。`,
    twCoverage: '台灣是疾管署公布的五合一疫苗第三劑與 MMR 第一劑完成率（2015 年起）。',
    deathsTitle: 'COVID-19 死亡（累計，每 10 萬人）',
    confirmed: '通報的確診死亡',
    confirmedTw: '疾管署通報的確診死亡',
    excess: '超額死亡（估計）',
    deathsAria: (country: string) => `${country}每個月的累計 COVID-19 確診死亡與估計的超額死亡`,
    deathsSummary: (year: number, confirmed: string | null, excess: string | null, range: string | null) =>
      `到 ${year} 年底：` +
      [confirmed && `通報的確診死亡每 10 萬人 ${confirmed} 人`, excess && `估計的超額死亡 ${excess} 人${range ? `（95% 區間 ${range}）` : ''}`]
        .filter(Boolean)
        .join('；') +
      '。',
    excessLater: (date: string, value: string, range: string | null) =>
      `超額死亡的模型到 ${date}：每 10 萬人 ${value} 人${range ? `（95% 區間 ${range}）` : ''}。`,
    deathsNote:
      '確診死亡取決於檢驗與通報，超額死亡是全部死亡比沒有疫情時多出的部分（含沒有確診的 COVID-19 死亡與間接影響），兩條線差得越多，表示確診的數字越可能低估。有全死因死亡統計的國家，超額死亡的區間很窄。',
    vaccTitle: 'COVID-19 疫苗接種（占人口）',
    vaccinated: '至少一劑',
    fully: '完成基礎劑',
    vaccAria: (country: string) => `${country}每個月 COVID-19 疫苗接種的人口比例`,
    vaccSummary: (month: string, first: string | null, full: string | null) =>
      `${month}：` + [first && `至少一劑 ${first}`, full && `完成基礎劑 ${full}`].filter(Boolean).join('、') + '。',
    twTitle: '台灣的 COVID-19 死亡',
    twCaption: '台灣每年的 COVID-19 死亡：衛福部死因統計與疾管署通報的確診死亡',
    colYear: '年',
    colCert: '死因統計',
    colCertCum: '累計',
    colCecc: '疾管署通報（年底累計）',
    twNote: (date: string, n: string) =>
      '死因統計是衛福部依死亡證明書統計、死因是 COVID-19（ICD-10 U07）的人數，地圖上台灣的確診死亡用這一欄的累計。' +
      `疾管署（中央流行疫情指揮中心）每天公布的確診死亡到 ${date}（${n} 人），2023 年 3 月 20 日起只通報併發重症，沒有可以接下去的年底數字。` +
      'WHO 的資料沒有單獨列出台灣，台灣通報的確診死亡含在 WHO 的「中國」數字裡。',
    month: (m: string) => `${m.slice(0, 4)} 年 ${Number(m.slice(5))} 月`,
  },
  en: {
    coverageTitle: 'Routine childhood vaccine coverage',
    coverageLines: ['DTP3', 'Measles, 1st dose', 'Measles, 2nd dose', 'HPV, girls (1st dose)'],
    coverageAria: (country) => `Routine childhood vaccine coverage in ${country} over time`,
    coverageSummary: (year, parts) => `${year}: ${parts.join(', ')}.`,
    twCoverage: 'Taiwan shows Taiwan CDC’s completion rates for the third five-in-one dose and the first MMR dose (since 2015).',
    deathsTitle: 'COVID-19 deaths (cumulative, per 100,000)',
    confirmed: 'Confirmed deaths reported',
    confirmedTw: 'Confirmed deaths (Taiwan CDC)',
    excess: 'Excess deaths (estimate)',
    deathsAria: (country) => `Cumulative confirmed COVID-19 deaths and estimated excess deaths in ${country} by month`,
    deathsSummary: (year, confirmed, excess, range) =>
      `By the end of ${year}: ` +
      [confirmed && `${confirmed} confirmed deaths per 100,000`, excess && `${excess} estimated excess deaths${range ? ` (95% range ${range})` : ''}`]
        .filter(Boolean)
        .join('; ') +
      '.',
    excessLater: (date, value, range) => `The excess death model runs to ${date}: ${value} per 100,000${range ? ` (95% range ${range})` : ''}.`,
    deathsNote:
      'Confirmed deaths depend on testing and reporting; excess deaths are all deaths above what would have been expected without the pandemic (including unconfirmed COVID-19 deaths and indirect effects). The wider the gap between the lines, the more likely confirmed deaths are an undercount. Where all-cause deaths are reported, the excess death range is narrow.',
    vaccTitle: 'COVID-19 vaccination (share of population)',
    vaccinated: 'At least one dose',
    fully: 'Primary series',
    vaccAria: (country) => `Share of the population vaccinated against COVID-19 in ${country} by month`,
    vaccSummary: (month, first, full) =>
      `${month}: ` + [first && `${first} with at least one dose`, full && `${full} completed the primary series`].filter(Boolean).join(', ') + '.',
    twTitle: 'COVID-19 deaths in Taiwan',
    twCaption: 'COVID-19 deaths in Taiwan by year: cause-of-death statistics and confirmed deaths reported by Taiwan CDC',
    colYear: 'Year',
    colCert: 'Death certificates',
    colCertCum: 'Cumulative',
    colCecc: 'Taiwan CDC (cumulative)',
    twNote: (date, n) =>
      'Death certificates are Ministry of Health and Welfare cause-of-death statistics with COVID-19 (ICD-10 U07) as the underlying cause; the map uses their cumulative total for Taiwan. ' +
      `Daily confirmed deaths from Taiwan CDC (the Central Epidemic Command Center) run to ${date} (${n}); from 20 March 2023 only severe cases were reported, so there are no later year-end figures. ` +
      'WHO data do not list Taiwan separately; deaths reported by Taiwan are included in WHO’s figure for China.',
    month: (m) => new Date(`${m}-15`).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
  },
});

function monthList(start: string, length: number): string[] {
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5));
  return Array.from({ length }, () => {
    const out = `${y}-${String(m).padStart(2, '0')}`;
    m += 1;
    if (m > 12) [y, m] = [y + 1, 1];
    return out;
  });
}

/** 那一年 12 月（或更早）最後一個有值的月份 */
function lastAtOrBefore(months: string[], values: (number | null)[], month: string): number {
  for (let i = Math.min(values.length, months.length) - 1; i >= 0; i--) {
    if (months[i] <= month && values[i] != null) return i;
  }
  return -1;
}

interface MonthlyLine {
  name: string;
  values: (number | null)[];
  color: string;
}

/** 每月一筆的折線：x 軸只在 1 月標年份，時間軸那一年的 12 月畫一條參考線 */
function monthlyOption(
  months: string[],
  lines: MonthlyLine[],
  format: (v: number) => string,
  year: number,
  tokens: Tokens,
  monthLabel: (m: string) => string,
): ChartOption {
  const mark = months.includes(`${year}-12`) ? `${year}-12` : null;
  return {
    animation: false,
    grid: { left: 4, right: 12, top: 32, bottom: 4, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    legend: {
      top: 0,
      left: 0,
      data: lines.map((l) => l.name),
      icon: 'path://M0,0H12V2H0Z',
      itemWidth: 12,
      itemHeight: 2,
      textStyle: { color: tokens.inkSecondary, fontSize: 12 },
      selectedMode: false,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: tokens.axis, width: 1 } },
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      textStyle: { color: tokens.ink, fontSize: 12 },
      extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.12); border-radius: 6px;',
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const m = String((list[0] as { axisValue?: string }).axisValue ?? '');
        const rows = list.flatMap((p) => {
          const value = p.value as number | null | undefined;
          if (value == null) return [];
          return [
            `<div class="tt-row"><span class="tt-key" style="background:${p.color}"></span>` +
              `<strong>${escapeHtml(format(value))}</strong><span class="tt-name">${escapeHtml(p.seriesName ?? '')}</span></div>`,
          ];
        });
        return `<div class="tt-head">${escapeHtml(monthLabel(m))}</div>${rows.join('')}`;
      },
    },
    xAxis: {
      type: 'category',
      data: months,
      boundaryGap: false,
      axisLine: { lineStyle: { color: tokens.axis } },
      axisTick: { show: false },
      axisLabel: {
        color: tokens.inkMuted,
        fontSize: 11,
        interval: (_i: number, value: string) => value.endsWith('-01'),
        formatter: (value: string) => value.slice(0, 4),
      },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: tokens.grid, width: 1 } },
      axisLabel: { color: tokens.inkMuted, fontSize: 11 },
    },
    series: lines.map((l, i) => ({
      type: 'line',
      name: l.name,
      data: l.values,
      showSymbol: false,
      connectNulls: true,
      color: l.color,
      lineStyle: { width: 2, color: l.color },
      emphasis: { disabled: true },
      z: lines.length - i,
      markLine:
        i === 0 && mark
          ? {
              silent: true,
              symbol: 'none',
              label: { show: false },
              lineStyle: { color: tokens.inkMuted, type: 'solid', width: 1 },
              data: [{ xAxis: mark }],
            }
          : undefined,
    })),
  };
}

/** 95% 區間：上下限一樣（有實際死亡統計、模型直接用觀測值）時不寫 */
function rangeText(range: [number, number] | undefined | null): string | null {
  if (!range || Math.abs(range[1] - range[0]) < 0.5) return null;
  return `${n1(range[0])}–${n1(range[1])}`;
}

export default function VaccinationPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useMemo(() => COVERAGE.map((id) => `topics/${topic.id}/${id}.json`), [topic.id]);
  const coverage = useJsonMany<IndicatorData>(files);
  const covidFiles = useMemo(
    () => ['covid-deaths', 'excess-deaths', 'covid-vaccinated'].map((id) => `topics/${topic.id}/${id}.json`),
    [topic.id],
  );
  const covidData = useJsonMany<IndicatorData>(covidFiles);
  // 只有指標檔裡有 COVID-19 資料的國家才有時間線檔，沒有的不去要（避免 404）
  const hasCovid = covidData.some((d) => d?.values[iso3]?.some((v) => v != null));
  const timeline = useJson<Timeline>(hasCovid ? `topics/${topic.id}/covid/${iso3}.json` : null).data;

  const coverageChart = useMemo(() => {
    const base = coverage[0];
    if (!coverage.every(Boolean) || !base) return null;
    const years = base.years;
    const lines = COVERAGE.flatMap((_id, i) => {
      const data = coverage[i]!;
      const own = data.values[iso3];
      if (!own?.some((v) => v != null)) return [];
      const index = new Map(data.years.map((y, j) => [y, j]));
      return [
        {
          name: text.coverageLines[i],
          values: years.map((y) => (index.has(y) ? own[index.get(y)!] : null)),
          color: tokens.hues[HUE_ORDER[i]],
        },
      ];
    });
    if (lines.length === 0) return null;
    const first = Math.min(...lines.map((l) => l.values.findIndex((v) => v != null)));
    const indicator = topic.indicators.find((i) => i.id === 'dtp3')!;
    const option = timeSeriesOption({
      years: years.slice(first),
      lines: lines.map((l) => ({ ...l, values: l.values.slice(first) })),
      year,
      indicator,
      tokens,
    });
    const at = years.indexOf(Math.min(year, years[years.length - 1]));
    const parts = lines.flatMap((l) => (l.values[at] != null ? [`${l.name} ${indicator.format(l.values[at]!)}`] : []));
    return {
      option: { ...option, yAxis: { ...(option.yAxis as object), max: 100 } } as ChartOption,
      summary: parts.length ? text.coverageSummary(years[at], parts) : '',
    };
  }, [coverage, iso3, year, topic, tokens, text]);

  const covid = useMemo(() => {
    if (!timeline) return null;
    const length = Math.max(timeline.deaths.length, timeline.excess.length, timeline.vaccinated.length, timeline.fully.length);
    const months = monthList(timeline.start, length);
    const pad = (v: (number | null)[]) => months.map((_, i) => v[i] ?? null);
    const tw = iso3 === 'TWN';
    const deathLines: MonthlyLine[] = [];
    if (timeline.deaths.length) deathLines.push({ name: tw ? text.confirmedTw : text.confirmed, values: pad(timeline.deaths), color: tokens.hues.blue });
    if (timeline.excess.length) deathLines.push({ name: text.excess, values: pad(timeline.excess), color: tokens.hues.orange });
    const vaccLines: MonthlyLine[] = [];
    if (timeline.vaccinated.length) vaccLines.push({ name: text.vaccinated, values: pad(timeline.vaccinated), color: tokens.hues.blue });
    if (timeline.fully.length) vaccLines.push({ name: text.fully, values: pad(timeline.fully), color: tokens.hues.orange });

    // 時間軸那一年年底（或之前）的值
    const dec = `${year}-12`;
    const d = lastAtOrBefore(months, timeline.deaths, dec);
    const e = lastAtOrBefore(months, timeline.excess, dec);
    const confirmed = d >= 0 && !tw && months[d].startsWith(String(year)) ? n1(timeline.deaths[d]!) : null;
    const excessYear = Math.min(year, EXCESS_LAST_YEAR);
    const excess = e >= 0 && year <= EXCESS_LAST_YEAR ? n1(timeline.excess[e]!) : null;
    let deathsSummary = '';
    if (confirmed || excess) {
      deathsSummary = text.deathsSummary(year, confirmed, excess, rangeText(timeline.excessRange[String(excessYear)]));
    }
    if (year > EXCESS_LAST_YEAR && timeline.excessLast) {
      const [date, value, low, high] = timeline.excessLast;
      deathsSummary += (deathsSummary ? ' ' : '') + text.excessLater(date, n1(value), rangeText([low, high]));
    }
    const v1 = lastAtOrBefore(months, timeline.vaccinated, dec);
    const v2 = lastAtOrBefore(months, timeline.fully, dec);
    const vm = Math.max(v1, v2);
    const vaccSummary =
      vm >= 0
        ? text.vaccSummary(
            text.month(months[vm]),
            v1 === vm ? pct(timeline.vaccinated[v1]!) : null,
            v2 === vm ? pct(timeline.fully[v2]!) : null,
          )
        : '';
    return {
      deaths: deathLines.length ? monthlyOption(months, deathLines, per100k, year, tokens, text.month) : null,
      vacc: vaccLines.length ? monthlyOption(months, vaccLines, pct, year, tokens, text.month) : null,
      deathsSummary,
      vaccSummary,
    };
  }, [timeline, iso3, year, tokens, text, lang]);

  const twRows = useMemo(() => {
    if (!timeline?.certificates) return null;
    let total = 0;
    return Object.keys(timeline.certificates)
      .map(Number)
      .sort((a, b) => a - b)
      .map((y) => {
        total += timeline.certificates![String(y)];
        return { year: y, cert: timeline.certificates![String(y)], cum: total, cecc: timeline.cecc?.[String(y)] ?? null };
      });
  }, [timeline]);

  if (!coverage.every(Boolean)) return <p className="empty">{t.loading}</p>;
  return (
    <>
      {coverageChart && (
        <section className="panel-section">
          <h3>{text.coverageTitle}</h3>
          {coverageChart.summary && <p className="note">{coverageChart.summary}</p>}
          <EChart option={coverageChart.option} height={200} ariaLabel={text.coverageAria(countryName)} />
          {iso3 === 'TWN' && <p className="note">{text.twCoverage}</p>}
        </section>
      )}
      {covid?.deaths && (
        <section className="panel-section">
          <h3>{text.deathsTitle}</h3>
          {covid.deathsSummary && <p className="note">{covid.deathsSummary}</p>}
          <EChart option={covid.deaths} height={200} ariaLabel={text.deathsAria(countryName)} />
          <p className="note">{text.deathsNote}</p>
        </section>
      )}
      {covid?.vacc && (
        <section className="panel-section">
          <h3>{text.vaccTitle}</h3>
          {covid.vaccSummary && <p className="note">{covid.vaccSummary}</p>}
          <EChart option={covid.vacc} height={180} ariaLabel={text.vaccAria(countryName)} />
        </section>
      )}
      {twRows && timeline?.ceccLast && (
        <section className="panel-section">
          <h3>{text.twTitle}</h3>
          <table className="mini-table" aria-label={text.twCaption}>
            <thead>
              <tr>
                <th scope="col">{text.colYear}</th>
                <th scope="col" className="num">
                  {text.colCert}
                </th>
                <th scope="col" className="num">
                  {text.colCertCum}
                </th>
                <th scope="col" className="num">
                  {text.colCecc}
                </th>
              </tr>
            </thead>
            <tbody>
              {twRows.map((r) => (
                <tr key={r.year}>
                  <th scope="row">{r.year}</th>
                  <td className="num">{count(r.cert)}</td>
                  <td className="num">{count(r.cum)}</td>
                  <td className="num">{r.cecc == null ? '—' : count(r.cecc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.twNote(timeline.ceccLast[0], count(timeline.ceccLast[1]))}</p>
        </section>
      )}
    </>
  );
}
