import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 樂園業（新主題，2026-11-08，製作手冊第二十七批 633，候選 1374、1375；pipeline/topics/amusement_industry.py）：
 * Eurostat sbs_ovw_act 的 NACE R9321「遊樂園與主題樂園」的營業額、附加價值、家數、從業人數，OECD SDBS 補歐洲以外的幾國。
 * 手冊的陷阱：各國歸類差很多（法國把大量流動遊樂場算進來），營業額高不代表主題樂園大 → 說明寫明；「每家幾個人」最能分出
 * 大型主題樂園與小遊樂場。
 */
const meur = (v: number) => tr({ zh: `${fixed(v, v < 100 ? 1 : 0)} 百萬歐元`, en: `€${fixed(v, v < 100 ? 1 : 0)} million` });

export const amusementIndustry: TopicDefinition = {
  id: 'amusement-industry',
  title: { zh: '樂園業：營業額、家數與就業', en: 'The amusement park industry' },
  shortTitle: { zh: '樂園業', en: 'Park industry' },
  defaultIndicator: 'turnover',
  defaultYear: 2024,
  // 資料幾乎都在歐洲：打開時對著歐洲
  focus: [-25, 34, 45, 71],
  sources: [
    {
      name: { zh: 'Eurostat：企業統計 sbs_ovw_act（NACE R9321 遊樂園與主題樂園）', en: 'Eurostat: structural business statistics sbs_ovw_act (NACE R9321, amusement parks and theme parks)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/sbs_ovw_act/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'OECD：企業統計 SDBS（ISIC Rev. 4 R9321；南韓、英國、紐西蘭、哥斯大黎加、以色列）', en: 'OECD: structural business statistics SDBS (ISIC Rev. 4 R9321; Korea, UK, New Zealand, Costa Rica, Israel)' },
      url: 'https://data-explorer.oecd.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Eurostat：歐元匯率 ert_bil_eur_a（OECD 的本國貨幣換成歐元）', en: 'Eurostat: euro exchange rates ert_bil_eur_a (converting OECD figures to euros)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/ert_bil_eur_a/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '「遊樂園與主題樂園」這個行業（NACE R9321）在各國的範圍差很多：法國有 5,049 家、丹麥只有 188 家，法國把大量流動遊樂場、小型遊樂設施的業者也算進來，所以營業額或家數多，不代表主題樂園多或大。「每家幾個人」最能看出差別：瑞典、丹麥業者少、每家的人多，西班牙、波蘭、匈牙利每家平均只有一到三、四個人。從業人數含老闆與自營者，不是員工數。歐洲以外只有 OECD 的幾國，年份不齊（英國停在 2019 年），金額用當年的歐元年平均匯率換算。馬爾他、波蘭有幾年的數字是機密，沒有公布。台灣的統計只分到「娛樂及休閒服務業」，沒有遊樂園業。',
    en: 'What counts as “amusement parks and theme parks” (NACE R9321) varies widely between countries: France has 5,049 enterprises and Denmark only 188, because France includes many travelling fairground and small ride operators. A larger turnover or enterprise count therefore does not mean more or bigger theme parks. “People per enterprise” shows the difference best: Sweden and Denmark have few enterprises with many people each, while in Spain, Poland and Hungary the average is between one and about four people. Persons employed include owners and the self-employed. Outside Europe only a few OECD countries report, for different years (the UK stops in 2019); their figures are converted at that year’s average euro rate. Some figures for Malta and Poland are confidential. Taiwan’s statistics only go down to “amusement and recreation activities”, with no separate amusement park industry.',
  },
  indicators: [
    {
      id: 'turnover',
      label: { zh: '營業額', en: 'Turnover' },
      description: {
        zh: '遊樂園與主題樂園業一年的淨營業額（百萬歐元）。2024 年法國 5,663 百萬歐元最多，德國 2,971、荷蘭 1,249、西班牙 1,055、義大利 651、丹麥 519、比利時 504；南韓 2022 年約 1,258（OECD，韓元換算）、英國 2019 年約 1,119（OECD，英鎊換算）。',
        en: 'Annual net turnover of the amusement and theme park industry (€ million). In 2024 France had the most (€5,663 million), followed by Germany (2,971), the Netherlands (1,249), Spain (1,055), Italy (651), Denmark (519) and Belgium (504); Korea had about 1,258 in 2022 and the UK about 1,119 in 2019 (OECD, converted from won and pounds).',
      },
      unit: { zh: '百萬歐元', en: '€ million' },
      file: 'turnover.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 100, 250, 500, 1000, 2500] } },
      format: meur,
      formatTick: formatLargeTick,
    },
    {
      id: 'value-added',
      label: { zh: '附加價值', en: 'Value added' },
      description: {
        zh: '營業額扣掉買進的商品與服務，等於這個行業自己創造的價值（百萬歐元）。2024 年法國 1,986、德國 1,573、西班牙 643、荷蘭 618；南韓 2022 年約 440、英國 2019 年約 599（OECD 換算）。',
        en: 'Turnover minus purchased goods and services: the value the industry itself creates (€ million). In 2024 France had 1,986, Germany 1,573, Spain 643 and the Netherlands 618; Korea had about 440 in 2022 and the UK about 599 in 2019 (OECD, converted).',
      },
      unit: { zh: '百萬歐元', en: '€ million' },
      file: 'value-added.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 100, 250, 500, 1000] } },
      format: meur,
      formatTick: formatLargeTick,
    },
    {
      id: 'enterprises',
      label: { zh: '有幾家業者', en: 'Enterprises' },
      description: {
        zh: '遊樂園與主題樂園業的企業家數。2024 年法國 5,049 家、西班牙 3,708、德國 3,194、義大利 1,753、荷蘭 1,277、波蘭 1,071；家數多的國家多半是小型遊樂場與流動遊樂設施的業者，不是主題樂園多。',
        en: 'Number of enterprises in the amusement and theme park industry. In 2024 France had 5,049, Spain 3,708, Germany 3,194, Italy 1,753, the Netherlands 1,277 and Poland 1,071; countries with many enterprises mostly have many small fairground and ride operators, not more theme parks.',
      },
      unit: { zh: '家', en: 'enterprises' },
      file: 'enterprises.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 100, 250, 500, 1000, 2500] } },
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: `${fixed(v, 0)} enterprises` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'employed',
      label: { zh: '從業人數', en: 'Persons employed' },
      description: {
        zh: '在遊樂園與主題樂園業工作的人數（含老闆與自營者，季節工作也算）。2024 年德國 39,550 人最多，法國 31,890、荷蘭 14,119、西班牙 13,057、丹麥 6,850、義大利 6,671；南韓 2022 年 10,869 人（OECD）。',
        en: 'People working in the amusement and theme park industry (including owners, the self-employed and seasonal workers). In 2024 Germany had the most (39,550), followed by France (31,890), the Netherlands (14,119), Spain (13,057), Denmark (6,850) and Italy (6,671); Korea had 10,869 in 2022 (OECD).',
      },
      unit: { zh: '人', en: 'people' },
      file: 'employed.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [500, 1000, 2500, 5000, 10000, 25000] } },
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 人`, en: `${fixed(v, 0)} people` }),
      formatTick: formatLargeTick,
    },
    {
      id: 'size',
      label: { zh: '每家幾個人', en: 'People per enterprise' },
      description: {
        zh: '從業人數 ÷ 家數：數字大是少數大型樂園，數字小是很多小業者。瑞典 54.6 人最多，丹麥 36.4、芬蘭 26.2、挪威 19.6、德國 12.4、荷蘭 11.1；法國 6.3、西班牙 3.5，匈牙利、斯洛伐克只有 1.4。哥斯大黎加 30.9、紐西蘭 25.3 是 OECD 2022 年的數字。',
        en: 'Persons employed divided by the number of enterprises: a high number means a few large parks, a low one many small operators. Sweden has the most (54.6), followed by Denmark (36.4), Finland (26.2), Norway (19.6), Germany (12.4) and the Netherlands (11.1); France has 6.3, Spain 3.5, and Hungary and Slovakia only 1.4. Costa Rica (30.9) and New Zealand (25.3) are OECD figures for 2022.',
      },
      unit: { zh: '人/家', en: 'people per enterprise' },
      file: 'size.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 4, 8, 15, 25, 40] } },
      format: (v) => tr({ zh: `每家 ${fixed(v, 1)} 人`, en: `${fixed(v, 1)} per enterprise` }),
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
