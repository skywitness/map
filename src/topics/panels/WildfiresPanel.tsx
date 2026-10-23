import { useMemo } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, type BarSeriesOption } from 'echarts/charts';
import type { GridComponentOption, LegendComponentOption, TooltipComponentOption } from 'echarts/components';
import { BarList } from '../../charts/BarList';
import { EChart, escapeHtml, type ChartOption } from '../../charts/EChart';
import { stackedAreaOption } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatLargeTick } from '../../lib/format';
import type { Hue, Tokens } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

// 共用的 EChart 只註冊了折線圖；每月燒毀面積的長條圖在這裡按需加上（echarts.use 是全域註冊，只會加一次）
echarts.use([BarChart]);

type MonthlyOption = echarts.ComposeOption<BarSeriesOption | GridComponentOption | LegendComponentOption | TooltipComponentOption>;

type LandCover = 'forest' | 'savannas' | 'shrublands_grasslands' | 'croplands' | 'other';

/** pipeline/topics/wildfires.py 輸出的 countries/<ISO3>.json，面積都是公頃（整數） */
interface ProfileFile {
  /** 第一年；第 i 個值是 first + i 年 */
  first: number;
  /** 5 種土地覆蓋每年的燒毀面積 */
  landcover: Record<LandCover, number[]>;
  /** 每月的燒毀面積（5 種合計），第 (年 − first) × 12 + 月 個 */
  monthly: number[];
  /** 只有台灣：林業及自然保育署的森林火災統計（次數、被害面積公頃），satellite 是同一年衛星的燒毀面積（公頃） */
  official?: { years: number[]; fires: number[]; ha: number[]; satellite: (number | null)[] };
}

// 堆疊由下而上的順序與配色：沿用飲食主題驗證過的相鄰配色（綠、黃、洋紅、藍、青）
const LANDCOVER: { id: LandCover; label: Text; hue: Hue }[] = [
  { id: 'forest', label: { zh: '森林', en: 'Forest' }, hue: 'green' },
  { id: 'savannas', label: { zh: '疏林草原', en: 'Savannas' }, hue: 'yellow' },
  { id: 'shrublands_grasslands', label: { zh: '灌叢與草地', en: 'Shrublands and grasslands' }, hue: 'magenta' },
  { id: 'croplands', label: { zh: '農地', en: 'Croplands' }, hue: 'blue' },
  { id: 'other', label: { zh: '其他', en: 'Other' }, hue: 'aqua' },
];

const TEXT = defineMessages({
  zh: {
    noCountry: '沒有這個國家的燒毀面積資料。',
    title: '燒毀的土地類型',
    chartAria: (country: string) => `${country}歷年各類土地燒毀面積堆疊面積圖`,
    byType: (year: number) => `${year} 年燒毀的土地類型`,
    listAria: (country: string, year: number) => `${country}${year} 年各類土地的燒毀面積`,
    none: (year: number) => `${year} 年衛星沒有偵測到燒毀的土地。`,
    typeNote:
      '土地類型是 GWIS 依 MODIS 的年度土地覆蓋圖分的 5 類。「森林」只有樹冠濃密的林地，比較稀疏的林地' +
      '（加拿大、俄羅斯的北方林很多是這樣）算在疏林草原，所以林火的面積不能只看森林；其他是不屬於前四類的土地。',
    monthly: '每月燒毀面積',
    average: (a: number, b: number) => `${a}–${b} 年平均`,
    year: (year: number) => `${year} 年`,
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    monthlyAria: (country: string, year: number, a: number, b: number) =>
      `${country}每月燒毀面積長條圖：${year} 年與 ${a}–${b} 年平均`,
    official: '林業及自然保育署的森林火災統計',
    officialNote:
      '林保署只計林地上的森林火災，平均每次約 1 公頃；衛星的網格約 21.5 公頃，看不到這些小火，' +
      '但會算到林地以外燒過的地表（台灣多半是農地燒除，見上面的土地類型），所以兩者的數字常常對不上。' +
      '2009 年以前是臺灣地區，2010 年起含金門、連江。',
    officialCaption: '林業及自然保育署的森林火災次數與被害面積，對照衛星偵測的燒毀面積（公頃）',
    colYear: '年',
    colFires: '火災次數',
    colOfficialHa: '被害面積（公頃）',
    colSatelliteHa: '衛星燒毀面積（公頃）',
  },
  en: {
    noCountry: 'No burned area data for this country.',
    title: 'Land cover burned',
    chartAria: (country) => `Stacked area chart of burned area by land cover in ${country} over time`,
    byType: (year) => `Land cover burned, ${year}`,
    listAria: (country, year) => `Burned area by land cover in ${country}, ${year}`,
    none: (year) => `The satellite detected no burned land in ${year}.`,
    typeNote:
      'GWIS sorts burned land into 5 classes using MODIS annual land cover maps. Forest means dense tree cover only; more ' +
      'open woodland (much of the boreal forest in Canada and Russia) counts as savanna, so forest fires are not just the ' +
      'forest class. Other is land outside the first four.',
    monthly: 'Burned area by month',
    average: (a, b) => `${a}–${b} average`,
    year: (year) => `${year}`,
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    monthlyAria: (country, year, a, b) => `Bar chart of monthly burned area in ${country}: ${year} and the ${a}–${b} average`,
    official: 'Forest fires recorded by the Forestry and Nature Conservation Agency',
    officialNote:
      'The agency counts only fires on forest land, about 1 ha each on average; a satellite grid cell is about 21.5 ha, too ' +
      'coarse for these small fires, but it also counts burned ground outside forest land (in Taiwan mostly crop burning; ' +
      'see land cover above), so the two figures rarely match. Up to 2009 the figures cover Taiwan only; from 2010 they ' +
      'include Kinmen and Matsu.',
    officialCaption: 'Forest fires and area burned recorded by the Forestry and Nature Conservation Agency, against satellite-detected burned area (ha)',
    colYear: 'Year',
    colFires: 'Fires',
    colOfficialHa: 'Area (ha)',
    colSatelliteHa: 'Satellite (ha)',
  },
});

