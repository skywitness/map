#!/usr/bin/env node
/**
 * 產生主題目錄 src/topics/catalog.gen.ts 與主題搜尋的子項目 catalogItems.gen.ts（src/topics/catalog.ts）：頂列選單、主題總覽、主題搜尋用的
 * 主題名稱、指標名稱與子項目名稱。主題定義各自一個 chunk（registry.ts），首頁的程式不必包含全部主題。
 *
 *   npm run catalog            重新產生（npm run dev、npm run build 會先跑）
 *   npm run catalog -- --check 只比對，跟主題定義對不起來時結束碼 1
 *
 * 用 Vite 的 SSR 載入 TypeScript 的主題定義（不必另外編譯）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// 主題定義會載入 i18n，它在模組載入時讀網址與 localStorage 的語言設定、設定 <html lang>
const noop = () => {};
globalThis.window ??= { location: { search: '' }, addEventListener: noop, removeEventListener: noop };
globalThis.localStorage ??= { getItem: () => null, setItem: noop, removeItem: noop };
globalThis.document ??= { documentElement: {}, title: '', addEventListener: noop, querySelector: () => null };

const OUT = `${ROOT}src/topics/catalog.gen.ts`;
/** 主題搜尋的子項目：另一個檔，第一次搜尋時才下載（lib/topicSearch.ts，2026-10-30） */
const OUT_ITEMS = `${ROOT}src/topics/catalogItems.gen.ts`;
const check = process.argv.includes('--check');

const server = await createServer({
  root: ROOT,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { TOPIC_GROUP_SPECS, TOPIC_MODULES, topicOf } = await server.ssrLoadModule('/src/topics/registry.ts');
  const { summarize, searchItems } = await server.ssrLoadModule('/src/topics/catalog.ts');
  const { pureMap } = await server.ssrLoadModule('/src/topics/map.ts');
  const { population } = await server.ssrLoadModule('/src/topics/population.ts');

  const ids = TOPIC_GROUP_SPECS.flatMap((g) => g.sections.flatMap((s) => s.topics));
  const missing = ids.filter((id) => id !== population.id && !TOPIC_MODULES[id]);
  const extra = Object.keys(TOPIC_MODULES).filter((id) => !ids.includes(id));
  if (missing.length || extra.length) {
    throw new Error(`registry.ts：分類裡的主題跟 TOPIC_MODULES 對不起來（缺 ${missing.join(', ') || '無'}；多 ${extra.join(', ') || '無'}）`);
  }

  // 相關主題（related.ts，2026-10-30）：每個主題都要有一列，連到的主題要存在（合併、改名後才不會連到不存在的主題）
  const { RELATED } = await server.ssrLoadModule('/src/topics/related.ts');
  const badRelated = [
    ...ids.filter((id) => !RELATED[id]).map((id) => `${id} 沒有相關主題`),
    ...Object.entries(RELATED).flatMap(([id, list]) =>
      [id, ...list].filter((x) => !ids.includes(x)).map((x) => `${id} 的 ${x} 不是現有的主題`),
    ),
  ];
  if (badRelated.length) throw new Error(`related.ts：${badRelated.join('；')}`);

  const topics = [pureMap];
  for (const id of ids) topics.push(id === population.id ? population : topicOf(await TOPIC_MODULES[id](), id));

  for (const t of topics) {
    if (!t.title || !t.shortTitle || !t.indicators.length || t.indicators.some((i) => !i.id || !i.label)) {
      throw new Error(`主題 ${t.id} 缺名稱或指標名稱`);
    }
  }

  const lines = [
    '/**',
    ' * 這個檔由 scripts/topic-catalog.mjs 從主題定義產生（npm run catalog），不要手動修改。',
    ' * i18n-ignore-file：內容是主題定義裡的雙語文字（{ zh, en }），check:i18n 已經檢查過原本的檔',
    ' */',
    "import type { TopicCatalog } from './catalog';",
    '',
    'export const CATALOG: TopicCatalog = {',
    '  topics: {',
    ...topics.map((t) => `    ${JSON.stringify(t.id)}: ${JSON.stringify(summarize(t))},`),
    '  },',
    '};',
    '',
  ];
  const itemLines = [
    '/**',
    ' * 這個檔由 scripts/topic-catalog.mjs 從主題定義產生（npm run catalog），不要手動修改。',
    ' * 主題搜尋比對的子項目（農產品、礦產、連鎖品牌…），第一次搜尋時才下載（lib/topicSearch.ts）。',
    ' * i18n-ignore-file：內容是主題定義裡的雙語文字（{ zh, en }），check:i18n 已經檢查過原本的檔',
    ' */',
    "import type { TopicSearchItem } from './catalog';",
    '',
    'export const SEARCH_ITEMS: TopicSearchItem[] = [',
    ...topics.flatMap((t) => searchItems(t).map((item) => `  ${JSON.stringify(item)},`)),
    '];',
    '',
  ];
  const files = [
    [OUT, lines.join('\n')],
    [OUT_ITEMS, itemLines.join('\n')],
  ];
  const stale = [];
  for (const [file, text] of files) {
    let current = '';
    try {
      current = readFileSync(file, 'utf8');
    } catch {
      // 第一次產生
    }
    if (current === text) continue;
    stale.push(file.slice(ROOT.length));
    if (!check) writeFileSync(file, text);
  }
  if (check) {
    if (stale.length) {
      console.error(`${stale.join('、')} 跟主題定義對不起來，請跑 npm run catalog`);
      process.exitCode = 1;
    } else console.log('主題目錄跟主題定義一致');
  } else if (stale.length) {
    console.log(`主題目錄：${topics.length} 個主題，寫入 ${stale.join('、')}（${files.map(([, t]) => `${Math.round(t.length / 1024)} KB`).join('、')}）`);
  }
} finally {
  await server.close();
}
