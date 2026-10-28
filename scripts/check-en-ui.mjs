#!/usr/bin/env node
/**
 * 用無頭 Chrome 打開英文版，逐一切換每個主題、每個指標、排名表、國家側欄、框選結果，
 * 收集畫面上的文字（含 aria-label、title、選單選項），列出還沒翻譯的中文：npm run check:en
 *
 * 另外檢查：中文 ↔ 英文切換不必重新整理、<html lang> 與分頁標題跟著變、底圖地名換成英文、
 * 帶 lang=en 的網址直接打開就是英文。
 *
 * 需要 puppeteer-core（不在 package.json，免得每個人都要裝）與系統的 Chrome：
 *   npm i --no-save puppeteer-core     或 PUPPETEER_CORE=<含 node_modules/puppeteer-core 的資料夾>
 *   CHROME_PATH=<chrome 執行檔>         （預設找 Windows / macOS / Linux 的常見位置）
 * WebGL 用 SwiftShader 軟體繪製（DESIGN.md §10）。
 * 專有名詞（例如 OpenStreetMap 上的營運者原名）放在 translate="no" 的元素裡就不會被算進去。
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CJK = /[\u3000-\u303f\u3400-\u9fff\uf900-\ufaff\uff01-\uff60]/;
// 第一個國家用帶 lang=en 的網址打開，其他的用搜尋框選（不重新載入，比較快）
const COUNTRIES = (process.env.CHECK_COUNTRIES ?? 'TWN,USA,KEN').split(',');

function loadPuppeteer() {
  const require = createRequire(import.meta.url);
  const paths = process.env.PUPPETEER_CORE ? [process.env.PUPPETEER_CORE] : undefined;
  const mod = require(require.resolve('puppeteer-core', paths && { paths }));
  return mod.launch ? mod : mod.default;
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('找不到 Chrome，請設定 CHROME_PATH');
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 等資料載完：地圖不再調淡、沒有「Loading…」 */
async function settle(page) {
  await page
    .waitForFunction(
      () =>
        !document.querySelector('.map.is-dimmed, [aria-busy="true"]') &&
        ![...document.querySelectorAll('.empty, .loading, .box-result-value')].some((e) =>
          /Loading|載入中/.test(e.textContent ?? ''),
        ),
      { timeout: 20000, polling: 100 },
    )
    .catch(() => {});
  await sleep(200);
}

/** 畫面上所有給人看的文字；translate="no" 與 lang="zh…" 的元素（專有名詞、語言切換鈕）略過 */
function collectTexts() {
  // 只看 body 裡標了 lang 的元素：中文介面的 <html lang="zh-Hant-TW"> 不算
  const skip = (el) => el.closest('[translate="no"], body [lang^="zh"], script, style');
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent?.trim();
    if (text && n.parentElement && !skip(n.parentElement)) out.push(text);
  }
  for (const el of document.querySelectorAll('[aria-label], [title], [placeholder], optgroup[label], [aria-valuetext]')) {
    if (skip(el)) continue;
    for (const attr of ['aria-label', 'title', 'placeholder', 'label', 'aria-valuetext']) {
      const v = el.getAttribute(attr);
      if (v) out.push(v);
    }
  }
  for (const el of document.querySelectorAll('datalist option')) out.push(el.getAttribute('value') ?? '');
  out.push(document.title);
  return out;
}

const problems = new Map(); // 文字 → 第一次出現的位置
async function check(page, where) {
  const texts = await page.evaluate(collectTexts);
  for (const text of texts) {
    if (CJK.test(text) && !problems.has(text)) {
      problems.set(text, where);
      console.log(`  中文 [${where}] ${text.slice(0, 160)}`);
    }
  }
}

const failures = [];
function expect(ok, message) {
  if (!ok) failures.push(message);
}

