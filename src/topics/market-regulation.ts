import { fixed } from '../lib/format';
import type { DimensionDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 開公司有多麻煩、國家持股有多深（新主題，2026-11-07，製作手冊第二十五批 469，候選 1120；pipeline/topics/market_regulation.py）：
 * OECD 產品市場管制指標（PMR，2018、2023，含台灣），經濟的「企業」小類。0–6 分是管制的強度，不是好壞
 */
const score = (v: number) => fixed(v, 2);
const tick = (v: number) => fixed(v, 1);
const SCALE: ScaleSpec = { type: 'sequential', thresholds: [1, 1.5, 2, 2.5, 3, 4] };
const LOW: ScaleSpec = { type: 'sequential', thresholds: [0.25, 0.5, 1, 1.5, 2, 2.5] };
const WIDE: ScaleSpec = { type: 'sequential', thresholds: [1, 2, 3, 4, 5, 5.5] };
const GROUP_PRO = { zh: '專業服務', en: 'Professional services' };
const GROUP_NET = { zh: '網路型產業', en: 'Network industries' };
const GROUP_RETAIL = { zh: '零售', en: 'Retail' };

const SECTOR: DimensionDef = {
  label: { zh: '行業', en: 'Sector' },
  options: [
    { id: 'retail', label: { zh: '零售業', en: 'Retail distribution' }, group: GROUP_RETAIL },
    { id: 'price', label: { zh: '零售價格管制', en: 'Retail price controls' }, group: GROUP_RETAIL },
    { id: 'medicines', label: { zh: '藥品零售', en: 'Retail sales of medicines' }, group: GROUP_RETAIL },
    { id: 'lawyers', label: { zh: '律師', en: 'Lawyers' }, group: GROUP_PRO },
    { id: 'notaries', label: { zh: '公證人', en: 'Notaries' }, group: GROUP_PRO },
    { id: 'accountants', label: { zh: '會計師', en: 'Accountants' }, group: GROUP_PRO },
    { id: 'architects', label: { zh: '建築師', en: 'Architects' }, group: GROUP_PRO },
    { id: 'engineers', label: { zh: '土木工程師', en: 'Civil engineers' }, group: GROUP_PRO },
    { id: 'estate-agents', label: { zh: '不動產仲介', en: 'Real estate agents' }, group: GROUP_PRO },
    { id: 'electricity', label: { zh: '電力', en: 'Electricity' }, group: GROUP_NET },
    { id: 'gas', label: { zh: '天然氣', en: 'Natural gas' }, group: GROUP_NET },
    { id: 'ecomm', label: { zh: '電信', en: 'E-communications' }, group: GROUP_NET },
    { id: 'rail', label: { zh: '鐵路', en: 'Rail' }, group: GROUP_NET },
    { id: 'road', label: { zh: '公路貨運', en: 'Road transport' }, group: GROUP_NET },
    { id: 'air', label: { zh: '航空', en: 'Air transport' }, group: GROUP_NET },
    { id: 'water', label: { zh: '水運', en: 'Water transport' }, group: GROUP_NET },
    { id: 'digital', label: { zh: '數位市場', en: 'Digital markets' }, group: GROUP_NET },
  ],
  defaultOption: 'retail',
};

export const marketRegulation: TopicDefinition = {
  id: 'market-regulation',
  title: { zh: '開公司有多麻煩、國家持股有多深', en: 'Product market regulation' },
  shortTitle: { zh: '市場管制', en: 'Market regulation' },
  defaultIndicator: 'pmr',
  defaultYear: 2023,
  sources: [
    {
      name: { zh: 'OECD Product Market Regulation（產品市場管制指標，DSD_PMR@DF_PMR）', en: 'OECD Product Market Regulation indicators (DSD_PMR@DF_PMR)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_PMR%40DF_PMR&df[ag]=OECD.ECO.GCRD',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: 'OECD 依各國的法條與問卷逐題計分，0 到 6 分，越高表示管制越多；分數是管制的強度，不是好壞，也不能合成一句「這國好不好做生意」（希臘的零售管制偏高，開公司的行政負擔卻是最低）。只有 2018、2023 兩波，台灣只有 2023 年。「公營事業」的指標量的是公營事業涵蓋多少行業、政府怎麼管它們，不是國有企業占 GDP 的比重（OECD 的國有企業資料庫沒有可以下載的資料）；美國的「公營事業的治理」分數高，是因為沒有把公營事業的治理規則寫清楚，不代表國營企業多。跟已經排除的世界銀行 B-READY 營商環境不同：這是法條盤點、56 個經濟體、分到各行業，而且有台灣。側欄比這一國與 56 國的中位數。',
    en: 'The OECD scores each country’s laws and questionnaire answers item by item from 0 to 6; higher means more regulation. Scores measure how much regulation there is, not whether it is good, and cannot be rolled into a single verdict on how easy it is to do business (Greece regulates retail heavily yet has the lightest start-up burden). There are only two waves, 2018 and 2023, and Taiwan is covered in 2023 only. The public ownership indicators measure how many sectors state-owned enterprises cover and how the state governs them, not their share of GDP (the OECD’s state-owned enterprise database offers no downloadable data); the US scores high on governance of state-owned enterprises because its governance rules are not codified, not because it has many of them. This differs from the World Bank’s B-READY business environment scores: it is an inventory of laws, covering 56 economies broken down by sector, and includes Taiwan. The side panel compares each country with the median of the 56.',
  },
  panelExtra: () => import('./panels/MarketRegulationPanel'),
  indicators: [
    {
      id: 'pmr',
      label: { zh: '產品市場管制', en: 'Product market regulation' },
      description: {
        zh: '整體的管制程度，由「國家介入造成的扭曲」與「國內外業者進入市場的障礙」兩大支柱組成。2023 年肯亞 2.92、摩洛哥 2.85、南非 2.83、馬來西亞 2.70、中國大陸 2.59、土耳其 2.52 最高，台灣 2.20 是 56 國裡第 11 高；日本 1.60、美國 1.58、南韓 1.35、德國 1.21，中位數 1.49；英國、愛爾蘭 0.90、立陶宛 0.85、瑞典 0.81 最低。',
        en: 'Overall regulation, combining two pillars: distortions induced by state involvement and barriers to domestic and foreign entry. In 2023 Kenya (2.92), Morocco (2.85), South Africa (2.83), Malaysia (2.70), mainland China (2.59) and Turkey (2.52) were highest, with Taiwan 11th of 56 at 2.20; Japan 1.60, the US 1.58, South Korea 1.35, Germany 1.21, against a median of 1.49; the UK and Ireland (0.90), Lithuania (0.85) and Sweden (0.81) were lowest.',
      },
      unit: { zh: '分（0–6）', en: 'score (0–6)' },
      file: 'pmr/{item}.json',
      dimension: {
        label: { zh: '看', en: 'Show' },
        options: [
          { id: 'total', label: { zh: '總分', en: 'Overall' } },
          { id: 'state', label: { zh: '國家介入造成的扭曲', en: 'Distortions from state involvement' } },
          { id: 'entry', label: { zh: '進入市場的障礙', en: 'Barriers to entry' } },
        ],
        defaultOption: 'total',
      },
      layer: { kind: 'choropleth', scale: SCALE },
      format: score,
      formatTick: tick,
      compareWorld: false,
    },
    {
      id: 'state',
      label: { zh: '國家持股與政府介入', en: 'State ownership and involvement' },
      description: {
        zh: '四個子指標：公營事業的範圍與品質（公營事業涵蓋多少行業）、公營事業造成的扭曲、公營事業的治理、政府介入企業經營（價格管制、指定業務等）。公營事業的範圍：中國大陸 2.45、墨西哥 2.36、馬來西亞 2.17 最高，台灣 1.21，荷蘭 0.12、挪威 0.08 最低。政府介入企業經營：馬來西亞 2.79、台灣 2.64 是 56 國裡最高的兩個，英國 0.40 最低。這不是國有企業占 GDP 的比重。',
        en: 'Four sub-indicators: quality and scope of public ownership (how many sectors state-owned enterprises cover), distortions induced by public ownership, governance of state-owned enterprises, and involvement in business operations (price controls, mandated services and the like). On scope, mainland China (2.45), Mexico (2.36) and Malaysia (2.17) are highest, Taiwan 1.21, and the Netherlands (0.12) and Norway (0.08) lowest. On involvement in business operations, Malaysia (2.79) and Taiwan (2.64) are the two highest of 56, and the UK (0.40) lowest. This is not the share of state-owned enterprises in GDP.',
      },
      unit: { zh: '分（0–6）', en: 'score (0–6)' },
      file: 'state/{item}.json',
      dimension: {
        label: { zh: '指標', en: 'Measure' },
        options: [
          { id: 'scope', label: { zh: '公營事業的範圍與品質', en: 'Scope of public ownership' } },
          { id: 'distort', label: { zh: '公營事業造成的扭曲', en: 'Distortions from public ownership' } },
          { id: 'governance', label: { zh: '公營事業的治理', en: 'Governance of SOEs' } },
          { id: 'business', label: { zh: '政府介入企業經營', en: 'Involvement in business operations' } },
        ],
        defaultOption: 'scope',
      },
      layer: { kind: 'choropleth', scale: SCALE, itemScales: { scope: LOW } },
      format: score,
      formatTick: tick,
      compareWorld: false,
    },
    {
      id: 'entry',
      label: { zh: '開公司與外資的門檻', en: 'Start-up and foreign entry barriers' },
      description: {
        zh: '開公司的行政負擔（有限公司與獨資事業要跑的程序）、整體的行政與法規負擔、外資限制、關稅。開公司的行政負擔：肯亞 3.45、哥斯大黎加 3.40、日本 3.35、羅馬尼亞與賽普勒斯 3.30 最高，台灣 2.35、美國 2.03（中位數），愛沙尼亞 0.86、紐西蘭 0.82、希臘 0.52 最低。外資限制馬來西亞 1.93、印尼 1.69 最高，台灣沒有分數。',
        en: 'The administrative burden of starting a limited liability company or sole proprietorship, the overall administrative and regulatory burden, barriers to foreign direct investment, and tariffs. On start-up burden, Kenya (3.45), Costa Rica (3.40), Japan (3.35), Romania and Cyprus (3.30) are highest, Taiwan 2.35 and the US 2.03 (the median), and Estonia (0.86), New Zealand (0.82) and Greece (0.52) lowest. Malaysia (1.93) and Indonesia (1.69) have the highest FDI barriers; Taiwan has no FDI score.',
      },
      unit: { zh: '分（0–6）', en: 'score (0–6)' },
      file: 'entry/{item}.json',
      dimension: {
        label: { zh: '指標', en: 'Measure' },
        options: [
          { id: 'startup', label: { zh: '開公司的行政負擔', en: 'Start-up administrative burden' } },
          { id: 'burden', label: { zh: '行政與法規負擔', en: 'Administrative and regulatory burden' } },
          { id: 'fdi', label: { zh: '外資限制', en: 'Barriers to FDI' } },
          { id: 'tariffs', label: { zh: '關稅障礙', en: 'Tariff barriers' } },
        ],
        defaultOption: 'startup',
      },
      layer: { kind: 'choropleth', scale: SCALE, itemScales: { fdi: LOW, tariffs: WIDE } },
      format: score,
      formatTick: tick,
      compareWorld: false,
    },
    {
      id: 'sector',
      label: { zh: '各行業的管制', en: 'Regulation by sector' },
      description: {
        zh: '各行業進入與經營的管制。台灣的建築師（3.75）、航空（3.42）、天然氣（5.02）是 56 國裡管制最多的，零售價格管制 3.33 第 2、會計師 3.96 第 4、鐵路 5.25 第 4；零售業 0.71 則低於中位數。零售業法國 3.00、羅馬尼亞 2.71 最高，愛沙尼亞、立陶宛 0。律師的管制在多數國家都高（中位數 3.29，巴西 5.46 最高）。',
        en: 'Regulation of entry and conduct in each sector. Taiwan regulates architects (3.75), air transport (3.42) and natural gas (5.02) more than any of the 56 economies, ranks 2nd on retail price controls (3.33), 4th on accountants (3.96) and 4th on rail (5.25), but is below the median on retail distribution (0.71). France (3.00) and Romania (2.71) regulate retail the most, Estonia and Lithuania not at all. Lawyers are heavily regulated almost everywhere (median 3.29, Brazil highest at 5.46).',
      },
      unit: { zh: '分（0–6）', en: 'score (0–6)' },
      file: 'sector/{item}.json',
      dimension: SECTOR,
      layer: { kind: 'choropleth', scale: WIDE, itemScales: { retail: SCALE, price: SCALE, 'estate-agents': SCALE } },
      format: score,
      formatTick: tick,
      compareWorld: false,
    },
  ],
};
