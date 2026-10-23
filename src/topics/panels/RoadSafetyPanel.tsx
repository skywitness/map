import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang, type Text } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

/** composition.json（pipeline/topics/road_safety.py）：各國各年的死亡組成（%），順序跟 users／twnUsers 一樣 */
interface Composition {
  users: string[];
  twnUsers: string[];
  countries: Record<string, Record<string, number[]>>;
}

/** 道路使用者：WHO 的五類，台灣（交通部的駕乘車種）多一類「乘客」（不分車種） */
const USERS: Record<string, { label: Text; hue: Hue }> = {
  moto: { label: { zh: '機車（二、三輪機動車）', en: 'Motorcycles (powered 2- and 3-wheelers)' }, hue: 'orange' },
  pedestrian: { label: { zh: '行人', en: 'Pedestrians' }, hue: 'red' },
  cyclist: { label: { zh: '自行車', en: 'Cyclists' }, hue: 'green' },
  car: { label: { zh: '汽車（四輪以上）', en: 'Cars and other 4-wheelers' }, hue: 'blue' },
  passenger: { label: { zh: '乘客（不分車種）', en: 'Passengers (any vehicle)' }, hue: 'violet' },
  other: { label: { zh: '其他、不明', en: 'Other or unknown' }, hue: 'yellow' },
};
const ORDER = ['moto', 'pedestrian', 'cyclist', 'car', 'passenger', 'other'];

const TEXT = defineMessages({
  zh: {
    title: (year: number) => `死者是哪一類道路使用者（${year} 年）`,
    aria: (country: string) => `${country}道路交通死亡者的組成`,
    whoNote: '各國向 WHO 通報的死亡人數依道路使用者分（Global Status Report on Road Safety）。',
    twnNote: '交通部統計查詢網的 30 日內死亡人數，依死者的駕乘車種分；機車只算騎士，乘客不分車種另外一類。自行車含電動輔助自行車與微型電動二輪車。',
  },
  en: {
    title: (year) => `Road deaths by type of road user (${year})`,
    aria: (country) => `Road deaths by type of road user in ${country}`,
    whoNote: 'Deaths by road user as reported by the country to WHO (Global Status Report on Road Safety).',
    twnNote:
      'Ministry of Transportation and Communications deaths within 30 days by the victim’s mode of travel; motorcycles count riders only and passengers of all vehicles form a separate group. Cyclists include e-bikes and light electric scooters.',
  },
});

const pct = (v: number) => `${fixed(v, 1)}%`;

export default function RoadSafetyPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<Composition>(`topics/${topic.id}/composition.json`);

  const view = useMemo(() => {
    const own = data?.countries[iso3];
    if (!data || !own) return null;
    // 時間軸那一年以前最近的一次；都在那一年以後（例如 2010 年時）就用最早的一次
    const years = Object.keys(own).map(Number).sort((a, b) => a - b);
    const shown = [...years].reverse().find((y) => y <= year) ?? years[0];
    const users = iso3 === 'TWN' ? data.twnUsers : data.users;
    const values = own[String(shown)];
    const items = ORDER.filter((u) => users.includes(u)).map((u) => ({
      key: u,
      label: tr(USERS[u].label, lang),
      value: values[users.indexOf(u)] ?? 0,
      color: tokens.hues[USERS[u].hue],
    }));
    return { year: shown, items };
  }, [data, iso3, year, tokens, lang]);

  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title(view.year)}</h3>
      <BarList items={view.items} format={pct} max={100} ariaLabel={text.aria(countryName)} />
      <p className="note">{iso3 === 'TWN' ? text.twnNote : text.whoNote}</p>
    </section>
  );
}
