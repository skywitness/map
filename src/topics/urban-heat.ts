import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { ColorClasses, PointRecord } from './types';

/**
 * 城市熱島（pipeline/topics/urban_heat.py）：Yang 等人的 Global Urban Heat Island Intensity Dataset。
 * 使用者 2026-10-30 決定用「夏季白天的地表溫度熱島」：Aqua 衛星（MYD11A1，下午 1 點半左右）的晴空地表溫度，
 * 作者的 DEA 郊外參考區，北半球 6–8 月、南半球 12–2 月，2003–2021 年。
 */

export const FIRST_YEAR = 2003;
export const LAST_YEAR = 2021;
const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

/** 用真正的減號 */
const signed = (v: number, digits = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fixed(Math.abs(v), digits)}`;
const degrees = (v: number) => `${signed(v)} °C`;

/** 點的分級：負的（比郊外涼）青綠、正的橘色，正的分得比較細（多數城市在 0–7 °C） */
const POINT_THRESHOLDS = [-2, -0.5, 0.5, 2.5, 4.5, 6.5];
const POINT_COLORS = [MAP_TOKENS.diverging[6], MAP_TOKENS.diverging[4], MAP_TOKENS.diverging[3], MAP_TOKENS.sequential[2], MAP_TOKENS.sequential[4], MAP_TOKENS.sequential[5], MAP_TOKENS.sequential[6]];
const UHI_COLORS: ColorClasses = {
  field: 'v',
  title: { zh: '比郊外熱', en: 'Hotter than surroundings' },
  thresholds: POINT_THRESHOLDS,
  classes: POINT_COLORS.map((color, i) => ({
    color,
    label:
      i === 0
        ? `< ${signed(POINT_THRESHOLDS[0])} °C`
        : i === POINT_THRESHOLDS.length
          ? `≥ ${signed(POINT_THRESHOLDS[i - 1])} °C`
          : `${signed(POINT_THRESHOLDS[i - 1])} – ${signed(POINT_THRESHOLDS[i])} °C`,
  })),
};

export function cityName(p: PointRecord, lang = getLang()): string {
  if (lang === 'zh' && typeof p.zh === 'string') return p.zh;
  if (typeof p.name === 'string') return p.name;
  return tr({ zh: `城區 #${String(p.id)}`, en: `Urban area #${String(p.id)}` });
}

