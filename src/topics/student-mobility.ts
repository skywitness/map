import { tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicPart } from './parts';
import type { FlowLabels, FlowLayer, IndicatorDef } from './types';

/**
 * 留學生的流向（2026-11-04，主題盤點的擴3；pipeline/topics/student_mobility.py，資料在 public/data/topics/student-mobility/）：
 * UNESCO 統計研究所（UIS）各國收的國際學生依來源國，教育程度主題的 withParts 接上。台灣不在 UIS 裡。
 */

const STUDENTS = { zh: '人', en: 'students' };
const students = (v: number) => `${formatLargeNumber(v)} ${tr(STUDENTS)}`;
const pct = (v: number) => `${fixed(v, v < 10 ? 1 : 0)}%`;

const LABELS: Record<'export' | 'import', FlowLabels> = {
  import: {
    partners: { zh: '國際學生的來源', en: "international students' home countries" },
    main: { zh: '主要的國際學生來源', en: 'Main home countries of international students' },
    verb: (origin, partner) => tr({ zh: `從${partner}到${origin}讀大學的學生`, en: `Students from ${partner} studying in ${origin}` }),
  },
  export: {
    partners: { zh: '出國讀書的去向', en: 'where students go abroad' },
    main: { zh: '主要的留學國家', en: 'Main destinations of students abroad' },
    verb: (origin, partner) => tr({ zh: `從${origin}到${partner}讀大學的學生`, en: `Students from ${origin} studying in ${partner}` }),
  },
};

const LEGEND_KEY: Text = { zh: '由學生的母國（淺）到留學國（深）', en: 'From home country (light) to host country (dark)' };

function flow(id: string, label: Text, description: Text, file: string, direction: FlowLayer['direction']): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: STUDENTS,
    file: `../student-mobility/${file}`,
    layer: { kind: 'flow', file: '../student-mobility/flows/{year}.json', direction, labels: LABELS, legendKey: LEGEND_KEY },
    format: students,
    formatTick: formatLargeTick,
    shareOfWorld: true,
  };
}

export const studentMobilityPart: TopicPart = {
  name: { zh: '留學生', en: 'International students' },
  sources: [
    {
      name: {
        zh: 'UNESCO 統計研究所（UIS）：各國收的國際學生依來源國、出國的學生、國際學生的比率',
        en: 'UNESCO Institute for Statistics (UIS): inbound internationally mobile students by country of origin, outbound students and mobility ratios',
      },
      url: 'https://api.uis.unesco.org/api/public/documentation/',
      license: { zh: 'CC BY-SA 4.0（這幾個資料檔也依 CC BY-SA 4.0 分享）', en: 'CC BY-SA 4.0 (these data files are shared under CC BY-SA 4.0 too)' },
    },
  ],
  note: {
    zh: '國際學生是為了讀大專（含碩博士）而跨國的學生，由收學生的國家依來源國通報給 UNESCO 統計研究所；出國的學生是 UIS 依各收學生國的通報加總的估計，沒有通報的國家（中國不通報收的學生依來源國）裡的學生算不到。很多國家隔幾年才通報，地圖與流向都用 3 年內最近一年；部分國家的明細缺幾個來源國（日本的明細沒有中國、南韓），流向會少掉那幾條。台灣不是 UNESCO 會員，不在資料裡。',
    en: 'International students are those who have crossed a border to study at tertiary level (including postgraduate), reported by the host country to the UNESCO Institute for Statistics by country of origin; outbound students are UIS estimates summed from host countries’ reports, so students in countries that do not report (China does not report inbound students by origin) are missed. Many countries report only every few years, so the map and the flows use the latest year within three years; some countries’ breakdowns omit certain origins (Japan’s has no China or South Korea), so those flows are missing. Taiwan is not a UNESCO member and is not in the data.',
  },
  indicators: [
    flow(
      'students-in',
      { zh: '流向：國際學生從哪裡來', en: 'Flows: where international students come from' },
      {
        zh: '這個國家收了多少來讀大學的國際學生（比例圓），點選國家畫出前 15 大來源國。2023 年美國 95.7 萬人最多，英國 74.8 萬、澳洲 46.7 萬、德國 42.3 萬、加拿大 38.9 萬，日本 18.2 萬。',
        en: 'How many international students a country hosts at tertiary level (circles); click a country to draw its top 15 countries of origin. In 2023 the US hosted the most (957,000), followed by the UK (748,000), Australia (467,000), Germany (423,000) and Canada (389,000); Japan 182,000.',
      },
      'inbound.json',
      'import',
    ),
    flow(
      'students-out',
      { zh: '流向：出國讀書去哪裡', en: 'Flows: where students go to study' },
      {
        zh: '這個國家有多少學生在國外讀大學（UIS 依各收學生國的通報估計），點選國家畫出前 15 個留學國家。2023 年中國 107.6 萬人最多，印度 83.4 萬，越南、德國各約 12.8 萬，南韓 9.0 萬。',
        en: 'How many of a country’s students are studying abroad at tertiary level (UIS estimates from host countries’ reports); click a country to draw its top 15 destinations. In 2023 China had the most (1.08 million), then India (834,000), Vietnam and Germany (about 128,000 each) and South Korea (90,000).',
      },
      'outbound.json',
      'export',
    ),
    {
      id: 'inbound-rate',
      label: { zh: '國際學生占大專學生的比例', en: 'International students as a share of tertiary students' },
      description: {
        zh: '收的國際學生占這個國家大專學生的比例。最新一年：澳洲 31.6%、英國 23.4%、加拿大 21.2%、德國 13.4%，美國 5.3%、南韓 5.3%、日本 4.7%，中國 0.3%；盧森堡、阿聯、澳門超過一半（本地的大學小、來讀的外國學生多）。',
        en: 'International students as a share of all tertiary students in the country. In the latest year: Australia 31.6%, the UK 23.4%, Canada 21.2%, Germany 13.4%, the US 5.3%, South Korea 5.3%, Japan 4.7% and China 0.3%; over half in Luxembourg, the UAE and Macao (small local systems with many students from abroad).',
      },
      unit: '%',
      file: '../student-mobility/inbound-rate.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 20, 40] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
    {
      id: 'outbound-ratio',
      label: { zh: '出國讀大學的比例', en: 'Students studying abroad' },
      description: {
        zh: '在國外讀大學的學生，相對於本國大專學生人數的比例。2023 年美國 0.65%、澳洲 0.78%、日本 0.86% 很低，中國 1.8%、南韓 3.3%、德國 3.9%，越南 4.6%（2022 年）；小國家（盧森堡、不丹、百慕達）本國的大學少，在國外讀的比在國內多，會超過 100%。',
        en: 'Students studying abroad relative to the number of tertiary students at home. In 2023 the US (0.65%), Australia (0.78%) and Japan (0.86%) were very low, China 1.8%, South Korea 3.3%, Germany 3.9% and Vietnam 4.6% (2022); small countries with few universities (Luxembourg, Bhutan, Bermuda) have more students abroad than at home, so the ratio exceeds 100%.',
      },
      unit: '%',
      file: '../student-mobility/outbound-ratio.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 20, 50] } },
      format: pct,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
  ],
};
