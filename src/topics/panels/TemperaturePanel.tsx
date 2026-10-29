import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';


/** pipeline/topics/temperature.py 的 write_monthly() 輸出 */
interface MonthlyFile {
  /** 每月的氣候平均值（1991–2020）；annual 是全年的值（年均溫、年雨量），跟指標檔同一個算法 */
  normal: { years: [number, number]; tmp: number[]; pre: number[]; annual: { tmp: number; pre: number } };
  /** 逐月值的第一年；第 (年 − first) × 12 + 月 個 */
  first: number;
  /** °C */
  tmp: number[];
  /** mm */
  pre: number[];
  /**
   * 每年的全年值（第 年 − first 個），跟指標檔、數值卡片同一個值。
   * 不要用四捨五入後的逐月值重算：年雨量常差 1 mm、年均溫差 0.1 °C。
   */
  annual: { tmp: number[]; pre: number[] };
}

const TEXT = defineMessages({
  zh: {
    noCountry: '沒有這個國家的逐月氣候資料。',
    title: '每月氣溫與降雨',
    normal: (a: number, b: number) => `${a}–${b} 年平均`,
    year: (year: number) => `${year} 年`,
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    temperature: '月平均氣溫',
    precipitation: '月降雨量',
    tempAria: (country: string, year: number, a: number, b: number) =>
      `${country}每月平均氣溫折線圖：${year} 年與 ${a}–${b} 年平均`,
    rainAria: (country: string, year: number, a: number, b: number) =>
      `${country}每月降雨量長條圖：${year} 年與 ${a}–${b} 年平均`,
    summary: (label: string, t: string, p: string) => `${label}：年均溫 ${t}、年雨量 ${p}`,
    month: '月份',
    tempCol: (label: string) => `${label} °C`,
    rainCol: (label: string) => `${label} 毫米`,
    annual: '全年',
    tableCaption: (country: string) => `${country}每月平均氣溫（°C）與降雨量（毫米）`,
    note: '全國陸地的面積平均（CRU TS），含山區與沙漠，跟首都或單一測站的數字不同。',
  },
  en: {
    noCountry: 'No monthly climate data for this country.',
    title: 'Monthly temperature and precipitation',
    normal: (a, b) => `${a}–${b} average`,
    year: (year) => `${year}`,
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    temperature: 'Monthly mean temperature',
    precipitation: 'Monthly precipitation',
    tempAria: (country, year, a, b) => `Line chart of monthly mean temperature in ${country}: ${year} and the ${a}–${b} average`,
    rainAria: (country, year, a, b) => `Bar chart of monthly precipitation in ${country}: ${year} and the ${a}–${b} average`,
    summary: (label, t, p) => `${label}: mean ${t}, total ${p}`,
    month: 'Month',
    tempCol: (label) => `${label} °C`,
    rainCol: (label) => `${label} mm`,
    annual: 'Year',
    tableCaption: (country) => `Monthly mean temperature (°C) and precipitation (mm) in ${country}`,
    note: 'Area average over the country’s land (CRU TS), mountains and deserts included, so it differs from figures for the capital or any single station.',
  },
});

const MM = { zh: '毫米', en: 'mm' };
const celsius = (v: number) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), 1)} °C`;
const tempCell = (v: number) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), 1)}`;
const rainCell = (v: number) => fixed(v, v < 10 ? 1 : 0);

