import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { FlowDirection, FlowLabels, TopicDefinition } from './types';

/**
 * 歐洲路上的外國卡車：cabotage（新主題，2026-11-07，製作手冊第二十七批 578，候選 1294；pipeline/topics/cabotage.py）。
 * Eurostat 的 cabotage（外國卡車在另一國境內做的國內運輸），流向圖：在這國境內做的是哪些國籍的卡車、這國的卡車在哪些國家做。
 */

const mtkm = (v: number) => tr({ zh: `${fixed(v, v < 10 ? 1 : 0)} 百萬延噸公里`, en: `${fixed(v, v < 10 ? 1 : 0)} million tonne-km` });

const LABELS: Record<FlowDirection, FlowLabels> = {
  export: {
    partners: { zh: '這國的卡車在哪些國家做 cabotage', en: 'where its lorries do cabotage' },
    main: { zh: '這國的卡車主要在', en: 'Where its lorries do cabotage' },
    verb: (origin, partner) => tr({ zh: `${origin}的卡車在${partner}境內`, en: `${origin} lorries in ${partner}` }),
  },
  import: {
    partners: { zh: '在這國境內做 cabotage 的卡車國籍', en: 'whose lorries do cabotage here' },
    main: { zh: '在這國境內做 cabotage 的主要是', en: 'Lorries doing cabotage here' },
    verb: (origin, partner) => tr({ zh: `${partner}的卡車在${origin}境內`, en: `${partner} lorries in ${origin}` }),
  },
};

const NOTE: Text = {
  zh: 'cabotage 是外國的卡車在另一國境內做的國內運輸（例如波蘭的卡車在德國境內從漢堡運到慕尼黑），歐盟規定每次跨國運輸後 7 天內最多做 3 趟。資料是 Eurostat 的公路貨運調查（road_go_ca_c、road_go_ca_hac，百萬延噸公里，1999 年起），由卡車登記國申報，只有 35 個申報國（都在歐洲）；跨國運輸是另一組資料，不在這裡。英國照網站的規則不畫（英國境內 2025 年 1,469 百萬延噸公里）。台灣沒有陸路的跨國運輸。',
  en: 'Cabotage is domestic haulage done by a foreign lorry inside another country (for example a Polish lorry carrying goods from Hamburg to Munich); EU rules allow up to three such trips within seven days of an international delivery. Data are Eurostat’s road freight survey (road_go_ca_c, road_go_ca_hac, million tonne-km, from 1999), reported by the country where the lorry is registered; only 35 countries report, all in Europe, and international haulage is a separate dataset not included here. The UK is not shown by the site’s rule (1,469 million tonne-km inside the UK in 2025). Taiwan has no cross-border road transport.',
};

export const cabotage: TopicDefinition = {
  id: 'cabotage',
  title: { zh: '歐洲路上的外國卡車：cabotage', en: 'Foreign lorries on Europe’s roads: cabotage' },
  shortTitle: { zh: '外國卡車', en: 'Cabotage' },
  defaultIndicator: 'cabotage-in',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'Eurostat：依發生國的 cabotage（road_go_ca_c）、依申報國與發生國（road_go_ca_hac）',
        en: 'Eurostat: cabotage by country in which it takes place (road_go_ca_c) and by reporting and host country (road_go_ca_hac)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/road_go_ca_hac/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: NOTE,
  indicators: [
    {
      id: 'cabotage-in',
      label: { zh: '在這國境內的外國卡車', en: 'Cabotage by foreign lorries in the country' },
      description: {
        zh: '外國卡車在這國境內做的國內運輸（百萬延噸公里）；點國家畫出是哪些國籍的卡車。德國 1999 年 2,537 → 2025 年 25,946（10 倍），法國 1,488 → 10,518、義大利 933 → 2,938、西班牙 537 → 1,914、比利時 419 → 1,566、瑞典 257 → 1,307、荷蘭 171 → 1,194、奧地利 142 → 1,158、挪威 12 → 532。2025 年在德國境內申報的 25,923 裡，波蘭的卡車占 16,410（63%），立陶宛 3,144、捷克 1,074、羅馬尼亞 1,039、荷蘭 944、匈牙利 460、斯洛維尼亞 451：歐洲的公路貨運越來越由東歐的卡車在跑。',
        en: 'Domestic haulage by foreign lorries inside the country (million tonne-km); select a country to draw whose lorries they are. Germany went from 2,537 in 1999 to 25,946 in 2025 (ten times), France from 1,488 to 10,518, Italy 933 to 2,938, Spain 537 to 1,914, Belgium 419 to 1,566, Sweden 257 to 1,307, the Netherlands 171 to 1,194, Austria 142 to 1,158 and Norway 12 to 532. Of the 25,923 reported inside Germany in 2025, Polish lorries did 16,410 (63%), then Lithuania 3,144, Czechia 1,074, Romania 1,039, the Netherlands 944, Hungary 460 and Slovenia 451: Europe’s road freight is increasingly carried by lorries from the east.',
      },
      unit: { zh: '百萬延噸公里', en: 'million tonne-km' },
      file: 'cabotage-in.json',
      layer: {
        kind: 'flow',
        file: 'flows/{year}.json',
        direction: 'import',
        labels: LABELS,
        legendKey: { zh: '由卡車的國籍（淺）到做 cabotage 的國家（深）', en: 'From the lorry’s country (light) to the host country (dark)' },
      },
      format: mtkm,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'cabotage-out',
      label: { zh: '這國的卡車在外國', en: 'Cabotage by the country’s lorries abroad' },
      description: {
        zh: '這國登記的卡車在其他國家境內做的國內運輸（百萬延噸公里）；點國家畫出在哪些國家。2025 年波蘭的卡車 21,655 最多，立陶宛 7,916、羅馬尼亞 3,060、西班牙 2,256、荷蘭 1,636、捷克 1,586、德國 1,378、盧森堡 1,124。',
        en: 'Domestic haulage by the country’s registered lorries inside other countries (million tonne-km); select a country to draw where. In 2025 Polish lorries did the most, 21,655, then Lithuania 7,916, Romania 3,060, Spain 2,256, the Netherlands 1,636, Czechia 1,586, Germany 1,378 and Luxembourg 1,124.',
      },
      unit: { zh: '百萬延噸公里', en: 'million tonne-km' },
      file: 'cabotage-out.json',
      layer: {
        kind: 'flow',
        file: 'flows/{year}.json',
        direction: 'export',
        labels: LABELS,
        legendKey: { zh: '由卡車的國籍（淺）到做 cabotage 的國家（深）', en: 'From the lorry’s country (light) to the host country (dark)' },
      },
      format: mtkm,
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
