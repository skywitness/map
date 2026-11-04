"""疫苗與防疫：65 歲以上長者的流感疫苗接種率（2026-11-04，製作手冊第二十批 325）。

OECD Health Statistics `DSD_HEALTH_PROC@DF_IMMUN`（流感 IFLU、`PT_POP_Y_GE65`，60 國含幾個非會員，1980 年起）。
授權：使用者 2026-11-04 決定沿用 2026-10-17 已查證的 OECD 資料條款（DESIGN.md 第 8 節第 12 點）。WHO 的 FLU_ELDERLY 只在
GHO（使用者決定不用）。同一國 OECD 與 WHO 對不上（分母定義不同），只用 OECD。台灣不在 OECD 的資料裡；疾管署的公費流感
疫苗接種統計已請本機 session 找。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import oecd

OUT = OUT_DIR / "topics" / "vaccination"
FLOW = "OECD.ELS.HD,DSD_HEALTH_PROC@DF_IMMUN,"
FIRST = 2000
WITHIN = 3


def build() -> None:
    s, _ = oecd.series(FLOW, DISEASE="IFLU", UNIT_MEASURE="PT_POP_Y_GE65")
    s = {c: {y: v for y, v in v_.items() if y >= FIRST} for c, v_ in s.items()}
    s = {c: v for c, v in s.items() if v}
    last = max(y for v in s.values() for y in v)
    years = list(range(FIRST, last + 1))
    write_json(OUT / "flu-elderly.json", indicator_file(
        "flu-elderly", "%", years, {c: to_series(v, years, 1) for c, v in sorted(s.items())},
        latestWithin=WITHIN,
        noValue={"TWN": "台灣不在 OECD 的資料裡（疾管署的公費流感疫苗接種統計還在找）"},
        noValueEn={"TWN": "Taiwan is not in OECD data"}))
    y = 2024
    at = sorted(((v[y], c) for c, v in s.items() if y in v), reverse=True)
    med = sorted(v for v, _ in at)[len(at) // 2]
    print(f"  65 歲以上流感疫苗：{len(s)} 國，{years[0]}–{years[-1]}；{y} 年 {len(at)} 國，中位數 {med}；最高 {at[:6]}；最低 {at[-6:]}")
