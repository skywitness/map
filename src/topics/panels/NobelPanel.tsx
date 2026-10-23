import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang, useT, type Lang } from '../../i18n';
import { useJson } from '../../lib/data';
import { CATEGORIES, FIRST_YEAR, laureates, START, type Category } from '../nobel';
import type { PanelExtraProps } from '../types';

/**
 * pipeline/topics/nobel.py 輸出的 countries/<ISO3>.json：一個獎一列（居禮夫人有兩列），由新到舊。
 * [得主 id, 中文名稱（Wikidata 沒有時是 null）, 英文名稱, 年份, 獎項, 得獎理由（英文原文）, 出生地或成立地點（英文原文）]
 */
type Row = [id: number, zh: string | null, en: string, year: number, category: Category, motivation: string, place: string | null];

interface CountryFile {
  /** 出生在這裡的個人得主 */
  laureates?: Row[];
  /** 成立地點在這裡的得獎組織（不計入人數） */
  orgs?: Row[];
}

/** 先列出最近的幾筆，其餘收在「顯示其餘」裡 */
const SHOWN = 10;

const TEXT = defineMessages({
  zh: {
    title: (country: string) => `在${country}出生的得主`,
    summary: (from: number, to: number, prize: string, people: number, prizes: number) =>
      `${from}–${to} 年${prize}共 ${people} 位${prizes > people ? `（${prizes} 次得獎）` : ''}`,
    none: (to: number, prize: string) => `到 ${to} 年還沒有在這裡出生的${prize}得主。`,
    byCategory: '各獎項',
    byCategoryAria: (country: string) => `在${country}出生的各獎項得主人數`,
    list: '得主名單（由新到舊）',
    more: (n: number) => `顯示其餘 ${n} 筆`,
    born: '出生地',
    orgs: '在這裡成立的得獎組織',
    orgsNote: '組織沒有出生地，不計入上面的人數；地點是諾貝爾獎資料裡的成立地點。',
    founded: '成立地點',
    note: '依出生地、以今天的國界歸到國家，不是國籍；出生地是諾貝爾獎資料的寫法（括號裡是今天的地名）。得獎理由是諾貝爾獎網站的英文原文。',
  },
  en: {
    title: (country) => `Laureates born in ${country}`,
    summary: (from, to, prize, people, prizes) =>
      `${from}–${to}${prize ? `, ${prize}` : ''}: ${laureates(people)}${prizes > people ? ` (${prizes} prizes)` : ''}`,
    none: (to, prize) => `No ${prize ? `${prize} ` : ''}laureates born here up to ${to}.`,
    byCategory: 'By prize',
    byCategoryAria: (country) => `Laureates born in ${country} by prize`,
    list: 'Laureates (newest first)',
    more: (n) => `Show ${n} more`,
    born: 'born in',
    orgs: 'Organisations founded here',
    orgsNote: 'Organisations have no birthplace and are not counted above; the location is where the Nobel Prize data says they were founded.',
    founded: 'founded in',
    note: "Laureates are assigned by place of birth within today's borders, not by nationality; birthplaces are as written in the Nobel Prize data (today's name in brackets). Prize motivations are the original English text from nobelprize.org.",
  },
});

const categoryLabel = (id: Category, lang: Lang) => {
  const c = CATEGORIES.find((c) => c.id === id)!;
  return tr(c.short ?? c.label, lang);
};

export default function NobelPanel({ topic, iso3, year, item, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const index = useJson<string[]>(`topics/${topic.id}/countries/index.json`);
  const listed = index.data?.includes(iso3) ?? false;
  const country = useJson<CountryFile>(listed ? `topics/${topic.id}/countries/${iso3}.json` : null);
  // useJson 換檔時會留著上一份資料（路徑是 null 時也是），換國家時不能拿上一個國家的名單來顯示
  const data = listed && !country.loading ? country.data : null;

  const category = item && item !== 'all' ? (item as Category) : null;
  const from = (category && START[category]) ?? FIRST_YEAR;
  // 「全部獎項」不寫在摘要裡（中文「1901–2026 年共 300 位」，英文「1901–2026: 300 laureates」）
  const prize = category ? categoryLabel(category, lang) : '';

  const { people, orgs, count, byCategory } = useMemo(() => {
    const keep = (r: Row) => r[3] <= year && (!category || r[4] === category);
    const people = (data?.laureates ?? []).filter(keep);
    const counts = new Map<Category, Set<number>>();
    for (const r of people) {
      if (!counts.has(r[4])) counts.set(r[4], new Set());
      counts.get(r[4])!.add(r[0]);
    }
    return {
      people,
      orgs: (data?.orgs ?? []).filter(keep),
      count: new Set(people.map((r) => r[0])).size,
      byCategory: CATEGORIES.filter((c) => counts.has(c.id)).map((c) => ({
        key: c.id,
        label: categoryLabel(c.id, lang),
        value: counts.get(c.id)!.size,
      })),
    };
  }, [data, year, category, lang]);

  if (index.error) return <p className="empty">{t.loadFailed(index.error.message)}</p>;
  if (listed && !country.loading && country.error) return <p className="empty">{t.loadFailed(country.error.message)}</p>;
  if (!index.data || (listed && !data)) return <p className="empty">{t.loading}</p>;

  const row = (r: Row, org: boolean) => {
    const [id, zh, en, rowYear, rowCategory, motivation, place] = r;
    const showZh = lang === 'zh' && zh;
    return (
      <li key={`${id}-${rowYear}-${rowCategory}`}>
        <span className="plain-title">
          {showZh ? zh : <span translate="no">{en}</span>}
          {showZh && (
            <>
              {' '}
              <span className="muted" translate="no" lang="en">
                {en}
              </span>
            </>
          )}
        </span>
        <span className="plain-meta">
          {category ? rowYear : `${rowYear} · ${categoryLabel(rowCategory, lang)}`}
          {place && (
            <>
              {' · '}
              {org ? text.founded : text.born}{' '}
              <span translate="no" lang="en">
                {place}
              </span>
            </>
          )}
        </span>
        {motivation && (
          <span className="plain-meta" lang="en">
            “{motivation}”
          </span>
        )}
      </li>
    );
  };

  const list = (rows: Row[], org: boolean) => (
    <>
      <ul className="plain-list">{rows.slice(0, SHOWN).map((r) => row(r, org))}</ul>
      {rows.length > SHOWN && (
        <details>
          <summary className="note">{text.more(rows.length - SHOWN)}</summary>
          <ul className="plain-list">{rows.slice(SHOWN).map((r) => row(r, org))}</ul>
        </details>
      )}
    </>
  );

  return (
    <section className="panel-section">
      <h3>{text.title(countryName)}</h3>
      {count === 0 ? (
        <p className="empty">{text.none(year, prize)}</p>
      ) : (
        <>
          <p className="panel-year-note">{text.summary(from, year, prize, count, people.length)}</p>
          {!category && byCategory.length > 1 && (
            <>
              <h4>{text.byCategory}</h4>
              <BarList items={byCategory} format={laureates} ariaLabel={text.byCategoryAria(countryName)} />
            </>
          )}
          <h4>{text.list}</h4>
          {list(people, false)}
        </>
      )}
      {orgs.length > 0 && (
        <>
          <h4>{text.orgs}</h4>
          <p className="note">{text.orgsNote}</p>
          {list(orgs, true)}
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
