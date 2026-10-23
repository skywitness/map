import { BarList } from '../../charts/BarList';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { languageName, pct } from '../language';
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
  },
});

export default function LanguagePanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<LanguagesFile>(`topics/${topic.id}/languages.json`);
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
    </section>
  );
}
