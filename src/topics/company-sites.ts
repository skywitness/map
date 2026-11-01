import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 大企業的據點（2026-10-31，使用者在 map cloud 直接要求；pipeline/topics/company_sites.py）：12 家大企業的總部、辦公室、
 * 研發中心、工廠、資料中心與發射場，各公司官方公開的資料手工整理（pipeline/data/company-sites/sites.csv，每一列附出處），
 * Amazon、Microsoft 另外沿用雲端機房的區域（AWS、Azure）。使用者決定：新主題放「經濟 › 企業」，選公司看點，國家的值是據點數；
 * 不收零售店與物流倉庫。官網條款禁止程式抓取的 Apple、Amazon、Meta、Intel、NVIDIA 用可靠新聞補主要據點、標「非官方來源」
 * （使用者 2026-11-01 決定）。
 */

const PLATFORMS: Text = { zh: '科技平台', en: 'Platforms' };
const CHIPS: Text = { zh: '晶片', en: 'Chips' };
const SPACE: Text = { zh: '太空', en: 'Space' };

/** 公司（順序同 pipeline 的 COMPANIES，代碼是索引 + 1；使用者列的順序） */
export const COMPANIES: { id: string; label: Text; group: Text }[] = [
  { id: 'apple', label: 'Apple', group: PLATFORMS },
  { id: 'nvidia', label: 'NVIDIA', group: CHIPS },
  { id: 'microsoft', label: 'Microsoft', group: PLATFORMS },
  { id: 'amazon', label: 'Amazon', group: PLATFORMS },
  { id: 'tsmc', label: { zh: '台積電（TSMC）', en: 'TSMC' }, group: CHIPS },
  { id: 'spacex', label: 'SpaceX', group: SPACE },
  { id: 'meta', label: 'Meta', group: PLATFORMS },
  { id: 'broadcom', label: 'Broadcom', group: CHIPS },
  { id: 'samsung', label: { zh: '三星電子（Samsung）', en: 'Samsung Electronics' }, group: CHIPS },
  { id: 'micron', label: { zh: '美光（Micron）', en: 'Micron' }, group: CHIPS },
  { id: 'amd', label: 'AMD', group: CHIPS },
  { id: 'intel', label: 'Intel', group: CHIPS },
];
const ALL = 'all';
const ALL_LABEL = { zh: '12 家合計', en: 'All 12 companies' };
/** 選單依組排（科技平台、晶片、太空），組內照使用者列的順序 */
const GROUP_ORDER: Text[] = [PLATFORMS, CHIPS, SPACE];
const OPTIONS = [
  { id: ALL, label: ALL_LABEL, group: { zh: '全部', en: 'All' } },
  ...[...COMPANIES].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)),
];
const companyLabel = (code: unknown) => (typeof code === 'number' ? tr(COMPANIES[code - 1]?.label ?? '') : '');

/** 據點的類型（k；pipeline 的 KINDS） */
const KINDS: { value: number; label: Text }[] = [
  { value: 1, label: { zh: '總部', en: 'Headquarters' } },
  { value: 2, label: { zh: '辦公室', en: 'Office' } },
  { value: 3, label: { zh: '研發中心', en: 'R&D centre' } },
  { value: 4, label: { zh: '工廠', en: 'Factory' } },
  { value: 5, label: { zh: '資料中心', en: 'Data centre' } },
  { value: 6, label: { zh: '雲端區域', en: 'Cloud region' } },
  { value: 7, label: { zh: '發射場與試驗場', en: 'Launch and test site' } },
];
const kindLabel = (k: unknown) => tr(KINDS.find((x) => x.value === k)?.label ?? '');

const KIND_COLORS: ColorClasses = {
  field: 'k',
  title: { zh: '類型', en: 'Type' },
  thresholds: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5],
  classes: KINDS.map((k, i) => ({ color: MAP_TOKENS.categorical[i], label: k.label })),
};

const STATUS: Record<number, Text> = {
  2: { zh: '興建中', en: 'under construction' },
  3: { zh: '已宣布', en: 'announced' },
};

