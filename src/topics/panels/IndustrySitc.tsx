import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { stackedAreaOption } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import { MAP_TOKENS } from '../../theme/tokens';
import { SITC_GROUPS } from '../industry';
import type { IndicatorData } from '../types';

/**
 * 工業主題「出口組成（1962 年起）」「最大的出口類別」的側欄（2026-11-02，製作手冊第十七批 270）：這一國 1962–2024 年
 * 出口的 SITC 八大類比例，堆疊面積圖。讀 exports-sitc/<類>.json（地圖用的同一組檔）；顏色依類別的順序取 MAP_TOKENS.categorical，
 * 跟「最大的出口類別」地圖的圖例一樣
 */

const TEXT = defineMessages({
  zh: {
    title: '出口組成的變化（SITC，1962 年起）',
    none: '沒有這個國家的出口組成。',
    note: 'Harvard Atlas 的 SITC Rev. 2，占全部商品出口的比例；不含服務。台灣的值來自貿易夥伴的申報。',
  },
  en: {
    title: 'Export mix over time (SITC, from 1962)',
    none: 'No export mix for this country.',
    note: 'Harvard Atlas SITC Rev. 2, as a share of all goods exports; services excluded. Taiwan’s figures come from its partners’ reports.',
  },
});

export function IndustrySitc({ topicId, iso3, year }: { topicId: string; iso3: string; year: number }) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useJsonMany<IndicatorData>(SITC_GROUPS.map((g) => `topics/${topicId}/exports-sitc/${g.id}.json`));
  const ready = files.every(Boolean);
  const option = useMemo(() => {
    if (!ready) return null;
    const years = files[0]!.years;
    const series = SITC_GROUPS.map((g, i) => ({
      name: tr(g.label, lang),
      values: files[i]!.values[iso3] ?? years.map(() => null),
      color: MAP_TOKENS.categorical[i],
    }));
    if (series.every((s) => s.values.every((v) => v === null))) return null;
    const spec = stackedAreaOption({ years, series, year, format: (v) => `${fixed(v, 1)}%`, formatTick: (v) => `${v}%` });
    // 比例的合計是 100%：y 軸固定 0–100%，刻度 0、25、50、75、100
    return { ...spec, y: { ...spec.y, min: 0, max: 100, ticks: [0, 25, 50, 75, 100] } };
  }, [ready, files, iso3, year, lang]);
  if (!ready) return <p className="empty">{t.loading}</p>;
  return (
    <>
      <h3>{text.title}</h3>
      {option ? <Chart spec={option} height={220} ariaLabel={text.title} /> : <p className="empty">{text.none}</p>}
      <p className="note">{text.note}</p>
    </>
  );
}
