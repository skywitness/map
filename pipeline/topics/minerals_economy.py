"""關鍵礦產（二）：礦石與金屬的出口依賴度、礦業租金、循環物料使用率、台灣挖出什麼（2026-11-07，製作手冊第二十五批 445，
合併候選 1079–1082；步驟 minerals-economy，輸出 topics/minerals/）。

- 礦石與金屬出口占商品出口（ores-exports.json）：World Bank WDI TX.VAL.MMTL.ZS.UN（CC BY 4.0），1962–2025。
  WDI 的定義是 SITC（Rev. 3）27（天然肥料與其他原礦物）、28（金屬礦砂與廢料）、68（非鐵金屬）三類，分母是**不含非貨幣
  黃金**的商品出口（手冊寫 UNCTAD 的 27＋28＋68＋667＋971，那是 UNCTAD 自己的口徑，WDI 中繼資料不含寶石與黃金），
  所以不含燃料、也不含鋼鐵（SITC 67）。
  台灣不在 WDI：用 Harvard Atlas 的 SITC Rev. 2 四位碼（sources/atlas.py，CC0；台灣的數字是貿易夥伴的申報）照同樣的
  定義自算＝SITC 27、28、68 ÷（商品出口總額 − SITC 97 非貨幣黃金），1962–2024。2015、2020、2023 年 WDI 有值的國家
  用同樣的算法對照 497 個國家年，差距的中位數 0.4 個百分點；煉鋁、黃金轉口多的地方差比較多（巴林 2023 年 WDI 62.3%、
  Atlas 40.4%），所以只有台灣用自算，hints 寫明。
  側欄（ores-exports-mix/<年>.json，1962–2024 一年一檔）：這一國礦石與金屬出口裡各品項占幾 %（Atlas，MIX_GROUPS 分 27 組），
  前 MIX_TOP 名；分母是礦石與金屬出口，不是全部出口，跟地圖的 WDI 值不會互相矛盾。
- 礦業與天然資源租金占 GDP（resource-rents/<子項目>.json）：WDI NY.GDP.{MINR,TOTL,PETR,NGAS,COAL,FRST}.RT.ZS，
  1970–2021（世界銀行《The Changing Wealth of Nations》的估計，只到 2021 年）。礦物租金只算錫、金、鉛、鋅、鐵、銅、鎳、
  銀、鋁土礦、磷礦 10 種，不含鋰、鈷、稀土（說明寫明）。台灣不在 WDI。
- 循環物料使用率（circular-use.json）：Eurostat cei_srm030（CC BY 4.0），EU 27 國，2010–2024；2024 年每一國都標 i
  （Eurostat 的估計），說明寫明。EU27 合計寫在說明。
- 台灣挖出什麼（taiwan-production.json，給側欄）：經濟部地質調查及礦業管理中心「主要礦產品產銷量值表」（政府資料開放平臺
  6850，政府資料開放授權條款第 1 版）民國 113 年的生產量與產值，與「徵收礦業權費及礦產權利金情形」（9707）108–113 年。
  礦務局的礦種是台灣自己的分類（「大理石（供交水泥用）」），跟 USGS 的礦種對不起來，只放側欄、不塞進產量的子項目。
  礦業統計年報（11062）是 PDF，沒有用。
"""
from __future__ import annotations

import csv
import io
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, to_series, write_json
from sources import atlas, eurostat, worldbank

OUT = OUT_DIR / "topics" / "minerals"
ORES_CODE = "TX.VAL.MMTL.ZS.UN"
ORES_FIRST, ORES_LAST = 1962, 2025
ORES_SITC = ("27", "28", "68")
GOLD_SITC = "97"
RENTS = {"minerals": "NY.GDP.MINR.RT.ZS", "total": "NY.GDP.TOTL.RT.ZS", "oil": "NY.GDP.PETR.RT.ZS",
         "gas": "NY.GDP.NGAS.RT.ZS", "coal": "NY.GDP.COAL.RT.ZS", "forest": "NY.GDP.FRST.RT.ZS"}