export default function TemperaturePanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<MonthlyFile>(`topics/${topic.id}/countries/${iso3}.json`);

  const view = useMemo(() => {
    if (!data) return null;
    const count = Math.floor(data.tmp.length / 12);
    // 時間軸的年份超出逐月資料的範圍時，改用最近的一年
    const shownYear = Math.min(Math.max(year, data.first), data.first + count - 1);
    const i = (shownYear - data.first) * 12;
    const yearTmp = data.tmp.slice(i, i + 12);
    const yearPre = data.pre.slice(i, i + 12);
    const yearAnnual = { tmp: data.annual.tmp[shownYear - data.first], pre: data.annual.pre[shownYear - data.first] };
    const [a, b] = data.normal.years;
    const normalLabel = text.normal(a, b);
    const yearLabel = text.year(shownYear);
    const mm = (v: number) => `${rainCell(v)} ${MM[lang]}`;
    const series = {
      normal: { name: normalLabel, color: tokens.context },
      year: { name: yearLabel },
    };
    const tempOption = monthlyOption({
      months: text.months,
      kind: 'line',
      normal: data.normal.tmp,
      year: yearTmp,
      names: series,
      color: tokens.hues.orange,
      format: celsius,
      tick: (v) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), Number.isInteger(v) ? 0 : 1)}`,
    });
    const rainOption = monthlyOption({
      months: text.months,
      kind: 'bar',
      normal: data.normal.pre,
      year: yearPre,
      names: series,
      color: tokens.hues.blue,
      format: mm,
      tick: (v) => fixed(v, 0),
    });
    return {
      shownYear,
      normalYears: [a, b] as const,
      normalLabel,
      yearLabel,
      normal: data.normal,
      yearTmp,
      yearPre,
      yearAnnual,
      tempOption,
      rainOption,
      mm,
    };
  }, [data, year, tokens, lang, text]);

  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!view) return <p className="empty">{t.loading}</p>;

  const [a, b] = view.normalYears;
  return (
    <section className="panel-section">
      <h3>
        {text.title}
        {view.shownYear !== year && <span className="muted">{t.yearMissing(year)}</span>}
      </h3>
      <p className="note">
        {text.summary(view.normalLabel, celsius(view.normal.annual.tmp), view.mm(view.normal.annual.pre))}
        <br />
        {text.summary(view.yearLabel, celsius(view.yearAnnual.tmp), view.mm(view.yearAnnual.pre))}
      </p>
      <h4>{text.temperature}</h4>
      <Chart spec={view.tempOption} height={170} ariaLabel={text.tempAria(countryName, view.shownYear, a, b)} />
      <h4>{text.precipitation}</h4>
      <Chart spec={view.rainOption} height={170} ariaLabel={text.rainAria(countryName, view.shownYear, a, b)} />
      <table className="mini-table" aria-label={text.tableCaption(countryName)}>
        <thead>
          <tr>
            <th scope="col">{text.month}</th>
            <th scope="col" className="num">{text.tempCol(`${a}–${b}`)}</th>
            <th scope="col" className="num">{text.tempCol(String(view.shownYear))}</th>
            <th scope="col" className="num">{text.rainCol(`${a}–${b}`)}</th>
            <th scope="col" className="num">{text.rainCol(String(view.shownYear))}</th>
          </tr>
        </thead>
        <tbody>
          {text.months.map((month, m) => (
            <tr key={month}>
              <th scope="row">{month}</th>
              <td className="num">{tempCell(view.normal.tmp[m])}</td>
              <td className="num">{tempCell(view.yearTmp[m])}</td>
              <td className="num">{rainCell(view.normal.pre[m])}</td>
              <td className="num">{rainCell(view.yearPre[m])}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">{text.annual}</th>
            <td className="num">{tempCell(view.normal.annual.tmp)}</td>
            <td className="num">{tempCell(view.yearAnnual.tmp)}</td>
            <td className="num">{fixed(view.normal.annual.pre, 0)}</td>
            <td className="num">{fixed(view.yearAnnual.pre, 0)}</td>
          </tr>
        </tbody>
      </table>
      <p className="note">{text.note}</p>
    </section>
  );
}

interface MonthlyInput {
  months: string[];
  kind: 'line' | 'bar';
  normal: number[];
  year: number[];
  names: { normal: { name: string; color: string }; year: { name: string } };
  /** 選定年份的顏色；氣候平均值用中性的灰色（對照用） */
  color: string;
  format: (v: number) => string;
  tick: (v: number) => string;
}

/**
 * 一年 12 個月：氣候平均值（灰色）與選定年份（彩色）。氣溫、降雨分成兩張圖，各自一個 y 軸：
 * 不畫成雙 y 軸的氣候圖，兩個刻度疊在一起很難讀。
 */
function monthlyOption({ months, kind, normal, year, names, color, format, tick }: MonthlyInput): ChartSpec {
  return {
    x: { type: 'category', labels: months, showLabel: (i) => i % 2 === 0 },
    // 氣溫不必從 0 開始（熱帶國家整年 25–28 °C，從 0 開始就看不出季節變化）；長條圖一定從 0 開始
    y: { format: tick, zero: kind === 'bar' },
    series:
      kind === 'line'
        ? [
            { type: 'line', name: names.normal.name, values: normal, color: names.normal.color, dashed: true },
            { type: 'line', name: names.year.name, values: year, color, dots: true },
          ]
        : [
            { type: 'bar', name: names.normal.name, values: normal, color: names.normal.color },
            { type: 'bar', name: names.year.name, values: year, color },
          ],
    tooltip: (i) => ({
      head: months[i],
      rows: [
        { color: names.normal.color, value: format(normal[i]), name: names.normal.name, box: kind === 'bar' },
        ...(year[i] != null ? [{ color, value: format(year[i]), name: names.year.name, box: kind === 'bar' }] : []),
      ],
    }),
  };
}
