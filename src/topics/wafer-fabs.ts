import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { Text } from '../i18n/lang';
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
/** 英文維基清單的指標（記憶體廠的指標另有自己的圖層與清單） */
const WIKI_INDICATORS = ['campuses', 'campuses-300'];
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
  indicators: WIKI_INDICATORS,
  label: { zh: '運作中的廠區', en: 'Operating fab sites' },
  radius: 5,
  color: WAFER,
  tooltip,
};
const PLANNED: PointsOverlayDef = {
  kind: 'points',
  id: 'planned',
  file: 'planned.json',
  indicators: WIKI_INDICATORS,
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
  indicators: WIKI_INDICATORS,
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
  indicators: WIKI_INDICATORS,
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


/**
 * 記憶體廠（2026-11-13，使用者要求把 AI 產業鏈全景的資料用到地圖上；pipeline/topics/memory_fabs.py）：
 * 同一作者的 skywitness/ai-chain 的記憶體與儲存廠 60 個，顏色是主要產品，大小是月產能（有寫的 18 個）。
 */
const MEMORY_PRODUCT: ColorClasses = {
  field: 'pr',
  title: { zh: '主要產品', en: 'Main product' },
  thresholds: [1.5, 2.5, 3.5, 4.5],
  classes: [
    { color: MAP_TOKENS.categorical[3], label: { zh: 'HBM 與它的封裝', en: 'HBM and HBM packaging' } },
    { color: MAP_TOKENS.categorical[0], label: { zh: 'DRAM', en: 'DRAM' } },
    { color: MAP_TOKENS.categorical[1], label: { zh: 'NAND 快閃記憶體', en: 'NAND flash' } },
    { color: MAP_TOKENS.categorical[2], label: { zh: '硬碟', en: 'Hard drives' } },
    { color: MAP_TOKENS.inkMuted, label: { zh: '其他', en: 'Other' } },
  ],
};
const MEMORY_STATUS = [
  { zh: '運轉中', en: 'Operating' },
  { zh: '運轉中、擴建中', en: 'Operating and expanding' },
  { zh: '興建中', en: 'Under construction' },
  { zh: '規劃中', en: 'Planned' },
];
const ESTIMATE = [
  { zh: '媒體或研究機構的估計', en: 'media or analyst estimate' },
  { zh: '預測', en: 'forecast' },
  { zh: '公司公布', en: 'company figure' },
];
const kwpm = (v: number) => tr({ zh: `每月 ${fixed(v, 0)} 千片`, en: `${fixed(v, 0)}k wafers a month` });

function memoryLines(p: PointRecord, countryName: (iso3: string) => string): string[] {
  const zh = getLang() === 'zh';
  const cap = num(p.cap);
  const est = num(p.est);
  return [
    [zh ? str(p.city) : null, str(p.iso3) ? countryName(p.iso3 as string) : null, tr(MEMORY_STATUS[(num(p.st) ?? 1) - 1])].filter(Boolean).join(' · '),
    (zh ? str(p.prod) : str(p.prodEn)) ?? '',
    cap
      ? `${tr({ zh: '月產能', en: 'Capacity' })} ${kwpm(cap)}${est ? tr({ zh: `（${tr(ESTIMATE[est - 1])}）`, en: ` (${tr(ESTIMATE[est - 1])})` }) : ''}${
          p.sum === 1 ? tr({ zh: '，含同一家公司其他廠的合計', en: ', combined with another of the company’s fabs' }) : ''
        }`
      : '',
    num(p.add) ? tr({ zh: `擴產 ${kwpm(num(p.add) as number)}`, en: `adding ${kwpm(num(p.add) as number)}` }) : '',
    str(p.src) ? tr({ zh: `來源：${p.src}`, en: `Source: ${p.src}` }) : '',
  ].filter(Boolean);
}

function memoryTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const zh = getLang() === 'zh';
  const [head, ...rest] = memoryLines(p, ctx.countryName);
  return {
    title: `${zh ? str(p.co) : str(p.coEn)} ${zh ? (str(p.name) ?? '') : ''}`.trim(),
    detail: head,
    extra: rest,
  };
}

