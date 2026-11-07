import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 企業用 AI 的側欄（2026-11-07，製作手冊第二十七批 595；pipeline/topics/business_ai.py 的 business-ai-detail.json）：
 * 這一國那一年（10 人以上的企業）用了哪幾種 AI 技術、用在什麼地方，各占企業的 %。一家企業可以有好幾種，加起來不是 100%。
 */
interface Detail {
  years: number[];
  countries: Record<string, { t: (number | null)[][]; u: (number | null)[][] }>;
}

const TEXT = defineMessages({
  zh: {
    tech: (y: number) => `${y} 年用了哪種 AI 技術`,
    use: (y: number) => `${y} 年 AI 用在哪裡`,
    techs: ['分析文字（文字探勘）', '語音轉文字', '生成文字或程式碼', '生成圖片、影片、聲音', '辨識影像中的物體或人', '機器學習分析資料', '自動化流程或輔助決策', '自主移動的機器（機器人、無人機）'],
    uses: ['行銷或銷售', '生產或服務流程', '行政管理', '物流', '資訊安全', '會計、財務', '研發或創新'],
    aria: (c: string, k: string) => `${c}：${k}`,
    note: '占 10 人以上企業的 %；一家企業可以有好幾種，加起來不是 100%。',
  },
  en: {
    tech: (y: number) => `AI technologies used, ${y}`,
    use: (y: number) => `What AI is used for, ${y}`,
    techs: ['Text analysis (text mining)', 'Speech recognition', 'Generating text or code', 'Generating images, video or sound', 'Image recognition', 'Machine learning for data analysis', 'Workflow automation or decision support', 'Autonomous machines (robots, drones)'],
    uses: ['Marketing or sales', 'Production or service processes', 'Business administration', 'Logistics', 'ICT security', 'Accounting and finance', 'R&D or innovation'],
    aria: (c: string, k: string) => `${c}: ${k}`,
    note: 'Share of businesses with 10+ employees; a business can use several, so these do not add up to 100%.',
  },
});

export default function BusinessAiPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<Detail>(`topics/${topic.id}/business-ai-detail.json`).data;
  const row = d?.countries[iso3];
  if (!d || !row) return null;
  let i = d.years.indexOf(Math.min(year, d.years[d.years.length - 1]));
  while (i >= 0 && !row.t.some((s) => s[i] != null)) i--;
  if (i < 0) return null;
  const y = d.years[i];
  const list = (series: (number | null)[][], labels: string[]): BarListItem[] =>
    series
      .map((s, n) => ({ key: String(n), label: labels[n], value: s[i] ?? 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  const sections = [
    { key: 't', title: text.tech(y), items: list(row.t, text.techs) },
    { key: 'u', title: text.use(y), items: list(row.u, text.uses) },
  ].filter((s) => s.items.length);
  if (!sections.length) return null;
  return (
    <>
      {sections.map((s) => (
        <section className="panel-section" key={s.key}>
          <h3>{s.title}</h3>
          <BarList items={s.items} format={(v) => `${fixed(v, 1)}%`} max={100} ariaLabel={text.aria(countryName, s.title)} />
        </section>
      ))}
      <p className="note">{text.note}</p>
    </>
  );
}