const num = (v: unknown) => (typeof v === 'number' ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** 中文介面有官方中文名稱時用中文名稱 */
function siteName(p: PointRecord): { text: string; proper: boolean } {
  const zh = getLang() === 'zh' ? str(p.zh) : null;
  return zh ? { text: zh, proper: false } : { text: String(p.name), proper: true };
}

function facts(p: PointRecord, countryName: (iso3: string) => string, withCompany: boolean): string[] {
  const first = [withCompany ? companyLabel(p.co) : null, kindLabel(p.k)];
  const status = num(p.s);
  if (status && STATUS[status]) first.push(tr(STATUS[status]));
  const year = num(p.y);
  if (year) first.push(tr(status === 1 ? { zh: `${year} 年起`, en: `since ${year}` } : { zh: `預計 ${year} 年`, en: `due ${year}` }));
  // 出處是新聞的（官網條款禁止抓取的幾家用新聞補的主要據點）
  if (p.uo === 1) first.push(tr({ zh: '非官方來源', en: 'unofficial source' }));
  const place = [str(p.city), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(', ');
  return [first.filter(Boolean).join(' · '), place];
}

function layer(id: string, folder: string, label: Text, future: boolean): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file: `${folder}/{item}.json`,
    label,
    indicators: ['sites'],
    radius: future ? 4 : { field: 'pr', stops: [[0, 4.5], [1, 7]] },
    color: KIND_COLORS,
    ...(future ? { look: 'hollow' as const } : { sortField: 'pr' }),
    tooltip: (p, ctx) => {
      const name = siteName(p);
      return { title: name.text, detail: facts(p, ctx.countryName, ctx.item === ALL).join(' · ') };
    },
  };
}

const SITES = layer('sites', 'points', { zh: '營運中的據點', en: 'Operating sites' }, false);
const FUTURE = layer('future', 'future', { zh: '興建中與已宣布的據點（空心）', en: 'Under construction or announced (hollow)' }, true);
/** 「有幾家在這裡」：12 家營運中的據點都畫 */
const ALL_SITES: PointsOverlayDef = {
  ...SITES,
  id: 'all-sites',
  file: 'points/all.json',
  indicators: ['companies'],
  tooltip: (p, ctx) => ({ title: siteName(p).text, detail: facts(p, ctx.countryName, true).join(' · ') }),
};

/** 出處的連結：寫網站的主機名稱 */
function sourceLink(p: PointRecord): ListRow['link'] {
  const href = str(p.src);
  if (!href) return undefined;
  try {
    return { href, label: new URL(href).hostname.replace(/^www\./, '') };
  } catch {
    return undefined;
  }
}

/**
 * 左邊的清單：選一家公司時依國家分組（據點多的國家在前），組內依類型；12 家合計時依公司分組。
 * 跟選取的國家連動（點台灣只列台灣的）
 */