function memoryLayer(id: string, label: Text, field: 'op' | 'pl'): PointsOverlayDef {
  return {
    kind: 'points',
    id,
    file: 'memory-fabs.json',
    label,
    indicators: ['memory-fabs'],
    ...(field === 'pl' ? { look: 'hollow' as const } : {}),
    minValue: { field, stops: [[0, 1]] },
    count: false, // 兩個圖層讀同一個檔，件數會算成全部 60 個
    radius: { field: 'r', stops: [[0, 4.5], [50, 6], [150, 10], [250, 13]] },
    color: MEMORY_PRODUCT,
    sortField: 'r',
    ...(field === 'op'
      ? { sizeLegend: { title: { zh: '月產能（千片 12 吋晶圓）', en: 'Monthly capacity (k 300 mm wafers)' }, values: [50, 150, 250], format: (v: number) => fixed(v, 0) } }
      : {}),
    tooltip: memoryTooltip,
  };
}
const MEMORY = memoryLayer('memory-fabs', { zh: '記憶體廠：運轉中、擴建中', en: 'Memory fabs: operating or expanding' }, 'op');
const MEMORY_PLANNED = memoryLayer('memory-fabs-planned', { zh: '記憶體廠：興建中、規劃中（空心）', en: 'Memory fabs: under construction or planned (hollow)' }, 'pl');

