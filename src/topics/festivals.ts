import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 節慶（pipeline/topics/festivals.py）：Wikidata 的節慶點依月份篩選，台灣用文化資產局的民俗補。
 * 使用者 2026-10-29 決定：主題叫「節慶」（「大型」排不出來），台灣用文資局的民俗。
 * 2026-10-31（第十二批 190）：左邊「這個月的節慶」清單，跟時間軸的月份連動。
 */

/** 種類（pipeline 的 KIND_WORDS 的代碼；2 沒有用） */
export const KINDS: { value: number; label: Text }[] = [
  { value: 1, label: { zh: '傳統、宗教與民俗節慶', en: 'Traditional, religious and folk' } },
  { value: 3, label: { zh: '電影節', en: 'Film festival' } },
  { value: 4, label: { zh: '藝術節', en: 'Arts festival' } },
  { value: 5, label: { zh: '嘉年華', en: 'Carnival' } },
  { value: 6, label: { zh: '美食與飲酒節', en: 'Food and drink festival' } },
  { value: 7, label: { zh: '其他節慶', en: 'Other festival' } },
];
export const kindLabel = (k: unknown) => tr(KINDS.find((x) => x.value === k)?.label ?? '');

const KIND_COLORS: ColorClasses = {
  field: 'k',
  title: { zh: '種類', en: 'Type' },
  thresholds: [2, 3.5, 4.5, 5.5, 6.5],
  classes: [
    { color: MAP_TOKENS.categorical[7], label: KINDS[0].label },
    { color: MAP_TOKENS.categorical[1], label: KINDS[1].label },
    { color: MAP_TOKENS.categorical[0], label: KINDS[2].label },
    { color: MAP_TOKENS.categorical[2], label: KINDS[3].label },
    { color: MAP_TOKENS.categorical[3], label: KINDS[4].label },
    { color: MAP_TOKENS.context, label: KINDS[5].label },
  ],
};

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (m: number) => tr({ zh: `${m} 月`, en: MONTHS_EN[m - 1] ?? String(m) });

export function festivalName(p: PointRecord): string {
  return String((getLang() === 'zh' ? p.zh : null) ?? p.en ?? p.zh ?? '');
}

/** 英文版裡只有中文名稱的（文資局登錄的台灣民俗）：名稱是不翻譯的原文 */
export function nameIsOriginal(p: PointRecord): boolean {
  return getLang() === 'en' && typeof p.en !== 'string';
}

/** 種類 · 月份（文資局的寫「文化資產」） */
export function festivalFacts(p: PointRecord): string {
  const parts = [kindLabel(p.k)];
  if (typeof p.m === 'number') parts.push(monthName(p.m));
  if (p.src === 2) parts.push(p.imp === 1 ? tr({ zh: '重要民俗', en: 'important folk custom' }) : tr({ zh: '登錄的民俗', en: 'registered folk custom' }));
  return parts.join(' · ');
}

function layer(id: string, file: string, label: Text, dated: boolean): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file,
    label,
    radius: dated ? { field: 'sl', stops: [[0, 4], [20, 5], [60, 7]] } : { field: 'sl', stops: [[0, 2], [20, 2.8], [60, 4]] },
    color: KIND_COLORS,
    sortField: 'sl',
    // 疊到別的主題上（時間軸是年份，不是月份）時全部畫
    ...(dated ? { timeField: 'm', shareable: 'untimed' as const } : {}),
    tooltip: (p, ctx) => {
      const name = festivalName(p);
      const country = typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null;
      // 英文版裡只有中文名稱的：第一行寫種類，中文名稱放在不翻譯的原文那一行
      if (nameIsOriginal(p)) return { title: festivalFacts(p), detail: country ?? undefined, properNoun: name };
      return {
        title: name,
        detail: [festivalFacts(p), country].filter(Boolean).join(' · '),
        properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
      };
    },
  };
}

/**
 * 這個月的節慶（第十二批 190）：時間軸那個月、有月份的節慶；有固定日子的依日子（文資局農曆的用農曆的日，
 * 跟月份一樣當成大約的國曆），其他依名稱。每列：名稱、國家與城市、日期
 */
const MONTH_LIST: ListPanelDef = {
  label: { zh: '這個月的節慶', en: 'Festivals this month' },
  file: 'festivals.json',
  empty: { zh: '這個月沒有標了月份的節慶', en: 'No festivals with a known date this month' },
  rows: (points, { countryName, year }) => {
    const name = festivalName;
    return points
      .filter((p) => p.m === year)
      .sort((a, b) => {
        const da = typeof a.d === 'number' ? a.d : Infinity;
        const db = typeof b.d === 'number' ? b.d : Infinity;
        return da - db || name(a).localeCompare(name(b), getLang() === 'zh' ? 'zh-Hant-TW' : 'en');
      })
      .map((p, i): ListRow => {
        const zh = getLang() === 'zh';
        const place = zh ? (p.pz ?? p.pe) : p.pe;
        const country = typeof p.iso3 === 'string' ? countryName(p.iso3) : null;
        const date = zh ? p.dz : p.de;
        const original = nameIsOriginal(p);
        return {
          key: `${i}-${name(p)}`,
          title: name(p),
          titleProper: original,
          lines: [[country, typeof place === 'string' && place !== country ? place : null].filter(Boolean).join(' · '), typeof date === 'string' ? date : monthName(year)].filter(Boolean),
          properNoun: !original && zh && typeof p.en === 'string' && p.en !== name(p) ? p.en : undefined,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
        };
      });
  },
};

