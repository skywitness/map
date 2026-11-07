import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { MAP_TOKENS } from '../../theme/tokens';
import { NST07 } from '../rail-goods';
import { dataFolder, type PanelExtraProps } from '../types';

/**
 * 鐵路的側欄（2026-11-07，製作手冊第二十七批 566、567）：有名稱的廢線（pipeline/topics/rail_abandoned.py 的
 * rail-abandoned-names.json）與鐵路事故的死者身分、事故類型（rail_accidents.py 的 rail-accidents-detail.json）；
 * 568 的貨類（rail_goods.py 的 rail-goods-detail.json）。
 */

interface GoodsFile {
  years: number[];
  countries: Record<string, Record<string, (number | null)[]>>;
}

interface NamesFile {
  countries: Record<string, { a?: [string, number][]; d?: [string, number][] }>;
}

interface AccidentFile {
  years: number[];
  countries: Record<string, { k: Record<string, (number | null)[]>; a: Record<string, (number | null)[]> }>;
}

const PERSONS = ['PAS', 'EMP', 'OTH', 'UNK'] as const;
const TYPES = ['COLLIS', 'DERAIL', 'LVLCROS', 'RSTK_MOT', 'RSTK_FIRE', 'OTH', 'UNK'] as const;

const TEXT = defineMessages({
  zh: {
    names: (disused: boolean): string => (disused ? '有名稱的停用鐵路' : '有名稱的廢線'),
    namesAria: (country: string, disused: boolean) => `${country}${disused ? '停用' : '已拆除'}的鐵路依名稱的長度`,
    noNames: 'OpenStreetMap 上這個國家沒有標了名稱的這類鐵路。',
    namesNote: '名稱是 OpenStreetMap 的原文，同名的線段加總；列最長的 15 條。',
    km: (v: number) => `${fixed(v, v < 10 ? 1 : 0)} 公里`,
    persons: (year: number) => `${year} 年的死者身分`,
    types: (year: number) => `${year} 年的事故類型`,
    personsAria: (country: string) => `${country}鐵路事故死者的身分`,
    typesAria: (country: string) => `${country}重大鐵路事故的類型`,
    person: { PAS: '旅客', EMP: '鐵路員工', OTH: '其他（平交道使用者、擅自進入路線的人等）', UNK: '不明' },
    type: {
      COLLIS: '列車碰撞',
      DERAIL: '出軌',
      LVLCROS: '平交道事故',
      RSTK_MOT: '行進中的車輛撞到人',
      RSTK_FIRE: '車輛起火',
      OTH: '其他',
      UNK: '不明',
    },
    people: (v: number) => `${fixed(v, 0)} 人`,
    cases: (v: number) => `${fixed(v, 0)} 件`,
    noDeaths: '這一年沒有人死亡。',
    noYear: 'Eurostat 沒有這一年的資料。',
    noData: 'Eurostat 沒有這個國家的鐵路事故資料（只有歐洲各國，2004–2016 年）。',
    goods: (year: number) => `${year} 年鐵路運的貨（依貨類）`,
    goodsAria: (country: string) => `${country}鐵路貨運依貨類的運量`,
    kt: (v: number) => `${fixed(v, 0)} 千公噸`,
    goodsTotal: (v: string) => `合計 ${v} 千公噸。`,
    noGoods: 'Eurostat 沒有這個國家的鐵路貨類資料（只有歐洲各國，2008 年起）。',
  },
  en: {
    names: (disused) => (disused ? 'Named disused railways' : 'Named abandoned railways'),
    namesAria: (country, disused) => `${disused ? 'Disused' : 'Abandoned'} railways in ${country} by name and length`,
    noNames: 'OpenStreetMap has no named railways of this kind in this country.',
    namesNote: 'Names are as written on OpenStreetMap; segments with the same name are added up. The 15 longest are listed.',
    km: (v) => `${fixed(v, v < 10 ? 1 : 0)} km`,
    persons: (year) => `Who died in ${year}`,
    types: (year) => `Accident types in ${year}`,
    personsAria: (country) => `Victims of railway accidents in ${country}`,
    typesAria: (country) => `Types of significant railway accidents in ${country}`,
    person: {
      PAS: 'Passengers',
      EMP: 'Railway staff',
      OTH: 'Others (level-crossing users, trespassers, etc.)',
      UNK: 'Unknown',
    },
    type: {
      COLLIS: 'Train collisions',
      DERAIL: 'Derailments',
      LVLCROS: 'Level-crossing accidents',
      RSTK_MOT: 'People struck by moving rolling stock',
      RSTK_FIRE: 'Fires in rolling stock',
      OTH: 'Other',
      UNK: 'Unknown',
    },
    people: (v) => fixed(v, 0),
    cases: (v) => fixed(v, 0),
    noDeaths: 'No one died this year.',
    noYear: 'Eurostat has no data for this year.',
    noData: 'Eurostat has no railway accident data for this country (European countries only, 2004–2016).',
    goods: (year) => `Rail freight by type of goods, ${year}`,
    goodsAria: (country) => `Rail freight tonnage by type of goods in ${country}`,
    kt: (v) => `${fixed(v, 0)} thousand t`,
    goodsTotal: (v) => `Total ${v} thousand tonnes.`,
    noGoods: 'Eurostat has no rail freight data by type of goods for this country (European countries only, from 2008).',
  },
});

