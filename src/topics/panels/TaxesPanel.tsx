import { useMemo } from 'react';
import { EChart, type ChartOption } from '../../charts/EChart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { rate, times } from '../taxes';
import type { Indicator, IndicatorData, PanelExtraProps } from '../types';

/** taiwan.json（pipeline/topics/taxes.py）：各年度的綜合所得稅級距、免稅額與扣除額、換算起徵點用的平均薪資 */
interface TaiwanPit {
  rate: number;
  top_from: number;
  exemption: number;
  standard: number;
  salary: number;
  /** 各級的上限（綜合所得淨額），最後一級沒有上限 */
  brackets: number[];
  rates: number[];
  gross: number;
  wage: number | null;
  /** 沒有官方逐年數字、沿用 2009 年金額的項目 */
  assumed: string[];
}
interface TaiwanFile {
  pit: Record<string, TaiwanPit>;
  cit: Record<string, number>;
  vat: number;
  vatSince: number;
}

const IDS = ['cit', 'pit-top', 'pit-threshold', 'vat', 'tax-wedge'] as const;
/** 畫歷年折線的指標（起徵點的倍數只放在表裡） */
const CHARTS = ['cit', 'pit-top', 'vat', 'tax-wedge'] as const;
type Id = (typeof IDS)[number];
/** 起徵點用 OECD 的中位數（倍數差很多，平均被哥倫比亞的 50 倍拉高），其他用 OECD 的簡單平均 */
const AGGREGATE: Record<Id, string> = {
  cit: 'OECD',
  'pit-top': 'OECD',
  'pit-threshold': 'OECD_MEDIAN',
  vat: 'OECD',
  'tax-wedge': 'OECD',
};


const TEXT = defineMessages({
  zh: {
    compareTitle: (year: number) => `跟 OECD 比（${year} 年）`,
    compareCaption: (country: string, year: number) => `${country} ${year} 年的各項稅率與 OECD 平均`,
    colMeasure: '稅率',
    colCountry: '本國',
    colOecd: 'OECD',
    dataYear: (y: number) => `（${y} 年）`,
    compareNote:
      'OECD 是 38 個會員國的簡單平均；起徵點的倍數各國差很多（哥倫比亞約 50 倍、匈牙利是單一稅率的 0），用中位數。加值型營業稅是每年 1 月 1 日的稅率，只有部分年份。',
    trendTitle: '歷年的稅率',
    oecd: 'OECD 平均',
    chartAria: (country: string, label: string) => `${country}歷年的${label}與 OECD 平均`,
    twBracketsTitle: (year: number) => `台灣的綜合所得稅級距（${year} 年度）`,
    twBracketsCaption: (year: number) => `台灣 ${year} 年度綜合所得稅的課稅級距與稅率`,
    colNet: '綜合所得淨額（元）',
    colRate: '稅率',
    upTo: (v: string) => `0–${v}`,
    range: (a: string, b: string) => `${a}–${b}`,
    above: (v: string) => `${v} 以上`,
    twThresholdTitle: (year: number) => `最高稅率從多少薪水開始（${year} 年）`,
    twThresholdCaption: (year: number) => `台灣 ${year} 年最高稅率的起徵點換算成薪資收入與平均薪資的倍數`,
    rowTopFrom: (r: number) => `綜合所得淨額超過這個金額的部分課 ${r}%`,
    rowExemption: '＋ 免稅額（本人）',
    rowStandard: '＋ 標準扣除額（單身）',
    rowSalary: '＋ 薪資所得特別扣除額',
    rowGross: '＝ 薪資收入',
    rowWage: '÷ 平均年薪（主計總處，每月總薪資 × 12）',
    rowTimes: '＝ 平均薪資的幾倍',
    assumed:
      '這一年的免稅額或薪資所得特別扣除額沒有找到官方的逐年數字，沿用 2009 年的金額（實際可能多幾千元，倍數只差不到 0.1%）。',
    twThresholdNote:
      '跟 OECD 的起徵點一樣以薪資總額計：單身、只有薪資、用標準扣除額。台灣的級距是綜合所得淨額（扣掉免稅額與扣除額之後），所以要加回去才能跟其他國家比。',
    twHistoryTitle: '台灣稅率的變化',
    twCit: (parts: string) => `營利事業所得稅：${parts}（課稅所得額 12 萬元以下免稅；未分配盈餘另加徵 5%，2017 年以前 10%）。`,
    citPart: (from: number, to: number | null, r: number) => (to ? `${from}–${to} 年 ${r}%` : `${from} 年起 ${r}%`),
    twPit: '綜合所得稅最高稅率：40%；2015–2017 年綜合所得淨額超過 1,000 萬元（2017 年 1,031 萬元）的部分 45%，2018 年取消。',
    twVat: (since: number, v: number) => `加值型營業稅：${since} 年 4 月實施起一直是 ${v}%（法律規定 5–10%，由行政院決定）。`,
    tw2026: (t: string) => `2026 年度（115 年度）的級距依物價調整，最高一級從綜合所得淨額超過 ${t}開始。`,
    money: (v: number) => `${Math.round(v).toLocaleString('zh-TW')} 元`,
    listSep: '、',
  },
  en: {
    compareTitle: (year) => `Compared with the OECD (${year})`,
    compareCaption: (country, year) => `Tax rates for ${country} in ${year}, with the OECD average`,
    colMeasure: 'Rate',
    colCountry: 'Here',
    colOecd: 'OECD',
    dataYear: (y) => ` (${y})`,
    compareNote:
      'OECD figures are simple averages of the 38 members; the threshold multiple varies so much (about 50 in Colombia, 0 for Hungary’s flat tax) that the median is used instead. VAT rates are as of 1 January and only for some years.',
    trendTitle: 'Rates over time',
    oecd: 'OECD average',
    chartAria: (country, label) => `${label} in ${country} over time, with the OECD average`,
    twBracketsTitle: (year) => `Taiwan’s income tax brackets (tax year ${year})`,
    twBracketsCaption: (year) => `Taiwan’s individual income tax brackets and rates for tax year ${year}`,
    colNet: 'Net taxable income (NT$)',
    colRate: 'Rate',
    upTo: (v) => `Up to ${v}`,
    range: (a, b) => `${a}–${b}`,
    above: (v) => `${v} and over`,
    twThresholdTitle: (year) => `Where the top rate starts (${year})`,
    twThresholdCaption: (year) => `Taiwan’s top-rate threshold in ${year} converted to wages and to a multiple of the average wage`,
    rowTopFrom: (r) => `Net taxable income above which ${r}% applies`,
    rowExemption: '+ personal exemption',
    rowStandard: '+ standard deduction (single)',
    rowSalary: '+ special deduction for salaries',
    rowGross: '= wages',
    rowWage: '÷ average annual earnings (DGBAS, monthly × 12)',
    rowTimes: '= multiple of the average wage',
    assumed:
      'No official figure was found for this year’s personal exemption or salary deduction, so the 2009 amount is used (the actual one may be a few thousand dollars higher, changing the multiple by less than 0.1%).',
    twThresholdNote:
      'Measured in wages, like the OECD threshold: a single person with only wage income taking the standard deduction. Taiwan’s brackets apply to net taxable income after exemptions and deductions, so these are added back for comparison.',
    twHistoryTitle: 'How Taiwan’s rates have changed',
    twCit: (parts) => `Corporate income tax: ${parts} (taxable income up to NT$120,000 is exempt; a separate surtax of 5% on undistributed earnings, 10% until 2017).`,
    citPart: (from, to, r) => (to ? `${r}% in ${from}–${to}` : `${r}% from ${from}`),
    twPit: 'Top individual income tax rate: 40%; 45% on net taxable income above NT$10 million (NT$10.31 million in 2017) in 2015–2017, abolished in 2018.',
    twVat: (since, v) => `VAT: ${v}% since it was introduced in April ${since} (the law allows 5–10%, set by the Executive Yuan).`,
    tw2026: (t) => `For tax year 2026 the brackets are indexed to prices, and the top rate starts on net taxable income above ${t}.`,
    money: (v) => `NT$${Math.round(v).toLocaleString('en-US')}`,
    listSep: ', ',
  },
});

