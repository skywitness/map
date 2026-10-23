"""旅行實用主題：跟台灣的時差、行車方向、插頭類型、市電電壓與頻率（單一快照，前端 timeless）。

- 時差：IANA 時區資料庫（`sources/iana_tz.py`，tzdata 套件，公有領域）。每個國家用首都所在的時區
  （Natural Earth 1:10m populated places 的 Admin-0 capital 與它的 TIMEZONE 欄位；首都的時區不在那個國家的
  zone.tab 清單裡、或沒有首都的屬地，用 zone.tab 離首都最近的、或第一個時區），算標準時間的 UTC 偏移、有沒有夏令時間；
  地圖的值是「標準時間跟台灣（UTC+8）差幾小時」。跨好幾個時區的國家，附註寫出全國的範圍。
- 行車方向：Wikidata 的 P1622（CC0），改過方向的國家附註寫出年份。
- 插頭、電壓、頻率：英文維基百科「Mains electricity by country」的表格（CC BY-SA 4.0，`sources/wiki_mains.py`），
  地圖上歸成幾類；側欄列出全部的插頭字母、電壓與頻率。衍生的資料檔依 CC BY-SA 4.0 分享。
"""
from __future__ import annotations

import json
import math

import pycountry

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import iana_tz, wiki_mains, wikidata_driving
from sources.countries import NAME_ALIASES

OUT = OUT_DIR / "topics" / "travel"
YEAR = 2026
TAIWAN_OFFSET = 8
POPULATED_PLACES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_populated_places.geojson"

# 地圖上自訂代碼、或 Natural Earth 的首都代碼跟地圖不同的區域：直接指定時區
TZ_OVERRIDES = {
    "RUS": "Europe/Moscow",  # Natural Earth 的莫斯科沒有 TIMEZONE；zone.tab 的第一個是加里寧格勒
    "XKX": "Europe/Belgrade",  # 科索沃（Natural Earth 的首都代碼是 KOS）
    "_SOL": "Africa/Mogadishu",  # 索馬利蘭（哈爾格薩）
    "_CYN": "Asia/Famagusta",  # 北賽普勒斯
    "_IOT": "Indian/Christmas",  # 澳屬印度洋領地（聖誕島、科科斯群島）
}

# Wikidata 沒有（地圖上自訂代碼、或沒有 ISO 代碼）的區域的行車方向
DRIVING_OVERRIDES = {"XKX": "R", "_CYN": "L"}

# 行車方向的代碼（src/topics/travel.ts 的 DRIVING）
LEFT, RIGHT = 1, 2

# 插頭的分類（src/topics/travel.ts 的 PLUG_GROUPS），依序判斷
PLUG_AB, PLUG_AB_MIXED, PLUG_CEF, PLUG_G, PLUG_I, PLUG_DM, PLUG_NATIONAL = 1, 2, 3, 4, 5, 6, 7

# 電壓與頻率的分類（src/topics/travel.ts 的 POWER_GROUPS）：依表格列出的第一個電壓（一般家用插座）
POWER_LOW_60, POWER_LOW_50, POWER_HIGH_60, POWER_HIGH_50 = 1, 2, 3, 4

# 維基百科表格的國名裡 pycountry 與 NAME_ALIASES 查不到、或會查錯的
MAINS_NAMES = {
    "Bolivia": "BOL", "Bonaire": "BES", "Brunei": "BRN", "Cape Verde": "CPV", "Caribbean Netherlands": "BES",
    "Democratic Republic of the Congo": "COD", "Republic of the Congo": "COG", "East Timor": "TLS",
    "Federated States of Micronesia": "FSM", "Micronesia": "FSM", "Iran": "IRN", "Ivory Coast": "CIV",
    "Kosovo": "XKX", "Laos": "LAO", "Macau": "MAC", "Moldova": "MDA", "North Korea": "PRK", "South Korea": "KOR",
    "Palestine": "PSE", "State of Palestine": "PSE", "Russia": "RUS", "Saint Martin": "MAF", "Sint Maarten": "SXM",
    "Syria": "SYR", "Taiwan": "TWN", "Tanzania": "TZA", "The Bahamas": "BHS", "The Gambia": "GMB", "Turkey": "TUR",
    "United States Virgin Islands": "VIR", "British Virgin Islands": "VGB", "Vatican City": "VAT", "Venezuela": "VEN",
    "Vietnam": "VNM", "Falkland Islands": "FLK", "Saint Helena, Ascension and Tristan da Cunha": "SHN",
    "Curaçao": "CUW", "Northern Cyprus": "_CYN", "Somaliland": "_SOL", "Western Sahara": "ESH", "Wallis and Futuna": "WLF",
    "Congo, Republic of the": "COG", "Congo, Democratic Republic of the": "COD", "São Tomé and Príncipe": "STP",
    "US Virgin Islands": "VIR", "Christmas Island": "_IOT",
    "Pitcairn Islands": "PCN", "Cocos (Keeling) Islands": "CCK", "Sahrawi Arab Democratic Republic": "ESH",
}


