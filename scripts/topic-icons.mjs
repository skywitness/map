#!/usr/bin/env node
/**
 * 主題與分類的圖示：從 Lucide（lucide-static，ISC 授權）挑選，每個圖示的線條轉成一條 SVG path，產生
 *
 *   src/topics/icons.gen.ts        每個主題的圖示（主題選單、主題總覽才用，TopicIcon.tsx 動態載入）
 *   src/topics/groupIcons.gen.ts   頂列分類按鈕、純地圖與指令面板的圖示（首頁就要，很小）
 *
 *   npm run icons              改了下面的對照表之後重新產生
 *   npm run icons -- --check   只檢查（CI）：每個主題都有圖示、產生的檔是最新的
 *
 * 新增主題時在 TOPIC_ICONS 加一行（名稱查 https://lucide.dev/icons/），沒有的話這裡會報錯。
 * 同一個圖示不要給兩個主題（也報錯），分類的圖示也不要跟主題重複，選單裡才分得出來。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');

/** 頂列的分類（registry.ts 的 TOPIC_GROUP_SPECS）與純地圖 */
const GROUP_ICONS = {
  map: 'map',
  society: 'person-standing',
  economy: 'coins',
  global: 'earth',
  // 能源 2026-10-30（第十一批 187）併進科技，環境改用原本能源的葉子
  environment: 'leaf',
  tech: 'monitor-smartphone',
  transport: 'bus',
  geo: 'mountain-snow',
};

/** 介面用的圖示：指令面板（CommandPalette.tsx）的國家與指令、狀態畫面（StatusCard.tsx）的離線、錯誤、沒有資料 */
const UI_ICONS = {
  country: 'map-pin',
  command: 'command',
  offline: 'cloud-off',
  error: 'triangle-alert',
  empty: 'chart-no-axes-column',
  saved: 'bookmark',
};

const TOPIC_ICONS = {
  // 社會
  population: 'users',
  fertility: 'baby',
  marriage: 'heart-handshake',
  cities: 'building-2',
  health: 'heart-pulse',
  disease: 'microscope',
  vaccination: 'syringe',
  height: 'ruler',
  'blood-types': 'droplet',
  'tobacco-alcohol': 'wine',
  education: 'graduation-cap',
  pisa: 'book-open-check',
  diet: 'utensils',
  housing: 'house',
  // 不用特定宗教的符號（教堂、清真寺…）
  religion: 'book-heart',
  festivals: 'party-popper',
  inequality: 'scale',
  gender: 'venus-and-mars',
  crime: 'gavel',
  laws: 'scroll-text',
  happiness: 'smile',
  nobel: 'award',
  sports: 'medal',
  racing: 'flag-triangle-right',
  reads: 'book-open',
  // 經濟
  income: 'banknote',
  wages: 'clock',
  employment: 'briefcase',
  wealth: 'piggy-bank',
  fiscal: 'receipt',
  taxes: 'percent',
  reserves: 'vault',
  'stock-market': 'chart-candlestick',
  sectors: 'chart-pie',
  industry: 'factory',
  agriculture: 'wheat',
  minerals: 'pickaxe',
  'chain-stores': 'store',
  companies: 'briefcase-business',
  // 國際
  trade: 'container',
  migration: 'footprints',
  aid: 'hand-heart',
  'china-lending': 'hand-coins',
  tourism: 'luggage',
  passport: 'stamp',
  military: 'shield',
  conflict: 'swords',
  news: 'newspaper',
  empires: 'crown',
  democracy: 'vote',
  governance: 'landmark',
  organizations: 'handshake',
  'un-votes': 'hand',
  'taiwan-diplomacy': 'globe',
  pandas: 'paw-print',
  // 能源
  electricity: 'zap',
  'power-plants': 'utility-pole',
  'fossil-fuels': 'fuel',
  'energy-prices': 'badge-dollar-sign',
  'energy-policy': 'milestone',
  'science-facilities': 'atom',
  renewables: 'solar-panel',
  climate: 'cloud',
  temperature: 'thermometer-sun',
  'ozone-hole': 'circle-dashed',
  'air-quality': 'haze',
  'water-forest': 'trees',
  'oil-palm': 'droplets',
  'planted-forests': 'sprout',
  plastic: 'recycle',
  ewaste: 'monitor-x',
  ev: 'plug-zap',
  // 科技與交通
  ai: 'brain-circuit',
  semiconductors: 'cpu',
  digital: 'smartphone',
  'internet-speed': 'gauge',
  developers: 'code-xml',
  innovation: 'lightbulb',
  publications: 'file-text',
  'submarine-cables': 'cable',
  space: 'rocket',
  transport: 'train-front',
  'high-speed-rail': 'train-front-tunnel',
  metro: 'tram-front',
  aviation: 'plane-takeoff',
  'air-routes': 'route',
  'ride-hailing': 'car-taxi-front',
  airspace: 'radar',
  'cable-cars': 'cable-car',
  'heritage-railways': 'train-track',
  shipping: 'anchor',
  logbooks: 'sailboat',
  'road-safety': 'traffic-cone',
  vehicles: 'motorbike',
  // 地理
  profiles: 'id-card',
  flags: 'flag',
  language: 'languages',
  elevation: 'mountain',
  rivers: 'waves',
  oceans: 'fish',
  koppen: 'cloud-sun-rain',
  ice: 'snowflake',
  antarctica: 'tent',
  wind: 'wind',
  daylight: 'sun-moon',
  eclipses: 'eclipse',
  antipodes: 'arrow-up-down',
  'taipei-view': 'compass',
  magnetic: 'magnet',
  aurora: 'sparkles',
  earthquakes: 'activity',
  plates: 'puzzle',
  lithology: 'layers',
  'special-landforms': 'tree-palm',
  reclamation: 'land-plot',
  'nuclear-accidents': 'radiation',
  'nuclear-waste': 'cylinder',
  typhoons: 'tornado',
  wildfires: 'flame',
  'night-lights': 'moon-star',
  'world-heritage': 'castle',
  'national-parks': 'tree-pine',
  trails: 'signpost',
  skyscrapers: 'building',
  attractions: 'ferris-wheel',
  travel: 'plane',
};

