import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 晶圓廠地圖（2026-10-31，製作手冊第十批 172；pipeline/topics/wafer_fabs.py）：英文維基「List of semiconductor fabrication
 * plants」的晶圓廠，同一家公司在同一個城市的好幾列算一個廠區（使用者決定）。使用者決定獨立成主題，放科技的「數位」欄。
 */

/** 最大的晶圓尺寸（w，0 是表裡沒寫） */
const WAFER: ColorClasses = {
  field: 'w',
  title: { zh: '最大的晶圓尺寸', en: 'Largest wafer size' },
  thresholds: [1, 175, 250],
  classes: [
    { color: MAP_TOKENS.inkMuted, label: { zh: '沒寫', en: 'Not given' } },
    { color: MAP_TOKENS.categorical[2], label: { zh: '150 mm 以下', en: '150 mm or smaller' } },
    { color: MAP_TOKENS.categorical[0], label: { zh: '200 mm', en: '200 mm' } },
    { color: MAP_TOKENS.categorical[1], label: { zh: '300 mm', en: '300 mm' } },
  ],
};

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : null);

/** 表裡的地點去掉開頭的國家（「Taiwan, Hsinchu」→「Hsinchu」） */
const place = (p: PointRecord) => (str(p.loc) ?? '').split(',').slice(1).join(',').trim() || (str(p.loc) ?? '');

