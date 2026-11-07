import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 海運旅客：渡輪、郵輪與國內客船（2026-11-07，製作手冊第二十七批 581，候選 1299；pipeline/topics/sea_passengers.py）：
 * 擴充「航運與港口」。Eurostat 的海運旅客與郵輪靠港艘次；台灣用臺灣港務公司的國際商港旅客人數。
 */
export const SEA_PASSENGER_IDS = ['sea-passengers', 'cruise-calls'];

export const seaPassengersPart: TopicPart = {
  name: { zh: '海運旅客', en: 'Sea passengers' },
  sources: [
    {
      name: {
        zh: 'Eurostat：海運旅客（mar_mp_aa_cphd）、靠港船舶依船種（mar_mt_am_csvi，郵輪）',
        en: 'Eurostat: seaborne passengers (mar_mp_aa_cphd), vessels in main ports by type (mar_mt_am_csvi, cruise ships)',
      },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/mar_mp_aa_cphd/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '臺灣港務公司「臺灣地區國際商港旅客人數」（政府資料開放平臺 8366）', en: 'Taiwan International Ports Corporation, passengers at international commercial ports (data.gov.tw 8366)' },
      url: 'https://data.gov.tw/dataset/8366',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  panelExtra: () => import('./panels/SeaPassengersPanel'),
  indicators: [
    {
      id: 'sea-passengers',
      label: { zh: '海運旅客', en: 'Sea passengers' },
      description: {
        zh: '一年裡在這國港口上船加下船的旅客（千人次，Eurostat，1997–2024；渡輪、郵輪、國內客船都算）。上船、下船各算一次，同一個人會算兩次。2024 年歐盟 27 國 417,845 千人次：義大利 93,496、希臘 81,071、丹麥 41,317、西班牙 35,757、克羅埃西亞 34,749、德國 28,322、瑞典 24,815、法國 23,833、馬爾他 15,621，都是島嶼多、渡輪多的國家。英國照網站的規則不畫。台灣用港務公司國際商港的旅客人次（也是進出港合計），2025 年 1,370 千人次，其中郵輪母港 832,247、掛靠港 308,314、國內客船 229,512 人次；點台灣看各類。',
        en: 'Passengers embarking plus disembarking at the country’s ports in a year (thousands, Eurostat, 1997–2024; ferries, cruises and domestic boats all count). Each embarkation and disembarkation counts, so one person is counted twice. The EU-27 had 417,845 thousand in 2024: Italy 93,496, Greece 81,071, Denmark 41,317, Spain 35,757, Croatia 34,749, Germany 28,322, Sweden 24,815, France 23,833 and Malta 15,621, all countries of islands and ferries. The UK is not shown by the site’s rule. Taiwan uses passengers at its international commercial ports (also arrivals plus departures): 1,370 thousand in 2025, including 832,247 cruise home-port, 308,314 cruise port-of-call and 229,512 domestic passengers; click Taiwan for each kind.',
      },
      unit: { zh: '千人次', en: 'thousand' },
      file: 'sea-passengers.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${formatLargeNumber(v * 1000)} 人次`, en: formatLargeNumber(v * 1000) }),
      formatTick: (v) => formatLargeTick(v * 1000),
      defaultYear: 2024,
    },
    {
      id: 'cruise-calls',
      label: { zh: '郵輪靠港艘次', en: 'Cruise ship calls' },
      description: {
        zh: '一年裡郵輪在這國主要港口靠港幾艘次（Eurostat，靠港船舶的郵輪類，1997–2024）。2024 年歐盟 27 國 21,923 艘次：義大利 4,860、希臘 4,856、西班牙 4,754、法國 1,844，挪威 1,808。台灣用港務公司的郵輪母港加掛靠港艘次（2025 年 555 艘次）。跟「郵輪（船旗國）」不同：那是船掛哪國的旗，這裡是郵輪停靠哪裡。',
        en: 'Cruise ship calls at the country’s main ports in a year (Eurostat, cruise ships among vessels in port, 1997–2024). The EU-27 had 21,923 in 2024: Italy 4,860, Greece 4,856, Spain 4,754 and France 1,844, with Norway at 1,808. Taiwan uses its port corporation’s cruise home-port plus port-of-call calls (555 in 2025). This differs from “Cruise ships (flag state)”: that is the flag a ship flies, this is where cruise ships call.',
      },
      unit: { zh: '艘次', en: 'calls' },
      file: 'cruise-calls.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${fixed(v, 0)} 艘次`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      defaultYear: 2024,
    },
  ],
};