def _mains_iso3(name: str) -> str | None:
    if name in MAINS_NAMES:
        return MAINS_NAMES[name]
    if name in NAME_ALIASES:
        return NAME_ALIASES[name]
    try:
        return pycountry.countries.lookup(name).alpha_3
    except LookupError:
        return None


def plug_group(plugs: list[str]) -> int:
    s = set(plugs)
    if s <= {"A", "B"}:
        return PLUG_AB
    if s & {"A", "B"}:
        return PLUG_AB_MIXED
    if s <= {"C", "E", "F"}:
        return PLUG_CEF
    if "G" in s:
        return PLUG_G
    if "I" in s:
        return PLUG_I
    if s & {"D", "M"}:
        return PLUG_DM
    return PLUG_NATIONAL


def power_group(volts: list[int], hertz: list[int]) -> int | None:
    if not volts or not hertz:
        return None
    low = volts[0] <= 130
    if low:
        return POWER_LOW_60 if hertz == [60] else POWER_LOW_50
    return POWER_HIGH_60 if hertz == [60] else POWER_HIGH_50


def _capitals() -> dict[str, tuple[str, float, float, str]]:
    """{ISO3: (首都英文名, 緯度, 經度, IANA 時區)}；同一國有好幾個首都時取人口最多的（玻利維亞拉巴斯、南非普利托利亞…）"""
    path = download(POPULATED_PLACES_URL, "natural-earth", "ne_10m_populated_places.geojson")
    with open(path, encoding="utf-8") as f:
        features = json.load(f)["features"]
    best: dict[str, tuple[float, tuple[str, float, float, str]]] = {}
    for feat in features:
        p = feat["properties"]
        if p["FEATURECLA"] not in ("Admin-0 capital", "Admin-0 capital alt") or not p.get("TIMEZONE"):
            continue
        iso3 = p["ADM0_A3"]
        rank = (p["FEATURECLA"] == "Admin-0 capital") * 1e12 + (p.get("POP_MAX") or 0)
        if iso3 not in best or rank > best[iso3][0]:
            best[iso3] = (rank, (p["NAME"], p["LATITUDE"], p["LONGITUDE"], p["TIMEZONE"]))
    return {k: v for k, (_, v) in best.items()}


def _km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


def _offset_text(h: float) -> str:
    sign = "+" if h >= 0 else "−"
    hours, minutes = int(abs(h)), round((abs(h) % 1) * 60)
    return f"UTC{sign}{hours}" + (f":{minutes:02d}" if minutes else "")


