import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang, type Text } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';

/** robot-reasons.json（pipeline/topics/industry_robots.py）：用機器人的企業裡，各理由的比例（%），順序同 REASONS */
interface ReasonsFile {
  year: number;
  reasons: Record<string, (number | null)[]>;
}

const REASONS: Text[] = [
  { zh: '人力成本高', en: 'High labour costs' },
  { zh: '招不到人', en: 'Difficulty recruiting staff' },
  { zh: '提升工作安全', en: 'Improve work safety' },
  { zh: '要求高精度或品質一致', en: 'High precision or consistent quality' },
  { zh: '擴大產品或服務的範圍', en: 'Expand the range of products or services' },
  { zh: '政府獎勵或補助', en: 'Tax or other government incentives' },
];

const TEXT = defineMessages({
  zh: {
    title: (year: number) => `企業用機器人的理由（${year} 年）`,
    aria: (country: string) => `${country}的企業用機器人的理由`,
    note: '占有用機器人的企業的比例，可以複選，Eurostat。',
  },
  en: {
    title: (year) => `Why enterprises use robots (${year})`,
    aria: (country) => `Reasons enterprises in ${country} give for using robots`,
    note: 'Share of enterprises using robots; more than one reason can apply. Eurostat.',
  },
});

/** 產業結構與工業的「用機器人的企業」：這一國企業用機器人的理由（2026-11-05，製作手冊第二十二批 386） */
export function RobotReasons({ topicId, iso3, countryName, color }: { topicId: string; iso3: string; countryName: string; color: string }) {
  const lang = useLang();
  const text = TEXT[lang];
  const data = useJson<ReasonsFile>(`topics/${topicId}/robot-reasons.json`).data;
  const row = data?.reasons[iso3];
  if (!data || !row) return null;
  const items = REASONS.flatMap((label, i) => (row[i] == null ? [] : [{ key: String(i), label: tr(label, lang), value: row[i]!, color }]));
  if (!items.length) return null;
  return (
    <>
      <h3>{text.title(data.year)}</h3>
      <BarList items={items.sort((a, b) => b.value - a.value)} format={(v) => `${fixed(v, 1)}%`} max={100} ariaLabel={text.aria(countryName)} />
      <p className="note">{text.note}</p>
    </>
  );
}
