"""水上樂園（新主題，2026-11-08，製作手冊第二十七批 636，候選 1378；步驟 water-parks，輸出 topics/water-parks/）。

手冊：已排定的 1061（順序 432，景點地圖的擴充）只用了五張水上樂園排名表的前兩張；實際上 attractions_visitors.py 的
`water_parks()` 早就讀了「List of amusement park rankings」Water parks 一節的五張表（世界、北美、拉美、亞太、歐非中東），
人次與每十萬人的 OSM 水上樂園照舊由步驟 attractions-visitors 產生在 topics/attractions/，新主題直接讀那兩個檔。
這一步只補 OSM `leisure=water_park` 各國的處數（QLever，快取同一支查詢），ODbL 1.0。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import osm_qlever

OUT = OUT_DIR / "topics" / "water-parks"
YEAR = 2026


def build() -> None:
    n = osm_qlever.counts("leisure", "water_park")
    write_json(OUT / "count.json", indicator_file("count", "處", [YEAR], {c: [v] for c, v in sorted(n.items())}, license="ODbL 1.0"))
    top = sorted(n.items(), key=lambda kv: -kv[1])
    print(f"  OSM leisure=water_park：{sum(n.values()):,} 處、{len(n)} 國；" + "、".join(f"{c} {v}" for c, v in top[:10])
          + f"；台灣 {n.get('TWN')}")
