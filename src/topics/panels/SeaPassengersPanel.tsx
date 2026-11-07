import { BarList } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { formatLargeNumber } from '../../lib/format';
import { MAP_TOKENS } from '../../theme/tokens';
import { dataFolder, type PanelExtraProps } from '../types';

/**
 * 台灣國際商港的五類客運（2026-11-07，製作手冊第二十七批 581；pipeline/topics/sea_passengers.py 的 sea-passengers-tw.json）：
 * 郵輪母港、郵輪掛靠港、國際渡輪、兩岸渡輪、國內客船的人次。其他國家沒有側欄區塊。
 */
interface TwFile {
  years: number[];
  kinds: string[];
  calls: number[][];
  people: number[][];
}

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `${y} 年台灣國際商港的旅客（港務公司）`,
    aria: '台灣國際商港各類客運的人次',
    kinds: { 'cruise-home': '郵輪母港', 'cruise-call': '郵輪掛靠港', 'ferry-intl': '國際渡輪', 'ferry-strait': '兩岸渡輪', domestic: '國內客船' } as Record<string, string>,
    n: (v: number) => `${formatLargeNumber(v)} 人次`,
    note: '國際商港（基隆、臺北、臺中、高雄、花蓮、蘇澳、安平）的進出港人次合計。',
  },
  en: {
    title: (y: number) => `Passengers at Taiwan’s international commercial ports, ${y}`,
    aria: 'Passengers at Taiwan’s international commercial ports by kind',
    kinds: { 'cruise-home': 'Cruise home port', 'cruise-call': 'Cruise port of call', 'ferry-intl': 'International ferries', 'ferry-strait': 'Cross-strait ferries', domestic: 'Domestic boats' } as Record<string, string>,
    n: (v: number) => formatLargeNumber(v),
    note: 'Arrivals plus departures at the international commercial ports (Keelung, Taipei, Taichung, Kaohsiung, Hualien, Suao and Anping).',
  },
});

export default function SeaPassengersPanel({ topic, iso3, year }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<TwFile>(iso3 === 'TWN' ? `topics/${dataFolder(topic)}/sea-passengers-tw.json` : null).data;
  if (iso3 !== 'TWN' || !d) return null;
  const k = d.years.includes(year) ? d.years.indexOf(year) : d.years.length - 1;
  const items = d.kinds
    .map((kind, n) => ({ key: kind, label: text.kinds[kind] ?? kind, value: d.people[k][n], color: MAP_TOKENS.categorical[n] }))
    .filter((x) => x.value > 0);
  return (
    <section className="panel-section">
      <h3>{text.title(d.years[k])}</h3>
      <BarList items={items} format={text.n} total={items.reduce((s, x) => s + x.value, 0)} ariaLabel={text.aria} />
      <p className="note">{text.note}</p>
    </section>
  );
}
