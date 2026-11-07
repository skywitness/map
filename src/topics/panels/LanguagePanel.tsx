import { BarList } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { languageName, pct } from '../language';
import { ARTICLES, CASES, TONE, WORD_ORDER } from '../language-wals';
import { tr } from '../../i18n/lang';
import type { CategoryDef } from '../types';
import type { PanelExtraProps } from '../types';

type Status = 'official' | 'de_facto_official' | 'official_regional' | null;

/** pipeline/topics/language.py 輸出的側欄資料 */
interface LanguagesFile {
  /** 語言代碼 → [繁中名稱（CLDR 沒有時是 null）, 英文名稱] */
  names: Record<string, [string | null, string]>;
  countries: Record<
    string,
    {
      population?: number;
      /** [語言代碼, 會說的人口比例 %, 官方地位]，由多到少 */
      languages: [string, number, Status][];
      /** Glottolog：[還沒消失的語言數, 其中瀕危的] */
      glottolog?: [number, number];
    }
  >;
  notes: Record<string, string>;
  notesEn: Record<string, string>;
}

/** official-detail.json（pipeline/topics/language_official.py）：CLDR 的 [語言代碼, 官方地位]、Wikidata 的 [項目, 中文名, 英文名] */
type OfficialDetail = Record<string, { cldr?: [string, Exclude<Status, null>][]; wd?: [string, string, string][] }>;

/** 列出前幾種語言；其餘只寫種數 */
const SHOWN = 12;

const TEXT = defineMessages({
  zh: {
    title: '會說的語言',
    noCountry: 'CLDR 沒有這個國家的語言資料。',
    status: { official: '官方', de_facto_official: '事實上官方', official_regional: '部分地區官方' },
    more: (n: number, below: string) => `另有 ${n} 種語言，各不到 ${below}。`,
    note: '比例是會說這種語言的人口比例，包含當第二語言使用的人，所以加總常超過 100%。',
    glottolog: (n: number, endangered: number) =>
      `Glottolog 收錄 ${n} 種在這裡使用、還沒消失的語言（含手語）${endangered > 0 ? `，其中 ${endangered} 種瀕危` : ''}。`,
    listAria: (country: string) => `${country}會說的語言與比例`,
    officialTitle: '官方語言有幾種',
    sep: '、',
    cldr: (n: number, list: string) => `CLDR：${n} 種（${list}）`,
    regional: (list: string) => `部分地區官方：${list}`,
    wikidata: (n: number, list: string) => `Wikidata：${n} 種（${list}）`,
    wikidataNone: 'Wikidata：沒有列官方語言',
    officialNote: '兩個來源對「官方語言」的定義不同：CLDR 算官方與事實上官方，Wikidata 是編輯者列的清單。',
  },
  en: {
    title: 'Languages spoken',
    noCountry: 'CLDR has no language data for this country.',
    status: { official: 'official', de_facto_official: 'de facto official', official_regional: 'official in some regions' },
    more: (n, below) => `${n} more ${n === 1 ? 'language' : 'languages'}, each under ${below}.`,
    note: 'Shares are the share of the population who speak the language, including as a second language, so they often add up to more than 100%.',
    glottolog: (n, endangered) =>
      `Glottolog records ${n} languages spoken here that are not extinct (sign languages included)${endangered > 0 ? `, ${endangered} of them endangered` : ''}.`,
    listAria: (country) => `Languages spoken in ${country} and their shares`,
    officialTitle: 'How many official languages',
    sep: ', ',
    cldr: (n, list) => `CLDR: ${n} (${list})`,
    regional: (list) => `Official in some regions: ${list}`,
    wikidata: (n, list) => `Wikidata: ${n} (${list})`,
    wikidataNone: 'Wikidata: none listed',
    officialNote: 'The two sources define “official language” differently: CLDR counts official and de facto official languages; Wikidata is a list kept by its editors.',
  },
});

