"""工業主題：製造業規模、製造業的組成（生產面），以及商品出口的產業結構（出口面）。

- 生產面：World Bank WDI（資料源自 UNIDO，ISIC Rev.3 五大類）。台灣用主計總處各業 GDP 依同樣分類換算。
- 出口面：Harvard Atlas of Economic Complexity 的 HS92 兩位碼出口，歸成 14 個產業類別。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import atlas, dgbas, imf, worldbank

FIRST_YEAR = 1963
TAIWAN_NOTE = "台灣不在世界銀行資料庫中，改用行政院主計總處各業 GDP 依同樣分類換算"

# 生產面五大類：輸出檔名 -> (World Bank 代碼, 台灣對應的主計總處行業代號)
CATEGORIES = {
    "food": ("NV.MNF.FBTO.ZS.UN", ["CA", "CB"]),
    "textiles": ("NV.MNF.TXTL.ZS.UN", ["CC", "CD", "CE"]),
    "chemicals": ("NV.MNF.CHEM.ZS.UN", ["CJ", "CK", "CL"]),
    "machinery": ("NV.MNF.MTRN.ZS.UN", ["CR", "CS", "CT", "CU", "CV", "CW"]),
    "other": ("NV.MNF.OTHR.ZS.UN", None),  # 製造業扣掉上面四類
}
# 中高科技製造業（UNIDO 定義，ISIC Rev.4 20、21、26–30）的台灣近似
TECH_CODES = ["CJ", "CK", "CL", "CR", "CS", "CT", "CU", "CV", "CW"]

# HS92 章別 → 出口產業類別
EXPORT_GROUPS = {
    "agrifood": ("農產品與食品", range(1, 25)),
    "minerals": ("礦產與能源", range(25, 28)),
    "chemicals": ("化學品與藥品", range(28, 39)),
    "plastics": ("塑膠與橡膠", range(39, 41)),
    "wood-paper": ("皮革、木材與紙", range(41, 50)),
    "textiles": ("紡織與成衣", range(50, 68)),
    "stone-glass": ("石材、陶瓷與玻璃", range(68, 71)),
    "precious": ("珠寶與貴金屬", range(71, 72)),
    "metals": ("鋼鐵與金屬製品", range(72, 84)),
    "machinery": ("機械", range(84, 85)),
    "electronics": ("電機與電子", range(85, 86)),
    "vehicles": ("運輸工具", range(86, 90)),
    "instruments": ("光學與精密儀器", range(90, 93)),
    "other": ("其他製品", range(93, 98)),  # 武器、家具、玩具、藝術品等
    # 98–99 章是申報時沒有細分產品別的出口；台灣有大量出口歸在這裡，單獨列出才不會誤以為是某個產業
    "unspecified": ("未分類商品", range(98, 100)),
}
CHAPTER_GROUP = {f"{c:02d}": g for g, (_label, chapters) in EXPORT_GROUPS.items() for c in chapters}


def _taiwan() -> tuple[dict[str, dict[int, float]], dict[int, float], dict[int, float], dict[int, dict[str, float]]]:
    """回傳 (五大類占比, 中高科技占比, 製造業附加價值（美元）, 25 個細項（百萬元）)。"""
    gdp_usd = imf.fetch("NGDPD")[0].get("TWN", {})
    shares: dict[str, dict[int, float]] = {k: {} for k in CATEGORIES}
    tech: dict[int, float] = {}
    mva: dict[int, float] = {}
    detail: dict[int, dict[str, float]] = {}
    for year, v in dgbas.gdp_by_industry().items():
        manufacturing = v.get("C.製造業")
        if not manufacturing:
            continue
        if year in gdp_usd and v.get("GDP"):
            mva[year] = manufacturing / v["GDP"] * gdp_usd[year] * 1e9
        sub = {name.split(".", 1)[0]: (name.split(".", 1)[1], value)
               for name, value in v.items() if len(name.split(".", 1)[0]) == 2 and name.startswith("C")}
        if len(sub) < 25:
            continue  # 最新一年只有大行業，還沒有製造業細項
        known = 0.0
        for key, (_code, codes) in CATEGORIES.items():
            if codes:
                total = sum(sub[c][1] for c in codes)
                shares[key][year] = total / manufacturing * 100
                known += total
        shares["other"][year] = (manufacturing - known) / manufacturing * 100
        tech[year] = sum(sub[c][1] for c in TECH_CODES) / manufacturing * 100
        detail[year] = {label.removesuffix("製造業"): value for label, value in sub.values()}
    return shares, tech, mva, detail


def build() -> None:
    out = OUT_DIR / "topics" / "industry"
    tw_shares, tw_tech, tw_mva, tw_detail = _taiwan()

    mva, mva_world = worldbank.fetch("NV.IND.MANF.CD", FIRST_YEAR)
    mva["TWN"] = tw_mva
    tech, _ = worldbank.fetch("NV.MNF.TECH.ZS.UN", FIRST_YEAR)
    tech["TWN"] = tw_tech
    shares = {}
    for key, (code, _codes) in CATEGORIES.items():
        shares[key], _ = worldbank.fetch(code, FIRST_YEAR)
        shares[key]["TWN"] = tw_shares[key]

    last = max(y for s in mva.values() for y in s)
    years = list(range(FIRST_YEAR, last + 1))
    notes = {"TWN": TAIWAN_NOTE}
    write_json(out / "mva.json", indicator_file(
        "mva", "美元", years, {a: to_series(s, years, 0) for a, s in mva.items() if s},
        aggregates={"WLD": to_series(mva_world, years, 0)}, notes=notes))
    write_json(out / "tech-share.json", indicator_file(
        "tech-share", "%", years, {a: to_series(s, years, 1) for a, s in tech.items() if s},
        notes={"TWN": TAIWAN_NOTE + "（近似值）"}))
    for key, data in shares.items():
        write_json(out / f"share-{key}.json", indicator_file(
            f"share-{key}", "%", years, {a: to_series(s, years, 1) for a, s in data.items() if s}, notes=notes))

    # 出口面
    exports = atlas.exports_by_chapter()
    export_years = sorted({y for c in exports.values() for y in c})
    export_years = list(range(export_years[0], export_years[-1] + 1))
    group_values: dict[str, dict[str, dict[int, float]]] = {g: {} for g in EXPORT_GROUPS}
    totals: dict[str, dict[int, float]] = {}
    for iso3, by_year in exports.items():
        for year, chapters in by_year.items():
            total = sum(chapters.values())
            if total <= 0:
                continue
            totals.setdefault(iso3, {})[year] = total
            sums = dict.fromkeys(EXPORT_GROUPS, 0.0)
            for chapter, value in chapters.items():
                sums[CHAPTER_GROUP[chapter]] += value
            for g, value in sums.items():
                group_values[g].setdefault(iso3, {})[year] = value
    for g in EXPORT_GROUPS:
        write_json(out / "exports" / f"{g}.json", indicator_file(
            f"exports/{g}", "%", export_years,
            {a: to_series({y: v / totals[a][y] * 100 for y, v in s.items()}, export_years, 1)
             for a, s in group_values[g].items()},
        ), quiet=True)

    # 側欄：每個國家的生產面五大類、出口結構，台灣另有 25 個製造業細項
    countries = set(exports) | {a for s in shares.values() for a in s}
    for iso3 in countries:
        data: dict = {}
        production = {k: to_series(shares[k].get(iso3, {}), years, 1) for k in CATEGORIES}
        if any(v is not None for series in production.values() for v in series):
            data["production"] = {"years": years, "values": production}
        if iso3 in totals:
            data["exports"] = {
                "years": export_years,
                "values": {g: to_series(group_values[g].get(iso3, {}), export_years, 0) for g in EXPORT_GROUPS},
            }
        if iso3 == "TWN":
            detail_years = sorted(tw_detail)
            names = list(tw_detail[detail_years[-1]])
            data["detail"] = {
                "years": detail_years,
                "unit": "新臺幣百萬元",
                "values": {n: [tw_detail[y].get(n) for y in detail_years] for n in names},
            }
        write_json(out / "countries" / f"{iso3}.json", data, quiet=True)
    print(f"  {len(countries)} 個國家的側欄資料")

    write_json(out / "manifest.json", {
        "topic": "industry",
        "generatedAt": now_iso(),
        "source": "World Bank WDI (UNIDO); Harvard Atlas of Economic Complexity; 行政院主計總處",
        "exportGroups": {g: label for g, (label, _chapters) in EXPORT_GROUPS.items()},
    })
