import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { monthShort, monthText } from './reads';
import type { IndicatorDef, SourceDef } from './types';

/**
 * 每個月飛了幾班：航班架次與 COVID（2026-11-07，製作手冊第二十七批 571，候選 1288；pipeline/topics/airport_flights.py）：
 * 擴充「機場與旅客」。Eurostat 各申報國每月的商業航班架次（全部、定期、不定期）與比 2019 年同月；時間軸是月份。
 * 台灣用民航局的機場起降架次放側欄（口徑不同，不上色）。
 */
export const FLIGHT_IDS = ['flights', 'flights-vs-2019'];

const MONTH_AXIS = {
  label: { zh: '月份', en: 'Month' },
  year: monthText,
  tick: monthShort,
  // 2000 年 1 月起的第幾個月：24 的倍數是雙數年的 1 月
  tickStep: 24,
};

const ITEMS = [
  { id: 'all', label: { zh: '全部', en: 'All' } },
  { id: 'scheduled', label: { zh: '定期', en: 'Scheduled' } },
  { id: 'nonscheduled', label: { zh: '不定期', en: 'Non-scheduled' } },
];

export const aviationFlights: { sources: SourceDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: { zh: 'Eurostat：各申報國每月的商業航班（avia_tf_cm）', en: 'Eurostat: commercial flights by reporting country, monthly (avia_tf_cm)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/avia_tf_cm/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: '交通部民用航空局「民航運輸各機場營運量－按機場分」（data.gov.tw 31915；台灣的起降架次）',
        en: 'Taiwan Civil Aeronautics Administration, traffic by airport (data.gov.tw 31915; Taiwan’s aircraft movements)',
      },
      url: 'https://data.gov.tw/dataset/31915',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  indicators: [
    {
      id: 'flights',
      // 卡片與圖例的標題是子項目接指標名稱：「定期航班架次」
      label: { zh: '航班架次', en: 'Commercial flights' },
      description: {
        zh: '各國每個月的商業航班架次（Eurostat，2019 年 1 月起，只有歐洲各申報國），比例圓；可以切換全部、定期、不定期（商務機、貨機等）。COVID 讓 2020 年 4 月幾乎停飛：歐盟 27 國從 2019 年 4 月 581,335 架次掉到 51,124（−91.2%），德國 158,711 → 17,894、法國 120,860 → 7,052、西班牙 137,824 → 6,111、義大利 103,890 → 5,107，挪威還有 13,114（國內線多）。2026 年 9 月歐盟 27 國 667,622 架次（定期 608,844），比疫情前還多：西班牙 179,165、德國 151,461、義大利 140,786、法國 121,458、土耳其 120,229；希臘 69,420，2019 年 1 月只有 16,125，季節差很大。英國 2026 年 9 月 181,604 架次，照網站的規則不畫。台灣沒有這個口徑的資料，側欄列民航局的機場起降架次。',
        en: 'Commercial flights in each country by month (Eurostat, from January 2019, European reporting countries only), as bubbles; switch between all, scheduled and non-scheduled (business jets, freighters and so on). COVID almost grounded flying in April 2020: the EU-27 fell from 581,335 flights in April 2019 to 51,124 (−91.2%), Germany from 158,711 to 17,894, France from 120,860 to 7,052, Spain from 137,824 to 6,111 and Italy from 103,890 to 5,107, while Norway still had 13,114 (many domestic routes). In September 2026 the EU-27 had 667,622 flights (608,844 scheduled), more than before the pandemic: Spain 179,165, Germany 151,461, Italy 140,786, France 121,458 and Türkiye 120,229; Greece had 69,420, against only 16,125 in January 2019, a strong seasonal swing. The UK had 181,604 in September 2026 but is not shown by the site’s rule. Taiwan has no figures on this basis; the side panel lists aircraft movements from its Civil Aeronautics Administration.',
      },
      unit: { zh: '架次', en: 'flights' },
      file: 'flights/{item}.json',
      dimension: { label: { zh: '航班', en: 'Flights' }, options: ITEMS, defaultOption: 'all' },
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${fixed(v, 0)} 架次`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      timeAxis: MONTH_AXIS,
      defaultYear: 'latest',
    },
    {
      id: 'flights-vs-2019',
      label: { zh: '航班架次比 2019 年同月', en: 'Flights compared with the same month of 2019' },
      description: {
        zh: '每個月的商業航班架次（全部）比 2019 年同一個月多或少幾 %（Eurostat 算好的，2020 年 1 月起）。拖動時間軸看 2020 年 4 月整片深色（歐盟 27 國 −91.2%）、2021 年夏天開始回升，到 2026 年多數國家已經超過疫情前。台灣沒有這個口徑的資料，側欄列民航局的機場起降架次（2019 年 581,508 → 2021 年 267,458 → 2025 年 528,095）。',
        en: 'Commercial flights (all) each month compared with the same month of 2019, in % (as computed by Eurostat, from January 2020). Drag the time slider to see April 2020 almost uniformly dark (EU-27 −91.2%), the recovery from summer 2021, and most countries above pre-pandemic levels by 2026. Taiwan has no figures on this basis; the side panel lists aircraft movements from its Civil Aeronautics Administration (581,508 in 2019, 267,458 in 2021, 528,095 in 2025).',
      },
      unit: '%',
      file: 'flights-vs-2019.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-60, -30, -10, 10, 30, 60] } },
      format: (v) => `${v > 0 ? '+' : ''}${fixed(v, 1)}%`,
      formatTick: (v) => `${v > 0 ? '+' : ''}${v}%`,
      timeAxis: MONTH_AXIS,
      defaultYear: 'latest',
    },
  ],
};
