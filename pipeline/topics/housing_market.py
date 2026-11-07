"""沒人住的房子與買賣量（新主題，2026-11-07，製作手冊第二十五批 471，候選 1122、1135；經濟的「不動產」）。

- 無人經常居住的住宅比例：Eurostat 2011、2021 年人口及住宅普查 `cens_11dwob_r3`、`cens_21dwob_r3`
  （Conventional dwellings by occupancy status, type of building and NUTS 3 region，CC BY 4.0）國家層級的
  DW_NOC ÷ DW（building=TOTAL）；英國（只有 2011 年有）照 sources/eurostat.py 的 NONCOMMERCIAL 不收。
  瑞士 2011 年全部是「不明」、波蘭 2011 年只有 2.5%（2021 年 18.0%，兩次普查的做法不同）不收。
  台灣：主計總處 2020 年人口及住宅普查「住宅使用情形」（data.gov.tw 162051，政府資料開放授權條款第 1 版）
  的 mp06234a109.xml，無人經常居住 ÷ 總計，放在 2021 年那一格、hint 寫 2020 年。
- 住宅買賣：Eurostat `prc_hpi_hsna`（House sales - number and index）的成交件數（NR，14 國）與年增減（RCH_A_AVG，20 國）。
  每千宅的件數用普查的住宅數當分母：2011、2021 兩次普查之間線性內插，2011 年以前用 2011、2021 年以後用 2021 年
  （克羅埃西亞沒有 2011 年，一律用 2021 年）。
  台灣：實價登錄的成屋買賣（sources/lvr.py，110S1–115S3 各季去重），建物型態是住宅（住宅大樓、華廈、公寓、透天厝、
  套房）的筆數，**依公開的季別算年**（110S1–110S4 是 2021 年，大致是那一年申報登記的件數；不依交易年月日，
  因為預售屋完工過戶的那一筆寫的是當初簽約的日子，最近一年會算少），分母是 2020 年普查的住宅數；年增減自己算。
  預售屋的合約（_b 檔）不算。各縣市的單價中位數用交易日期在 2025 年的（扣掉車位的總價 ÷ 扣掉車位的面積，
  不含備註有特殊交易的），寫進側欄的 taiwan.json。

輸出 public/data/topics/housing-market/：unoccupied.json、sales-rate.json、sales-change.json、detail.json（側欄）、
taiwan.json（台灣的縣市表）、manifest.json。
"""

from __future__ import annotations

import statistics
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import eurostat, lvr

OUT = OUT_DIR / "topics" / "housing-market"
CENSUS = {2011: "cens_11dwob_r3", 2021: "cens_21dwob_r3"}
# 2011 年不收的：瑞士全部是「不明」、波蘭 2.5%（2021 年 18.0%，兩次普查的做法不同）
DROP_2011 = {"CHE", "POL"}
BUILDINGS = ["RES1", "RES2", "RES_GE3"]
TW_CENSUS_URL = "https://ws.dgbas.gov.tw/001/Upload/461/relfile/11525/231699/mp06234a109.xml"
TW_FIRST, TW_LAST = 2021, 2025
SALES_FIRST = 2006
LVR_FIRST, LVR_LAST = "110S1", "115S3"
PING = 3.305785  # 一坪的平方公尺
MIN_PRICES = 30  # 單價中位數至少要幾筆
COUNTY_EN = {
    "臺北市": "Taipei", "新北市": "New Taipei", "桃園市": "Taoyuan", "臺中市": "Taichung", "臺南市": "Tainan",
    "高雄市": "Kaohsiung", "基隆市": "Keelung", "新竹市": "Hsinchu City", "嘉義市": "Chiayi City",
    "新竹縣": "Hsinchu County", "苗栗縣": "Miaoli County", "彰化縣": "Changhua County", "南投縣": "Nantou County",
    "雲林縣": "Yunlin County", "嘉義縣": "Chiayi County", "屏東縣": "Pingtung County", "宜蘭縣": "Yilan County",
    "花蓮縣": "Hualien County", "臺東縣": "Taitung County", "澎湖縣": "Penghu County", "金門縣": "Kinmen County",
    "連江縣": "Lienchiang County",
}


