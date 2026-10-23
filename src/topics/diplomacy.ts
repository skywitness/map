import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, ColorClasses, PointRecord, TopicDefinition } from './types';

/**
 * 台灣的外交（pipeline/topics/taiwan_diplomacy.py）：從台灣看世界的主題，台灣本身沒有值（它是觀點），
 * 中國大陸、香港由陸委會主管，也沒有值。
 * 類別代碼跟 pipeline 一致：邦交國 ALLY、館處 MISSION_PRESENCE 與 MISSION_TYPES、簽證 VISA（sources/boca.py）。
 */

/** 邦交國：每年年底的狀態（sources/allies.py）；3 = 沒有邦交，歸到「其他」 */
export const ALLY: CategoryDef[] = [
  { value: 1, label: { zh: '邦交國', en: 'Diplomatic ally' } },
  { value: 2, label: { zh: '曾經是邦交國（已斷交）', en: 'Former ally' } },
];
const NO_RELATIONS: Text = { zh: '沒有邦交', en: 'No diplomatic relations' };

/** 中華民國在那個國家有沒有館處；由強到弱，地圖用循序色 */
export const MISSION_PRESENCE: CategoryDef[] = [
  { value: 1, label: { zh: '有大使館（邦交國）', en: 'Embassy (diplomatic ally)' } },
  { value: 2, label: { zh: '有代表處或辦事處', en: 'Representative or branch office' } },
  { value: 3, label: { zh: '沒有館處，由其他國家的館處兼轄', en: 'No mission; covered from another country' } },
];

/** 館處類型（sources/mofa.py 的 EMBASSY … IGO） */
export const MISSION_TYPES: Record<number, Text> = {
  1: { zh: '大使館', en: 'Embassy' },
  2: { zh: '總領事館', en: 'Consulate general' },
  3: { zh: '代表處', en: 'Representative office' },
  4: { zh: '辦事處', en: 'Branch office' },
  5: { zh: '常駐國際組織代表團', en: 'Mission to an international organisation' },
};

/**
 * 國人簽證待遇（代碼越小越方便）。地圖用發散色，從「出發前要先辦簽證」排到「不用簽證」：
 * 需事先申請、電子簽證是橘色，落地簽證是中間的中性色，免簽證（含要先上網申請旅行授權的）是青綠。
 * 用循序色的話 5 類會用到最深的兩階橘色（免簽證與需要旅行授權的免簽證），在地圖上分不太出來。
 */
export const VISA: CategoryDef[] = [
  { value: 5, label: { zh: '需事先申請簽證', en: 'Visa required in advance' } },
  { value: 4, label: { zh: '電子簽證', en: 'E-visa' } },
  { value: 3, label: { zh: '落地簽證', en: 'Visa on arrival' } },
  { value: 2, label: { zh: '免簽證（需事先上網申請旅行授權）', en: 'Visa-free with online travel authorisation' } },
  { value: 1, label: { zh: '免簽證', en: 'Visa-free' } },
];

const label = (list: CategoryDef[], v: number, other?: Text) => tr(list.find((c) => c.value === v)?.label ?? other ?? '');
export const missionType = (v: number | string | null) => (typeof v === 'number' && MISSION_TYPES[v] ? tr(MISSION_TYPES[v]) : '');

/**
 * 館處點的顏色（依類型）：取自 MAP_TOKENS 的類別色，跟「駐外館處」指標的橘色底色、藍色的海都分得開；
 * 大使館用薄荷綠（邦交國的底色最深），代表處紫、辦事處淡紫、總領事館綠、國際組織洋紅。
 */
const MISSION_COLORS: ColorClasses = {
  field: 'type',
  title: { zh: '館處類型', en: 'Mission type' },
  thresholds: [1.5, 2.5, 3.5, 4.5],
  classes: [
    { color: MAP_TOKENS.categorical[0], label: MISSION_TYPES[1] },
    { color: MAP_TOKENS.categorical[3], label: MISSION_TYPES[2] },
    { color: MAP_TOKENS.categorical[6], label: MISSION_TYPES[3] },
    { color: MAP_TOKENS.categorical[1], label: MISSION_TYPES[4] },
    { color: MAP_TOKENS.categorical[7], label: { zh: '國際組織代表團', en: 'Mission to an IGO' } },
  ],
};

/** 館處的 tooltip：中文介面寫中文名稱，城市（Natural Earth 的英文名稱）放在不翻譯的那一行；英文介面寫館處的英文名稱 */
function missionTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const country = typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : '';
  const city = typeof p.city === 'string' ? p.city : '';
  if (getLang() === 'en') {
    return {
      title: String(p.nameEn ?? ''),
      detail: [missionType(p.type), [city, country].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    };
  }
  return { title: String(p.name ?? ''), detail: [missionType(p.type), country].filter(Boolean).join(' · '), properNoun: city || undefined };
}