RENTS_FIRST, RENTS_LAST = 1970, 2021
CIRCULAR_FIRST, CIRCULAR_LAST = 2010, 2024
TW_PRODUCTION = "https://www.gsmma.gov.tw/uploads/1741330637474qXSha6TL.csv"  # 6850，民國 113 年
TW_ROYALTIES = "https://www.gsmma.gov.tw/uploads/1750318574624UCBSVQaW.csv"  # 9707

# 側欄的品項：SITC Rev. 2 的三位碼，金屬礦砂（287）拆成四位碼；順序就是前端 ORE_MIX_GROUPS 的順序
MIX_GROUPS: list[tuple[str, tuple[str, ...]]] = [
    ("fertilizers", ("271",)), ("stone", ("273",)), ("sulphur", ("274",)), ("abrasives", ("277",)), ("other-crude", ("272", "278")),
    ("iron-ore", ("281",)), ("steel-scrap", ("282",)), ("uranium-ore", ("286",)),
    ("copper-ore", ("2871",)), ("nickel-ore", ("2872",)), ("bauxite", ("2873",)), ("lead-ore", ("2874",)), ("zinc-ore", ("2875",)),
    ("tin-ore", ("2876",)), ("manganese-ore", ("2877",)), ("other-ore", ("2879",)), ("metal-scrap", ("288",)),
    ("precious-ore", ("289",)),
    ("silver-pgm", ("681",)), ("copper", ("682",)), ("nickel", ("683",)), ("aluminium", ("684",)), ("lead", ("685",)),
    ("zinc", ("686",)), ("tin", ("687",)), ("uranium", ("688",)), ("other-metals", ("689",)),
]
MIX_TOP = 5
MIX_MIN = 1e6  # 礦石與金屬出口不到 100 萬美元的國家年份不列組成

# 礦務局的礦種名稱 → 英文
TW_NAMES_EN = {
    "大理石(石材用)": "Marble (dimension stone)", "大理石(供交水泥用)": "Marble (for cement)", "大理石(原料石)": "Marble (raw stone)",
    "水晶礦": "Rock crystal", "火粘土": "Fire clay", "白雲石": "Dolomite", "石灰石(石材用)": "Limestone (dimension stone)",
    "石灰石(原料石)": "Limestone (raw stone)", "矽砂": "Silica sand", "金礦": "Gold", "長石礦": "Feldspar", "瓷土礦": "China clay",
    "硫磺礦": "Sulphur ore", "蛇紋石(石材用)": "Serpentinite (dimension stone)", "蛇紋石(原料石)": "Serpentinite (raw stone)",
    "雲母礦": "Mica", "滑石礦": "Talc", "寶石礦(台灣玉)": "Gemstones (Taiwan nephrite)", "寶石礦(玉髓)": "Gemstones (chalcedony)",
    "鐵礦": "Iron ore", "石油礦(凝結油)": "Petroleum (condensate)", "天然氣": "Natural gas", "硫磺": "Sulphur",
    "洗滌鹽": "Washed salt", "精製鹽": "Refined salt",
}
TW_UNITS_EN = {"公噸": "t", "公斤": "kg", "公兩": "liang", "公秉": "kL", "千立方公尺": "thousand m³"}


