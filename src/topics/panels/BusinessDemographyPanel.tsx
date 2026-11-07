import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 企業的誕生、死亡與存活的側欄（2026-11-07，第二十五批 468）：這一國新設率與歇業率兩條線（birth.json、death.json）；
 * 台灣另外寫商業發展署的家數（taiwan.json）。資料是 pipeline/topics/business_demography.py 輸出的
 */
interface TaiwanFile {
  years: number[];
  detail: Record<string, { new: number; closed: number; stock: number }>;
}

const TEXT = defineMessages({
  zh: {
    title: '新設率與歇業率',
    birth: '新設率',
    death: '歇業率',
    none: '這個國家沒有企業人口統計（Eurostat 只有歐洲的國家）。',
    taiwan: (year: number, n: string, c: string, s: string) =>
      `${year} 年新設立公司 ${n} 家，解散、撤銷及廢止 ${c} 家，12 月底登記在案 ${s} 家（商業發展署）。`,
  },
  en: {
    title: 'Birth and death rates',
    birth: 'Birth rate',
    death: 'Death rate',
    none: 'No business demography data for this country (Eurostat covers European countries only).',
    taiwan: (year: number, n: string, c: string, s: string) =>
      `In ${year}, ${n} companies were registered and ${c} dissolved, revoked or annulled, with ${s} on the register at the end of December (Administration of Commerce).`,
  },
});

const FILES = ['birth', 'death'];

export default function BusinessDemographyPanel({ topic, iso3, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const paths = useMemo(() => FILES.map((f) => `topics/${topic.id}/${f}.json`), [topic.id]);
  const loaded = useJsonMany<IndicatorData>(paths);
  const taiwan = useJson<TaiwanFile>(iso3 === 'TWN' ? `topics/${topic.id}/taiwan.json` : null).data;
  const birth = topic.indicators.find((i) => i.id === 'birth')!;

  const chart = useMemo(() => {
    if (!loaded.every(Boolean)) return undefined;
    const years = loaded[0]!.years;
    const own = loaded.map((d) => d!.values[iso3] ?? []);
    const has = (i: number) => own.some((v) => v[i] != null);
    const first = years.findIndex((_, i) => has(i));
    if (first < 0) return null;
    let last = years.length - 1;
    while (!has(last)) last--;
    return timeSeriesOption({
      years: years.slice(first, last + 1),
      lines: [
        { name: text.birth, values: own[0].slice(first, last + 1), color: tokens.hues.blue },
        { name: text.death, values: own[1].slice(first, last + 1), color: tokens.hues.orange },
      ],
      year,
      indicator: birth,
      tokens,
      sparse: true,
    });
  }, [loaded, iso3, year, birth, tokens, text]);

  const twText = useMemo(() => {
    if (!taiwan?.years.length) return '';
    const y = taiwan.years[taiwan.years.length - 1];
    const d = taiwan.detail[String(y)];
    return text.taiwan(y, fixed(d.new, 0), fixed(d.closed, 0), fixed(d.stock, 0));
  }, [taiwan, text]);

  if (chart === undefined) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {chart ? <Chart spec={chart} height={180} ariaLabel={text.title} /> : <p className="empty">{text.none}</p>}
      {twText && <p className="note">{twText}</p>}
    </section>
  );
}
