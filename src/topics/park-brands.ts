import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, DimensionDef, IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

/**
 * 樂園品牌的據點（2026-11-08，製作手冊第二十七批 632，候選 1372；pipeline/topics/park_brands.py）：照「大企業的據點」手工整理
 * （pipeline/data/park-brands/brands.csv），出處是各品牌維基條目固定版本的據點表，座標 Wikidata、中國的部分用 OpenStreetMap。
 * 放在「樂園」主題：選一個品牌看它的據點，國家的值是據點數；全部合計只算樂園與水上樂園（室內景點不算）。
 */

const GLOBAL: Text = { zh: '跨國集團', en: 'Global groups' };
const CHINA: Text = { zh: '中國', en: 'China' };
const EAST_ASIA: Text = { zh: '日本與南韓', en: 'Japan and South Korea' };
const TAIWAN: Text = { zh: '台灣', en: 'Taiwan' };
const INDOOR: Text = { zh: '默林的室內景點', en: 'Merlin indoor attractions' };

/** 品牌（順序同 pipeline 的 BRANDS，代碼是索引 + 1） */
export const BRANDS: { id: string; label: Text; group: Text }[] = [
  { id: 'disney', label: { zh: '迪士尼', en: 'Disney' }, group: GLOBAL },
  { id: 'universal', label: { zh: '環球影城', en: 'Universal' }, group: GLOBAL },
  { id: 'legoland', label: { zh: '樂高樂園（Legoland）', en: 'Legoland' }, group: GLOBAL },
  { id: 'merlin', label: { zh: '默林娛樂的其他樂園', en: 'Other Merlin parks' }, group: GLOBAL },
  { id: 'sixflags', label: 'Six Flags', group: GLOBAL },
  { id: 'united-parks', label: { zh: 'United Parks（海洋世界）', en: 'United Parks (SeaWorld)' }, group: GLOBAL },
  { id: 'parques-reunidos', label: 'Parques Reunidos', group: GLOBAL },
  { id: 'portaventura', label: 'PortAventura', group: GLOBAL },
  { id: 'fantawild', label: { zh: '華強方特', en: 'Fantawild' }, group: CHINA },
  { id: 'oct', label: { zh: '華僑城（歡樂谷）', en: 'OCT (Happy Valley)' }, group: CHINA },
  { id: 'chimelong', label: { zh: '長隆', en: 'Chimelong' }, group: CHINA },
  { id: 'haichang', label: { zh: '海昌海洋公園', en: 'Haichang Ocean Park' }, group: CHINA },
  { id: 'sanrio', label: { zh: '三麗鷗', en: 'Sanrio' }, group: EAST_ASIA },
  { id: 'fujikyu', label: { zh: '富士急', en: 'Fuji-Q' }, group: EAST_ASIA },
  { id: 'lotte', label: { zh: '樂天世界', en: 'Lotte World' }, group: EAST_ASIA },
  { id: 'everland', label: { zh: '愛寶樂園', en: 'Everland' }, group: EAST_ASIA },
  { id: 'leofoo', label: { zh: '六福村', en: 'Leofoo Village' }, group: TAIWAN },
  { id: 'janfusun', label: { zh: '劍湖山', en: 'Janfusun Fancyworld' }, group: TAIWAN },
  { id: 'lihpao', label: { zh: '麗寶樂園', en: 'Lihpao Land' }, group: TAIWAN },
  { id: 'eda', label: { zh: '義大遊樂世界', en: 'E-DA Theme Park' }, group: TAIWAN },
  { id: 'formosan', label: { zh: '九族文化村', en: 'Formosan Aboriginal Culture Village' }, group: TAIWAN },
  { id: 'ldc', label: { zh: '樂高探索中心', en: 'Legoland Discovery Centre' }, group: INDOOR },
  { id: 'sea-life', label: 'Sea Life', group: INDOOR },
  { id: 'tussauds', label: { zh: '杜莎夫人蠟像館', en: 'Madame Tussauds' }, group: INDOOR },
];
const ALL = 'all';
const brandLabel = (code: unknown) => (typeof code === 'number' ? tr(BRANDS[code - 1]?.label ?? '') : '');