const MEMORY_LIST: ListPanelDef = {
  label: { zh: '記憶體廠', en: 'Memory fabs' },
  tabLabel: { zh: '記憶體', en: 'Memory' },
  indicators: ['memory-fabs'],
  file: 'memory-fabs.json',
  countryField: 'iso3',
  rows: (points, { countryName }) => {
    const zh = getLang() === 'zh';
    const count = new Map<string, number>();
    for (const p of points) count.set(String(p.coEn), (count.get(String(p.coEn)) ?? 0) + 1);
    return [...points]
      .sort((a, b) => (count.get(String(b.coEn)) ?? 0) - (count.get(String(a.coEn)) ?? 0) || String(a.coEn).localeCompare(String(b.coEn)) || (num(a.st) ?? 0) - (num(b.st) ?? 0))
      .map(
        (p, i): ListRow => ({
          key: `mem-${i}`,
          title: zh ? (str(p.name) ?? '') : `${p.coEn} ${countryName(String(p.iso3))}`,
          titleProper: !zh,
          lines: memoryLines(p, countryName).slice(0, 3),
          group: `${zh ? p.co : p.coEn}${tr({ zh: `（${count.get(String(p.coEn))}）`, en: ` (${count.get(String(p.coEn))})` })}`,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 10 },
        }),
      );
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
    {
      name: { zh: 'AI 產業鏈全景：記憶體與儲存的廠（查核日 2026-10-23）', en: 'AI Chain (AI 產業鏈全景): memory and storage fabs (checked 23 Oct 2026)' }, // i18n-ignore（網站的中文名稱是專有名詞）
      url: 'https://skywitness.github.io/ai-chain/memory/',
      license: { zh: 'CC BY 4.0（同一作者）', en: 'CC BY 4.0 (same author)' },
    },
  ],
  note: {
    zh: '英文維基的清單是編者從公司網站與新聞整理的，條目自己標「不完整」「需要更新（2025 年 3 月）」，中國、美國的新廠尤其慢；量產年份、製程、產能只有一部分有填。同一家公司在同一個城市的好幾列（例如聯電新竹的 Fab 8A–8F）算一個廠區，滑過看各期。表裡只有「國家, 城市」，位置是那個城市在 Wikidata 的座標（不是廠房本身），只寫到州、省的是大約的位置；沒寫地點的不收，另有 31 列的地點對不到 Wikidata 的城市，也沒畫（2026-11-05 查）。大連的 Fab 68 照 Intel 2025 年報改成 SK hynix（維基還寫 Intel）。商業的 SEMI World Fab Forecast 不能用。「記憶體廠」另用同一作者的 AI 產業鏈全景整理的 60 個記憶體與儲存的廠（2026-10-23 查核），位置是城市層級的大約位置，月產能多半是估計，滑過看來源。',
    en: 'The English Wikipedia list is compiled by editors from company websites and news; the article itself is marked incomplete and in need of an update (March 2025), and new fabs in China and the US are especially slow to appear. Start years, process nodes and capacities are filled in for only some rows. Rows for the same company in the same town (such as UMC’s Fab 8A–8F in Hsinchu) count as one site; hover to see each phase. The list gives only “country, town”, so locations are the town’s Wikidata coordinates rather than the plant itself, and those given only to state or province level are approximate; rows with no location are left out, and another 31 rows whose place could not be matched to a town in Wikidata are not drawn either (checked 2026-11-05). Fab 68 in Dalian is shown under SK hynix, following Intel’s 2025 annual report (the Wikipedia list still says Intel). The commercial SEMI World Fab Forecast cannot be used. The memory fabs indicator instead uses 60 memory and storage fabs compiled by AI Chain, a site by the same author (checked 23 October 2026); locations are approximate to the city, capacities are mostly estimates, and each point shows its source.',
  },
  listPanel: [LIST, MEMORY_LIST],
  overlays: [OPERATING, PLANNED, CLOSED, MEMORY, MEMORY_PLANNED],
  indicators: [
    {
      id: 'campuses',
      label: { zh: '運作中的晶圓廠區', en: 'Operating fab sites' },
      description: {
        zh: '每個國家運作中的晶圓廠區數（同一家公司在同一個城市算一個），點的顏色是最大的晶圓尺寸。英文維基的清單：美國、日本各 64，中國 50、台灣 33、德國 17。台灣有台積電、聯電、力積電、世界先進、南亞科、美光等，例如聯電新竹（Fab 8A–8F 等 7 列）。',
        en: 'Operating semiconductor fab sites in each country (one per company per town); points are coloured by the largest wafer size. From the English Wikipedia list: the US and Japan 64 each, China 50, Taiwan 33, Germany 17. Taiwan’s include TSMC, UMC, PSMC, Vanguard, Nanya and Micron, such as UMC in Hsinchu (7 entries, including Fab 8A–8F).',
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
        zh: '運作中、有 300 mm（12 吋）晶圓產線的廠區數，先進製程與記憶體多半在這裡。中國 17、美國 14、台灣 13、日本 7、南韓與德國各 3（清單只填了部分廠的晶圓尺寸）。',
        en: 'Operating sites with 300 mm (12-inch) wafer lines, where most leading-edge logic and memory is made: China 17, the US 14, Taiwan 13, Japan 7, South Korea and Germany 3 each (wafer sizes are given for only some fabs in the list).',
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
    {
      id: 'memory-fabs',
      label: { zh: '記憶體廠', en: 'Memory fabs' },
      description: {
        zh: '同一作者的「AI 產業鏈全景」整理的 60 個記憶體與儲存的廠（DRAM、NAND、HBM 與它的先進封裝、硬碟），依國家：南韓 18、中國 14、台灣 9、日本與美國各 5、泰國 3（硬碟）、新加坡 2，印度、英國、菲律賓、馬來西亞各 1。公司是 SK海力士 14、美光 12、三星電子 10、長鑫存儲 6、鎧俠與威騰各 4、華邦電與希捷各 3、長江存儲與南亞科各 2。27 個運轉中、13 個邊運轉邊擴建、15 個興建中、5 個規劃中（空心）。18 個有月產能（千片 12 吋晶圓，多半是媒體或研究機構的估計），最大的是美光台中 220（含林口的合計）、長鑫合肥、SK海力士無錫、長江存儲武漢各 200。台灣有美光台中、林口、台南後段廠與銅鑼，南亞科 3A／3AN 與 5A 新廠，華邦電台中與高雄。',
        en: 'The 60 memory and storage fabs (DRAM, NAND, HBM and its packaging, hard drives) compiled by AI Chain (AI 產業鏈全景), a site by the same author, by country: South Korea 18, China 14, Taiwan 9, Japan and the US 5 each, Thailand 3 (hard drives), Singapore 2, and India, the UK, the Philippines and Malaysia 1 each. By company: SK hynix 14, Micron 12, Samsung 10, CXMT 6, Kioxia and Western Digital 4 each, Winbond and Seagate 3 each, and YMTC and Nanya 2 each. 27 are operating, 13 operating while expanding, 15 under construction and 5 planned (hollow). 18 have a monthly capacity (thousand 300 mm wafers, mostly media or analyst estimates); the largest are Micron Taichung at 220 (combined with Linkou) and CXMT Hefei, SK hynix Wuxi and YMTC Wuhan at 200 each. Taiwan has Micron’s Taichung, Linkou, Tainan back-end and Tongluo sites, Nanya’s 3A/3AN and new 5A fabs, and Winbond’s Taichung and Kaohsiung fabs.', // i18n-ignore（網站的中文名稱是專有名詞）
      },
      unit: { zh: '個', en: 'fabs' },
      file: 'memory-fabs-count.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 5, 10, 15] } },
      integer: true,
      timeless: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 個記憶體廠`, en: v === 1 ? '1 memory fab' : `${fixed(v, 0)} memory fabs` }),
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '沒有收錄的記憶體廠', en: 'No memory fabs listed' },
    },
  ],
};
