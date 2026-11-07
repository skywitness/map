import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 運輸與倉儲業的就業（新主題，2026-11-07，製作手冊第二十七批 585，候選 1305；交通的小類「交通政策與投資」）：
 * ILOSTAT 的 DF_EMP_TEMP_SEX_ECO_NB（ISIC 第 4 版 H 類），台灣用主計總處人力資源調查，pipeline/topics/transport_jobs.py。
 */
const NOTE = {
  zh: '各國最近一年不一樣（最多往前找 5 年）；台灣用主計總處的人力資源調查。',
  en: 'The latest year differs between countries (up to 5 years back); Taiwan uses the DGBAS Manpower Survey.',
};

export const transportJobs: TopicDefinition = {
  id: 'transport-jobs',
  title: { zh: '運輸與倉儲業的就業', en: 'Jobs in transport and storage' },
  shortTitle: { zh: '運輸業就業', en: 'Transport jobs' },
  defaultIndicator: 'transport-workers',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: '國際勞工組織 ILOSTAT：Employment by sex and economic activity（DF_EMP_TEMP_SEX_ECO_NB）', en: 'ILOSTAT: Employment by sex and economic activity (DF_EMP_TEMP_SEX_ECO_NB)' },
      url: 'https://ilostat.ilo.org/data/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '行政院主計總處：人力資源調查，就業者按行業分（A040103050）', en: 'DGBAS: Manpower Survey, employment by industry (A040103050)' },
      url: 'https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx?sys=100&funid=dgbasall',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '運輸與倉儲業是國際行業標準分類（ISIC 第 4 版）的 H 類：陸運（鐵路、公路客貨運、管線）、水運、空運、倉儲與運輸輔助（港口、機場、貨運代理），也包括郵政與快遞，不只是開車的人；自己公司的司機（例如零售業的送貨員）算在原本的行業。ILO 的資料大多來自各國的勞動力調查，少數是戶籍或企業普查，口徑有差。中國不在 ILO 的這份資料裡。',
    en: 'Transport and storage is section H of the International Standard Industrial Classification (ISIC Rev. 4): land transport (rail, road passenger and freight, pipelines), water and air transport, warehousing and support activities (ports, airports, freight forwarding), plus postal and courier services – not just drivers; drivers employed by firms in other industries (a retailer’s delivery staff, say) count in those industries. ILO figures mostly come from national labour force surveys, a few from censuses or establishment surveys, so coverage varies. China is not in this ILO dataset.',
  },
  indicators: [
    {
      id: 'transport-workers',
      label: { zh: '運輸與倉儲業的就業人數', en: 'People employed in transport and storage' },
      description: {
        zh: `在運輸與倉儲業工作的人數（ILO，2000 年起）。印度 2,191 萬（2025 年）最多，美國 1,067 萬、孟加拉 655 萬（2024 年）、俄羅斯 651 萬、印尼 605 萬（2024 年）、巴西 595 萬、巴基斯坦 455 萬、奈及利亞 419 萬、日本 372 萬（2023 年）、菲律賓 371 萬（2024 年）、墨西哥 299 萬、埃及 272 萬（2024 年）。台灣 2025 年 50.9 萬人（主計總處）。${NOTE.zh}`,
        en: `Number of people working in transport and storage (ILO, from 2000). India has the most at 21.91 million (2025), followed by the US 10.67 million, Bangladesh 6.55 million (2024), Russia 6.51 million, Indonesia 6.05 million (2024), Brazil 5.95 million, Pakistan 4.55 million, Nigeria 4.19 million, Japan 3.72 million (2023), the Philippines 3.71 million (2024), Mexico 2.99 million and Egypt 2.72 million (2024). Taiwan had 509,000 in 2025 (DGBAS). ${NOTE.en}`,
      },
      defaultYear: 'latest',
      unit: { zh: '人', en: 'people' },
      file: 'workers.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 人`, en: formatLargeNumber(v) }),
      formatTick: formatLargeTick,
      integer: true,
    },
    {
      id: 'transport-workers-share',
      label: { zh: '運輸與倉儲業占就業人數', en: 'Transport and storage, % of employment' },
      description: {
        zh: `就業的人裡在運輸與倉儲業工作的比例（ILO，同一年的運輸與倉儲業 ÷ 全部行業）。伊朗 10.0%（2024 年）、伊拉克 9.7%（2021 年）、孟加拉 9.5%（2024 年）、索馬利亞 9.3%（2022 年）、俄羅斯 8.9%、新加坡 8.8%、埃及 8.3%（2024 年）最高；美國 6.5%、南韓 5.9%、日本 5.5%（2023 年）、法國 4.9%、德國 4.8%、印度 4.6%；台灣 4.4%（2025 年）。最低的是蒲隆地 1.2%（2020 年）、衣索比亞 1.5%（2021 年）。${NOTE.zh}`,
        en: `Share of employed people working in transport and storage (ILO, same-year transport and storage divided by all industries). Iran 10.0% (2024), Iraq 9.7% (2021), Bangladesh 9.5% (2024), Somalia 9.3% (2022), Russia 8.9%, Singapore 8.8% and Egypt 8.3% (2024) are highest; the US 6.5%, South Korea 5.9%, Japan 5.5% (2023), France 4.9%, Germany 4.8% and India 4.6%; Taiwan 4.4% (2025). The lowest are Burundi 1.2% (2020) and Ethiopia 1.5% (2021). ${NOTE.en}`,
      },
      defaultYear: 'latest',
      unit: '%',
      file: 'share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 4, 5, 6, 8] } },
      format: (v) => `${fixed(v, 1)}%`,
    },
  ],
};
