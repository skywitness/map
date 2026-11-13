import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * AI 產業鏈的公司（新主題，2026-11-13 使用者要求把「AI 產業鏈全景」網站的資料用在地圖上；pipeline/topics/ai_chain.py）：
 * 同一作者的 skywitness/ai-chain 公司名冊（710 家、14 個環節、5 層），總部的位置用 Wikidata 的城市座標。
 */
const C = MAP_TOKENS.categorical;

/** 14 個環節（由下而上，跟 pipeline 的 sources/ai_chain.py SEGMENTS 同順序；s 是第幾個） */
const SEGMENTS = [
  { id: 'energy-power', label: { zh: '能源與電力', en: 'Energy & power' } },
  { id: 'semi-equipment-materials', label: { zh: '半導體設備與材料', en: 'Semiconductor equipment & materials' } },
  { id: 'foundry-packaging', label: { zh: '晶圓代工與先進封裝', en: 'Foundry & advanced packaging' } },
  { id: 'memory-storage', label: { zh: '記憶體與儲存', en: 'Memory & storage' } },
  { id: 'eda-ip-design', label: { zh: '設計工具與矽智財', en: 'EDA, IP & design services' } },
  { id: 'ai-accelerators', label: { zh: 'AI 晶片與加速器', en: 'AI chips & accelerators' } },
  { id: 'networking-optics', label: { zh: '網通與光通訊', en: 'Networking & optics' } },
  { id: 'servers-systems', label: { zh: '伺服器與系統', en: 'Servers & systems' } },
  { id: 'datacenter-infra', label: { zh: '資料中心', en: 'Data centres' } },
  { id: 'cloud-neocloud', label: { zh: '雲端與新雲', en: 'Cloud & neoclouds' } },
  { id: 'foundation-models', label: { zh: '基礎模型', en: 'Foundation models' } },
  { id: 'devtools-data-mlops', label: { zh: '開發工具與資料', en: 'Developer tools, data & MLOps' } },
  { id: 'apps-agents', label: { zh: '應用與 Agent', en: 'Applications & agents' } },
  { id: 'physical-ai', label: { zh: '實體 AI', en: 'Physical AI' } },
];
const SEGMENT_OPTIONS = [{ id: 'all', label: { zh: '全部環節', en: 'All segments' } }, ...SEGMENTS];

/** 5 層（l）：點的顏色 */
const LAYERS: ColorClasses = {
  field: 'l',
  title: { zh: '產業鏈的層', en: 'Layer of the chain' },
  thresholds: [1.5, 2.5, 3.5, 4.5],
  classes: [
    { color: C[3], label: { zh: '能源', en: 'Energy' } },
    { color: C[0], label: { zh: '晶片與半導體', en: 'Chips & semiconductors' } },
    { color: C[2], label: { zh: '系統與基礎設施', en: 'Systems & infrastructure' } },
    { color: C[1], label: { zh: '雲端與模型', en: 'Cloud & models' } },
    { color: C[4], label: { zh: '應用與實體 AI', en: 'Applications & physical AI' } },
  ],
};
const TIERS = [
  { zh: '一線', en: 'Tier 1' },
  { zh: '二線', en: 'Tier 2' },
  { zh: '三線與新創', en: 'Tier 3 & start-ups' },
];

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const segmentOf = (p: PointRecord) => tr(SEGMENTS[Number(p.s) - 1]?.label ?? SEGMENTS[0].label);
const tierOf = (p: PointRecord) => tr(TIERS[Number(p.t) - 1] ?? TIERS[2]);
/** 公司名稱：中文介面有中文名時寫「中文名（原名）」 */
const companyName = (p: PointRecord) => {
  const zh = str(p.zh);
  return getLang() === 'zh' && zh ? `${zh}（${p.name}）` : String(p.name ?? ''); // i18n-ignore（只在中文介面）
};
const cityOf = (p: PointRecord) => (getLang() === 'zh' ? str(p.city) : str(p.cityEn)) ?? '';
const SEP = tr({ zh: '・', en: ' · ' });

