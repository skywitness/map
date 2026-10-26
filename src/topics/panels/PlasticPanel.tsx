import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { EChart } from '../../charts/EChart';
import { stackedAreaOption, type StackedSeries } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber, formatLargeTick, formatPercent } from '../../lib/format';
import { flowSelection } from '../../map/flows';
import { HUE_ORDER } from '../../theme/tokens';
import { tonnes as tonnesLarge } from '../plastic';
import type { FlowDirection, FlowFile, PanelExtraProps } from '../types';

/**
 * 塑膠污染的側欄（pipeline/topics/plastic.py 的 countries/<ISO3>.json 與 flows/<年>.json）：
 * - 排放的來源（Cottom 等人的 SPOT 模型，2020 年）：五種來源、碎片與露天焚燒、90% 區間，塑膠垃圾產生量與收集服務
 * - 河川流入海洋（Meijer 等人，2015 年）：河口數、最大的幾個河口
 * - 塑膠廢料的貿易（BACI HS 3915）：這一年的主要對象（流向檔），1995 年起累計最多的 6 個夥伴的歷年堆疊面積
 * - 台灣：環境部的一般廢棄物與資源回收、財政部 HS 3915 的進出口值對照 BACI（都是另一種量測）
 */

type Source = 'uncollected' | 'disposal' | 'litter' | 'recycling' | 'collection';
const SOURCES: Source[] = ['uncollected', 'disposal', 'litter', 'recycling', 'collection'];

interface PlasticDetail {
  spot?: {
    em: number;
    range: [number, number];
    debris: number;
    burn: number;
    sources: Record<Source, number>;
    pwg: number;
    collection: number;
    controlled: number;
    noCollection: number;
  };
  ocean?: { total: number; rank: number; of: number; outlets: number; top: [number, number, number][] };
  trade?: { years: number[] } & Partial<Record<FlowDirection, { partners: [string, number[]][]; other: number[] }>>;
  taiwan?: {
    waste: { years: number[]; generated: number[]; garbage: number[]; recycled: number[]; food: number[] };
    plastics: { years: number[]; plastics: number[]; containers: number[]; recyclables: number[] };
    mof: {
      years: number[];
      export: number[];
      import: number[];
      baciExport: (number | null)[];
      baciImport: (number | null)[];
      tonnesExport: (number | null)[];
      tonnesImport: (number | null)[];
    };
  };
}

/** 這一年的主要對象列出幾個（流向檔每國存前 15 名） */
const SHOWN = 8;
/** 財政部對照表列出的年份 */
const MOF_YEARS = [2011, 2014, 2016, 2017, 2018, 2019, 2020, 2022, 2024, 2025];
/** 一般廢棄物從這一年起納入事業員工生活產生的垃圾（統計範圍改變） */
const WASTE_BREAK = 2018;

