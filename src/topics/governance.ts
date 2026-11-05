import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 六個面向用同一組門檻，也跟治安與司法主題的法治分數一樣：WGI 的 0–100 是以假想的最好、最差國家定錨的絕對分數，
 * 各面向、各年份共用同一把尺，切換時顏色可以互相比較（2025 年各面向的中位數在 45–69 之間）。
 */
const WGI_SCALE: ScaleSpec = { type: 'sequential', thresholds: [35, 45, 55, 65, 75, 85] };
const SCORE_UNIT = { zh: '分', en: 'score' };
const score = (v: number) => tr({ zh: `${fixed(v, 1)} 分`, en: fixed(v, 1) });
const scoreTick = (v: number) => fixed(v, 0);
const TAIL = {
  zh: '0–100 分，越高越好；是看法的綜合，不是官方評等。',
  en: 'Scored 0–100, higher is better; based on perceptions, not an official rating.',
};

function dimension(id: string, label: Text, about: Text): IndicatorDef {
  const text = (lang: 'zh' | 'en') => `${tr(about, lang)}${lang === 'zh' ? '' : ' '}${TAIL[lang]}`;
  return {
    id,
    label,
    description: { zh: text('zh'), en: text('en') },
    unit: SCORE_UNIT,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: WGI_SCALE },
    format: score,
    formatTick: scoreTick,
  };
}

/** V-Dem 的行政權制衡（2026-11-05 加，0–1）：三項共用一組循序色階，切換時顏色可以互相比較 */
const VDEM_SCALE: ScaleSpec = { type: 'sequential', thresholds: [0.2, 0.35, 0.5, 0.65, 0.8, 0.9] };
const VDEM_UNIT = '0–1';
const vdemIndex = (v: number) => fixed(v, 2);
const vdemTick = (v: number) => fixed(v, v === 0 ? 0 : Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2);

function vdem(id: string, label: Text, description: Text): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: VDEM_UNIT,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: VDEM_SCALE },
    format: vdemIndex,
    formatTick: vdemTick,
  };
}

