import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { timeSeriesOption, type TimeSeriesLine } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed, formatSignedPercent } from '../../lib/format';
import type { Tokens } from '../../theme/tokens';
import type { Indicator, IndicatorData, PanelExtraProps } from '../types';

/** taiwan.json（pipeline/topics/house_prices.py 的 write_taiwan） */
interface TaiwanFile {
  /** 「2026Q1」，由舊到新 */
  periods: string[];
  /** 從這一季起房價改用實價登錄（之前是聯徵中心的擔保品估價） */
  breakAt: string;
  /** 全國、六都、其他縣市：房價所得比（倍）、貸款負擔率（%），跟 periods 一一對應 */
  areas: { zh: string; en: string; priceIncome: (number | null)[]; burden: (number | null)[] }[];
  hpiPeriods: string[];
  /** 全國與六都的住宅價格指數（105 年 = 100） */
  hpi: { zh: string; en: string; values: (number | null)[] }[];
}

/** 指數跟 100 比：「高 27%」「低 18%」/「27% higher」「18% lower」（四捨五入到整數） */
const VS = {
  zh: (diff: number) => (diff === 0 ? '差不多' : `${diff > 0 ? '高' : '低'} ${Math.abs(diff)}%`),
  en: (diff: number) => (diff === 0 ? 'about the same' : `${Math.abs(diff)}% ${diff > 0 ? 'higher' : 'lower'}`),
};
const vs = (index: number, lang: 'zh' | 'en') => VS[lang](Math.round(index - 100));