export const BRAND_DIMENSION: DimensionDef = {
  label: { zh: '品牌', en: 'Brand' },
  options: [{ id: ALL, label: { zh: '全部品牌（只算樂園）', en: 'All brands (parks only)' }, group: { zh: '全部', en: 'All' } }, ...BRANDS],
  defaultOption: ALL,
};

/** 據點的類型（k；pipeline 的 KINDS） */
const KINDS: { value: number; label: Text }[] = [
  { value: 1, label: { zh: '樂園', en: 'Theme park' } },
  { value: 2, label: { zh: '水上樂園', en: 'Water park' } },
  { value: 3, label: { zh: '動物園與水族館', en: 'Zoo or aquarium' } },
  { value: 4, label: { zh: '室內景點', en: 'Indoor attraction' } },
];
const kindLabel = (k: unknown) => tr(KINDS.find((x) => x.value === k)?.label ?? '');
const KIND_COLORS: ColorClasses = {
  field: 'k',
  title: { zh: '類型', en: 'Type' },
  thresholds: [1.5, 2.5, 3.5],
  classes: KINDS.map((k, i) => ({ color: MAP_TOKENS.categorical[i], label: k.label })),
};

const num = (v: unknown) => (typeof v === 'number' ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

function siteName(p: PointRecord): { text: string; proper: boolean } {
  const zh = getLang() === 'zh' ? str(p.zh) : null;
  return zh ? { text: zh, proper: false } : { text: String(p.name), proper: true };
}

function facts(p: PointRecord, countryName: (iso3: string) => string, withBrand: boolean): string[] {
  const year = num(p.y);
  const planned = num(p.s) === 2;
  const first = [
    withBrand ? brandLabel(p.b) : null,
    kindLabel(p.k),
    planned ? tr({ zh: year ? `預計 ${year} 年開幕` : '興建中或已宣布', en: year ? `due ${year}` : 'under construction or announced' }) : null,
    !planned && year ? tr({ zh: `${year} 年開幕`, en: `opened ${year}` }) : null,
    num(p.ct) === 1 ? tr({ zh: '位置是城市', en: 'city location' }) : null,
  ];
  const place = [str(p.city), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(', ');
  return [first.filter(Boolean).join(' · '), place];
}

function layer(id: string, folder: string, label: Text, future: boolean): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file: `brands/${folder}/{item}.json`,
    label,
    indicators: ['brands'],
    radius: future ? 4 : { field: 'k', stops: [[1, 5.5], [4, 3.5]] },
    color: KIND_COLORS,
    ...(future ? { look: 'hollow' as const } : {}),
    tooltip: (p, ctx) => {
      const name = siteName(p);
      return {
        title: name.text,
        detail: facts(p, ctx.countryName, ctx.item === ALL).join(' · '),
        properNoun: name.proper ? undefined : String(p.name),
      };
    },
  };
}

export const BRAND_OVERLAYS: PointsOverlayDef[] = [
  layer('brand-sites', 'points', { zh: '品牌的據點', en: 'Brand locations' }, false),
  layer('brand-future', 'future', { zh: '興建中與已宣布（空心）', en: 'Under construction or announced (hollow)' }, true),
];

function sourceLink(p: PointRecord): ListRow['link'] {
  const href = str(p.src);
  if (!href) return undefined;
  try {
    return { href, label: new URL(href).hostname.replace(/^www\./, '') };
  } catch {
    return undefined;
  }
}