export const governance: TopicDefinition = {
  id: 'governance',
  title: { zh: '政府治理', en: 'Governance' },
  shortTitle: { zh: '政府治理', en: 'Governance' },
  defaultIndicator: 'effectiveness',
  defaultYear: 2025,
  sources: [
    {
      name: 'World Bank, Worldwide Governance Indicators, 2026 Update (www.govindicators.org)',
      url: 'https://www.worldbank.org/en/publication/worldwide-governance-indicators',
      license: 'CC BY 4.0',
    },
    {
      name: 'Coppedge, Michael, John Gerring, Carl Henrik Knutsen, Staffan I. Lindberg, Jan Teorell, David Altman, et al. 2026. "V-Dem Country-Year Dataset v16". Varieties of Democracy (V-Dem) Project',
      url: 'https://doi.org/10.23696/vdemds26',
      license: { zh: 'CC BY-SA 4.0（行政權受到的制衡三項；衍生的資料檔也用 CC BY-SA 4.0）', en: 'CC BY-SA 4.0 (the three constraints on the executive; derived data files are shared under CC BY-SA 4.0 too)' },
    },
  ],
  note: {
    zh:
      '世界銀行的全球治理指標（WGI）綜合 35 個家戶與企業調查、專家評估裡跟各面向有關的題目，用統計模型合成估計值（約 −2.5 到 2.5），再換算成 0–100 分：以假想的「每個來源都最好」與「每個來源都最差」的國家為 100 與 0，所以是絕對分數，不同年份可以比較。' +
      '2025 年改版後 WGI 不再公布百分位排名，地圖用官方的分數，名次寫在側欄；側欄也列出估計值、標準誤、90% 信賴區間與資料來源數，區間重疊的國家，高低不一定有意義。WGI 量的是看法，世界銀行說明它不是對各國政府的官方評等。' +
      '世界中位數是當年有資料的經濟體的中位數（每個經濟體一樣重）。「法治」跟治安與司法主題的法治分數是同一份資料；「發聲與課責」的來源之一是民主與自由主題用的 V-Dem，但 WGI 另外綜合了其他調查與評估，兩者的數字不能直接換算。' +
      '國際透明組織的清廉印象指數（CPI）是 CC BY-ND 4.0（不得改作），沒有用；貪腐控制用 WGI。' +
      '最後三項（司法的制衡、立法的制衡、地方分權）改用 V-Dem：專家評分合成的 0–1 估計值，這裡從 1900 年起，國家的接續方式跟「民主與自由」主題一樣；跟 WGI 量的東西不同，數字不能互相換算。',
    en:
      'The World Bank Worldwide Governance Indicators (WGI) combine the relevant questions from 35 household and firm surveys and expert assessments into a statistical estimate (roughly −2.5 to 2.5), which is then converted to a 0–100 score anchored at a hypothetical country that gets the best (100) or worst (0) rating from every source. The score is therefore absolute and comparable across years. ' +
      'Since its 2025 revision the WGI no longer publishes percentile ranks, so the map shows the official score and the side panel gives the rank, along with the estimate, its standard error, the 90% confidence interval and the number of sources; where intervals overlap, countries may not really differ. The WGI measure perceptions, and the World Bank states that they are not an official rating of governments. ' +
      'The world median is the median of economies with data that year (each economy counts equally). Rule of law is the same data as the rule-of-law score in the Crime topic; one of the sources for voice and accountability is V-Dem, used in the Democracy topic, but the WGI also draw on other surveys and assessments, so the two sets of numbers do not convert into each other. ' +
      "Transparency International's Corruption Perceptions Index (CPI) is licensed CC BY-ND 4.0 (no derivatives), so it is not used; control of corruption comes from the WGI. " +
      'The last three indicators (judicial constraints, legislative constraints and division of power) come from V-Dem instead: estimates from expert ratings on a 0–1 scale, going back to 1900 here, with the same country continuity as the Democracy topic. They measure different things from the WGI and the numbers do not convert into each other.',
  },
  panelExtra: () => import('./panels/GovernancePanel'),
  // 順序是 WGI 自己的順序；6 個指標用下拉選單，控制列是一行
  indicators: [
    dimension(
      'voice',
      { zh: '發聲與課責', en: 'Voice and accountability' },
      {
        zh: '人民能不能參與選出政府（含選舉是否公正），以及課責的機制：能否取得資訊、政府的監督機關、傳統與數位媒體的環境。',
        en: 'Whether citizens can take part in choosing their government, including electoral integrity, and mechanisms of accountability: access to information, oversight bodies and the traditional and digital media landscape.',
      },
    ),
    dimension(
      'stability',
      { zh: '政治穩定', en: 'Political stability' },
      {
        zh: '政治穩定與沒有暴力、恐怖主義：政權是否安定，政府被暴力、脅迫或違憲手段挑戰或推翻的可能。',
        en: 'Political stability and absence of violence/terrorism: how secure political power is from destabilisation, and the likelihood that authority will be challenged or overturned by violent, coercive or unconstitutional means.',
      },
    ),
    dimension(
      'effectiveness',
      { zh: '政府效能', en: 'Government effectiveness' },
      {
        zh: '公共服務與文官體系的品質、政策的制定與執行，以及政府決策的可信度。',
        en: 'The quality of public services and the civil service, policy formulation and implementation, and the credibility of government decisions.',
      },
    ),
    dimension(
      'regulatory',
      { zh: '法規品質', en: 'Regulatory quality' },
      {
        zh: '政府設計與執行有利民間部門發展的政策與法規的能力。',
        en: "The government's ability to design and implement policies and regulations that promote private sector development.",
      },
    ),
    dimension(
      'rule-of-law',
      { zh: '法治', en: 'Rule of law' },
      {
        zh: '大家對警察、法院、契約與財產權的信任，以及犯罪與暴力的風險（跟治安與司法主題的法治分數相同）。',
        en: 'Confidence in the police, the courts, contract enforcement and property rights, and the likelihood of crime and violence (the same as the rule-of-law score in the Crime topic).',
      },
    ),
    dimension(
      'corruption',
      { zh: '貪腐控制', en: 'Control of corruption' },
      {
        zh: '公權力被用來謀取私利的程度，包括小額與大規模的貪腐，以及國家被菁英與私人利益把持。',
        en: 'The extent to which public power is exercised for private gain, including petty and grand corruption and the capture of the state by elites and private interests.',
      },
    ),
    // 2026-11-05（製作手冊第二十二批 377）：V-Dem 的行政權受到的制衡
    vdem(
      'judicial-constraints',
      { zh: '司法對行政的制衡', en: 'Judicial constraints on the executive' },
      {
        zh: 'V-Dem 的指數：行政部門是否尊重憲法、服從法院判決，司法能否獨立行事。0–1，越高制衡越強。2025 年澳洲 0.99、丹麥 0.98、瑞士 0.98 最高，北韓、尼加拉瓜 0.003 最低；台灣 0.79（2023 年 0.88），美國 0.84、日本 0.88、南韓 0.87，中國 0.03。',
        en: 'V-Dem index: whether the executive respects the constitution and complies with court rulings, and whether the judiciary can act independently. 0–1, higher means stronger constraints. In 2025 Australia (0.99), Denmark and Switzerland (0.98) were highest and North Korea and Nicaragua (0.003) lowest; Taiwan 0.79 (0.88 in 2023), the US 0.84, Japan 0.88, South Korea 0.87, China 0.03.',
      },
    ),
    vdem(
      'legislative-constraints',
      { zh: '立法對行政的制衡', en: 'Legislative constraints on the executive' },
      {
        zh: 'V-Dem 的指數：國會與審計、檢察、監察等機關能否質詢、調查、監督行政部門。0–1，越高制衡越強。2025 年瑞典 0.99、挪威 0.98、德國 0.98 最高，尼加拉瓜、白俄羅斯 0.03、委內瑞拉 0.04 最低；台灣 0.92（2023 年 0.83），美國 0.61。沒有國會的國家沒有值。',
        en: 'V-Dem index: whether the legislature and agencies such as the auditor general, prosecutors and ombudsman can question, investigate and oversee the executive. 0–1, higher means stronger constraints. In 2025 Sweden (0.99), Norway and Germany (0.98) were highest and Nicaragua, Belarus (0.03) and Venezuela (0.04) lowest; Taiwan 0.92 (0.83 in 2023), the US 0.61. Countries without a legislature have no value.',
      },
    ),
    vdem(
      'division-of-power',
      { zh: '地方分權', en: 'Division of power' },
      {
        zh: 'V-Dem 的指數：有沒有民選的地方與區域政府，能不能不受中央派任或其他非民選機關干預。0–1，越高越分權。高分不等於聯邦制：日本 0.99 是因為都道府縣與市町村的首長、議會都民選而且有實權。2025 年瑞士 1.00、西班牙 0.99、墨西哥 0.99 最高，新加坡、塞席爾等 22 國是 0；台灣 0.48。V-Dem 沒有給這一項的可信區間。',
        en: 'V-Dem index: whether there are elected local and regional governments and whether they can operate without interference from appointed or other unelected bodies. 0–1, higher means more dispersed power. A high score does not mean federalism: Japan scores 0.99 because its prefectures and municipalities elect both executives and assemblies with real powers. In 2025 Switzerland (1.00), Spain and Mexico (0.99) were highest, while 22 countries including Singapore and Seychelles scored 0; Taiwan 0.48. V-Dem gives no credible interval for this index.',
      },
    ),
  ],
};
