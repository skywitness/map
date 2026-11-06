"""溫室氣體排放的擴充：Climate TRACE 的排放源地圖與各國最新一年的排放（製作手冊第十七批 268，2026-11-02；
資料見 sources/climate_trace.py）。

輸出到 public/data/topics/climate/：
- trace/<部門>.json：各國每年的溫室氣體排放（公噸 CO₂e，AR6 GWP-100），2015 年到最新的完整一年（complete_years()，
  5.12.0 是 2025 年）。部門是 SECTORS 的 id，total 是全部部門（跟 Climate TRACE 一樣不含森林與土地利用）。國家值取自
  EDGAR／CEDS 的子部門（ct.release().edgar）的二氧化碳不算（使用者 2026-11-02 決定），所以比 Climate TRACE 網站公布的小
  （5.12.0 的 2025 年世界少約 11%、台灣少約 8%）。國際航空、海運算在出發的機場、港口所在的國家（Climate TRACE 的算法），
  跟 GCP、EDGAR 不同。
- trace-per-capita.json：全部部門 ÷ UN WPP 2024 的年中人口（公噸／人）；人口不到 10 萬的不算（福克蘭群島 2025 年會是
  每人 2,000 公噸：漁船與轉運船的排放算在那裡）。
- trace-change/<部門>.json：最新一年 1 月到資料的最新月份，比前一年同期增減幾 %（使用者 2026-11-02 決定另做一個指標）；
  年份欄位寫 YYYYMM（202608 = 2026 年 1–8 月，前端的 timeAxis 寫成期間）；
  前一年同期不到 CHANGE_MIN 的不算。
- trace-sources.json（＋ trace-sources-more.json）：排放源的點，只收 POINT_SUBSECTORS（Climate TRACE 自己估計的設施），
  2021 年到最新的完整一年有一年排放 POINT_MIN 以上的；機場的國內、國際航線，港口的國內、國際航運，油氣盆地的開採與輸送各併成一個點。
  不是一個地方的不畫：純鹼以國名命名的國家合計、油氣的「Other basins」（一國其餘盆地的合計，點在國家中間）。
  縮小時只畫 POINT_IMPORTANT 以上的（前端 climate-trace.ts 的 SOURCE_MIN）。台灣的排放源對照環境部的事業溫室氣體年排放量
  （TAIWAN_MATCH，名稱與管制編號都對得上才寫，對不到的印警告；twy 是環境部的年份）。版本、月份都從資料來，換版只要重跑。
- trace-sources-total.json：各國地圖上排放源的排放合計（排放源地圖指標的國家值）。
"""
from __future__ import annotations

import math
import re
import unicodedata
from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json, write_layered_points
import pycountry

from sources import climate_trace as ct
from sources import moenv, wpp

OUT = OUT_DIR / "topics" / "climate"

# 部門（前端 climate-trace.ts 的 SECTORS 同一組 id）→ Climate TRACE 的 sector
SECTORS = {
    "power": "power",
    "manufacturing": "manufacturing",
    "fossil-fuels": "fossil-fuel-operations",
    "transport": "transportation",
    "buildings": "buildings",
    "agriculture": "agriculture",
    "waste": "waste",
    "fgas": "fluorinated-gases",
    "mining": "mineral-extraction",
}


def complete_years(first: int) -> list[int]:
    """first 到最新的完整一年（資料到 12 月時那一年也算）；版本換了跟著變，不寫死"""
    y, m = ct.latest_month()
    return list(range(first, (y if m == 12 else y - 1) + 1))
CHANGE_MIN = 1e5  # 前一年同期不到 10 萬公噸的不算增減（比例容易跳動）
POINT_MIN = 1e4  # 排放源：有一年 1 萬公噸以上才畫
POINT_IMPORTANT = 1e6  # 縮小時畫的：有一年 100 萬公噸以上
PER_CAPITA_MIN_POP = 100  # 千人：人口不到 10 萬的不算人均