const TEXT = defineMessages({
  zh: {
    trendTitle: '實質房價與房租（2015 年 = 100）',
    priceChart: (country: string) => `${country}歷年的實質房價指數與 OECD 平均`,
    rentChart: (country: string) => `${country}歷年的實質房租指數與 OECD 平均`,
    price: '實質房價',
    rent: '實質房租',
    oecd: 'OECD 平均',
    bis: 'BIS 各經濟體平均',
    summary: (year: number, price: number, oecd: number) =>
      `${year} 年的實質房價比 2015 年${vs(price, 'zh')}（OECD 平均${vs(oecd, 'zh')}）。`,
    summaryRent: (rent: number, oecd: number) => `實質房租${vs(rent, 'zh')}（OECD 平均${vs(oecd, 'zh')}）。`,
    affordTitle: (year: number) => `買不買得起（${year} 年）`,
    affordCaption: (country: string, year: number) => `${country} ${year} 年的房價所得比、房價租金比與 OECD 平均`,
    colMeasure: '指標',
    colCountry: '本國',
    colOecd: 'OECD 平均',
    pti: '房價所得比（2015 年 = 100）',
    prr: '房價租金比（2015 年 = 100）',
    ptiAvg: '房價所得比（長期平均 = 100）',
    prrAvg: '房價租金比（長期平均 = 100）',
    affordNote:
      '這些都是指數：高於 100 表示房價漲得比所得（或房租）快，只能看跟 2015 年或這個國家自己的長期平均比的變化，不能拿來比各國的房子誰比較貴。長期平均是 OECD 用這個國家有資料以來所有年份算的。',
    twTitle: (period: string) => `台灣的房價所得比與房貸負擔率（${period}）`,
    twCaption: (period: string) => `${period} 全國與六都的房價所得比、房貸負擔率與住宅價格指數的 5 年變化`,
    colArea: '地區',
    colPti: '房價所得比',
    colBurden: '房貸負擔率',
    colHpi: '房價 5 年',
    times: (v: number) => `${fixed(v, 2)} 倍`,
    quarter: (year: string, q: string) => `${year} 年第 ${q} 季`,
    twChart: '全國與臺北市歷年的房價所得比（倍，年平均）',
    twNote: (low: string, high: string) =>
      '內政部的房價所得比是中位數住宅價格 ÷ 中位數家戶年可支配所得（幾年的所得），房貸負擔率是貸七成、20 年本利均攤時，每月房貸占中位數家戶月可支配所得的比例；' +
      `其他縣市的房價所得比在 ${low} 到 ${high} 之間。房價 5 年是住宅價格指數跟 5 年前同一季比（名目，沒有扣掉物價）。` +
      '2012 年第 2 季以前的房價是聯徵中心的擔保品估價，之後是實價登錄的成交價，前後不能直接比（圖上的虛線）。',
    twCompare:
      '這是倍數，跟地圖上 2015 年 = 100 的指數不同，也不能跟其他國家比：常見的跨國倍數排名（Demographia、Numbeo）不是開放資料，房價與所得的定義也跟內政部不同。',
  },
  en: {
    trendTitle: 'Real house prices and rents (2015 = 100)',
    priceChart: (country) => `Real house price index for ${country} over time, with the OECD average`,
    rentChart: (country) => `Real rent index for ${country} over time, with the OECD average`,
    price: 'Real house prices',
    rent: 'Real rents',
    oecd: 'OECD average',
    bis: 'BIS, all economies',
    summary: (year, price, oecd) =>
      `In ${year} real house prices were ${vs(price, 'en')} compared with 2015 (OECD average: ${vs(oecd, 'en')}).`,
    summaryRent: (rent, oecd) => ` Real rents were ${vs(rent, 'en')} (OECD average: ${vs(oecd, 'en')}).`,
    affordTitle: (year) => `Affordability (${year})`,
    affordCaption: (country, year) => `Price-to-income and price-to-rent ratios for ${country} in ${year}, with the OECD average`,
    colMeasure: 'Measure',
    colCountry: 'Here',
    colOecd: 'OECD',
    pti: 'Price-to-income (2015 = 100)',
    prr: 'Price-to-rent (2015 = 100)',
    ptiAvg: 'Price-to-income (long-term average = 100)',
    prrAvg: 'Price-to-rent (long-term average = 100)',
    affordNote:
      'These are all indices: above 100 means prices have risen faster than incomes (or rents). They show only the change against 2015 or against the country’s own long-term average, not which country’s homes are more expensive. The OECD computes the long-term average over all years with data for that country.',
    twTitle: (period) => `Taiwan's price-to-income and mortgage burden (${period})`,
    twCaption: (period) => `Price-to-income ratio, mortgage burden and 5-year change in the housing price index for Taiwan and its six special municipalities, ${period}`,
    colArea: 'Area',
    colPti: 'Price/income',
    colBurden: 'Mortgage',
    colHpi: 'Prices, 5y',
    times: (v) => `${fixed(v, 2)}×`,
    quarter: (year, q) => `${year} Q${q}`,
    twChart: 'Price-to-income ratio for Taiwan and Taipei over time (times income, annual average)',
    twNote: (low, high) =>
      'The Ministry of the Interior price-to-income ratio is the median home price divided by median annual household disposable income (years of income); the mortgage burden is the monthly payment on a 70% loan repaid over 20 years as a share of median monthly household disposable income. ' +
      `In other counties and cities the ratio is between ${low} and ${high}. "Prices, 5y" compares the housing price index with the same quarter five years earlier (nominal, not adjusted for inflation). ` +
      'Before the third quarter of 2012 prices are collateral valuations from the Joint Credit Information Center and afterwards actual transaction prices, so the two periods are not directly comparable (dashed line on the chart).',
    twCompare:
      'This is a ratio in years of income, unlike the 2015 = 100 indices on the map, and it cannot be compared with other countries: the usual cross-country rankings (Demographia, Numbeo) are not open data and define prices and incomes differently from the ministry.',
  },
});

const CITY_COUNT = 7; // 全國與六都
const TAIPEI = '臺北市'; // i18n-ignore（taiwan.json 的地區鍵）
const pct = (v: number) => formatSignedPercent(v, 0);

/** 圖表用的指標：只借 format 與圖例刻度，用循序的圖層，折線圖才不會在 0 畫一條橫線 */
function chartIndicator(base: Indicator, format: (v: number) => string, tick: (v: number) => string): Indicator {
  return { ...base, format, formatTick: tick, layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [] } } };
}

/** 從這個國家第一個有值的年份開始畫 */
function trendOption(
  data: IndicatorData,
  lines: TimeSeriesLine[],
  year: number,
  indicator: Indicator,
  tokens: Tokens,
) {
  const first = lines[0].values.findIndex((v) => v != null);
  const start = Math.max(0, first);
  return zoomY(
    timeSeriesOption({
      years: data.years.slice(start),
      lines: lines.map((l) => ({ ...l, values: l.values.slice(start) })),
      year,
      indicator,
      tokens,
    }),
  );
}