def build() -> None:
    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        countries = json.load(f)
    with open(OUT_DIR / "geo" / "countries-50m.json", encoding="utf-8") as f:
        map_ids = {g["id"] for g in json.load(f)["objects"]["countries"]["geometries"]}
    capitals = _capitals()
    zones = iana_tz.zones_by_country()

    # ── 時差 ──
    tz: dict[str, dict] = {}
    for iso3 in sorted(map_ids | {"TUV", "TKL", "GIB"}):
        iso2 = countries.get(iso3, {}).get("iso2")
        own = zones.get(iso2 or "", [])
        cap = capitals.get(iso3)
        if iso3 in TZ_OVERRIDES:
            zone = TZ_OVERRIDES[iso3]
        elif cap and (not own or cap[3] in {z.name for z in own}):
            zone = cap[3]
        elif own and cap:
            zone = min(own, key=lambda z: _km(cap[1], cap[2], z.lat, z.lon)).name
        elif own:
            zone = own[0].name
        else:
            continue
        std, dst = iana_tz.offsets(zone, YEAR)
        stds = sorted({iana_tz.offsets(z.name, YEAR)[0] for z in own} | {std})
        tz[iso3] = {"zone": zone, "std": std, "dst": dst, "min": stds[0], "max": stds[-1], "n": len(own) or 1}
    missing = sorted(map_ids - set(tz) - {"ATA"})
    if missing:
        print(f"  沒有時區的地圖區域：{missing}")

    def tz_notes(iso3: str) -> tuple[str, str] | None:
        t = tz[iso3]
        parts_zh, parts_en = [], []
        if t["min"] != t["max"]:
            parts_zh.append(
                f"全國的標準時間從 {_offset_text(t['min'])} 到 {_offset_text(t['max'])}"
                f"（比台灣{'慢' if t['min'] < 8 else '快'} {abs(t['min'] - 8):g} 到{'慢' if t['max'] < 8 else '快'} {abs(t['max'] - 8):g} 小時），地圖用首都的時區（{t['zone']}）。"
            )
            parts_en.append(
                f"Standard time ranges from {_offset_text(t['min'])} to {_offset_text(t['max'])} across the country; the map uses the capital's time zone ({t['zone']})."
            )
        if t["dst"] is not None:
            diff = t["dst"] - 8
            parts_zh.append(f"有夏令時間（{_offset_text(t['dst'])}，比台灣{'慢' if diff < 0 else '快'} {abs(diff):g} 小時）。" if diff else f"有夏令時間（{_offset_text(t['dst'])}，跟台灣相同）。")
            parts_en.append(f"Daylight saving time is {_offset_text(t['dst'])}.")
        if not parts_zh:
            return None
        return "".join(parts_zh), " ".join(parts_en)

    diff_values = {iso3: [round(t["std"] - TAIWAN_OFFSET, 2)] for iso3, t in tz.items()}
    notes, notes_en = {}, {}
    for iso3 in tz:
        n = tz_notes(iso3)
        if n:
            notes[iso3], notes_en[iso3] = n
    write_json(OUT / "time-difference.json", indicator_file("time-difference", "小時", [YEAR], diff_values, notes=notes, notesEn=notes_en))

    # ── 行車方向 ──
    driving = wikidata_driving.driving_sides()
    for iso3, side in DRIVING_OVERRIDES.items():
        driving.setdefault(iso3, wikidata_driving.Driving(side))
    drive_values: dict[str, list[float | None]] = {}
    d_notes, d_notes_en = {}, {}
    side_zh = {"L": "靠左", "R": "靠右"}
    side_en = {"L": "left", "R": "right"}
    for iso3, d in driving.items():
        if iso3 not in map_ids and iso3 not in ("TUV", "TKL", "GIB"):
            continue
        drive_values[iso3] = [LEFT if d.side == "L" else RIGHT]
        if d.history:
            d_notes[iso3] = "；".join(f"{y} 年以前{side_zh[s]}行駛" for s, y in d.history) + "（Wikidata）。"
            d_notes_en[iso3] = "; ".join(f"drove on the {side_en[s]} until {y}" for s, y in d.history).capitalize() + " (Wikidata)."
    # 常被問到的幾個國家跟維基百科「Left- and right-hand traffic」核對過（2026-10）；Wikidata 改了就報錯
    expected = {"TWN": RIGHT, "JPN": LEFT, "GBR": LEFT, "HKG": LEFT, "MAC": LEFT, "CHN": RIGHT, "KOR": RIGHT, "THA": LEFT,
                "IND": LEFT, "AUS": LEFT, "NZL": LEFT, "USA": RIGHT, "SWE": RIGHT, "WSM": LEFT, "IDN": LEFT, "SGP": LEFT,
                "MYS": LEFT, "ZAF": LEFT, "IRL": LEFT, "CYP": LEFT, "MLT": LEFT, "MMR": RIGHT, "PHL": RIGHT, "VNM": RIGHT}
    wrong = {k: v for k, v in expected.items() if drive_values.get(k, [None])[0] != v}
    if wrong:
        raise RuntimeError(f"Wikidata 的行車方向跟預期不同：{wrong}")
    write_json(OUT / "driving.json", indicator_file("driving", "", [YEAR], drive_values, notes=d_notes, notesEn=d_notes_en))

    # ── 插頭、電壓與頻率 ──
    mains = wiki_mains.table()
    plugs: dict[str, list[float | None]] = {}
    power: dict[str, list[float | None]] = {}
    details: dict[str, dict] = {}
    unknown = []
    for m in mains:
        iso3 = _mains_iso3(m.name)
        if not iso3:
            unknown.append(m.name)
            continue
        if iso3 not in map_ids and iso3 not in ("TUV", "TKL", "GIB"):
            continue
        plugs[iso3] = [plug_group(m.plugs)]
        g = power_group(m.volts, m.hertz)
        if g:
            power[iso3] = [g]
        details[iso3] = {"plugs": "".join(m.plugs), "volts": m.volts, "hz": m.hertz}
    if unknown:
        print(f"  維基百科表格裡對不到 ISO 代碼的（不畫）：{unknown}")
    write_json(OUT / "plugs.json", indicator_file("plugs", "", [YEAR], plugs))
    write_json(OUT / "power.json", indicator_file("power", "", [YEAR], power))

    # ── 側欄用的明細 ──
    for iso3, t in tz.items():
        details.setdefault(iso3, {})["tz"] = [t["std"], t["dst"], t["min"], t["max"], t["zone"]]
    for iso3, d in driving.items():
        if iso3 in details:
            details[iso3]["drive"] = d.side
    capital_names = {k: v[0] for k, v in capitals.items()}
    for iso3 in details:
        if iso3 in capital_names:
            details[iso3]["capital"] = capital_names[iso3]
    write_json(OUT / "details.json", details)
    write_json(OUT / "manifest.json", {"generatedAt": now_iso(), "tzdata": iana_tz.VERSION, "mainsRevision": wiki_mains.REVISION})

    tw = details["TWN"]
    print(f"  台灣：{tw}；時區 {len(tz)} 國、行車方向 {len(drive_values)}、插頭 {len(plugs)}、電壓 {len(power)}（tzdata {iana_tz.VERSION}）")
    for label, values in (("插頭", plugs), ("電壓", power), ("行車", drive_values)):
        counts: dict[float, int] = {}
        for v in values.values():
            counts[v[0]] = counts.get(v[0], 0) + 1
        print(f"  {label}：{dict(sorted(counts.items()))}")