# 排放源的子部門代碼（前端 climate-trace.ts 的 SUBSECTORS）：機場、港口、油氣盆地各併成一個代碼
SUB_CODES = {
    "electricity-generation": 1, "iron-and-steel": 2, "cement": 3, "aluminum": 4, "chemicals": 5,
    "petrochemical-steam-cracking": 6, "pulp-and-paper": 7, "oil-and-gas-refining": 8,
    "oil-and-gas-production": 9, "oil-and-gas-transport": 9, "coal-mining": 10, "copper-mining": 11,
    "iron-mining": 12, "bauxite-mining": 13, "domestic-aviation": 14, "international-aviation": 14,
    "domestic-shipping": 15, "international-shipping": 15,
}
MERGED = {9, 14, 15}

# 台灣的排放源 → 環境部「溫室氣體年排放量」的管制編號（2026-11-02 依名稱、地點逐一對照；範圍明確對得上的才收）。不收的：
# 中鋼、中龍廠內的電廠（跟鋼鐵廠一起申報）；麥寮的電廠、煉油廠、輕油裂解廠（Climate TRACE 的 Mailiao power station
# 2,033 萬公噸，環境部的麥寮汽電 906 萬公噸，其餘的汽電共生申報在台塑石化麥寮一廠，兩邊的範圍切法不同）
TAIWAN_MATCH = {
    ("electricity-generation", "Taichung power station"): "L0200473",  # 台電台中發電廠
    ("electricity-generation", "Linkou power station"): "F1700736",  # 台電林口發電廠
    ("electricity-generation", "Datan power station"): "H5307960",  # 台電大潭發電廠
    ("electricity-generation", "Talin power station"): "E5600896",  # 台電大林發電廠
    ("electricity-generation", "Hsinta power station"): "S3200688",  # 台電興達發電廠
    ("electricity-generation", "Tunghsiao power station"): "K7000764",  # 台電通霄發電廠
    ("electricity-generation", "Ho-Ping power station"): "U0100258",  # 和平電力和平火力發電廠
    ("electricity-generation", "NanPu power station"): "E5400878",  # 台電南部發電廠
    ("electricity-generation", "Hsieh-ho Power Plant"): "C1400170",  # 台電協和發電廠
    ("electricity-generation", "Chienshan power plant"): "X0501232",  # 台電尖山發電廠（澎湖）
    ("electricity-generation", "MATSU CHUSHAN"): "Z6303328",  # 台電協和發電廠馬祖珠山分廠
    ("electricity-generation", "Chia-Hui power station"): "Q6907286",  # 嘉惠電力
    ("electricity-generation", "Hai-Fu power station"): "H4604568",  # 長生電力（海湖電廠）
    ("electricity-generation", "Fong Der power station"): "R0503072",  # 森霸電力（豐德電廠）
    ("electricity-generation", "Star Buck power station"): "N1505633",  # 星元電力
    ("electricity-generation", "Chang-Bin power station"): "N1504207",  # 星能電力（彰濱）
    ("electricity-generation", "Kuo Kuang power station"): "H4810799",  # 國光電力
    ("electricity-generation", "Hsin Tao power station"): "J5601064",  # 新桃電力
    ("electricity-generation", "Hwa Ya Cogen power station"): "H4810851",  # 華亞汽電
    ("electricity-generation", "TAYUAN INDUSTRIAL PARK"): "H4702336",  # 大園汽電共生
    ("electricity-generation", "Kuan-Tien power station"): "R9702160",  # 台灣汽電共生官田廠
    ("electricity-generation", "Hsinkang SK power station"): "Q7100254",  # 台化新港廠（汽電共生）
    ("electricity-generation", "Longder power station"): "G3700791",  # 台化龍德廠（汽電共生）
    ("electricity-generation", "Houli Mill power station"): "L9200693",  # 正隆后里分公司（汽電共生）
    ("electricity-generation", "Chiutang Mill power station"): "S2100223",  # 中華紙漿久堂廠（汽電共生）
    ("iron-and-steel", "China Steel Xiaogang steel plant"): "E5600841",  # 中國鋼鐵（含廠內發電）
    ("iron-and-steel", "Dragon Steel Taichung steel plant"): "L0200633",  # 中龍鋼鐵（含廠內發電）
    ("iron-and-steel", "Walsin Lihwa Tainan stainless steel plant"): "R8500582",  # 華新麗華鹽水廠
    ("iron-and-steel", "Tung Ho Steel Miaoli plant"): "K8100129",  # 東和鋼鐵苗栗廠
    ("iron-and-steel", "Tung Ho Steel Taoyuan plant"): "H53A0675",  # 東和鋼鐵桃園廠
    ("iron-and-steel", "Feng Hsin Taichung Steel plant"): "L9200728",  # 豐興鋼鐵
    ("iron-and-steel", "Yieh United Steel Kaohsiung plant"): "S1601990",  # 燁聯鋼鐵
    ("iron-and-steel", "Shyeh Sheng Fuat Steel Kaohsiung steel plant"): "E5600332",  # 協勝發鋼鐵
    ("cement", "Asia Cement Corp Xincheng Cement Plant"): "U9400115",  # 亞洲水泥花蓮製造廠
    ("cement", "TCC Group Holdings Suao Cement Plant"): "G3200778",  # 台泥蘇澳廠
    ("cement", "TCC Group Holdings Hoping Cement Plant"): "U0100187",  # 台泥和平廠
    ("oil-and-gas-refining", "CPC Dalin Refinery"): "E5600056",  # 中油大林煉油廠
    ("oil-and-gas-refining", "CPC Taoyuan Refinery"): "H4803507",  # 中油桃園煉油廠
    ("petrochemical-steam-cracking", "Chinese Petroleum Corp. , Taiwan, Linyuan"): "S1900710",  # 中油石化事業部（林園）
    ("pulp-and-paper", "Chung Hwa - Hualien Mill"): "U9500478",  # 中華紙漿花蓮廠
}