export function RailNamesSection({ topic, indicator, iso3, countryName }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const data = useJson<NamesFile>(`topics/${dataFolder(topic)}/rail-abandoned-names.json`).data;
  if (!data) return null;
  const disused = indicator.id === 'rail-disused';
  const rows = data.countries[iso3]?.[disused ? 'd' : 'a'] ?? [];
  return (
    <section className="panel-section">
      <h3>{text.names(disused)}</h3>
      {rows.length ? (
        <BarList
          items={rows.map(([name, km], i) => ({ key: `${i}-${name}`, label: name, value: km }))}
          format={text.km}
          ariaLabel={text.namesAria(countryName, disused)}
          properNouns
        />
      ) : (
        <p className="empty">{text.noNames}</p>
      )}
      <p className="note">{text.namesNote}</p>
    </section>
  );
}

export function RailAccidentsSection({ topic, iso3, year, countryName }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const data = useJson<AccidentFile>(`topics/${dataFolder(topic)}/rail-accidents-detail.json`).data;
  if (!data) return null;
  const row = data.countries[iso3];
  if (!row) return <p className="empty">{text.noData}</p>;
  const i = data.years.indexOf(year);
  const at = (s: (number | null)[] | undefined) => (i < 0 || !s ? null : s[i]);
  const persons = PERSONS.map((p, n) => ({ key: p, label: text.person[p], value: at(row.k[p]), color: MAP_TOKENS.categorical[n] }));
  const types = TYPES.map((t, n) => ({ key: t, label: text.type[t], value: at(row.a[t]), color: MAP_TOKENS.categorical[n] }));
  const shown = <T extends { value: number | null }>(items: T[]) => items.filter((x) => x.value !== null && x.value > 0) as (T & { value: number })[];
  const deathYear = persons.some((p) => p.value !== null);
  const typeYear = types.some((t) => t.value !== null);
  return (
    <>
      <section className="panel-section">
        <h3>{text.persons(year)}</h3>
        {!deathYear ? (
          <p className="empty">{text.noYear}</p>
        ) : shown(persons).length ? (
          <BarList
            items={shown(persons)}
            format={text.people}
            total={shown(persons).reduce((s, x) => s + x.value, 0)}
            ariaLabel={text.personsAria(countryName)}
          />
        ) : (
          <p className="empty">{text.noDeaths}</p>
        )}
      </section>
      <section className="panel-section">
        <h3>{text.types(year)}</h3>
        {typeYear && shown(types).length ? (
          <BarList items={shown(types)} format={text.cases} ariaLabel={text.typesAria(countryName)} />
        ) : (
          <p className="empty">{text.noYear}</p>
        )}
      </section>
    </>
  );
}

export function RailGoodsSection({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const data = useJson<GoodsFile>(`topics/${dataFolder(topic)}/rail-goods-detail.json`).data;
  if (!data) return null;
  const row = data.countries[iso3];
  const i = data.years.indexOf(year);
  const total = row && i >= 0 ? row.TOTAL?.[i] : null;
  if (!row || total === null || total === undefined) return <p className="empty">{text.noGoods}</p>;
  const items = Object.keys(NST07)
    .map((k) => ({ key: k, label: tr(NST07[k], lang), value: row[k]?.[i] ?? 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  return (
    <section className="panel-section">
      <h3>{text.goods(year)}</h3>
      <BarList items={items} format={text.kt} total={total} ariaLabel={text.goodsAria(countryName)} />
      <p className="note">{text.goodsTotal(fixed(total, 0))}</p>
    </section>
  );
}