const TEXT = defineMessages({
  zh: {
    sourcesTitle: '塑膠污染從哪裡來（2020 年，模型估計）',
    sourcesSummary: (total: string, low: string, high: string) => `合計 ${total}（90% 區間 ${low}–${high}）。`,
    formSplit: (debris: string, burn: string) => `塑膠碎片 ${debris}、露天焚燒 ${burn}。`,
    noEmission: '模型估計這裡幾乎沒有排放。',
    sources: {
      uncollected: '未收集的垃圾',
      disposal: '沒有控制的棄置場',
      litter: '亂丟的垃圾',
      recycling: '回收分選的殘渣',
      collection: '收集與運輸過程',
    } as Record<Source, string>,
    sourcesAria: (country: string) => `${country}塑膠污染的來源`,
    wasteRows: {
      pwg: '塑膠垃圾產生量',
      collection: '垃圾收集服務涵蓋率',
      controlled: '在有控制的設施處理（SDG 11.6.1）',
      noCollection: '沒有垃圾收集的人口',
    },
    people: (v: string) => `${v} 人`,
    sourcesNote:
      'Cottom 等人（2024）的 SPOT 模型：一般垃圾裡大於 5 mm 的塑膠跑到環境裡的量。未收集的垃圾在家附近被丟棄或燒掉；棄置場是露天的垃圾場；回收分選的殘渣包括非正式回收（拾荒）挑剩、燒掉的。收集涵蓋率不含沒收集的亂丟垃圾。',
    oceanTitle: '河川流入海洋（2015 年，模型估計）',
    oceanSummary: (n: string, total: string, rank: number, of: number) =>
      `${n} 個河口每年排放 0.1 公噸以上，合計 ${total}，${of} 個國家中第 ${rank} 名。最大的幾個河口：`,
    outlet: (lat: string, lon: string) => `北緯 ${lat}°、東經 ${lon}°`,
    outletSouth: (lat: string, lon: string) => `${lat}°、${lon}°`,
    oceanAria: (country: string) => `${country}排放最多的河口`,
    oceanNote: 'Meijer 等人（2021）的模型（中間情境）；位置是模型的河口格點，沒有河名。',
    tradeTitle: (what: string, year: number) => `${what}（${year} 年）`,
    exportTitle: '塑膠廢料出口到',
    importTitle: '塑膠廢料進口自',
    total: (total: string) => `合計 ${total}`,
    noYear: (year: number) => `${year} 年沒有塑膠廢料的貿易資料。`,
    rest: (total: string, share: string) => `其他夥伴合計 ${total}（${share}）。`,
    listAria: (country: string, title: string) => `${country}${title}`,
    historyAria: (country: string, title: string) => `${country}歷年${title}，依夥伴`,
    historyNote: 'BACI 的 HS 3915（塑膠的廢料、下腳及碎屑），公噸。歷年圖分開畫 1995 年起累計最多的 6 個夥伴，其他併成一層。',
    other: '其他',
    twTitle: '台灣的官方統計（跟模型是不同的量測）',
    wasteTitle: '一般廢棄物的去處（環境部，公噸）',
    garbage: '一般垃圾（焚化、掩埋）',
    recycled: '資源回收',
    food: '廚餘回收',
    wasteAria: '台灣歷年的一般廢棄物，依去處',
    wasteNote: (year: number) =>
      `環境部「一般廢棄物清理情況」的縣市加總。${year} 年起依廢棄物清理法修正的定義，納入事業員工生活產生的垃圾（虛線），產生量跳升，跟之前不能直接比較。`,
    rateTable: '回收率與回收的塑膠',
    colYear: '年',
    rate: '回收率',
    plastics: '塑膠及橡膠製品（執行機關，公噸）',
    containers: '塑膠容器（公告應回收，公噸）',
    rateNote:
      '回收率是一般廢棄物回收率 =（資源回收＋廚餘回收）÷ 產生量，環境部的定義。塑膠及橡膠製品是各縣市清潔隊（執行機關）回收的；塑膠容器是公告應回收（含回收業）的回收量，兩者有重疊，不能相加。這些是回收的量，不是排放到環境的量。',
    mofTitle: '塑膠廢料的進出口值：財政部對照 BACI（百萬美元）',
    mofExport: '出口 財政部',
    mofImport: '進口 財政部',
    baci: 'BACI',
    mofAria: '台灣 HS 3915 的進出口值，財政部與 BACI',
    mofNote: (year: number, ex: string, im: string) =>
      `財政部是海關的統計；BACI 的台灣來自貿易夥伴的申報（出口用進口國的申報扣掉運費保險），兩者有落差。BACI ${year} 年的數量：出口 ${ex}、進口 ${im}。`,
  },
  en: {
    sourcesTitle: 'Where plastic pollution comes from (2020, model estimate)',
    sourcesSummary: (total, low, high) => `Total ${total} (90% interval ${low}–${high}).`,
    formSplit: (debris, burn) => `Debris ${debris}, open burning ${burn}.`,
    noEmission: 'The model estimates almost no emissions here.',
    sources: {
      uncollected: 'Uncollected waste',
      disposal: 'Uncontrolled disposal sites',
      litter: 'Litter',
      recycling: 'Sorting and recycling rejects',
      collection: 'Collection and transport',
    },
    sourcesAria: (country) => `Sources of plastic pollution in ${country}`,
    wasteRows: {
      pwg: 'Plastic waste generated',
      collection: 'Waste collection coverage',
      controlled: 'Managed in controlled facilities (SDG 11.6.1)',
      noCollection: 'People without waste collection',
    },
    people: (v) => `${v} people`,
    sourcesNote:
      'Cottom et al. (2024) SPOT model: plastic over 5 mm in municipal waste that escapes into the environment. Uncollected waste is dumped or burned near homes; disposal sites are open dumps; sorting rejects include what informal waste pickers leave or burn. Collection coverage excludes uncollected litter.',
    oceanTitle: 'Rivers into the ocean (2015, model estimate)',
    oceanSummary: (n, total, rank, of) =>
      `${n} river mouths emit 0.1 t or more a year, ${total} in total, #${rank} of ${of} countries. The largest river mouths:`,
    outlet: (lat, lon) => `${lat}°N ${lon}°E`,
    outletSouth: (lat, lon) => `${lat}°, ${lon}°`,
    oceanAria: (country) => `River mouths emitting the most plastic in ${country}`,
    oceanNote: 'Meijer et al. (2021) model (mid-point scenario); positions are model river-mouth cells, without river names.',
    tradeTitle: (what, year) => `${what} (${year})`,
    exportTitle: 'Plastic waste exported to',
    importTitle: 'Plastic waste imported from',
    total: (total) => `Total ${total}`,
    noYear: (year) => `No plastic waste trade data for ${year}.`,
    rest: (total, share) => `Other partners: ${total} (${share}).`,
    listAria: (country, title) => `${title}, ${country}`,
    historyAria: (country, title) => `${title} by partner over time, ${country}`,
    historyNote: 'BACI, HS 3915 (waste, parings and scrap of plastics), tonnes. The history chart shows the six largest partners since 1995 separately and groups the rest.',
    other: 'Other',
    twTitle: 'Taiwan’s official statistics (a different measure from the models)',
    wasteTitle: 'Where municipal waste goes (Ministry of Environment, tonnes)',
    garbage: 'Garbage (incinerated, landfilled)',
    recycled: 'Recycled',
    food: 'Food waste recycled',
    wasteAria: 'Taiwan’s municipal waste by destination over time',
    wasteNote: (year) =>
      `Sum of cities and counties from the Ministry of Environment’s municipal waste statistics. From ${year}, under the revised definition in the Waste Disposal Act, waste from employees at businesses is included (dashed line), so generation jumps and is not directly comparable with earlier years.`,
    rateTable: 'Recycling rate and plastics recycled',
    colYear: 'Year',
    rate: 'Recycling rate',
    plastics: 'Plastics and rubber (local authorities, t)',
    containers: 'Plastic containers (regulated, t)',
    rateNote:
      'The municipal waste recycling rate = (recycled + food waste recycled) ÷ waste generated, as defined by the Ministry of Environment. Plastics and rubber are collected by city and county cleaning teams (local authorities); plastic containers are those recycled under the regulated take-back scheme (including private recyclers). The two overlap and cannot be added. These are amounts recycled, not released into the environment.',
    mofTitle: 'Plastic waste trade value: Ministry of Finance vs BACI (US$ million)',
    mofExport: 'Exports MOF',
    mofImport: 'Imports MOF',
    baci: 'BACI',
    mofAria: 'Taiwan’s trade in HS 3915 by value, Ministry of Finance and BACI',
    mofNote: (year, ex, im) =>
      `The Ministry of Finance figures are customs statistics; BACI’s Taiwan comes from partner reports (exports are importers’ reports net of freight and insurance), so they differ. BACI quantities in ${year}: exports ${ex}, imports ${im}.`,
  },
});