def _value(sub: str, cell: dict[str, float]) -> float:
    """一個月的排放（公噸 CO₂e）：EDGAR／CEDS 的子部門扣掉二氧化碳"""
    v = cell.get("co2e", 0.0)
    if sub in ct.release().edgar:
        v -= cell.get("co2", 0.0)
    return v


def country_series() -> tuple[dict[str, dict[str, dict[int, float]]], dict[str, dict[str, float]], dict[str, dict[int, float]]]:
    """({部門: {iso3: {年: 公噸}}}（含 total）、{部門: {iso3: 最新一年對前一年同期的 %}}、{iso3: {年: 扣掉的 CO₂}}）"""
    annual: dict[str, dict[str, dict[int, float]]] = {k: defaultdict(lambda: defaultdict(float)) for k in [*SECTORS, "total"]}
    ytd: dict[str, dict[str, list[float]]] = {k: defaultdict(lambda: [0.0, 0.0]) for k in [*SECTORS, "total"]}
    removed: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    by_sector = {v: k for k, v in SECTORS.items()}
    years = set(complete_years(ct.FIRST_COUNTRY_YEAR))
    last_year, last_month = ct.latest_month()
    edgar = ct.release().edgar
    for (sector, sub), countries in ct.country_monthly().items():
        if sector == ct.LAND_SECTOR:
            continue
        if sector not in by_sector:
            raise RuntimeError(f"Climate TRACE 多了部門 {sector}（{sub}），SECTORS 與前端 climate-trace.ts 的 SECTOR_DIM 要加")
        item = by_sector[sector]
        for iso3, months in countries.items():
            for (y, m), cell in months.items():
                v = _value(sub, cell)
                if sub in edgar:
                    removed[iso3][y] += cell.get("co2", 0.0)
                if y in years:
                    annual[item][iso3][y] += v
                    annual["total"][iso3][y] += v
                if m <= last_month and y in (last_year - 1, last_year):
                    i = y - (last_year - 1)
                    ytd[item][iso3][i] += v
                    ytd["total"][iso3][i] += v
    change = {
        k: {iso3: (b / a - 1) * 100 for iso3, (a, b) in rows.items() if a >= CHANGE_MIN} for k, rows in ytd.items()
    }
    for k, rows in ytd.items():
        a = sum(v[0] for v in rows.values())
        b = sum(v[1] for v in rows.values())
        change[k]["WLD"] = (b / a - 1) * 100
    return annual, change, removed


def _merge(rows: list[dict]) -> list[dict]:
    """機場（國內＋國際）、港口、油氣盆地（開採＋輸送）同一國同名、距離 0.5° 以內的併成一個點，排放相加"""
    out: list[dict] = []
    index: dict[tuple, int] = {}
    for r in rows:
        key = (r["s"], r["iso3"], r["name"])
        if r["s"] in MERGED and key in index:
            base = out[index[key]]
            if abs(base["lat"] - r["lat"]) <= 0.5 and abs(base["lon"] - r["lon"]) <= 0.5:
                for y, v in r["years"].items():
                    base["years"][y] = base["years"].get(y, 0.0) + v
                continue
        index.setdefault(key, len(out))
        out.append({**r, "years": dict(r["years"])})
    return out


