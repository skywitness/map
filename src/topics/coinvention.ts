import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { TopicPart } from './parts';
import type { FlowLabels } from './types';

/**
 * 研發與創新的擴充：發明是自己做的還是跟外國人一起做的、有在創新的企業拿了多少補助（2026-11-07，製作手冊第二十七批 601，
 * 候選 1326、1327；pipeline/topics/coinvention.py，資料在 public/data/topics/innovation/）：
 * OECD 的專利共同發明人（美國專利商標局、優先權年）與企業創新調查（Innostat）。
 */
const pct = (v: number) => `${fixed(v, 1)}%`;
const pctTick = (v: number) => `${fixed(v, 0)}%`;
const patents = (v: number) => tr({ zh: `${fixed(v, 0)} 件`, en: `${fixed(v, 0)} patents` });

const PATENT_NOTE = {
  zh: '專利是向美國專利商標局（USPTO）申請、依優先權年（最早申請日）與發明人的居住國算；最近兩三年還有很多在審，件數偏低。',
  en: 'Patents are applications to the US Patent and Trademark Office (USPTO), by priority year (first filing) and inventors’ country of residence; the latest two or three years are still incomplete, so counts are low.',
};
const CIS_NOTE = {
  zh: '各國的企業創新調查（歐洲是 CIS），10 人以上、CIS 規範的產業（工業與資訊、金融、運輸、批發、技術服務），兩三年一次，各國用最近一年（最多往前找 5 年）。各國的問法與母體不同（例如日本與南韓的調查跟歐洲不完全一樣），跨國比較要小心。台灣不在資料裡。',
  en: 'National business innovation surveys (the CIS in Europe), enterprises with 10 or more employees in the industries the CIS covers (industry plus information, finance, transport, wholesale and technical services), run every two or three years; each country’s latest year is shown (up to 5 years back). Questions and populations differ between countries (Japan’s and Korea’s surveys are not identical to Europe’s), so compare with care. Taiwan is not in the data.',
};

const LABELS: FlowLabels = {
  partners: { zh: '共同發明的國家', en: 'co-inventor countries' },
  main: { zh: '主要的共同發明國家', en: 'Main co-inventor countries' },
  verb: (origin, partner) => tr({ zh: `${origin}與${partner}的發明人共同申請的專利`, en: `Patents co-invented by inventors in ${origin} and ${partner}` }),
};