export default function LanguagePanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<LanguagesFile>(`topics/${topic.id}/languages.json`);
  // 官方語言有幾種（2026-11-05，第二十二批 393）
  const official = useJson<OfficialDetail>(`topics/${topic.id}/official-detail.json`).data?.[iso3];
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;

  const country = data.countries[iso3];
  const languages = country?.languages ?? [];
  const name = (code: string) => {
    const [zh, en] = data.names[code] ?? [null, code];
    // 主題設定的對照表（華語、台語…）與瀏覽器的名稱優先，跟地圖上的 tooltip 一致
    return languageName(code, lang) ?? (lang === 'zh' ? (zh ?? en) : en);
  };
  const shown = languages.slice(0, SHOWN);
  const rest = languages.slice(SHOWN);
  // 同一份清單的小數位數一致（普查的 96.8%、86.0%）
  const digits = shown.some(([, share]) => share >= 1 && !Number.isInteger(share)) ? 1 : 0;
  const format = (v: number) => pct(v, digits);
  const note = (lang === 'en' ? data.notesEn : data.notes)[iso3];

  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {languages.length === 0 ? (
        <p className="empty">{text.noCountry}</p>
      ) : (
        <>
          <BarList
            items={shown.map(([code, share, status]) => ({
              key: code,
              label: status ? `${name(code)} · ${text.status[status]}` : name(code),
              value: share,
            }))}
            max={100}
            format={format}
            ariaLabel={text.listAria(countryName)}
          />
          {rest.length > 0 && <p className="note">{text.more(rest.length, format(shown[shown.length - 1][1]))}</p>}
          <p className="note">{text.note}</p>
          {note && <p className="note">{t.note(note)}</p>}
        </>
      )}
      {country?.glottolog && <p className="note">{text.glottolog(...country.glottolog)}</p>}
      {official && (official.cldr?.length || official.wd) && (
        <>
          <h4>{text.officialTitle}</h4>
          {(() => {
            const cldr = official.cldr ?? [];
            const main = cldr.filter(([, s]) => s !== 'official_regional').map(([code]) => name(code));
            const regional = cldr.filter(([, s]) => s === 'official_regional').map(([code]) => name(code));
            const sep = text.sep;
            const wd = official.wd ?? [];
            return (
              <>
                {main.length > 0 && <p>{text.cldr(main.length, main.join(sep))}</p>}
                {regional.length > 0 && <p className="note">{text.regional(regional.join(sep))}</p>}
                <p>{wd.length ? text.wikidata(wd.length, wd.map(([, zh, en]) => (lang === 'zh' ? zh : en)).join(sep)) : text.wikidataNone}</p>
              </>
            );
          })()}
          <p className="note">{text.officialNote}</p>
        </>
      )}
      <WalsLanguages topic={topic.id} iso3={iso3} />
    </section>
  );
}

/** pipeline/topics/language_wals.py 的 wals-languages.json（2026-11-07，製作手冊 552）：[名稱, 語序, 聲調, 格, 冠詞]，0 是沒有值 */
const WALS_SHOWN = 8;
const WALS_TEXT = defineMessages({
  zh: {
    title: (n: number) => `WALS 收的這一國的語言（${n} 種）`,
    more: (n: number) => `還有 ${n} 種`,
    note: 'WALS（世界語言結構地圖集）的語序、聲調、名詞的格與冠詞；沒寫的是 WALS 沒有那一項。',
    sep: '・',
  },
  en: {
    title: (n: number) => `Languages of this country in WALS (${n})`,
    more: (n: number) => `${n} more`,
    note: 'Word order, tone, case and articles from WALS (World Atlas of Language Structures); features not shown have no WALS value.',
    sep: ' · ',
  },
});

function WalsLanguages({ topic, iso3 }: { topic: string; iso3: string }) {
  const lang = useLang();
  const text = WALS_TEXT[lang];
  const rows = useJson<{ countries: Record<string, [string, number, number, number, number][]> }>(`topics/${topic}/wals-languages.json`).data
    ?.countries[iso3];
  if (!rows?.length) return null;
  const label = (cats: CategoryDef[], v: number) => (v ? tr(cats.find((c) => c.value === v)?.label ?? '', lang) : null);
  const item = ([name, order, tone, cases, articles]: [string, number, number, number, number]) => (
    <li key={name}>
      <span className="plain-title" translate="no">
        {name}
      </span>
      <span className="plain-meta">
        {[label(WORD_ORDER, order), label(TONE, tone), label(CASES, cases), label(ARTICLES, articles)].filter(Boolean).join(text.sep)}
      </span>
    </li>
  );
  return (
    <>
      <h4>{text.title(rows.length)}</h4>
      <ul className="plain-list">{rows.slice(0, WALS_SHOWN).map(item)}</ul>
      {rows.length > WALS_SHOWN && (
        <details>
          <summary className="note">{text.more(rows.length - WALS_SHOWN)}</summary>
          <ul className="plain-list">{rows.slice(WALS_SHOWN).map(item)}</ul>
        </details>
      )}
      <p className="note">{text.note}</p>
    </>
  );
}
