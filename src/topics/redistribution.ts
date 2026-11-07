import { tr } from '../i18n';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 重分配與貧窮（2026-11-07，製作手冊第二十五批 449，合併候選 1089–1091；pipeline/topics/redistribution.py）：
 * OECD IDD 的市場所得與可支配所得吉尼、相對貧窮率，OECD TaxBEN 的低收入給付水準與脫貧所需工時。
 * 跟社會類的「貧富差距」口徑不同（那裡是世界銀行 PIP 與 WID 的可支配所得吉尼、每天 3 美元的絕對貧窮），
 * 這裡看的是「政府的稅與移轉做了多少事」與相對貧窮
 */
const gini = (v: number) => fixed(v, 3);
const OECD_ONLY = { zh: 'OECD 的資料沒有台灣', en: 'Taiwan is not in the OECD data' };

export const redistribution: TopicDefinition = {
  id: 'redistribution',
  title: { zh: '重分配與貧窮', en: 'Redistribution and poverty' },
  shortTitle: { zh: '重分配與貧窮', en: 'Redistribution' },
  defaultIndicator: 'redistribution',
  defaultYear: 2023,
  sources: [
    {
      name: { zh: 'OECD Income Distribution Database（IDD，所得分配資料庫）', en: 'OECD Income Distribution Database (IDD)' },
      url: 'https://www.oecd.org/en/data/datasets/income-and-wealth-distribution-database.html',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'OECD Tax-Benefit Model（TaxBEN）：低收入給付的適足性、脫離貧窮所需的工時', en: 'OECD Tax-Benefit Model (TaxBEN): adequacy of minimum-income benefits; hours needed to escape poverty' },
      url: 'https://www.oecd.org/en/data/tools/oecd-tax-benefit-simulator.html',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '跟社會類的「貧富差距」不一樣：那裡是世界銀行與 WID 的可支配所得吉尼（190 多國）與每天 3 美元的絕對貧窮，這裡是 OECD 的市場所得對可支配所得兩套吉尼（45 國），看政府的稅與社會移轉把差距拉近了多少；貧窮是「所得低於全國中位數一半」的相對貧窮（美國的絕對貧窮接近 0，相對貧窮 18.1%）。各國調查年份不同（中國大陸、印度只到 2011 年），地圖用 10 年內最近一次並標年份。低收入給付與脫貧工時是 OECD 的模型家庭（假設的標準家戶），不是實際受領者的平均，都不含住宅補貼。台灣不在 OECD 的資料裡：主計總處的家庭收支調查有政府移轉前後的所得分配，但口徑（五等分位、等值化）跟 OECD 不同，沒有放上地圖。',
    en: 'Not the same as Inequality under Society, which uses World Bank and WID disposable-income Gini (190-plus countries) and the US$3-a-day absolute poverty line. This topic compares the OECD’s Gini for market income and for disposable income (45 countries) to show how far taxes and transfers narrow the gap, and measures relative poverty: income below half the national median (the US has almost no absolute poverty but 18.1% relative poverty). Survey years vary (mainland China and India only to 2011), so the map uses each country’s latest survey within 10 years and labels the year. The benefit and work-hours indicators are for OECD model families (hypothetical standard households), not averages of actual recipients, and exclude housing benefits. Taiwan is not in the OECD data; DGBAS’s household survey reports income distribution before and after government transfers, but on a different basis (quintiles and equivalence scale), so it is not mapped.',
  },
  noValue: { TWN: OECD_ONLY },
  panelExtra: () => import('./panels/RedistributionPanel'),
  indicators: [
    {
      id: 'redistribution',
      label: { zh: '稅與移轉讓吉尼降了多少', en: 'Gini reduction from taxes and transfers' },
      description: {
        zh: '市場所得吉尼（稅前、政府移轉前）減掉可支配所得吉尼（稅後、移轉後）：數字越大，政府的稅與社福把貧富差距拉近得越多。芬蘭 2024 年從 0.523 降到 0.279（降 0.243）、比利時降 0.232、法國降 0.218、奧地利降 0.203；美國 0.506 降到 0.394（降 0.112），南韓 0.392 降到 0.323（降 0.069），墨西哥只降 0.016。稅前最不平等的芬蘭、法國（市場所得吉尼都超過 0.5），稅後反而是最平等的一群。退休人口多的國家，退休者沒有市場所得，市場所得吉尼會偏高。',
        en: 'Market-income Gini (before taxes and transfers) minus disposable-income Gini (after): the larger the number, the more taxes and benefits narrow the gap. In 2024 Finland went from 0.523 to 0.279 (down 0.243); Belgium fell 0.232, France 0.218 and Austria 0.203; the US went from 0.506 to 0.394 (down 0.112), South Korea from 0.392 to 0.323 (down 0.069) and Mexico fell only 0.016. Finland and France, among the most unequal before taxes (market Gini above 0.5), end up among the most equal after. Countries with many retirees have higher market-income Gini because retirees have little market income.',
      },
      unit: '',
      file: 'redistribution.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.05, 0.1, 0.13, 0.16, 0.19, 0.22] } },
      format: (v) => tr({ zh: `降 ${fixed(v, 3)}`, en: `−${fixed(v, 3)}` }),
      formatTick: (v) => fixed(v, 2),
    },
    {
      id: 'gini',
      label: { zh: '吉尼係數（市場所得、可支配所得）', en: 'Gini coefficient (market and disposable income)' },
      description: {
        zh: '0 是人人所得一樣，1 是一個人拿走全部。市場所得是工作、事業與資產的所得，可支配所得再加上政府的社會移轉（年金、補助）、扣掉稅與社會保險費；都依家戶人數等值化（OECD 的平方根尺度）。2024 年芬蘭市場所得 0.523、可支配所得 0.279；美國 0.506、0.394；墨西哥 0.416、0.400。側欄畫這一國兩條線，中間的差距就是重分配。',
        en: '0 means everyone has the same income, 1 that one person has it all. Market income is from work, business and assets; disposable income adds government transfers (pensions, benefits) and deducts taxes and social contributions; both are equivalised for household size (OECD square-root scale). In 2024 Finland’s market Gini was 0.523 and disposable 0.279; the US 0.506 and 0.394; Mexico 0.416 and 0.400. The side panel plots both lines; the gap between them is redistribution.',
      },
      unit: '',
      file: 'gini/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.26, 0.29, 0.32, 0.36, 0.42, 0.5] } },
      dimension: {
        label: { zh: '所得', en: 'Income' },
        options: [
          { id: 'disposable', label: { zh: '可支配所得（稅後、移轉後）', en: 'Disposable income (after taxes and transfers)' } },
          { id: 'market', label: { zh: '市場所得（稅前、移轉前）', en: 'Market income (before taxes and transfers)' } },
        ],
        defaultOption: 'disposable',
      },
      format: gini,
      formatTick: (v) => fixed(v, 2),
    },
    {
      id: 'poverty',
      label: { zh: '相對貧窮率', en: 'Relative poverty rate' },
      description: {
        zh: '可支配所得低於全國中位數一半的人口比例，可以按年齡切。全人口：南非 27.7%（2017）、哥斯大黎加 21.3%、巴西 19.2%、美國 18.1%、以色列 17.2% 最高，捷克 5.5%、冰島 5.6%、比利時 6.3% 最低。65 歲以上：南韓 39.8% 最高，拉脫維亞 34.3%、紐西蘭 33.7%；南韓老年貧窮跟公共年金起步晚有關。兒童：巴西 31.1%、西班牙 21.5%、美國 21.1%，丹麥 4.2% 最低。相對貧窮跟著中位數變，景氣好、中位數上升時也可能變高。',
        en: 'Share of people with disposable income below half the national median, by age. For the whole population South Africa (27.7%, 2017), Costa Rica (21.3%), Brazil (19.2%), the US (18.1%) and Israel (17.2%) are highest; Czechia (5.5%), Iceland (5.6%) and Belgium (6.3%) lowest. Among people over 65, South Korea is highest at 39.8%, ahead of Latvia (34.3%) and New Zealand (33.7%), reflecting its late-starting public pension. For children, Brazil is 31.1%, Spain 21.5% and the US 21.1%, with Denmark lowest at 4.2%. Because the line moves with the median, relative poverty can rise even in good times.',
      },
      unit: '%',
      file: 'poverty/{item}.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [7, 9, 11, 13, 16, 20] } },
      dimension: {
        label: { zh: '年齡', en: 'Age' },
        options: [
          { id: 'all', label: { zh: '全人口', en: 'Total population' } },
          { id: 'children', label: { zh: '兒童（未滿 18 歲）', en: 'Children (under 18)' } },
          { id: 'working-age', label: { zh: '工作年齡（18–65 歲）', en: 'Working age (18–65)' } },
          { id: 'elderly', label: { zh: '65 歲以上', en: 'Over 65' } },
        ],
        defaultOption: 'all',
      },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'benefit-adequacy',
      label: { zh: '低收入給付占中位數所得', en: 'Minimum-income benefits vs median income' },
      description: {
        zh: '沒有工作、申請最低生活保障的單身者，一年拿到的淨所得是全國可支配所得中位數的幾 %（OECD TaxBEN 的模型家庭，不含住宅補貼）。2024–2025 年比利時 44%、荷蘭與盧森堡 43%、冰島 39%、丹麥 38%、日本 37%、西班牙與馬爾他 35%；美國與匈牙利 7%、斯洛伐克 8%；義大利、土耳其是 0%（沒有全國性的最低生活保障，義大利 2023 年廢除公民基本收入、改成條件更嚴的制度）。50% 線是 OECD 常用的貧窮線，大部分國家的給付都在線下。台灣的社會救助法把最低生活費訂為每人可支配所得中位數的 60%，口徑不同，沒有放上地圖。',
        en: 'Net annual income of a jobless single person claiming minimum-income benefits, as a share of national median disposable income (OECD TaxBEN model family, excluding housing benefits). In 2024–2025 Belgium was 44%, the Netherlands and Luxembourg 43%, Iceland 39%, Denmark 38%, Japan 37% and Spain and Malta 35%; the US and Hungary 7% and Slovakia 8%; Italy and Turkey 0% (no national minimum-income scheme; Italy abolished its citizenship income in 2023 for a stricter programme). The OECD’s usual poverty line is 50%, and most countries’ benefits fall below it. Taiwan’s Public Assistance Act sets the minimum living expense at 60% of median disposable income per person, on a different basis, so it is not mapped.',
      },
      unit: '%',
      file: 'benefit-adequacy.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 30, 35, 40] } },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'hours-out-of-poverty',
      label: { zh: '領最低工資要工作幾小時才脫貧', en: 'Hours on minimum wage to escape poverty' },
      description: {
        zh: '沒有工作、申請最低生活保障的單親帶兩個小孩，找到最低工資的工作後一週要工作幾小時，家庭所得才高過貧窮線（OECD TaxBEN 的模型家庭，不含住宅補貼）。2025 年美國 80 小時、馬爾他 71、捷克與斯洛維尼亞 62、賽普勒斯 51；英國 12、盧森堡 8、南韓 7；日本與立陶宛是 0（光靠給付就在貧窮線以上）。工作時數超過全職（約 40 小時）表示光靠最低工資的工作脫離不了貧窮。',
        en: 'For a jobless single parent with two children claiming minimum-income benefits, the weekly hours of minimum-wage work needed to lift the family above the poverty line (OECD TaxBEN model family, excluding housing benefits). In 2025 the US needed 80 hours, Malta 71, Czechia and Slovenia 62 and Cyprus 51; the UK 12, Luxembourg 8 and South Korea 7; Japan and Lithuania 0 (benefits alone keep the family above the line). Anything above full time (about 40 hours) means a minimum-wage job alone cannot lift the family out of poverty.',
      },
      unit: { zh: '小時／週', en: 'hours/week' },
      file: 'hours-out-of-poverty.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 10, 20, 30, 40, 60] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 小時`, en: `${fixed(v, 0)} h` }),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
