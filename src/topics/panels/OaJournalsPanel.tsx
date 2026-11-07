import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 開放取用期刊的側欄（2026-11-07，製作手冊第二十七批 599；pipeline/topics/oa_journals.py 的 detail.json）：
 * 這一國的期刊收不收 APC、最多的學科（美國國會圖書館分類的大類）與投稿語言（ISO 639，用瀏覽器的語言名稱）。
 */
interface Detail {
  countries: Record<string, { n: number; apc: number; subjects: [string, number][]; languages: [string, number][] }>;
}

/** DOAJ 的學科是美國國會圖書館分類（LCC）的大類 */
const SUBJECTS: Record<string, { zh: string; en: string }> = {
  Agriculture: { zh: '農業', en: 'Agriculture' },
  'Auxiliary sciences of history': { zh: '歷史輔助科學', en: 'Auxiliary sciences of history' },
  'Bibliography. Library science. Information resources': { zh: '圖書資訊', en: 'Library and information science' },
  Education: { zh: '教育', en: 'Education' },
  'Fine Arts': { zh: '藝術', en: 'Fine arts' },
  'General Works': { zh: '總類', en: 'General works' },
  'Geography. Anthropology. Recreation': { zh: '地理、人類學、休閒', en: 'Geography, anthropology, recreation' },
  'History (General) and history of Europe': { zh: '歷史（總論與歐洲）', en: 'History (general and Europe)' },
  'History America': { zh: '美洲史', en: 'History of the Americas' },
  'Language and Literature': { zh: '語言與文學', en: 'Language and literature' },
  Law: { zh: '法律', en: 'Law' },
  Medicine: { zh: '醫學', en: 'Medicine' },
  'Naval Science': { zh: '海軍科學', en: 'Naval science' },
  'Philosophy. Psychology. Religion': { zh: '哲學、心理學、宗教', en: 'Philosophy, psychology, religion' },
  'Political science': { zh: '政治學', en: 'Political science' },
  Science: { zh: '自然科學', en: 'Science' },
  'Social Sciences': { zh: '社會科學', en: 'Social sciences' },
  Technology: { zh: '技術與工程', en: 'Technology' },
};

const TEXT = defineMessages({
  zh: {
    apc: (n: number, a: number) => `${fixed(n, 0)} 本期刊，${fixed(a, 0)} 本向作者收費、${fixed(n - a, 0)} 本不收`,
    subjects: '最多的學科',
    languages: '接受投稿的語言',
    n: (v: number) => `${fixed(v, 0)} 本`,
    aria: (c: string, k: string) => `${c}：${k}`,
    note: '一本期刊可以有好幾個學科、好幾種語言。',
  },
  en: {
    apc: (n: number, a: number) => `${fixed(n, 0)} journals: ${fixed(a, 0)} charge authors, ${fixed(n - a, 0)} do not`,
    subjects: 'Most common subjects',
    languages: 'Languages accepted for submission',
    n: (v: number) => fixed(v, 0),
    aria: (c: string, k: string) => `${c}: ${k}`,
    note: 'A journal can have several subjects and languages.',
  },
});

function languageName(code: string, lang: 'zh' | 'en'): string {
  try {
    return new Intl.DisplayNames([lang === 'zh' ? 'zh-Hant-TW' : 'en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export default function OaJournalsPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<Detail>(`topics/${topic.id}/detail.json`).data;
  const row = d?.countries[iso3];
  if (!row) return null;
  const subjects: BarListItem[] = row.subjects.map(([k, n]) => ({ key: k, label: SUBJECTS[k]?.[lang] ?? k, value: n }));
  const languages: BarListItem[] = row.languages.map(([k, n]) => ({ key: k, label: languageName(k, lang), value: n }));
  return (
    <section className="panel-section">
      <p>{text.apc(row.n, row.apc)}</p>
      <h3>{text.subjects}</h3>
      <BarList items={subjects} format={text.n} ariaLabel={text.aria(countryName, text.subjects)} />
      <h3>{text.languages}</h3>
      <BarList items={languages} format={text.n} ariaLabel={text.aria(countryName, text.languages)} />
      <p className="note">{text.note}</p>
    </section>
  );
}