def _plain(text: str) -> str:
    """去掉重音、大小寫（México → mexico）"""
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)).casefold().strip()


def _is_country_name(name: str, iso3: str) -> bool:
    """名稱就是這一國的國名（網站的英文國名、ISO 的名稱）；不用 from_name() 的模糊比對（會把 Antwerpen 當成比利時）"""
    c = pycountry.countries.get(alpha_3=iso3)
    names = {ct.common_countries().get(iso3, {}).get("name", "")}
    if c:
        names |= {c.name, getattr(c, "common_name", ""), getattr(c, "official_name", "")}
    names |= {"RUS": {"Russia"}}.get(iso3, set())
    return _plain(name) in {_plain(n) for n in names if n}


def _clean_name(sub: str, name: str) -> str:
    """Climate TRACE 自己組的名稱改得好讀一點：化學的城市合計「CHN-Jinan_ammonia」→「Jinan」，
    油氣盆地「Algeria_Illizi - Ghadames_Conventional onshore」→「Illizi - Ghadames · Conventional onshore」"""
    m = re.fullmatch(r"[A-Z]{3}-(.+)_(ammonia|methanol|soda_ash)", name)
    if sub == "chemicals" and m:
        return m.group(1)
    parts = name.split("_")
    if sub in ("oil-and-gas-production", "oil-and-gas-transport") and len(parts) == 3:
        words = {"OtherBasins": "Other basins", "OtherResources": "other resources"}
        return " · ".join(words.get(x, x) for x in parts[1:])
    return name


def source_rows() -> tuple[list[dict], dict[str, dict]]:
    """排放源的點（依最新一年的排放由大到小）與對到的環境部事業（管制編號 → 事業）"""
    raw = []
    dropped: list[str] = []
    other_basins: list[float] = []
    for sub in ct.POINT_SUBSECTORS:
        for s in ct.sources(sub):
            name = _clean_name(sub, s["name"])
            # 純鹼有一部分是整個國家的合計，名稱就是國名、點在國家中間，不是設施
            if sub == "chemicals" and _is_country_name(name, s["iso3"]):
                dropped.append(name)
                continue
            # 油氣的「Other basins」是一國其餘盆地的合計，點在國家中間（中國 32.8°N 105.6°E），也不是一個地方
            if name.startswith("Other basins"):
                other_basins.append(max(s["years"].values(), default=0.0))
                continue
            raw.append({**s, "name": name, "s": SUB_CODES[sub]})
    print(f"  化學（純鹼）的國家合計 {len(dropped)} 個不畫：{', '.join(sorted(dropped))}")
    print(f"  油氣的 Other basins（各國其餘盆地的合計）{len(other_basins)} 筆不畫（開採與輸送分開算）")
    rows = _merge(raw)
    rows = [r for r in rows if r["years"] and max(r["years"].values()) >= POINT_MIN]

    # 台灣對照：每一筆都要對到剛好一個排放源（同名的取排放最大的）與環境部的一家事業
    # 新版改了名稱、環境部換了年份時，對不到的印警告、不對照（不讓換版卡住）
    last = complete_years(ct.FIRST_SOURCE_YEAR)[-1]
    tw_year, facilities = moenv.facility_ghg()
    matched: dict[str, dict] = {}
    for (sub, name), code in TAIWAN_MATCH.items():
        cands = [r for r in rows if r["iso3"] == "TWN" and r["subsector"] == sub and r["name"] == name]
        if not cands:
            print(f"  ⚠ Climate TRACE 沒有台灣的「{name}」（{sub}），這一筆不對照；TAIWAN_MATCH 要更新")
            continue
        if code not in facilities:
            print(f"  ⚠ 環境部 {tw_year} 年的事業溫室氣體排放量沒有管制編號 {code}（{name}），這一筆不對照")
            continue
        target = max(cands, key=lambda r: r["years"].get(last, 0.0))
        f = facilities[code]
        target["tw"] = f["direct"]
        target["twn"] = f["name"]
        target["twy"] = tw_year
        matched[code] = {**f, "trace": target["years"].get(tw_year), "name_en": name}
    rows.sort(key=lambda r: -max(r["years"].get(last, 0.0), 0.0) - 1e-9 * max(r["years"].values()))
    return rows, {"year": tw_year, **matched}