/** 稅率在 0–60% 之間、多半很平：y 軸不從 0 開始，起伏才看得出來 */
function zoomY(option: ChartOption): ChartOption {
  return { ...option, yAxis: { ...(option.yAxis as object), scale: true } } as ChartOption;
}

/** 資料裡最接近 year 的年份（一樣近取較早的），跟上面的數值卡片一樣；加值型營業稅只有部分年份 */
function nearestIndex(years: number[], year: number): number {
  let best = 0;
  years.forEach((y, i) => {
    if (Math.abs(y - year) < Math.abs(years[best] - year)) best = i;
  });
  return best;
}

export default function TaxesPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useMemo(() => IDS.map((id) => `topics/${topic.id}/${id}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(files);
  const taiwan = useJson<TaiwanFile>(iso3 === 'TWN' ? `topics/${topic.id}/taiwan.json` : null).data;

  const view = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const data = Object.fromEntries(IDS.map((id, i) => [id, loaded[i] as IndicatorData])) as Record<Id, IndicatorData>;
    const indicator = (id: Id) => topic.indicators.find((i) => i.id === id) as Indicator;

    const rows = IDS.flatMap((id) => {
      const d = data[id];
      const i = nearestIndex(d.years, year);
      const own = d.values[iso3]?.[i];
      if (own == null) return [];
      const avg = d.aggregates?.[AGGREGATE[id]]?.[i];
      const fmt = id === 'pit-threshold' ? times : rate;
      return [
        {
          id,
          label: indicator(id).label,
          own: fmt(own) + (d.years[i] !== year ? text.dataYear(d.years[i]) : ''),
          oecd: avg == null ? '—' : fmt(avg),
        },
      ];
    });

    const charts = CHARTS.flatMap((id) => {
      const d = data[id];
      const own = d.values[iso3];
      if (!own?.some((v) => v != null)) return [];
      const start = Math.max(0, own.findIndex((v) => v != null));
      const option = zoomY(
        timeSeriesOption({
          years: d.years.slice(start),
          lines: [
            { name: countryName, values: own.slice(start), color: tokens.accent },
            { name: text.oecd, values: (d.aggregates?.OECD ?? []).slice(start), color: tokens.context },
          ],
          year,
          indicator: indicator(id),
          tokens,
          sparse: id === 'vat',
        }),
      );
      return [{ id, label: indicator(id).label, option }];
    });
    return { rows, charts };
  }, [loaded, iso3, year, topic, tokens, text, countryName]);

  const tw = useMemo(() => {
    if (!taiwan) return null;
    const years = Object.keys(taiwan.pit).map(Number).sort((a, b) => a - b);
    const shown = years.filter((y) => y <= year).pop() ?? years[0];
    const p = taiwan.pit[String(shown)];
    const money = text.money;
    const num = (v: number) => v.toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US');
    const brackets = p.rates.map((r, i) => {
      const lo = i === 0 ? null : p.brackets[i - 1];
      const hi = i < p.brackets.length ? p.brackets[i] : null;
      const label = lo === null ? text.upTo(num(hi!)) : hi === null ? text.above(num(lo + 1)) : text.range(num(lo + 1), num(hi));
      return { label, rate: r };
    });
    const citYears = Object.keys(taiwan.cit).map(Number).sort((a, b) => a - b);
    const citParts = citYears
      .map((from, i) => text.citPart(from, i + 1 < citYears.length ? citYears[i + 1] - 1 : null, taiwan.cit[String(from)]))
      .join(text.listSep);
    const next = taiwan.pit['2026'];
    return { shown, p, brackets, citParts, next: next ? money(next.top_from) : null, money };
  }, [taiwan, year, lang, text]);

  if (!view) return <p className="empty">{t.loading}</p>;
  if (!view.rows.length) return null; // 不在任何一份資料裡：上面的數值卡片已經寫了原因
  return (
    <section className="panel-section">
      <h3>{text.compareTitle(year)}</h3>
      <table className="mini-table" aria-label={text.compareCaption(countryName, year)}>
        <thead>
          <tr>
            <th scope="col">{text.colMeasure}</th>
            <th scope="col" className="num">{text.colCountry}</th>
            <th scope="col" className="num">{text.colOecd}</th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.label}</th>
              <td className="num">{r.own}</td>
              <td className="num">{r.oecd}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.compareNote}</p>
      {view.charts.length > 0 && (
        <>
          <h3>{text.trendTitle}</h3>
          {view.charts.map((c) => (
            <div key={c.id}>
              <h4>{c.label}</h4>
              <EChart option={c.option} height={150} ariaLabel={text.chartAria(countryName, c.label)} />
            </div>
          ))}
        </>
      )}
      {tw && taiwan && (
        <>
          <h3>{text.twBracketsTitle(tw.shown)}</h3>
          <table className="mini-table" aria-label={text.twBracketsCaption(tw.shown)}>
            <thead>
              <tr>
                <th scope="col">{text.colNet}</th>
                <th scope="col" className="num">{text.colRate}</th>
              </tr>
            </thead>
            <tbody>
              {tw.brackets.map((b) => (
                <tr key={b.label}>
                  <th scope="row">{b.label}</th>
                  <td className="num">{b.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tw.next && tw.shown === 2025 && <p className="note">{text.tw2026(tw.next)}</p>}
          <h3>{text.twThresholdTitle(tw.shown)}</h3>
          <table className="mini-table" aria-label={text.twThresholdCaption(tw.shown)}>
            <tbody>
              <tr>
                <th scope="row">{text.rowTopFrom(tw.p.rate)}</th>
                <td className="num">{tw.money(tw.p.top_from)}</td>
              </tr>
              <tr>
                <th scope="row">{text.rowExemption}</th>
                <td className="num">{tw.money(tw.p.exemption)}</td>
              </tr>
              <tr>
                <th scope="row">{text.rowStandard}</th>
                <td className="num">{tw.money(tw.p.standard)}</td>
              </tr>
              <tr>
                <th scope="row">{text.rowSalary}</th>
                <td className="num">{tw.money(tw.p.salary)}</td>
              </tr>
              <tr>
                <th scope="row">{text.rowGross}</th>
                <td className="num">{tw.money(tw.p.gross)}</td>
              </tr>
              {tw.p.wage != null && (
                <>
                  <tr>
                    <th scope="row">{text.rowWage}</th>
                    <td className="num">{tw.money(tw.p.wage)}</td>
                  </tr>
                  <tr>
                    <th scope="row">{text.rowTimes}</th>
                    <td className="num">{times(tw.p.gross / tw.p.wage)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          <p className="note">
            {text.twThresholdNote}
            {tw.p.assumed.length > 0 && ` ${text.assumed}`}
          </p>
          <h3>{text.twHistoryTitle}</h3>
          <ul className="note">
            <li>{text.twCit(tw.citParts)}</li>
            <li>{text.twPit}</li>
            <li>{text.twVat(taiwan.vatSince, taiwan.vat)}</li>
          </ul>
        </>
      )}
    </section>
  );
}
