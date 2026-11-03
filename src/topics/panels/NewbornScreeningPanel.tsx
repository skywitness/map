import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/newborn_screening.py 的 panel.json */
interface NewbornFile {
  diseases: { code: string; zh: string; en: string; group: 'misc' | 'aa' | 'fao' | 'oa' }[];
  /** s：30 種疾病的等級（一個字一種，0–3）；y：開始年份；l：篩檢實驗室數；t：採血時間（小時）；o：「其他」欄的附註編號；r：地區 */
  countries: Record<string, { s?: string; y?: number; l?: string; t?: string; o?: string; r: string }>;
}

const GROUPS = ['misc', 'aa', 'fao', 'oa'] as const;

const TEXT = defineMessages({
  zh: {
    title: '篩哪些病',
    groups: { misc: '內分泌、血液與其他', aa: '胺基酸代謝', fao: '脂肪酸氧化', oa: '有機酸代謝' },
    levels: ['沒有', '試辦或少數醫院', '國家計畫，涵蓋不到一半', '國家計畫，涵蓋過半'],
    facts: (y?: number, l?: string, t?: string) =>
      [y ? `${y} 年開始` : null, l ? `篩檢實驗室 ${l} 個` : null, t ? `出生後 ${t} 小時採血` : null].filter(Boolean).join('・'),
    other: (o: string) => `論文表上「其他」欄另有附註第 ${o} 項（其他疾病，見論文原文）。`,
    noInfo: '論文的表上沒有這一國的資料。',
    ssa: '撒哈拉以南非洲的表只列了 5 種病，其他的當作沒有篩。',
    us: '美國、加拿大依各州、省的出生數加權：篩這種病的州、省出生數過半才算「涵蓋過半」。',
  },
  en: {
    title: 'Conditions screened',
    groups: { misc: 'Endocrine, blood and other', aa: 'Amino acid disorders', fao: 'Fatty acid oxidation disorders', oa: 'Organic acid disorders' },
    levels: ['No', 'Pilot or a few hospitals', 'National, under half covered', 'National, over half covered'],
    facts: (y, l, t) =>
      [y ? `Since ${y}` : null, l ? `${l} screening laboratories` : null, t ? `sample at ${t} hours` : null].filter(Boolean).join(' · '),
    other: (o) => `The paper’s “other” column adds note ${o} (further conditions; see the paper).`,
    noInfo: 'The paper’s tables have no information for this country.',
    ssa: 'The sub-Saharan Africa table lists only five conditions; the rest count as not screened.',
    us: 'The US and Canada are weighted by births in each state or province: a condition counts as over half covered when states or provinces with over half the births screen for it.',
  },
});

export default function NewbornScreeningPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<NewbornFile>(`topics/${topic.id}/panel.json`);
  const country = data?.countries[iso3];
  if (!data || !country) return null;
  if (!country.s) {
    return (
      <section className="panel-section">
        <h3>{text.title}</h3>
        <p className="note">{text.noInfo}</p>
      </section>
    );
  }
  const levels = country.s;
  const facts = text.facts(country.y, country.l, country.t);
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {facts && <p className="note">{facts}</p>}
      {GROUPS.map((group) => (
        <div key={group}>
          <h4>{text.groups[group]}</h4>
          <ul className="screening-list">
            {data.diseases.map((d, i) =>
              d.group === group ? (
                <li key={d.code} className={`is-level-${levels[i]}`}>
                  <span className="screening-name">
                    {lang === 'en' ? d.en : d.zh} <span className="screening-code">{d.code}</span>
                  </span>
                  <span className="screening-level">{text.levels[Number(levels[i])]}</span>
                </li>
              ) : null,
            )}
          </ul>
        </div>
      ))}
      {country.o && <p className="note">{text.other(country.o)}</p>}
      {country.r === 'ssa' && <p className="note">{text.ssa}</p>}
      {country.r === 'na' && <p className="note">{text.us}</p>}
    </section>
  );
}