function lines(p: PointRecord, countryName: (iso3: string) => string): string[] {
  const where = [cityOf(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(tr({ zh: '，', en: ', ' }));
  return [
    [segmentOf(p), tierOf(p), where].filter(Boolean).join(SEP),
    // 定位是 ai-chain 寫的中文，英文介面不放
    getLang() === 'zh' ? (str(p.role) ?? '') : '',
    p.q === 2
      ? tr({ zh: '總部位置：沿用 AI 產業鏈全景的座標（Wikidata 對不到這個城市）', en: 'HQ location from AI Chain (no Wikidata match for the city)' })
      : '',
  ].filter(Boolean);
}

const COMPANIES: PointsOverlayDef = {
  kind: 'points',
  id: 'companies',
  file: 'companies.json',
  label: { zh: 'AI 產業鏈公司的總部', en: 'AI supply-chain company headquarters' },
  radius: { field: 'w', stops: [[1, 3], [3, 6]] },
  color: LAYERS,
  sortField: 'w',
  cluster: {
    maxZoom: 6,
    radius: 40,
    size: (total) => Math.min(26, 7 + 1.4 * Math.sqrt(total)),
    format: (total) => fixed(total, 0),
    title: { zh: '這一區的公司 ', en: 'Companies in this area: ' },
  },
  tooltip: (p, { countryName }) => {
    const [head, ...rest] = lines(p, countryName);
    return { title: companyName(p), detail: head, extra: rest, properNoun: String(p.name ?? '') };
  },
};


/** 台灣 AI 供應鏈據點（ai-chain 的 taiwan/sites.yaml；k 是種類，cs 是座標出處：1 維基百科、2 OpenStreetMap） */
const SITE_KINDS = [
  { zh: '科學園區', en: 'Science park' },
  { zh: '晶圓廠', en: 'Wafer fab' },
  { zh: '先進封裝與封測', en: 'Packaging & testing' },
  { zh: '伺服器聚落與資料中心', en: 'Server cluster & data centre' },
  { zh: '研究機構', en: 'Research institute' },
  { zh: '港口與機場', en: 'Port & airport' },
];
const TAIWAN_SITES: PointsOverlayDef = {
  kind: 'points',
  id: 'taiwan-sites',
  file: 'taiwan-sites.json',
  label: { zh: '台灣 AI 供應鏈據點（三角形）', en: 'Taiwan AI supply-chain sites (triangles)' },
  shape: 'triangle',
  radius: 6,
  // 單色（種類寫在 tooltip）：依種類上色的圖例有 6 行，會把左邊的公司清單擠掉
  color: MAP_TOKENS.ink,
  tooltip: (p) => {
    const zh = getLang() === 'zh';
    const kind = SITE_KINDS[Number(p.k) - 1];
    return {
      title: zh ? String(p.name ?? '') : String(p.nameEn ?? p.name ?? ''),
      detail: [kind ? tr(kind) : null, zh ? str(p.city) : null].filter(Boolean).join(SEP),
      extra: [
        (zh ? str(p.cos) : str(p.cosEn)) ? tr({ zh: `名冊裡的公司：${p.cos}`, en: `Companies in the roster: ${p.cosEn}` }) : '',
        zh ? (str(p.note) ?? '') : '',
        p.cs === 1
          ? tr({ zh: '座標：維基百科', en: 'Coordinates: Wikipedia' })
          : tr({ zh: '座標：OpenStreetMap', en: 'Coordinates: OpenStreetMap' }),
      ].filter(Boolean),
      properNoun: zh ? undefined : String(p.nameEn ?? ''),
    };
  },
};

/** 左邊的清單：依環節分組（由下而上），組內一線在前；跟選取的國家連動 */
const LIST: ListPanelDef = {
  label: { zh: 'AI 產業鏈的公司', en: 'AI supply-chain companies' },
  tabLabel: { zh: '公司', en: 'Companies' },
  file: 'companies.json',
  countryField: 'iso3',
  empty: { zh: '這個國家沒有收錄的公司', en: 'No companies listed for this country' },
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(a.s) - Number(b.s) || Number(a.t) - Number(b.t) || String(a.name).localeCompare(String(b.name)))
      .map(
        (p): ListRow => ({
          key: String(p.id),
          title: companyName(p),
          titleProper: getLang() !== 'zh',
          lines: lines(p, countryName).slice(0, 2),
          group: segmentOf(p),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 11 },
        }),
      ),
};

const companies = (v: number) => tr({ zh: `${fixed(v, 0)} 家`, en: v === 1 ? '1 company' : `${fixed(v, 0)} companies` });

