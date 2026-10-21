// `npm run data` 的入口：依作業系統找到 venv 裡的 Python 再執行 run.py
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const python =
  process.platform === 'win32' ? 'pipeline/.venv/Scripts/python.exe' : 'pipeline/.venv/bin/python';

if (!existsSync(python)) {
  console.error('找不到 pipeline/.venv，請先依 README 建立 Python 環境。');
  process.exit(1);
}

const result = spawnSync(python, ['pipeline/run.py', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