const n = (v) => Number(v);
/** 數字最多兩位小數，去掉多餘的 0 */
const f = (v) => String(Math.round(v * 100) / 100);

/** Lucide 的一個元素轉成 path 的 d。全部只畫線條：填色的只有半徑 0.5 的小圓點，線寬 2 畫出來一樣是圓點 */
function toPath([tag, a]) {
  if (a.fill && a.fill !== 'none' && !(tag === 'circle' && n(a.r) <= 1)) throw new Error(`有填色的元素（${tag}），TopicIcon 只畫線條`);
  switch (tag) {
    case 'path':
      // 合成一條 path 時，開頭的小寫 m 會變成相對於上一段的終點；前面加 M0 0（只有移動的子路徑不會畫出東西），相對就等於絕對
      return /^\s*m/.test(a.d) ? `M0 0${a.d}` : a.d;
    case 'line':
      return `M${f(n(a.x1))} ${f(n(a.y1))}L${f(n(a.x2))} ${f(n(a.y2))}`;
    case 'polyline':
    case 'polygon': {
      const pts = a.points.trim().split(/[\s,]+/).map(n);
      let d = `M${f(pts[0])} ${f(pts[1])}`;
      for (let i = 2; i < pts.length; i += 2) d += `L${f(pts[i])} ${f(pts[i + 1])}`;
      return tag === 'polygon' ? `${d}z` : d;
    }
    case 'circle':
    case 'ellipse': {
      const [cx, cy] = [n(a.cx), n(a.cy)];
      const [rx, ry] = tag === 'circle' ? [n(a.r), n(a.r)] : [n(a.rx), n(a.ry)];
      return `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0`;
    }
    case 'rect': {
      const [x, y, w, h] = [n(a.x ?? 0), n(a.y ?? 0), n(a.width), n(a.height)];
      const rx = Math.min(n(a.rx ?? a.ry ?? 0), w / 2);
      const ry = Math.min(n(a.ry ?? a.rx ?? 0), h / 2);
      if (!rx) return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
      const arc = (dx, dy) => `a${f(rx)} ${f(ry)} 0 0 1 ${f(dx)} ${f(dy)}`;
      return (
        `M${f(x + rx)} ${f(y)}h${f(w - 2 * rx)}${arc(rx, ry)}v${f(h - 2 * ry)}${arc(-rx, ry)}` +
        `h${f(-(w - 2 * rx))}${arc(-rx, -ry)}v${f(-(h - 2 * ry))}${arc(rx, -ry)}z`
      );
    }
    default:
      throw new Error(`不認得的 SVG 元素 ${tag}`);
  }
}

const require = createRequire(import.meta.url);
const ICON_DIR = `${require.resolve('lucide-static/package.json').slice(0, -'package.json'.length)}icons/`;
const problems = [];

/** 圖示的 SVG 檔裡的元素：[標籤, 屬性] */
function parse(name) {
  let svg;
  try {
    svg = readFileSync(`${ICON_DIR}${name}.svg`, 'utf8');
  } catch {
    return null;
  }
  return [...svg.matchAll(/<(path|circle|ellipse|rect|line|polyline|polygon)\s([^>]*?)\/>/g)].map((m) => [
    m[1],
    Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])),
  ]);
}

