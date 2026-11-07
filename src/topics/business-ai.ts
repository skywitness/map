import { fixed } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * AI 發展的擴充：企業用了多少 AI 與雲端（2026-11-07，製作手冊第二十七批 595，候選 1318；pipeline/topics/business_ai.py）：
 * OECD 企業 ICT 調查（歐洲國家的數字來自 Eurostat），10 人以上的企業；側欄 panels/BusinessAiPanel.tsx 是 AI 技術與用途。
 */
const pct = (v: number) => `${fixed(v, 1)}%`;
const NOTE = {
  zh: '只調查 10 人以上的企業，30 個左右的經濟體（歐洲加南韓、巴西、澳洲等），台灣不在裡面；2025 年的問卷多了一種 AI 技術（生成圖片、影片、聲音），跟之前的年份不完全可比。',
  en: 'Only businesses with 10 or more employees are surveyed, in about 30 economies (Europe plus South Korea, Brazil, Australia and others); Taiwan is not included. The 2025 questionnaire added one AI technology (generating images, video and sound), so it is not fully comparable with earlier years.',
};

export const businessAiPart: TopicPart = {
  name: { zh: '企業用了多少 AI 與雲端', en: 'Business use of AI and cloud' },
  sources: [
    {
      name: { zh: 'OECD：ICT Access and Usage by Businesses（DF_BUSINESSES）', en: 'OECD: ICT Access and Usage by Businesses (DF_BUSINESSES)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_ICT_B%40DF_BUSINESSES&df[ag]=OECD.STI.DEP',
      license: 'CC BY 4.0',
    },
  ],
  panelExtra: () => import('./panels/BusinessAiPanel'),
  indicators: [
    {
      id: 'business-ai',
      label: { zh: '用 AI 的比例', en: 'share using AI' },
      description: {
        zh: `至少用一種 AI 技術的企業占幾 %（OECD 企業 ICT 調查，2020 年起；子項目依企業規模）。2025 年 10 人以上的企業：丹麥 42.0%、芬蘭 37.8%、瑞典 35.0%、比利時 34.5%、盧森堡 33.6%、荷蘭 33.2%、奧地利 29.9%、挪威 28.9%、德國 26.0%、法國 18.2%；羅馬尼亞 5.2%、土耳其 7.4% 最低。規模差很多：250 人以上的大企業芬蘭 79.4%、比利時 76.4%、丹麥 74.5%，10–49 人的小企業丹麥 37.5%、芬蘭 33.5%、法國 15.0%。南韓 2024 年 32.9%（2025 年還沒有）。${NOTE.zh}`,
        en: `Share of businesses using at least one AI technology (OECD business ICT survey, from 2020; sub-items by firm size). For businesses with 10+ employees in 2025: Denmark 42.0%, Finland 37.8%, Sweden 35.0%, Belgium 34.5%, Luxembourg 33.6%, the Netherlands 33.2%, Austria 29.9%, Norway 28.9%, Germany 26.0% and France 18.2%; Romania 5.2% and Turkey 7.4% are lowest. Size matters a lot: among large firms (250+) Finland reaches 79.4%, Belgium 76.4% and Denmark 74.5%, versus small firms (10–49) at 37.5% in Denmark, 33.5% in Finland and 15.0% in France. South Korea was 32.9% in 2024 (no 2025 figure yet). ${NOTE.en}`,
      },
      unit: '%',
      file: 'business-ai/{item}.json',
      dimension: {
        label: { zh: '企業規模', en: 'Firm size' },
        options: [
          { id: 'all', label: { zh: '10 人以上的企業', en: 'Businesses with 10+ employees:' } },
          { id: 'small', label: { zh: '10–49 人的小企業', en: 'Small businesses (10–49):' } },
          { id: 'medium', label: { zh: '50–249 人的中型企業', en: 'Medium businesses (50–249):' } },
          { id: 'large', label: { zh: '250 人以上的大企業', en: 'Large businesses (250+):' } },
        ],
        defaultOption: 'all',
      },
      layer: {
        kind: 'choropleth',
        scale: { type: 'sequential', thresholds: [10, 15, 20, 25, 30, 35] },
        itemScales: {
          all: { type: 'sequential', thresholds: [10, 15, 20, 25, 30, 35] },
          small: { type: 'sequential', thresholds: [10, 15, 20, 25, 30, 35] },
          medium: { type: 'sequential', thresholds: [15, 25, 30, 35, 40, 50] },
          large: { type: 'sequential', thresholds: [30, 40, 50, 60, 70, 75] },
        },
      },
      format: pct,
    },
    {
      id: 'business-cloud',
      label: { zh: '買雲端服務的企業比例', en: 'Businesses buying cloud services' },
      description: {
        zh: `向外購買雲端運算服務（電子郵件、辦公軟體、資料庫、檔案儲存、運算資源等）的企業占幾 %（10 人以上的企業；各國最近一年，最多往前找 3 年）：芬蘭 79.2%、南韓 77.8%（2024 年）、義大利 75.6%、愛爾蘭 73.0%、澳洲 72.4%（2022 年）、瑞典 72.0%、巴西 70.6%；日本 28.3%（2023 年）、羅馬尼亞 24.9%、希臘 24.3%、土耳其 20.3%、保加利亞 17.8%。${NOTE.zh}`,
        en: `Share of businesses (10+ employees) buying cloud computing services (e-mail, office software, databases, file storage, computing power and so on). Latest year for each, up to 3 years back: Finland 79.2%, South Korea 77.8% (2024), Italy 75.6%, Ireland 73.0%, Australia 72.4% (2022), Sweden 72.0% and Brazil 70.6%; Japan 28.3% (2023), Romania 24.9%, Greece 24.3%, Turkey 20.3% and Bulgaria 17.8%. ${NOTE.en}`,
      },
      unit: '%',
      file: 'business-cloud.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [30, 40, 50, 60, 70] } },
      format: pct,
      defaultYear: 'latest',
    },
  ],
};
