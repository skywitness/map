import { useMemo } from 'react';
import { EChart, type ChartOption } from '../../charts/EChart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

/** taiwan.json（pipeline/topics/marriage.py）：內政部戶政司的結婚、離婚對數（[總計, 其中相同性別]）與初婚者平均年齡 */
interface TaiwanFile {
  marriages: Record<string, [number, number | null]>;
  divorces: Record<string, [number, number | null]>;
  ageMen: Record<string, number>;
  ageWomen: Record<string, number>;
}

const PAIRS = [
  { id: 'age', files: ['age-women', 'age-men'], hues: ['orange', 'blue'] as Hue[] },
  { id: 'rates', files: ['marriage-rate', 'divorce-rate'], hues: ['green', 'red'] as Hue[] },
] as const;
const TAIWAN_YEARS = 8;
const count = (n: number) => fixed(n, 0);

const TEXT = defineMessages({
  zh: {
    ageTitle: '初婚年齡的變化',
    ageLines: ['女性', '男性'],
    ageSummary: (year: number, women: string, men: string) => `${year} 年女性 ${women}、男性 ${men}。`,
    ageAria: (country: string) => `${country}歷年男女的初婚年齡`,
    rateTitle: '結婚率與離婚率',
    rateLines: ['粗結婚率', '粗離婚率'],
    rateSummary: (year: number, m: string, d: string) => `${year} 年粗結婚率${m}、粗離婚率${d}。`,
    rateAria: (country: string) => `${country}歷年的粗結婚率與粗離婚率`,
    twTitle: '台灣的結婚與離婚對數',
    twCaption: '台灣近年的結婚、離婚對數與其中的同性伴侶（內政部戶政司，按登記日期）',
    colYear: '年',
    colMarriages: '結婚',
    colDivorces: '離婚',
    sameSex: (n: number) => `（同性 ${count(n)}）`,
    twNote:
      '內政部戶政司，按登記日期。2019 年 5 月 24 日起可以登記同性結婚，括號裡是其中相同性別的對數；離婚含終止結婚。' +
      '初婚者的平均年齡（按發生日期）是上面的折線。',
  },
  en: {
    ageTitle: 'Age at first marriage over time',
    ageLines: ['Women', 'Men'],
    ageSummary: (year, women, men) => `${year}: women ${women}, men ${men}.`,
    ageAria: (country) => `Age at first marriage of women and men in ${country} over time`,
    rateTitle: 'Marriage and divorce rates',
    rateLines: ['Crude marriage rate', 'Crude divorce rate'],
    rateSummary: (year, m, d) => `${year}: marriages ${m}, divorces ${d}.`,
    rateAria: (country) => `Crude marriage and divorce rates in ${country} over time`,
    twTitle: 'Marriages and divorces in Taiwan',
    twCaption: 'Marriages and divorces in Taiwan in recent years, with same-sex couples (Department of Household Registration, by date of registration)',
    colYear: 'Year',
    colMarriages: 'Marriages',
    colDivorces: 'Divorces',
    sameSex: (n) => ` (same-sex ${count(n)})`,
    twNote:
      'Department of Household Registration, by date of registration. Same-sex couples have been able to marry since 24 May 2019; the numbers in brackets are same-sex couples. Divorces include the termination of same-sex marriages. ' +
      'The mean age at first marriage (by date of occurrence) is shown in the chart above.',
  },
});

/** 初婚年齡在 17–38 歲之間：y 軸不從 0 開始，起伏才看得出來（結婚率、離婚率照常從 0 開始） */
function zoomY(option: ChartOption): ChartOption {
  return { ...option, yAxis: { ...(option.yAxis as object), scale: true } } as ChartOption;
}

export default function MarriagePanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useMemo(() => PAIRS.flatMap((p) => p.files.map((f) => `topics/${topic.id}/${f}.json`)), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(files);
  const taiwan = useJson<TaiwanFile>(iso3 === 'TWN' ? `topics/${topic.id}/taiwan.json` : null).data;

  const charts = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    return PAIRS.flatMap((pair, p) => {
      const data = [loaded[p * 2]!, loaded[p * 2 + 1]!];
      const own = data.map((d) => d.values[iso3]);
      if (!own.some((v) => v?.some((x) => x != null))) return [];
      const years = data[0].years;
      const has = (i: number) => own.some((v) => v?.[i] != null);
      const first = years.findIndex((_, i) => has(i));
      const last = years.length - 1 - [...years].reverse().findIndex((_, i) => has(years.length - 1 - i));
      const indicator = topic.indicators.find((i) => i.id === pair.files[0])!;
      const names = pair.id === 'age' ? text.ageLines : text.rateLines;
      const base = timeSeriesOption({
        years: years.slice(first, last + 1),
        lines: own.map((v, i) => ({
          name: names[i],
          values: (v ?? years.map(() => null)).slice(first, last + 1),
          color: tokens.hues[pair.hues[i]],
        })),
        year,
        indicator,
        tokens,
        sparse: true,
      });
      const option = pair.id === 'age' ? zoomY(base) : base;
      // 時間軸那一年以前，兩條線都有值的最近一年
      let shown: number | null = null;
      for (let i = first; i <= last && years[i] <= year; i++) if (own.every((v) => v?.[i] != null)) shown = i;
      const summary =
        shown === null
          ? ''
          : pair.id === 'age'
            ? text.ageSummary(years[shown], indicator.format(own[0]![shown]!), indicator.format(own[1]![shown]!))
            : text.rateSummary(years[shown], indicator.format(own[0]![shown]!), indicator.format(own[1]![shown]!));
      return [{ id: pair.id, option, summary }];
    });
  }, [loaded, iso3, year, topic, tokens, text]);

  if (!charts) return <p className="empty">{t.loading}</p>;
  const twYears = taiwan
    ? Object.keys(taiwan.marriages)
        .map(Number)
        .sort((a, b) => b - a)
        .slice(0, TAIWAN_YEARS)
    : [];
  return (
    <>
      {charts.map((c) => (
        <section key={c.id} className="panel-section">
          <h3>{c.id === 'age' ? text.ageTitle : text.rateTitle}</h3>
          {c.summary && <p className="note">{c.summary}</p>}
          <EChart option={c.option} height={180} ariaLabel={(c.id === 'age' ? text.ageAria : text.rateAria)(countryName)} />
        </section>
      ))}
      {taiwan && (
        <section className="panel-section">
          <h3>{text.twTitle}</h3>
          <table className="mini-table" aria-label={text.twCaption}>
            <thead>
              <tr>
                <th scope="col">{text.colYear}</th>
                <th scope="col" className="num">
                  {text.colMarriages}
                </th>
                <th scope="col" className="num">
                  {text.colDivorces}
                </th>
              </tr>
            </thead>
            <tbody>
              {twYears.map((y) => {
                const [m, ms] = taiwan.marriages[String(y)];
                const [d, ds] = taiwan.divorces[String(y)] ?? [null, null];
                return (
                  <tr key={y}>
                    <th scope="row">{y}</th>
                    <td className="num">
                      {count(m)}
                      {ms != null && text.sameSex(ms)}
                    </td>
                    <td className="num">
                      {d == null ? '—' : count(d)}
                      {ds != null && text.sameSex(ds)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="note">{text.twNote}</p>
        </section>
      )}
    </>
  );
}
