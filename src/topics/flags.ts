import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { FlagIcon } from './flagImages';
import type { CategoryDef, DimensionDef, TopicDefinition } from './types';

/**
 * 國旗（pipeline/topics/flags.py）：國旗圖檔是 Wikimedia Commons 的 SVG（逐檔核對授權，公有領域或 CC0，阿曼是政府開放授權），
 * 畫哪一面旗依 Wikidata（CC0）。地圖的「國旗地圖」在瀏覽器裡把國旗畫進國界（src/map/flagTiles.ts）；
 * 顏色是 SVG 畫成點陣圖後逐一像素歸類的面積比例；圖案與旗幟家族是逐一看過的清單（跟 Wikidata 核對）。
 * 單一快照（timeless）。決定與資料陷阱見 DESIGN.md 第 8 節第 84 點。
 */

/**
 * 國旗的顏色（字面上的顏色，不是地圖的資料色）：側欄的顏色組成長條、「主要顏色」類別圖用。
 * 地圖的資料色一律來自 MAP_TOKENS（見 DESIGN.md 第 5 節），這裡例外：類別本身就是顏色，紅色那一類畫成別的顏色反而會誤導。
 * 每一類取各國旗裡常見的那一種（例如紅取 #d52b1e 這類國旗紅，不是純紅）；白色在淺色底上要另外加邊框（CSS 的 .flag-swatch）。
 */
export const FLAG_COLOURS: Record<string, string> = {
  red: '#d52b1e',
  white: '#ffffff',
  blue: '#1f4fa3',
  green: '#178c46',
  yellow: '#f7cb15',
  black: '#1d1d1b',
  orange: '#f07d1a',
  other: '#9a8f86',
};

export const COLOUR_NAMES: Record<string, Text> = {
  red: { zh: '紅色', en: 'Red' },
  white: { zh: '白色', en: 'White' },
  blue: { zh: '藍色', en: 'Blue' },
  green: { zh: '綠色', en: 'Green' },
  yellow: { zh: '黃色（含金色）', en: 'Yellow (incl. gold)' },
  black: { zh: '黑色', en: 'Black' },
  orange: { zh: '橘色', en: 'Orange' },
  other: { zh: '其他顏色（灰、棕、紫…）', en: 'Other (grey, brown, purple…)' },
};
export const COLOUR_ORDER = ['red', 'white', 'blue', 'green', 'yellow', 'black', 'orange', 'other'];

/**
 * 主要顏色（pipeline 的 COLOUR_CODE、TIED）。「沒有單一的主要顏色」用地圖類別色的淡紫：國旗的顏色裡沒有紫色，
 * 也跟白色那一類、無資料的灰色分得開（「其他」的淺米色跟白色太像）
 */
const TIED: Text = { zh: '沒有單一的主要顏色（前兩種差不到 2%）', en: 'No single main colour (top two within 2 points)' };
const MAIN_COLOURS: CategoryDef[] = [
  ...COLOUR_ORDER.slice(0, 7).map((c, i) => ({ value: i + 1, label: COLOUR_NAMES[c], color: FLAG_COLOURS[c] })),
  { value: 8, label: TIED, color: MAP_TOKENS.categorical[1] },
];

