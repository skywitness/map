import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { PointsOverlayDef } from './types';

/**
 * 河流與流域的擴充：可通航的內河航道與內陸水運（2026-11-05，製作手冊第二十三批 411；pipeline/topics/inland_waterways.py）：
 * CIA 世界概況 2022 版的可通航水道長度（全世界，各國年份不同）、Eurostat 的歐洲水道長度、運河占的比例與內河貨運量，
 * 疊 Global Dam Watch 的船閘。台灣沒有可通航的內陸水道：灰色，tooltip 說明（使用者 2026-11-05 決定）。
 */

const IDS = ['waterways', 'waterways-eu', 'canal-share', 'inland-freight'];

const kmText = (v: number) => tr({ zh: `${fixed(v, 0)} 公里`, en: `${fixed(v, 0)} km` });

const TAIWAN: Record<string, Text> = {
  TWN: { zh: '台灣沒有可通航的內陸水道', en: 'Taiwan has no navigable inland waterways' },
};

const EUROPE_ONLY: Text = { zh: 'Eurostat 只有歐洲的資料', en: 'Eurostat covers Europe only' };

const LOCKS: PointsOverlayDef = {
  kind: 'points',
  id: 'locks',
  file: 'locks.json',
  indicators: IDS,
  label: { zh: '船閘（Global Dam Watch）', en: 'Navigation locks (Global Dam Watch)' },
  radius: 3.2,
  color: MAP_TOKENS.categorical[1],
  tooltip: (p, { countryName }) => ({
    title: typeof p.n === 'string' && p.n ? p.n : tr({ zh: '船閘', en: 'Navigation lock' }),
    properNoun: typeof p.n === 'string' && p.n ? p.n : undefined,
    detail: typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : '',
    extra: typeof p.r === 'string' && p.r ? [tr({ zh: `河流：${p.r}`, en: `River: ${p.r}` })] : [],
  }),
};

const LOCK_NOTE = {
  zh: '紫色的點是 Global Dam Watch 的 1,152 座船閘（法國 355、中國 177、德國 156、美國 123），大多沒有名稱。',
  en: 'Purple dots are the 1,152 navigation locks in Global Dam Watch (France 355, China 177, Germany 156, US 123), most without names.',
};

