import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 電競獎金總額與選手數（2026-11-04，製作手冊第二十一批 348；pipeline/topics/esports.py）：
 * Esports Earnings 國家頁的累計獎金、選手數與賺最多的遊戲（累計到 2026 年 11 月，沒有年份）。
 */

const GAMES: CategoryDef[] = [
  { value: 1, label: 'Dota 2' },
  { value: 2, label: 'Counter-Strike' },
  { value: 3, label: 'Fortnite' },
  { value: 4, label: 'PUBG' },
  { value: 5, label: 'League of Legends' },
  { value: 6, label: 'Rocket League' },
  { value: 7, label: { zh: '手機 MOBA 等（傳說對決、Mobile Legends、Free Fire）', en: 'Mobile games (Arena of Valor, Mobile Legends, Free Fire)' } },
  { value: 8, label: { zh: '其他遊戲', en: 'Other games' } },
];

const usd = (v: number) =>
  tr({
    zh: v >= 1e8 ? `${fixed(v / 1e8, 2)} 億美元` : `${fixed(v / 1e4, v >= 1e6 ? 0 : 1)} 萬美元`,
    en: v >= 1e6 ? `US$${fixed(v / 1e6, 1)} million` : `US$${fixed(v / 1e3, 0)}k`,
  });

export const esports: TopicDefinition = {
  id: 'esports',
  title: { zh: '電競獎金與選手', en: 'Esports prize money and players' },
  shortTitle: { zh: '電競', en: 'Esports' },
  defaultIndicator: 'prize',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'Esports Earnings：Countries（2026 年 11 月 4 日）', en: 'Esports Earnings: Countries (4 November 2026)' },
      url: 'https://www.esportsearnings.com/countries',
      license: { zh: '准許個人與商業使用；Copyright © 2012-2026 Esports Earnings. All Rights Reserved.', en: 'Personal and commercial use permitted; Copyright © 2012-2026 Esports Earnings. All Rights Reserved.' },
    },
    {
      name: { zh: 'UN World Population Prospects 2024（每百萬人用的人口）', en: 'UN World Population Prospects 2024 (population for per-million figures)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
  ],
  note: {
    zh: '依選手的國籍，加總電競選手在國際與各國賽事拿到的獎金（美元）與選手人數，從有紀錄以來累計到 2026 年 11 月。資料是 Esports Earnings 彙整網路上公開的賽事結果，不是官方統計：小語種、地方賽事會漏，選手國籍以選手自報為準，換國籍的可能算錯國家。累計獎金被 Dota 2 的 The International 這類超大獎金賽事拉偏，所以 Dota 2 強國排得前面。每百萬人用聯合國 2026 年的推估人口，人口不到 10 萬的不算。台灣的國名在網站上寫「Taiwan, Republic of China」。',
    en: 'Prize money (US$) won by esports players at international and national events, and the number of players, totalled by player nationality from the start of records to November 2026. Esports Earnings compiles publicly reported results rather than official statistics: events in smaller languages and local tournaments may be missed, nationality is self-reported and players who switch nationality may be miscounted. Huge prize pools such as Dota 2’s The International skew the totals, so strong Dota 2 nations rank high. Per-million figures use UN 2026 population projections and exclude places with fewer than 100,000 people. The site lists Taiwan as “Taiwan, Republic of China”.',
  },
  indicators: [
    {
      id: 'prize',
      label: { zh: '累計獎金', en: 'Total prize money' },
      description: {
        zh: '各國電競選手累計拿到的獎金。中國 3.34 億美元最多（9,448 名選手，主力是 Dota 2），美國 3.06 億（29,902 名選手最多，主力 Fortnite），南韓 1.58 億（主力 League of Legends），俄羅斯 1.03 億；台灣 2,318 萬美元、1,762 名選手（第 20 名，主力 League of Legends）。',
        en: 'Total prize money won by each country’s esports players. China leads with US$333.8 million (9,448 players, mostly Dota 2), the US US$306.1 million (most players at 29,902, mostly Fortnite), South Korea US$157.7 million (mostly League of Legends) and Russia US$102.8 million; Taiwan has US$23.2 million and 1,762 players (20th, mostly League of Legends).',
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'prize.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: usd,
    },
    {
      id: 'prize-per-million',
      label: { zh: '每百萬人的獎金', en: 'Prize money per million people' },
      description: {
        zh: '累計獎金除以人口。丹麥每百萬人 1,096 萬美元最多（Counter-Strike 強國），愛沙尼亞、芬蘭、瑞典也在前面，南韓 306 萬；台灣 101 萬、美國 88 萬、日本 36 萬、中國 24 萬美元。',
        en: 'Total prize money divided by population. Denmark leads with US$11.0 million per million people (a Counter-Strike powerhouse), followed by Estonia, Finland and Sweden; South Korea US$3.06 million, Taiwan US$1.01 million, the US US$0.88 million, Japan US$0.36 million and China US$0.24 million.',
      },
      unit: { zh: '美元／百萬人', en: 'US$ per million people' },
      file: 'prize-per-million.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1e4, 5e4, 1e5, 5e5, 1e6, 3e6] } },
      format: usd,
      formatTick: (v) => (v >= 1e6 ? `${v / 1e6}M` : `${v / 1e3}k`),
    },
    {
      id: 'players',
      label: { zh: '選手人數', en: 'Players' },
      description: {
        zh: '拿過獎金的電競選手人數。美國 29,902 人遠多於其他國家，中國 9,448、南韓 6,005、俄羅斯 5,962；台灣 1,762 人。',
        en: 'Number of esports players who have won prize money. The US has far more than anyone else at 29,902, followed by China 9,448, South Korea 6,005 and Russia 5,962; Taiwan has 1,762.',
      },
      unit: { zh: '人', en: 'players' },
      file: 'players.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 人`, en: fixed(v, 0) }),
    },
    {
      id: 'top-game',
      label: { zh: '賺最多獎金的遊戲', en: 'Top-earning game' },
      description: {
        zh: '每個國家的選手賺最多獎金的遊戲。Dota 2（32 國：中國、俄羅斯、烏克蘭、瑞典、芬蘭、菲律賓、祕魯等）、Fortnite（28 國：美國、加拿大、墨西哥、英國、義大利、荷蘭等）、PUBG（24 國：印度、日本、土耳其、奈及利亞等，多是手機版）、Counter-Strike（19 國：丹麥、法國、波蘭、葡萄牙、南非等）最常見；南韓、台灣是 League of Legends，越南是傳說對決。滑過國家看占比。',
        en: 'The game that earned each country’s players the most prize money. Dota 2 (32 countries, including China, Russia, Ukraine, Sweden, Finland, the Philippines and Peru), Fortnite (28, including the US, Canada, Mexico, the UK, Italy and the Netherlands), PUBG (24, including India, Japan, Türkiye and Nigeria, mostly the mobile version) and Counter-Strike (19, including Denmark, France, Poland, Portugal and South Africa) are most common; South Korea and Taiwan top out in League of Legends and Vietnam in Arena of Valor. Hover for the share.',
      },
      unit: '',
      file: 'top-game.json',
      layer: { kind: 'categorical', categories: GAMES },
      format: (v) => {
        const label = GAMES.find((c) => c.value === v)?.label ?? '';
        return typeof label === 'string' ? label : tr(label);
      },
      unranked: true,
    },
  ],
};