def _census() -> dict[int, dict[str, dict[str, dict[str, float]]]]:
    """{年: {iso3: {building: {housing: 宅數}}}}"""
    out: dict[int, dict[str, dict[str, dict[str, float]]]] = {}
    for year, ds in CENSUS.items():
        by: dict[str, dict[str, dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
        for building in ["TOTAL", *BUILDINGS]:
            for housing in ["DW", "DW_OC", "DW_NOC", "UNK"]:
                for iso3, vals in eurostat.series(ds, housing=housing, building=building, unit="NR", freq="A").items():
                    if year in vals and not (year == 2011 and iso3 in DROP_2011):
                        by[iso3][building][housing] = vals[year]
        out[year] = {k: v for k, v in by.items() if v["TOTAL"].get("DW")}
    return out


def _taiwan_census() -> list[dict]:
    """[{name, total, occupied, unoccupied, sometimes, otherUse, notUsed}]，第一列是總計"""
    path = download(TW_CENSUS_URL, "dgbas", "mp06234a109.xml")
    rows = []
    for rec in ET.parse(path).getroot():
        cells = [c.text or "" for c in rec]
        rows.append({
            "name": cells[0].strip(),
            "total": int(cells[1]), "occupied": int(cells[2]), "unoccupied": int(cells[5]),
            "sometimes": int(cells[6]), "otherUse": int(cells[7]), "notUsed": int(cells[8]),
        })
    if rows[0]["name"] != "總計" or rows[0]["total"] != rows[0]["occupied"] + rows[0]["unoccupied"]:
        raise RuntimeError("主計總處住宅使用情形的格式變了")
    return rows


def _stock(census: dict, iso3: str, year: int) -> float | None:
    """這一年的住宅數：兩次普查之間線性內插"""
    a = census[2011].get(iso3, {}).get("TOTAL", {}).get("DW")
    b = census[2021].get(iso3, {}).get("TOTAL", {}).get("DW")
    if b is None:
        return None
    if a is None or year >= 2021:
        return b
    if year <= 2011:
        return a
    return a + (b - a) * (year - 2011) / 10


def build() -> None:
    census = _census()
    tw_census = _taiwan_census()
    tw_total = tw_census[0]

    # ── 無人經常居住的住宅比例 ──
    occ_years = [2011, 2021]
    occ: dict[str, list[float | None]] = {}
    for iso3 in sorted(set(census[2011]) | set(census[2021])):
        row = []
        for y in occ_years:
            t = census[y].get(iso3, {}).get("TOTAL", {})
            row.append(round(t["DW_NOC"] / t["DW"] * 100, 2) if t.get("DW") and "DW_NOC" in t else None)
        occ[iso3] = row
    tw_share = round(tw_total["unoccupied"] / tw_total["total"] * 100, 2)
    tw_unused = round(tw_total["notUsed"] / tw_total["total"] * 100, 2)
    occ["TWN"] = [None, tw_share]
    hints = {"TWN": f"台灣是 2020 年普查；其中「目前沒有使用」{tw_unused:.1f}%"}
    hints_en = {"TWN": f"Taiwan: 2020 census; {tw_unused:.1f}% “not in use at present”"}
    write_json(OUT / "unoccupied.json", indicator_file("unoccupied", "%", occ_years, occ, hints=hints, hintsEn=hints_en,
                                                         latestWithin=0, license="CC BY 4.0"))

    # ── 住宅買賣 ──
    nr = {p: eurostat.series("prc_hpi_hsna", purchase=p, unit="NR", freq="A") for p in ["TOTAL", "DW_NEW", "DW_EXST"]}
    rch = eurostat.series("prc_hpi_hsna", purchase="TOTAL", unit="RCH_A_AVG", freq="A")
    last = max(max(v) for v in nr["TOTAL"].values())
    years = list(range(SALES_FIRST, last + 1))

    # 台灣：實價登錄
    rows = lvr.sales(LVR_FIRST, LVR_LAST)
    tw_count: Counter[int] = Counter()
    county_count: Counter[str] = Counter()
    county_prices: dict[str, list[int]] = defaultdict(list)
    for _id, code, ym, unit, special, season in rows:
        filed = int(season[:-2]) + 1911  # 公開的季別的年
        if TW_FIRST <= filed <= TW_LAST:
            tw_count[filed] += 1
        if filed == TW_LAST:
            county_count[code] += 1
        if ym // 100 == TW_LAST and unit and not special:
            county_prices[code].append(unit)
    tw_stock = tw_total["total"]

    rate: dict[str, list[float | None]] = {}
    sales_detail: dict[str, dict] = {}
    for iso3, vals in nr["TOTAL"].items():
        row: list[float | None] = []
        for y in years:
            s = _stock(census, iso3, y)
            row.append(round(vals[y] / s * 1000, 2) if y in vals and s else None)
        if any(v is not None for v in row):
            rate[iso3] = row
    rate["TWN"] = [round(tw_count[y] / tw_stock * 1000, 2) if TW_FIRST <= y <= TW_LAST else None for y in years]
    write_json(OUT / "sales-rate.json", indicator_file("sales-rate", "件/千宅", years, rate, latestWithin=0,
                                                         license="CC BY 4.0"))

    change: dict[str, list[float | None]] = {k: [v.get(y) for y in years] for k, v in rch.items()}
    change["TWN"] = [round((tw_count[y] / tw_count[y - 1] - 1) * 100, 1) if TW_FIRST < y <= TW_LAST else None
                     for y in years]
    write_json(OUT / "sales-change.json", indicator_file("sales-change", "%", years, change, latestWithin=0,
                                                           license="CC BY 4.0"))

    # ── 側欄：住宅數、建物型態、成交件數（含新屋、中古屋） ──
    detail: dict[str, dict] = {}
    for iso3 in sorted(set(occ) - {"TWN"} | set(nr["TOTAL"]) | set(rch)):
        d: dict[str, object] = {}
        for y in occ_years:
            c = census[y].get(iso3)
            if not c:
                continue
            t = c["TOTAL"]
            d[f"c{y}"] = [int(t.get("DW", 0)), int(t.get("DW_OC", 0)), int(t.get("DW_NOC", 0)), int(t.get("UNK", 0))]
            if y == 2021:
                d["b2021"] = {b: [int(c[b].get("DW", 0)), int(c[b].get("DW_NOC", 0))] for b in BUILDINGS if c.get(b, {}).get("DW")}
        sales = {p: [int(nr[p][iso3][y]) if y in nr[p].get(iso3, {}) else None for y in years] for p in nr}
        if any(v is not None for v in sales["TOTAL"]):
            d["sales"] = sales
        if d:
            detail[iso3] = d
    detail["TWN"] = {
        "sales": {"TOTAL": [tw_count[y] if TW_FIRST <= y <= TW_LAST else None for y in years]},
    }
    write_json(OUT / "detail.json", {"years": years, "detail": detail})

    # ── 台灣的縣市表 ──
    names = {v: k for k, v in lvr.COUNTIES.items()}
    counties = []
    for r in tw_census[1:]:
        if r["name"].endswith("地區"):
            continue
        code = names.get(r["name"])
        prices = county_prices.get(code, []) if code else []
        counties.append({
            "name": r["name"], "nameEn": COUNTY_EN[r["name"]],
            "total": r["total"], "unoccupied": r["unoccupied"], "notUsed": r["notUsed"],
            "sales": county_count.get(code, 0) if code else None,
            "price": round(statistics.median(prices)) if len(prices) >= MIN_PRICES else None,
        })
    all_prices = [p for v in county_prices.values() for p in v]
    write_json(OUT / "taiwan.json", {
        "census": {k: tw_total[k] for k in ["total", "occupied", "unoccupied", "sometimes", "otherUse", "notUsed"]},
        "salesYear": TW_LAST,
        "sales": {str(y): tw_count[y] for y in range(TW_FIRST, TW_LAST + 1)},
        "price": round(statistics.median(all_prices)),
        "ping": PING,
        "counties": counties,
    })

    for y in range(TW_FIRST, TW_LAST + 1):
        print(f"  台灣 {y} 年住宅買賣 {tw_count[y]:,} 筆、每千宅 {tw_count[y] / tw_stock * 1000:.1f}")
    write_json(OUT / "manifest.json", {"topic": "housing-market", "generatedAt": now_iso(), "sources": [
        "Eurostat cens_11dwob_r3, cens_21dwob_r3, prc_hpi_hsna", "主計總處 2020 年人口及住宅普查 住宅使用情形",
        f"內政部 實價登錄 {LVR_FIRST}–{LVR_LAST} 季資料"]})
