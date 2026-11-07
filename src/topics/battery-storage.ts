import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import type { TopicPart } from './parts';

/**
 * 發電廠地圖的擴充：電池儲能，裝了多少 MW、能存幾度（2026-11-07，製作手冊第二十七批 612，候選 1342；
 * pipeline/topics/battery_storage.py，資料在 public/data/topics/power-plants/）：Eurostat 的電池容量申報，只有歐洲。
 */
export const batteryStoragePart: TopicPart = {
  name: { zh: '電池儲能', en: 'Battery storage' },
  sources: [
    {
      name: { zh: 'Eurostat：電池的功率與儲電容量（nrg_inf_bt）', en: 'Eurostat: battery power capacity and energy storage (nrg_inf_bt)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_inf_bt/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '電池儲能是 Eurostat 的申報，只有歐洲，2020 年起才有；功率（MW）與儲電量（MWh）的申報國不完全一樣，不含電動車與大部分家用小電池。能撐幾小時＝儲電量 ÷ 功率，功率至少 10 MW 的國家才算。',
    en: 'Battery storage comes from Eurostat returns, Europe only, from 2020; countries reporting power (MW) and storage (MWh) differ slightly, and electric vehicles and most small home batteries are excluded. Hours of storage = storage ÷ power, for countries with at least 10 MW.',
  },
  indicators: [
    {
      id: 'battery-power',
      label: { zh: '電池儲能的功率', en: 'Battery storage power capacity' },
      description: {
        zh: '併網電池儲能的功率（MW，同時能放出多少電）。2024 年申報的歐洲國家合計 9,920 MW：義大利 5,614 MW（13,311 MWh），一國超過一半；法國 1,089、德國 755、愛爾蘭 754、瑞典 552、荷蘭 350、波蘭 272、比利時 256。2020 年合計只有 120 MW。',
        en: 'Power capacity of grid batteries (MW, how much they can discharge at once). In 2024 the reporting European countries had 9,920 MW in all: Italy 5,614 MW (13,311 MWh), over half on its own, then France 1,089, Germany 755, Ireland 754, Sweden 552, the Netherlands 350, Poland 272 and Belgium 256. The total was only 120 MW in 2020.',
      },
      unit: 'MW',
      file: 'battery-power.json',
      layer: { kind: 'bubble', legendValues: [50, 500, 5000] },
      format: (v) => `${fixed(v, 0)} MW`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      missing: { zh: '沒有申報（只有歐洲）', en: 'Not reported (Europe only)' },
    },
    {
      id: 'battery-hours',
      label: { zh: '電池能撐幾小時', en: 'Hours of battery storage' },
      description: {
        zh: '電池的儲電量除以功率：全力放電能撐幾小時。2024 年比利時 2.9 小時、波蘭 2.5、義大利 2.4、西班牙 2.2；德國、法國 1.0 小時。',
        en: 'Battery storage divided by power: how many hours they can discharge at full power. In 2024 Belgium 2.9 hours, Poland 2.5, Italy 2.4 and Spain 2.2; Germany and France 1.0 hour.',
      },
      unit: { zh: '小時', en: 'hours' },
      file: 'battery-hours.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1.1, 1.5, 2, 2.5] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 小時`, en: `${fixed(v, 1)} hours` }),
      formatTick: (v) => fixed(v, 1),
      missing: { zh: '沒有申報或功率不到 10 MW', en: 'Not reported or under 10 MW' },
    },
  ],
};
