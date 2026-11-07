import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 營建成本、地價與房屋稅的側欄（2026-11-07，第二十五批 472）：這一國新建住宅的營建價格、工料成本與消費者物價
 * （2021＝100）三條線，地方政府的經常性財產稅占 GDP 的折線（看營建價格的指標時才畫，財產稅的指標側欄本來就有）；台灣另寫財政部的稅目與內政部的縣市公告地價。
 * 資料是 pipeline/topics/property_costs.py 輸出的 detail.json、property-tax.json、taiwan.json
 */
interface DetailFile {
  years: number[];
  detail: Record<string, { price: (number | null)[]; cost: (number | null)[]; cpi: (number | null)[] }>;
  sector: Record<string, string>;
}
interface TaiwanFile {
  taxYear: number;
  taxes: Record<string, number>;
  land: { date: string; counties: { name: string; nameEn: string; parcels: number; ha: number; total: number }[] };
}

const TEXT = defineMessages({
  zh: {
    cons: '營建價格與一般物價（2021＝100）',
    price: '建商的售價',
    cost: '工料成本',
    cpi: '消費者物價',
    noCons: '這個國家沒有營建價格指數（Eurostat 只有歐洲的國家）。',
    tax: '地方政府的房屋稅、地價稅占 GDP',
    noTax: '這個國家沒有地方政府的財產稅資料（OECD 只有 40 個左右的國家）。',
    withStates: '聯邦制的國家含州政府收的部分。',
    twTaxes: (y: number) => `${y} 年的不動產相關稅收（億元）`,
    taxNames: {
      house: '房屋稅',
      land: '地價稅',
      increment: '土地增值稅',
      deed: '契稅',
      consolidated: '房地合一稅',
    } as Record<string, string>,
    sep: '：',
    land: (d: string) => `公告地價（${d.slice(0, 4)} 年 ${Number(d.slice(4, 6))} 月 ${Number(d.slice(6))} 日）`,
    county: '縣市',
    ha: '面積（公頃）',
    total: '總額（億元）',
    perM2: '平均（元／平方公尺）',
    landNote: '公告地價是課地價稅的基礎、遠低於市價；總額含山坡地與農地，平均會被大面積的山區拉低，只能看大概。',
  },
  en: {
    cons: 'Construction and consumer prices (2021 = 100)',
    price: 'Output prices',
    cost: 'Input costs',
    cpi: 'Consumer prices',
    noCons: 'No construction price index for this country (Eurostat covers European countries only).',
    tax: 'Recurrent property taxes (subnational), % of GDP',
    noTax: 'No subnational property tax data for this country (the OECD covers about 40 countries).',
    withStates: 'Includes state governments in federal countries.',
    twTaxes: (y: number) => `Property-related tax revenue in ${y} (NT$100 million)`,
    taxNames: {
      house: 'House tax',
      land: 'Land value tax',
      increment: 'Land value increment tax',
      deed: 'Deed tax',
      consolidated: 'Consolidated housing and land income tax',
    } as Record<string, string>,
    sep: ': ',
    land: (d: string) => `Announced land value (${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)})`,
    county: 'County/city',
    ha: 'Area (ha)',
    total: 'Total (NT$100m)',
    perM2: 'Average (NT$/m²)',
    landNote:
      'Announced land values are the base for land value tax and sit far below market prices; totals include hillside and farmland, so averages are pulled down by large mountainous areas and give only a rough comparison.',
  },
});

/** 從第一個有值的年份切到最後一個有值的年份 */
function trim(years: number[], lines: { values: (number | null)[] }[]) {
  const has = (i: number) => lines.some((l) => l.values[i] != null);
  const first = years.findIndex((_, i) => has(i));
  if (first < 0) return null;
  let last = years.length - 1;
  while (!has(last)) last--;
  return { first, last };
}

export default function PropertyCostsPanel({ topic, indicator, iso3, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const file = useJson<DetailFile>(`topics/${topic.id}/detail.json`).data;
  const tax = useJson<IndicatorData>(`topics/${topic.id}/property-tax.json`).data;
  const taiwan = useJson<TaiwanFile>(iso3 === 'TWN' ? `topics/${topic.id}/taiwan.json` : null).data;
  const consInd = topic.indicators.find((i) => i.id === 'construction')!;
  const taxInd = topic.indicators.find((i) => i.id === 'property-tax')!;

  const consChart = useMemo(() => {
    const d = file?.detail[iso3];
    if (!file || !d) return null;
    const lines = [
      { name: text.price, values: d.price, color: tokens.hues.blue },
      { name: text.cost, values: d.cost, color: tokens.hues.orange },
      { name: text.cpi, values: d.cpi, color: tokens.inkMuted, dashed: true },
    ].filter((l) => l.values.some((v) => v != null));
    const range = trim(file.years, lines.slice(0, -1));
    if (!range) return null;
    return timeSeriesOption({
      years: file.years.slice(range.first, range.last + 1),
      lines: lines.map((l) => ({ ...l, values: l.values.slice(range.first, range.last + 1) })),
      year,
      indicator: consInd,
      tokens,
    });
  }, [file, iso3, year, consInd, tokens, text]);

  const taxChart = useMemo(() => {
    const own = tax?.values[iso3];
    if (!tax || !own) return null;
    const lines = [{ name: text.tax, values: own, color: tokens.hues.blue }];
    const range = trim(tax.years, lines);
    if (!range) return null;
    return timeSeriesOption({
      years: tax.years.slice(range.first, range.last + 1),
      lines: lines.map((l) => ({ ...l, values: l.values.slice(range.first, range.last + 1) })),
      year,
      indicator: taxInd,
      tokens,
    });
  }, [tax, iso3, year, taxInd, tokens, text]);

  if (!file || !tax) return <p className="empty">{t.loading}</p>;
  return (
    <>
      <section className="panel-section">
        <h3>{text.cons}</h3>
        {consChart ? <Chart spec={consChart} height={180} ariaLabel={text.cons} /> : <p className="empty">{text.noCons}</p>}
      </section>
      {/* 看財產稅的指標時，側欄上面已經有這條折線 */}
      {indicator.id.startsWith('construction') && (
        <section className="panel-section">
          <h3>{text.tax}</h3>
          {taxChart ? <Chart spec={taxChart} height={160} ariaLabel={text.tax} /> : <p className="empty">{text.noTax}</p>}
        </section>
      )}
      {file.sector[iso3] === 'S13M' && <p className="note">{text.withStates}</p>}
      {taiwan && (
        <>
          <section className="panel-section">
            <h3>{text.twTaxes(taiwan.taxYear)}</h3>
            <ul className="note">
              {Object.entries(taiwan.taxes).map(([k, v]) => (
                <li key={k}>
                  {text.taxNames[k] ?? k}
                  {text.sep}
                  {fixed(v, 0)}
                </li>
              ))}
            </ul>
          </section>
          <section className="panel-section">
            <h3>{text.land(taiwan.land.date)}</h3>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>{text.county}</th>
                  <th>{text.ha}</th>
                  <th>{text.total}</th>
                  <th>{text.perM2}</th>
                </tr>
              </thead>
              <tbody>
                {taiwan.land.counties.map((c) => (
                  <tr key={c.name}>
                    <td>{lang === 'en' ? c.nameEn : c.name}</td>
                    <td>{fixed(c.ha, 0)}</td>
                    <td>{fixed(c.total, 0)}</td>
                    <td>{fixed((c.total * 1e8) / (c.ha * 1e4), 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">{text.landNote}</p>
          </section>
        </>
      )}
    </>
  );
}
