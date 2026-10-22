import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { IndicatorDef, Text, TopicDefinition } from './types';

const PER_100 = { zh: '門/百人', en: 'per 100 people' };

function per100(id: string, label: Text, description: Text, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: PER_100,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: (v) => `${fixed(v, 1)} ${tr(PER_100)}`,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  };
}

const OPEN_DATA_TW = { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' };

export const digital: TopicDefinition = {
  id: 'digital',
  title: { zh: '各國網路與通訊普及', en: 'Internet and telecoms by country' },
  shortTitle: { zh: '數位', en: 'Digital' },
  defaultIndicator: 'internet-users',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'World Bank, World Development Indicators（ITU 資料）', en: 'World Bank, World Development Indicators (ITU data)' },
      url: 'https://data.worldbank.org/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '數位發展部 數位近用調查', en: 'Ministry of Digital Affairs (Taiwan), Digital Access Survey' },
      url: 'https://data.gov.tw/dataset/5960',
      license: OPEN_DATA_TW,
    },
    {
      name: { zh: '國家通訊傳播委員會 電信統計', en: 'National Communications Commission (Taiwan), telecom statistics' },
      url: 'https://data.gov.tw/dataset/22589',
      license: OPEN_DATA_TW,
    },
    {
      name: {
        zh: 'United Nations, World Population Prospects 2024（換算台灣每百人用）',
        en: "United Nations, World Population Prospects 2024 (for Taiwan's per-100 rates)",
      },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '台灣不在 ITU 的資料庫中，改用數位發展部的調查與 NCC 的用戶數，定義與 ITU 大致相同，細節見台灣側欄的附註。',
    en: "Taiwan is not in the ITU database, so the Ministry of Digital Affairs survey and NCC subscription counts are used instead; their definitions are broadly the same as the ITU's. See the note in Taiwan's panel for details.",
  },
  indicators: [
    {
      id: 'internet-users',
      label: { zh: '網路使用率', en: 'Internet users' },
      description: {
        zh: '過去 3 個月內曾經上網（任何裝置、任何地點）的人占總人口的比例。',
        en: 'Share of the population who used the internet (on any device, anywhere) in the last 3 months.',
      },
      unit: '%',
      file: 'internet-users.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 70, 85, 95] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    per100(
      'mobile-subscriptions',
      { zh: '行動電話用戶', en: 'Mobile subscriptions' },
      {
        zh: '每 100 人的行動電話門號數（月租與預付卡），一人可能有多個門號，所以可以超過 100。',
        en: 'Mobile phone subscriptions (postpaid and prepaid) per 100 people; one person can have several, so it can exceed 100.',
      },
      [25, 50, 75, 100, 125, 150],
    ),
    per100(
      'fixed-broadband',
      { zh: '固網寬頻用戶', en: 'Fixed broadband subscriptions' },
      {
        zh: '每 100 人的固定寬頻網路用戶數（光纖、纜線、ADSL 等，下載速率 256 kbps 以上）。通常一戶一個帳號，所以比個人使用率低。',
        en: 'Fixed broadband subscriptions (fibre, cable, DSL and so on, at least 256 kbit/s download) per 100 people. Usually one per household, so lower than individual usage rates.',
      },
      [1, 5, 10, 20, 30, 40],
    ),
  ],
};
