import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 最古老的大學（新主題，2026-10-31，製作手冊第十批 185；pipeline/topics/oldest_universities.py，DESIGN.md 第 8 節第 267 點）：
 * 英文維基「List of oldest universities in continuous operation」的大學（1500 年以前成立的 35 所，與 1500 年以後各國最古老的），
 * 國家依最古老的大學的成立年份上色，點依成立年份出現；左邊的清單依年份。
 */

const ERAS: { max: number; label: Text; color: string }[] = [
  { max: 1500, label: { zh: '1500 年以前', en: 'Before 1500' }, color: MAP_TOKENS.categorical[6] },
  { max: 1800, label: { zh: '1500–1799 年', en: '1500–1799' }, color: MAP_TOKENS.categorical[1] },
  { max: 1900, label: { zh: '1800–1899 年', en: '1800–1899' }, color: MAP_TOKENS.categorical[0] },
  { max: 9999, label: { zh: '1900 年以後', en: '1900 and later' }, color: MAP_TOKENS.categorical[4] },
];

function names(p: PointRecord): { title: string; proper?: string } {
  const zh = typeof p.zh === 'string' && p.zh ? p.zh : null;
  const en = String(p.en ?? '');
  return getLang() === 'zh' && zh ? { title: zh, proper: en } : { title: en };
}

function facts(p: PointRecord, countryName: (iso3: string) => string): string[] {
  return [
    [typeof p.iso3 === 'string' ? countryName(p.iso3) : null, p.first === 1 ? tr({ zh: '這一國最古老的', en: 'oldest in the country' }) : null]
      .filter(Boolean)
      .join(' · '),
    tr({ zh: `成為大學：${p.yt}`, en: `Became a university: ${p.yt}` }),
  ];
}

const yearText = (v: number) => tr({ zh: `${v} 年`, en: String(v) });

const LIST: ListPanelDef = {
  label: { zh: '最古老的大學（依年份）', en: 'Oldest universities by year' },
  file: 'universities.json',
  rows: (points, { countryName, year }) =>
    [...points]
      .sort((a, b) => Number(a.y) - Number(b.y))
      .map((p, i): ListRow => {
        const { title, proper } = names(p);
        return {
          key: `${p.en}-${i}`,
          title,
          lines: facts(p, countryName),
          properNoun: proper,
          // 時間軸那一年還沒成為大學的淡一點
          muted: Number(p.y) > year,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
        };
      }),
};

