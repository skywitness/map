"""運河與海峽每月通過幾艘船（2026-11-05，製作手冊第二十三批 402〔候選 995〕；步驟 chokepoints-monthly，輸出 topics/shipping/）。

- IMF PortWatch 的 Daily_Chokepoints_Data（sources/portwatch.py，「航運與港口」的咽喉圖層已經在用、每頁快取），把每天的
  通過數加總成每個月：全部與貨櫃、乾散貨、雜貨、滾裝、油輪五類。資料到最後一天的那個月不完整，標 partial。
- 巴拿馬與蘇伊士運河管理局自己的統計不能用（條款只准引用事實），所以只用 PortWatch。PortWatch 是 AIS 推算的貨船與油輪
  通過數，跟運河管理局的會計年度、船種不同，數字對不上（2023 年巴拿馬 PortWatch 11,028 艘、管理局 FY2023 12,638 艘）。
- 載重噸（capacity）現有的快取沒有存，要整份重新下載（約 80 頁、伺服器不穩），這裡只做艘數。
"""
from __future__ import annotations

import calendar
from collections import defaultdict

from common import OUT_DIR, write_json
from sources import portwatch
from topics.waterways import CHOKEPOINT_ZH

OUT = OUT_DIR / "topics" / "shipping"


def build() -> None:
    points = portwatch.chokepoints()
    sums: dict[str, dict[str, dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    days: dict[str, set[str]] = defaultdict(set)
    last = ""
    for r in portwatch.daily():
        month = r["date"][:7]
        days[month].add(r["date"][:10])
        last = max(last, r["date"][:10])
        s = sums[r["portid"]][month]
        s["total"] += r["n_total"] or 0
        for t in portwatch.TYPES:
            s[t] += r[f"n_{t}"] or 0
    months = sorted(days)
    partial = [m for m in months if len(days[m]) < calendar.monthrange(int(m[:4]), int(m[5:]))[1]]
    out = {}
    for p in points:
        s = sums.get(p["id"], {})
        out[p["id"]] = {
            "zh": CHOKEPOINT_ZH[p["id"]], "en": p["name"], "lon": round(p["lon"], 3), "lat": round(p["lat"], 3),
            **{k: [s.get(m, {}).get(k, 0) for m in months] for k in ("total", *portwatch.TYPES)},
        }
    write_json(OUT / "chokepoints-monthly.json", {"months": months, "partial": partial, "last": last, "points": out})

    def year(pid: str, y: str) -> int:
        return sum(v for m, v in zip(months, out[pid]["total"]) if m.startswith(y))
    print(f"  {len(out)} 個咽喉，{months[0]}–{months[-1]}（資料到 {last}，不完整的月份 {partial}）")
    for pid in ("chokepoint1", "chokepoint2", "chokepoint11"):
        print(f"  {out[pid]['zh']}：" + "、".join(f"{y} {year(pid, y):,}" for y in ("2019", "2022", "2023", "2024", "2025")))
    pan = out["chokepoint2"]["total"]
    print("  巴拿馬每月：" + "、".join(f"{m} {v}" for m, v in zip(months, pan) if m[:4] in ("2023", "2024")))
