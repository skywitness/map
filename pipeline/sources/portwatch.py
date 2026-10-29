"""IMF PortWatch（https://portwatch.imf.org/）：28 個航運咽喉（運河、海峽）的位置與每天的通過船數。

- 授權：資料集的 license 欄指到 IMF 條款 https://www.imf.org/external/terms.htm （DESIGN.md 第 8 節第 12 點已記：
  註明來源即可轉載、改作，商業再利用要另外申請）。
- 咽喉的位置：ArcGIS FeatureServer「PortWatch_chokepoints_database」（28 點）。
- 每天的通過數：「Daily_Chokepoints_Data」（一個咽喉一天一列，2019 年起，約 8 萬列）。這個表不支援統計查詢
  （outStatistics 回 400），所以分頁讀全部（每頁 1,000 列，只取需要的欄位；分頁一定要 orderByFields，
  寫「ObjectId ASC」也回 400，只能寫「ObjectId」），每頁各自快取。
- 伺服器不穩：同一個查詢有時回 400（「Invalid URL」「Invalid query parameters」），重試幾次就好，所以每頁重試到 15 次，
  中途失敗重跑時只補還沒下載的頁。
  通過（transit call）是船進入咽喉的範圍算一次，跨好幾天的只算一次、同一艘船 48 小時內不重複算；
  只算五類貨船（貨櫃、乾散貨、雜貨、滾裝、油輪），用 AIS 推算，沒有依船的大小加權。
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict

from common import CACHE_DIR, USER_AGENT

BASE = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/"
CHOKEPOINTS_URL = BASE + "PortWatch_chokepoints_database/FeatureServer/0/query"
DAILY_URL = BASE + "Daily_Chokepoints_Data/FeatureServer/0/query"
PAGE = 1000
ATTEMPTS = 15
TYPES = ("container", "dry_bulk", "general_cargo", "roro", "tanker")


def _query(url: str, params: dict) -> dict:
    req = urllib.request.Request(url + "?" + urllib.parse.urlencode({**params, "f": "json"}),
                                 headers={"User-Agent": USER_AGENT})
    for attempt in range(ATTEMPTS):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.load(r)
            if "error" not in data:
                return data
            err = data["error"]
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            err = e
        wait = min(5 * (attempt + 1), 30)
        print(f"    PortWatch：{err}，等 {wait} 秒", flush=True)
        time.sleep(wait)
    raise RuntimeError(f"PortWatch 查詢一直失敗：{url}")


def chokepoints() -> list[dict]:
    """[{"id", "name", "lon", "lat"}]，依 PortWatch 的編號（chokepoint1–28）。"""
    path = CACHE_DIR / "portwatch" / "chokepoints.json"
    if not path.exists():
        data = _query(CHOKEPOINTS_URL, {"where": "1=1", "outFields": "portid,portname,lat,lon", "returnGeometry": "false"})
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data), encoding="utf-8")
    rows = [f["attributes"] for f in json.loads(path.read_text(encoding="utf-8"))["features"]]
    return sorted(({"id": r["portid"], "name": r["portname"], "lon": r["lon"], "lat": r["lat"]} for r in rows),
                  key=lambda r: int(r["id"].removeprefix("chokepoint")))


def daily() -> list[dict]:
    """每天每個咽喉一列：{"portid", "date", "n_total", "n_container", …}。"""
    folder = CACHE_DIR / "portwatch" / "daily"
    count_path = folder / "count.json"
    folder.mkdir(parents=True, exist_ok=True)
    if not count_path.exists():
        count_path.write_text(json.dumps(_query(DAILY_URL, {"where": "1=1", "returnCountOnly": "true"})), encoding="utf-8")
    total = json.loads(count_path.read_text(encoding="utf-8"))["count"]
    fields = ",".join(["portid", "date", "n_total"] + [f"n_{t}" for t in TYPES])
    rows: list[dict] = []
    for offset in range(0, total, PAGE):
        page = folder / f"{offset:06d}.json"
        if not page.exists():
            data = _query(DAILY_URL, {"where": "1=1", "outFields": fields, "orderByFields": "ObjectId",
                                      "resultOffset": offset, "resultRecordCount": PAGE})
            page.write_text(json.dumps([f["attributes"] for f in data["features"]]), encoding="utf-8")
            if offset // PAGE % 10 == 0:
                print(f"    PortWatch 每天的通過數 {offset + PAGE:,} / {total:,}", flush=True)
        rows.extend(json.loads(page.read_text(encoding="utf-8")))
    if len(rows) != total:
        raise RuntimeError(f"PortWatch 每天的通過數只讀到 {len(rows)} 列（應有 {total}）")
    return rows


def annual() -> tuple[dict[str, dict[int, dict[str, int]]], str]:
    """{咽喉: {年: {"total", "container", …}}}，只收整年都有資料的年份；也回傳最後一天的日期。"""
    sums: dict[str, dict[int, dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    days: dict[int, set[str]] = defaultdict(set)
    last = ""
    for r in daily():
        year = int(r["date"][:4])
        days[year].add(r["date"])
        last = max(last, r["date"])
        s = sums[r["portid"]][year]
        s["total"] += r["n_total"] or 0
        for t in TYPES:
            s[t] += r[f"n_{t}"] or 0
    full = {y for y, d in days.items() if len(d) >= 365}
    out = {p: {y: dict(v) for y, v in by_year.items() if y in full} for p, by_year in sums.items()}
    return out, last
