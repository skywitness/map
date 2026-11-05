import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 航運與港口的擴充：商船隊的平均船齡、船舶在港時間（2026-11-05，製作手冊第二十三批 401；pipeline/topics/shipping_efficiency.py）。
 * UNCTADstat US.MerchantFleet 的艘數與平均船齡（只畫 100 艘以上的經濟體）、US.PortCalls 的在港時間中位數。
 * 世界銀行的貨櫃港效率指數（CPPI）要 World Port Index 的港口座標，NGA 的網站下載不到，使用者 2026-11-05 決定不做。
 */

const days = (v: number) => tr({ zh: `${fixed(v, 2)} 天（約 ${fixed(v * 24, 0)} 小時）`, en: `${fixed(v, 2)} days (about ${fixed(v * 24, 0)} hours)` });

export const shippingEfficiencyPart: TopicPart = {
  name: { zh: '船齡與在港時間', en: 'Ship age and time in port' },
  sources: [
    {
      name: { zh: 'UNCTADstat：商船隊（US.MerchantFleet，艘數與平均船齡）、港口停靠（US.PortCalls，在港時間中位數）', en: 'UNCTADstat: merchant fleet (US.MerchantFleet, number of ships and average age), port calls (US.PortCalls, median time in port)' },
      url: 'https://unctadstat.unctad.org/datacentre/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '平均船齡是 UNCTAD 依艘數的簡單平均（100 總噸以上的商船，每年 1 月 1 日），幾艘老拖船、渡輪就能拉高小國的平均，所以只畫那一年 100 艘以上的經濟體。在港時間是 UNCTAD 用船舶自動識別系統（AIS）算的中位數，只公布 18 個經濟體。',
    en: 'Average age is UNCTAD’s simple average over ships (merchant ships of 100 GT and above, as of 1 January); a few old tugs or ferries can raise a small fleet’s average, so only economies with 100 ships or more that year are shaded. Time in port is UNCTAD’s median from ship tracking (AIS), published for 18 economies only.',
  },
  panelExtra: () => import('./panels/ShipAgePanel'),
  indicators: [
    {
      id: 'ship-age',
      label: { zh: '商船隊的平均船齡（船旗國）', en: 'Average age of the fleet (by flag)' },
      description: {
        zh: '掛這個國家國旗的商船平均幾年（UNCTAD，100 總噸以上，每年 1 月 1 日，依艘數平均），只畫 100 艘以上的經濟體。2026 年全世界 115,649 艘、平均 22.4 年；最新的是新加坡 11.3 年、馬紹爾群島 11.7、賴比瑞亞 12.7、曼島 12.8、馬爾他 14.1、香港 14.2、中國 14.5；最老的是宏都拉斯 53.5、瑞典 48.1、烏克蘭 43.6、芬蘭 42.8、羅馬尼亞 42.2 年。台灣 466 艘、平均 26.5 年，其中貨櫃船 52 艘、14.2 年。點國家看各船種的艘數與船齡。',
        en: 'Average age of merchant ships flying each country’s flag (UNCTAD; 100 GT and above, as of 1 January, averaged over ships), shaded only for economies with 100 ships or more. In 2026 the world fleet was 115,649 ships averaging 22.4 years. The youngest are Singapore at 11.3 years, the Marshall Islands 11.7, Liberia 12.7, the Isle of Man 12.8, Malta 14.1, Hong Kong 14.2 and China 14.5; the oldest are Honduras 53.5, Sweden 48.1, Ukraine 43.6, Finland 42.8 and Romania 42.2. Taiwan has 466 ships averaging 26.5 years, including 52 container ships averaging 14.2. Select a country to see ships and ages by type.',
      },
      unit: { zh: '年', en: 'years' },
      file: 'ship-age.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [15, 20, 25, 30, 35] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 年`, en: `${fixed(v, 1)} years` }),
      formatTick: (v) => fixed(v, 0),
      defaultYear: 'latest',
    },
    {
      id: 'port-time',
      label: { zh: '船舶在港時間', en: 'Time ships spend in port' },
      description: {
        zh: '船在這個經濟體的港口停留時間的中位數（UNCTAD 用船舶自動識別系統的軌跡算，所有船型，2018–2023 年），越短表示裝卸越快。只有 18 個經濟體（沒有台灣）。2023 年：日本 0.41 天（約 10 小時）最短，荷蘭 0.54、加拿大 0.57、德國 0.64、新加坡 0.73 天；俄羅斯 1.55、澳洲 1.54、克羅埃西亞 1.31、義大利 1.28 天最長；全世界 0.99 天。各地停靠的船型組成不同，也會影響。',
        en: 'Median time ships spend in port in each economy (UNCTAD, computed from ship-tracking AIS data, all ship types, 2018–2023); shorter means faster turnaround. Only 18 economies are covered (not Taiwan). In 2023 Japan was shortest at 0.41 days (about 10 hours), then the Netherlands 0.54, Canada 0.57, Germany 0.64 and Singapore 0.73; Russia 1.55, Australia 1.54, Croatia 1.31 and Italy 1.28 were longest; the world median was 0.99 days. The mix of ship types calling at each place also matters.',
      },
      unit: { zh: '天', en: 'days' },
      file: 'port-time.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.6, 0.8, 1, 1.3] } },
      format: days,
      formatTick: (v) => fixed(v, 1),
      defaultYear: 'latest',
      missing: { zh: 'UNCTAD 沒有公布', en: 'Not published by UNCTAD' },
    },
  ],
};
