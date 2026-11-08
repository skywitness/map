import { getLang, tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatPercent } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { LAND_MOTION_INDICATOR, LAND_MOTION_SOURCES, LAND_MOTION_STATIONS } from './land-motion';
import type { ColorClasses, IndicatorDef, PointRecord, Text, TopicDefinition } from './types';

const M = { zh: '公尺', en: 'm' };
const PERCENT = '%';
/** 海拔用真正的減號（−442 公尺），不用連字號 */
const signed = (v: number, digits = 0) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), digits)}`;
const metres = (v: number) => `${signed(v, Math.abs(v) < 10 && v % 1 !== 0 ? 1 : 0)} ${tr(M)}`;
const share = (v: number) => formatPercent(v, v > 0 && v < 1 ? 2 : 1);

function above(threshold: number): IndicatorDef {
  const label = fixed(threshold, 0);
  return {
    id: `above-${threshold}`,
    label: { zh: `海拔 ${label} 公尺以上的土地`, en: `Land above ${label} m` },
    description: {
      zh: `海拔 ${label} 公尺以上的土地占全國陸地面積的比例（含湖面，依緯度換算成實際面積）。`,
      en: `Share of the country's land area (lakes included, weighted by true cell area) that lies above ${label} m.`,
    },
    unit: PERCENT,
    file: `above/${threshold}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 40, 60, 80] } },
    format: share,
    formatTick: (v) => fixed(v, 0),
  };
}

/** 山系的名稱（pipeline/topics/mountains.py：n 英文、z 中文）：中文介面用中文，英文介面用英文 */
function rangeName(p: PointRecord): string {
  return getLang() === 'zh' && typeof p.z === 'string' && p.z ? p.z : String(p.n ?? '');
}

function rangeTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const countries = typeof p.c === 'string' && p.c ? p.c.split(',') : [];
  const shown = countries.slice(0, 4).map((c) => ctx.countryName(c));
  const more = countries.length - shown.length;
  const where = more > 0 ? tr({ zh: `${shown.join('、')}等 ${countries.length} 國`, en: `${shown.join(', ')} and ${more} more` }) : shown.join(tr({ zh: '、', en: ', ' }));
  const name = rangeName(p);
  return {
    title: name,
    detail: typeof p.s === 'number' ? tr({ zh: `山區面積 ${fixed(p.s, 0)} 平方公里`, en: `Mountain area ${fixed(p.s, 0)} km²` }) : undefined,
    extra: where ? [where] : undefined,
    properNoun: getLang() === 'zh' && name !== p.n ? String(p.n ?? '') : undefined,
  };
}

/** 地形區的種類（pipeline/topics/landforms.py 的 CLASSES）：1 沙漠、2 高原、3 盆地與窪地、4 平原與低地 */
const LANDFORMS: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '沙漠', en: 'Desert' }, color: MAP_TOKENS.categorical[2] },
  { value: 2, label: { zh: '高原', en: 'Plateau' }, color: MAP_TOKENS.categorical[6] },
  { value: 3, label: { zh: '盆地與窪地', en: 'Basin or depression' }, color: MAP_TOKENS.categorical[0] },
  { value: 4, label: { zh: '平原與低地', en: 'Plain or lowland' }, color: MAP_TOKENS.categorical[3] },
];
const LANDFORM_COLORS: ColorClasses = {
  field: 't',
  title: { zh: '種類', en: 'Type' },
  thresholds: [1.5, 2.5, 3.5],
  classes: LANDFORMS.map(({ label, color }) => ({ label, color })),
};

function landformTooltip(p: PointRecord) {
  const name = rangeName(p);
  return {
    title: name,
    detail: tr(LANDFORMS.find((l) => l.value === p.t)?.label ?? ''),
    properNoun: getLang() === 'zh' && name !== p.n ? String(p.n ?? '') : undefined,
  };
}

export const elevation: TopicDefinition = {
  id: 'elevation',
  title: { zh: '各國海拔與地形', en: 'Elevation and terrain by country' },
  shortTitle: { zh: '海拔', en: 'Elevation' },
  defaultIndicator: 'terrain',
  defaultYear: 2010,
  timeless: true,
  terrain: true,
  sources: [
    {
      name: { zh: 'USGS GMTED2010（30 角秒數值高程模型）', en: 'USGS GMTED2010 (30 arc-second elevation model)' },
      url: 'https://www.usgs.gov/coastal-changes-and-impacts/gmted2010',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: 'Wikidata（各國最高點、最低點的名稱與標高）', en: 'Wikidata (names and heights of highest and lowest points)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
    {
      name: { zh: 'GMBA 山脈名錄 v2（291 個主要山系）', en: 'GMBA Mountain Inventory v2 (291 major mountain systems)' },
      url: 'https://www.earthenv.org/mountains',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'JRC GHS-POP R2023A 2020 年 30 角秒人口網格（住在山區的人、人口加權平均海拔）',
        en: 'JRC GHS-POP R2023A, 2020, 30 arc-second population grid (mountain population and population-weighted elevation)',
      },
      url: 'https://doi.org/10.2905/2FF68A52-5B5B-4A22-8F40-C41DA8332CFE',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Natural Earth 1:10m 地理區（沙漠、高原、盆地、平原的範圍與名稱）', en: 'Natural Earth 1:10m geography regions (deserts, plateaus, basins and plains)' },
      url: 'https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-physical-labels/',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: {
        zh: 'Nunn & Puga（2012），Ruggedness: The Blessing of Bad Geography in Africa 的重製資料（Harvard Dataverse，地形崎嶇指數）',
        en: 'Nunn & Puga (2012), Ruggedness: The Blessing of Bad Geography in Africa, replication data (Harvard Dataverse; terrain ruggedness)',
      },
      url: 'https://doi.org/10.7910/DVN/VEHPPS',
      license: 'CC0 1.0',
    },
    {
      name: { zh: '內政部 100 公尺數值高程模型（台灣交叉比對）', en: 'Ministry of the Interior 100 m DEM (Taiwan cross-check)' },
      url: 'https://data.gov.tw/dataset/7507',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: { zh: 'Terrain Tiles（地圖上的地形，Mapzen、AWS Open Data）', en: 'Terrain Tiles (map relief; Mapzen, AWS Open Data)' },
      url: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
      license: { zh: '依各資料來源標示', en: 'attribution per data source' },
    },
    ...LAND_MOTION_SOURCES,
  ],
  note: {
    zh: '統計用 GMTED2010 的 1 公里網格（主要來自 2000 年的 SRTM 雷達測高，量的是地表，含樹冠與建築），每格依緯度換算成實際面積；國界是地圖用的 Natural Earth 1:50m 簡化國界，法國海外省等依聯合國的劃分分開計算。網格會把山頂平均掉，所以最高點優先用 Wikidata 的標高（DEM 對得上才採用）。沿海低地是海拔低於 5 公尺、而且跟海相連的陸地，裏海窪地這類內陸窪地不算。',
    en: 'Statistics use the 1 km GMTED2010 grid (mostly from the 2000 SRTM radar survey, which measures the surface including tree canopy and buildings), with each cell weighted by its true area; borders are the simplified Natural Earth 1:50m borders used on the map, with French overseas departments and similar areas split out as in UN statistics. Grids smooth out summits, so highest points use Wikidata heights where the DEM agrees. Low-lying coastal land is land below 5 m that is connected to the sea; inland depressions such as the Caspian Depression are excluded.',
  },
  overlays: [
    {
      kind: 'lines',
      id: 'mountains',
      file: 'mountains.json',
      label: { zh: '山脈（GMBA）', en: 'Mountain ranges (GMBA)' },
      width: 0.6,
      color: MAP_TOKENS.ink,
      opacity: 0.45,
      fill: { field: 'f', value: 1, opacity: 0.12, darkOpacity: 0.16, holeField: 'k', hover: true },
      groupField: 'r',
      tooltip: rangeTooltip,
      indicators: ['terrain', 'mountain'],
    },
    {
      kind: 'points',
      id: 'mountain-names',
      file: 'mountain-labels.json',
      label: { zh: '山脈的名稱', en: 'Mountain range names' },
      radius: 0,
      color: MAP_TOKENS.ink,
      sortField: 's',
      pointLabel: rangeName,
      tooltip: rangeTooltip,
      indicators: ['terrain', 'mountain'],
    },
    {
      kind: 'lines',
      id: 'landforms',
      file: 'landforms.json',
      label: { zh: '沙漠、高原、盆地與平原（Natural Earth）', en: 'Deserts, plateaus, basins and plains (Natural Earth)' },
      width: 0.6,
      // 線與面的顏色依種類（types 跟 LANDFORMS 的 value 一樣）
      color: { title: { zh: '種類', en: 'Type' }, classes: LANDFORMS.map(({ value, label, color }) => ({ value, label, color })) },
      opacity: 0.55,
      fill: { field: 'f', value: 1, opacity: 0.16, darkOpacity: 0.2, holeField: 'k', hover: true },
      groupField: 'r',
      tooltip: landformTooltip,
      indicators: ['landforms'],
    },
    {
      kind: 'points',
      id: 'landform-names',
      file: 'landform-labels.json',
      label: { zh: '地形區的名稱', en: 'Landform names' },
      radius: 0,
      color: LANDFORM_COLORS,
      // 縮小時只標 Natural Earth 的大的（SCALERANK 小），放大才標小的
      minValue: { field: 'ns', stops: [[0, -3], [3, -5], [5, -9]] },
      sortField: 'ns',
      pointLabel: rangeName,
      tooltip: landformTooltip,
      indicators: ['landforms'],
    },
    // 2026-11-08（製作手冊第二十七批 547，候選 1234）：GNSS 測站的垂直速度（land-motion.ts）
    LAND_MOTION_STATIONS,
  ],
  panelExtra: () => import('./panels/ElevationPanel'),
  indicators: [
    {
      id: 'terrain',
      label: { zh: '地形', en: 'Terrain' },
      description: {
        zh: '依海拔分層設色，加上地形陰影，放大後越來越細；滑鼠移到國家上可看平均海拔。按右上角的「3D」看立體地形。',
        en: 'Elevation tints with hillshading that sharpen as you zoom in; hover over a country to see its mean elevation. Press “3D” at the top right for 3D terrain.',
      },
      unit: M,
      file: 'mean.json',
      layer: { kind: 'terrain' },
      format: (v) => tr({ zh: `平均海拔 ${metres(v)}`, en: `Mean elevation: ${metres(v)}` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'landforms',
      label: { zh: '沙漠、高原與平原', en: 'Deserts, plateaus and plains' },
      description: {
        zh: '世界的沙漠、高原、盆地、平原與窪地（Natural Earth 給地圖標名稱用的範圍，邊界很粗、彼此重疊），疊在地形上；滑過看名稱。撒哈拉、戈壁、喀拉哈里、魯卜哈利沙漠，青藏、德干、蒙古、巴西高原，剛果、亞馬遜、塔里木盆地，華北平原、北歐平原、美國大平原、彭巴草原。山脈另外在「地形」與「國土在山區的比例」畫。',
        en: 'The world’s deserts, plateaus, basins, plains and depressions (Natural Earth’s areas for placing map labels, so the outlines are rough and overlap) over the terrain; hover for names. The Sahara, Gobi, Kalahari and Rub’ al Khali deserts; the Tibetan, Deccan, Mongolian and Brazilian plateaus; the Congo, Amazon and Tarim basins; the North China Plain, the North European Plain, the Great Plains and the Pampas. Mountain ranges are on the Terrain and mountain-area maps.',
      },
      unit: M,
      file: 'mean.json',
      layer: { kind: 'terrain' },
      format: (v) => tr({ zh: `平均海拔 ${metres(v)}`, en: `Mean elevation: ${metres(v)}` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'mountain',
      label: { zh: '國土在山區的比例', en: 'Land in mountain areas' },
      description: {
        zh: '國土落在 GMBA 山區裡的比例。GMBA 依地形起伏（附近的高低差）劃出山區，不只看海拔：高原上平坦的地方不算，低海拔的陡峭丘陵也算。不丹 99%、尼泊爾 81%、瑞士 68%、台灣 64%、日本 54%，荷蘭是 0。灰色的範圍是 291 個主要山系，滑過看名稱；以島嶼、群島命名的只包括島上的山區。',
        en: 'Share of the country’s land inside GMBA mountain areas. GMBA draws mountains by ruggedness (local differences in elevation), not altitude alone: flat plateaus are excluded and steep low hills are included. Bhutan 99%, Nepal 81%, Switzerland 68%, Taiwan 64%, Japan 54%; the Netherlands 0. The grey areas are 291 major mountain systems; hover for names. Systems named after islands or archipelagos cover only their mountainous parts.',
      },
      unit: PERCENT,
      file: 'mountain.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 40, 60, 80] } },
      format: share,
      formatTick: (v) => fixed(v, 0),
    },
    // 2026-11-07（製作手冊第二十七批 547，候選 1233）：住在山上的人（pipeline/topics/mountain_people.py）
    {
      id: 'mountain-pop-share',
      label: { zh: '住在山區的人口比例', en: 'People living in mountains' },
      description: {
        zh: '全國人口住在 GMBA 山區裡的比例（2020 年，JRC GHS-POP 的 1 公里人口網格）。安道爾 100%、摩納哥 99.6% 幾乎全國都在山系裡；人口百萬以上的國家裡東帝汶 68.0% 最高，其次葉門 62.9%、瓜地馬拉 61.3%、宏都拉斯 59.3%、賴索托 50.6%、盧安達 48.8%、巴布亞紐幾內亞 48.0%、海地 46.8%、黎巴嫩與衣索比亞 44.4%、秘魯 43.4%；不丹 91.2%、蒙特內哥羅 58.0%、尼泊爾 36.2%、瑞士 27.0%、中國大陸 12.7%、日本 7.6%、台灣 5.9%、美國 2.3%，荷蘭 0。全世界約 7.5 億人、9.6%。「山區」各家定義不同：GMBA 依地形起伏劃，高原上平坦的地方不算（賴索托全國都在 1,400 公尺以上，也只有一半的人住在「山區」）；FAO 用另一種定義，算出 2017 年全球山區人口近 11 億、15%。一些小島整個被畫進山系（法屬玻里尼西亞 73.0%、葛摩 72.4%），比例偏高。點國家看人口最多的山系。',
        en: 'Share of the population living inside GMBA mountain areas (2020, from the JRC GHS-POP 1 km population grid). Andorra (100%) and Monaco (99.6%) lie almost entirely within mountain systems; among countries of over a million people Timor-Leste is highest at 68.0%, followed by Yemen 62.9%, Guatemala 61.3%, Honduras 59.3%, Lesotho 50.6%, Rwanda 48.8%, Papua New Guinea 48.0%, Haiti 46.8%, Lebanon and Ethiopia 44.4% and Peru 43.4%; Bhutan 91.2%, Montenegro 58.0%, Nepal 36.2%, Switzerland 27.0%, mainland China 12.7%, Japan 7.6%, Taiwan 5.9%, the US 2.3% and the Netherlands 0. Worldwide about 750 million people, 9.6%. Definitions of “mountain” differ: GMBA uses ruggedness, so flat plateaus are excluded (all of Lesotho lies above 1,400 m, yet only half its people live in “mountains”); FAO, with another definition, counted nearly 1.1 billion mountain people (15%) in 2017. Some small islands fall entirely within a mountain system (French Polynesia 73.0%, Comoros 72.4%), which inflates their shares. Select a country for its most populous mountain systems.',
      },
      unit: PERCENT,
      file: 'mountain-pop-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 40, 60] } },
      format: share,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'mountain-pop',
      label: { zh: '住在山區的人數', en: 'Mountain population' },
      description: {
        zh: '住在 GMBA 山區裡的人數（2020 年，GHS-POP；比例圓）。中國大陸 1.81 億（雲貴高原 6,280 萬最多）、衣索比亞 5,166 萬、印度 3,736 萬、印尼 3,210 萬、墨西哥 2,628 萬、巴基斯坦 2,066 萬、葉門 2,032 萬、土耳其 1,771 萬、哥倫比亞 1,771 萬、秘魯 1,444 萬、義大利 1,408 萬；台灣 139 萬。',
        en: 'Number of people living inside GMBA mountain areas (2020, GHS-POP; proportional circles). Mainland China 181 million (62.8 million on the Yunnan–Guizhou Plateau alone), Ethiopia 51.7 million, India 37.4 million, Indonesia 32.1 million, Mexico 26.3 million, Pakistan 20.7 million, Yemen 20.3 million, Turkey 17.7 million, Colombia 17.7 million, Peru 14.4 million and Italy 14.1 million; Taiwan 1.39 million.',
      },
      unit: { zh: '人', en: 'people' },
      file: 'mountain-pop.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 人`, en: `${formatLargeNumber(v)} people` }),
      formatTick: (v) => formatLargeNumber(v),
      integer: true,
      shareOfWorld: true,
    },
    {
      id: 'pop-elevation',
      label: { zh: '人住在多高（人口加權平均海拔）', en: 'Population-weighted elevation' },
      description: {
        zh: '一國的人平均住在幾公尺高：GHS-POP 2020 年每一格的人口乘上 GMTED2010 的海拔再平均。玻利維亞 2,172 公尺最高，衣索比亞 1,966、賴索托 1,803、盧安達 1,685、蒲隆地 1,484、阿富汗 1,385、肯亞 1,365、葉門 1,351、蒙古 1,343、墨西哥 1,289；全世界平均 378 公尺。人口百萬以上的國家裡最低的是巴林 8、荷蘭 9、孟加拉 16、卡達 19 公尺。台灣 61 公尺、日本 62 公尺：國土的平均海拔是 785 與 393 公尺，人卻幾乎都住在平原與盆地。尼泊爾 652 公尺（一半的人住在南部的特萊平原）、瑞士 539 公尺。群島與城邦的數字只代表那幾個市鎮。',
        en: 'How high, on average, a country’s people live: each GHS-POP 2020 grid cell’s population times its GMTED2010 elevation, averaged. Bolivia is highest at 2,172 m, followed by Ethiopia 1,966, Lesotho 1,803, Rwanda 1,685, Burundi 1,484, Afghanistan 1,385, Kenya 1,365, Yemen 1,351, Mongolia 1,343 and Mexico 1,289; the world average is 378 m. Among countries of over a million people the lowest are Bahrain 8, the Netherlands 9, Bangladesh 16 and Qatar 19 m. Taiwan is 61 m and Japan 62 m: their land averages 785 and 393 m, but almost everyone lives on plains and in basins. Nepal is 652 m (half its people live on the southern Terai plains) and Switzerland 539 m. For archipelagos and city-states the figure only reflects a few towns.',
      },
      unit: M,
      file: 'pop-elevation.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 100, 200, 500, 1000, 1500] } },
      format: metres,
      formatTick: (v) => fixed(v, 0),
    },
    // 2026-11-08（製作手冊第二十七批 547，候選 1234）：國土一年升降幾公釐（pipeline/topics/land_motion.py）
    LAND_MOTION_INDICATOR,
    {
      id: 'rugged',
      label: { zh: '地形崎嶇指數', en: 'Terrain ruggedness' },
      description: {
        zh: 'Nunn 與 Puga（2012）算的地形崎嶇指數（Terrain Ruggedness Index）：約 1 公里的網格裡，每一格跟周圍 8 格的海拔差的平均起伏，再對全國平均，單位是百公尺（1 是平均起伏約 100 公尺）。直布羅陀 7.8、不丹 6.7、摩納哥、賴索托、安道爾最崎嶇，尼泊爾 5.0、瑞士 4.8、台灣 3.5（第 17）、日本 2.1、中國 1.9、美國 1.1，荷蘭 0.04。小島國的網格太粗，數字可能偏低。',
        en: 'The terrain ruggedness index computed by Nunn and Puga (2012): for each cell of a roughly 1 km grid, the typical difference in elevation from its eight neighbours, averaged over the country, in hundreds of metres (1 means about 100 m of local relief). Gibraltar (7.8), Bhutan (6.7), Monaco, Lesotho and Andorra are the most rugged; Nepal 5.0, Switzerland 4.8, Taiwan 3.5 (17th), Japan 2.1, China 1.9, the US 1.1 and the Netherlands 0.04. The grid is too coarse for very small islands, whose values may be too low.',
      },
      unit: { zh: '百公尺', en: '100 m' },
      file: 'rugged.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.25, 0.5, 1, 2, 3, 5] } },
      format: (v) => tr({ zh: `${fixed(v, 2)}（起伏約 ${fixed(v * 100, 0)} 公尺）`, en: `${fixed(v, 2)} (≈${fixed(v * 100, 0)} m relief)` }),
      formatTick: (v) => fixed(v, v < 1 ? 2 : 0),
    },
    {
      id: 'mean',
      label: { zh: '平均海拔', en: 'Mean elevation' },
      description: {
        zh: '全國陸地的平均海拔（每格依緯度換算成實際面積再平均）。',
        en: 'Average elevation of all land in the country, weighting each grid cell by its true area.',
      },
      unit: M,
      file: 'mean.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [100, 200, 500, 1000, 1500, 2000] } },
      format: metres,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'highest',
      label: { zh: '最高點', en: 'Highest point' },
      description: {
        zh: '全國最高的山頂。名稱與標高來自 Wikidata（DEM 對得上才採用），沒有的用 DEM 網格的最高格；側欄有名稱與位置。',
        en: 'The highest summit in the country. Names and heights come from Wikidata where the DEM agrees, otherwise the highest DEM cell is used; the side panel shows the name and location.',
      },
      unit: M,
      file: 'highest.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [500, 1000, 2000, 3000, 4000, 5000] } },
      format: metres,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'lowest',
      label: { zh: '最低點', en: 'Lowest point' },
      description: {
        zh: '全國最低的地方：靠海的國家通常是海平面（0 公尺），死海、蓋塔拉窪地這類窪地低於海平面，內陸國是邊境的河谷或湖面。',
        en: 'The lowest place in the country: sea level (0 m) for most coastal countries, below sea level in depressions such as the Dead Sea or the Qattara Depression, and a border valley or lake for landlocked countries.',
      },
      unit: M,
      file: 'lowest.json',
      // 以海平面為中點：低於海平面一種色相、高於海平面另一種，靠海的國家（0 公尺）是中性灰
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-100, -10, -1, 1, 100, 500] } },
      format: (v) => (v === 0 ? tr({ zh: '0 公尺（海平面）', en: '0 m (sea level)' }) : metres(v)),
      formatTick: (v) => signed(v),
    },
    {
      id: 'below-sea',
      label: { zh: '低於海平面的土地', en: 'Land below sea level' },
      description: {
        zh: '海拔低於 0 公尺的土地占全國陸地的比例（1 公里網格的平均，細碎的圩田會被平均掉）。52 國有：亞塞拜然 17.8%（裏海沿岸的庫拉河低地）、巴勒斯坦 15.0%（約旦河谷與死海）、荷蘭 12.4%、以色列 6.8%、哈薩克 5.8%（面積最大，約 15.6 萬平方公里）、土庫曼 4.8%、約旦 2.8%、埃及 2.3%（蓋塔拉窪地）。荷蘭常說約四分之一低於海平面，網格把圩田與堤防平均掉了；台灣是 0。',
        en: 'Share of land below 0 m (averaged over the 1 km grid, which smooths out small polders). 52 countries have some: Azerbaijan 17.8% (the Kura lowland on the Caspian), Palestine 15.0% (the Jordan valley and Dead Sea), the Netherlands 12.4%, Israel 6.8%, Kazakhstan 5.8% (the largest area, about 156,000 km²), Turkmenistan 4.8%, Jordan 2.8% and Egypt 2.3% (the Qattara Depression). The Netherlands is often said to be about a quarter below sea level; the grid averages away polders and dykes. Taiwan has none.',
      },
      unit: PERCENT,
      file: 'below-sea.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.1, 0.5, 1, 2, 5, 10] } },
      format: share,
      formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
      missing: { zh: '沒有低於海平面的土地', en: 'No land below sea level' },
    },
    above(500),
    above(1000),
    above(2000),
    {
      id: 'lowland',
      label: { zh: '沿海低地', en: 'Low-lying coastal land' },
      description: {
        zh: '海拔低於 5 公尺、而且跟海相連的土地占全國陸地的比例，是海平面上升與暴潮最先影響的地方（DEM 量的是地表，樹林、城市會被高估，實際可能更多）。',
        en: 'Share of land below 5 m that is connected to the sea, the area most exposed to sea-level rise and storm surges (the DEM measures the surface, so forests and cities read too high and the true share may be larger).',
      },
      unit: PERCENT,
      file: 'lowland.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 20] } },
      format: share,
      formatTick: (v) => fixed(v, v < 1 ? 1 : 0),
    },
    {
      id: 'slope',
      label: { zh: '平均坡度', en: 'Mean slope' },
      description: {
        zh: '全國陸地的平均坡度，用 1 公里網格計算（比實際的坡度平緩，但各國可以互相比較），數字越大地形越崎嶇。',
        en: 'Average slope of the land, computed on the 1 km grid (gentler than real slopes, but comparable between countries); higher means more rugged terrain.',
      },
      unit: { zh: '度', en: 'degrees' },
      file: 'slope.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 4, 6, 9, 12] } },
      format: (v) => `${fixed(v, 1)}°`,
      formatTick: (v) => `${fixed(v, 0)}°`,
    },
  ],
};