def build() -> None:
    rel = ct.release()
    years = complete_years(ct.FIRST_COUNTRY_YEAR)
    source_years = complete_years(ct.FIRST_SOURCE_YEAR)
    latest = ct.latest_month()
    annual, change, removed = country_series()
    pop = wpp.demographic(["TPopulation1July"], last_year=years[-1])["TPopulation1July"]
    inventory = moenv.ghg_inventory()
    last = years[-1]

    # 台灣跟環境部國家清冊（不含碳匯）比；Climate TRACE 不扣 EDGAR 的二氧化碳是多少也寫出來
    tw_inv_year = max(inventory)
    tw = annual["total"]["TWN"]
    inv = inventory[tw_inv_year]["total"] * 1000
    full = tw[tw_inv_year] + removed["TWN"][tw_inv_year]
    note = (f"環境部國家溫室氣體排放清冊 {tw_inv_year} 年 {inv / 1e8:.2f} 億公噸（不含碳匯，AR5）；Climate TRACE {tw_inv_year} 年"
            f" {tw[tw_inv_year] / 1e8:.2f} 億公噸（AR6，不含取自 EDGAR、CEDS 的二氧化碳 {removed['TWN'][tw_inv_year] / 1e4:,.0f} 萬公噸；"
            f"含的話 {full / 1e8:.2f} 億），含桃園機場等的國際航班與高雄港等的國際航運。")
    note_en = (f"Taiwan’s national GHG inventory: {inv / 1e6:,.1f} million tonnes in {tw_inv_year} (excluding sinks, AR5). Climate TRACE: "
               f"{tw[tw_inv_year] / 1e6:,.1f} million (AR6), leaving out {removed['TWN'][tw_inv_year] / 1e6:,.1f} million tonnes of CO₂ "
               f"taken from EDGAR and CEDS ({full / 1e6:,.1f} million with it); it includes international flights and shipping "
               f"departing from Taiwan.")
    extra = {"notes": {"TWN": note}, "notesEn": {"TWN": note_en}}

    world: dict[str, dict[int, float]] = {}
    for item, data in annual.items():
        world[item] = {y: sum(s.get(y, 0.0) for s in data.values()) for y in years}
        values = {iso3: to_series(s, years, 0) for iso3, s in sorted(data.items())
                  if iso3 != ct.UNKNOWN and any(s.get(y) for y in years)}
        write_json(OUT / "trace" / f"{item}.json", indicator_file(
            f"trace-{item}", "公噸 CO₂e", years, values, aggregates={"WLD": to_series(world[item], years, 0)},
            **(extra if item == "total" else {}),
        ))
    per_capita = {}
    for iso3, s in annual["total"].items():
        if iso3 == ct.UNKNOWN:
            continue
        # 人口不到 PER_CAPITA_MIN_POP 的不算（福克蘭群島的漁船、轉運船會讓人均到上千公噸）
        row = [s[y] / (pop[iso3][y] * 1000) if pop.get(iso3, {}).get(y, 0) >= PER_CAPITA_MIN_POP else None for y in years]
        if any(v is not None for v in row):
            per_capita[iso3] = [None if v is None else round(v, 2) for v in row]
    w_pc = [world["total"][y] / (pop["WLD"][y] * 1000) for y in years]
    write_json(OUT / "trace-per-capita.json", indicator_file(
        "trace-per-capita", "公噸 CO₂e/人", years, per_capita, aggregates={"WLD": [round(v, 2) for v in w_pc]}, **extra,
    ))

    period = latest[0] * 100 + latest[1]  # YYYYMM
    for item, rows in change.items():
        w = rows.pop("WLD")
        write_json(OUT / "trace-change" / f"{item}.json", indicator_file(
            f"trace-change-{item}", "%", [period], {iso3: [round(v, 1)] for iso3, v in sorted(rows.items()) if iso3 != ct.UNKNOWN},
            aggregates={"WLD": [round(w, 1)]},
        ))

    # 排放源
    rows, matched = source_rows()
    fields = ["lon", "lat", "name", "s", "t", "iso3", *[f"e{y}" for y in source_years], "cap", "tw", "twn", "twy"]
    points = []
    for r in rows:
        p = {"lon": r["lon"], "lat": r["lat"], "name": r["name"], "s": r["s"], "t": r["type"] or None, "iso3": r["iso3"]}
        for y in source_years:
            v = r["years"].get(y)
            p[f"e{y}"] = round(v) if v is not None else None
        p["cap"] = round(r["cap"]) if r["s"] == 1 and r["cap"] and r["cap_units"] == "MW" else None
        p["tw"] = r.get("tw")
        p["twn"] = r.get("twn")
        p["twy"] = r.get("twy")
        points.append(p)
    scale = {"lon": 0.001, "lat": 0.001, "cap": 1, "tw": 100, **{f"e{y}": 100 for y in source_years}}
    write_layered_points(
        OUT / "trace-sources.json", points,
        lambda p: max((p[f"e{y}"] or 0) for y in source_years) >= POINT_IMPORTANT,
        fields, scale, strings=["t", "iso3", "twn"], text=["name"],  # 名稱另外放（2026-11-06，城6）
    )
    totals: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for p in points:
        for y in source_years:
            if p[f"e{y}"]:
                totals[p["iso3"]][y] += p[f"e{y}"]
    write_json(OUT / "trace-sources-total.json", indicator_file(
        "trace-sources", "公噸 CO₂e", source_years, {iso3: to_series(s, source_years, 0) for iso3, s in sorted(totals.items())},
        aggregates={"WLD": [sum(s.get(y, 0.0) for s in totals.values()) for y in source_years]},
    ))

    write_json(OUT / "climate-trace-manifest.json", {
        "topic": "climate", "part": "climate-trace", "generatedAt": now_iso(), "version": rel.version, "doi": rel.doi,
        "published": rel.published, "latest": f"{latest[0]}-{latest[1]:02d}", "citation": rel.citation,
        "gwp": "IPCC AR6 GWP-100", "terms": rel.terms, "edgarCo2Removed": sorted(rel.edgar), "sources": len(points),
        "taiwanMatched": len(matched) - 1, "taiwanYear": matched["year"],
    })

    # 檢查用的摘要
    full_world = world["total"][last] + sum(r.get(last, 0.0) for r in removed.values())
    print(f"  各國：{len(annual['total']) - 1} 國（另有 UNK），{years[0]}–{last} 年；{last} 年世界 {world['total'][last] / 1e9:.2f} Gt"
          f"（扣掉 EDGAR／CEDS 的 CO₂ {(full_world - world['total'][last]) / 1e9:.2f} Gt，"
          f"{(full_world - world['total'][last]) / full_world * 100:.1f}%）")
    for item in SECTORS:
        print(f"    {item:13} 世界 {world[item][last] / 1e9:6.2f} Gt  台灣 {annual[item]['TWN'].get(last, 0) / 1e6:7.1f} Mt")
    print("  ", note)
    big = sorted(((iso3, v) for iso3, v in change["total"].items()
                  if iso3 != ct.UNKNOWN and annual["total"][iso3].get(last, 0) > 1e8), key=lambda kv: kv[1])
    print(f"  {latest[0]} 年 1–{latest[1]} 月比前一年同期（1 億公噸以上的國家）：最低 {[(c, round(v, 1)) for c, v in big[:5]]}，"
          f"最高 {[(c, round(v, 1)) for c, v in big[-5:]]}；台灣 {change['total'].get('TWN', math.nan):+.1f}%")
    counts = defaultdict(int)
    for p in points:
        counts[p["s"]] += 1
    print(f"  排放源 {len(points)} 個（{dict(sorted(counts.items()))}），台灣 {sum(p['iso3'] == 'TWN' for p in points)} 個，"
          f"對到環境部 {len(matched) - 1} 家（{matched['year']} 年）")
    for code, m in list(matched.items())[1:]:
        trace = m["trace"]
        print(f"    {m['name_en']:45} CT {trace / 1e4 if trace else 0:8.1f} 萬  環境部 {m['direct'] / 1e4:8.1f} 萬  {m['name']}")