export const oldestUniversities: TopicDefinition = {
  id: 'oldest-universities',
  title: { zh: '最古老的大學', en: 'Oldest universities' },
  shortTitle: { zh: '最古老的大學', en: 'Oldest universities' },
  defaultIndicator: 'oldest',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '英文維基百科「List of oldest universities in continuous operation」（revid 1380111933）',
        en: 'English Wikipedia, “List of oldest universities in continuous operation” (revision 1380111933)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_oldest_universities_in_continuous_operation&oldid=1380111933',
      license: { zh: 'CC BY-SA 4.0（引用事實）', en: 'CC BY-SA 4.0 (facts cited)' },
    },
    { name: { zh: 'Wikidata（大學的位置、中文名稱）', en: 'Wikidata (locations and Chinese names)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
  ],
  note: {
    zh: '大學與年份照英文維基「List of oldest universities in continuous operation」：年份是史學家公認它「成為大學」的年份，「大學」照歐洲中世紀發展出來的定義（有特定組織與法律地位的學者團體），所以很多更古老的學府年份算得比較晚：埃及的愛資哈爾（約 970 年的清真寺學校，1961 年才改為大學）、摩洛哥的卡拉維因（859 年的清真寺學校，1965 年）都不算最早；中間停辦過的也從復校算起（法國的中世紀大學在大革命時廢止，所以法國從 1896 年巴黎的各繼承大學算）。點的說明寫列表原文的年份與附註（例如東京大學「1877 年成為大學，最早的前身 1630 年」）。列表沒有座標，用 Wikidata 的位置（沒有座標的用總部所在地或城市）。台灣是國立臺灣大學（1928 年的臺北帝國大學）。',
    en: 'Universities and years follow English Wikipedia’s “List of oldest universities in continuous operation”: the year is when academic historians recognise the institution as having become a university, using the definition developed in medieval Europe (a corporate body of scholars with distinctive structural and legal features). Many older seats of learning therefore count from a later date: Egypt’s Al-Azhar (a mosque school from about 970, a university only from 1961) and Morocco’s Al-Qarawiyyin (a mosque school from 859, a university from 1965) are not counted as the earliest, and institutions that were closed count from when they reopened (France’s medieval universities were abolished in the Revolution, so France counts from the successor universities of Paris in 1896). Each dot shows the list’s own wording of the date (for example, the University of Tokyo: “1877 as a university; earliest predecessor 1630”). The list has no coordinates, so locations come from Wikidata (or the headquarters or city where an item has none). Taiwan’s is National Taiwan University (founded in 1928 as Taihoku Imperial University).',
  },
  listPanel: LIST,
  overlays: [
    {
      kind: 'points',
      id: 'universities',
      file: 'universities.json',
      label: { zh: '最古老的大學（依成為大學的年份）', en: 'Oldest universities (by year of university status)' },
      radius: { field: 'first', stops: [[0, 3], [1, 4.5]] },
      color: { field: 'y', title: { zh: '成為大學的年份', en: 'Became a university' }, thresholds: [1500, 1800, 1900], classes: ERAS.map(({ label, color }) => ({ label, color })) },
      sortField: 'first',
      timeField: 'y',
      tooltip: (p, { countryName }) => {
        const { title, proper } = names(p);
        return { title, extra: facts(p, countryName), properNoun: proper };
      },
    },
  ],
  indicators: [
    {
      id: 'oldest',
      label: { zh: '最古老的大學成立的年份', en: 'Year of the oldest university' },
      description: {
        zh: '各國最古老、還在運作的大學成為大學的年份。義大利的波隆那大學（1180–1190 年成為大學，教學始於約 1088 年）最早，其次牛津、劍橋、薩拉曼卡、帕多瓦；1500 年以前成立、延續至今的 35 所全在歐洲（義大利 11、德國 7、英國 5、西班牙 5）。秘魯的聖馬爾科斯大學 1551 年、美國的哈佛 1636 年、日本的東京大學 1877 年、台灣的國立臺灣大學 1928 年（墨西哥列 1540 年，是學院成立的年份，1917 年才成為大學；列表有些國家用學院開始授予學位的年份，點的說明照列表寫）。顏色越深越晚。拖動時間軸看大學怎麼從歐洲傳到世界各地；左邊的清單依年份列出 243 所。',
        en: 'The year each country’s oldest university still in operation became a university. Italy’s University of Bologna is the earliest (a university by 1180–1190, with teaching from about 1088), followed by Oxford, Cambridge, Salamanca and Padua; all 35 founded before 1500 and still running are in Europe (Italy 11, Germany 7, the UK 5, Spain 5). Peru’s National University of San Marcos dates from 1551, Harvard in the US from 1636, the University of Tokyo from 1877 and National Taiwan University from 1928 (Mexico is listed at 1540, when its college was founded, though it became a university only in 1917; for some countries the list uses the year a college began awarding degrees, and each dot quotes the list). Darker means later. Drag the time slider to watch universities spread from Europe; the list on the left shows all 243 by year.',
      },
      unit: { zh: '年', en: 'year' },
      file: 'oldest.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1500, 1700, 1850, 1900, 1950, 1970] } },
      overlayTime: 'cumulative',
      format: yearText,
      formatTick: (v) => fixed(v, 0).replace(/,/g, ''),
      lowerIsBetter: true,
      missing: { zh: '列表上沒有這個國家', en: 'Country not in the list' },
    },
  ],
};
