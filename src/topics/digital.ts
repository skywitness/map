import { fixed } from '../lib/format';
import type { IndicatorDef, TopicDefinition } from './types';

function per100(id: string, label: string, description: string, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: '門/百人',
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: (v) => `${fixed(v, 1)} 門/百人`,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  };
}

export const digital: TopicDefinition = {
  id: 'digital',
  title: '各國網路與通訊普及',
  shortTitle: '數位',
  defaultIndicator: 'internet-users',
  defaultYear: 2024,
  sources: [
    { name: 'World Bank, World Development Indicators（ITU 資料）', url: 'https://data.worldbank.org/', license: 'CC BY 4.0' },
    { name: '數位發展部 數位近用調查', url: 'https://data.gov.tw/dataset/5960', license: '政府資料開放授權條款' },
    { name: '國家通訊傳播委員會 電信統計', url: 'https://data.gov.tw/dataset/22589', license: '政府資料開放授權條款' },
    { name: 'United Nations, World Population Prospects 2024（換算台灣每百人用）', url: 'https://population.un.org/wpp/', license: 'CC BY 3.0 IGO' },
  ],
  note: '台灣不在 ITU 的資料庫中，改用數位發展部的調查與 NCC 的用戶數，定義與 ITU 大致相同，細節見台灣側欄的附註。',
  indicators: [
    {
      id: 'internet-users',
      label: '網路使用率',
      description: '過去 3 個月內曾經上網（任何裝置、任何地點）的人占總人口的比例。',
      unit: '%',
      file: 'internet-users.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 70, 85, 95] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    per100(
      'mobile-subscriptions',
      '行動電話用戶',
      '每 100 人的行動電話門號數（月租與預付卡），一人可能有多個門號，所以可以超過 100。',
      [25, 50, 75, 100, 125, 150],
    ),
    per100(
      'fixed-broadband',
      '固網寬頻用戶',
      '每 100 人的固定寬頻網路用戶數（光纖、纜線、ADSL 等，下載速率 256 kbps 以上）。通常一戶一個帳號，所以比個人使用率低。',
      [1, 5, 10, 20, 30, 40],
    ),
  ],
};
