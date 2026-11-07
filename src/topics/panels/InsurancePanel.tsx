import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 保險主題的側欄（2026-11-07，第二十五批 462）：
 * - 這一國保險滲透度的全部、壽險、非壽險三條線，加 OECD 合計的虛線（penetration/*.json 的 aggregates.OECD）；
 * - 台灣另外列保險事業發展中心的數字（taiwan.json）：2025 年的密度與滲透度、人壽保險及年金保險的投保率與普及率。
 * 資料是 pipeline/topics/insurance.py 輸出的
 */
interface TaiwanFile {
  years: number[];
  density: (number | null)[];
  penetration: (number | null)[];
  ownership: (number | null)[];
  coverage: (number | null)[];
}

const TEXT = defineMessages({
  zh: {
    title: '保費占 GDP：壽險與非壽險',
    total: '全部',
    life: '壽險',
    nonlife: '非壽險',
    oecd: 'OECD 合計',
    none: '這個國家不在 OECD 的保險統計裡。',
    twTitle: '保險事業發展中心的數字',
    twLatest: (year: number, density: string, pen: string) => `${year} 年每人平均保費 ${density} 元，保費占 GDP ${pen}%。`,
    twOwnership: (year: number, own: string, cov: string) =>
      `${year} 年人壽保險及年金保險投保率 ${own}%（有效契約件數 ÷ 人口，平均每人 ${fixed(Number(own) / 100, 1)} 張），普及率 ${cov}%（有效契約保額 ÷ 國民所得）。`,
    twChart: '人壽保險及年金保險投保率',
    twNote: 'OECD 的台灣數字也是保發中心報的，兩邊的滲透度用的 GDP 版本不同，略有差異。',
  },
  en: {
    title: 'Premiums as % of GDP: life and non-life',
    total: 'All',
    life: 'Life',
    nonlife: 'Non-life',
    oecd: 'OECD total',
    none: 'This country is not in the OECD insurance statistics.',
    twTitle: 'Taiwan Insurance Institute figures',
    twLatest: (year: number, density: string, pen: string) => `In ${year}, premiums averaged NT$${density} per person, ${pen}% of GDP.`,
    twOwnership: (year: number, own: string, cov: string) =>
      `In ${year}, the life insurance and annuity ownership rate was ${own}% (policies in force ÷ population, ${fixed(Number(own) / 100, 1)} per person), and the coverage ratio ${cov}% (sums insured ÷ national income).`,
    twChart: 'Life insurance and annuity ownership rate',
    twNote: 'The OECD’s figures for Taiwan also come from the institute; the penetration figures differ slightly because they use different GDP vintages.',
  },
});

const FILES = ['penetration/total', 'penetration/life', 'penetration/nonlife'];

const lastIndex = (values: (number | null)[]) => {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return i;
  return -1;
};

export default function InsurancePanel({ topic, indicator, iso3, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const paths = useMemo(() => FILES.map((f) => `topics/${topic.id}/${f}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(paths);
  const taiwan = useJson<TaiwanFile>(iso3 === 'TWN' ? `topics/${topic.id}/taiwan.json` : null).data;
  const penetration = topic.indicators.find((i) => i.id === 'penetration') ?? indicator;

  const chart = useMemo(() => {
    if (!loaded.every(Boolean)) return undefined;
    const years = loaded[0]!.years;
    const own = loaded.map((d) => d!.values[iso3] ?? []);
    const first = years.findIndex((_, i) => own.some((v) => v[i] != null));
    if (first < 0) return null;
    const last = Math.max(...own.map(lastIndex));
    const slice = (v: (number | null)[]) => v.slice(first, last + 1);
    return timeSeriesOption({
      years: years.slice(first, last + 1),
      lines: [
        { name: text.total, values: slice(own[0]), color: tokens.hues.blue },
        { name: text.life, values: slice(own[1]), color: tokens.hues.orange },
        { name: text.nonlife, values: slice(own[2]), color: tokens.hues.aqua },
        { name: text.oecd, values: slice(loaded[0]!.aggregates?.OECD ?? []), color: tokens.inkMuted, dashed: true },
      ],
      year,
      indicator: penetration,
      tokens,
    });
  }, [loaded, iso3, year, penetration, tokens, text]);

  const tw = useMemo(() => {
    if (!taiwan) return null;
    const d = lastIndex(taiwan.density);
    const o = lastIndex(taiwan.ownership);
    const first = taiwan.ownership.findIndex((v) => v != null);
    return {
      latest: d < 0 ? '' : text.twLatest(taiwan.years[d], fixed(taiwan.density[d]!, 0), fixed(taiwan.penetration[d]!, 2)),
      ownership: o < 0 ? '' : text.twOwnership(taiwan.years[o], fixed(taiwan.ownership[o]!, 2), fixed(taiwan.coverage[o]!, 2)),
      option:
        o < 0
          ? null
          : timeSeriesOption({
              years: taiwan.years.slice(first, o + 1),
              lines: [{ name: text.twChart, values: taiwan.ownership.slice(first, o + 1), color: tokens.hues.orange }],
              year,
              indicator: { ...penetration, format: (v: number) => `${fixed(v, 1)}%`, formatTick: (v: number) => `${v}%` },
              tokens,
            }),
    };
  }, [taiwan, text, tokens, year, penetration]);

  if (chart === undefined) return <p className="empty">{t.loading}</p>;
  return (
    <>
      <section className="panel-section">
        <h3>{text.title}</h3>
        {chart ? <Chart spec={chart} height={200} ariaLabel={text.title} /> : <p className="empty">{text.none}</p>}
      </section>
      {tw && (
        <section className="panel-section">
          <h3>{text.twTitle}</h3>
          {tw.latest && <p className="note">{tw.latest}</p>}
          {tw.ownership && <p className="note">{tw.ownership}</p>}
          {tw.option && <Chart spec={{ ...tw.option, y: { ...tw.option.y, zero: false } }} height={160} ariaLabel={text.twChart} />}
          <p className="note">{text.twNote}</p>
        </section>
      )}
    </>
  );
}
