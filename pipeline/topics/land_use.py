"""土地利用：耕地與牧地的 63 年變化、都市擴張吃掉了什麼（新主題，2026-11-07，製作手冊第二十五批 491，候選 1154、1155；
環境的「土地」）。

- FAOSTAT「Land Use」（RL，CC BY 4.0）：Element 5110 面積（千公頃）、7209 占國土比例（%）；Item 6620 耕地、6621 可耕地、
  6650 永久作物、6655 永久草地與牧地、6610 農業用地、6646 森林、6670 其他土地、6601 國土。1961–2024 年。
  Flag X（外部機構提供）不用。台灣沒有永久草地與牧地。
- FAOSTAT「Land Cover」（LC，CC BY 4.0，原始資料 ESA CCI Land Cover）：只用 Element 5008（Area from CCI_LC，1992–2022 每年），
  四個來源（CCI、MODIS、CGLS、WorldCover）同一國同一年可以差好幾倍，不混接。14 類的占比用 14 類合計當分母。
- 每人耕地用聯合國 WPP 2024 的年中人口。

輸出 public/data/topics/land-use/：share/{item}.json（%）、area/{item}.json（公頃）、cropland-pc.json（公頃/人）、
cover/{item}.json（土地覆蓋占比 %）、built-change.json（人工地表比 1992 年增加幾 %）、structure/{iso3}.json（側欄：
可耕地、永久作物、牧地、森林、其他土地的千公頃，依年份）。
"""

from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import faostat, wpp

OUT = OUT_DIR / "topics" / "land-use"
USE_ITEMS = {"6620": "cropland", "6621": "arable", "6650": "permanent", "6655": "pasture", "6610": "agri", "6670": "other",
             "6646": "forest", "6601": "land"}
COVER_ITEMS = {"6970": "artificial", "6971": "herbaceous", "6972": "woody", "6973": "layered", "6974": "tree", "6975": "mangrove",
               "6976": "shrub", "6977": "flooded", "6978": "sparse", "6979": "barren", "6980": "snow", "6981": "water",
               "6982": "coastal", "6983": "grass"}
STRUCTURE = ["arable", "permanent", "pasture", "forest", "other"]


def _read(dataset: str, items: dict[str, str], elements: set[str]) -> dict[tuple[str, str], dict[str, dict[int, float]]]:
    reader = faostat._csv(dataset)
    col = {k: i for i, k in enumerate(next(reader))}
    cache: dict[str, str | None] = {}
    out: dict[tuple[str, str], dict[str, dict[int, float]]] = defaultdict(lambda: defaultdict(dict))
    for r in reader:
        item = items.get(r[col["Item Code"]])
        element = r[col["Element Code"]]
        if not item or element not in elements or not r[col["Value"]] or r[col["Flag"]] == "X":
            continue
        area = faostat._area(r[col["Area Code"]], r[col["Area Code (M49)"]].lstrip("'"), cache)
        if area:
            out[(item, element)][area][int(r[col["Year"]])] = float(r[col["Value"]])
    return out


def build() -> None:
    use = _read("RL", USE_ITEMS, {"5110", "7209"})
    years = sorted({y for s in use[("cropland", "5110")].values() for y in s})
    lic = "CC BY 4.0"
    for item in ("cropland", "arable", "permanent", "pasture", "agri", "other"):
        share = dict(use[(item, "7209")])
        area = dict(use[(item, "5110")])
        sw, aw = share.pop("WLD", {}), area.pop("WLD", {})
        write_json(OUT / "share" / f"{item}.json", indicator_file(
            "share", "%", years, {k: [round(s[y], 2) if y in s else None for y in years] for k, s in share.items()},
            aggregates={"WLD": [round(sw[y], 2) if y in sw else None for y in years]}, license=lic))
        write_json(OUT / "area" / f"{item}.json", indicator_file(
            "area", "公頃", years, {k: [round(s[y] * 1000) if y in s else None for y in years] for k, s in area.items()},
            aggregates={"WLD": [round(aw[y] * 1000) if y in aw else None for y in years]}, license=lic))
    pop = wpp.demographic(["TPopulation1July"], years[-1])["TPopulation1July"]  # 千人
    crop = use[("cropland", "5110")]
    pc = {}
    for k, s in crop.items():
        if k == "WLD" or k not in pop:
            continue
        row = [round(s[y] / pop[k][y], 3) if y in s and pop[k].get(y) else None for y in years]
        if any(x is not None for x in row):
            pc[k] = row
    write_json(OUT / "cropland-pc.json", indicator_file("cropland-pc", "公頃/人", years, pc, license=lic))

    # 側欄：每國每年 5 類的千公頃
    count = 0
    for iso3 in crop:
        if iso3 == "WLD":
            continue
        rows = {}
        for y in years:
            vals = [use[(k, "5110")].get(iso3, {}).get(y) for k in STRUCTURE]
            if sum(v is not None for v in vals) >= 3:
                rows[str(y)] = [round(v, 1) if v is not None else None for v in vals]
        if rows:
            write_json(OUT / "structure" / f"{iso3}.json", {"items": STRUCTURE, "years": rows}, quiet=True)
            count += 1

    cover = _read("LC", COVER_ITEMS, {"5008"})
    cyears = sorted({y for s in cover[("artificial", "5008")].values() for y in s})
    totals: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for (item, _), series in cover.items():
        for k, s in series.items():
            for y, v in s.items():
                totals[k][y] += v
    for item in COVER_ITEMS.values():
        series = cover.get((item, "5008"), {})
        values = {k: [round(s[y] / totals[k][y] * 100, 2) if y in s and totals[k][y] else None for y in cyears]
                  for k, s in series.items() if k != "WLD"}
        values = {k: v for k, v in values.items() if any(x for x in v)}
        write_json(OUT / "cover" / f"{item}.json", indicator_file("cover", "%", cyears, values, license=lic))
    art = cover[("artificial", "5008")]
    change = {}
    for k, s in art.items():
        base = s.get(cyears[0])
        if k == "WLD" or not base or base < 1:  # 1992 年不到 1 千公頃的小島國，倍數會很誇張
            continue
        change[k] = [round((s[y] / base - 1) * 100, 1) if y in s else None for y in cyears]
    write_json(OUT / "built-change.json", indicator_file("built-change", "%", cyears, change, license=lic))
    tw = art["TWN"]
    print(f"  RL {years[0]}–{years[-1]}（耕地 {len(crop)} 區）、LC CCI {cyears[0]}–{cyears[-1]}；側欄 {count} 國；"
          f"台灣耕地 {crop['TWN'].get(1961)}→{crop['TWN'].get(years[-1])} 千公頃、人工地表 {tw[cyears[0]]}→{tw[cyears[-1]]} 千公頃")
