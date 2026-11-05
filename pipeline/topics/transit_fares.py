"""大眾運輸的月票與計程車車資（2026-11-05，製作手冊第二十三批 409〔候選 1018〕；步驟 transit-fares）。

- Eurostat Urban Audit `urb_ctran`（CC BY 4.0，sources/urban_audit.py）：TT1080V「市中心 5–10 公里、所有大眾運輸的月票」
  （歐元）放「地鐵與城市軌道」（輸出 topics/transport/fares.json），TT1081V「白天搭計程車到市中心 5 公里」（歐元）照手冊的建議
  放「叫車服務」（輸出 topics/ride-hailing/taxi-fares.json）。每個城市取最近一年；月票**只用 2019 年以後**（手冊：舊年份的
  幣別、單位有錯，例如羅馬尼亞的城市 155 歐元），計程車只用 2018 年以後（有 2008 年的舊值）。
- 城市位置沿用 urban_audit.locate()（快取沒有的國家經 QLever 查 Wikidata）。英國、科索沃照網站的 Eurostat 規則不收。
- 手冊建議的「全國通用的單一月票或免費大眾運輸」類別圖（約 40 國，要逐國查官網）沒有做；台灣的 TPASS 等月票也不是結構化資料。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json
from sources import urban_audit

YEAR = 2026
EXCLUDED = ("UK", "XK")
FARE_FROM = 2019
TAXI_FROM = 2018  # 計程車車資有 2008、2011 年的舊值（威尼斯 2008 年 41.8 歐元），物價差太多，只用 2018 年以後


def _points(code: str, min_year: int | None = None) -> list[dict]:
    labels, data = urban_audit.series("urb_ctran", code)
    labels = {c: l for c, l in labels.items() if not c.startswith(EXCLUDED) and c in data}
    loc = urban_audit.locate(labels)
    rows = []
    for c in sorted(labels):
        years = [y for y in data[c] if min_year is None or y >= min_year]
        if not years or not loc.get(c):
            continue
        y = max(years)
        lon, lat, _ = loc[c]
        rows.append({"lon": lon, "lat": lat, "n": labels[c].replace(" (greater city)", ""), "g": 1 if "(greater city)" in labels[c] else 0,
                     "iso3": urban_audit.iso3(c) or "", "v": round(data[c][y], 2), "y": y})
    return rows


def _write(rows: list[dict], folder: str, file: str, indicator: str) -> None:
    out = OUT_DIR / "topics" / folder
    write_json(out / f"{file}.json", points_file(rows, ["lon", "lat", "n", "g", "iso3", "v", "y"],
                                                 {"lon": 0.0001, "lat": 0.0001, "g": 1, "v": 0.01, "y": 1}, strings=("iso3",)))
    n = Counter(r["iso3"] for r in rows if r["iso3"])
    write_json(out / f"{indicator}.json", indicator_file(indicator, "個", [YEAR], {c: [v] for c, v in sorted(n.items())}, license="CC BY 4.0"))
    top = sorted(((r["v"], r["n"], r["y"]) for r in rows), reverse=True)
    print(f"  {file}：{len(rows)} 城（{Counter(r['y'] for r in rows).most_common(4)}）；最高 {top[:8]}；最低 {top[-6:]}")


def build() -> None:
    _write(_points("TT1080V", FARE_FROM), "transport", "fares", "monthly-pass")
    _write(_points("TT1081V", TAXI_FROM), "ride-hailing", "taxi-fares", "taxi-fare")
