"""政府治理主題：行政權受到的制衡（2026-11-05，製作手冊第二十二批 377；V-Dem v16，CC BY-SA 4.0）。

- 司法對行政的制衡（v2x_jucon）：行政部門是否尊重憲法、服從法院判決，司法能否獨立行事。
- 立法對行政的制衡（v2xlg_legcon）：國會與審計、檢察、監察等機關能否質詢、調查、監督行政部門。
- 地方分權（v2x_feduni，V-Dem 的 Division of power index）：有沒有民選的地方與區域政府、能不能不受非民選機關干預。
  這一項 V-Dem 沒有可信區間；高分不等於聯邦制（日本 0.99 是因為地方首長與議會都民選而且有實權）。
- 0–1，越高制衡越強；1900 年起（跟民主與自由主題一樣），國家的接續方式也一樣（topics/democracy.py 的 country_series）。
  側欄跟 WGI 一樣畫世界中位數（aggregates.MEDIAN）與可信區間（68%，WGI 是 90%）。
- 跟 WGI 是不同的量法：WGI 是看法的綜合，1996 年起；這三項是 V-Dem 的專家評分，回到 1789 年。
"""
from __future__ import annotations

from common import OUT_DIR
from sources import vdem
from topics.democracy import FIRST_YEAR, index_files

OUT = OUT_DIR / "topics" / "governance"
# 指標 id → (V-Dem 變數, 有沒有可信區間)
INDICES = {
    "judicial-constraints": ("v2x_jucon", True),
    "legislative-constraints": ("v2xlg_legcon", True),
    "division-of-power": ("v2x_feduni", False),
}


def build() -> None:
    rows = vdem.rows()
    last = max(int(r["year"]) for r in rows)
    years = list(range(FIRST_YEAR, last + 1))
    for key, (variable, intervals) in INDICES.items():
        values = index_files(OUT, key, variable, rows, years, intervals=intervals, aggregate="MEDIAN")
        latest = {c: s[-1] for c, s in values.items() if s[-1] is not None}
        top = sorted(latest.items(), key=lambda kv: -kv[1])
        print(f"  {key}（{variable}）：{len(values)} 國，{last} 年 {len(latest)} 國；台灣 {latest.get('TWN')}；"
              f"最高 {top[:4]}；最低 {top[-4:]}")
