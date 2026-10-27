import type { ReactNode } from 'react';
import { defineMessages, tr, useLang, useT, type Lang } from '../../i18n';
import { countryName, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { FlagImage, useFlags, type FlagEntry } from '../flagImages';
import { COLOUR_NAMES, FAMILIES, FEATURE_HINTS, FEATURE_NAMES, FEATURE_ORDER, FLAG_COLOURS, SOURCE_RULE } from '../flags';
import { STATUS } from '../profiles';
import type { PanelExtraProps } from '../types';
import { TopicLink } from './TopicLink';

const TEXT = defineMessages({
  zh: {
    title: '國旗',
    flagOf: (name: string, territory: boolean) => (territory ? `${name}旗` : `${name}國旗`),
    adopted: '採用',
    since: (date: string) => `${date}起使用`,
    ratio: '長寬比',
    ratioValue: (r: string) => `${r}（高:寬）`,
    nonRect: (r: string) => `不是長方形（外框的高:寬約 ${r}）`,
    colours: '顏色',
    features: '圖案',
    noFeatures: '沒有這裡列的圖案',
    family: '旗幟家族',
    own: (name: string, sov: string) => `${name}有自己的旗（主權屬於${sov}）。`,
    sovereign: (name: string, sov: string) => `${name}沒有自己正式的旗，使用${sov}的國旗。`,
    source: '圖檔：',
    sourceTail: (lic: string) => `，${lic}。`,
    commons: (file: string) => `Wikimedia Commons〈${file}〉`,
    insignia: '國旗是國家象徵，各國法律可能限制它的使用（跟著作權無關）。',
    profile: '國家小檔案',
    noFlag: '沒有國旗資料。',
    date: (y: number, m?: number, d?: number) => `${y} 年${m ? ` ${m} 月` : ''}${d ? ` ${d} 日` : ''}`,
    licence: (lic: string) =>
      lic === 'Public domain' ? '公有領域' : lic === 'CC0 1.0' ? 'CC0 1.0（公眾領域貢獻宣告）' : `${lic}（需標示出處）`,
  },
  en: {
    title: 'Flag',
    flagOf: (name: string) => `Flag of ${name}`,
    adopted: 'Adopted',
    since: (date: string) => `In use since ${date}`,
    ratio: 'Proportions',
    ratioValue: (r: string) => `${r} (height:width)`,
    nonRect: (r: string) => `Not rectangular (bounding box about ${r})`,
    colours: 'Colours',
    features: 'Features',
    noFeatures: 'None of the features listed here',
    family: 'Flag family',
    own: (name: string, sov: string) => `${name} has its own flag (sovereignty: ${sov}).`,
    sovereign: (name: string, sov: string) => `${name} has no official flag of its own and uses the flag of ${sov}.`,
    source: 'Image: ',
    sourceTail: (lic: string) => `, ${lic}. `,
    commons: (file: string) => `Wikimedia Commons, “${file}”`,
    insignia: 'Flags are national symbols whose use may be restricted by national law, independently of copyright.',
    profile: 'Country profile',
    noFlag: 'No flag data.',
    date: (y: number, m?: number, d?: number) => {
      if (!m) return String(y);
      const month = new Date(Date.UTC(2000, m - 1, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
      return d ? `${d} ${month} ${y}` : `${month} ${y}`;
    },
    licence: (lic: string) => (lic === 'Public domain' ? 'public domain' : lic === 'CC0 1.0' ? 'CC0 1.0' : `${lic} (attribution required)`),
  },
});

/** 國旗的名稱：有通稱用通稱（青天白日滿地紅旗），下面一行是正式名稱；屬地用主權國的國旗時寫主權國的國旗 */
function flagNames(entry: FlagEntry, iso3: string, countries: CountryTable | null, lang: Lang): [string, string | null] {
  const text = TEXT[lang];
  // 用主權國國旗的屬地寫「法國國旗」；有自己的旗的屬地寫「百慕達旗」（不是國旗）
  const borrowed = Boolean(entry.sov && !entry.own);
  const owner = borrowed ? entry.sov! : iso3;
  const official = entry.name
    ? lang === 'zh' ? entry.name[0] : entry.name[1]
    : text.flagOf(countryName(owner, countries, lang), Boolean(entry.sov) && !borrowed);
  const nick = entry.nick ? (lang === 'zh' ? entry.nick[0] : entry.nick[1]) : null;
  return nick ? [nick, official] : [official, null];
}

function dateText(entry: FlagEntry, lang: Lang): string {
  const text = TEXT[lang];
  if (!entry.d) return text.date(entry.y);
  const [y, m, d] = entry.d.split('-').map(Number);
  return text.date(y, m, d);
}

/** 顏色組成：一條依面積比例分段的長條，下面列出各色的比例 */
function ColourBar({ entry, lang }: { entry: FlagEntry; lang: Lang }) {
  const shown = entry.c.filter(([, share]) => share >= 0.5);
  return (
    <>
      <div className="flag-colour-bar" role="img" aria-label={shown.map(([c, s]) => `${tr(COLOUR_NAMES[c], lang)} ${fixed(s, 1)}%`).join(', ')}>
        {entry.c.map(([c, share]) => (
          <span key={c} style={{ flexGrow: share, background: FLAG_COLOURS[c] }} />
        ))}
      </div>
      <ul className="flag-colour-list">
        {shown.map(([c, share]) => (
          <li key={c}>
            <span className="legend-swatch" style={{ background: FLAG_COLOURS[c] }} />
            {tr(COLOUR_NAMES[c], lang)}
            <span className="profile-muted">{` ${fixed(share, share < 10 ? 1 : 0)}%`}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function FlagsPanel({ iso3, indicator }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const data = useFlags();
  const countries = useJson<CountryTable>('countries.json').data;
  if (!data) return <p className="empty">{t.loading}</p>;
  const entry = data.units[iso3];
  const name = countryName(iso3, countries, lang);
  const status: ReactNode[] = [];
  if (STATUS[iso3]) status.push(tr(STATUS[iso3], lang));
  if (!entry) {
    return (
      <section className="panel-section">
        <h3>{text.title}</h3>
        {status.map((s, i) => (
          <p key={i} className="profile-status">
            {s}
          </p>
        ))}
        {!status.length && <p className="empty">{text.noFlag}</p>}
      </section>
    );
  }
  // 屬地：有自己的旗還是用主權國的國旗（用主權國國旗的多半另有說明，寫了同一件事就不重複）
  if (entry.sov && (entry.own || !entry.note)) {
    const sov = countryName(entry.sov, countries, lang);
    status.unshift(entry.own ? text.own(name, sov) : text.sovereign(name, sov));
  }
  const [title, subtitle] = flagNames(entry, iso3, countries, lang);
  const [h, w] = entry.r.split(':').map(Number);
  const ratio = h > w ? text.nonRect(entry.r) : text.ratioValue(entry.r);
  const family = FAMILIES.find((f) => f.value === entry.fam);
  const features = FEATURE_ORDER.filter((f) => entry.ft.includes(f));
  const note = entry.note?.[lang === 'zh' ? 0 : 1];
  // 採用年份的理由：目前的指標用的就是採用年份的資料檔時，上面通用的「附註」已經寫了，不重複
  const yearNote = indicator.file === 'adopted.json' ? undefined : entry.yn?.[lang === 'zh' ? 0 : 1];

  return (
    <section className="panel-section flag-panel">
      <h3>{text.title}</h3>
      <figure className="flag-figure">
        <FlagImage entry={entry} alt={title} height={150} className="flag-large" />
        <figcaption>
          <span className="flag-title">{title}</span>
          {subtitle && <span className="profile-sub">{subtitle}</span>}
        </figcaption>
      </figure>
      {status.map((s, i) => (
        <p key={i} className="profile-status">
          {s}
        </p>
      ))}
      {note && <p className="profile-status">{note}</p>}
      <dl className="profile-facts flag-facts">
        <div>
          <dt>{text.adopted}</dt>
          <dd>
            {text.since(dateText(entry, lang))}
            {yearNote && <span className="profile-sub">{yearNote}</span>}
          </dd>
        </div>
        <div>
          <dt>{text.ratio}</dt>
          <dd>{ratio}</dd>
        </div>
        <div>
          <dt>{text.colours}</dt>
          <dd>
            <ColourBar entry={entry} lang={lang} />
          </dd>
        </div>
        <div>
          <dt>{text.features}</dt>
          <dd>
            {features.length ? (
              <ul className="flag-chips">
                {features.map((f) => (
                  <li key={f} title={tr(FEATURE_HINTS[f], lang)}>
                    {tr(FEATURE_NAMES[f], lang)}
                  </li>
                ))}
              </ul>
            ) : (
              text.noFeatures
            )}
          </dd>
        </div>
        {family && (
          <div>
            <dt>{text.family}</dt>
            <dd>{tr(family.label, lang)}</dd>
          </div>
        )}
      </dl>
      <p className="note">
        <TopicLink topic="profiles" iso3={iso3}>
          {text.profile}
        </TopicLink>
      </p>
      <p className="note">
        {text.source}
        <a href={entry.src.page} target="_blank" rel="noreferrer">
          {text.commons(entry.src.file)}
        </a>
        {text.sourceTail(text.licence(entry.src.lic))}
        {entry.src.ins ? text.insignia : ''}
      </p>
      <p className="note">{tr(SOURCE_RULE, lang)}</p>
    </section>
  );
}
