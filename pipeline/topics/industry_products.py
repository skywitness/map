"""產業結構與工業：台灣是世界第幾、各國稱霸幾項產品（2026-11-07，製作手冊第二十五批 446，合併候選 1083、1084；
步驟 industry-products，輸出 topics/industry/）。

- 資料：Harvard Atlas 的 HS92 四位碼 country-product-year（sources/atlas.py 的 hs92_4digit()，CC0 1.0），1995–2024 年。
  台灣沒有向聯合國申報，Atlas 的台灣數字是貿易夥伴的申報（金額比財政部的統計低，名次大致可信）。
- 世界出口市占（product-share/<商品>.json）：這一國這項商品的出口 ÷ 全世界（Atlas 所有國家的加總）。PRODUCTS 是手冊挑的
  15 個商品，幾個是四位碼的合計（手工具 8201–8207、金屬加工工具機 8457–8463）。**8456 不加進工具機**：HS92 的 8456
  （雷射等加工機）混了半導體曝光機，荷蘭會變成工具機的第 4 名。側欄（product-share-top/<商品>.json）是每年前 10 大出口國。
- 世界第一的品項數（product-leads/<門檻>.json）：1,240 個四位碼品項裡，這一國是世界最大出口國的項數（first），與市占 10%、
  5% 以上的項數（share10、share5）。**XXXX（Atlas 的貿易資料差異殘差，台灣 2024 年有 991 億美元）與 9999（未依種類分的商品）不是商品，不算。**
  側欄：依 HS 的 21 類分組的項數（product-leads-sections/<年>.json），台灣另列 2015 年起每年是世界第一的品項
  （product-leads-taiwan.json；名稱在前端手寫，前端 TW_LEADS 要涵蓋這裡列出的代碼）。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import atlas
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "industry"
FIRST, LAST = 1995, 2024
RESIDUAL = {"XXXX", "9999"}  # 貿易資料差異殘差、未依種類分的商品：不是商品，不算
PRODUCTS: dict[str, tuple[str, ...]] = {
    "wrenches": ("8204",),
    "hand-tools": tuple(f"82{i:02d}" for i in range(1, 8)),
    "fasteners": ("7318",),
    "bicycles": ("8712",),
    "bicycle-parts": ("8714",),
    "machining-centres": ("8457",),
    "lathes": ("8458",),
    "woodworking": ("8465",),
    "machine-tools": tuple(str(c) for c in range(8457, 8464)),
    "pcb": ("8534",),
    "lcd": ("9013",),
    "capacitors": ("8532",),
    "synthetic-fabric": ("5407",),
    "auto-parts": ("8708",),
    "bearings": ("8482",),
}
TOP_N = 10
THRESHOLDS = {"first": None, "share10": 0.10, "share5": 0.05}
TW_LIST_FROM = 2015
# HS 的 21 類（依章）：前端 HS_SECTIONS 同順序
SECTIONS = [(1, 5), (6, 14), (15, 15), (16, 24), (25, 27), (28, 38), (39, 40), (41, 43), (44, 46), (47, 49), (50, 63), (64, 67),
            (68, 70), (71, 71), (72, 83), (84, 85), (86, 89), (90, 92), (93, 93), (94, 96), (97, 97)]


def _section(code: str) -> int:
    chapter = int(code[:2])
    return next(i for i, (lo, hi) in enumerate(SECTIONS) if lo <= chapter <= hi)


def build() -> None:
    data = atlas.hs92_4digit()
    years = [y for y in range(FIRST, LAST + 1) if y in data]
    iso = {}

    def site(code: str) -> str | None:
        if code not in iso:
            iso[code] = to_iso3(code)
        return iso[code]

    # 世界出口市占
    for key, codes in PRODUCTS.items():
        shares: dict[str, dict[int, float]] = defaultdict(dict)
        top: dict[str, list] = {}
        world: dict[str, float] = {}
        for y in years:
            totals: dict[str, float] = defaultdict(float)
            for code in codes:
                for c, v in data[y].get(code, {}).items():
                    totals[c] += v
            w = sum(totals.values())
            if not w:
                continue
            world[str(y)] = round(w)
            ranked = sorted(totals.items(), key=lambda kv: -kv[1])
            for c, v in ranked:
                if (s := site(c)):
                    shares[s][y] = v / w * 100
            top[str(y)] = [[site(c) or c, round(v / w * 100, 2), round(v)] for c, v in ranked[:TOP_N]]
        values = {c: to_series(s, years, 2) for c, s in sorted(shares.items())}
        write_json(OUT / "product-share" / f"{key}.json", indicator_file("product-share", "%", years, values, license="CC0 1.0"), quiet=True)
        write_json(OUT / "product-share-top" / f"{key}.json", {"world": world, "top": top}, quiet=True)
        y = str(LAST)
        tw_rank = next((i + 1 for i, r in enumerate(sorted(((v[LAST], c) for c, v in shares.items() if LAST in v), reverse=True))
                        if r[1] == "TWN"), None)
        print(f"  {key}：{y} 年世界 {world[y] / 1e8:,.1f} 億美元；台灣 {shares['TWN'].get(LAST, 0):.1f}% 第 {tw_rank} 名；"
              f"前 3 {[(c, s) for c, s, _ in top[y][:3]]}")

    # 世界第一的品項數
    counts = {k: defaultdict(dict) for k in THRESHOLDS}
    tw_list: dict[str, list] = {}
    for y in years:
        per = {k: defaultdict(int) for k in THRESHOLDS}
        sections = {k: defaultdict(lambda: defaultdict(int)) for k in THRESHOLDS}
        exporters = set()
        for code, cs in data[y].items():
            if code in RESIDUAL:
                continue
            w = sum(cs.values())
            if not w:
                continue
            sec = _section(code)
            leader, lead_v = max(cs.items(), key=lambda kv: kv[1])
            for c, v in cs.items():
                s = site(c)
                if not s:
                    continue
                exporters.add(s)
                for k, t in THRESHOLDS.items():
                    hit = c == leader if t is None else v / w >= t
                    if hit:
                        per[k][s] += 1
                        sections[k][s][sec] += 1
            if site(leader) == "TWN" and y >= TW_LIST_FROM:
                tw_list.setdefault(str(y), []).append([code, round(lead_v / w * 100, 1), round(lead_v)])
        for k in THRESHOLDS:
            for s in exporters:
                counts[k][s][y] = per[k].get(s, 0)
        sec_out = {}
        for s in sorted(exporters):
            row = {k: sorted(([i, n] for i, n in sections[k][s].items()), key=lambda r: -r[1]) for k in THRESHOLDS if sections[k].get(s)}
            if row:
                sec_out[s] = row
        write_json(OUT / "product-leads-sections" / f"{y}.json", sec_out, quiet=True)
    for k in THRESHOLDS:
        values = {c: to_series(s, years, 0) for c, s in sorted(counts[k].items())}
        write_json(OUT / "product-leads" / f"{k}.json", indicator_file("product-leads", "項", years, values, license="CC0 1.0"), quiet=True)
        last = sorted(((s.get(LAST, 0), c) for c, s in counts[k].items()), reverse=True)
        print(f"  {k} {LAST}：前 18 {last[:18]}；台灣 {counts[k]['TWN'].get(LAST)}")
    for y in tw_list:
        tw_list[y].sort(key=lambda r: -r[2])
    write_json(OUT / "product-leads-taiwan.json", tw_list)
    print(f"  台灣世界第一的品項：{ {y: [r[0] for r in v] for y, v in tw_list.items()} }")
    print(f"    {LAST}：{tw_list.get(str(LAST))}")
