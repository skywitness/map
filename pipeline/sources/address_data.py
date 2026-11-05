"""Google libaddressinput 的地址資料（Address Data Service，https://chromium-i18n.appspot.com/ssl-address/data；
README：「Source code licensed under the Apache 2.0. Data licensed under the CC-BY 4.0」）。

每個國家或地區一個 JSON（fmt 地址格式、zip 郵遞區號的正規表示式、zipex 範例…）。第一次會一個一個下載（約 250 個、
每個間隔 0.5 秒，快取在 .cache/address-data/），之後讀快取。chromium-i18n.appspot.com 沒有 robots.txt（2026-11-05 回 404）。
"""
from __future__ import annotations

import json
import time

from common import CACHE_DIR, download

BASE = "https://chromium-i18n.appspot.com/ssl-address/data"


def countries() -> dict[str, dict]:
    """alpha-2 → 那一國的資料（沒有自己資料的國家，JSON 只有 id 與 key，用 ZZ 的預設值）"""
    index = json.loads(download(BASE, "address-data", "index.json").read_text(encoding="utf-8"))
    out = {}
    for code in ["ZZ", *index["countries"].split("~")]:
        cached = (CACHE_DIR / "address-data" / f"{code}.json").exists()
        out[code] = json.loads(download(f"{BASE}/{code}", "address-data", f"{code}.json").read_text(encoding="utf-8"))
        if not cached:
            time.sleep(0.5)
    return out
