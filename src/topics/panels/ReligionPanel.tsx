import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { countyName, TW_GROUPS } from '../religion-tw';
import type { PanelExtraProps } from '../types';
import { Cofog08 } from './Cofog08Panel';
import { VdemIndices, type Scale, type VdemIndex, type VdemText } from './GovernancePanel';

/**
 * 宗教主題的側欄（2026-11-07，製作手冊第二十七批 554）：選了 V-Dem 的三項時，畫這一年的值、68% 可信區間、
 * 世界中位數，加 1789 年起的歷年小圖（跟政府治理主題的行政權制衡同一個元件，刻度改成 −4 到 +4）。
 * id 跟 religion.ts、pipeline/topics/religion_vdem.py 一致
 */
const INDICES: VdemIndex[] = [
  { id: 'religious-freedom', label: { zh: '宗教自由', en: 'Freedom of religion' }, interval: true },
  { id: 'religious-repression', label: { zh: '宗教組織不受壓制', en: 'Religious organizations not repressed' }, interval: true },
  { id: 'religious-consultation', label: { zh: '宗教組織說得上話', en: 'Religious organizations consulted' }, interval: true },
];

const SCALE: Scale = {
  min: -4,
  max: 4,
  ticks: [-4, -2, 0, 2, 4],
  format: (v) => {
    const s = fixed(Math.abs(v), 2);
    return v < 0 && s !== fixed(0, 2) ? `−${s}` : s;
  },
};

const TEXT: VdemText = defineMessages({
  zh: {
    title: (year: number) => `宗教自由與宗教組織（${year} 年）`,
    interval: '68% 可信區間',
    note: 'V-Dem 的專家評分用測量模型合成的估計值（區間尺度，0 大約是 1789 年以來所有國家年份的平均）；前兩項越高越自由、越不受壓制，第三項高分只表示政府會徵詢宗教組織，不等於好（伊朗的神權體制分數高）。區間重疊的國家，高低不一定有意義。世界中位數是當年有資料的國家的中位數。',
    chartAria: (country: string, label: string) => `${country}歷年的 V-Dem ${label}估計值、68% 可信區間與世界中位數`,
    rowAria: (label: string, value: string, low: string, high: string, median: string) =>
      `${label} ${value}，68% 可信區間 ${low} 到 ${high}，世界中位數 ${median}`,
  },
  en: {
    title: (year) => `Religious freedom and organizations (${year})`,
    interval: '68% credible interval',
    note: 'Estimates combining V-Dem expert ratings with a measurement model (an interval scale; 0 is roughly the average of all country-years since 1789). Higher means freer and less repressed for the first two; for the third, a high score only means the government consults religious organizations and is not necessarily good (theocratic Iran scores high). Where intervals overlap, countries may not really differ. The world median is the median of countries with data that year.',
    chartAria: (country, label) => `V-Dem estimate of ${label.toLowerCase()} for ${country} over time, with the 68% credible interval and the world median`,
    rowAria: (label, value, low, high, median) =>
      `${label}: ${value}, 68% credible interval ${low} to ${high}, world median ${median}`,
  },
});

/** pipeline/topics/temples_tw.py 的 tw-temples-summary.json */
interface TwSummary {
  popYear: number;
  total: { temples: number; churches: number };
  national: Record<string, number>;
  topDeities: [string, number][];
  counties: Record<string, { temples: number; churches: number; pop: number; groups: Record<string, number> }>;
}

const TW_TEXT = defineMessages({
  zh: {
    groups: (temples: string, churches: string) => `登記的寺廟 ${temples} 座、法人教會 ${churches} 個：寺廟的主祀神祇`,
    groupsAria: '台灣登記寺廟的主祀神祇分類',
    deities: '寫得最多的主祀神祇',
    deitiesAria: '台灣登記寺廟最常見的主祀神祇寫法',
    counties: (year: number) => `各縣市每十萬人幾座寺廟（${year} 年底的戶籍人口）`,
    countiesAria: '台灣各縣市每十萬人的登記寺廟數',
    county: (name: string, temples: number, churches: number) => `${name}（寺廟 ${fixed(temples, 0)} 座、法人教會 ${fixed(churches, 0)} 個）`,
    note: '主祀神祇是自由填寫的文字，依關鍵字歸類；只有向政府登記的寺廟與財團法人教會。',
  },
  en: {
    groups: (temples, churches) => `${temples} registered temples and ${churches} incorporated churches: temples by main deity`,
    groupsAria: 'Registered temples in Taiwan by main deity',
    deities: 'Most common main deities as written',
    deitiesAria: 'Most common main deity entries of registered temples in Taiwan',
    counties: (year) => `Temples per 100,000 people by county (registered population, end of ${year})`,
    countiesAria: 'Registered temples per 100,000 people in Taiwan’s counties',
    county: (name, temples, churches) => `${name} (${fixed(temples, 0)} temples, ${fixed(churches, 0)} churches)`,
    note: 'The main deity is free text, grouped by keyword; only temples registered with the government and churches incorporated as foundations are included.',
  },
});

/** 選了台灣時：主祀神祇的 8 類、寫得最多的神明、各縣市每十萬人幾座寺廟（2026-11-07，製作手冊 557） */
function TwTemples({ topic }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TW_TEXT[lang];
  const { data } = useJson<TwSummary>(`topics/${topic.id}/tw-temples-summary.json`);
  const view = useMemo(() => {
    if (!data) return null;
    const groups: BarListItem[] = TW_GROUPS.filter((g) => g.value !== 9).map((g) => ({
      key: String(g.value),
      label: tr(g.label, lang),
      value: data.national[String(g.value)] ?? 0,
      color: g.color,
    }));
    const deities: BarListItem[] = data.topDeities.slice(0, 10).map(([d, n]) => ({ key: d, label: d, value: n }));
    const counties: BarListItem[] = Object.entries(data.counties)
      .map(([c, v]) => ({ key: c, label: text.county(countyName(c), v.temples, v.churches), value: (v.temples / v.pop) * 1e5 }))
      .sort((a, b) => b.value - a.value);
    return { groups, deities, counties };
  }, [data, lang, text]);
  if (!data || !view) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.groups(fixed(data.total.temples, 0), fixed(data.total.churches, 0))}</h3>
      <BarList items={view.groups} format={(v) => fixed(v, 0)} total={data.total.temples} ariaLabel={text.groupsAria} />
      <h4>{text.deities}</h4>
      <BarList items={view.deities} format={(v) => fixed(v, 0)} ariaLabel={text.deitiesAria} properNouns />
      <h4>{text.counties(data.popYear)}</h4>
      <BarList items={view.counties} format={(v) => fixed(v, v >= 100 ? 0 : 1)} ariaLabel={text.countiesAria} />
      <p className="note">{text.note}</p>
    </section>
  );
}

export default function ReligionPanel(props: PanelExtraProps) {
  // 政府的宗教支出（556）：COFOG 08 的分項長條，跟文化主題共用
  if (props.indicator.id === 'gov-religion') return <Cofog08 {...props} />;
  // 台灣的寺廟（557）：只有台灣
  if (props.indicator.id === 'tw-temples') return props.iso3 === 'TWN' ? <TwTemples {...props} /> : null;
  if (!INDICES.some((d) => d.id === props.indicator.id)) return null;
  return <VdemIndices {...props} indices={INDICES} text={TEXT} scale={SCALE} />;
}