/** 圖案（pipeline 的 FEATURES） */
export const FEATURE_NAMES: Record<string, Text> = {
  stars: { zh: '星星', en: 'Stars' },
  crescent: { zh: '新月', en: 'Crescent' },
  sun: { zh: '太陽', en: 'Sun' },
  cross: { zh: '十字（含北歐十字、斜十字）', en: 'Cross (incl. Nordic cross, saltire)' },
  unionjack: { zh: '英國國旗（米字旗）', en: 'Union Jack' },
  emblem: { zh: '國徽或徽章', en: 'Coat of arms or emblem' },
  animal: { zh: '動物', en: 'Animals' },
  vertical: { zh: '直條三色旗', en: 'Vertical tricolour' },
  horizontal: { zh: '橫條', en: 'Horizontal stripes' },
};
/** 圖案的說明（指標說明的後半句） */
export const FEATURE_HINTS: Record<string, Text> = {
  stars: { zh: '包括國徽裡的星（斯洛維尼亞、巴拉圭）。', en: 'Includes stars within a coat of arms (Slovenia, Paraguay).' },
  crescent: { zh: '包括尼泊爾的月亮與蒙古索永布符號裡的新月。', en: 'Includes Nepal’s moon and the crescent in Mongolia’s Soyombo.' },
  sun: {
    zh: '包括代表太陽的圓（日本、孟加拉、尼日）與國徽裡的太陽（厄瓜多）；台灣的白日也算。',
    en: 'Includes discs that stand for the sun (Japan, Bangladesh, Niger) and suns within a coat of arms (Ecuador); Taiwan’s white sun counts.',
  },
  cross: {
    zh: '英國國旗本身是三個十字疊成的，算；左上角有英國國旗的旗歸在「英國國旗」，不重複算。王冠頂上的小十字不算。',
    en: 'The Union Flag itself is made of three crosses and counts; flags with a Union Jack in the canton are under “Union Jack” instead. Small crosses atop crowns do not count.',
  },
  unionjack: { zh: '英國國旗本身，或左上角有英國國旗（英國的海外領土、澳洲、紐西蘭等）。', en: 'The Union Flag itself, or a Union Jack in the canton (British overseas territories, Australia, New Zealand and others).' },
  emblem: { zh: '旗上有國徽、印章或徽章（盾徽）。', en: 'A coat of arms, seal or badge on the flag.' },
  animal: {
    zh: '包括國徽、徽章的主要圖案（西班牙國徽的獅子、厄瓜多的神鷹）。',
    en: 'Includes the main charges of a coat of arms or badge (the lion in Spain’s arms, Ecuador’s condor).',
  },
  vertical: {
    zh: '三條不同顏色的直條（法國、義大利、墨西哥）；兩邊同色的（加拿大、奈及利亞、秘魯）不算。',
    en: 'Three vertical bands of different colours (France, Italy, Mexico); bands with matching outer colours (Canada, Nigeria, Peru) do not count.',
  },
  horizontal: {
    zh: '旗面主要由兩條以上的橫條構成，可以另有三角形、方塊或徽章（美國、泰國、德國）。',
    en: 'A field made mostly of two or more horizontal bands, possibly with a triangle, canton or emblem (the US, Thailand, Germany).',
  },
};
export const FEATURE_ORDER = Object.keys(FEATURE_NAMES);

/** 旗幟家族（pipeline 的 FAMILIES） */
export const FAMILIES: CategoryDef[] = [
  { value: 1, label: { zh: '北歐十字', en: 'Nordic cross' } },
  { value: 2, label: { zh: '英國國旗（米字旗）', en: 'Union Jack' } },
  { value: 3, label: { zh: '泛非顏色', en: 'Pan-African colours' } },
  { value: 4, label: { zh: '泛阿拉伯顏色', en: 'Pan-Arab colours' } },
  { value: 5, label: { zh: '泛斯拉夫顏色', en: 'Pan-Slavic colours' } },
  { value: 6, label: { zh: '大哥倫比亞（黃藍紅）', en: 'Gran Colombia (yellow-blue-red)' } },
  { value: 7, label: { zh: '中美洲聯邦（藍白藍）', en: 'Central American Federation (blue-white-blue)' } },
];
const NO_FAMILY: Text = { zh: '不屬於這些家族', en: 'None of these' };

/** 長寬比（pipeline 的 RATIO_CODES） */
const RATIOS: CategoryDef[] = [
  { value: 1, label: '2:3' },
  { value: 2, label: '1:2' },
  { value: 3, label: '3:5' },
  { value: 4, label: { zh: '1:1（正方形）', en: '1:1 (square)' } },
  { value: 5, label: { zh: '不是長方形', en: 'Not rectangular' } },
];
const OTHER_RATIO: Text = { zh: '其他比例', en: 'Other proportions' };

/** 年份不加千分位 */
const year = (v: number) => String(Math.round(v));

const categoryLabel = (list: CategoryDef[], v: number, other?: Text) => tr(list.find((c) => c.value === v)?.label ?? other ?? '');

const COLOUR_DIMENSION: DimensionDef = {
  label: { zh: '顏色', en: 'Colour' },
  options: COLOUR_ORDER.map((c) => ({ id: c, label: COLOUR_NAMES[c] })),
  defaultOption: 'red',
};
const FEATURE_DIMENSION: DimensionDef = {
  label: { zh: '圖案', en: 'Feature' },
  options: FEATURE_ORDER.map((f) => ({ id: f, label: FEATURE_NAMES[f] })),
  defaultOption: 'stars',
};

const HAS: CategoryDef[] = [{ value: 1, label: { zh: '有', en: 'Yes' } }];
const HAS_NOT: Text = { zh: '沒有', en: 'No' };

export const SOURCE_RULE: Text = {
  zh: '國旗是各國政府使用的那一面（依 Wikidata，對不上的逐一查證）；屬地有自己正式的旗就畫自己的，沒有就畫主權國的國旗。',
  en: 'Each flag is the one used by that government (from Wikidata, checked case by case); territories show their own official flag if they have one, otherwise their sovereign state’s.',
};

