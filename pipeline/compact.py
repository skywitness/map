"""把 public/data 裡現有的指標檔改成差分編碼（common.compact_indicator），不必重跑各主題、不必重新下載。

各主題的 build() 透過 common.indicator_file() 輸出時就已經壓縮；這一步給還沒壓縮的舊檔案用
（例如別的分支產生的資料），已經壓縮過的檔案會跳過，重複執行沒有影響。
"""
from __future__ import annotations

import gzip
import json

from common import OUT_DIR, compact_indicator, write_json

INDICATOR_KEYS = {"indicator", "years", "values"}


def build() -> None:
    count = 0
    before = after = before_gz = after_gz = 0
    for path in sorted((OUT_DIR / "topics").rglob("*.json")):
        raw = path.read_bytes()
        data = json.loads(raw)
        if not isinstance(data, dict) or not INDICATOR_KEYS <= data.keys() or data.get("encoding") == "delta":
            continue
        write_json(path, compact_indicator(data), quiet=True)
        new = path.read_bytes()
        count += 1
        before += len(raw)
        after += len(new)
        before_gz += len(gzip.compress(raw))
        after_gz += len(gzip.compress(new))
    if count:
        print(f"  壓縮 {count} 個指標檔：{before / 1e6:.2f} MB → {after / 1e6:.2f} MB"
              f"（gzip 後 {before_gz / 1e6:.2f} MB → {after_gz / 1e6:.2f} MB）")
    else:
        print("  沒有需要壓縮的指標檔")