def _atlas_ores() -> tuple[dict[str, dict[int, float]], dict[str, dict[int, dict[str, float]]]]:
    """Atlas 算的 (各國 {年: 礦石與金屬出口占不含黃金的商品出口 %}, 各國 {年: {MIX_GROUPS id: 美元}})"""
    exports = atlas.sitc4_exports(ORES_SITC + (GOLD_SITC,), "sitc4-ores-metals")
    totals = atlas.sitc_totals()
    group_of = {}
    share: dict[str, dict[int, float]] = defaultdict(dict)
    mix: dict[str, dict[int, dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    for c, years in exports.items():
        for y, codes in years.items():
            total = totals.get(c, {}).get(y)
            gold = sum(v for k, v in codes.items() if k.startswith(GOLD_SITC))
            ores = 0.0
            for code, v in codes.items():
                if not code.startswith(ORES_SITC):
                    continue
                ores += v
                if code not in group_of:
                    group_of[code] = next((g for g, prefixes in MIX_GROUPS if code.startswith(prefixes)), None)
                    if group_of[code] is None:
                        raise RuntimeError(f"SITC {code} 沒有對到 MIX_GROUPS")
                mix[c][y][group_of[code]] += v
            if total and total - gold > 0:
                share[c][y] = ores / (total - gold) * 100
    return share, mix


def _ores_exports() -> None:
    wdi, world = worldbank.fetch(ORES_CODE, ORES_FIRST, ORES_LAST)
    atlas_share, mix = _atlas_ores()
    years = list(range(ORES_FIRST, ORES_LAST + 1))
    values = {c: to_series(s, years, 1) for c, s in sorted(wdi.items())}
    values["TWN"] = to_series(atlas_share["TWN"], years, 1)
    hints = {"TWN": "自算：Harvard Atlas 的 SITC 27、28、68 ÷ 不含非貨幣黃金的商品出口（台灣沒有向聯合國申報，數字來自貿易夥伴）"}
    hints_en = {"TWN": "Own calculation from the Harvard Atlas: SITC 27, 28 and 68 ÷ merchandise exports excluding non-monetary "
                       "gold (Taiwan does not report to the UN; figures come from its partners)"}
    write_json(OUT / "ores-exports.json", indicator_file("ores-exports", "%", years, values, hints=hints, hintsEn=hints_en,
                                                         aggregates={"WLD": to_series(world, years, 1)}, license="CC BY 4.0"))
    # 跟 WDI 對照
    diffs = sorted(abs(atlas_share[c][y] - wdi[c][y]) for c in wdi for y in (2015, 2020, 2023) if y in wdi[c] and y in atlas_share.get(c, {}))
    print(f"  Atlas 自算對 WDI：{len(diffs)} 個國家年，差距中位數 {diffs[len(diffs) // 2]:.2f} 個百分點")
    print(f"  台灣：{[(y, round(atlas_share['TWN'][y], 1)) for y in (1970, 1990, 2000, 2010, 2020, 2023, 2024)]}")
    for y in (2024, 2025):
        top = sorted(((round(s[y], 1), c) for c, s in wdi.items() if y in s), reverse=True)
        print(f"  {y}：{len(top)} 國；世界 {world.get(y)}；前 16 {top[:16]}")
    print(f"    {[(c, round(wdi[c].get(2024, 0), 1)) for c in ('IND', 'JPN', 'USA', 'DEU', 'KOR', 'CHN', 'IDN', 'BRA', 'MNG', 'ZAF', 'AUS')]}")
    # 側欄：各品項占礦石與金屬出口的 %，一年一檔（側欄只讀選的那一年）
    ids = [g for g, _ in MIX_GROUPS]
    mix_years = list(range(min(y for s in mix.values() for y in s), max(y for s in mix.values() for y in s) + 1))
    for y in mix_years:
        rows = {}
        for c, s in sorted(mix.items()):
            groups = s.get(y)
            total = sum(groups.values()) if groups else 0
            if total < MIX_MIN:
                continue
            top = sorted(groups.items(), key=lambda kv: -kv[1])[:MIX_TOP]
            rows[c] = [[ids.index(g), round(v / total * 100, 1)] for g, v in top if v / total >= 0.005]
        write_json(OUT / "ores-exports-mix" / f"{y}.json", rows, quiet=True)
        if y == mix_years[-1]:
            for c in ("CHL", "AUS", "BHR", "ISL", "MAC", "TWN", "CHN", "COD"):
                print(f"    組成 {y} {c}：{[(ids[i], v) for i, v in rows.get(c, [])]}")
    write_json(OUT / "ores-exports-mix" / "index.json", {"years": mix_years, "groups": ids})


def _rents() -> None:
    years = list(range(RENTS_FIRST, RENTS_LAST + 1))
    no = {"TWN": "台灣不在世界銀行的資料裡"}
    no_en = {"TWN": "Taiwan is not in World Bank data"}
    for key, code in RENTS.items():
        countries, world = worldbank.fetch(code, RENTS_FIRST, RENTS_LAST)
        values = {c: to_series(s, years, 2) for c, s in sorted(countries.items())}
        write_json(OUT / "resource-rents" / f"{key}.json", indicator_file(
            "resource-rents", "%", years, values, noValue=no, noValueEn=no_en,
            aggregates={"WLD": to_series(world, years, 2)}, license="CC BY 4.0"), quiet=True)
        top = sorted(((round(s[RENTS_LAST], 2), c) for c, s in countries.items() if RENTS_LAST in s), reverse=True)
        print(f"  租金 {key} {RENTS_LAST}：{len(top)} 國，世界 {round(world.get(RENTS_LAST, 0), 2)}；前 12 {top[:12]}")
        print(f"    {[(c, round(countries.get(c, {}).get(RENTS_LAST, -1), 2)) for c in ('AUS', 'BRA', 'ZAF', 'IDN', 'IND', 'CHN', 'USA', 'JPN', 'DEU', 'KOR')]}")


def _circular() -> None:
    s = eurostat.series("cei_srm030")
    years = list(range(CIRCULAR_FIRST, CIRCULAR_LAST + 1))
    values = {c: to_series(v, years, 1) for c, v in sorted(s.items())}
    no = {"TWN": "只有歐盟國家：Eurostat 的循環物料使用率"}
    no_en = {"TWN": "EU countries only (Eurostat’s circular material use rate)"}
    write_json(OUT / "circular-use.json", indicator_file("circular-use", "%", years, values, noValue=no, noValueEn=no_en,
                                                         license="CC BY 4.0"))
    top = sorted(((v[CIRCULAR_LAST], c) for c, v in s.items() if CIRCULAR_LAST in v), reverse=True)
    print(f"  循環物料使用率 {CIRCULAR_LAST}：{len(top)} 國 {top}")


def _taiwan() -> None:
    raw = download(TW_PRODUCTION, "gsmma", "mineral-production-6850.csv").read_text(encoding="utf-8-sig")
    rows = list(csv.reader(io.StringIO(raw)))
    head = rows[0]
    if head[0] != "礦產品名稱" or "生產量" not in head[2] or "生產值" not in head[3]:
        raise RuntimeError(f"主要礦產品產銷量值表的欄位變了：{head}")
    roc = int(head[2].split("年")[0])
    items = []
    for name, unit, qty, value, *_ in rows[1:]:
        name, unit = name.strip(), "".join(unit.split())  # 原檔的「公       秉」中間有空白
        if name not in TW_NAMES_EN or unit not in TW_UNITS_EN:
            raise RuntimeError(f"礦種或單位沒有英文：{name} {unit}")
        zh = name.replace("(", "（").replace(")", "）")  # 原檔是半形括號，網站的中文用全形
        items.append([zh, TW_NAMES_EN[name], unit, TW_UNITS_EN[unit], float(qty), float(value)])
    items.sort(key=lambda r: -r[5])
    raw = download(TW_ROYALTIES, "gsmma", "royalties-9707.csv").read_text(encoding="utf-8-sig")
    fees = []
    for r in csv.DictReader(io.StringIO(raw)):
        fees.append([int(r["年度"]) + 1911, float(r["礦業權費徵收數(單位:千元)"]) * 1000, float(r["礦產權利金徵收數(單位:千元)"]) * 1000])
    write_json(OUT / "taiwan-production.json", {"year": roc + 1911, "items": items, "fees": fees})
    print(f"  台灣 {roc + 1911}：{len(items)} 種，產值合計 {sum(r[5] for r in items) / 1e8:.2f} 億元；"
          f"{[(r[0], r[4], round(r[5] / 1e8, 2)) for r in items if r[4]]}")
    print(f"    礦業權費、權利金：{fees}")


def build() -> None:
    _ores_exports()
    _rents()
    _circular()
    _taiwan()