/** 公頃 → 平方公里；小的值（台灣）只有零點幾平方公里 */
function km2Number(km2: number): string {
  if (km2 === 0) return '0';
  return fixed(km2, km2 < 1 ? 2 : km2 < 100 ? 1 : 0);
}
const KM2 = { zh: '平方公里', en: 'km²' };

export default function WildfiresPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<ProfileFile>(`topics/${topic.id}/countries/${iso3}.json`);

  const view = useMemo(() => {
    if (!data) return null;
    const count = data.landcover.forest.length;
    const years = Array.from({ length: count }, (_, i) => data.first + i);
    // 時間軸的年份超出資料範圍時（例如今年），改用最近的一年
    const shownYear = Math.min(Math.max(year, data.first), data.first + count - 1);
    const index = shownYear - data.first;
    const km2 = (v: number) => `${km2Number(v)} ${tr(KM2, lang)}`;
    const label = (lc: (typeof LANDCOVER)[number]) => tr(lc.label, lang);

    const option = stackedAreaOption({
      years,
      series: LANDCOVER.map((lc) => ({
        name: label(lc),
        values: data.landcover[lc.id].map((ha) => ha / 100),
        color: tokens.hues[lc.hue],
      })),
      year: shownYear,
      format: km2,
      formatTick: formatLargeTick,
      tokens,
    });
    const items = LANDCOVER.map((lc) => ({
      key: lc.id,
      label: label(lc),
      value: data.landcover[lc.id][index] / 100,
      color: tokens.hues[lc.hue],
    }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    // 每月：所有年份的平均與選定的那一年
    const average = Array.from({ length: 12 }, (_, m) => {
      let sum = 0;
      for (let i = 0; i < count; i++) sum += data.monthly[i * 12 + m];
      return sum / count / 100;
    });
    const months = data.monthly.slice(index * 12, index * 12 + 12).map((ha) => ha / 100);
    const range = [years[0], years[count - 1]] as const;
    const monthlyChart = monthlyOption({
      months: text.months,
      average,
      year: months,
      names: { average: text.average(...range), year: text.year(shownYear) },
      color: tokens.hues.orange,
      format: km2,
      tokens,
    });

    const o = data.official;
    const official = o
      ? o.years.map((y, i) => ({ year: y, fires: o.fires[i], ha: o.ha[i], satellite: o.satellite[i] }))
      : null;
    return { shownYear, option, items, monthlyChart, range, km2, official };
  }, [data, year, tokens, lang, text]);

  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!view) return <p className="empty">{t.loading}</p>;

  const total = view.items.reduce((sum, i) => sum + i.value, 0);
  return (
    <>
      <section className="panel-section">
        <h3>{text.title}</h3>
        <EChart option={view.option} height={200} ariaLabel={text.chartAria(countryName)} />
        <h4>
          {text.byType(view.shownYear)}
          {view.shownYear !== year && <span className="muted">{t.yearMissing(year)}</span>}
        </h4>
        {view.items.length > 0 ? (
          <BarList items={view.items} format={view.km2} total={total} ariaLabel={text.listAria(countryName, view.shownYear)} />
        ) : (
          <p className="note">{text.none(view.shownYear)}</p>
        )}
        <p className="note">{text.typeNote}</p>
      </section>
      <section className="panel-section">
        <h3>{text.monthly}</h3>
        <EChart
          option={view.monthlyChart}
          height={170}
          ariaLabel={text.monthlyAria(countryName, view.shownYear, view.range[0], view.range[1])}
        />
      </section>
      {view.official && (
        <section className="panel-section">
          <h3>{text.official}</h3>
          <table className="mini-table" aria-label={text.officialCaption}>
            <thead>
              <tr>
                <th scope="col">{text.colYear}</th>
                <th scope="col" className="num">{text.colFires}</th>
                <th scope="col" className="num">{text.colOfficialHa}</th>
                <th scope="col" className="num">{text.colSatelliteHa}</th>
              </tr>
            </thead>
            <tbody>
              {view.official
                .slice()
                .reverse()
                .map((row) => (
                  <tr key={row.year} aria-current={row.year === view.shownYear ? 'true' : undefined}>
                    <th scope="row">{row.year}</th>
                    <td className="num">{fixed(row.fires, 0)}</td>
                    <td className="num">{fixed(row.ha, row.ha < 10 ? 2 : 1)}</td>
                    <td className="num">{row.satellite === null ? '—' : fixed(row.satellite, 0)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="note">{text.officialNote}</p>
        </section>
      )}
    </>
  );
}

interface MonthlyInput {
  months: string[];
  average: number[];
  year: number[];
  names: { average: string; year: string };
  /** 選定年份的顏色；平均值用中性的灰色（對照用） */
  color: string;
  format: (v: number) => string;
  tokens: Tokens;
}

/** 一年 12 個月的長條圖：所有年份的平均（灰色）與選定年份（彩色），看得出火季在哪幾個月 */
function monthlyOption({ months, average, year, names, color, format, tokens }: MonthlyInput): ChartOption {
  const series: BarSeriesOption[] = [
    {
      type: 'bar',
      name: names.average,
      data: average,
      color: tokens.context,
      itemStyle: { color: tokens.context, borderRadius: [3, 3, 0, 0] },
      barGap: '15%',
      barCategoryGap: '30%',
      emphasis: { disabled: true },
    },
    {
      type: 'bar',
      name: names.year,
      data: year,
      color,
      itemStyle: { color, borderRadius: [3, 3, 0, 0] },
      emphasis: { disabled: true },
    },
  ];
  const option: MonthlyOption = {
    animation: false,
    grid: { left: 4, right: 8, top: 28, bottom: 4, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    legend: {
      top: 0,
      left: 0,
      textStyle: { color: tokens.inkSecondary, fontSize: 12 },
      itemWidth: 14,
      itemHeight: 8,
      selectedMode: false,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      textStyle: { color: tokens.ink, fontSize: 12 },
      extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.12); border-radius: 6px;',
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const head = escapeHtml(String((list[0] as { axisValue?: string }).axisValue ?? ''));
        const rows = list.map(
          (p) =>
            `<div class="tt-row"><span class="tt-key" style="background:${p.color}"></span>` +
            `<strong>${escapeHtml(format(p.value as number))}</strong>` +
            `<span class="tt-name">${escapeHtml(p.seriesName ?? '')}</span></div>`,
        );
        return `<div class="tt-head">${head}</div>${rows.join('')}`;
      },
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLine: { lineStyle: { color: tokens.axis } },
      axisTick: { show: false },
      axisLabel: { color: tokens.inkMuted, fontSize: 11, interval: 1 },
    },
    yAxis: {
      type: 'value',
      minInterval: 0.01,
      splitLine: { lineStyle: { color: tokens.grid, width: 1 } },
      axisLabel: { color: tokens.inkMuted, fontSize: 11, formatter: (v: number) => formatLargeTick(v) },
    },
    series,
  };
  return option as unknown as ChartOption;
}
