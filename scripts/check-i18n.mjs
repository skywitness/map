#!/usr/bin/env node
/**
 * 檢查原始碼裡有沒有「英文介面會看到的中文」：npm run check:i18n
 *
 * 掃描 src/ 的 .ts / .tsx，列出註解以外、不在 `zh:` 值裡的中文字。允許的寫法：
 * - 雙語物件 `{ zh: '總人口', en: 'Total population' }`、defineMessages({ zh: {...}, en: {...} })
 * - src/i18n/zh.ts（中文字典本身）
 * - 同一行有 `i18n-ignore` 註解（例如語言切換鈕上的「中文」）
 * - 檔案開頭的註解寫了 `i18n-ignore-file`（例如搜尋用的中文別名表，不會顯示在介面上）
 * 中文出現在 JSX 文字、一般字串或模板字串裡都會被抓出來。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const SKIP = new Set([join(SRC, 'i18n', 'zh.ts')]);
const CJK = /[　-〿㐀-鿿豈-﫿！-｠]/;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    // 單元測試（*.test.ts、src/test/）不是介面，測試資料裡的中文不算
    if (name === 'test' || /\.test\.tsx?$/.test(name)) return [];
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) && !SKIP.has(p) ? [p] : [];
  });
}

const isIdent = (c) => /[\w$]/.test(c ?? '');

/** 回傳 [{ line, text }]：不在註解、不在 zh 值裡的中文 */
export function scan(source) {
  if (/^\s*\/\*\*?[\s\S]*?i18n-ignore-file[\s\S]*?\*\//.test(source)) return [];
  const found = new Map(); // line → snippet
  let line = 1;
  let i = 0;
  let depth = 0;
  // zh: 值的範圍：記下進入時的括號深度，回到同一層遇到 , ; 或括號關閉就結束
  const zhStack = [];
  // 模板字串的 ${ } 巢狀：記下 ${ 開始時的深度
  const templateStack = [];
  let lastSignificant = '';

  const inZh = () => zhStack.length > 0;
  const report = (pos) => {
    if (inZh()) return;
    const start = source.lastIndexOf('\n', pos) + 1;
    const end = source.indexOf('\n', pos);
    const text = source.slice(start, end < 0 ? undefined : end);
    if (/i18n-ignore/.test(text)) return;
    if (!found.has(line)) found.set(line, text.trim());
  };

  const readString = (quote) => {
    // i 指在開頭的引號上
    i++;
    while (i < source.length && source[i] !== quote) {
      if (source[i] === '\\') i++;
      else if (source[i] === '\n') line++;
      else if (CJK.test(source[i])) report(i);
      i++;
    }
    i++;
  };

  // 讀模板字串的文字部分，遇到 ${ 就回到程式碼狀態
  const readTemplateText = () => {
    while (i < source.length) {
      const c = source[i];
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '`') {
        i++;
        return;
      }
      if (c === '$' && source[i + 1] === '{') {
        i += 2;
        templateStack.push(depth);
        depth++;
        return;
      }
      if (c === '\n') line++;
      else if (CJK.test(c)) report(i);
      i++;
    }
  };

  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '\n') {
      line++;
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      for (let k = i; k < stop; k++) if (source[k] === '\n') line++;
      i = stop;
      continue;
    }
    if (c === "'" || c === '"') {
      readString(c);
      lastSignificant = 'str';
      continue;
    }
    if (c === '`') {
      i++;
      readTemplateText();
      lastSignificant = 'str';
      continue;
    }
    // 正規表示式：前一個有意義的字元是運算子或開括號
    if (c === '/' && /^[(,=:[!&|?{};]?$/.test(lastSignificant) && lastSignificant !== 'str') {
      i++;
      let inClass = false;
      while (i < source.length && source[i] !== '\n') {
        if (source[i] === '\\') i++;
        else if (source[i] === '[') inClass = true;
        else if (source[i] === ']') inClass = false;
        else if (source[i] === '/' && !inClass) break;
        i++;
      }
      i++;
      lastSignificant = 'str';
      continue;
    }
    if (c === '(' || c === '[' || c === '{') {
      depth++;
    } else if (c === ')' || c === ']' || c === '}') {
      depth--;
      while (zhStack.length && depth < zhStack[zhStack.length - 1]) zhStack.pop();
      if (c === '}' && templateStack.length && depth === templateStack[templateStack.length - 1]) {
        templateStack.pop();
        i++;
        readTemplateText();
        lastSignificant = 'str';
        continue;
      }
    } else if ((c === ',' || c === ';') && zhStack.length && depth === zhStack[zhStack.length - 1]) {
      zhStack.pop();
    } else if (c === 'z' && next === 'h' && !isIdent(source[i - 1]) && source[i - 1] !== '.' && !isIdent(source[i + 2])) {
      // zh: 或 zh = 開始一段中文
      let k = i + 2;
      while (source[k] === ' ' || source[k] === '\t') k++;
      if ((source[k] === ':' && source[k + 1] !== ':') || (source[k] === '=' && !/[=>]/.test(source[k + 1]))) {
        zhStack.push(depth);
        i = k + 1;
        lastSignificant = source[k];
        continue;
      }
    } else if (CJK.test(c)) {
      report(i); // JSX 文字或識別字裡的中文
    }
    if (!/\s/.test(c)) lastSignificant = isIdent(c) ? 'ident' : c;
    i++;
  }
  return [...found].map(([line, text]) => ({ line, text }));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  let total = 0;
  for (const file of files(SRC)) {
    for (const { line, text } of scan(readFileSync(file, 'utf8'))) {
      console.log(`${relative(ROOT, file).replace(/\\/g, '/')}:${line}  ${text.slice(0, 140)}`);
      total++;
    }
  }
  if (total) {
    console.log(`\n${total} 行有英文介面會看到的中文。改成 { zh, en } 雙語物件或字典（src/i18n），專有名詞在該行加 i18n-ignore 註解。`);
    process.exit(1);
  }
  console.log('沒有找到未翻譯的中文。');
}
