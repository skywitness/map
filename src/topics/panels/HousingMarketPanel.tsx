import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 沒人住的房子與買賣量的側欄（2026-11-07，第二十五批 471）：這一國 2011、2021 年普查的住宅數與無人經常居住的比例、
 * 依建物型態的比例，住宅買賣件數的折線（新屋、中古屋分開的國家畫三條）；台灣另外列 2020 年普查的四分類與各縣市
 * （無人經常居住、目前沒有使用、2025 年實價登錄的買賣件數與單價中位數）。資料是 pipeline/topics/housing_market.py 輸出的
 */
interface DetailFile {
  years: number[];
  detail: Record<
    string,
    {
      c2011?: [number, number, number, number];
      c2021?: [number, number, number, number];
      b2021?: Record<string, [number, number]>;
      sales?: Record<string, (number | null)[]>;
    }
  >;
}
interface County {
  name: string;
  nameEn: string;
  total: number;
  unoccupied: number;
  notUsed: number;
  sales: number | null;
  price: number | null;
}
interface TaiwanFile {
  census: { total: number; occupied: number; unoccupied: number; sometimes: number; otherUse: number; notUsed: number };
  salesYear: number;
  sales: Record<string, number>;
  price: number;
  ping: number;
  counties: County[];
}

const TEXT = defineMessages({
  zh: {
    census: '普查的住宅數',
    year: '年',
    dwellings: '住宅',
    unoccupied: '無人經常居住',
    share: '比例',
    unknown: (n: string) => `另有 ${n} 宅不知道有沒有人住。`,
    byType: '2021 年依建物型態，無人經常居住的比例：',
    types: { RES1: '一宅的建物（獨棟、連棟）', RES2: '兩宅的建物', RES_GE3: '三宅以上的建物（公寓大樓）' } as Record<string, string>,
    sales: '住宅買賣件數',
    countUnit: '件',
    total: '全部',
    newDw: '新屋',
    existing: '中古屋',
    noSales: '這個國家沒有住宅買賣件數（Eurostat 的件數只有 14 國）。',
    none: '這個國家沒有普查的住宅使用資料（Eurostat 只有歐洲的國家）。',
    twCensus: (t: string, u: string, s: string, o: string, n: string) =>
      `2020 年普查 ${t} 宅，無人經常居住 ${u} 宅：偶爾自住 ${s}、自住以外用途（辦公室、倉庫等）${o}、目前沒有使用 ${n}。`,
    twSales: (y: number, n: string, p: string) =>
      `${y} 年實價登錄的住宅買賣 ${n} 筆，扣掉車位後的單價中位數每坪 ${p} 萬元（不含親友間等特殊交易）。`,
    sep: '：',
    counties: '台灣各縣市',
    county: '縣市',
    colUnocc: '無人常住',
    notUsed: '沒在用',
    salesCol: (y: number) => `${y} 買賣`,
    priceCol: '萬元/坪',
    tableNote: (y: number) =>
      `無人常住、沒在用是 2020 年普查的「無人經常居住」與「目前沒有使用」占全部住宅的比例；買賣是 ${y} 年實價登錄的住宅買賣筆數，萬元/坪是扣掉車位後的單價中位數。`,
  },
  en: {
    census: 'Dwellings in the census',
    year: 'Year',
    dwellings: 'Dwellings',
    unoccupied: 'Not usually occupied',
    share: 'Share',
    unknown: (n: string) => `Occupancy is unknown for another ${n} dwellings.`,
    byType: 'Share not usually occupied in 2021, by type of building:',
    types: {
      RES1: 'Buildings with one dwelling (houses)',
      RES2: 'Buildings with two dwellings',
      RES_GE3: 'Buildings with three or more dwellings (flats)',
    } as Record<string, string>,
    sales: 'Home sales',
    countUnit: 'sales',
    total: 'All',
    newDw: 'New dwellings',
    existing: 'Existing dwellings',
    noSales: 'No house sales counts for this country (Eurostat publishes counts for 14 countries).',
    none: 'No census data on dwelling occupancy for this country (Eurostat covers European countries only).',
    twCensus: (t: string, u: string, s: string, o: string, n: string) =>
      `The 2020 census counted ${t} dwellings, ${u} of them not usually occupied: ${s} used occasionally by the owner, ${o} used for other purposes (offices, storage and so on) and ${n} not in use at present.`,
    twSales: (y: number, n: string, p: string) =>
      `${n} home sales were registered in ${y}; the median price excluding parking was NT$${p} per m² (excluding sales between relatives and other special transactions).`,
    sep: ': ',
    counties: 'Taiwan by county',
    county: 'County/city',
    colUnocc: 'Unocc.',
    notUsed: 'Unused',
    salesCol: (y: number) => `Sales ${y}`,
    priceCol: 'NT$/m²',
    tableNote: (y: number) =>
      `Unoccupied and unused are the shares of dwellings not usually occupied and not in use at present in the 2020 census; sales are home sales in the ${y} actual price register, with the median price per m² excluding parking.`,
  },
});