const millions = (v: number | null | undefined) => (v == null ? '–' : fixed(v / 1e6, 1));
/** 側欄的清單寫到個位數（中文的「萬」取整數，1.2 萬與 1.4 萬都會寫成 1 萬）；100 萬以上才用萬、億 */
const tonnes = (v: number) => (v >= 1e6 ? tonnesLarge(v) : tr({ zh: `${fixed(v, 0)} 公噸`, en: `${fixed(v, 0)} t` }));

/** 歷年的夥伴堆疊面積與這一年的主要對象 */
function TradeSection({
  direction,
  detail,
  flows,
  iso3,
  year,
  countryName,
  name,
  tokens,
}: {
  direction: FlowDirection;
  detail: PlasticDetail['trade'];
  flows: FlowFile | null;
  iso3: string;
  year: number;
  countryName: string;
  name: (iso3: string) => string;
  tokens: PanelExtraProps['tokens'];
}) {
  const lang = useLang();
  const text = TEXT[lang];
  const title = direction === 'export' ? text.exportTitle : text.importTitle;
  const block = detail?.[direction];
  const colors = useMemo(
    () => new Map((block?.partners ?? []).map(([p], i) => [p, tokens.hues[HUE_ORDER[i % HUE_ORDER.length]]])),
    [block, tokens],
  );
  const history = useMemo(() => {
    if (!detail || !block) return null;
    const series: StackedSeries[] = [
      ...block.partners.map(([p, values]) => ({ name: name(p), values, color: colors.get(p)! })),
      { name: text.other, values: block.other, color: tokens.context },
    ];
    const marker = Math.min(Math.max(year, detail.years[0]), detail.years[detail.years.length - 1]);
    return stackedAreaOption({ years: detail.years, series, year: marker, format: tonnes, formatTick: formatLargeTick, tokens });
  }, [detail, block, colors, year, name, text, tokens]);

  const selection = flows && flows.year === year ? flowSelection(flows, iso3, direction) : null;
  if (!block && (!selection || selection.links.length === 0)) return null;
  const shown = selection?.links.slice(0, SHOWN) ?? [];
  const rest = selection ? selection.total - shown.reduce((s, l) => s + l.value, 0) : 0;
  const items: BarListItem[] = shown.map((l) => ({ key: l.iso3, label: name(l.iso3), value: l.value, color: colors.get(l.iso3) }));
  return (
    <div className="panel-subsection">
      <h3>{text.tradeTitle(title, year)}</h3>
      {selection && selection.links.length > 0 ? (
        <>
          <p className="panel-year-note">{text.total(tonnes(selection.total))}</p>
          <BarList items={items} format={tonnes} total={selection.total} ariaLabel={text.listAria(countryName, title)} />
          {rest > 0 && <p className="note">{text.rest(tonnes(rest), formatPercent((rest / selection.total) * 100, 1))}</p>}
        </>
      ) : (
        <p className="empty">{text.noYear(year)}</p>
      )}
      {history && <EChart option={history} height={180} ariaLabel={text.historyAria(countryName, title)} />}
    </div>
  );
}

