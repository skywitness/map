import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { ListPanelDef, ListRow, TopicDefinition } from './types';

/**
 * 台灣人看哪一國的電影（2026-11-04，製作手冊第二十一批 347；pipeline/topics/box_office_tw.py）：
 * 國家電影及視聽文化中心的全國電影票房（2016 年起上映的片），依出品國與上映年加總。只有台灣一個視角。
 */

const wan = (v: number) => tr({ zh: `${fixed(v / 1e4, v >= 1e6 ? 0 : 1)} 萬張`, en: `${fixed(v / 1e6, v >= 1e7 ? 1 : 2)} million tickets` });
const yi = (v: number) => tr({ zh: `${fixed(v / 1e8, v >= 1e9 ? 1 : 2)} 億元`, en: `NT$${fixed(v / 1e6, 0)} million` });

const LIST: ListPanelDef = {
  label: { zh: '票房最高的電影（1 萬張以上）', en: 'Top films at the box office (10,000+ tickets)' },
  file: 'films.json',
  rows: (points, { countryName, year }) =>
    [...points]
      .sort((a, b) => Number(b.t) - Number(a.t))
      .map((p, i): ListRow => ({
        key: `${p.n}-${p.d}-${i}`,
        title: String(p.n),
        titleProper: true,
        lines: [
          [typeof p.iso3 === 'string' ? countryName(p.iso3) : '', tr({ zh: `${p.d} 上映`, en: `released ${p.d}` })].join(' · '),
          `${wan(Number(p.t))} · ${yi(Number(p.a))}`,
        ],
        muted: Number(p.y) !== year,
        year: Number(p.y),
        target: { box: [Number(p.bw), Number(p.bs), Number(p.be), Number(p.bn)] },
      })),
};

export const boxOfficeTw: TopicDefinition = {
  id: 'box-office-tw',
  title: { zh: '台灣人看哪一國的電影：票房的出品國', en: 'Which countries’ films Taiwan watches: box office by origin' },
  shortTitle: { zh: '台灣的電影票房', en: 'Taiwan box office' },
  defaultIndicator: 'share',
  defaultYear: 2025,
  sources: [
    {
      name: { zh: '國家電影及視聽文化中心：全國電影票房統計數據（政府資料開放平臺 94224）', en: 'Taiwan Film and Audiovisual Institute: national box office statistics (data.gov.tw 94224)' },
      url: 'https://data.gov.tw/dataset/94224',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '國家電影及視聽文化中心的全國電影票房，2016 年 1 月起上映的每一部片（2026 年 11 月 1 日的版本，每週更新）。只有上映日、沒有賣票的日期，所以年份是「上映年」：一部片的票都算在上映那一年（例如 2025 年 12 月 31 日上映的《陽光女子合唱團》全部算 2025 年），而且只收上映滿 7 天的片，最近一年偏低。出品國是片商填的中文，合製片只算第一個國家；「中華民國」是國片。2016 年以前上映、修復重映的老片不算。地圖畫的是出品國，不是拍攝地。這是台灣一個地方的觀影結構，不是各國的電影產量或全球票房。',
    en: 'National box office data from the Taiwan Film and Audiovisual Institute for every film released from January 2016 (version of 1 November 2026, updated weekly). Only release dates are given, not sales dates, so years are release years: all of a film’s tickets count in the year it opened (Sunny Girls Choir, released on 31 December 2025, counts entirely in 2025), and only films that have been showing for 7 days are included, so the latest year is low. Production countries are entered in Chinese by distributors, and co-productions count only the first country; “Republic of China” means Taiwanese films. Older films re-released after restoration (released before 2016) are excluded. The map shows the production country, not the filming location. This is Taiwan’s viewing pattern only, not each country’s film output or worldwide box office.',
  },
  listPanel: LIST,
  indicators: [
    {
      id: 'share',
      label: { zh: '占台灣票房的比例', en: 'Share of Taiwan’s tickets' },
      description: {
        zh: '那一年上映的片，各出品國占台灣電影票數的比例。2016 年起累計：美國片 64.8%、國片 11.8%、日本片 11.8%、韓國片 5.5%、香港片 1.8%、英國片 0.9%。疫情前的 2019 年美國片占 76.6%、國片 6.9%；2025 年美國片降到 48.1%，日本片 22.9%（《鬼滅之刃》無限城篇）、國片 21.0%（《陽光女子合唱團》）。',
        en: 'Share of Taiwan’s cinema tickets for films released that year, by production country. Cumulatively since 2016: US films 64.8%, Taiwanese 11.8%, Japanese 11.8%, Korean 5.5%, Hong Kong 1.8% and British 0.9%. In pre-pandemic 2019 US films took 76.6% and Taiwanese 6.9%; in 2025 the US share fell to 48.1%, with Japan at 22.9% (Demon Slayer: Infinity Castle) and Taiwan at 21.0% (Sunny Girls Choir).',
      },
      unit: '%',
      file: 'share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.5, 1, 5, 10, 30] } },
      format: (v) => (v > 0 && v < 0.01 ? '<0.01%' : `${fixed(v, v < 1 ? 2 : 1)}%`),
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'tickets',
      label: { zh: '票數', en: 'Tickets' },
      description: {
        zh: '那一年上映的各國電影在台灣賣了幾張票。全部片子一年 4,679 萬張（2017 年）最多，疫情的 2020、2021 年掉到兩千萬左右，2025 年回到 3,046 萬張。單片最多的是《復仇者聯盟：終局之戰》349 萬張（2019 年），國片最多的是《陽光女子合唱團》283 萬張（2025 年）。',
        en: 'Tickets sold in Taiwan for each country’s films released that year. All films together peaked at 46.79 million in 2017, fell to about 20 million in pandemic-hit 2020 and 2021, and recovered to 30.46 million in 2025. The biggest single film is Avengers: Endgame with 3.49 million tickets (2019); the biggest Taiwanese film is Sunny Girls Choir with 2.83 million (2025).',
      },
      unit: { zh: '張', en: 'tickets' },
      file: 'tickets.json',
      layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
      format: wan,
    },
    {
      id: 'amounts',
      label: { zh: '票房金額', en: 'Box office takings' },
      description: {
        zh: '那一年上映的各國電影在台灣的票房金額（新台幣）。',
        en: 'Box office takings in Taiwan (NT$) for each country’s films released that year.',
      },
      unit: { zh: '元', en: 'NT$' },
      file: 'amounts.json',
      layer: { kind: 'bubble', legendValues: [1e7, 1e8, 1e9] },
      format: yi,
    },
    {
      id: 'film-count',
      label: { zh: '上映的片數', en: 'Films released' },
      description: {
        zh: '那一年在台灣上映（滿 7 天）的各國電影部數。2016 年起日本片 1,529 部、美國片 1,583 部，部數差不多，日本片的票數卻不到美國片的五分之一；法國片 625 部、只賣了 252 萬張。',
        en: 'Number of films from each country released in Taiwan that year (showing for at least 7 days). Since 2016 Japan has released 1,529 films and the US 1,583, yet Japanese films sold less than a fifth as many tickets; France released 625 films that sold just 2.52 million tickets.',
      },
      unit: { zh: '部', en: 'films' },
      file: 'film-count.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 10, 30, 60, 100] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 部`, en: fixed(v, 0) }),
      formatTick: (v) => `${v}`,
    },
  ],
};