function details(p: PointRecord, countryName: (iso3: string) => string): string[] {
  const where = [str(p.iso3) ? countryName(p.iso3 as string) : null, place(p)].filter(Boolean).join(' · ');
  const n = num(p.n) ?? 1;
  const first = num(p.y);
  const head = [
    tr({ zh: `${n} 列（期、廠）`, en: n === 1 ? '1 entry' : `${n} entries (phases or fabs)` }),
    first ? tr({ zh: `最早 ${first} 年量產`, en: `in production since ${first}` }) : null,
    num(p.end) ? tr({ zh: `${p.end} 年關閉`, en: `closed in ${p.end}` }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return [where, head].filter(Boolean);
}

function tooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const phases = (str(p.ph) ?? '').split('\n').filter(Boolean);
  return {
    title: str(p.co) ?? '',
    detail: details(p, ctx.countryName).join(' · '),
    extra: [
      ...phases,
      str(p.tech) ?? '',
      p.ap === 1 ? tr({ zh: '位置是大約的（只寫到州、省或地區）', en: 'Approximate location (state, province or region only)' }) : '',
    ].filter(Boolean),
    properNoun: str(p.co) ?? undefined,
  };
}

const OPERATING: PointsOverlayDef = {
  kind: 'points',
  id: 'fabs',
  file: 'fabs.json',
  label: { zh: '運作中的廠區', en: 'Operating fab sites' },
  radius: 5,
  color: WAFER,
  tooltip,
};
const PLANNED: PointsOverlayDef = {
  kind: 'points',
  id: 'planned',
  file: 'planned.json',
  label: { zh: '興建中、規劃中（空心）', en: 'Under construction or planned (hollow)' },
  look: 'hollow',
  radius: 5,
  color: WAFER,
  tooltip,
};
const CLOSED: PointsOverlayDef = {
  kind: 'points',
  id: 'closed',
  file: 'closed.json',
  label: { zh: '已關閉（灰色）', en: 'Closed (grey)' },
  look: 'muted',
  radius: 4,
  color: WAFER,
  tooltip,
};

/**
 * 左邊的清單（第十二批 L18，使用者 2026-10-30 決定依公司分組）：運作中的廠區依公司分組（廠區多的公司在前），組內依量產年份。
 * 2026-10-31（第十二批 206）：組名改用清單側欄的分組（ListRow.group，寫公司與廠區數），跟選取的國家連動（L23，點台灣只列台灣的）
 */
const LIST: ListPanelDef = {
  label: { zh: '晶圓廠', en: 'Fabs' },
  file: 'fabs.json',
  countryField: 'iso3',
  rows: (points, { countryName }) => {
    const byCompany = new Map<string, PointRecord[]>();
    for (const p of points) {
      const co = str(p.co) ?? '';
      byCompany.set(co, [...(byCompany.get(co) ?? []), p]);
    }
    const groups = [...byCompany.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    const rows: ListRow[] = [];
    for (const [co, list] of groups) {
      list
        .sort((a, b) => (num(a.y) ?? 9999) - (num(b.y) ?? 9999) || String(a.loc).localeCompare(String(b.loc)))
        .forEach((p, i) => {
          rows.push({
            key: `${co}-${p.loc}-${i}`,
            title: place(p) || co,
            titleProper: true,
            lines: details(p, countryName),
            group: tr({ zh: `${co}（${list.length}）`, en: `${co} (${list.length})` }),
            target: { lon: p.lon as number, lat: p.lat as number, zoom: 10 },
          });
        });
    }
    return rows;
  },
};

const sites = (v: number) => tr({ zh: `${fixed(v, 0)} 個廠區`, en: v === 1 ? '1 site' : `${fixed(v, 0)} sites` });

export const waferFabs: TopicDefinition = {
  id: 'wafer-fabs',
  title: { zh: '晶圓廠地圖', en: 'Semiconductor fabs' },
  shortTitle: { zh: '晶圓廠', en: 'Wafer fabs' },
  defaultIndicator: 'campuses',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '英文維基百科「List of semiconductor fabrication plants」（revid 1379416921，2026-10-09）',
        en: 'English Wikipedia, “List of semiconductor fabrication plants” (revision 1379416921, 9 Oct 2026)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_semiconductor_fabrication_plants&oldid=1379416921',
      license: 'CC BY-SA 4.0',
    },
    { name: { zh: 'Wikidata（城市的位置）', en: 'Wikidata (town locations)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
  ],
  note: {
    zh: '英文維基的清單是編者從公司網站與新聞整理的，條目自己標「不完整」「需要更新（2025 年 3 月）」，中國、美國的新廠尤其慢；量產年份、製程、產能只有一部分有填。同一家公司在同一個城市的好幾列（例如聯電新竹的 Fab 8A–8F）算一個廠區，滑過看各期。表裡只有「國家, 城市」，位置是那個城市在 Wikidata 的座標（不是廠房本身），只寫到州、省的是大約的位置；沒寫地點的不收。商業的 SEMI World Fab Forecast 不能用。',
    en: 'The English Wikipedia list is compiled by editors from company websites and news; the article itself is marked incomplete and in need of an update (March 2025), and new fabs in China and the US are especially slow to appear. Start years, process nodes and capacities are filled in for only some rows. Rows for the same company in the same town (such as UMC’s Fab 8A–8F in Hsinchu) count as one site; hover to see each phase. The list gives only “country, town”, so locations are the town’s Wikidata coordinates rather than the plant itself, and those given only to state or province level are approximate; rows with no location are left out. The commercial SEMI World Fab Forecast cannot be used.',
  },
  listPanel: LIST,
  overlays: [OPERATING, PLANNED, CLOSED],
  indicators: [
    {
      id: 'campuses',
      label: { zh: '運作中的晶圓廠區', en: 'Operating fab sites' },
      description: {
        zh: '每個國家運作中的晶圓廠區數（同一家公司在同一個城市算一個），點的顏色是最大的晶圓尺寸。英文維基的清單：日本 64、美國 63、中國 50、台灣 33、德國 17。台灣有台積電、聯電、力積電、世界先進、南亞科、美光等，例如聯電新竹（Fab 8A–8F 等 7 列）。',
        en: 'Operating semiconductor fab sites in each country (one per company per town); points are coloured by the largest wafer size. From the English Wikipedia list: Japan 64, the US 63, China 50, Taiwan 33, Germany 17. Taiwan’s include TSMC, UMC, PSMC, Vanguard, Nanya and Micron, such as UMC in Hsinchu (7 entries, including Fab 8A–8F).',
      },
      unit: { zh: '個', en: 'sites' },
      file: 'campuses.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 20, 40] } },
      integer: true,
      timeless: true,
      format: sites,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '清單裡沒有', en: 'None in the list' },
    },
    {
      id: 'campuses-300',
      label: { zh: '有 300 mm 產線的廠區', en: 'Sites with 300 mm lines' },
      description: {
        zh: '運作中、有 300 mm（12 吋）晶圓產線的廠區數，先進製程與記憶體多半在這裡。中國 17、台灣 13、美國 13、日本 7、南韓與德國各 3（清單只填了部分廠的晶圓尺寸）。',
        en: 'Operating sites with 300 mm (12-inch) wafer lines, where most leading-edge logic and memory is made: China 17, Taiwan 13, the US 13, Japan 7, South Korea and Germany 3 each (wafer sizes are given for only some fabs in the list).',
      },
      unit: { zh: '個', en: 'sites' },
      file: 'campuses-300.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 5, 10, 15] } },
      integer: true,
      timeless: true,
      format: sites,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '清單裡沒有', en: 'None in the list' },
    },
  ],
};
