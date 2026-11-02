"""日食的貝塞爾根數（2026-11-02，新14：選一次日食時播放本影沿著路徑移動）：瀏覽器用這些根數算任一刻本影在地面上的位置與形狀
（src/lib/eclipseShadow.ts，跟 eclipses.py 的 Frame、on_earth、geodetic 同一套算法），不必另外存每分鐘的影子。

- 跟 eclipses.py 同一份清單與同一組根數（elements_for：NASA 路徑表那一組有的用它，沒有的用五千年日食典的），組別 e 一樣
  （paths.json、eclipse-list.json 的 e），所以要先跑 eclipses（或至少有它的快取）。
- elements.json：每一次一列 [e, 食甚的日期 YYYYMMDD, t0（TDT 的小時）, ΔT（秒）, x0–x3, y0–y3, d0–d2, l2_0–l2_2, μ0–μ2, tan f2]。
  多項式的單位是 NASA 的：x、y、l2 是地球赤道半徑，d、μ 是度，t 是 TDT − t0（小時）。約 300 列、60 KB（gzip 後約 25 KB）。
"""
from __future__ import annotations

from common import OUT_DIR, write_json
from sources import nasa_eclipses as ne
from topics.eclipses import FIRST, LAST, elements_for

OUT = OUT_DIR / "topics" / "eclipses"

FIELDS = ["e", "ymd", "t0", "dt", "x", "y", "d", "l2", "mu", "tf2"]


def _r(v: float, digits: int) -> float:
    return float(f"{v:.{digits}g}") if v else 0.0


def build() -> None:
    catalog = [r for r in ne.catalog() if FIRST <= r.year <= LAST and r.kind in "ATH"]
    rows = []
    for e, row in enumerate(catalog):
        el, _src = elements_for(row)
        rows.append([
            e, row.ymd, el.t0, el.delta_t,
            [_r(v, 9) for v in el.x[:4]],
            [_r(v, 9) for v in el.y[:4]],
            [_r(v, 9) for v in el.d[:3]],
            [_r(v, 9) for v in el.l2[:3]],
            [_r(v, 10) for v in el.mu[:3]],
            _r(el.tan_f2, 9),
        ])
    write_json(OUT / "elements.json", {"fields": FIELDS, "rows": rows})
    print(f"  {len(rows)} 次日食的貝塞爾根數")