const share = (a: number, b: number) => (b ? `${fixed((a / b) * 100, 1)}%` : '–');

export default function HousingMarketPanel({ topic, iso3, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const file = useJson<DetailFile>(`topics/${topic.id}/detail.json`).data;
  const taiwan = useJson<TaiwanFile>(iso3 === 'TWN' ? `topics/${topic.id}/taiwan.json` : null).data;
  const rate = topic.indicators.find((i) => i.id === 'sales-rate')!;
  const d = file?.detail[iso3];

  const chart = useMemo(() => {
    if (!file || !d?.sales) return null;
    const years = file.years;
    const lines = [
      { name: text.total, values: d.sales.TOTAL, color: tokens.hues.blue },
      ...(d.sales.DW_NEW?.some((v) => v != null) ? [{ name: text.newDw, values: d.sales.DW_NEW, color: tokens.hues.orange }] : []),
      ...(d.sales.DW_EXST?.some((v) => v != null) ? [{ name: text.existing, values: d.sales.DW_EXST, color: tokens.hues.aqua }] : []),
    ];
    const has = (i: number) => lines.some((l) => l.values[i] != null);
    const first = years.findIndex((_, i) => has(i));
    if (first < 0) return null;
    let last = years.length - 1;
    while (!has(last)) last--;
    return timeSeriesOption({
      years: years.slice(first, last + 1),
      lines: lines.map((l) => ({ ...l, values: l.values.slice(first, last + 1) })),
      year,
      indicator: { ...rate, unit: text.countUnit, format: (v: number) => fixed(v, 0), formatTick: (v: number) => fixed(v, 0) },
      tokens,
    });
  }, [file, d, year, rate, tokens, text]);

  if (!file) return <p className="empty">{t.loading}</p>;
  const censusRows = ([2011, 2021] as const).flatMap((y) => {
    const c = d?.[`c${y}`];
    return c ? [{ y, c }] : [];
  });
  const unknown = censusRows.length ? censusRows[censusRows.length - 1].c[3] : 0;
  const tw = iso3 === 'TWN' ? taiwan : null;
  const perPing = (v: number) => fixed((v * (tw?.ping ?? 3.305785)) / 10000, 1);
  const price = (v: number) => (lang === 'zh' ? perPing(v) : fixed(v, 0));

  return (
    <>
      <section className="panel-section">
        <h3>{text.census}</h3>
        {censusRows.length ? (
          <>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>{text.year}</th>
                  <th>{text.dwellings}</th>
                  <th>{text.unoccupied}</th>
                  <th>{text.share}</th>
                </tr>
              </thead>
              <tbody>
                {censusRows.map(({ y, c }) => (
                  <tr key={y}>
                    <td>{y}</td>
                    <td>{fixed(c[0], 0)}</td>
                    <td>{fixed(c[2], 0)}</td>
                    <td>{share(c[2], c[0])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {unknown > 0 && <p className="note">{text.unknown(fixed(unknown, 0))}</p>}
            {d?.b2021 && (
              <>
                <p className="note">{text.byType}</p>
                <ul className="note">
                  {Object.entries(d.b2021).map(([b, [all, noc]]) => (
                    <li key={b}>
                      {text.types[b]}
                      {text.sep}
                      {share(noc, all)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : tw ? (
          <p className="note">
            {text.twCensus(
              fixed(tw.census.total, 0),
              fixed(tw.census.unoccupied, 0),
              fixed(tw.census.sometimes, 0),
              fixed(tw.census.otherUse, 0),
              fixed(tw.census.notUsed, 0),
            )}
          </p>
        ) : (
          <p className="empty">{text.none}</p>
        )}
      </section>
      <section className="panel-section">
        <h3>{text.sales}</h3>
        {chart ? <Chart spec={chart} height={180} ariaLabel={text.sales} /> : <p className="empty">{text.noSales}</p>}
        {tw && <p className="note">{text.twSales(tw.salesYear, fixed(tw.sales[String(tw.salesYear)], 0), price(tw.price))}</p>}
      </section>
      {tw && (
        <section className="panel-section">
          <h3>{text.counties}</h3>
          <table className="mini-table">
            <thead>
              <tr>
                <th>{text.county}</th>
                <th>{text.colUnocc}</th>
                <th>{text.notUsed}</th>
                <th>{text.salesCol(tw.salesYear)}</th>
                <th>{text.priceCol}</th>
              </tr>
            </thead>
            <tbody>
              {tw.counties.map((c) => (
                <tr key={c.name}>
                  <td>{lang === 'en' ? c.nameEn : c.name}</td>
                  <td>{share(c.unoccupied, c.total)}</td>
                  <td>{share(c.notUsed, c.total)}</td>
                  <td>{c.sales == null ? '–' : fixed(c.sales, 0)}</td>
                  <td>{c.price == null ? '–' : price(c.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.tableNote(tw.salesYear)}</p>
        </section>
      )}
    </>
  );
}