function icon(name, owner) {
  const parts = parse(name);
  if (!parts?.length) {
    problems.push(`${owner}：Lucide 沒有「${name}」這個圖示`);
    return '';
  }
  try {
    return parts.map(toPath).join('');
  } catch (e) {
    problems.push(`${owner}（${name}）：${e.message}`);
    return '';
  }
}

// 每個分類裡的主題（registry.ts），跟對照表比對
const registry = readFileSync(`${ROOT}src/topics/registry.ts`, 'utf8');
// 每個分類是 { id: '…', label: …, sections: [{ label: …, topics: [...] }, …] }（2026-10-30 起有小標題）
const specs = registry.slice(registry.indexOf('TOPIC_GROUP_SPECS'), registry.indexOf('export const groupTopics'));
const groups = specs
  .split(/\n {4}id: '/)
  .slice(1)
  .map((block) => ({
    id: block.slice(0, block.indexOf("'")),
    topics: [...block.matchAll(/topics: \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/'([\w-]+)'/g)].map((t) => t[1])),
  }));
if (!groups.length) problems.push('registry.ts 裡找不到 TOPIC_GROUP_SPECS');
const topics = groups.flatMap((g) => g.topics);
for (const g of groups) if (!GROUP_ICONS[g.id]) problems.push(`分類 ${g.id} 沒有圖示（GROUP_ICONS）`);
for (const id of topics) if (!TOPIC_ICONS[id]) problems.push(`主題 ${id} 沒有圖示（TOPIC_ICONS）`);
for (const id of Object.keys(TOPIC_ICONS)) if (!topics.includes(id)) problems.push(`TOPIC_ICONS 的 ${id} 不在 registry.ts 的分類裡`);
const used = new Map();
for (const [owner, name] of [
  ...Object.entries(GROUP_ICONS).map(([k, v]) => [`分類 ${k}`, v]),
  ...Object.entries(UI_ICONS).map(([k, v]) => [`介面 ${k}`, v]),
  ...Object.entries(TOPIC_ICONS),
]) {
  if (used.has(name)) problems.push(`「${name}」同時給了 ${used.get(name)} 與 ${owner}`);
  used.set(name, owner);
}

const HEADER = (what) => `/**
 * 這個檔由 scripts/topic-icons.mjs 產生（npm run icons），不要手動修改。
 * ${what}：Lucide 圖示（https://lucide.dev，ISC 授權，Copyright (c) Lucide Icons and Contributors），
 * 線條合成一條 path，24×24、stroke-width 2、圓角端點（TopicIcon.tsx）。
 */
`;
const record = (entries) =>
  `{\n${entries.map(([k, name, d]) => `  ${JSON.stringify(k)}: ${JSON.stringify(d)}, // ${name}`).join('\n')}\n}`;

const topicSource =
  HEADER('每個主題的圖示（主題選單、主題總覽）') +
  `export const TOPIC_ICONS: Record<string, string> = ${record(topics.map((id) => [id, TOPIC_ICONS[id], icon(TOPIC_ICONS[id], id)]))};\n`;
const groupSource =
  HEADER('頂列分類按鈕、純地圖與介面（指令面板）的圖示') +
  `export const GROUP_ICONS: Record<string, string> = ${record(
    Object.entries(GROUP_ICONS).map(([id, name]) => [id, name, icon(name, `分類 ${id}`)]),
  )};\n\n` +
  `export const UI_ICONS: Record<${Object.keys(UI_ICONS).map((k) => `'${k}'`).join(' | ')}, string> = ${record(
    Object.entries(UI_ICONS).map(([id, name]) => [id, name, icon(name, `介面 ${id}`)]),
  )};\n`;

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const outputs = [
  [`${ROOT}src/topics/icons.gen.ts`, topicSource],
  [`${ROOT}src/topics/groupIcons.gen.ts`, groupSource],
];
if (check) {
  const stale = outputs.filter(([path, source]) => {
    try {
      return readFileSync(path, 'utf8') !== source;
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`圖示檔不是最新的，請跑 npm run icons：${stale.map(([p]) => p.slice(ROOT.length)).join('、')}`);
    process.exit(1);
  }
  console.log(`${topics.length} 個主題、${Object.keys(GROUP_ICONS).length} 個分類都有圖示，檔案是最新的`);
} else {
  for (const [path, source] of outputs) writeFileSync(path, source);
  console.log(`${topics.length} 個主題、${Object.keys(GROUP_ICONS).length} 個分類的圖示已產生（${Math.round(topicSource.length / 1024)} KB）`);
}