export default function PlasticPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const base = `topics/${topic.id}`;
  const countries = useJson<CountryTable>('countries.json').data;
  const detail = useJson<PlasticDetail>(`${base}/countries/${iso3}.json`);
  const d = detail.data;
  const tradeYears = d?.trade?.years;
  const flowYear = tradeYears ? Math.min(Math.max(year, tradeYears[0]), tradeYears[tradeYears.length - 1]) : null;
  const flows = useJson<FlowFile>(flowYear !== null ? `${base}/flows/${flowYear}.json` : null).data;
  const name = useMemo(() => (code: string) => nameOf(code, countries, lang), [countries, lang]);

  const tw = d?.taiwan;
  const waste = useMemo(() => {
    if (!tw) return null;
    const w = tw.waste;
    const series: StackedSeries[] = [
      { name: text.garbage, values: w.garbage, color: tokens.hues.orange },
      { name: text.recycled, values: w.recycled, color: tokens.hues.aqua },
      { name: text.food, values: w.food, color: tokens.hues.green },
    ];
    const marker = Math.min(Math.max(year, w.years[0]), w.years[w.years.length - 1]);
    return stackedAreaOption({ years: w.years, series, year: marker, methodBreak: WASTE_BREAK, format: tonnes, formatTick: formatLargeTick, tokens });
  }, [tw, year, tokens, text]);

  if (detail.loading) return <p className="empty">{t.loading}</p>;
  if (!d) return null;

  const spot = d.spot;
  const sourceItems: BarListItem[] = spot
    ? SOURCES.map((k) => ({ key: k, label: text.sources[k], value: spot.sources[k] })).filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
    : [];
  const share = (v: number) => (spot && spot.em > 0 ? formatPercent((v / spot.em) * 100, 0) : '–');
  const coord = (v: number) => fixed(Math.abs(v), 2);

  return (
    <>
      {spot && (
        <section className="panel-section">
          <h3>{text.sourcesTitle}</h3>
          {spot.em > 0 ? (
            <>
              <p className="panel-year-note">
                {text.sourcesSummary(tonnes(spot.em), tonnes(spot.range[0]), tonnes(spot.range[1]))}{' '}
                {text.formSplit(share(spot.debris), share(spot.burn))}
              </p>
              <BarList items={sourceItems} format={tonnes} total={spot.em} ariaLabel={text.sourcesAria(countryName)} />
            </>
          ) : (
            <p className="empty">{text.noEmission}</p>
          )}
          <table className="mini-table">
            <tbody>
              <tr>
                <th scope="row">{text.wasteRows.pwg}</th>
                <td className="num">{tonnes(spot.pwg)}</td>
              </tr>
              <tr>
                <th scope="row">{text.wasteRows.collection}</th>
                <td className="num">{formatPercent(spot.collection, 1)}</td>
              </tr>
              <tr>
                <th scope="row">{text.wasteRows.controlled}</th>
                <td className="num">{formatPercent(spot.controlled, 1)}</td>
              </tr>
              <tr>
                <th scope="row">{text.wasteRows.noCollection}</th>
                <td className="num">{text.people(formatLargeNumber(spot.noCollection))}</td>
              </tr>
            </tbody>
          </table>
          <p className="note">{text.sourcesNote}</p>
        </section>
      )}

      {d.ocean && (
        <section className="panel-section">
          <h3>{text.oceanTitle}</h3>
          <p className="panel-year-note">
            {text.oceanSummary(fixed(d.ocean.outlets, 0), tonnes(d.ocean.total), d.ocean.rank, d.ocean.of)}
          </p>
          <BarList
            items={d.ocean.top.map(([lon, lat, v], i) => ({
              key: String(i),
              label: lat >= 0 && lon >= 0 ? text.outlet(coord(lat), coord(lon)) : text.outletSouth(fixed(lat, 2), fixed(lon, 2)),
              value: v,
            }))}
            format={tonnes}
            total={d.ocean.total}
            ariaLabel={text.oceanAria(countryName)}
          />
          <p className="note">{text.oceanNote}</p>
        </section>
      )}

      {d.trade && flowYear !== null && (
        <section className="panel-section">
          {(['export', 'import'] as FlowDirection[]).map((direction) => (
            <TradeSection
              key={direction}
              direction={direction}
              detail={d.trade}
              flows={flows}
              iso3={iso3}
              year={flowYear}
              countryName={countryName}
              name={name}
              tokens={tokens}
            />
          ))}
          <p className="note">{text.historyNote}</p>
        </section>
      )}

      {tw && (
        <section className="panel-section">
          <h3>{text.twTitle}</h3>
          <h4>{text.wasteTitle}</h4>
          {waste && <EChart option={waste} height={180} ariaLabel={text.wasteAria} />}
          <p className="note">{text.wasteNote(WASTE_BREAK)}</p>
          <h4>{text.rateTable}</h4>
          <table className="mini-table">
            <thead>
              <tr>
                <th scope="col">{text.colYear}</th>
                <th scope="col" className="num">{text.rate}</th>
                <th scope="col" className="num">{text.plastics}</th>
                <th scope="col" className="num">{text.containers}</th>
              </tr>
            </thead>
            <tbody>
              {tw.plastics.years.map((y, i) => {
                const wi = tw.waste.years.indexOf(y);
                const rate = wi >= 0 ? ((tw.waste.recycled[wi] + tw.waste.food[wi]) / tw.waste.generated[wi]) * 100 : null;
                return (
                  <tr key={y} className={y === year ? 'is-current' : undefined}>
                    <th scope="row">{y}</th>
                    <td className="num">{rate === null ? '–' : formatPercent(rate, 1)}</td>
                    <td className="num">{fixed(tw.plastics.plastics[i], 0)}</td>
                    <td className="num">{tw.plastics.containers[i] ? fixed(tw.plastics.containers[i], 0) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="note">{text.rateNote}</p>
          <h4>{text.mofTitle}</h4>
          <table className="mini-table" aria-label={text.mofAria}>
            <thead>
              <tr>
                <th scope="col">{text.colYear}</th>
                <th scope="col" className="num">{text.mofExport}</th>
                <th scope="col" className="num">{text.baci}</th>
                <th scope="col" className="num">{text.mofImport}</th>
                <th scope="col" className="num">{text.baci}</th>
              </tr>
            </thead>
            <tbody>
              {MOF_YEARS.map((y) => {
                const i = tw.mof.years.indexOf(y);
                if (i < 0) return null;
                return (
                  <tr key={y} className={y === year ? 'is-current' : undefined}>
                    <th scope="row">{y}</th>
                    <td className="num">{millions(tw.mof.export[i])}</td>
                    <td className="num">{millions(tw.mof.baciExport[i])}</td>
                    <td className="num">{millions(tw.mof.import[i])}</td>
                    <td className="num">{millions(tw.mof.baciImport[i])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(() => {
            // BACI 最新一年的數量
            const i = tw.mof.tonnesExport.reduce<number>((last, v, k) => (v != null ? k : last), -1);
            if (i < 0) return null;
            return (
              <p className="note">
                {text.mofNote(tw.mof.years[i], tonnes(tw.mof.tonnesExport[i] ?? 0), tonnes(tw.mof.tonnesImport[i] ?? 0))}
              </p>
            );
          })()}
        </section>
      )}
    </>
  );
}

