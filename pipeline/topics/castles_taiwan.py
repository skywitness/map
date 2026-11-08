"""城堡與要塞的擴充：台灣的法定有形文化資產、各國的法定文化資產筆數（2026-11-08，製作手冊第二十七批 643，候選 1408、1409；
步驟 castles-taiwan，輸出 topics/castles/）。

- **台灣**：文化部文化資產局開放資料 `data.boch.gov.tw/opendata/v2/assetsCase/<類別>.json`（政府資料開放授權條款第 1 版，
  data.gov.tw 授權代碼 1；robots.txt 是 404，2026-11-08 讀過）：古蹟 1.1（國定、直轄市定、縣(市)定）、歷史建築 1.2、
  聚落建築群 1.3、紀念建築 1.4、考古遺址 2.1、文化景觀 3.1。年份取公告清單最早的 registerDate（有民國年寫法的照換）；
  縣市取地址第一筆。照片不放（原圖在文資局的主機上，不轉載）；所有人欄位不輸出。
- **各國的法定文化資產（候選 1409）**：Wikidata（CC0）有 P1435（heritage designation）、座標與國家的項目，依國家數。
  手冊：數字純粹是各國匯入 Wikidata 的量（英國、德國把每一棟登錄建築都匯進去），**不能跨國比較、不上色**，
  只在國家側欄當「這國在 Wikidata 的清冊有幾筆」。
"""
from __future__ import annotations

import re
from collections import Counter

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_points
from sources import qlever_wikidata

OUT = OUT_DIR / "topics" / "castles"
URL = "https://data.boch.gov.tw/opendata/v2/assetsCase/{}.json"
CLASSES = {"1.1": "古蹟", "1.2": "歷史建築", "1.3": "聚落建築群", "1.4": "紀念建築", "2.1": "考古遺址", "3.1": "文化景觀"}
# 點的類別代碼（前端 TW_HERITAGE 的順序）
LEVEL = {"國定古蹟": 1, "直轄市定古蹟": 2, "縣(市)定古蹟": 3}
CODE = {"1.2": 4, "1.3": 5, "1.4": 5, "2.1": 6, "3.1": 7}
YEAR = 2026


def _year(s: str | None) -> int | None:
    m = re.match(r"(\d{3,4})", (s or "").strip())
    if not m:
        return None
    y = int(m.group(1))
    if y < 1000:  # 民國年（例如 0113）
        y += 1911
    return y if 1900 <= y <= YEAR else None


def _taiwan() -> None:
    rows, nocoord = [], Counter()
    for code, cname in CLASSES.items():
        data = download(URL.format(code), "boch", f"assetsCase-{code}.json")
        import json
        for r in json.loads(data.read_text(encoding="utf-8")):
            try:
                lon, lat = float(r.get("longitude") or ""), float(r.get("latitude") or "")
            except ValueError:
                nocoord[cname] += 1
                continue
            if not (118 <= lon <= 123 and 21 <= lat <= 27):
                nocoord[cname] += 1
                continue
            level = (r.get("assetsClassifyName") or "").strip()
            k = LEVEL.get(level, 3) if code == "1.1" else CODE[code]
            years = [y for a in (r.get("announcementList") or []) if (y := _year(a.get("registerDate")))]
            addr = (r.get("addresses") or [{}])[0] or {}
            types = [t.get("name") for t in (r.get("assetsTypes") or []) if isinstance(t, dict) and t.get("name")]
            rows.append({"lon": round(lon, 5), "lat": round(lat, 5), "k": k, "y": min(years) if years else None,
                         "name": (r.get("caseName") or "").strip(), "type": types[0] if types else None,
                         "county": (addr.get("cityName") or "").strip().replace("台", "臺") or None,
                         "url": (r.get("caseUrl") or "").replace("http://", "https://") or None})
    rows.sort(key=lambda r: (r["k"], r["lon"]))
    write_points(OUT / "taiwan-heritage.json", points_file(rows, ["lon", "lat", "k", "y", "name", "type", "county", "url"],
                                                           {"lon": 0.00001, "lat": 0.00001, "k": 1, "y": 1}, strings=("type", "county")),
                 ("name", "url"))
    # 時間軸用的空指標檔（公告年份，國家不上色）
    first = min(r["y"] for r in rows if r["y"])
    write_json(OUT / "heritage-years.json", indicator_file("heritage-years", "處", list(range(first, YEAR + 1)), {}, license="政府資料開放授權條款第 1 版"))
    by = Counter(r["k"] for r in rows)
    print(f"  台灣的有形文化資產：畫出 {len(rows):,} 處 {dict(sorted(by.items()))}；沒有座標 {dict(nocoord)}")
    print(f"    縣市：{Counter(r['county'] for r in rows).most_common(6)}；類別：{Counter(r['type'] for r in rows).most_common(8)}")
    dec = Counter((r["y"] // 10 * 10) for r in rows if r["y"])
    print("    公告年代：" + "、".join(f"{d}s {n}" for d, n in sorted(dec.items())))


def _wikidata() -> None:
    rows = qlever_wikidata.cached("heritage-by-country", """
SELECT ?iso (COUNT(DISTINCT ?x) AS ?n) WHERE {
  ?x wdt:P1435 ?h ; wdt:P625 ?c ; wdt:P17 ?country . ?country wdt:P298 ?iso .
} GROUP BY ?iso""")
    n = {r["iso"]["value"]: int(r["n"]["value"]) for r in rows}
    write_json(OUT / "heritage-wikidata.json", indicator_file("heritage-wikidata", "處", [YEAR], {c: [v] for c, v in sorted(n.items())},
                                                              license="CC0"))
    top = sorted(n.items(), key=lambda kv: -kv[1])
    print(f"  Wikidata P1435：{sum(n.values()):,} 筆、{len(n)} 國；" + "、".join(f"{c} {v:,}" for c, v in top[:10]) + f"；台灣 {n.get('TWN')}")


def build() -> None:
    _taiwan()
    _wikidata()