/** 指數在 100 上下：y 軸不必從 0 開始，起伏才看得出來 */
function zoomY(option: ChartSpec): ChartSpec {
  return { ...option, y: { ...option.y, zero: false } };
}

export default function HousePricesPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useMemo(
    () =>
      ['index/real-price', 'index/real-rent', 'price-income', 'price-rent', 'ltavg/price-income', 'ltavg/price-rent'].map(
        (f) => `topics/${topic.id}/${f}.json`,
      ),
    [topic.id],
  );
  const loaded = useJsonMany<IndicatorData>(files);
  const taiwan = useJson<TaiwanFile>(iso3 === 'TWN' ? `topics/${topic.id}/taiwan.json` : null).data;

  const view = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const [price, rent, pti, prr, ptiAvg, prrAvg] = loaded as IndicatorData[];
    const base = topic.indicators.find((i) => i.id === 'price-income')!;
    const indexIndicator = chartIndicator(base, (v) => fixed(v, 1), (v) => fixed(v, 0));
    const at = (d: IndicatorData, key: string, aggregate = false) => {
      const i = d.years.indexOf(year);
      if (i < 0) return null;
      return (aggregate ? d.aggregates?.[key] : d.values[key])?.[i] ?? null;
    };

    const ownPrice = price.values[iso3];
    const ownRent = rent.values[iso3];
    const priceLines: TimeSeriesLine[] = ownPrice
      ? [
          { name: text.price, values: ownPrice, color: tokens.accent },
          { name: text.oecd, values: price.aggregates?.OECD ?? [], color: tokens.context },
          { name: text.bis, values: price.aggregates?.BIS ?? [], color: tokens.hues.violet },
        ]
      : [];
    const rentLines: TimeSeriesLine[] = ownRent
      ? [
          { name: text.rent, values: ownRent, color: tokens.hues.orange },
          { name: text.oecd, values: rent.aggregates?.OECD ?? [], color: tokens.context },
        ]
      : [];

    const p = at(price, iso3);
    const pOecd = at(price, 'OECD', true);
    const r = at(rent, iso3);
    const rOecd = at(rent, 'OECD', true);
    const summary = [
      p != null && pOecd != null ? text.summary(year, p, pOecd) : null,
      p != null && r != null && rOecd != null ? text.summaryRent(r, rOecd) : null,
    ]
      .filter(Boolean)
      .join('');

    const rows = (
      [
        [text.pti, pti],
        [text.prr, prr],
        [text.ptiAvg, ptiAvg],
        [text.prrAvg, prrAvg],
      ] as const
    ).flatMap(([label, d]) => {
      const own = at(d, iso3);
      return own == null ? [] : [{ label, own, oecd: at(d, 'OECD', true) }];
    });

    return {
      summary,
      priceOption: priceLines.length ? trendOption(price, priceLines, year, indexIndicator, tokens) : null,
      rentOption: rentLines.length ? trendOption(rent, rentLines, year, indexIndicator, tokens) : null,
      rows,
    };
  }, [loaded, iso3, year, topic, tokens, text]);

  const tw = useMemo(() => {
    if (!taiwan) return null;
    // 選的年份（或之前）最後一季
    let index = -1;
    taiwan.periods.forEach((p, i) => {
      if (Number(p.slice(0, 4)) <= year) index = i;
    });
    if (index < 0) return null;
    const period = taiwan.periods[index];
    const hpiIndex = taiwan.hpiPeriods.indexOf(period);
    const hpiBefore = taiwan.hpiPeriods.indexOf(`${Number(period.slice(0, 4)) - 5}${period.slice(4)}`);
    const rows = taiwan.areas.slice(0, CITY_COUNT).map((a) => {
      const hpi = taiwan.hpi.find((h) => h.zh === a.zh);
      const now = hpi && hpiIndex >= 0 ? hpi.values[hpiIndex] : null;
      const before = hpi && hpiBefore >= 0 ? hpi.values[hpiBefore] : null;
      return {
        name: lang === 'zh' ? a.zh : a.en,
        pti: a.priceIncome[index],
        burden: a.burden[index],
        hpi: now != null && before != null ? (now / before - 1) * 100 : null,
      };
    });
    const others = taiwan.areas.slice(CITY_COUNT).flatMap((a) => (a.priceIncome[index] == null ? [] : [a.priceIncome[index]!]));

    // 年平均（四季都有）給折線圖
    const years: number[] = [];
    const annual = (values: (number | null)[]) => {
      const sums = new Map<number, number[]>();
      taiwan.periods.forEach((p, i) => {
        const v = values[i];
        if (v == null) return;
        const y = Number(p.slice(0, 4));
        sums.set(y, [...(sums.get(y) ?? []), v]);
      });
      return sums;
    };
    const taipeiArea = taiwan.areas.find((a) => a.zh === TAIPEI) ?? taiwan.areas[0];
    const national = annual(taiwan.areas[0].priceIncome);
    const taipei = annual(taipeiArea.priceIncome);
    for (const [y, v] of national) if (v.length === 4) years.push(y);
    years.sort((a, b) => a - b);
    const mean = (m: Map<number, number[]>, y: number) => {
      const v = m.get(y);
      return v && v.length === 4 ? v.reduce((s, x) => s + x, 0) / 4 : null;
    };
    const base = topic.indicators.find((i) => i.id === 'price-income')!;
    const option = timeSeriesOption({
      years,
      lines: [
        { name: rows[0].name, values: years.map((y) => mean(national, y)), color: tokens.accent },
        { name: lang === 'zh' ? taipeiArea.zh : taipeiArea.en, values: years.map((y) => mean(taipei, y)), color: tokens.hues.orange },
      ],
      year,
      methodBreak: Number(taiwan.breakAt.slice(0, 4)),
      indicator: chartIndicator(base, (v) => text.times(v), (v) => fixed(v, 0)),
      tokens,
    });
    return {
      period: text.quarter(period.slice(0, 4), period.slice(5)),
      rows,
      low: others.length ? text.times(Math.min(...others)) : '—',
      high: others.length ? text.times(Math.max(...others)) : '—',
      option,
    };
  }, [taiwan, year, lang, text, tokens, topic]);

  if (!view) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      {(view.priceOption || view.rentOption) && (
        <>
          <h3>{text.trendTitle}</h3>
          {view.summary && <p className="note">{view.summary}</p>}
          {view.priceOption && <Chart spec={view.priceOption} height={190} ariaLabel={text.priceChart(countryName)} />}
          {view.rentOption && <Chart spec={view.rentOption} height={170} ariaLabel={text.rentChart(countryName)} />}
        </>
      )}
      {view.rows.length > 0 && (
        <>
          <h3>{text.affordTitle(year)}</h3>
          <table className="mini-table" aria-label={text.affordCaption(countryName, year)}>
            <thead>
              <tr>
                <th scope="col">{text.colMeasure}</th>
                <th scope="col" className="num">{text.colCountry}</th>
                <th scope="col" className="num">{text.colOecd}</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td className="num">{fixed(r.own, 1)}</td>
                  <td className="num">{r.oecd == null ? '—' : fixed(r.oecd, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.affordNote}</p>
        </>
      )}
      {tw && (
        <>
          <h3>{text.twTitle(tw.period)}</h3>
          <table className="mini-table" aria-label={text.twCaption(tw.period)}>
            <thead>
              <tr>
                <th scope="col">{text.colArea}</th>
                <th scope="col" className="num">{text.colPti}</th>
                <th scope="col" className="num">{text.colBurden}</th>
                <th scope="col" className="num">{text.colHpi}</th>
              </tr>
            </thead>
            <tbody>
              {tw.rows.map((r) => (
                <tr key={r.name}>
                  <th scope="row">{r.name}</th>
                  <td className="num">{r.pti == null ? '—' : text.times(r.pti)}</td>
                  <td className="num">{r.burden == null ? '—' : `${fixed(r.burden, 1)}%`}</td>
                  <td className="num">{r.hpi == null ? '—' : pct(r.hpi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.twCompare}</p>
          <h4>{text.twChart}</h4>
          <Chart spec={tw.option} height={190} ariaLabel={text.twChart} />
          <p className="note">{text.twNote(tw.low, tw.high)}</p>
        </>
      )}
    </section>
  );
}
