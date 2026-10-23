import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { cableCount, kilometres } from '../submarine-cables';
import type { PanelExtraProps } from '../types';

/**
 * pipeline/topics/submarine_cables.py 輸出的 countries/<ISO3>.json：在這個國家登陸的電纜，由新到舊。
 * [名稱, RFS 年份（TeleGeography，可能沒有）, 地圖上的年份（從這一年年底起算）, 長度（km）, 擁有者（逗號分隔）,
 *  規劃中（1／0）, 在這個國家的登陸點名稱, 同一條電纜登陸的其他國家]
 */
type Row = [
  name: string,
  rfs: number | null,
  year: number,
  length: number | null,
  owners: string,
  planned: 0 | 1,
  landings: string[],
  partners: string[],
];

interface CountryFile {
  cables: Row[];
}

/** 先列出最近的幾條，其餘收在「顯示其餘」裡 */
const SHOWN = 10;
/** 每條電纜列出的擁有者數，其餘寫「等 N 家」 */
const OWNERS_SHOWN = 6;
const PARTNERS_SHOWN = 15;

const TEXT = defineMessages({
  zh: {
    title: (country: string) => `在${country}登陸的海底電纜`,
    summary: (year: number, cables: string, partners: number) =>
      `到 ${year} 年底共 ${cables}，直接連到 ${partners} 個國家或地區。`,
    none: (year: number) => `到 ${year} 年底沒有海底電纜在這裡登陸（依 TeleGeography 的資料）。`,
    later: (n: number) => `另有 ${n} 條在時間軸這一年之後才啟用，拖動時間軸可以看到。`,
    inService: '營運中',
    planned: '規劃中（尚未啟用）',
    plannedNote: '年份是 TeleGeography 的預計啟用年份。地圖與統計從明年起才算進去：預計今年底前啟用、或預定年份已過還沒啟用的，都算在明年。',
    since: (rfs: number | null) => (rfs ? `${rfs} 年啟用` : '啟用年份不明'),
    expected: (rfs: number | null) => (rfs ? `預計 ${rfs} 年啟用` : '啟用年份未定'),
    landsAt: '登陸點：',
    owners: '擁有者：',
    moreOwners: (n: number) => ` 等 ${n} 家`,
    domestic: '國內電纜',
    more: (n: number) => `顯示其餘 ${n} 條`,
    partners: '直接連到的國家或地區',
    partnersNote: (n: number) =>
      `同一條電纜登陸的其他國家都算直接連到；長條是連到那裡的電纜數（含規劃中、時間軸這一年以前預計啟用的）。${n > PARTNERS_SHOWN ? `只列前 ${PARTNERS_SHOWN} 個。` : ''}`,
    partnersAria: (country: string) => `${country}經由海底電纜直接連到的國家`,
    note: '電纜名稱、登陸點與擁有者是 TeleGeography 的英文原文。TeleGeography 只收營運中與規劃中的電纜，已經退役的不在清單裡。',
  },
  en: {
    title: (country) => `Submarine cables landing in ${country}`,
    summary: (year, cables, partners) =>
      `${cables} by the end of ${year}, directly linking ${partners} ${partners === 1 ? 'country or territory' : 'countries and territories'}.`,
    none: (year) => `No submarine cables land here by the end of ${year} (per TeleGeography).`,
    later: (n) => `${n} more ${n === 1 ? 'enters' : 'enter'} service after the selected year; drag the time slider to see ${n === 1 ? 'it' : 'them'}.`,
    inService: 'In service',
    planned: 'Planned (not yet in service)',
    plannedNote: "Years are TeleGeography's expected ready-for-service dates. The map and statistics count planned cables from next year on; those due by the end of this year, or past their planned date, count from next year.",
    since: (rfs) => (rfs ? `In service since ${rfs}` : 'In service (year unknown)'),
    expected: (rfs) => (rfs ? `Expected ${rfs}` : 'Date to be determined'),
    landsAt: 'Lands at ',
    owners: 'Owners: ',
    moreOwners: (n) => ` and ${n} more`,
    domestic: 'domestic cable',
    more: (n) => `Show ${n} more`,
    partners: 'Directly linked countries and territories',
    partnersNote: (n) =>
      `Every other country a cable lands in counts as directly linked; bars show the number of cables to each (including planned cables due by the selected year).${n > PARTNERS_SHOWN ? ` Top ${PARTNERS_SHOWN} shown.` : ''}`,
    partnersAria: (country) => `Countries linked to ${country} by submarine cable`,
    note: "Cable names, landing points and owners are TeleGeography's original English text. TeleGeography lists only cables in service or planned; retired cables are not included.",
  },
});

