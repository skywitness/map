import { fixed } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 石油、天然氣與煤的擴充：燃料進口花掉多少外匯（2026-11-08，製作手冊第二十七批 629，候選 1370；
 * pipeline/topics/fuel_trade.py，資料在 public/data/topics/fossil-fuels/fuel-trade-share/）：WDI 的燃料進出口占比，台灣用 Harvard Atlas。
 */
export const fuelTradePart: TopicPart = {
  name: { zh: '燃料進出口占商品貿易', en: 'Fuel share of merchandise trade' },
  sources: [
    {
      name: { zh: '世界銀行 WDI：燃料進口、出口占商品進出口（TM.VAL.FUEL.ZS.UN、TX.VAL.FUEL.ZS.UN）', en: 'World Bank WDI: fuel imports and exports, % of merchandise trade (TM.VAL.FUEL.ZS.UN, TX.VAL.FUEL.ZS.UN)' },
      url: 'https://data.worldbank.org/indicator/TM.VAL.FUEL.ZS.UN',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Harvard Growth Lab：Atlas of Economic Complexity，SITC 一位碼進出口（台灣）', en: 'Harvard Growth Lab, Atlas of Economic Complexity: trade by SITC section (Taiwan)' },
      url: 'https://doi.org/10.7910/DVN/H8SFD2',
      license: 'CC0 1.0',
    },
  ],
  note: {
    zh: '燃料是國際貿易標準分類（SITC）第 3 類礦物燃料（原油、成品油、天然氣、煤、電）。分母是商品進出口，不含服務貿易，所以服務業大的經濟體（香港）比例偏低；轉口與煉油樞紐（新加坡、荷蘭）進出口都高。台灣不在世界銀行的資料裡，用 Harvard Atlas 的同一類算。',
    en: 'Fuel means SITC section 3, mineral fuels (crude oil, petroleum products, gas, coal and electricity). The denominator is merchandise trade, excluding services, so service-heavy economies such as Hong Kong look low; re-export and refining hubs such as Singapore and the Netherlands are high on both sides. Taiwan is not in the World Bank data and uses the same section from the Harvard Atlas.',
  },
  indicators: [
    {
      id: 'fuel-trade-share',
      label: { zh: '燃料進出口占商品貿易的比例', en: 'Fuel as a share of merchandise trade' },
      description: {
        zh: '燃料進口占商品進口（或燃料出口占商品出口）的 %，1962 年起（子項目是進口、出口）。2023 年進口：汶萊 63.8%、維德角 46.6%、布吉納法索 39.6%、巴基斯坦 33.5%、奈及利亞 33.4%、印度 33.2% 最高；南韓 26.7%、日本 24.9%、中國 21.0%、新加坡 20.7%、台灣 13.7%、德國 8.5%、美國 8.4%，世界 14.0%；科威特 0.6%、伊朗 1.7%、香港 2.2% 最低。出口：伊拉克 99.4%、科威特 95.5%、安哥拉 94.1%、奈及利亞 91.6%、沙烏地 81.3%、挪威 68.4%。拉時間軸看兩次石油危機：台灣的燃料進口占比 1974 年 21.0%、1981 年 25.2%。',
        en: 'Fuel imports as a share of merchandise imports (or fuel exports as a share of merchandise exports), from 1962 (sub-items are imports and exports). In 2023 imports were highest in Brunei (63.8%), Cabo Verde (46.6%), Burkina Faso (39.6%), Pakistan (33.5%), Nigeria (33.4%) and India (33.2%); South Korea 26.7%, Japan 24.9%, China 21.0%, Singapore 20.7%, Taiwan 13.7%, Germany 8.5% and the US 8.4%, against a world figure of 14.0%; lowest were Kuwait (0.6%), Iran (1.7%) and Hong Kong (2.2%). Exports: Iraq 99.4%, Kuwait 95.5%, Angola 94.1%, Nigeria 91.6%, Saudi Arabia 81.3% and Norway 68.4%. Move the time slider to see the two oil shocks: Taiwan’s fuel import share was 21.0% in 1974 and 25.2% in 1981.',
      },
      unit: '%',
      file: 'fuel-trade-share/{item}.json',
      dimension: {
        label: { zh: '方向', en: 'Direction' },
        options: [
          { id: 'import', label: { zh: '燃料進口占商品進口', en: 'Fuel imports, % of merchandise imports' } },
          { id: 'export', label: { zh: '燃料出口占商品出口', en: 'Fuel exports, % of merchandise exports' } },
        ],
        defaultOption: 'import',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 50] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
      compareWorld: true,
      defaultYear: 2023,
      missing: { zh: '世界銀行沒有這一年', en: 'No World Bank data for this year' },
    },
  ],
};
