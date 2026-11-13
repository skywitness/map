"""晶圓廠地圖的記憶體廠（2026-11-13，使用者要求把 AI 產業鏈全景的資料用到地圖上；步驟 memory-fabs，輸出 topics/wafer-fabs/）。

- 資料：AI 產業鏈全景（skywitness/ai-chain，同一作者，CC BY 4.0）的 src/data/memory/fabs.yaml：60 個記憶體與儲存的廠
  （DRAM、NAND、HBM 與它的先進封裝、硬碟），每一個有產品、狀態（運轉中、擴建中、興建中、規劃中），18 個有月產能
  （千片 12 吋晶圓，多半是媒體或研究機構的估計），每一個附來源（ai-chain 的 sources，查核日 2026-10-23）。
- 位置：ai-chain 寫的城市層級座標（它沒寫出處；廠區名稱只有中文，沒有另外查 Wikidata）。
- 公司名稱用 ai-chain 公司名冊的中英文名。
"""
from __future__ import annotations

from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import ai_chain as A
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "wafer-fabs"
STATUS = {"operating": 1, "expanding": 2, "construction": 3, "planned": 4}  # src/topics/wafer-fabs.ts 的 MEMORY_STATUS
PRODUCTS = {"hbm": "HBM", "hbm-packaging": "HBM 封裝", "dram": "DRAM", "nand": "NAND", "hdd": "硬碟", "other": "其他"}
PRODUCTS_EN = {"hbm": "HBM", "hbm-packaging": "HBM packaging", "dram": "DRAM", "nand": "NAND", "hdd": "hard drives", "other": "other"}


def _main(products: list[str]) -> int:
    """點的顏色：1 HBM 與它的封裝、2 DRAM、3 NAND、4 硬碟、5 其他"""
    if "hbm" in products or "hbm-packaging" in products:
        return 1
    for i, p in enumerate(("dram", "nand", "hdd"), 2):
        if p in products:
            return i
    return 5


def build() -> None:
    data = A.load("src/data/memory/fabs.yaml")
    names = {c["id"]: c for c in A.roster()}
    sources = data["sources"]
    rows = []
    for f in data["fabs"]:
        co = names.get(f["company"])
        if not co:
            raise RuntimeError(f"{f['id']} 的公司 {f['company']} 不在名冊")
        src = sources.get(f["src"]) or {}
        st = STATUS[f["status"]]
        cap = f.get("capacityKwpm")
        rows.append({
            "lon": round(f["lon"], 4), "lat": round(f["lat"], 4), "iso3": from_alpha2(f["country"]), "pr": _main(f["products"]),
            "st": st, "op": 1 if st <= 2 else None, "pl": 1 if st >= 3 else None, "cap": cap, "r": cap or 0,
            "add": f.get("addKwpm"), "sum": 1 if cap and "合計" in (f.get("note") or "") else None, "est": {"estimate": 1, "forecast": 2, "actual": 3}.get(f.get("capacityStatus") or ""),
            "co": co["nameZh"], "coEn": co["name"], "name": f["name"], "city": f["city"],
            "prod": "、".join(PRODUCTS[p] for p in f["products"]), "prodEn": ", ".join(PRODUCTS_EN[p] for p in f["products"]),
            "src": f"{src.get('title', '')}（{src.get('publisher', '')}）" if src else None, "url": src.get("url"),
        })
    rows.sort(key=lambda r: (-(r["cap"] or 0), r["coEn"], r["name"]))
    write_points(OUT / "memory-fabs.json", {**points_file(
        rows, ["lon", "lat", "iso3", "pr", "st", "op", "pl", "cap", "r", "add", "sum", "est", "co", "coEn", "name", "city", "prod", "prodEn", "src", "url"],
        {"lon": 0.0001, "lat": 0.0001, "pr": 1, "st": 1, "op": 1, "pl": 1, "cap": 1, "r": 1, "add": 1, "sum": 1, "est": 1}, strings=("iso3",)),
        "license": A.LICENSE}, ("co", "coEn", "name", "city", "prod", "prodEn", "src", "url"))
    per = Counter(r["iso3"] for r in rows)
    by = defaultdict(Counter)
    for r in rows:
        by[r["iso3"]][r["co"]] += 1
    hints = {iso: "、".join(f"{c} {n}" for c, n in by[iso].most_common()) for iso in per}
    hints_en = {iso: ", ".join(f"{next(x['coEn'] for x in rows if x['co'] == c)} {n}" for c, n in by[iso].most_common()) for iso in per}
    write_json(OUT / "memory-fabs-count.json", indicator_file("memory-fabs", "個", [2026], {k: [v] for k, v in sorted(per.items())},
                                                              hints=hints, hintsEn=hints_en, license=A.LICENSE))
    print(f"  {len(rows)} 個：" + "、".join(f"{k} {v}" for k, v in per.most_common()))
    print("  狀態：" + str(Counter(r["st"] for r in rows)) + "；產品：" + str(Counter(r["pr"] for r in rows)))
    print("  公司：" + "、".join(f"{c} {n}" for c, n in Counter(r["co"] for r in rows).most_common()))
    print("  有月產能 " + str(sum(1 for r in rows if r["cap"])) + "：" + "、".join(f"{r['co']} {r['name']} {r['cap']}" for r in rows if r["cap"]))
    print("  台灣：" + "、".join(f"{r['co']} {r['name']}（{r['st']}）" for r in rows if r["iso3"] == "TWN"))
