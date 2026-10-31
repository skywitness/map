import type { ReactNode } from 'react';
import { defineMessages, tr, useLang, useT, type Lang, type Text } from '../../i18n';
import { countryName, type CountryTable } from '../../lib/countries';
import { useCountryPart, useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import { REGIMES } from '../democracy';
import { ALLY } from '../diplomacy';
import { languageName } from '../language';
import { ORGS } from '../organizations';
import { FlagImage, useFlags } from '../flagImages';
import { metres } from '../skyscrapers';
import {
  CAPITAL_NOTES,
  CAPITAL_ROLES,
  GOVERNMENT,
  LANDLOCKED,
  RELATIONS,
  STATUS,
  TERRITORY,
} from '../profiles';
import { DRIVING, TAIWAN_OFFSET, utcText, versusTaiwan } from '../travel';
import type { IndicatorData, PanelExtraProps } from '../types';
import { openTopic, TopicLink, topicHref } from './TopicLink';

/** 名稱：[中文或 null, 英文或 null]（pipeline/topics/profiles.py 的 name()） */
type Name = [string | null, string | null];

interface Head {
  /** 職稱；沒有是 null */
  t: Name | null;
  /** [中文, 英文, 起始日期 YYYY-MM-DD 或 null]，好幾個人時（安道爾的兩位大公、波士尼亞的三人主席團）都列 */
  p: [string | null, string | null, string | null][];
}

/** profiles.json 裡一個國家的小檔案；鍵很短是為了檔案小 */
interface Profile {
  q?: string;
  /** 首都：名稱、角色（CAPITAL_ROLES）、地位有爭議（d） */
  cap?: { n: Name | null; r?: string; d?: number }[];
  hos?: Head;
  /** 政府首長；same 是由元首兼任（總統制） */
  hog?: Head | { same: number };
  gov?: number;
  /** [ISO 4217（索馬利蘭先令這種沒有代碼的是 null）, 中文, 英文] */
  cur?: [string | null, string | null, string | null][];
  tel?: string[];
  tld?: string[];
  /** [alpha-2, alpha-3, 數字代碼] */
  iso?: [string | null, string | null, string | null];
  anthem?: Name[];
  /** Wikidata 的成立時間：YYYY、YYYY-MM 或 YYYY-MM-DD */
  inc?: string;
  /** 屬地的主權國與關係（RELATIONS） */
  sov?: string;
  rel?: string;
  /** 陸地鄰國（依共用國界長度排）與內陸國（LANDLOCKED） */
  nb?: string[];
  ll?: number;
  pop?: number;
  /** [km², FAOSTAT 的年份] */
  area?: [number, number];
  /** 其他主題的值（pipeline 的 cross_topics()） */
  x?: {
    drive?: number;
    tz?: number;
    lang?: string;
    regime?: number;
    orgs?: number;
    ally?: number;
    high?: [string | null, string | null, number];
    city?: [string | null, string | null, number];
    /** 摩天大樓主題：Wikidata 收錄的最高的大樓 [中文, 英文, 高度 m, 完工年] */
    tower?: [string | null, string | null, number, number];
  };
}

/**
 * 小檔案依國家分檔（pipeline/panel_parts.py，profiles/<ISO3>.json，2026-10-31；原本整份 160 KB）；
 * 各國共用的日期與年份在 profiles/index.json
 */
interface ProfilesIndex {
  /** Wikidata 的查詢日期 */
  date: string;
  popYear: number;
  /** V-Dem 政體分類（x.regime）的年份 */
  regimeYear: number;
}

const TEXT = defineMessages({
  zh: {
    title: '國家小檔案',
    capital: '首都',
    territoryCapital: '首府',
    hos: '國家元首',
    hog: '政府首長',
    sameAsHos: '由國家元首兼任',
    since: (date: string) => `${date}起`,
    government: '政體形式',
    currency: '貨幣',
    population: (year: number) => `人口（${year} 年推估）`,
    area: '陸地面積',
    areaYear: (year: number) => `${year} 年，不含內陸水域`,
    neighbours: '陸地鄰國',
    noNeighbours: '沒有（只有海上鄰國）',
    calling: '國際電話區號',
    tld: '網域',
    iso: 'ISO 3166-1 代碼',
    anthem: '國歌',
    inception: '成立時間',
    inceptionNote: '（Wikidata）',
    sovereign: (rel: string, sov: string) => `${rel}，主權屬於${sov}。`,
    sar: (rel: string) => `${rel}。`,
    disputed: '地位有爭議',
    more: '其他主題',
    drive: (side: string, time: string) => `${side}；${time}`,
    language: (name: string) => `主要官方語言：${name}`,
    regime: (name: string, year: number) => `V-Dem 政體分類（${year} 年）：${name}`,
    city: (name: string, pop: string) => `最大城市：${name}（約 ${pop}人）`,
    high: (name: string, m: string) => `最高點：${name}${m}`,
    tower: (name: string, m: string, year: number) => `最高的大樓：${name}（${m}，${year} 年完工）`,
    orgs: (n: number, total: number) => `參加 ${total} 個國際組織裡的 ${n} 個`,
    ally: (status: string) => `跟中華民國：${status}`,
    dataDate: (date: string) => `資料取自 Wikidata，${date}。`,
    dataNote:
      '元首與政府首長會隨選舉、政變改變，以各國官方公布為準。成立時間是 Wikidata 的「成立時間」（P571），只在 Wikidata 列了一個值時才寫；各國的定義不一（可能是獨立、建國，或現行國號、政體開始的時間）。人口是聯合國 WPP 2024 的推估，陸地面積是 FAOSTAT。',
    noData: '沒有資料。',
    flagAlt: (name: string) => `${name}的旗`,
    paren: (s: string) => `（${s}）`,
    list: (items: string[]) => items.join('、'),
    count: (n: number, names: string) => `${n} 個：${names}`,
  },
  en: {
    title: 'Country profile',
    capital: 'Capital',
    territoryCapital: 'Capital (territory)',
    hos: 'Head of state',
    hog: 'Head of government',
    sameAsHos: 'The head of state',
    since: (date: string) => `since ${date}`,
    government: 'System of government',
    currency: 'Currency',
    population: (year: number) => `Population (${year} projection)`,
    area: 'Land area',
    areaYear: (year: number) => `${year}, excluding inland water`,
    neighbours: 'Land neighbours',
    noNeighbours: 'None (maritime neighbours only)',
    calling: 'Calling code',
    tld: 'Internet domain',
    iso: 'ISO 3166-1 codes',
    anthem: 'Anthem',
    inception: 'Inception',
    inceptionNote: ' (Wikidata)',
    sovereign: (rel: string, sov: string) => `${rel}; sovereignty: ${sov}.`,
    sar: (rel: string) => `${rel}.`,
    disputed: 'status disputed',
    more: 'In other topics',
    drive: (side: string, time: string) => `${side}; ${time}`,
    language: (name: string) => `Main official language: ${name}`,
    regime: (name: string, year: number) => `V-Dem regime type (${year}): ${name}`,
    city: (name: string, pop: string) => `Largest city: ${name} (about ${pop})`,
    high: (name: string, m: string) => `Highest point: ${name}${m}`,
    tower: (name: string, m: string, year: number) => `Tallest building: ${name} (${m}, completed ${year})`,
    orgs: (n: number, total: number) => `Member of ${n} of the ${total} organisations covered`,
    ally: (status: string) => `Relations with the Republic of China (Taiwan): ${status}`,
    dataDate: (date: string) => `Data from Wikidata, ${date}. `,
    dataNote:
      'Heads of state and government change with elections and coups; check official sources. Inception is Wikidata’s “inception” (P571), shown only when Wikidata lists a single value; its meaning varies by country (independence, foundation, or the start of the current name or regime). Population is the UN WPP 2024 projection; land area is from FAOSTAT.',
    noData: 'No data.',
    flagAlt: (name: string) => `Flag of ${name}`,
    paren: (s: string) => ` (${s})`,
    list: (items: string[]) => items.join(', '),
    count: (n: number, names: string) => `${n}: ${names}`,
  },
});

/** 其他主題的名稱（連結文字），跟各主題的 shortTitle 一樣 */
const TOPIC_LINKS: Record<string, { topic: string; ind?: string; label: Text }> = {
  travel: { topic: 'travel', ind: 'driving', label: { zh: '旅行實用', en: 'Travel' } },
  language: { topic: 'language', ind: 'main', label: { zh: '語言', en: 'Languages' } },
  democracy: { topic: 'democracy', ind: 'regime', label: { zh: '民主與自由', en: 'Democracy' } },
  cities: { topic: 'cities', label: { zh: '城市', en: 'Cities' } },
  elevation: { topic: 'elevation', ind: 'highest', label: { zh: '海拔', en: 'Elevation' } },
  skyscrapers: { topic: 'skyscrapers', ind: 'tallest', label: { zh: '摩天大樓', en: 'Skyscrapers' } },
  organizations: { topic: 'organizations', ind: 'count', label: { zh: '國際組織', en: "Int'l orgs" } },
  diplomacy: { topic: 'taiwan-diplomacy', ind: 'allies', label: { zh: '台灣的外交', en: 'Taiwan ties' } },
};

const OWN_DRIVE: Text = { zh: '靠右行駛', en: 'Drives on the right' };

/** 名稱依語言挑；沒有這個語言的名稱時用另一個，原文放在 translate="no" 裡 */
function pick(name: Name | null | undefined, lang: Lang): { text: string; foreign: boolean } | null {
  if (!name) return null;
  const [zh, en] = name;
  const own = lang === 'zh' ? zh : en;
  if (own) return { text: own, foreign: false };
  const other = lang === 'zh' ? en : zh;
  return other ? { text: other, foreign: true } : null;
}

function NameText({ name, lang }: { name: Name | null | undefined; lang: Lang }) {
  const n = pick(name, lang);
  if (!n) return null;
  return n.foreign ? <span translate="no">{n.text}</span> : <>{n.text}</>;
}

/** 2024-05-20 → 「2024 年 5 月 20 日」或「20 May 2024」；只有年或年月時照精確度寫 */
function dateText(value: string, lang: Lang): string {
  const [y, m, d] = value.split('-').map(Number);
  if (lang === 'zh') return `${y} 年${m ? ` ${m} 月` : ''}${d ? ` ${d} 日` : ''}`; // i18n-ignore（只在中文介面）
  if (!m) return String(y);
  const month = new Date(Date.UTC(2000, m - 1, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  return d ? `${d} ${month} ${y}` : `${month} ${y}`;
}

/** 其他主題的連結（panels/TopicLink.tsx：在網頁裡換主題，按住 Ctrl、Cmd 等開新分頁時照一般連結） */
function OtherTopic({ id, iso3 }: { id: keyof typeof TOPIC_LINKS; iso3: string }) {
  const link = TOPIC_LINKS[id];
  return (
    <TopicLink topic={link.topic} ind={link.ind} iso3={iso3}>
      {tr(link.label)}
    </TopicLink>
  );
}

function HeadLine({ head, lang }: { head: Head; lang: Lang }) {
  const text = TEXT[lang];
  const title = pick(head.t, lang);
  return (
    <>
      {title && <span className="profile-sub">{title.foreign ? <span translate="no">{title.text}</span> : title.text}</span>}
      {head.p.map(([zh, en, start], i) => (
        <span key={`${zh ?? en}-${i}`} className="profile-person">
          <NameText name={[zh, en]} lang={lang} />
          {start && <span className="profile-muted">{text.paren(text.since(dateText(start, lang)))}</span>}
        </span>
      ))}
    </>
  );
}

/**
 * 小檔案最上面：國旗（國旗主題的 flags.json，連到國旗主題）在左邊，屬地的主權國、爭議地區的說明在右邊
 */
function ProfileHero({ status, flag }: { status: ReactNode[]; flag?: ReactNode }) {
  if (!status.length && !flag) return null;
  return (
    <div className="profile-hero">
      {flag}
      <div className="profile-hero-text">
        {status.map((s, i) => (
          <p key={i} className="profile-status">
            {s}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function ProfilesPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { index: data, part, loading } = useCountryPart<Profile, ProfilesIndex>(`topics/${topic.id}/profiles`, iso3);
  const countries = useJson<CountryTable>('countries.json').data;
  const government = useJson<IndicatorData>(`topics/${topic.id}/government.json`).data;
  const neighbours = useJson<IndicatorData>(`topics/${topic.id}/neighbours.json`).data;
  const flagEntry = useFlags()?.units[iso3];
  if (!data || loading) return <p className="empty">{t.loading}</p>;
  const p: Profile | undefined = part ?? undefined;
  const name = (code: string) => countryName(code, countries, lang);
  // 國旗連到國旗主題（同一個國家），點了看完整的國旗、顏色與圖案
  const flag = flagEntry && (
    <a className="profile-flag-link" href={topicHref('flags', undefined, iso3)} onClick={(e) => openTopic(e, 'flags', iso3)}>
      <FlagImage entry={flagEntry} alt={text.flagAlt(name(iso3))} height={44} className="profile-flag" />
    </a>
  );

  const status: ReactNode[] = [];
  if (p?.rel && p.sov) {
    const rel = tr(RELATIONS[p.rel] ?? '', lang);
    status.push(p.rel === 'cn-sar' ? text.sar(rel) : text.sovereign(rel, name(p.sov)));
  }
  if (STATUS[iso3]) status.push(tr(STATUS[iso3], lang));

  if (!p) {
    return (
      <section className="panel-section">
        <h3>{text.title}</h3>
        <ProfileHero status={status} flag={flag} />
        {!status.length && <p className="empty">{text.noData}</p>}
      </section>
    );
  }

  const rows: [string, ReactNode][] = [];
  // 首都
  if (p.cap?.length) {
    const note = CAPITAL_NOTES[iso3];
    rows.push([
      p.sov ? text.territoryCapital : text.capital,
      <>
        {p.cap.map((c, i) => (
          <span key={i} className="profile-person">
            <NameText name={c.n} lang={lang} />
            {(c.r || c.d) && (
              <span className="profile-muted">
                {text.paren(text.list([c.r && CAPITAL_ROLES[c.r] ? tr(CAPITAL_ROLES[c.r], lang) : '', c.d ? text.disputed : ''].filter(Boolean)))}
              </span>
            )}
          </span>
        ))}
        {note && <span className="profile-sub">{tr(note, lang)}</span>}
      </>,
    ]);
  }
  if (p.hos) rows.push([text.hos, <HeadLine head={p.hos} lang={lang} />]);
  if (p.hog) rows.push([text.hog, 'same' in p.hog ? text.sameAsHos : <HeadLine head={p.hog} lang={lang} />]);
  if (p.gov !== undefined) {
    const label = tr(GOVERNMENT.find((g) => g.value === p.gov)?.label ?? TERRITORY, lang);
    // 屬地的短註是「英國海外領土」這類，最上面已經寫了
    const hint = p.sov ? undefined : (lang === 'en' ? government?.hintsEn : government?.hints)?.[iso3];
    rows.push([text.government, <>{label}{hint && <span className="profile-sub">{hint}</span>}</>]);
  }
  if (p.cur?.length) {
    const currency = ([code, zh, en]: [string | null, string | null, string | null]) => {
      const n = pick([zh, en], lang)?.text;
      return code ? `${n ?? code}${text.paren(code)}` : (n ?? '');
    };
    rows.push([text.currency, text.list(p.cur.map(currency))]);
  }
  // 10 萬人以下寫完整的數字（格陵蘭 55,629 人，不寫「6 萬」）
  if (p.pop) rows.push([text.population(data.popYear), p.pop < 1e5 ? fixed(p.pop, 0) : formatLargeNumber(p.pop)]);
  if (p.area) {
    rows.push([
      text.area,
      <>
        {`${fixed(p.area[0], p.area[0] < 10 ? 2 : 0)} km²`}
        <span className="profile-muted">{text.paren(text.areaYear(p.area[1]))}</span>
      </>,
    ]);
  }
  if (p.nb) {
    const hint = (lang === 'en' ? neighbours?.hintsEn : neighbours?.hints)?.[iso3];
    const ll = p.ll !== undefined && p.ll !== 3 ? tr(LANDLOCKED.find((c) => c.value === p.ll)?.label ?? '', lang) : null;
    rows.push([
      text.neighbours,
      <>
        {p.nb.length ? text.count(p.nb.length, text.list(p.nb.map(name))) : text.noNeighbours}
        {ll && <span className="profile-sub">{ll}</span>}
        {hint && <span className="profile-sub">{hint}</span>}
      </>,
    ]);
  }
  if (p.tel?.length) rows.push([text.calling, text.list(p.tel)]);
  if (p.tld?.length) rows.push([text.tld, text.list(p.tld)]);
  if (p.iso?.some(Boolean)) rows.push([text.iso, p.iso.filter(Boolean).join(' · ')]);
  if (p.anthem?.length) {
    rows.push([
      text.anthem,
      <>
        {p.anthem.map((a, i) => (
          <span key={i} className="profile-person">
            <NameText name={a} lang={lang} />
          </span>
        ))}
      </>,
    ]);
  }
  if (p.inc) rows.push([`${text.inception}${text.inceptionNote}`, dateText(p.inc, lang)]);

  // 其他主題的一句話
  const x = p.x ?? {};
  const more: [ReactNode, keyof typeof TOPIC_LINKS][] = [];
  if (x.drive !== undefined) {
    // 台灣自己不寫「跟台灣一樣」
    const side = iso3 === 'TWN' ? tr(OWN_DRIVE, lang) : tr(DRIVING.find((d) => d.value === x.drive)?.label ?? '', lang);
    const utc = x.tz !== undefined ? utcText(x.tz + TAIWAN_OFFSET) : '';
    const time = !utc || iso3 === 'TWN' ? utc : `${utc}${text.paren(versusTaiwan(x.tz ?? 0))}`;
    more.push([time ? text.drive(side, time) : side, 'travel']);
  }
  if (x.lang) {
    const n = languageName(x.lang, lang);
    if (n) more.push([text.language(n), 'language']);
  }
  if (x.regime !== undefined) {
    const r = REGIMES.find((c) => c.value === x.regime);
    if (r) more.push([text.regime(tr(r.label, lang), data.regimeYear), 'democracy']);
  }
  if (x.city) {
    const n = pick([x.city[0], x.city[1]], lang);
    if (n) more.push([text.city(n.text, formatLargeNumber(x.city[2])), 'cities']);
  }
  if (x.high) {
    const n = pick([x.high[0], x.high[1]], lang);
    more.push([text.high(n ? `${n.text} ` : '', `${fixed(x.high[2], 0)} m`), 'elevation']);
  }
  if (x.tower) {
    const n = pick([x.tower[0], x.tower[1]], lang);
    if (n) more.push([text.tower(n.text, metres(x.tower[2]), x.tower[3]), 'skyscrapers']);
  }
  if (x.orgs !== undefined) more.push([text.orgs(x.orgs, ORGS.length), 'organizations']);
  if (iso3 !== 'TWN' && (x.ally === 1 || x.ally === 2)) {
    more.push([text.ally(tr(ALLY.find((a) => a.value === x.ally)?.label ?? '', lang)), 'diplomacy']);
  }

  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <ProfileHero status={status} flag={flag} />
      <dl className="profile-facts">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {more.length > 0 && (
        <>
          <h4>{text.more}</h4>
          <ul className="profile-more">
            {more.map(([line, link]) => (
              <li key={link}>
                {line} <OtherTopic id={link} iso3={iso3} />
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="note">
        {text.dataDate(dateText(data.date, lang))}
        {text.dataNote}
      </p>
    </section>
  );
}
