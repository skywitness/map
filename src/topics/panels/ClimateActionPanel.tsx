import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import type { PanelExtraProps } from '../types';

/**
 * 各國氣候目標與政策的評等的側欄（2026-11-07，第二十五批 480）：這一國 CAT 的整體與各分項評等、淨零目標年份、
 * 土地利用是碳源還是碳匯、評等日期與 CAT 國家頁的連結。資料是 pipeline/topics/climate_action.py 輸出的 detail.json
 */
interface Country {
  url: string;
  date: string;
  eu: boolean;
  overall: string;
  ratings: Record<string, string | null>;
  netZeroYear: number | null;
  land: string | null;
}
interface DetailFile {
  updated: string;
  countries: Record<string, Country>;
}

const TEXT = defineMessages({
  zh: {
    title: 'Climate Action Tracker 的評等',
    overall: '整體',
    items: {
      policies: '政策與行動',
      domestic: '2030 年目標（對照國內減碳路徑）',
      fairshare: '2030 年目標（對照公平份額）',
      finance: '氣候資金',
      netzero: '淨零目標的完整性',
    } as Record<string, string>,
    values: {
      'critically-insufficient': '極度不足',
      'highly-insufficient': '嚴重不足',
      insufficient: '不足',
      'almost-sufficient': '幾乎足夠',
      '15c-compatible': '跟 1.5°C 相容',
      '15c-paris-agreement-compatible': '跟巴黎協定的 1.5°C 相容',
      '15c-global-least-cost': '跟 1.5°C 的全球最低成本路徑相容',
      acceptable: '可以接受',
      average: '一般',
      poor: '差',
      'information-incomplete': '資訊不完整',
      'no-target': '沒有淨零目標',
      'not-applicable': '不適用',
      'not-assessed': '沒有評',
      source: '碳源（排放）',
      sink: '碳匯（吸收）',
      'source-sink': '有時是碳源、有時是碳匯',
      'not-significant': '不顯著',
    } as Record<string, string>,
    sep: '：',
    netZero: (y: number) => `淨零目標年份：${y} 年`,
    land: '土地利用與森林',
    eu: '這是歐盟整體的評等（德國另外評，其他成員國沒有單獨的評等）。',
    date: (d: string) => `評等日期：${d}`,
    link: '到 CAT 看這一國的分析',
    none: 'CAT 沒有評這個國家（只評 40 個經濟體）。',
    copyright: '© Climate Analytics 與 NewClimate Institute，只准非商業使用。',
  },
  en: {
    title: 'Climate Action Tracker ratings',
    overall: 'Overall',
    items: {
      policies: 'Policies and action',
      domestic: 'NDC target vs domestic pathways',
      fairshare: 'NDC target vs fair share',
      finance: 'Climate finance',
      netzero: 'Net zero target',
    } as Record<string, string>,
    values: {
      'critically-insufficient': 'Critically insufficient',
      'highly-insufficient': 'Highly insufficient',
      insufficient: 'Insufficient',
      'almost-sufficient': 'Almost sufficient',
      '15c-compatible': '1.5°C compatible',
      '15c-paris-agreement-compatible': '1.5°C Paris Agreement compatible',
      '15c-global-least-cost': '1.5°C global least cost',
      acceptable: 'Acceptable',
      average: 'Average',
      poor: 'Poor',
      'information-incomplete': 'Information incomplete',
      'no-target': 'No target',
      'not-applicable': 'Not applicable',
      'not-assessed': 'Not assessed',
      source: 'Source',
      sink: 'Sink',
      'source-sink': 'Source or sink',
      'not-significant': 'Not significant',
    } as Record<string, string>,
    sep: ': ',
    netZero: (y: number) => `Net zero target year: ${y}`,
    land: 'Land use and forestry',
    eu: 'This is the rating for the EU as a whole (Germany is rated separately; other member states have no rating of their own).',
    date: (d: string) => `Rated: ${d}`,
    link: 'Read CAT’s analysis for this country',
    none: 'CAT does not rate this country (it rates 40 economies).',
    copyright: '© Climate Analytics and NewClimate Institute; non-commercial use only.',
  },
});

export default function ClimateActionPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const data = useJson<DetailFile>(`topics/${topic.id}/detail.json`).data;
  if (!data) return <p className="empty">{t.loading}</p>;
  const c = data.countries[iso3];
  if (!c) return <p className="empty">{text.none}</p>;
  const value = (v: string | null) => (v ? (text.values[v] ?? v) : '–');
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {c.eu && <p className="note">{text.eu}</p>}
      <ul className="note">
        <li>
          <strong>
            {text.overall}
            {text.sep}
            {value(c.overall)}
          </strong>
        </li>
        {Object.entries(text.items).map(([k, name]) => (
          <li key={k}>
            {name}
            {text.sep}
            {value(c.ratings[k])}
          </li>
        ))}
        {c.land && (
          <li>
            {text.land}
            {text.sep}
            {value(c.land)}
          </li>
        )}
        {c.netZeroYear && <li>{text.netZero(c.netZeroYear)}</li>}
      </ul>
      <p className="note">
        {text.date(c.date)} ·{' '}
        <a href={c.url} target="_blank" rel="noopener noreferrer">
          {text.link}
        </a>
      </p>
      <p className="note">{text.copyright}</p>
    </section>
  );
}