/** 城市（cities.ts）的城市熱島部分：2026-10-30（第七批 122）起併進城市 */
export const urbanHeatPart: TopicPart = {
  name: { zh: '城市熱島', en: 'Urban heat' },
  sources: [
    {
      name: {
        zh: 'Yang 等人，Global Urban Heat Island Intensity Dataset（figshare 24821538 v3；Aqua MODIS 的地表溫度）',
        en: 'Yang et al., Global Urban Heat Island Intensity Dataset (figshare 24821538 v3; Aqua MODIS land surface temperature)',
      },
      url: 'https://figshare.com/articles/dataset/Global_Urban_Heat_Island_Intensity_Dataset/24821538',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '城市名稱：JRC GHSL 城市資料庫（GHS-UCDB R2024A）、Wikidata', en: 'City names: JRC GHSL Urban Centre Database (GHS-UCDB R2024A), Wikidata' },
      url: 'https://human-settlement.emergency.copernicus.eu/ghs_ucdb_2024.php',
      license: 'CC BY 4.0 / CC0',
    },
  ],
  note: {
    zh:
      '熱島強度是城區的地表溫度比周圍郊外高幾度：Aqua 衛星大約下午 1 點半過境時量到的晴天地表溫度（MODIS MYD11A1），夏季的平均（北半球 6–8 月、南半球 12–2 月）。郊外參考區用資料作者提出的「動態等面積法」（DEA），選跟城區一樣大、排除水體、地形起伏與其他城區的周圍地區。' +
      '這是地表溫度的熱島，不是氣溫的熱島：屋頂、柏油路在白天曬得比田野、森林燙很多，所以地表溫度的熱島白天、夏天最大；一般說的氣溫的熱島反而是晚上比較明顯（建築物晚上慢慢放熱）。數字因此比氣象站量到的城鄉氣溫差大很多。' +
      '乾燥地區的城市常是負的（比郊外涼）：城裡有灌溉的草地與樹，周圍是曬得很燙的沙漠或裸地（洛杉磯、開羅、利雅德）。' +
      '城區是資料作者依不透水面劃的 10,196 個，只有編號，城市名稱是依位置對到「城市」主題的點（城區範圍內人口最多的城市），對不到的寫「城區 #編號」；國家的值是國內所有城區依面積加權的平均。資料是 CC BY 4.0（Yang et al.）。',
    en:
      'Heat-island intensity is how much hotter an urban area’s land surface is than its surroundings: clear-sky land surface temperature from the Aqua satellite’s pass at about 1:30 pm (MODIS MYD11A1), averaged over summer (June–August in the northern hemisphere, December–February in the southern). The rural reference uses the data authors’ dynamic equal-area method (DEA): surroundings of the same size as the urban area, excluding water, rugged terrain and other urban areas. ' +
      'This is the surface heat island, not the air-temperature one: roofs and asphalt get far hotter in the midday sun than fields and forests, so the surface heat island peaks on summer days, while the usual air-temperature heat island is strongest at night as buildings release heat. The figures are therefore much larger than urban–rural differences at weather stations. ' +
      'Cities in dry regions are often negative (cooler than their surroundings): irrigated lawns and trees in town against sun-baked desert or bare ground outside (Los Angeles, Cairo, Riyadh). ' +
      'The 10,196 urban areas were delineated by the data authors from impervious surfaces and carry only numbers; names come from matching them by position to the dots of the Cities topic (the most populous city within the area), otherwise “Urban area #number”. Country values are area-weighted averages over all urban areas in the country. Data CC BY 4.0 (Yang et al.).',
  },
  panelExtra: () => import('./panels/UrbanHeatPanel'),
  overlays: [
    {
      kind: 'points',
      id: 'areas',
      file: 'uhi-areas.json',
      label: { zh: '城區（夏季白天的熱島）', en: 'Urban areas (summer daytime)' },
      radius: { field: 'area', stops: [[10, 1.6], [100, 2.8], [1000, 5.5], [10000, 11]] },
      color: UHI_COLORS,
      sortField: 'area',
      epochs: {
        years: YEARS,
        values: (p, year) => {
          const v = p[`y${year}`];
          return typeof v === 'number' ? { v, s: Number(p.area) } : { v: null, s: null };
        },
      },
      // 縮小時只畫大的城區（世界全圖 300 km² 以上約 120 個），沒有那一年的值的不畫
      minValue: { field: 's', stops: [[0, 300], [2, 150], [3, 60], [4, 25], [5, 0]] },
      tooltip: (p, ctx) => {
        const v = p[`y${ctx.year}`];
        const country = typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null;
        const name = cityName(p);
        return {
          title: name,
          detail: [
            typeof v === 'number' ? tr({ zh: `${ctx.year} 年夏季白天比郊外 ${degrees(v)}`, en: `${degrees(v)} vs surroundings, summer days ${ctx.year}` }) : null,
            country,
          ]
            .filter(Boolean)
            .join(' · '),
          extra: [
            [
              typeof p.avg === 'number' ? tr({ zh: `${FIRST_YEAR}–${LAST_YEAR} 年平均 ${degrees(p.avg)}`, en: `${FIRST_YEAR}–${LAST_YEAR} average ${degrees(p.avg)}` }) : null,
              tr({ zh: `城區 ${fixed(Number(p.area), 0)} km²`, en: `urban area ${fixed(Number(p.area), 0)} km²` }),
            ]
              .filter(Boolean)
              .join(' · '),
          ],
          properNoun: getLang() === 'zh' && typeof p.zh === 'string' && typeof p.name === 'string' && p.name !== p.zh ? p.name : undefined,
        };
      },
    },
  ],
  indicators: [
    {
      id: 'uhi',
      label: { zh: '夏季白天的地表熱島', en: 'Summer daytime surface heat island' },
      description: {
        zh: '城市的地表溫度比周圍郊外高幾度（衛星在夏季晴天下午量的，不是氣溫）。點是每個城區，國家是所有城區依面積加權的平均；乾燥地區的城市常比郊外涼（負值）。',
        en: 'How much hotter cities’ land surfaces are than their surroundings (measured by satellite on clear summer afternoons – not air temperature). Dots are individual urban areas; country values are area-weighted averages. Cities in dry regions are often cooler than their surroundings (negative).',
      },
      unit: '°C',
      file: 'uhi.json',
      defaultYear: LAST_YEAR,
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-4, -2, -0.5, 0.5, 2, 4], reverse: true } },
      format: degrees,
      formatTick: (v) => signed(v, Number.isInteger(v) ? 0 : 1),
      compareWorld: true,
    },
  ],
};
