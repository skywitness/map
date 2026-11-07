import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 供電可靠度：平均停電時間與次數（新主題，2026-11-07，製作手冊第二十七批 610，候選 1339；能源・電力）：
 * 經濟部能源署整理的國際比較（歐洲 29 國 2008–2013、台灣 2008–2015），pipeline/topics/power_reliability.py。
 */
const OPEN_DATA_TW = { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' };

export const powerReliability: TopicDefinition = {
  id: 'power-reliability',
  title: { zh: '供電可靠度：平均停電時間與次數', en: 'Power supply reliability: outage duration and frequency' },
  shortTitle: { zh: '供電可靠度', en: 'Power reliability' },
  defaultIndicator: 'saidi',
  defaultYear: 2013,
  sources: [
    {
      name: { zh: '經濟部能源署：電力系統可靠度資料統計（data.gov.tw 25549）', en: 'Energy Administration, Ministry of Economic Affairs (Taiwan): power system reliability statistics (data.gov.tw 25549)' },
      url: 'https://data.gov.tw/dataset/25549',
      license: OPEN_DATA_TW,
    },
  ],
  note: {
    zh: 'SAIDI 是一年裡平均每一戶停電幾分鐘，SAIFI 是平均停電幾次，數字越小越可靠。資料是經濟部能源署整理的國際比較：歐洲 29 國 2008–2013 年、台灣 2008–2015 年，沒有更新；其他國家沒有資料。各國電業的口徑不同（例如颱風、地震這類天災造成的停電有的算、有的不算，計畫性停電也不一定算），跨國比較只能看大概。',
    en: 'SAIDI is the average number of minutes each customer is without power in a year; SAIFI is the average number of interruptions. Lower is more reliable. The data are an international comparison compiled by Taiwan’s Energy Administration: 29 European countries for 2008–2013 and Taiwan for 2008–2015, not updated since; no other countries are covered. Utilities measure differently (outages from natural disasters such as typhoons or earthquakes, and planned outages, may or may not be included), so cross-country comparisons are only rough.',
  },
  indicators: [
    {
      id: 'saidi',
      label: { zh: '每戶一年平均停電時間（SAIDI）', en: 'Average outage minutes per customer (SAIDI)' },
      description: {
        zh: '一年裡平均每一戶停電幾分鐘。2008 年台灣 20.81 分鐘最少，丹麥 25.24、荷蘭 26.23、德國 30.13；羅馬尼亞 1,081 分鐘最多，克羅埃西亞 743.6、愛沙尼亞 600.6、波蘭 506.7。2013 年盧森堡 10.6 分鐘、台灣 18.086、丹麥 20.56；拉脫維亞 621 最多。台灣 2015 年 16.268 分鐘。',
        en: 'Average minutes without power per customer in a year. In 2008 Taiwan had the fewest at 20.81 minutes, then Denmark 25.24, the Netherlands 26.23 and Germany 30.13; Romania had the most at 1,081, then Croatia 743.6, Estonia 600.6 and Poland 506.7. In 2013 Luxembourg had 10.6 minutes, Taiwan 18.086 and Denmark 20.56, with Latvia highest at 621. Taiwan had 16.268 minutes in 2015.',
      },
      unit: { zh: '分鐘', en: 'minutes' },
      file: 'saidi.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 50, 100, 200, 400] } },
      format: (v) => tr({ zh: `${fixed(v, v < 100 ? 1 : 0)} 分鐘`, en: `${fixed(v, v < 100 ? 1 : 0)} min` }),
      formatTick: (v) => fixed(v, 0),
      lowerIsBetter: true,
      missing: { zh: '能源署的整理沒有這一國', en: 'Not in the Energy Administration’s compilation' },
    },
    {
      id: 'saifi',
      label: { zh: '每戶一年平均停電次數（SAIFI）', en: 'Average interruptions per customer (SAIFI)' },
      description: {
        zh: '一年裡平均每一戶停電幾次。2008 年荷蘭 0.34 次、台灣 0.354、德國 0.43、丹麥 0.48；羅馬尼亞 8.5 次最多，愛沙尼亞 5.87、克羅埃西亞 5.53。2013 年盧森堡 0.19、台灣 0.264、荷蘭 0.33；馬爾他 4.76 次最多。台灣 2015 年 0.22 次。',
        en: 'Average number of interruptions per customer in a year. In 2008 the Netherlands had 0.34, Taiwan 0.354, Germany 0.43 and Denmark 0.48; Romania had the most at 8.5, then Estonia 5.87 and Croatia 5.53. In 2013 Luxembourg had 0.19, Taiwan 0.264 and the Netherlands 0.33, with Malta highest at 4.76. Taiwan had 0.22 in 2015.',
      },
      unit: { zh: '次', en: 'interruptions' },
      file: 'saifi.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 1.5, 2.5, 4] } },
      format: (v) => tr({ zh: `${fixed(v, 2)} 次`, en: fixed(v, 2) }),
      formatTick: (v) => fixed(v, 1),
      lowerIsBetter: true,
      missing: { zh: '能源署的整理沒有這一國', en: 'Not in the Energy Administration’s compilation' },
    },
  ],
};
