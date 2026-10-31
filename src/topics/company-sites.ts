import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 大企業的據點（2026-10-31，使用者在 map cloud 直接要求；pipeline/topics/company_sites.py）：12 家大企業的總部、辦公室、
 * 研發中心、工廠、資料中心與發射場，各公司官方公開的資料手工整理（pipeline/data/company-sites/sites.csv，每一列附出處），
 * Amazon、Microsoft 另外沿用雲端機房的區域（AWS、Azure）。使用者決定：新主題放「經濟 › 企業」，選公司看點，國家的值是據點數；
 * 不收零售店與物流倉庫。
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
        zh: '各公司官方公開的據點資料（官網、年報、永續報告書、新聞稿；手工整理，每一列的出處見清單與 sites.csv）',
        en: 'Sites published by each company (corporate websites, annual reports, sustainability reports, press releases; compiled by hand, with a source for every row in the list and in sites.csv)',
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
  note: { zh: 'TODO', en: 'TODO' },
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
      description: { zh: 'TODO', en: 'TODO' },
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
      description: { zh: 'TODO', en: 'TODO' },
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