/** 左邊的清單：選一個品牌時依國家分組（據點多的國家在前）、組內依類型；全部品牌時依品牌分組 */
export const BRAND_LIST: ListPanelDef = {
  label: { zh: '品牌的據點', en: 'Brand locations' },
  tabLabel: { zh: '品牌', en: 'Brands' },
  indicators: ['brands'],
  file: 'brands/points/{item}.json',
  countryField: 'iso3',
  empty: { zh: '這個品牌在這裡沒有據點', en: 'No locations here' },
  rows: (points, { countryName, item }) => {
    const byAll = item === ALL;
    const groupOf = (p: PointRecord) => (byAll ? brandLabel(p.b) : countryName(String(p.iso3)));
    const groups = new Map<string, PointRecord[]>();
    for (const p of points) groups.set(groupOf(p), [...(groups.get(groupOf(p)) ?? []), p]);
    const ordered = [...groups.entries()].sort((a, b) =>
      byAll ? (num(a[1][0].b) ?? 0) - (num(b[1][0].b) ?? 0) : b[1].length - a[1].length || a[0].localeCompare(b[0]),
    );
    const rows: ListRow[] = [];
    for (const [group, list] of ordered) {
      list
        .sort((a, b) => (num(a.k) ?? 9) - (num(b.k) ?? 9) || siteName(a).text.localeCompare(siteName(b).text))
        .forEach((p, i) => {
          const name = siteName(p);
          rows.push({
            key: `${group}-${p.name}-${i}`,
            title: name.text,
            titleProper: name.proper,
            lines: facts(p, countryName, false),
            group: tr({ zh: `${group}（${list.length}）`, en: `${group} (${list.length})` }),
            target: { lon: p.lon as number, lat: p.lat as number, zoom: 11 },
            link: sourceLink(p),
          });
        });
    }
    return rows;
  },
};

export const BRAND_SOURCES: SourceDef[] = [
  {
    name: {
      zh: '各樂園品牌的英文維基條目（海昌：中文維基）固定版本的據點表，手工整理（每一列的出處見清單與 brands.csv）',
      en: 'Location tables in fixed revisions of each brand’s English Wikipedia article (Chinese Wikipedia for Haichang), compiled by hand (sources for every row in the list and in brands.csv)',
    },
    url: 'https://github.com/skywitness/map/blob/main/pipeline/data/park-brands/brands.csv',
    license: 'CC BY-SA 4.0',
  },
];

const sitesText = (v: number) => tr({ zh: `${fixed(v, 0)} 處`, en: v === 1 ? '1 location' : `${fixed(v, 0)} locations` });

export const BRAND_INDICATOR: IndicatorDef = {
  id: 'brands',
  label: { zh: '樂園品牌的據點', en: 'Theme park brand locations' },
  description: {
    zh: '16 個樂園品牌、台灣 5 家樂園與默林娛樂 3 個室內品牌的據點，手工整理自各品牌維基條目的據點表（左邊的清單每一列連到出處）。用上面的選單看單一品牌；「全部品牌」只算樂園與水上樂園：合計 180 處、在 22 國，中國、美國各 60 處最多，西班牙 11、日本 7。迪士尼 14 座（美國 8）、Six Flags 34 座（美國 30）、華強方特 30 座（中國 29、伊朗 1）；默林的 Sea Life 48 處、樂高探索中心 29 處、杜莎夫人蠟像館 19 處是室內景點，只在選了那個品牌時算。台灣 5 家都只有一處，台灣沒有跨國品牌的據點。',
    en: 'Locations of 16 theme park brands, 5 Taiwanese parks and 3 indoor brands of Merlin Entertainments, compiled by hand from the location tables in each brand’s Wikipedia article (every row in the list on the left links to its source). Use the menu above for a single brand; “All brands” counts only theme parks and water parks: 180 in 22 countries, with China and the US having the most (60 each), followed by Spain (11) and Japan (7). Disney has 14 (8 in the US), Six Flags 34 (30 in the US) and Fantawild 30 (29 in China, 1 in Iran); Merlin’s 48 Sea Life centres, 29 Legoland Discovery Centres and 19 Madame Tussauds are indoor attractions, counted only when that brand is selected. Each of the 5 Taiwanese brands has a single park, and Taiwan has no location of an international brand.',
  },
  unit: { zh: '處', en: 'locations' },
  file: 'brands/count/{item}.json',
  dimension: BRAND_DIMENSION,
  layer: { kind: 'bubble', legendValues: 'auto' },
  timeless: true,
  integer: true,
  format: sitesText,
  formatTick: (v) => fixed(v, 0),
  shareOfWorld: true,
  missing: { zh: '這個品牌在這裡沒有據點', en: 'No locations of this brand here' },
};
