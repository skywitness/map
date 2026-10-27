// 國旗主題（pipeline/topics/flags.py）用的 SVG 最佳化：node pipeline/svgo.mjs <輸入資料夾> <輸出資料夾> <小數位數>
// 用 svgo（MIT，devDependency）的預設外掛，多跑幾輪；小數位數由 flags.py 決定，畫出來跟原檔比對過才採用
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { optimize } from 'svgo';

const [, , input, output, precision] = process.argv;
mkdirSync(output, { recursive: true });
for (const name of readdirSync(input)) {
  if (!name.endsWith('.svg')) continue;
  const svg = readFileSync(`${input}/${name}`, 'utf8');
  const { data } = optimize(svg, { multipass: true, floatPrecision: Number(precision), plugins: ['preset-default'] });
  writeFileSync(`${output}/${name}`, data);
}
