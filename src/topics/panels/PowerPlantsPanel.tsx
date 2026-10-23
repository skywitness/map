import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { FUELS, fuelByCode, gw, mw } from '../power-plants';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/power_plants.py 輸出的 countries/{ISO}.json */
interface CountryFile {
  /** mw 每一列的三個數字：運轉中、興建中、規劃中（MW） */
  status: ['operating', 'construction', 'planned'];
  mw: Record<string, [number, number, number]>;
  /** 最大的運轉中電廠：名稱、燃料代碼、MW（跨國電廠是這個國家的份額）、最早的啟用年份、主要業主、跨國電廠的全廠 MW */
  plants: [string, number, number, number | null, string | null, number | null][];
  /** 運轉中的電廠數（含 20 MW 以下） */
  count: number;
  /** 運轉中的抽蓄水力（MW），算在水力裡 */
  pumped?: number;
}

const n0 = (v: number) => fixed(v, 0);

const TEXT = defineMessages({
  zh: {
    noCountry: 'GEM 沒有收錄這個國家的電廠。',
    operating: '運轉中的裝置容量',
    operatingNote: (n: number, total: string) => `GEM 收錄 ${n0(n)} 座運轉中的電廠，合計 ${total}（含 20 MW 以下的電廠）。`,
    pumped: (v: string) => `水力含抽蓄水力 ${v}。`,
    noOperating: 'GEM 沒有收錄這個國家運轉中的電廠。',
    listAria: (country: string, what: string) => `${country}${what}的裝置容量（依能源）`,
    construction: (total: string) => `興建中：${total}`,
    planned: (total: string) => `規劃中（籌備中、已宣布）：${total}`,
    noPipeline: '沒有興建中或規劃中的電廠。',
    pipeline: '興建中與規劃中',
    largest: '最大的電廠（運轉中）',
    opened: (y: number) => `${y} 年啟用`,
    shared: (total: string) => `跨國電廠（全廠 ${total}），這裡只算這個國家的份額`,
    note: '電廠名稱與業主是 GEM 的英文原名，業主是持股最多的一家。容量是銘牌容量，不是發電量。',
  },
  en: {
    noCountry: 'GEM tracks no power plants in this country.',
    operating: 'Operating capacity',
    operatingNote: (n, total) => `GEM tracks ${n0(n)} operating ${n === 1 ? 'plant' : 'plants'} here, ${total} in total (including plants under 20 MW).`,
    pumped: (v) => `Hydro includes ${v} of pumped storage.`,
    noOperating: 'GEM tracks no operating power plants in this country.',
    listAria: (country, what) => `${what} capacity in ${country} by source`,
    construction: (total) => `Under construction: ${total}`,
    planned: (total) => `Planned (pre-construction, announced): ${total}`,
    noPipeline: 'No plants under construction or planned.',
    pipeline: 'Under construction and planned',
    largest: 'Largest operating plants',
    opened: (y) => `opened ${y}`,
    shared: (total) => `Cross-border plant (${total} in all); only this country’s share is counted`,
    note: 'Plant and owner names are GEM’s original English names; the owner shown is the largest shareholder. Capacity is nameplate capacity, not generation.',
  },
});

const fromMw = (v: number) => gw(v / 1000);

export default function PowerPlantsPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<CountryFile>(`topics/${topic.id}/countries/${iso3}.json`);

  const lists = useMemo(() => {
    if (!data) return null;
    // 0 運轉中、1 興建中、2 規劃中
    const byStatus = (i: number) =>
      FUELS.filter((f) => (data.mw[f.id]?.[i] ?? 0) > 0)
        .map((f) => ({ key: f.id, label: tr(f.label, lang), value: data.mw[f.id][i], color: f.color }))
        .sort((a, b) => b.value - a.value);
    const sum = (items: { value: number }[]) => items.reduce((s, i) => s + i.value, 0);
    const [operating, construction, planned] = [0, 1, 2].map(byStatus);
    return {
      operating,
      construction,
      planned,
      totals: [sum(operating), sum(construction), sum(planned)],
    };
  }, [data, lang]);

  if (error) return <p className="empty">{text.noCountry}</p>;
  if (!data || !lists) return <p className="empty">{t.loading}</p>;
  const [opTotal, conTotal, planTotal] = lists.totals;
  // 規劃中的比例尺跟興建中一樣，兩張長條圖才比得起來
  const pipelineMax = Math.max(0, ...lists.construction.map((i) => i.value), ...lists.planned.map((i) => i.value));

  return (
    <section className="panel-section">
      <h3>{text.operating}</h3>
      {lists.operating.length > 0 ? (
        <>
          <p className="panel-year-note">
            {text.operatingNote(data.count, fromMw(opTotal))}
            {data.pumped ? ` ${text.pumped(fromMw(data.pumped))}` : ''}
          </p>
          <BarList
            items={lists.operating}
            format={fromMw}
            total={opTotal}
            ariaLabel={text.listAria(countryName, tr({ zh: '運轉中', en: 'Operating' }, lang))}
          />
        </>
      ) : (
        <p className="empty">{text.noOperating}</p>
      )}

      <h3>{text.pipeline}</h3>
      {conTotal + planTotal > 0 ? (
        <>
          {lists.construction.length > 0 && (
            <>
              <h4>{text.construction(fromMw(conTotal))}</h4>
              <BarList
                items={lists.construction}
                format={fromMw}
                max={pipelineMax}
                ariaLabel={text.listAria(countryName, tr({ zh: '興建中', en: 'Under construction' }, lang))}
              />
            </>
          )}
          {lists.planned.length > 0 && (
            <>
              <h4>{text.planned(fromMw(planTotal))}</h4>
              <BarList
                items={lists.planned}
                format={fromMw}
                max={pipelineMax}
                ariaLabel={text.listAria(countryName, tr({ zh: '規劃中', en: 'Planned' }, lang))}
              />
            </>
          )}
        </>
      ) : (
        <p className="empty">{text.noPipeline}</p>
      )}

      {data.plants.length > 0 && (
        <>
          <h3>{text.largest}</h3>
          <ul className="plain-list">
            {data.plants.map(([name, code, capacity, start, owner, total], i) => {
              const fuel = fuelByCode(code);
              return (
                <li key={i}>
                  <span className="plain-title">
                    {fuel && <span className="bar-key" style={{ background: fuel.color }} aria-hidden="true" />}
                    <span translate="no">{name}</span>
                  </span>
                  <span className="plain-meta">
                    {[fuel ? tr(fuel.label, lang) : null, mw(capacity), start ? text.opened(start) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {owner && (
                    <span className="plain-meta" translate="no">
                      {owner}
                    </span>
                  )}
                  {total !== null && <span className="plain-meta">{text.shared(mw(total))}</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