export default function SubmarineCablesPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const countries = useJson<CountryTable>('countries.json').data;
  const index = useJson<string[]>(`topics/${topic.id}/countries/index.json`);
  const listed = index.data?.includes(iso3) ?? false;
  const file = useJson<CountryFile>(listed ? `topics/${topic.id}/countries/${iso3}.json` : null);
  // useJson 換檔時會留著上一份資料，換國家時不能拿上一個國家的清單來顯示
  const data = listed && !file.loading ? file.data : null;

  const { active, planned, counted, later, partners } = useMemo(() => {
    const rows = data?.cables ?? [];
    // 地圖與統計：從「地圖上的年份」那一年年底起算（規劃中的電纜從明年起）
    const counted = rows.filter((r) => r[2] <= year);
    const links = new Map<string, number>();
    for (const r of counted) for (const p of r[7]) links.set(p, (links.get(p) ?? 0) + 1);
    return {
      active: counted.filter((r) => !r[5]),
      // 規劃中的一律列出（預設的今年不算進統計，但側欄要看得到）
      planned: rows.filter((r) => r[5]).sort((a, b) => (a[1] ?? 9999) - (b[1] ?? 9999) || a[0].localeCompare(b[0])),
      counted,
      later: rows.filter((r) => !r[5] && r[2] > year).length,
      partners: [...links.entries()]
        .map(([key, value]) => ({ key, label: nameOf(key, countries, lang), value }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, lang === 'zh' ? 'zh-Hant' : 'en')),
    };
  }, [data, year, countries, lang]);

  if (index.error) return <p className="empty">{t.loadFailed(index.error.message)}</p>;
  if (listed && !file.loading && file.error) return <p className="empty">{t.loadFailed(file.error.message)}</p>;
  if (!index.data || (listed && !data)) return <p className="empty">{t.loading}</p>;

  const row = (r: Row, i: number) => {
    const [name, rfs, , length, owners, isPlanned, landings, others] = r;
    const ownerList = owners ? owners.split(', ') : [];
    const meta = [isPlanned ? text.expected(rfs) : text.since(rfs), length ? kilometres(length) : null, others.length ? null : text.domestic]
      .filter(Boolean)
      .join(' · ');
    return (
      <li key={`${name}-${i}`}>
        <span className="plain-title" translate="no">
          {name}
        </span>
        <span className="plain-meta">
          {meta}
          {landings.length > 0 && (
            <>
              {' · '}
              {text.landsAt}
              <span translate="no">{landings.join(', ')}</span>
            </>
          )}
        </span>
        {ownerList.length > 0 && (
          <span className="plain-meta">
            {text.owners}
            <span translate="no">{ownerList.slice(0, OWNERS_SHOWN).join(', ')}</span>
            {ownerList.length > OWNERS_SHOWN && text.moreOwners(ownerList.length)}
          </span>
        )}
      </li>
    );
  };

  const list = (rows: Row[]) => (
    <>
      <ul className="plain-list">{rows.slice(0, SHOWN).map(row)}</ul>
      {rows.length > SHOWN && (
        <details>
          <summary className="note">{text.more(rows.length - SHOWN)}</summary>
          <ul className="plain-list">{rows.slice(SHOWN).map(row)}</ul>
        </details>
      )}
    </>
  );

  return (
    <section className="panel-section">
      <h3>{text.title(countryName)}</h3>
      {counted.length === 0 ? (
        <p className="empty">{text.none(year)}</p>
      ) : (
        <p className="panel-year-note">{text.summary(year, cableCount(counted.length), partners.length)}</p>
      )}
      {later > 0 && <p className="note">{text.later(later)}</p>}
      {active.length > 0 && (
        <>
          <h4>{text.inService}</h4>
          {list(active)}
        </>
      )}
      {planned.length > 0 && (
        <>
          <h4>{text.planned}</h4>
          <p className="note">{text.plannedNote}</p>
          {list(planned)}
        </>
      )}
      {partners.length > 0 && (
        <>
          <h4>{text.partners}</h4>
          <BarList
            items={partners.slice(0, PARTNERS_SHOWN)}
            format={cableCount}
            ariaLabel={text.partnersAria(countryName)}
          />
          <p className="note">{text.partnersNote(partners.length)}</p>
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
