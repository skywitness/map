import { tr } from '../i18n';
import { fixed } from '../lib/format';
import type { Text, TopicDefinition } from './types';

/**
 * 社會保障覆蓋率（2026-11-07，製作手冊第二十五批 450，候選 1092；pipeline/topics/social_protection.py）：
 * ILOSTAT SDG 1.3.1 的 9 項，各項的分母不同（見說明），不能相加。各國回報年份不同，地圖用 5 年內最近一年
 */
export const SOCIAL_PROTECTION_ITEMS: { id: string; label: Text; short: Text }[] = [
  { id: 'total', label: { zh: '至少一項給付（占全人口）', en: 'At least one benefit (whole population)' }, short: { zh: '至少一項', en: 'At least one' } },
  { id: 'pension', label: { zh: '老年年金（退休年齡以上的人）', en: 'Old-age pension (people above retirement age)' }, short: { zh: '老年年金', en: 'Old-age pension' } },
  { id: 'unemployment', label: { zh: '失業給付（失業者）', en: 'Unemployment benefit (unemployed people)' }, short: { zh: '失業給付', en: 'Unemployment' } },
  { id: 'children', label: { zh: '兒童與家庭給付（兒童）', en: 'Child and family benefit (children)' }, short: { zh: '兒童與家庭', en: 'Children' } },
  { id: 'disability', label: { zh: '身心障礙給付（重度障礙者）', en: 'Disability benefit (people with severe disabilities)' }, short: { zh: '身心障礙', en: 'Disability' } },
  { id: 'maternity', label: { zh: '生育給付（生產的母親）', en: 'Maternity benefit (mothers of newborns)' }, short: { zh: '生育給付', en: 'Maternity' } },
  { id: 'injury', label: { zh: '職災保險（就業者）', en: 'Employment injury (employed people)' }, short: { zh: '職災保險', en: 'Employment injury' } },
  { id: 'poor', label: { zh: '社會救助（貧窮人口）', en: 'Social assistance (poor people)' }, short: { zh: '社會救助（貧窮）', en: 'Social assistance (poor)' } },
  { id: 'vulnerable', label: { zh: '社會救助（弱勢人口）', en: 'Social assistance (vulnerable people)' }, short: { zh: '社會救助（弱勢）', en: 'Social assistance (vulnerable)' } },
];

export const socialProtection: TopicDefinition = {
  id: 'social-protection',
  title: { zh: '社會保障覆蓋率', en: 'Social protection coverage' },
  shortTitle: { zh: '社會保障', en: 'Social protection' },
  defaultIndicator: 'coverage',
  defaultYear: 2023,
  sources: [
    {
      name: { zh: 'ILOSTAT：SDG 1.3.1 受社會保障給付覆蓋的人口比例（DF_SDG_0131_SEX_SOC_RT）', en: 'ILOSTAT: SDG 1.3.1 proportion of population covered by social protection benefits (DF_SDG_0131_SEX_SOC_RT)' },
      url: 'https://ilostat.ilo.org/data/',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '國際勞工組織整理各國的行政資料，聯合國永續發展目標 1.3.1。各國回報的年份差很多（多數在 2019–2023 年），地圖用 5 年內最近一年，tooltip 與側欄標實際年份。「至少一項」的分母是全人口，其他各項的分母是那一種風險的人口（老年年金是法定退休年齡以上的人、失業給付是失業者、生育給付是生產的母親…），不能相加。100% 是制度上全面覆蓋，不代表給付夠用（給付水準見「重分配與貧窮」）；失業給付的世界中位數是 0%，多數開發中國家沒有失業保險。',
    en: 'ILO compilation of national administrative data, UN Sustainable Development Goal indicator 1.3.1. Reporting years vary widely (mostly 2019–2023), so the map uses each country’s latest year within 5 years and the tooltip and side panel give the year. “At least one benefit” is measured against the whole population; each other item against the people facing that risk (pensions: people above statutory retirement age; unemployment benefit: unemployed people; maternity: mothers of newborns…), so they cannot be added up. 100% means coverage in law and practice, not that benefits are adequate (see Redistribution and poverty for benefit levels); the world median for unemployment benefit is 0%, as most developing countries have no unemployment insurance.',
  },
  panelExtra: () => import('./panels/SocialProtectionPanel'),
  indicators: [
    {
      id: 'coverage',
      label: { zh: '受社會保障給付覆蓋的比例', en: 'Covered by social protection' },
      description: {
        zh: '受到社會保障給付覆蓋的人占那一群人的比例（子項目切換 9 種）。至少一項：德國、荷蘭、瑞典、新加坡等 100%，日本 94.6%（2020）、南韓 80.2%、美國 78.8%、台灣 78.4%（2023）、中國大陸 75.6%，奈及利亞 14.8%，南蘇丹與索馬利亞 0%。台灣的老年年金 99.3%，失業給付只有 6.9%（世界中位數是 0%）、兒童與家庭給付 19.8%。',
        en: 'Share of the relevant group covered by social protection benefits (nine options). At least one benefit: 100% in Germany, the Netherlands, Sweden, Singapore and others, 94.6% in Japan (2020), 80.2% in South Korea, 78.8% in the US, 78.4% in Taiwan (2023) and 75.6% in mainland China, 14.8% in Nigeria and 0% in South Sudan and Somalia. Taiwan covers 99.3% of older people with pensions but only 6.9% of the unemployed (the world median is 0%) and 19.8% of children with child or family benefits.',
      },
      unit: '%',
      file: 'coverage/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 40, 60, 80, 95] } },
      dimension: {
        label: { zh: '給付', en: 'Benefit' },
        options: SOCIAL_PROTECTION_ITEMS.map(({ id, label }) => ({ id, label })),
        defaultOption: 'total',
      },
      format: (v) => `${fixed(v, v === 100 || v === 0 ? 0 : 1)}%`,
      formatTick: (v) => `${v}%`,
    },
  ],
};

export const itemLabel = (id: string) => tr(SOCIAL_PROTECTION_ITEMS.find((i) => i.id === id)?.short ?? { zh: id, en: id });