function siteList(folder: string, label: Text, tabLabel: Text, empty: Text): ListPanelDef {
  return {
    label,
    tabLabel,
    indicators: ['sites'],
    file: `${folder}/{item}.json`,
    countryField: 'iso3',
    empty,
    rows: (points, { countryName, item }) => {
      const byAll = item === ALL;
      const groupOf = (p: PointRecord) => (byAll ? companyLabel(p.co) : countryName(String(p.iso3)));
      const groups = new Map<string, PointRecord[]>();
      for (const p of points) groups.set(groupOf(p), [...(groups.get(groupOf(p)) ?? []), p]);
      const ordered = [...groups.entries()].sort((a, b) =>
        byAll
          ? (num(a[1][0].co) ?? 0) - (num(b[1][0].co) ?? 0)
          : b[1].length - a[1].length || a[0].localeCompare(b[0]),
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
}

const sitesText = (v: number) => tr({ zh: `${fixed(v, 0)} 處據點`, en: v === 1 ? '1 site' : `${fixed(v, 0)} sites` });

export const companySites: TopicDefinition = {
  id: 'company-sites',
  title: { zh: '大企業的據點', en: 'Big company sites' },
  shortTitle: { zh: '企業據點', en: 'Company sites' },
  defaultIndicator: 'sites',
  defaultYear: 2026,
  dimension: {
    label: { zh: '公司', en: 'Company' },
    options: OPTIONS,
    defaultOption: ALL,
  },
  sources: [
    {
      name: {
        zh: '各公司公開的據點資料（官網、年報、永續報告書、政府文件；官網禁止程式抓取的幾家用可靠新聞補主要據點；手工整理，每一列的出處見清單與 sites.csv）',
        en: 'Sites published by the companies (corporate websites, annual reports, sustainability reports, government documents; for companies whose websites forbid automated access, main sites were added from reliable news reports; compiled by hand, with a source for every row in the list and in sites.csv)',
      },
      url: 'https://github.com/skywitness/map/blob/main/pipeline/data/company-sites/sites.csv',
      license: { zh: '引用事實並註明出處', en: 'facts cited with sources' },
    },
    {
      name: { zh: 'AWS、Azure 的雲端區域（同「雲端機房的區域」）', en: 'AWS and Azure cloud regions (as in Cloud regions)' },
      url: 'https://github.com/skywitness/map/blob/main/pipeline/sources/cloud_regions.py',
      license: { zh: '引用事實並註明出處', en: 'facts cited with sources' },
    },
    { name: { zh: 'Wikidata（位置）', en: 'Wikidata (locations)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
  ],
  note: {
    zh: '12 家公司的總部、辦公室、研發中心、工廠、資料中心與發射場，手工整理，左邊的清單每一列都連到出處。Apple、Amazon、Meta、Intel、NVIDIA 的官網條款禁止程式抓取，官方的據點清單不能用，所以只收年報、政府文件與可靠新聞（標「非官方來源」）寫到的主要據點，辦公室不是完整的清單。Amazon、Microsoft 另外畫 AWS、Azure 的雲端區域（業者不公開機房位置，點在區域的城市）。位置多半是城市在 Wikidata 的座標，不是大樓本身；同一個城市的好幾個點排在一個小圈上。興建中與已宣布的畫空心、不算進據點數。不收零售店、物流倉庫與代工廠。',
    en: 'Headquarters, offices, R&D centres, factories, data centres and launch sites of 12 companies, compiled by hand; every row in the list on the left links to its source. The websites of Apple, Amazon, Meta, Intel and NVIDIA forbid automated access in their terms, so their official location lists could not be used: only the main sites named in annual reports, government documents and reliable news reports (marked “unofficial source”) are included, and their offices are not a complete list. Amazon and Microsoft also show their AWS and Azure cloud regions (the providers do not publish data centre locations, so these sit at the region’s city). Most locations are the city’s Wikidata coordinates rather than the building itself; several sites in one city are arranged on a small ring. Sites under construction or announced are hollow and are not counted. Retail stores, warehouses and contract manufacturers are not included.',
  },
  listPanel: [
    siteList('points', { zh: '據點', en: 'Sites' }, { zh: '營運中', en: 'Operating' }, { zh: '沒有營運中的據點', en: 'No operating sites' }),
    siteList(
      'future',
      { zh: '興建中與已宣布', en: 'Under construction or announced' },
      { zh: '興建中', en: 'Coming' },
      { zh: '沒有興建中或已宣布的據點', en: 'Nothing under construction or announced' },
    ),
  ],
  overlays: [SITES, FUTURE, ALL_SITES],
  indicators: [
    {
      id: 'sites',
      label: { zh: '據點數', en: 'Sites' },
      description: {
        zh: '這國有幾處營運中的據點：總部、辦公室、研發中心、工廠、資料中心、雲端區域、發射場各算一處，同一個城市的好幾個辦公室算一處。用上面的選單看單一公司。12 家合計 632 處、在 97 國：美國 143 處最多，台灣 44 處第二（台積電 23 處），中國 43 處。',
        en: 'Operating sites in each country: a headquarters, office, R&D centre, factory, data centre, cloud region or launch site each counts as one, and several offices in one city count as one. Use the menu above to see a single company. The 12 companies have 632 sites in 97 countries: the US has the most (143), then Taiwan (44, of which 23 are TSMC’s) and China (43).',
      },
      unit: { zh: '處', en: 'sites' },
      file: 'count/{item}.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      timeless: true,
      integer: true,
      format: sitesText,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'companies',
      label: { zh: '有幾家在這裡', en: 'Companies present' },
      description: {
        zh: '12 家裡有幾家在這國有營運中的據點（雲端區域也算）。12 家都在的只有美國；台灣、中國各有 10 家（台灣沒有 SpaceX、Meta），德國、印度、以色列、新加坡各 8 家。',
        en: 'How many of the 12 companies have an operating site in each country (cloud regions included). Only the US has all 12; Taiwan and China have 10 each (Taiwan has no SpaceX or Meta site), and Germany, India, Israel and Singapore 8 each.',
      },
      unit: { zh: '家', en: 'companies' },
      file: 'companies.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 4, 6, 8, 10] } },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: v === 1 ? '1 company' : `${fixed(v, 0)} companies` }),
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '12 家都沒有營運中的據點', en: 'None of the 12 has an operating site here' },
    },
  ],
};