export const coinventionPart: TopicPart = {
  name: { zh: '共同發明與企業創新', en: 'Co-invention and business innovation' },
  sources: [
    {
      name: { zh: 'OECD：Patents with foreign co-inventors（DF_PATENTS_COINVENTOR）', en: 'OECD: Patents with foreign co-inventors (DF_PATENTS_COINVENTOR)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_PATENTS%40DF_PATENTS_COINVENTOR&df[ag]=OECD.STI.PIE',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'OECD：Business Innovation Indicators（Innostat：DF_INNOENT、DF_INNOSUPP）', en: 'OECD: Business Innovation Indicators (Innostat: DF_INNOENT, DF_INNOSUPP)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_INNOSTAT%40DF_INNOENT&df[ag]=OECD.STI.STP',
      license: 'CC BY 4.0',
    },
  ],
  indicators: [
    {
      id: 'coinvention-share',
      label: { zh: '有外國共同發明人的專利', en: 'Patents with foreign co-inventors' },
      description: {
        zh: `這國發明人參與的美國專利裡，有外國共同發明人的比例（當年至少 20 件的國家）。2022 年較大的經濟體：愛爾蘭 58.8%、新加坡 58.7%、瑞士 50.2%、印度 48.1%、英國 46.0%、荷蘭 45.5%、法國 38.5%、以色列 32.4%、德國 29.4%、美國 16.8%、中國 12.4%；台灣 8.4%、日本 4.1%、南韓 3.0% 最低。件數少的國家比例更高（巴基斯坦 86.1%、印尼 83.3%、哥斯大黎加 78.3%）。中國從 1998 年的 47.6% 降到 12.4%，自己的發明變多了。${PATENT_NOTE.zh}`,
        en: `Share of the US patents involving a country’s inventors that also have a foreign co-inventor (countries with at least 20 that year). Larger economies in 2022: Ireland 58.8%, Singapore 58.7%, Switzerland 50.2%, India 48.1%, the UK 46.0%, the Netherlands 45.5%, France 38.5%, Israel 32.4%, Germany 29.4%, the US 16.8% and China 12.4%; Taiwan 8.4%, Japan 4.1% and South Korea 3.0% are lowest. Countries with few patents score higher (Pakistan 86.1%, Indonesia 83.3%, Costa Rica 78.3%). China fell from 47.6% in 1998 to 12.4% as its own inventions grew. ${PATENT_NOTE.en}`,
      },
      unit: '%',
      file: 'coinvention-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 60] } },
      format: pct,
      formatTick: pctTick,
      defaultYear: 'latest',
      missing: { zh: '當年在美國申請的專利不到 20 件', en: 'Fewer than 20 US patent applications that year' },
    },
    {
      id: 'coinvention-partners',
      label: { zh: '流向：跟哪些國家共同發明', en: 'Flows: co-invention partners' },
      description: {
        zh: `有外國共同發明人的美國專利件數（2010 年起），點選國家畫出前 15 個合作的國家，線寬與件數成正比（一件可以有好幾國）。2022 年美國 22,195 件，夥伴是印度 4,360、中國 2,911、加拿大 2,881、英國 2,156、德國 1,951；台灣 1,256 件，跟美國 858、中國 274、新加坡 63 最多。${PATENT_NOTE.zh}`,
        en: `US patents with foreign co-inventors (from 2010); click a country to draw its top 15 partner countries, with line width proportional to patents (a patent can involve several countries). In 2022 the US had 22,195, with India 4,360, China 2,911, Canada 2,881, the UK 2,156 and Germany 1,951; Taiwan had 1,256, mostly with the US (858), China (274) and Singapore (63). ${PATENT_NOTE.en}`,
      },
      unit: { zh: '件', en: 'patents' },
      file: 'coinvented.json',
      layer: {
        kind: 'flow',
        file: 'coinvention-flows/{year}.json',
        direction: 'export',
        labels: { export: LABELS, import: LABELS },
        legendKey: { zh: '由選取的國家（淺）到合作的國家（深）', en: 'From the selected country (light) to its partners (dark)' },
      },
      format: patents,
      formatTick: formatLargeTick,
      integer: true,
      defaultYear: 'latest',
    },
    {
      id: 'innovation-active',
      label: { zh: '有在創新的企業', en: 'Innovation-active enterprises' },
      description: {
        zh: `調查期間推出新產品、新流程，或正在做（含做到一半放棄）的企業占全部企業的比例。加拿大 78.0% 最高，哥斯大黎加 74.1%、比利時 70.3%、挪威 69.6%（2020 年）、澳洲 68.5%、德國 63.4%、日本 58.9%（2023 年）、美國 54.7%、英國 48.7%、中國 42.2%、南韓 34.2%；羅馬尼亞 8.8% 最低（沒有寫年份的是 2022 年）。${CIS_NOTE.zh}`,
        en: `Share of enterprises that introduced new products or processes during the survey period, or were working on them (including abandoned attempts). Canada is highest at 78.0%, then Costa Rica 74.1%, Belgium 70.3%, Norway 69.6% (2020), Australia 68.5%, Germany 63.4%, Japan 58.9% (2023), the US 54.7%, the UK 48.7%, China 42.2% and South Korea 34.2%; Romania is lowest at 8.8% (2022 unless stated). ${CIS_NOTE.en}`,
      },
      unit: '%',
      file: 'innovation-active.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [30, 40, 50, 60, 70] } },
      format: pct,
      formatTick: pctTick,
      defaultYear: 'latest',
    },
    {
      id: 'innovation-support',
      label: { zh: '拿到政府創新補助或租稅優惠的企業', en: 'Enterprises with public support for innovation' },
      description: {
        zh: `拿到政府資金，或研發、創新的租稅優惠的企業占全部企業的比例。加拿大 34.0% 最高，義大利 26.0%、南韓 22.4%、比利時 22.1%、法國 21.9%、愛爾蘭 20.4%、日本 19.5%（2023 年）、美國 13.4%、德國 12.5%、英國 10.8%；印度 0.6%（2020 年）、羅馬尼亞 0.4% 最低（沒有寫年份的是 2022 年）。只看有在創新的企業，南韓有 65.5% 拿到。${CIS_NOTE.zh}`,
        en: `Share of enterprises receiving government funding or tax relief for R&D or other innovation. Canada is highest at 34.0%, then Italy 26.0%, South Korea 22.4%, Belgium 22.1%, France 21.9%, Ireland 20.4%, Japan 19.5% (2023), the US 13.4%, Germany 12.5% and the UK 10.8%; India 0.6% (2020) and Romania 0.4% are lowest (2022 unless stated). Among innovation-active enterprises alone, 65.5% in South Korea receive support. ${CIS_NOTE.en}`,
      },
      unit: '%',
      file: 'innovation-support.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 25] } },
      format: pct,
      formatTick: pctTick,
      defaultYear: 'latest',
    },
  ],
};
