import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { Chart } from '../../charts/Chart';
import { stackedAreaOption, type StackedSeries } from '../../charts/stackedArea';
import { defineMessages, tr, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';
import PlasticPanel from './PlasticPanel';

/** routes-detail.json（pipeline/topics/waste_europe.py）：每人每年公斤 */
interface RoutesDetail {
  years: number[];
  countries: Record<
    string,
    {
      generated: (number | null)[];
      landfilled: (number | null)[];
      incinerated: (number | null)[];
      material: (number | null)[];
      composted: (number | null)[];
      otherRecycled: (number | null)[];
    }
  >;
  taiwan: {
    years: number[];
    landfilled: number[];
    incinerated: number[];
    recycled: number[];
    other: number[];
    rateYears: number[];
    /** 縣市（環境部的寫法）→ 一般廢棄物回收率（%），對應 rateYears */
    rates: Record<string, (number | null)[]>;
  };
}

/** 環境部 STAT_P_46 的 22 縣市的英文 */
const COUNTIES: { zh: string; en: string }[] = [
  { zh: '臺北市', en: 'Taipei' }, { zh: '新北市', en: 'New Taipei' }, { zh: '桃園市', en: 'Taoyuan' },
  { zh: '臺中市', en: 'Taichung' }, { zh: '臺南市', en: 'Tainan' }, { zh: '高雄市', en: 'Kaohsiung' },
  { zh: '基隆市', en: 'Keelung' }, { zh: '新竹市', en: 'Hsinchu City' }, { zh: '嘉義市', en: 'Chiayi City' },
  { zh: '新竹縣', en: 'Hsinchu County' }, { zh: '苗栗縣', en: 'Miaoli County' }, { zh: '彰化縣', en: 'Changhua County' },
  { zh: '南投縣', en: 'Nantou County' }, { zh: '雲林縣', en: 'Yunlin County' }, { zh: '嘉義縣', en: 'Chiayi County' },
  { zh: '屏東縣', en: 'Pingtung County' }, { zh: '宜蘭縣', en: 'Yilan County' }, { zh: '花蓮縣', en: 'Hualien County' },
  { zh: '臺東縣', en: 'Taitung County' }, { zh: '澎湖縣', en: 'Penghu County' }, { zh: '金門縣', en: 'Kinmen County' },
  { zh: '連江縣', en: 'Lienchiang County' },
];

const TEXT = defineMessages({
  zh: {
    title: '垃圾的去處（每人每年公斤）',
    aria: (country: string) => `${country}歷年的都市垃圾，依去處`,
    landfilled: '掩埋與其他處置',
    incinerated: '焚化',
    material: '物質回收',
    composted: '堆肥與厭氧消化',
    otherRecycled: '其他回收（準備再使用等）',
    recycled: '回收再利用',
    other: '其他處理',
    generated: (year: number, value: string) => `${year} 年產生 ${value}。`,
    note: 'Eurostat env_wasmun。各項加起來不一定等於產生量（出口、庫存、統計差）。',
    twTitle: '台灣：一般廢棄物的處理方式（每人每年公斤）',
    twAria: '台灣歷年的一般廢棄物處理量，依處理方式',
    twNote:
      '環境部「全國一般廢棄物處理量」÷ 聯合國 WPP 2024 的人口。回收再利用含資源回收、廚餘與巨大垃圾再利用，口徑比歐洲的回收寬。',
    ratesTitle: (year: number) => `台灣各縣市的一般廢棄物回收率（${year} 年）`,
    ratesAria: '台灣各縣市的一般廢棄物回收率',
    ratesNote: '環境部的定義：（資源垃圾 + 廚餘）÷ 一般廢棄物產生量。',
  },
  en: {
    title: 'Where municipal waste goes (kg per person per year)',
    aria: (country) => `Municipal waste in ${country} over time, by route`,
    landfilled: 'Landfill and other disposal',
    incinerated: 'Incineration',
    material: 'Material recycling',
    composted: 'Composting and digestion',
    otherRecycled: 'Other recycling (preparing for reuse etc.)',
    recycled: 'Recycled and reused',
    other: 'Other treatment',
    generated: (year, value) => `${value} generated in ${year}.`,
    note: 'Eurostat env_wasmun. The routes need not add up to waste generated (exports, stockpiles, statistical differences).',
    twTitle: 'Taiwan: how municipal waste is treated (kg per person per year)',
    twAria: 'Taiwan’s municipal waste treatment over time, by method',
    twNote:
      'Ministry of Environment municipal waste treatment amounts divided by UN WPP 2024 population. “Recycled and reused” includes recyclables, food waste and reused bulky waste, a broader scope than Europe’s recycling.',
    ratesTitle: (year) => `Municipal waste recycling rate by city and county, Taiwan (${year})`,
    ratesAria: 'Municipal waste recycling rate by city and county in Taiwan',
    ratesNote: 'Ministry of Environment definition: (recyclables + food waste) ÷ municipal waste generated.',
  },
});

const kg = (v: number) => tr({ zh: `${fixed(v, 0)} 公斤`, en: `${fixed(v, 0)} kg` });
const clampYear = (years: number[], year: number) => Math.min(Math.max(year, years[0]), years[years.length - 1]);

export default function WasteRoutesPanel(props: PanelExtraProps) {
  const { iso3, year, countryName, tokens } = props;
  const lang = useLang();
  const text = TEXT[lang];
  const detail = useJson<RoutesDetail>('topics/waste/routes-detail.json').data;
  const format = kg;
  const country = detail?.countries[iso3];

  const chart = useMemo(() => {
    if (!detail || !country) return null;
    // 有資料的年份才畫（多數國家 1995 年起，有些國家晚幾年）
    const first = detail.years.findIndex((_, i) => country.landfilled[i] !== null || country.incinerated[i] !== null);
    const last = detail.years.length - 1 - [...detail.years].reverse().findIndex((_, k) => country.landfilled[detail.years.length - 1 - k] !== null);
    if (first < 0) return null;
    const years = detail.years.slice(first, last + 1);
    const cut = (values: (number | null)[]) => values.slice(first, last + 1);
    const series: StackedSeries[] = [
      { name: text.landfilled, values: cut(country.landfilled), color: tokens.hues.orange },
      { name: text.incinerated, values: cut(country.incinerated), color: tokens.hues.red },
      { name: text.material, values: cut(country.material), color: tokens.hues.blue },
      { name: text.composted, values: cut(country.composted), color: tokens.hues.green },
      { name: text.otherRecycled, values: cut(country.otherRecycled), color: tokens.context },
    ];
    return {
      spec: stackedAreaOption({ years, series, year: clampYear(years, year), format, formatTick: (v) => fixed(v, 0), tokens }),
      years,
    };
  }, [detail, country, year, tokens, text, format]);

  const tw = iso3 === 'TWN' ? detail?.taiwan : undefined;
  const twChart = useMemo(() => {
    if (!tw) return null;
    const series: StackedSeries[] = [
      { name: text.landfilled, values: tw.landfilled, color: tokens.hues.orange },
      { name: text.incinerated, values: tw.incinerated, color: tokens.hues.red },
      { name: text.recycled, values: tw.recycled, color: tokens.hues.aqua },
      { name: text.other, values: tw.other, color: tokens.context },
    ];
    return stackedAreaOption({ years: tw.years, series, year: clampYear(tw.years, year), format, formatTick: (v) => fixed(v, 0), tokens });
  }, [tw, year, tokens, text, format]);

  const rateYear = tw ? clampYear(tw.rateYears, year) : null;
  const rates: BarListItem[] = useMemo(() => {
    if (!tw || rateYear === null) return [];
    const i = tw.rateYears.indexOf(rateYear);
    return Object.entries(tw.rates)
      .filter(([, values]) => values[i] != null)
      .map(([county, values]) => ({ key: county, label: lang === 'zh' ? county : (COUNTIES.find((c) => c.zh === county)?.en ?? county), value: values[i]! }))
      .sort((a, b) => b.value - a.value);
  }, [tw, rateYear, lang]);

  const generatedAt = (() => {
    if (!detail || !country || !chart) return null;
    const y = clampYear(chart.years, year);
    const v = country.generated[detail.years.indexOf(y)];
    return v == null ? null : text.generated(y, format(v));
  })();

  return (
    <>
      {chart && (
        <section className="panel-section">
          <h3>{text.title}</h3>
          <Chart spec={chart.spec} height={180} ariaLabel={text.aria(countryName)} />
          <p className="note">
            {generatedAt} {text.note}
          </p>
        </section>
      )}
      {tw && (
        <section className="panel-section">
          <h3>{text.twTitle}</h3>
          {twChart && <Chart spec={twChart} height={160} ariaLabel={text.twAria} />}
          <p className="note">{text.twNote}</p>
          {rateYear !== null && rates.length > 0 && (
            <>
              <h4>{text.ratesTitle(rateYear)}</h4>
              <BarList items={rates} format={(v) => `${fixed(v, 1)}%`} max={100} ariaLabel={text.ratesAria} />
              <p className="note">{text.ratesNote}</p>
            </>
          )}
        </section>
      )}
      <PlasticPanel {...props} />
    </>
  );
}
