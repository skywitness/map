"""StatCounter Global Stats（https://gs.statcounter.com/）的 CSV 匯出：不必登入，`chart.php?…&csv=1`。

- 授權：CC BY-SA 3.0 Unported（FAQ：「At Statcounter Global Stats we license our work under a Creative Commons
  Attribution-Share Alike 3.0 Unported License」，要附連結註明出處）。
- 一國（region_hidden=ISO alpha-2）一種統計一支查詢，2009 年 1 月到指定的月份，每月一列；欄位是那段期間前幾名的品牌加 Other。
  region 參數（國名）不影響結果，填代碼。robots.txt 是 404（2026-11-07），每支查詢之間等 2 秒。
- 資料是裝了 StatCounter 追蹤碼的網站的瀏覽次數，樣本偏向這些網站；沒有國家權重。
"""
from __future__ import annotations

import csv
import time
import urllib.parse

from common import CACHE_DIR, download

STATS = {
    "search": ("search_engine", "Search Engine"),
    "browser": ("browser", "Browser"),
    "os": ("os_combined", "Operating System"),
}
BASE = "https://gs.statcounter.com/chart.php"
DELAY = 2.0


def url(stat: str, iso2: str, until: str) -> str:
    hidden, name = STATS[stat]
    y, m = until.split("-")
    params = {
        "device_hidden": "desktop+mobile+tablet+console", "multi-device": "true", "statType_hidden": hidden,
        "region_hidden": iso2, "granularity": "monthly", "statType": name, "region": iso2,
        "fromInt": "200901", "toInt": f"{y}{m}", "fromMonthYear": "2009-01", "toMonthYear": until, "csv": "1",
    }
    return f"{BASE}?{urllib.parse.urlencode(params)}"


def monthly(stat: str, iso2: str, until: str) -> dict[str, dict[str, float]]:
    """{品牌: {"YYYY-MM": %}}；沒有資料的 region 回傳空字典。"""
    name = f"{stat}-{iso2}-{until}.csv"
    cached = (CACHE_DIR / "statcounter" / name).exists()
    path = download(url(stat, iso2, until), "statcounter", name)
    if not cached:
        time.sleep(DELAY)
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    out: dict[str, dict[str, float]] = {}
    for r in rows:
        month = r.pop("Date")
        for brand, v in r.items():
            if v not in ("", None):
                out.setdefault(brand, {})[month] = float(v)
    return out