async function main() {
  const puppeteer = loadPuppeteer();
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5390 } });
  await server.listen();
  const base = server.resolvedUrls.local[0];
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    // 用 root 跑（容器裡）時 Chrome 不開沙箱就不肯啟動
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--window-size=1400,950',
      '--lang=en-US',
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    ],
    defaultViewport: { width: 1400, height: 950 },
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => failures.push(`頁面錯誤：${e.message}`));
    await page.evaluateOnNewDocument(() => localStorage.clear());

    // ── 1. 中文預設，切到英文、再切回中文，不重新整理 ──
    await page.goto(`${base}?topic=population`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.brand');
    await page.waitForFunction(() => window.__map?.isStyleLoaded(), { timeout: 60000 });
    await settle(page);
    const state = () =>
      page.evaluate(() => ({
        brand: document.querySelector('.brand')?.textContent,
        lang: document.documentElement.lang,
        title: document.title,
        url: location.search,
        labels: window.__map
          ?.getStyle()
          .layers.filter((l) => l.type === 'symbol' && JSON.stringify(l.layout?.['text-field'] ?? '').includes('name'))
          .map((l) => JSON.stringify(l.layout['text-field'])),
      }));
    const zh = await state();
    expect(zh.brand === '世界資料地圖' && zh.lang === 'zh-Hant-TW', `預設不是中文：${JSON.stringify(zh)}`);
    // 檢查本身的對照組：中文介面一定收集得到中文，否則下面「沒有中文」的結果不可信
    const zhTexts = await page.evaluate(collectTexts);
    expect(zhTexts.filter((t) => CJK.test(t)).length > 20, '檢查本身有問題：中文介面也沒收集到中文');
    await page.evaluate(() => (window.__navigations = performance.getEntriesByType('navigation').length));
    await page.click('.lang-switch [lang="en"]');
    await settle(page);
    const en = await state();
    expect(en.brand === 'World Data Map', `切換後標題不是英文：${en.brand}`);
    expect(en.lang === 'en' && en.title === 'World Data Map', `<html lang> 或分頁標題沒跟著變：${en.lang} / ${en.title}`);
    expect(en.url.includes('lang=en'), `網址沒有 lang=en：${en.url}`);
    expect(en.labels?.length > 0 && en.labels.every((l) => l.includes('name:en')), '底圖地名沒有換成英文');
    await check(page, 'population（切換後）');
    await page.click('.lang-switch [lang="zh-Hant"]');
    await settle(page);
    const back = await state();
    expect(back.brand === '世界資料地圖' && back.lang === 'zh-Hant-TW', `切回中文失敗：${JSON.stringify(back)}`);
    expect(!back.url.includes('lang='), `切回中文後網址還有 lang：${back.url}`);
    expect(back.labels?.every((l) => l.includes('name:zh-Hant')), '切回中文後底圖地名不是中文');
    const reloaded = await page.evaluate(() => performance.getEntriesByType('navigation').length !== window.__navigations);
    expect(!reloaded, '切換語言時重新整理了頁面');
    await page.click('.lang-switch [lang="en"]');
    await settle(page);

    // ── 2. 每個主題、每個指標（地圖與排名表）、國家側欄 ──
    // 主題列：純地圖是一般按鈕，其他主題在分類的下拉選單裡（src/controls/TopicNav.tsx）
    const entries = [];
    const navButtons = await page.$$('.topics > button');
    for (let bi = 0; bi < navButtons.length; bi++) {
      const hasMenu = await navButtons[bi].evaluate((b) => b.getAttribute('aria-haspopup') === 'menu');
      if (!hasMenu) {
        entries.push({ bi });
        continue;
      }
      await navButtons[bi].click();
      await page.waitForSelector('.topic-menu');
      await check(page, `主題選單 ${bi}`);
      const count = await page.$$eval('.topic-menu [role="menuitemradio"]', (els) => els.length);
      await page.keyboard.press('Escape');
      for (let mi = 0; mi < count; mi++) entries.push({ bi, mi });
    }
    for (const entry of entries) {
      await (await page.$$('.topics > button'))[entry.bi].click();
      if (entry.mi !== undefined) {
        await page.waitForSelector('.topic-menu');
        await (await page.$$('.topic-menu [role="menuitemradio"]'))[entry.mi].click();
      }
      await settle(page);
      const topic = await page.evaluate(() => new URLSearchParams(location.search).get('topic'));
      console.log(`主題 ${topic}`);
      await check(page, `${topic}`);

      const indicatorSelect = await page.$('.controls-left .select-field:last-child select');
      const segments = await page.$$('.indicator-picker .segment');
      const indicatorCount = indicatorSelect
        ? await page.$$eval('.controls-left .select-field:last-child select option', (o) => o.length)
        : segments.length;
      let checkedItem = false;
      for (let ii = 0; ii < indicatorCount; ii++) {
        if (indicatorSelect) {
          const value = await page.$$eval(
            '.controls-left .select-field:last-child select option',
            (o, i) => o[i].value,
            ii,
          );
          await page.select('.controls-left .select-field:last-child select', value);
        } else {
          const segs = await page.$$('.indicator-picker .segment');
          await segs[ii].click();
        }
        await settle(page);
        const ind = await page.evaluate(() => new URLSearchParams(location.search).get('ind'));
        await check(page, `${topic}/${ind} 地圖`);

        // 有子項目（農產品、出口產業）的指標：子項目選單在最前面，換成最後一個選項再檢查一次
        const fields = await page.$$('.controls-left .select-field');
        if (!checkedItem && fields.length === (indicatorSelect ? 2 : 1)) {
          checkedItem = true;
          const sel = '.controls-left .select-field:first-child select';
          const values = await page.$$eval(`${sel} option`, (o) => o.map((x) => x.value));
          await page.select(sel, values[values.length - 1]);
          await settle(page);
          await check(page, `${topic}/${ind} 子項目 ${values[values.length - 1]}`);
        }
        // 地圖中央的 tooltip
        await page.mouse.move(700, 520);
        await sleep(150);
        await check(page, `${topic}/${ind} tooltip`);

        const viewButtons = await page.$$('.view-toggle .segment');
        if (viewButtons.length === 2) {
          await viewButtons[1].click();
          await settle(page);
          await check(page, `${topic}/${ind} 排名表`);
          await (await page.$$('.view-toggle .segment'))[0].click();
          await settle(page);
        }
      }

      // 國家側欄：第一個國家直接開帶 lang=en 的網址（同時驗證分享連結打開就是英文），其他用搜尋框
      for (const [ci, iso3] of COUNTRIES.entries()) {
        if (ci === 0) {
          const url = new URL(page.url());
          url.searchParams.set('country', iso3);
          url.searchParams.set('lang', 'en');
          await page.evaluate(() => localStorage.setItem('lang', 'zh')); // 偏好是中文，網址的 lang=en 要優先
          await page.goto(url.href, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('.brand');
          const brand = await page.$eval('.brand', (e) => e.textContent);
          expect(brand === 'World Data Map', `lang=en 的網址沒有打開英文版：${url.search}`);
        } else {
          await page.click('.search', { count: 3 });
          await page.type('.search', iso3);
          await sleep(150);
          await check(page, `${topic} 搜尋 ${iso3}`);
          await page.keyboard.press('Enter');
        }
        await settle(page);
        await check(page, `${topic} 側欄 ${iso3}`);
        // 側欄折線圖的 tooltip
        const chart = await page.$('.panel-chart [role="img"]');
        if (chart) {
          const box = await chart.boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
            await sleep(200);
            await check(page, `${topic} 側欄 ${iso3} 圖表 tooltip`);
          }
        }
      }
      const url = new URL(page.url());
      url.searchParams.delete('country');
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.brand');
      await settle(page);
    }

    // ── 3. 框選估算（人口） ──
    await page.goto(`${base}?topic=population&lang=en&bbox=119.000,21.000,123.000,26.000`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.box-result');
    await page.waitForFunction(() => /people/.test(document.querySelector('.box-result')?.textContent ?? ''), { timeout: 60000 }).catch(() => {});
    await settle(page);
    await check(page, 'population 框選');
    await page.click('.box-tool');
    await sleep(100);
    await check(page, 'population 框選模式');
    await page.keyboard.press('Escape');

    // ── 4. 3D：面量圖的階梯圖例、總量的柱子圖例與操作提示 ──
    for (const ind of ['density', 'total']) {
      await page.goto(`${base}?topic=population&ind=${ind}&lang=en&3d=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.map-legend .legend');
      await settle(page);
      await check(page, `3D ${ind}`);
    }
    const threeD = await page.$('.map-toggle');
    if (threeD) {
      await threeD.click(); // 關掉
      await settle(page);
      await (await page.$('.map-toggle'))?.click(); // 再打開，出現操作提示
      await sleep(300);
      await check(page, '3D 操作提示');
    }

    // ── 4b. 人口密度的 1 km 網格：切換鈕、圖例（哪一期、不上色的格子）、tooltip、3D 時的說明 ──
    for (const extra of ['', '&3d=1']) {
      await page.goto(`${base}?topic=population&ind=density&grid=1&lang=en${extra}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.map-legend .legend');
      await settle(page);
      await check(page, `1 km 網格${extra && ' 3D'}`);
    }
    await page.mouse.move(700, 520);
    await sleep(150);
    await check(page, '1 km 網格 tooltip');

    // ── 5. 分享選單、快捷鍵說明、用中文名稱搜尋 ──
    await page.click('.share-button');
    await sleep(150);
    await check(page, '分享選單');
    await page.keyboard.press('Escape');
    await page.click('.help-button');
    await sleep(150);
    await check(page, '快捷鍵說明');
    await page.keyboard.press('Escape');
    await page.click('.search', { count: 3 });
    await page.type('.search', '日本');
    await sleep(200);
    const first = await page.$eval('.search-results .result-name', (e) => e.textContent).catch(() => null);
    expect(first === 'Japan', `英文介面用中文搜尋「日本」，第一個結果是 ${first}`);
    await check(page, '搜尋「日本」');
  } finally {
    await browser.close();
    await server.close();
  }

  if (problems.size) {
    console.log(`\n英文介面還有 ${problems.size} 段中文：`);
    for (const [text, where] of problems) console.log(`  [${where}] ${text.slice(0, 160)}`);
  }
  if (failures.length) {
    console.log(`\n${failures.length} 項檢查失敗：`);
    for (const f of failures) console.log(`  ${f}`);
  }
  if (problems.size || failures.length) process.exit(1);
  console.log('\n英文介面沒有中文，語言切換正常。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
