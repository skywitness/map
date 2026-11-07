import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 零售業的規模與電子商務的側欄（2026-11-07，第二十五批 473）：這一國電子商務占營業額的兩條線（全部行業、零售業）、
 * 零售業最新一年的營業額、家數與從業人數；台灣另列 2021 年工商普查的零售業細項。
 * 資料是 pipeline/topics/retail.py 輸出的 detail.json、taiwan.json
 */
interface DetailFile {
  years: number[];
  detail: Record<
    string,
    {
      all?: (number | null)[];
      retail?: (number | null)[];
      sbs?: { year: number; turnover: number; firms: number | null; people: number | null };
    }
  >;
}
interface Row {
  firms: number;
  people: number;
  revenue: number;
}
interface TaiwanFile {
  year: number;
  firms: number;
  people: number;
  revenue: number;
  rows: Record<string, Row>;
}

const TEXT = defineMessages({
  zh: {
    ecom: '電子商務占企業營業額',
    all: '全部行業',
    retail: '零售業',
    noEcom: '這個國家沒有企業的電子商務統計（Eurostat 只有歐洲的國家）。',
    sbs: (y: number, t: string, f: string, p: string) => `${y} 年零售業（不含汽機車）營業額 ${t} 億歐元、${f} 家企業、${p} 人在零售業工作。`,
    twTitle: (y: number) => `台灣 ${y} 年工商普查的零售業`,
    tw: (f: string, p: string, r: string) => `零售業扣掉汽機車：${f} 家企業、${p} 人、營業收入 ${r} 億元。`,
    item: '細項',
    firms: '家數',
    revenue: '營業收入（億元）',
    share: '占比',
    rows: {
      general: '綜合商品',
      convenience: '　其中便利商店',
      department: '　其中百貨公司',
      food: '食品、飲料及菸草',
      clothing: '布疋及服飾品',
      household: '家用器具及用品',
      pharmacy: '藥品、醫療用品及化粧品',
      leisure: '文教育樂用品',
      building: '建材',
      fuel: '燃料（加油站等）',
      ict: '資訊及通訊設備',
      other: '其他專賣',
      nonstore: '非店面零售',
      online: '　其中電子購物及郵購',
      direct: '　其中直銷',
    } as Record<string, string>,
    twNote: '占比是占零售業（扣掉汽機車）營業收入的比例。「電子購物及郵購業」是以網路、型錄為主的業者，實體店的網路訂單不算在裡面，跟 Eurostat 的電子商務占比口徑不同。',
  },
  en: {
    ecom: 'E-commerce share of business turnover',
    all: 'All industries',
    retail: 'Retail trade',
    noEcom: 'No business e-commerce statistics for this country (Eurostat covers European countries only).',
    sbs: (y: number, t: string, f: string, p: string) =>
      `In ${y}, retail trade (excluding motor vehicles) had a turnover of €${t} hundred million, with ${f} enterprises and ${p} persons employed.`,
    twTitle: (y: number) => `Retail in Taiwan’s ${y} census`,
    tw: (f: string, p: string, r: string) => `Retail excluding motor vehicles: ${f} enterprises, ${p} persons, revenue NT$${r} hundred million.`,
    item: 'Type',
    firms: 'Firms',
    revenue: 'Revenue (NT$100m)',
    share: 'Share',
    rows: {
      general: 'Non-specialised stores',
      convenience: '  of which convenience stores',
      department: '  of which department stores',
      food: 'Food, beverages and tobacco',
      clothing: 'Textiles and clothing',
      household: 'Household goods',
      pharmacy: 'Pharmaceutical, medical and cosmetic goods',
      leisure: 'Cultural and recreation goods',
      building: 'Building materials',
      fuel: 'Fuel (incl. filling stations)',
      ict: 'ICT equipment',
      other: 'Other specialised',
      nonstore: 'Non-store retail',
      online: '  of which online and mail order',
      direct: '  of which direct selling',
    } as Record<string, string>,
    twNote:
      'Shares are of retail revenue excluding motor vehicles. “Electronic shopping and mail-order houses” are businesses selling mainly online or by catalogue; online orders taken by store-based retailers are not included, so this differs from Eurostat’s e-commerce share.',
  },
});

export default function RetailPanel({ topic, iso3, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const file = useJson<DetailFile>(`topics/${topic.id}/detail.json`).data;
  const taiwan = useJson<TaiwanFile>(iso3 === 'TWN' ? `topics/${topic.id}/taiwan.json` : null).data;
  const ecomInd = topic.indicators.find((i) => i.id === 'ecommerce')!;
  const d = file?.detail[iso3];

  const chart = useMemo(() => {
    if (!file || !d) return null;
    const lines = [
      { name: text.all, values: d.all ?? [], color: tokens.hues.blue },
      { name: text.retail, values: d.retail ?? [], color: tokens.hues.orange },
    ].filter((l) => l.values.some((v) => v != null));
    if (!lines.length) return null;
    const has = (i: number) => lines.some((l) => l.values[i] != null);
    const first = file.years.findIndex((_, i) => has(i));
    let last = file.years.length - 1;
    while (!has(last)) last--;
    return timeSeriesOption({
      years: file.years.slice(first, last + 1),
      lines: lines.map((l) => ({ ...l, values: l.values.slice(first, last + 1) })),
      year,
      indicator: ecomInd,
      tokens,
    });
  }, [file, d, year, ecomInd, tokens, text]);

  if (!file) return <p className="empty">{t.loading}</p>;
  const sbs = d?.sbs;
  return (
    <>
      <section className="panel-section">
        <h3>{text.ecom}</h3>
        {chart ? <Chart spec={chart} height={180} ariaLabel={text.ecom} /> : <p className="empty">{text.noEcom}</p>}
        {sbs && (
          <p className="note">
            {text.sbs(sbs.year, fixed(sbs.turnover / 100, 0), fixed(sbs.firms ?? 0, 0), fixed(sbs.people ?? 0, 0))}
          </p>
        )}
      </section>
      {taiwan && (
        <section className="panel-section">
          <h3>{text.twTitle(taiwan.year)}</h3>
          <p className="note">{text.tw(fixed(taiwan.firms, 0), fixed(taiwan.people, 0), fixed(taiwan.revenue / 1e8, 0))}</p>
          <table className="mini-table">
            <thead>
              <tr>
                <th>{text.item}</th>
                <th>{text.firms}</th>
                <th>{text.revenue}</th>
                <th>{text.share}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(taiwan.rows).map(([k, r]) => (
                <tr key={k}>
                  <td>{text.rows[k]}</td>
                  <td>{fixed(r.firms, 0)}</td>
                  <td>{fixed(r.revenue / 1e8, 0)}</td>
                  <td>{`${fixed((r.revenue / taiwan.revenue) * 100, 1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.twNote}</p>
        </section>
      )}
    </>
  );
}