const MONTH_AXIS = {
  label: { zh: '月份', en: 'Month' } as Text,
  year: monthName,
  tick: (m: number) => tr({ zh: `${m} 月`, en: MONTHS_EN[m - 1]?.slice(0, 3) ?? String(m) }),
};

export const festivals: TopicDefinition = {
  id: 'festivals',
  title: { zh: '節慶', en: 'Festivals' },
  shortTitle: { zh: '節慶', en: 'Festivals' },
  defaultIndicator: 'map',
  defaultYear: 2,
  sources: [
    { name: { zh: 'Wikidata（節慶的種類、位置、舉辦的日子、名稱）', en: 'Wikidata (types, locations, dates and names of festivals)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: '文化部文化資產局「文資局民俗」（台灣登錄的民俗）', en: 'Bureau of Cultural Heritage (Taiwan): registered folk customs' },
      url: 'https://data.gov.tw/dataset/114143',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh:
      '節慶是 Wikidata 直接標成節慶或它的子類別（電影節、藝術節、嘉年華、美食節、民俗節慶…）、有位置的約 1,760 個，加上文化資產局登錄的台灣民俗裡「儀式、祭典、節慶」類的 226 項。Wikidata 的節慶以歐美為主、電影節占三分之一，各國收得多少不一。' +
      '月份用 Wikidata 的「每年發生的日子」，只有約 40 個有，多數畫在「月份不詳」的圖層（不隨時間軸變）；文資局的民俗有舉辦月份的照月份出現，農曆的月份加一個月當成大約的國曆月份。' +
      '文資局的地址只到鄉鎮市區，點在鄉鎮市區的位置（Wikidata 的座標；只寫縣市的在縣市的中間）。' +
      '左邊的清單列出那個月有月份的節慶：有固定日子的依日子排（文資局農曆的照農曆寫，依農曆的日排），其他依名稱；城市用 Wikidata 的所在行政區與文資局的地址。',
    en:
      'Festivals are about 1,760 Wikidata items classed as festivals or a subclass (film, arts, carnival, food, folk festivals and so on) with a location, plus the 226 registered folk customs in the “rituals, ceremonies and festivals” class of Taiwan’s Bureau of Cultural Heritage. Wikidata’s festivals are mostly in Europe and the Americas, a third are film festivals, and coverage varies by country. ' +
      'Months come from Wikidata’s “day in year for periodic occurrence”, which only about 40 have, so most are in the “month unknown” layer (which does not change with the slider); Taiwan’s folk customs appear in their month where it is given, with lunar months shifted by one as an approximate calendar month. ' +
      'The bureau gives only the township, so Taiwanese customs are placed at the township (Wikidata coordinates; those giving only a county at its centre). ' +
      'The list on the left shows the festivals with a known month: those with a fixed day come first in date order (Taiwanese lunar dates are written as lunar dates and ordered by the lunar day), the rest by name; places come from Wikidata’s administrative location and the bureau’s addresses.',
  },
  panelExtra: () => import('./panels/FestivalsPanel'),
  listPanel: MONTH_LIST,
  overlays: [
    layer('festivals', 'festivals.json', { zh: '有月份的節慶（依月份）', en: 'Festivals with a month (by month)' }, true),
    layer('festivals-undated', 'festivals-undated.json', { zh: '月份不詳的節慶', en: 'Festivals, month unknown' }, false),
  ],
  indicators: [
    {
      id: 'map',
      label: { zh: '節慶地圖', en: 'Festival map' },
      description: {
        zh: '世界的節慶，依種類上色：傳統與民俗節慶、電影節、藝術節、嘉年華、美食節。拖動月份看那個月舉辦的（只有有月份的會跟著變，台灣的民俗大多有）；小點是月份不詳的。台灣有大甲媽祖遶境進香、鷄籠中元祭、東港迎王平安祭典、鄒族戰祭等文化資產局登錄的民俗。滑過看名稱，點國家列出它的節慶；左邊的清單列出那個月的節慶與日期。',
        en: 'Festivals around the world, coloured by type: traditional and folk festivals, film and arts festivals, carnivals and food festivals. Move the month slider to see what happens in each month (only festivals with a known month change, which includes most of Taiwan’s folk customs); small dots have no known month. Taiwan’s registered folk customs include the Dajia Mazu pilgrimage, the Keelung Ghost Festival, the Donggang King Boat Festival and the Tsou Mayasvi. Hover for names; select a country for its list. The list on the left shows that month’s festivals and their dates.',
      },
      unit: { zh: '個', en: 'festivals' },
      file: 'count.json',
      layer: { kind: 'none' },
      timeAxis: MONTH_AXIS,
      format: (v) => tr({ zh: `${fixed(v, 0)} 個節慶`, en: `${fixed(v, 0)} festivals` }),
      formatTick: (v) => fixed(v, 0),
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
  ],
};