export const flags: TopicDefinition = {
  id: 'flags',
  title: { zh: '國旗（顏色、圖案、採用年份、長寬比）', en: 'National flags' },
  shortTitle: { zh: '國旗', en: 'Flags' },
  defaultIndicator: 'map',
  defaultYear: 2026,
  timeless: true,
  rowIcon: FlagIcon,
  sources: [
    {
      name: { zh: 'Wikimedia Commons（國旗的 SVG，逐檔核對授權）', en: 'Wikimedia Commons (flag SVGs, licence checked file by file)' },
      url: 'https://commons.wikimedia.org/wiki/Category:SVG_flags_by_country',
      license: {
        zh: '公有領域 228 個、CC0 5 個、阿曼政府開放授權 1 個；國徽、國旗的使用可能受各國法律限制',
        en: '228 public domain, 5 CC0, 1 Open Government Licence – Oman; use of national insignia may be restricted by national law',
      },
    },
    {
      name: { zh: 'Wikidata（各國的國旗、採用時間、圖案、長寬比）', en: 'Wikidata (flags, adoption dates, depicted features, proportions)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh: '國旗圖檔取自 Wikimedia Commons，經 svgo 最佳化（畫出來跟原檔相同），每個檔的出處與授權列在 data/topics/flags/svg/CREDITS.txt：公有領域 228 個、CC0 5 個、阿曼的國旗是阿曼政府開放授權（OGL-om 1.0，需標示出處）。國旗、國徽是國家象徵，即使沒有著作權，各國法律也可能限制它們的使用（例如商標、商業用途）。國旗的顏色是把 SVG 畫成點陣圖後逐一像素歸類（紅、白、藍、綠、黃與金色、黑、橘、其他）算出的面積比例，只看外觀。採用年份是目前這一版開始使用的年份：改了圖案或徽章（包括依新法重新繪製）算新的一版，只改顏色深淺或比例的不算，停用後再採用的算再採用的年份；Wikidata 的日期對不上的逐一查證，理由寫在附註。地圖上的國旗依國土的形狀縮放、裁切，正確的樣子看側欄。爭議地區畫當地政府使用的旗，地圖上的名稱與國界不代表任何政治立場。',
    en: 'Flag images come from Wikimedia Commons, optimised with svgo (rendering identically to the originals); every file’s source and licence is listed in data/topics/flags/svg/CREDITS.txt: 228 public domain, 5 CC0, and Oman’s flag under the Open Government Licence – Oman (OGL-om 1.0, attribution required). Flags and coats of arms are national symbols: even where no copyright applies, national laws may restrict their use (for example in trademarks or commercial use). Flag colours are area shares computed by rendering each SVG and classifying every pixel (red, white, blue, green, yellow and gold, black, orange, other), by appearance only. The adoption year is when the current version came into use: a change of design or emblem (including an official redrawing) makes a new version, a change of shade or proportions does not, and a readopted flag counts from its readoption; where Wikidata’s dates disagree each case was checked, with the reasons in the notes. Flags on the map are scaled and cropped to each country; the side panel shows them correctly. Disputed areas show the flag used by their own authorities; names and borders on the map do not imply any political position.',
  },
  noValue: {
    ATA: { zh: '南極洲沒有國旗（南極條約的旗不是國旗）', en: 'Antarctica has no national flag' },
    _SIA: { zh: '印度與巴基斯坦的爭議地區', en: 'Disputed between India and Pakistan' },
  },
  panelExtra: () => import('./panels/FlagsPanel'),
  indicators: [
    {
      id: 'map',
      label: { zh: '國旗', en: 'Flags' },
      description: {
        zh: '每個國家塗上自己的國旗。國旗依國土的形狀縮放、裁切（最多拉長 25%，其餘裁掉，盡量留住左上角的方塊這類重點），小國畫成小國旗；點國家看完整的國旗、顏色與圖案。',
        en: 'Each country is filled with its flag, scaled and cropped to its shape (stretched by at most 25%, the rest cropped while keeping features such as the canton in view); small countries get a small flag. Click a country for the full flag, its colours and features.',
      },
      unit: { zh: '年', en: '' },
      file: 'adopted.json',
      layer: { kind: 'flags', file: 'flags.json' },
      format: (v) => tr({ zh: `${year(v)} 年起使用`, en: `In use since ${year(v)}` }),
      unranked: true,
      lowerIsBetter: true,
      rankingBars: false,
    },
    {
      id: 'colours',
      label: { zh: '占國旗面積', en: 'Share of flag area' },
      description: {
        zh: '這個顏色占國旗面積的比例。國旗的 SVG 畫成點陣圖後逐一像素歸類，只看外觀（卡達的栗色算紅色）；官方說法跟外觀不同的照官方（亞美尼亞的杏色算橘色）。尼泊爾的旗不是長方形，只算旗面。',
        en: 'The share of the flag’s area in this colour, from rendering each flag’s SVG and classifying every pixel by appearance (Qatar’s maroon counts as red); where the official description differs it is followed (Armenia’s apricot counts as orange). Only the flag itself counts for Nepal’s non-rectangular flag.',
      },
      unit: '%',
      file: 'colours/{item}.json',
      dimension: COLOUR_DIMENSION,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 10, 25, 40, 60, 80] } },
      format: (v) => `${fixed(v, v < 10 && v > 0 ? 1 : 0)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
    {
      id: 'main-colour',
      label: { zh: '主要顏色', en: 'Main colour' },
      description: {
        zh: '面積最大的顏色（地圖上的顏色就是那個顏色）；前兩種的面積差不到 2 個百分點的（法國、德國這類三色旗）沒有單一的主要顏色。滑過地圖可以看各色的比例。',
        en: 'The colour with the largest area (shown in that colour); where the top two are within 2 percentage points (tricolours such as France or Germany) there is no single main colour. Hover to see each colour’s share.',
      },
      unit: '',
      file: 'main-colour.json',
      layer: { kind: 'categorical', categories: MAIN_COLOURS },
      format: (v) => categoryLabel(MAIN_COLOURS, v),
    },
    {
      id: 'features',
      label: { zh: '圖案', en: 'On the flag' },
      description: {
        zh: '國旗上有沒有這個圖案（逐一看過每一面旗的清單，跟 Wikidata 的描繪內容核對，不同的地方都查證過）。',
        en: 'Whether the flag shows this feature (a list checked flag by flag and against Wikidata’s “depicts” statements, with every difference verified).',
      },
      unit: '',
      file: 'features/{item}.json',
      dimension: FEATURE_DIMENSION,
      layer: { kind: 'categorical', categories: HAS, other: HAS_NOT },
      format: (v) => categoryLabel(HAS, v, HAS_NOT),
    },
    {
      id: 'family',
      label: { zh: '旗幟家族', en: 'Flag families' },
      description: {
        zh: '設計來自同一個源頭的國旗：北歐十字（源自丹麥）、英國國旗、泛非顏色（衣索比亞的綠黃紅，或非裔運動的紅黑綠）、泛阿拉伯顏色（1916 年阿拉伯起義旗的紅白綠黑）、泛斯拉夫顏色（白藍紅）、大哥倫比亞、中美洲聯邦。只看設計的來源，顏色碰巧相同的（玻利維亞、立陶宛）不算。',
        en: 'Flags whose designs share an origin: the Nordic cross (from Denmark), the Union Jack, pan-African colours (Ethiopia’s green-gold-red or the red-black-green of the African diaspora movement), pan-Arab colours (red, white, green and black from the 1916 Arab Revolt flag), pan-Slavic colours (white, blue, red), Gran Colombia and the Central American Federation. Design origin only: flags with the same colours by coincidence (Bolivia, Lithuania) are not included.',
      },
      unit: '',
      file: 'family.json',
      layer: { kind: 'categorical', categories: FAMILIES, other: NO_FAMILY },
      format: (v) => categoryLabel(FAMILIES, v, NO_FAMILY),
    },
    {
      id: 'adopted',
      label: { zh: '採用年份', en: 'Year adopted' },
      description: {
        zh: '目前這一版國旗開始使用的年份。改了圖案或徽章（包括依新法重新繪製）算新的一版，只改顏色深淺或比例的不算；停用後再採用的算再採用的年份（利比亞 2011、敘利亞 2024）。丹麥的圖案至少從 14 世紀就在使用，這裡寫 1748 年規定商船旗的法令。',
        en: 'The year the current version of the flag came into use. A change of design or emblem (including an official redrawing) makes a new version; a change of shade or proportions does not. A readopted flag counts from its readoption (Libya 2011, Syria 2024). Denmark’s design dates from at least the 14th century; the 1748 merchant-flag ordinance is used here.',
      },
      unit: { zh: '年', en: '' },
      file: 'adopted.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1900, 1945, 1960, 1980, 2000] } },
      format: (v) => tr({ zh: `${year(v)} 年`, en: year(v) }),
      formatTick: year,
      unranked: true,
      lowerIsBetter: true,
      rankingBars: false,
    },
    {
      id: 'ratio',
      label: { zh: '長寬比', en: 'Proportions' },
      description: {
        zh: '國旗的高:寬（依 Commons 的圖檔；跟 Wikidata 不同的幾個已逐一核對）。最多的是 2:3 與 1:2；正方形的只有瑞士與梵蒂岡，不是長方形的只有尼泊爾。滑過地圖可以看確切的比例。',
        en: 'Height to width (from the Commons files; the few that differ from Wikidata were checked). 2:3 and 1:2 are the most common; only Switzerland and the Vatican are square, and only Nepal’s is not rectangular. Hover for the exact proportions.',
      },
      unit: '',
      file: 'ratio.json',
      layer: { kind: 'categorical', categories: RATIOS, other: OTHER_RATIO },
      format: (v) => categoryLabel(RATIOS, v, OTHER_RATIO),
    },
  ],
};

