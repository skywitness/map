import { getLang, tr } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { PointsOverlayDef } from './types';

/**
 * 太空的擴充：各國的太空機構，成立年份與總部（2026-11-07，製作手冊第二十七批 603，候選 1329；
 * pipeline/topics/space_agencies.py，資料在 public/data/topics/space/）：Wikidata 的「太空機構」類與英文維基的政府太空機構列表的聯集，
 * 人工核過；值是這一國最早的國家太空機構（含前身）成立的年份，時間軸上成立以後才有值。側欄 panels/SpaceAgencyPanel.tsx。
 */
const year = (v: number) => tr({ zh: `${v} 年`, en: String(v) });

const HQ: PointsOverlayDef = {
  kind: 'points',
  id: 'space-agency-hq',
  file: 'space-agencies.json',
  label: { zh: '國家太空機構的總部', en: 'National space agency headquarters' },
  indicators: ['space-agency'],
  radius: 4,
  color: MAP_TOKENS.hues.red,
  timeField: 'y',
  tooltip: (p, { countryName }) => ({
    title: tr({ zh: String(p.zh || p.name || ''), en: String(p.name ?? '') }),
    properNoun: getLang() === 'zh' && p.zh ? String(p.name ?? '') : undefined,
    detail: [
      typeof p.iso3 === 'string' ? countryName(p.iso3) : null,
      typeof p.hq === 'string' && p.hq ? p.hq : null,
      Number(p.y) ? tr({ zh: `最早的機構 ${p.y} 年成立`, en: `first agency founded ${p.y}` }) : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }),
};

export const spaceAgenciesPart: TopicPart = {
  name: { zh: '國家太空機構', en: 'National space agencies' },
  sources: [
    {
      name: { zh: 'Wikidata「太空機構」（Q17505024）與機構的成立日期、總部', en: 'Wikidata “space agency” (Q17505024), founding dates and headquarters' },
      url: 'https://www.wikidata.org/wiki/Q17505024',
      license: 'CC0',
    },
  ],
  note: {
    zh: '名單是 Wikidata「太空機構」類與英文維基「List of government space agencies」（固定版本 1382533503）的聯集，人工排除國際與區域組織（歐洲太空總署、非洲太空局等）、地方機構（加泰隆尼亞、美國各州）與不是主管機關的研究院、公司。成立年份是這一國最早的國家太空機構，含前身（日本 1969 年的宇宙開發事業團、印度 1962 年的 INCOSPAR）；蘇聯的太空計畫算在俄羅斯。有機構不等於有太空能力，也有很多國家的太空事務放在部會或研究機構底下，沒有獨立的機構。',
    en: 'The list combines Wikidata’s “space agency” class and English Wikipedia’s “List of government space agencies” (revision 1382533503), checked by hand to exclude international and regional bodies (ESA, the African Space Agency and others), sub-national agencies (Catalonia, US states) and research academies or companies that are not the national authority. The year is when the country’s first national space agency was founded, predecessors included (Japan’s NASDA in 1969, India’s INCOSPAR in 1962); the Soviet space programme counts for Russia. Having an agency does not mean having space capabilities, and many countries run space affairs within a ministry or research body without a separate agency.',
  },
  overlays: [HQ],
  panelExtra: () => import('./panels/SpaceAgencyPanel'),
  indicators: [
    {
      id: 'space-agency',
      label: { zh: '國家太空機構哪一年成立', en: 'When the national space agency was founded' },
      description: {
        zh: '這一國最早的國家太空機構（含前身）成立的年份，時間軸上成立以後才上色，76 國。1975 年以前只有 15 國：蘇聯（俄羅斯）1955、美國 1958（NASA）、阿根廷、法國、巴基斯坦 1961、印度 1962、比利時、印尼 1964、丹麥 1968、德國、日本 1969、埃及 1971、奧地利、瑞典 1972、秘魯 1974；中國的國家航天局 1993 年才成立。2010 年以後有 23 國成立，例如英國 2010、阿聯 2014、肯亞 2017、沙烏地、土耳其、澳洲 2018、西班牙 2023、緬甸 2025、新加坡 2026。台灣 1991 年成立國家太空計畫室（今國家太空中心）。點國家看機構名稱與總部。',
        en: 'The year the country’s first national space agency (predecessors included) was founded; on the timeline a country is shaded once its agency exists. 76 countries. Only 15 had one by 1975: the Soviet Union (Russia) 1955, the US 1958 (NASA), Argentina, France and Pakistan 1961, India 1962, Belgium and Indonesia 1964, Denmark 1968, Germany and Japan 1969, Egypt 1971, Austria and Sweden 1972 and Peru 1974; China’s national space administration was set up only in 1993. 23 countries founded one from 2010 on, including the UK 2010, the UAE 2014, Kenya 2017, Saudi Arabia, Türkiye and Australia 2018, Spain 2023, Myanmar 2025 and Singapore 2026. Taiwan set up its National Space Program Office (today’s Taiwan Space Agency) in 1991. Click a country for the agency’s name and headquarters.',
      },
      unit: { zh: '年', en: '' },
      file: 'space-agency.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1976, 1990, 2000, 2010, 2020] } },
      format: year,
      formatTick: (v) => String(v),
      // 跟國旗的採用年份一樣：年份沒有好壞，排名表依年份排、不寫名次、不畫長條
      unranked: true,
      lowerIsBetter: true,
      rankingBars: false,
      overlayTime: 'cumulative',
      missing: { zh: '沒有國家太空機構（或不在名單裡）', en: 'No national space agency (or not in the list)' },
    },
  ],
};
