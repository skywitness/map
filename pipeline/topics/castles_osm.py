"""城堡與要塞的擴充：OSM 的城堡、莊園、要塞，廢墟、紀念碑，考古遺址（2026-11-08，製作手冊第二十七批 644，候選 1410、1411、1412；
步驟 castles-osm，輸出 topics/castles/）。

OpenStreetMap 經 QLever（ODbL 1.0），一個標籤一支查詢、不併發：
- `historic=castle`、`manor`、`fort` 合成「城堡、莊園與要塞」：各國處數（比例圓）與每萬平方公里（面量圖）。
  現有的點是 Castle Map 從 Wikidata 挑過的 9,040 座「有名的」，OSM 是「全部」（含遺跡、水城、城跡），兩者不相加。
- `historic=ruins`、`historic=monument`：每萬平方公里。`historic=memorial`（多半是戰爭紀念碑與名牌，候選 659 使用者決定不做）不收。
  廢墟在歐洲含大量農舍遺跡、賴索托是單一專案匯入，所以只替覆蓋良好的國家上色。
- `historic=archaeological_site`：**國家不上色**（阿爾及利亞、查德的岩畫點，丹麥、愛爾蘭的國家遺址資料庫都是單一匯入，
  數量不代表「那裡的考古遺址最多」），只畫網格，處數寫在國家的提示。
- 點太多（8.4 萬到 23 萬），都在 QLever 端依代表點（geof:centroid）分成 0.1° 的網格計數（同第 438 點的獵人高台）。
- 陸地面積：FAOSTAT（同獵人高台）；密度只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py）。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR
from sources import osm_qlever
from topics.osm_density import area_density, grid, write_grid

OUT = OUT_DIR / "topics" / "castles"
FORTS = ("castle", "manor", "fort")


def build() -> None:
    # 城堡、莊園、要塞：三支計數合起來（一個物件只有一個 historic 值，不會重複）
    total: Counter = Counter()
    for v in FORTS:
        n = osm_qlever.counts("historic", v)
        print(f"  historic={v}：{sum(n.values()):,} 處、{len(n)} 國；台灣 {n.get('TWN')}；"
              + "、".join(f"{c} {k:,}" for c, k in Counter(n).most_common(8)))
        total.update(n)
    area_density(OUT, "forts-osm", dict(total), "處/萬平方公里", 10_000)
    write_grid(OUT, "forts-grid", grid("historic", FORTS, "城堡、莊園與要塞"))

    for v, name, zh, en in (("ruins", "ruins-osm", "廢墟", "ruins"), ("monument", "monuments-osm", "紀念碑", "monuments")):
        n = osm_qlever.counts("historic", v)
        area_density(OUT, name, n, "處/萬平方公里", 10_000, count=False, hints=(zh, en))
        write_grid(OUT, name.replace("-osm", "-grid"), grid("historic", (v,), zh))

    n = osm_qlever.counts("historic", "archaeological_site")
    area_density(OUT, "archaeology-osm", n, "處/萬平方公里", 10_000, per_file=False, color=False, hints=("考古遺址", "archaeological sites"))
    write_grid(OUT, "archaeology-grid", grid("historic", ("archaeological_site",), "考古遺址"))