export const waterwaysPart: TopicPart = {
  name: { zh: '內河航道與內陸水運', en: 'Inland waterways and shipping' },
  sources: [
    {
      name: { zh: 'CIA 世界概況 2022-12-29 版的 Waterways 欄（factbook/factbook.json 的鏡像）', en: 'CIA World Factbook, Waterways field, 29 Dec 2022 edition (factbook/factbook.json mirror)' },
      url: 'https://github.com/factbook/factbook.json/tree/61dadec0c9c9a38eb4c9665aa779977c47dd0481',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: 'Eurostat：可通航內河水道的長度（iww_if_infrastr）、內河貨運（iww_go_atygo）', en: 'Eurostat: navigable inland waterways (iww_if_infrastr), inland waterway freight (iww_go_atygo)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/iww_if_infrastr/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '可通航水道長度（全世界）是 CIA 世界概況 2022 年版的文字欄位，各國年份不同（多半是 2010–2012 年）、「可通航」各國自己定義，只能看量級；2023 年以後的版本拿掉了這一欄。歐洲另用 Eurostat 的同一套定義：水道長度、運河占的比例與內河貨運量，英國、科索沃照 Eurostat 的授權不收。船閘是 Global Dam Watch 標成 Lock 的點（水壩的圖層不收的那一批）。台灣沒有可通航的內陸水道，地圖上是灰色。',
    en: 'Navigable waterway length worldwide is a text field in the CIA World Factbook’s 2022 edition; years differ by country (mostly 2010–2012) and each country defines “navigable” itself, so compare only orders of magnitude; later editions dropped the field. Europe also has Eurostat’s common definition: waterway length, the share that is canals, and inland waterway freight; the UK and Kosovo are left out under Eurostat’s licence. Locks are the points Global Dam Watch tags as Lock (the ones the dam layer leaves out). Taiwan has no navigable inland waterways and is shown grey.',
  },
  overlays: [LOCKS],
  indicators: [
    {
      id: 'waterways',
      label: { zh: '可通航的內河航道（全世界）', en: 'Navigable inland waterways (world)' },
      description: {
        zh: `河川、運河與湖泊裡可以行船的長度（CIA 世界概況 2022 年版，118 國；各國的數字年份不同，滑過看是哪一年）。俄羅斯 102,000 公里（2009 年）最長，巴西 50,000、越南 47,130、哈薩克 43,983、美國 41,009（其中 19,312 公里用於商業運輸）、中國 27,700、哥倫比亞 24,725、印尼 21,579 公里。「可通航」各國自己定義，跨國只能比量級：面積大的國家多半是天然河流，跟荷蘭、德國的運河網不是同一回事（歐洲用同一套定義的長度見「可通航的內河航道（歐洲）」）。${LOCK_NOTE.zh}台灣沒有可通航的內陸水道。`,
        en: `Length of rivers, canals and lakes navigable by boats (CIA World Factbook, 2022 edition, 118 countries; the year of each figure differs, shown on hover). Russia is longest at 102,000 km (2009), then Brazil 50,000, Vietnam 47,130, Kazakhstan 43,983, the US 41,009 (19,312 km used for commerce), China 27,700, Colombia 24,725 and Indonesia 21,579. Each country defines “navigable” itself, so compare only orders of magnitude: large countries count mostly natural rivers, unlike the canal networks of the Netherlands or Germany (see “Navigable inland waterways (Europe)” for a common definition). ${LOCK_NOTE.en} Taiwan has no navigable inland waterways.`,
      },
      unit: { zh: '公里', en: 'km' },
      file: 'waterways.json',
      defaultYear: 2022,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1000, 3000, 10000, 30000] } },
      format: kmText,
      formatTick: (v) => fixed(v, 0),
      timeless: true,
      noValue: TAIWAN,
      missing: { zh: 'CIA 世界概況沒有寫可通航水道', en: 'No navigable waterways listed in the CIA World Factbook' },
    },
    {
      id: 'waterways-eu',
      label: { zh: '可通航的內河航道（歐洲）', en: 'Navigable inland waterways (Europe)' },
      description: {
        zh: `Eurostat 的可通航內河水道長度（運河加河川與湖泊，1962–2024 年），歐洲各國用同一套定義。2024 年：法國 8,507 公里、芬蘭 8,086（幾乎都是河川與湖泊）、德國 7,675、荷蘭 6,920、波蘭 3,767、瑞典 2,987、羅馬尼亞 2,763、比利時 1,850 公里。法國 2012 年 4,996 公里、2013 年起 8,501 公里，應該是統計範圍改了，不是一年多了 3,500 公里。${LOCK_NOTE.zh}台灣沒有可通航的內陸水道。`,
        en: `Eurostat’s length of navigable inland waterways (canals plus rivers and lakes, 1962–2024), on a common European definition. In 2024: France 8,507 km, Finland 8,086 (almost all rivers and lakes), Germany 7,675, the Netherlands 6,920, Poland 3,767, Sweden 2,987, Romania 2,763 and Belgium 1,850. France went from 4,996 km in 2012 to 8,501 km from 2013, most likely a change in coverage rather than 3,500 km built in a year. ${LOCK_NOTE.en} Taiwan has no navigable inland waterways.`,
      },
      unit: { zh: '公里', en: 'km' },
      file: 'waterways-eu.json',
      defaultYear: 'latest',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [500, 1000, 2500, 5000] } },
      format: kmText,
      formatTick: (v) => fixed(v, 0),
      noValue: TAIWAN,
      missing: EUROPE_ONLY,
    },
    {
      id: 'canal-share',
      label: { zh: '運河占內河航道的比例（歐洲）', en: 'Canals as a share of inland waterways (Europe)' },
      description: {
        zh: `可通航內河水道裡人工運河占的比例（Eurostat，運河 ÷ 運河加河川與湖泊）。荷蘭 77.1%（2011 年，之後沒有分項）、法國 66.0%、義大利 60.8%、比利時 57.7%（2008 年）、德國 26.5%（2024 年）；芬蘭 1.6%、奧地利 0%，航道是天然的河川與湖泊。荷蘭、比利時的分項很舊，最近值最多往前找 16 年。台灣沒有可通航的內陸水道。`,
        en: `Share of navigable inland waterways that are man-made canals (Eurostat; canals ÷ canals plus rivers and lakes). The Netherlands 77.1% (2011, no breakdown since), France 66.0%, Italy 60.8%, Belgium 57.7% (2008) and Germany 26.5% (2024); Finland 1.6% and Austria 0%, whose waterways are natural rivers and lakes. The Dutch and Belgian breakdowns are old, so the latest value may be up to 16 years old. Taiwan has no navigable inland waterways.`,
      },
      unit: '%',
      file: 'canal-share.json',
      defaultYear: 'latest',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 20, 40, 60] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
      noValue: TAIWAN,
      missing: EUROPE_ONLY,
    },
    {
      id: 'inland-freight',
      label: { zh: '內河貨運量（歐洲）', en: 'Inland waterway freight (Europe)' },
      description: {
        zh: `在內河航道上運的貨（Eurostat，百萬延噸公里，國內、國際與過境合計，2007–2025 年）。2025 年：德國 42,659、荷蘭 42,188、羅馬尼亞 10,937、比利時 7,075、法國 5,985、保加利亞 5,000；波蘭 29、捷克 16、立陶宛 13，有航道但幾乎不運貨。${LOCK_NOTE.zh}台灣沒有可通航的內陸水道。`,
        en: `Freight carried on inland waterways (Eurostat, million tonne-km; national, international and transit combined, 2007–2025). In 2025: Germany 42,659 and the Netherlands 42,188, Romania 10,937, Belgium 7,075, France 5,985 and Bulgaria 5,000; Poland 29, Czechia 16 and Lithuania 13 have waterways but carry almost nothing on them. ${LOCK_NOTE.en} Taiwan has no navigable inland waterways.`,
      },
      unit: { zh: '百萬延噸公里', en: 'million tonne-km' },
      file: 'inland-freight.json',
      defaultYear: 'latest',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 1000, 5000, 20000] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 百萬延噸公里`, en: `${fixed(v, 0)} million tonne-km` }),
      formatTick: (v) => fixed(v, 0),
      noValue: TAIWAN,
      missing: EUROPE_ONLY,
    },
  ],
};
