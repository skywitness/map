import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 網路速度的擴充：都會區之間的網速差距（2026-11-07，製作手冊第二十七批 591，候選 1312；pipeline/topics/metro_speed.py）：
 * OECD 的功能性都會區（FUA）網速，數值是「相對全國平均的百分比」，所以只能做同一國之內的比較：最快 ÷ 最慢，
 * 側欄 panels/MetroSpeedPanel.tsx 列最快與最慢各 5 個。都會區沒有座標，沒有點圖層。
 */
export const metroSpeedPart: TopicPart = {
  name: { zh: '都會區之間的網速差距', en: 'Speed gaps between metro areas' },
  sources: [
    {
      name: { zh: 'OECD：Internet speed – Cities and FUAs（DF_INTERNET_SPEED，原始資料是 Ookla）', en: 'OECD: Internet speed – Cities and FUAs (DF_INTERNET_SPEED, based on Ookla data)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_FUA_DIGI%40DF_INTERNET_SPEED&df[ag]=OECD.CFE.EDS',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: 'OECD 把 Ookla 的測速彙總到各國的功能性都會區（城市加通勤圈），公布的是「比全國平均快或慢幾 %」，不是速度本身，所以只能比同一國的都會區；最快 ÷ 最慢的都會區，至少 5 個都會區的國家才算。OECD 的分區不含台灣。',
    en: 'The OECD aggregates Ookla speed tests to each country’s functional urban areas (cities plus commuting zones) and publishes how much faster or slower each is than the national average, not the speeds themselves, so only areas within one country can be compared; the gap is fastest ÷ slowest, for countries with at least 5 areas. Taiwan is not covered.',
  },
  panelExtra: () => import('./panels/MetroSpeedPanel'),
  indicators: [
    {
      id: 'metro-gap',
      label: { zh: '最快的都會區比最慢的快幾倍', en: 'speed gap between metro areas (fastest ÷ slowest)' },
      description: {
        zh: '同一國裡下載速度最快的都會區比最慢的快幾倍（OECD，2019–2025；子項目是固網與行動網路）。2025 年固網：哥倫比亞 7.33 倍（麥德林比全國平均快 32.7%、圖馬科慢 81.9%）、法國 4.75（海外省馬約特的馬穆楚慢 72.8%）、希臘 3.08、墨西哥 2.77、義大利 2.21、日本 1.99、德國 1.94、美國 1.76；最平均的是立陶宛 1.18、瑞士 1.19、荷蘭 1.24、澳洲與芬蘭 1.25、南韓 1.26。行動網路：哥倫比亞 6.00、墨西哥 5.25、英國 3.76；奧地利 1.19 最平均。點國家看最快與最慢的都會區。',
        en: 'How many times faster the fastest metro area’s download speed is than the slowest within the same country (OECD, 2019–2025; sub-items are fixed and mobile). Fixed broadband in 2025: Colombia 7.33 (Medellín 32.7% above the national average, Tumaco 81.9% below), France 4.75 (Mamoudzou in overseas Mayotte 72.8% below), Greece 3.08, Mexico 2.77, Italy 2.21, Japan 1.99, Germany 1.94 and the US 1.76; the most even are Lithuania 1.18, Switzerland 1.19, the Netherlands 1.24, Australia and Finland 1.25 and South Korea 1.26. Mobile: Colombia 6.00, Mexico 5.25, the UK 3.76; Austria is the most even at 1.19. Click a country for its fastest and slowest areas.',
      },
      unit: { zh: '倍', en: '×' },
      file: 'metro-gap/{item}.json',
      dimension: {
        label: { zh: '網路', en: 'Network' },
        options: [
          { id: 'fixed', label: { zh: '固網', en: 'Fixed broadband' } },
          { id: 'mobile', label: { zh: '行動網路', en: 'Mobile' } },
        ],
        defaultOption: 'fixed',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1.3, 1.6, 2, 3, 5] } },
      format: (v) => tr({ zh: `${fixed(v, 2)} 倍`, en: `${fixed(v, 2)}×` }),
      formatTick: (v) => fixed(v, 1),
      lowerIsBetter: true,
      missing: { zh: 'OECD 沒有這一國的都會區資料（或不到 5 個）', en: 'No OECD metro-area data for this country (or fewer than 5 areas)' },
    },
  ],
};