export const aiChain: TopicDefinition = {
  id: 'ai-chain',
  title: { zh: 'AI 產業鏈的公司：從電力、晶片到模型與應用，總部在哪裡', en: 'AI supply-chain companies: where the firms from power and chips to models and apps are based' },
  shortTitle: { zh: 'AI 產業鏈的公司', en: 'AI supply chain' },
  defaultIndicator: 'companies',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'AI 產業鏈全景：公司名冊（資料基準日 2026-10-06）', en: 'AI Chain (AI 產業鏈全景): company roster (as of 6 Oct 2026)' }, // i18n-ignore（網站的中文名稱是專有名詞）
      url: 'https://skywitness.github.io/ai-chain/companies/',
      license: { zh: 'CC BY 4.0（同一作者）', en: 'CC BY 4.0 (same author)' },
    },
    { name: { zh: 'Wikidata（總部城市的位置）', en: 'Wikidata (HQ city locations)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: 'AI 產業鏈全景：台灣 AI 供應鏈地圖的據點（座標出自維基百科與 OpenStreetMap）', en: 'AI Chain (AI 產業鏈全景): Taiwan AI supply-chain sites (coordinates from Wikipedia and OpenStreetMap)' }, // i18n-ignore（網站的中文名稱是專有名詞）
      url: 'https://skywitness.github.io/ai-chain/taiwan/',
      license: { zh: 'CC BY 4.0（同一作者）；座標 CC BY-SA 4.0（維基百科）、ODbL 1.0（OpenStreetMap）', en: 'CC BY 4.0 (same author); coordinates CC BY-SA 4.0 (Wikipedia), ODbL 1.0 (OpenStreetMap)' },
    },
  ],
  note: {
    zh: '「AI 產業鏈全景」是同一作者的網站，把 AI 產業鏈由下而上分成 5 層、14 個環節，整理全球 710 家一線、二線、三線與新創公司，每家只算一個主要環節（例如三星算記憶體、Tesla 算實體 AI）。這是編者挑選的名冊，不是完整的產業普查，台灣公司收得比較多。總部只到城市：位置是那個城市在 Wikidata 的座標，同一個城市的公司錯開排開，放大才看得到每一家；6 個城市對不到 Wikidata，沿用網站上的座標。點一家公司看它的環節、等級與一句定位，左邊的清單依環節分組。三角形是網站的台灣 AI 供應鏈地圖的 23 個據點：科學園區、晶圓廠、先進封裝、伺服器聚落、研究機構與港口，座標出自維基百科或 OpenStreetMap。',
    en: 'AI Chain (AI 產業鏈全景) is a site by the same author that splits the AI supply chain, bottom up, into 5 layers and 14 segments and profiles 710 tier-1, tier-2, tier-3 and start-up companies worldwide, each counted under one main segment (Samsung under memory, Tesla under physical AI). It is an editor’s selection rather than a full census, and it covers Taiwanese firms in more depth. Headquarters are given only to the city: points use the city’s Wikidata coordinates, with firms in the same city spread apart so that each can be seen when zoomed in; 6 cities with no Wikidata match keep the site’s own coordinates. Click a company for its segment and tier; the list on the left is grouped by segment. Triangles are the 23 sites on the site’s Taiwan AI supply-chain map: science parks, wafer fabs, advanced packaging, server clusters, research institutes and ports, with coordinates from Wikipedia or OpenStreetMap.', // i18n-ignore（網站的中文名稱是專有名詞）
  },
  listPanel: LIST,
  overlays: [COMPANIES, TAIWAN_SITES],
  indicators: [
    {
      id: 'companies',
      label: { zh: '各國的 AI 產業鏈公司', en: 'AI supply-chain companies by country' },
      description: {
        zh: '總部在這個國家的公司數。710 家分布在 26 國：美國 278 家最多，台灣 125、中國 109、日本 48、南韓 28、德國 21。各國的強項不一樣：台灣以伺服器與系統 37 家最多（美國 11），晶圓代工與先進封裝 15 家也是第一；日本的 48 家裡 23 家是半導體設備與材料（全部 88 家的第一）；美國在應用、開發工具、基礎模型與資料中心都最多；中國以實體 AI 24 家、基礎模型 17 家、AI 晶片 14 家最多。用「環節」切換 14 個環節。',
        en: 'Number of companies headquartered in each country. The 710 are spread across 26 countries: the US has the most with 278, followed by Taiwan 125, China 109, Japan 48, South Korea 28 and Germany 21. Strengths differ: Taiwan leads in servers and systems with 37 (the US has 11) and in foundry and advanced packaging with 15; 23 of Japan’s 48 are in semiconductor equipment and materials, the most of any country among the 88; the US leads in applications, developer tools, foundation models and data centres; China’s largest groups are physical AI (24), foundation models (17) and AI chips (14). Switch among the 14 segments with the segment menu.',
      },
      unit: { zh: '家', en: 'companies' },
      file: 'count/{item}.json',
      dimension: { label: { zh: '環節', en: 'Segment' }, options: SEGMENT_OPTIONS, defaultOption: 'all' },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 25, 50, 100] } },
      integer: true,
      timeless: true,
      format: companies,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '沒有收錄的公司', en: 'No companies listed' },
    },
    {
      id: 'tier1',
      label: { zh: '一線公司', en: 'Tier-1 companies' },
      description: {
        zh: '編者列為「一線」、對 AI 產業鏈有決定性影響的 103 家公司，依總部所在國：美國 56、台灣 15、中國 12、日本 8，德國、荷蘭、南韓、法國各 2，英國、香港、愛爾蘭、以色列各 1。滑過國家看是哪幾家。',
        en: 'The 103 companies the editors rank as tier 1, with decisive influence on the AI supply chain, by headquarters country: the US 56, Taiwan 15, China 12, Japan 8, Germany, the Netherlands, South Korea and France 2 each, and the UK, Hong Kong, Ireland and Israel 1 each. Hover over a country to see which.',
      },
      unit: { zh: '家', en: 'companies' },
      file: 'tier1.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 20, 50] } },
      integer: true,
      timeless: true,
      format: companies,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '沒有一線公司', en: 'No tier-1 companies' },
    },
  ],
};
