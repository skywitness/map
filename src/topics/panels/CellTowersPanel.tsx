import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 通訊塔主題的側欄（2026-11-07，製作手冊第二十七批 589；pipeline/topics/cell_towers.py 的 operators.json）：
 * 這一國 OSM 上行動電話天線與基地台的 operator 標籤前幾名（名稱照 OSM 原樣，同一家業者的不同寫法沒有合併）。
 */
interface Operators {
  countries: Record<string, [string, number][]>;
}

const TEXT = defineMessages({
  zh: {
    title: 'OpenStreetMap 上標的營運者',
    n: (v: number) => `${fixed(v, 0)} 個`,
    aria: (c: string) => `${c}的行動電話天線與基地台，依營運者`,
    note: '只算有標 operator 的天線與基地台；名稱照 OpenStreetMap 上的寫法，同一家業者的不同寫法（中英文、舊名）分開算。',
  },
  en: {
    title: 'Operators tagged on OpenStreetMap',
    n: (v: number) => fixed(v, 0),
    aria: (c: string) => `Mobile phone antennas and base stations in ${c}, by operator`,
    note: 'Only antennas and base stations with an operator tag; names are as written on OpenStreetMap, so different spellings of one operator (local and English names, old names) are counted separately.',
  },
});

export default function CellTowersPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<Operators>(`topics/${topic.id}/operators.json`).data;
  const ops = d?.countries[iso3];
  if (!ops?.length) return null;
  const items: BarListItem[] = ops.map(([name, n]) => ({ key: name, label: name, value: n }));
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <BarList items={items} format={text.n} ariaLabel={text.aria(countryName)} properNouns />
      <p className="note">{text.note}</p>
    </section>
  );
}