const missions = (v: number) =>
  tr({ zh: `${fixed(v, 0)} 個館處`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'mission' : 'missions'}` });

const GOV_LICENSE: Text = { zh: '政府資料開放授權條款－第 1 版', en: 'Open Government Data License, version 1.0 (Taiwan)' };

export const diplomacy: TopicDefinition = {
  id: 'taiwan-diplomacy',
  title: { zh: '台灣的外交（從台灣看世界）', en: "Taiwan's foreign relations" },
  // 英文的頂列在 1280px 寬只放得下約 11 個字元
  shortTitle: { zh: '台灣的外交', en: 'Taiwan ties' },
  defaultIndicator: 'allies',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: '外交部，駐外館處通訊錄（data.gov.tw 6119）', en: 'Ministry of Foreign Affairs (Taiwan), overseas missions directory (data.gov.tw 6119)' },
      url: 'https://data.gov.tw/dataset/6119',
      license: GOV_LICENSE,
    },
    {
      name: {
        zh: '外交部領事事務局，中華民國國民可以免簽證、落地簽證及電子簽證前往之國家與地區（data.gov.tw 30749）',
        en: 'Bureau of Consular Affairs (Taiwan), visa-free, visa-on-arrival and e-visa destinations for ROC nationals (data.gov.tw 30749)',
      },
      url: 'https://data.gov.tw/dataset/30749',
      license: GOV_LICENSE,
    },
    {
      name: {
        zh: '外交部領事事務局，各國暨各地區旅遊及消費者保護資訊（國家清單與兼轄館處）',
        en: 'Bureau of Consular Affairs (Taiwan), country travel information (country list and covering missions)',
      },
      url: 'https://www.boca.gov.tw/sp-foof-countrylp-03-1.html',
      license: GOV_LICENSE,
    },
    {
      name: {
        zh: '邦交國的建交、斷交日期：依外交部公告整理，與維基百科「中華民國外交關係年表」交叉比對',
        en: 'Dates of establishing and severing relations: compiled from MOFA announcements, cross-checked against Wikipedia (Chinese) "Chronology of ROC foreign relations"',
      },
      // 「中華民國外交關係年表」（zh-tw 是繁體版的網址）
      url: 'https://zh.wikipedia.org/zh-tw/%E4%B8%AD%E5%8D%8E%E6%B0%91%E5%9B%BD%E5%A4%96%E4%BA%A4%E5%85%B3%E7%B3%BB%E5%B9%B4%E8%A1%A8',
      license: { zh: '日期是史實，表格自行整理；比對的維基百科條目為 CC BY-SA 4.0', en: 'dates are historical facts compiled by hand; the Wikipedia article checked against is CC BY-SA 4.0' },
    },
    {
      name: { zh: 'Natural Earth（1:10m 城市點，館處位置）', en: 'Natural Earth (1:10m populated places, mission locations)' },
      url: 'https://www.naturalearthdata.com/',
      license: { zh: '公有領域', en: 'public domain' },
    },
  ],
  note: {
    zh: '從台灣看世界：台灣本身是觀點，地圖上不上色；中國大陸與香港由大陸委員會主管（兩岸關係、台胞證、網上預辦入境登記），不在外交部與領事事務局的資料裡，也不上色。邦交國是每年年底的狀態，起點是 1949 年底政府遷臺時仍有邦交的 47 國；越南共和國（南越，1955–1975）今天沒有對應的國家，只有領事關係的馬來西亞（1964–1974）與拉脫維亞（1992–1994）不算，所以 1955–1974 年比常見的數字少 1–2 國（1969 年常說的 70 國，這裡是 68 國）；同一年建交又斷交的（例如 1999 年巴布亞紐幾內亞）不會出現在當年的地圖上。駐外館處的位置是所在城市的中心（Natural Earth），不是實際地址；無邦交國家的主要館處算「代表處」（不論名稱是代表處、經濟文化辦事處或中心），其他城市的算「辦事處」。簽證待遇依領事事務局最新的名單，同一國有好幾種方式時取最方便的一種；各國規定時常變動，出發前請以各國公告為準。',
    en: "Taiwan's view of the world: Taiwan itself is the point of view and is not coloured. Mainland China and Hong Kong fall under the Mainland Affairs Council (cross-strait travel permits and pre-arrival registration), are not in the Ministry of Foreign Affairs or Bureau of Consular Affairs data, and are not coloured either. Allies are counted at the end of each year, starting from the 47 countries that still recognised the ROC when its government moved to Taiwan at the end of 1949. The Republic of Vietnam (South Vietnam, 1955–1975) has no present-day counterpart, and Malaysia (1964–1974) and Latvia (1992–1994), which had consular relations only, are not counted, so 1955–1974 show one or two fewer allies than the usual figures (68 rather than the often-quoted 70 for 1969). Relations that began and ended within the same year (Papua New Guinea in 1999, for example) do not appear on that year's map. Mission locations are city centres (Natural Earth), not street addresses; in countries without diplomatic relations the main mission counts as a representative office whatever its name, and offices in other cities count as branch offices. Visa access follows the latest Bureau of Consular Affairs list, using the most convenient option where a country offers several; rules change often, so check the destination's own announcements before travelling.",
  },
  panelExtra: () => import('./panels/DiplomacyPanel'),
  overlays: [
    {
      kind: 'points',
      id: 'missions',
      file: 'missions.json',
      label: { zh: '駐外館處', en: 'Taiwan missions' },
      indicators: ['missions-presence'],
      // 大使館、總領事館、代表處畫大一點，其他城市的辦事處、國際組織代表團小一點
      radius: { field: 'type', stops: [[3, 4.5], [4, 3.2]] },
      color: MISSION_COLORS,
      tooltip: missionTooltip,
    },
  ],
  indicators: [
    {
      id: 'allies',
      label: { zh: '邦交國', en: 'Diplomatic allies' },
      description: {
        zh: '從台灣看：每年年底跟中華民國（台灣）有正式邦交的國家。1969 年最多，1971 年退出聯合國、1979 年美國斷交後大幅減少，2024 年 1 月諾魯斷交後剩 12 國。拖動時間軸看一年年的變化；「曾經是邦交國」是 1949 年底以後有過邦交、後來斷交的國家。',
        en: "Seen from Taiwan: countries with formal diplomatic relations with the Republic of China (Taiwan) at the end of each year. The number peaked in 1969, fell sharply after the ROC left the UN in 1971 and the US switched recognition in 1979, and has stood at 12 since Nauru switched in January 2024. Drag the time slider to step through the years; former allies had relations at some point after 1949 and later cut them.",
      },
      unit: '',
      file: 'allies.json',
      layer: { kind: 'categorical', categories: ALLY, other: NO_RELATIONS },
      format: (v) => label(ALLY, v, NO_RELATIONS),
    },
    {
      id: 'missions-presence',
      label: { zh: '駐外館處', en: 'Overseas missions' },
      description: {
        zh: '從台灣看：中華民國在各國有沒有館處。邦交國設大使館；沒有邦交的國家多半是「台北經濟文化代表處」這類名稱的代表處與辦事處；其他國家由鄰近國家的館處兼轄（例如駐南非代表處兼轄波札那）。地圖上的點是每個館處所在的城市，滑鼠移上去可看名稱。',
        en: 'Seen from Taiwan: whether the Republic of China (Taiwan) has a mission in each country. Allies host embassies; most other countries host representative or branch offices with names such as "Taipei Economic and Cultural Office"; the rest are covered from a mission in a nearby country (Botswana from the office in South Africa, for example). Dots mark the city of each mission; hover over one to see its name.',
      },
      unit: '',
      file: 'missions-presence.json',
      layer: { kind: 'categorical', categories: MISSION_PRESENCE, ordinal: true },
      format: (v) => label(MISSION_PRESENCE, v),
    },
    {
      id: 'mission-count',
      label: { zh: '駐外館處數', en: 'Number of missions' },
      description: {
        zh: '從台灣看：中華民國在每個國家設的館處數（大使館、代表處、辦事處、總領事館與國際組織代表團），例如美國有駐美國代表處與 12 個辦事處。',
        en: 'Seen from Taiwan: the number of Republic of China (Taiwan) missions in each country (embassies, representative and branch offices, consulates and missions to international organisations); the United States, for example, has a representative office and 12 branch offices.',
      },
      unit: { zh: '個', en: 'missions' },
      file: 'mission-count.json',
      layer: { kind: 'bubble', legendValues: [1, 4, 13] },
      format: missions,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'visa',
      label: { zh: '國人簽證待遇', en: 'Visa access (Taiwan passport)' },
      description: {
        zh: '從台灣看：持中華民國（台灣）護照前往各國要不要簽證（外交部領事事務局的名單）。美國、加拿大、英國、紐西蘭、以色列免簽證，但要事先上網申請旅行授權（ESTA、eTA、ETA）；申根區的停留日數合併計算。同一國有好幾種方式時取最方便的一種；灰色是領務局沒有資料的地方。',
        en: 'Seen from Taiwan: whether holders of a Republic of China (Taiwan) passport need a visa, per the Bureau of Consular Affairs list. The US, Canada, the UK, New Zealand and Israel are visa-free but require an online travel authorisation in advance (ESTA, eTA, ETA); stays across the Schengen area count together. Where a country offers several options, the most convenient is shown; grey areas have no Bureau of Consular Affairs information.',
      },
      unit: '',
      file: 'visa.json',
      layer: { kind: 'categorical', categories: VISA, diverging: true },
      format: (v) => label(VISA, v),
    },
  ],
};
