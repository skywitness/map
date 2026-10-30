"""旅行實用主題：跟台灣的時差、行車方向、插頭類型、市電電壓與頻率（單一快照，前端 timeless）。

- 時差：IANA 時區資料庫（`sources/iana_tz.py`，tzdata 套件，公有領域）。每個國家用首都所在的時區
  （Natural Earth 1:10m populated places 的 Admin-0 capital 與它的 TIMEZONE 欄位；首都的時區不在那個國家的
  zone.tab 清單裡、或沒有首都的屬地，用 zone.tab 離首都最近的、或第一個時區），算標準時間的 UTC 偏移、有沒有夏令時間；
  地圖的值是「標準時間跟台灣（UTC+8）差幾小時」。跨好幾個時區的國家，附註寫出全國的範圍。
- 行車方向：Wikidata 的 P1622（CC0），改過方向的國家附註寫出年份。
- 插頭、電壓、頻率：英文維基百科「Mains electricity by country」的表格（CC BY-SA 4.0，`sources/wiki_mains.py`），
  地圖上歸成幾類；側欄列出全部的插頭字母、電壓與頻率。衍生的資料檔依 CC BY-SA 4.0 分享。
- 生活格式（一週的第一天、週末、12／24 小時制、日期寫法、小數點、度量衡、紙張、曆法）：Unicode CLDR 49
  （`sources/cldr.py`，Unicode License v3）。依地區給的直接讀 supplementalData.xml；日期寫法與小數點依語言，
  用人口比例最高的官方語言（DESIGN.md 第 8 節第 94 點）。
"""
from __future__ import annotations

import json
import math

import pycountry

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import cldr, iana_tz, wiki_mains, wikidata_driving
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


# ── 生活格式（CLDR）的類別代碼，跟 src/topics/travel.ts 一致 ──
WEEK_START = {"mon": 1, "sun": 2, "sat": 3, "fri": 4}
# 週末：(開始, 結束) → 代碼
WEEKEND = {("sat", "sun"): 1, ("fri", "sat"): 2, ("thu", "fri"): 3, ("fri", "fri"): 4, ("sun", "sun"): 5}
CLOCK_12, CLOCK_24 = 1, 2
DATE_YMD, DATE_DMY, DATE_MDY = 1, 2, 3
DECIMAL = {".": 1, ",": 2, "٫": 3}
MEASURE = {"metric": 1, "US": 2, "UK": 3}
PAPER = {"A4": 1, "US-Letter": 2}
CAL_GREGORIAN, CAL_TAIWAN, CAL_LUNAR, CAL_JAPANESE, CAL_BUDDHIST, CAL_ISLAMIC, CAL_PERSIAN, CAL_OTHER = range(1, 9)

# 地圖上沒有 ISO 代碼的區域，用哪一個 CLDR 地區的值（北賽普勒斯、錫亞琴冰川沒有對應的，不畫）
CLDR_REGION = {"_SOL": "SO", "_IOT": "CX"}
# 日期寫法的例子：日大於 12，看得出日、月的順序；月是個位數，看得出有沒有補 0
EXAMPLE_DATE = (2026, 3, 28)
EXAMPLE_NUMBER = "1234567.89"
DIGITS = {"arab": "٠١٢٣٤٥٦٧٨٩", "arabext": "۰۱۲۳۴۵۶۷۸۹"}


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


def _date_parts(pattern: str) -> list[tuple[str, str]]:
    """短日期格式拆成 [(欄位字母或 "", 字串)]：單引號裡的是原文（保加利亞語的 'г'.），其餘連續的同一個字母是一個欄位。"""
    out, i = [], 0
    while i < len(pattern):
        ch = pattern[i]
        if ch == "'":
            j = pattern.index("'", i + 1)
            out.append(("", pattern[i + 1 : j] or "'"))
            i = j + 1
        elif ch.isalpha():
            j = i
            while j < len(pattern) and pattern[j] == ch:
                j += 1
            out.append((ch, pattern[i:j]))
            i = j
        else:
            out.append(("", ch))
            i += 1
    return out


def date_order(pattern: str) -> int:
    """依 y、M、d 第一次出現的順序歸類：年月日、日月年、月日年（DESIGN.md 第 8 節第 94 點）。"""
    order = "".join(k for k, _ in _date_parts(pattern) if k in "yMd")
    return {"yMd": DATE_YMD, "dMy": DATE_DMY, "Mdy": DATE_MDY}[order]


def _native(text: str, numbers: str) -> str:
    digits = DIGITS.get(numbers)
    return text.translate(str.maketrans("0123456789", digits)) if digits else text


def date_example(pattern: str, numbers: str = "latn") -> str:
    y, m, d = EXAMPLE_DATE
    fields = {"y": lambda n: str(y)[-2:] if n == 2 else str(y), "M": lambda n: f"{m:0{n}d}", "d": lambda n: f"{d:0{n}d}"}
    out = []
    for k, text in _date_parts(pattern):
        if k in fields:
            out.append(fields[k](len(text)))
        elif k:
            raise ValueError(f"短日期格式有沒處理的欄位 {text}：{pattern}")
        else:
            out.append(text)
    return _native("".join(out), numbers)


def number_example(pattern: str, decimal: str, group: str, numbers: str = "latn") -> str:
    """1234567.89 照那個語言的千分位分組（印度的 #,##,##0 是 12,34,567）與符號寫出來。"""
    integer = pattern.split(";")[0].split(".")[0]
    groups = integer.split(",")
    primary = len(groups[-1]) if len(groups) > 1 else 0
    secondary = len(groups[-2]) if len(groups) > 2 else primary
    whole, frac = EXAMPLE_NUMBER.split(".")
    parts = []
    if primary:
        parts.insert(0, whole[-primary:])
        whole = whole[:-primary]
        while whole:
            parts.insert(0, whole[-secondary:])
            whole = whole[:-secondary]
    else:
        parts = [whole]
    return _native(group.join(parts) + decimal + frac, numbers)


def calendar_group(ordering: list[str]) -> int:
    """依 CLDR 的排列（常用的在前）：第一個不是西曆的就是主要曆法（伊朗是波斯曆、泰國是佛曆），
    否則依第二個（以色列的希伯來曆排在伊斯蘭曆前面、埃及的科普特曆也是，都算「其他傳統曆法」）。"""
    if "roc" in ordering:
        return CAL_TAIWAN
    if ordering[0] == "persian":
        return CAL_PERSIAN
    if ordering[0] == "buddhist":
        return CAL_BUDDHIST
    if len(ordering) == 1:
        return CAL_GREGORIAN
    second = ordering[1]
    if second.startswith("islamic"):
        return CAL_ISLAMIC
    if second in ("chinese", "dangi"):
        return CAL_LUNAR
    if second == "japanese":
        return CAL_JAPANESE
    return CAL_OTHER


# 曆法的名稱（伊斯蘭曆的幾種算法合併成一個名稱）
CALENDAR_NAMES = {
    "gregorian": ("西曆", "Gregorian"),
    "roc": ("民國紀年", "Minguo (ROC)"),
    "chinese": ("農曆", "Chinese lunisolar"),
    "dangi": ("韓國農曆（檀紀）", "Korean lunisolar (Dangi)"),
    "japanese": ("日本年號", "Japanese era"),
    "buddhist": ("佛曆", "Buddhist"),
    "islamic": ("伊斯蘭曆", "Islamic (Hijri)"),
    "islamic-umalqura": ("伊斯蘭曆（烏姆庫拉曆）", "Islamic (Umm al-Qura)"),
    "persian": ("波斯曆（太陽曆）", "Persian (Solar Hijri)"),
    "coptic": ("科普特曆", "Coptic"),
    "ethiopic": ("衣索比亞曆", "Ethiopian"),
    "hebrew": ("希伯來曆", "Hebrew"),
    "indian": ("印度國定曆", "Indian national"),
}


def _calendar_names(ordering: list[str]) -> tuple[list[str], list[str]]:
    """依常用的程度列出曆法名稱；伊斯蘭曆的好幾種算法（civil、tbla、rgsa）只列一次，烏姆庫拉曆優先。"""
    zh, en = [], []
    for c in ordering:
        key = c if c in CALENDAR_NAMES else ("islamic" if c.startswith("islamic") else c)
        if key == "islamic" and any(n.startswith("伊斯蘭曆") for n in zh):
            continue
        z, e = CALENDAR_NAMES[key]
        if z not in zh:
            zh.append(z)
            en.append(e)
    return zh, en


def _formats(map_ids: set[str], countries: dict) -> tuple[dict[str, dict], dict]:
    """生活格式：{ISO3: 側欄用的明細}，與各指標的 (values, notes, notesEn, hints, hintsEn)。"""
    week, measure, hours, calendars = cldr.week_data(), cldr.measurement_data(), cldr.time_data(), cldr.calendar_preference()
    languages = cldr.territories()
    lang_names = cldr.names()

    def lang_name(code: str) -> tuple[str, str]:
        for c in (code, code.split("_")[0]):
            if c in lang_names and lang_names[c][0]:
                return lang_names[c][0], lang_names[c][1]
        raise KeyError(f"CLDR 沒有語言名稱：{code}")

    # 「語言_地區」的 12／24 小時制（gu_IN、fr_CA…）：跟地區本身不同的寫進附註
    lang_hours: dict[str, list[tuple[str, str]]] = {}
    for code, (pref, _) in hours.items():
        if "_" in code:
            lang, region = code.rsplit("_", 1)
            lang_hours.setdefault(region, []).append((lang, pref))

    names = ["week-start", "weekend", "clock", "date-format", "decimal", "measurement", "paper", "calendar"]
    out = {n: ({}, {}, {}, {}, {}) for n in names}  # values, notes, notesEn, hints, hintsEn
    details: dict[str, dict] = {}
    official = {"official", "de_facto_official"}
    for iso3 in sorted(map_ids | {"TUV", "TKL", "GIB"}):
        region = CLDR_REGION.get(iso3) or countries.get(iso3, {}).get("iso2")
        if not region:
            continue
        get = lambda table, key=None: (table.get(region) or table["001"]) if key is None else (table.get(region, {}).get(key) or table["001"][key])  # noqa: E731
        d: dict = {}

        first, ws, we = get(week, "first"), get(week, "weekendStart"), get(week, "weekendEnd")
        out["week-start"][0][iso3] = [WEEK_START[first]]
        out["weekend"][0][iso3] = [WEEKEND[(ws, we)]]
        d["week"] = [first, ws, we]

        pref = get(hours)[0]
        out["clock"][0][iso3] = [CLOCK_12 if pref == "h" else CLOCK_24]
        d["clock"] = pref
        diffs = [(lang, p) for lang, p in lang_hours.get(region, []) if p != pref]
        if diffs:
            zh = "、".join(f"{lang_name(lang)[0]}的使用者偏好 {'12' if p == 'h' else '24'} 小時制" for lang, p in diffs)
            en = "; ".join(f"{lang_name(lang)[1]} speakers prefer the {'12' if p == 'h' else '24'}-hour clock" for lang, p in diffs)
            out["clock"][1][iso3] = f"CLDR 另外記錄：{zh}。"
            out["clock"][2][iso3] = f"CLDR also records: {en}."

        m = measure.get(region, {})
        system = m.get("system", "metric")
        out["measurement"][0][iso3] = [MEASURE[system]]
        temp = m.get("temperature")
        d["measure"] = [system, temp]
        if temp and temp != system:
            zh_t = "攝氏" if temp == "metric" else "華氏"
            en_t = "Celsius" if temp == "metric" else "Fahrenheit"
            out["measurement"][1][iso3] = f"溫度用{zh_t}。"
            out["measurement"][2][iso3] = f"Temperatures are in {en_t}."
            out["measurement"][3][iso3] = f"溫度用{zh_t}"
            out["measurement"][4][iso3] = f"Temperatures in {en_t}"
        paper = m.get("paper", "A4")
        out["paper"][0][iso3] = [PAPER[paper]]
        d["paper"] = paper

        cal = get(calendars)
        out["calendar"][0][iso3] = [calendar_group(cal)]
        d["calendar"] = cal
        cz, ce = _calendar_names(cal)
        if len(cz) > 1:
            out["calendar"][3][iso3] = "、".join(cz)
            out["calendar"][4][iso3] = ", ".join(ce)

        # 依語言給的：人口比例最高的官方語言；CLDR 收錄得太少（沒有這個語言檔、短日期格式只有 root 的預設值）的，
        # 依序改用人口比例次高的官方語言（DESIGN.md 第 8 節第 94 點）
        info = languages.get(iso3) or languages.get({"_SOL": "SOM", "_IOT": "CXR"}.get(iso3, ""))
        if info:
            ranked = sorted(info["languages"], key=lambda l: -l[1])
            candidates = [l for l in ranked if l[2] in official] or ranked
            skipped = []
            for lang, _, _ in candidates:
                f = cldr.locale_formats(f"{lang}_{region}")
                if f and f["ownDate"]:
                    break
                skipped.append(lang)
            else:
                f = None
            if f:
                zh_lang, en_lang = lang_name(lang)
                date_ex = date_example(f["date"], f["numbers"])
                num_ex = number_example(f["pattern"], f["decimal"], f["group"], f["numbers"])
                out["date-format"][0][iso3] = [date_order(f["date"])]
                out["decimal"][0][iso3] = [DECIMAL[f["decimal"]]]
                d["date"] = [f["date"], date_ex]
                d["number"] = [f["decimal"], f["group"], num_ex]
                d["lang"] = [zh_lang, en_lang]
                out["date-format"][3][iso3] = f"依{zh_lang}：{date_ex}（{EXAMPLE_DATE[0]} 年 {EXAMPLE_DATE[1]} 月 {EXAMPLE_DATE[2]} 日）"
                out["date-format"][4][iso3] = f"Based on {en_lang}: {date_ex} (28 March 2026)"
                out["decimal"][3][iso3] = f"依{zh_lang}：{num_ex}"
                out["decimal"][4][iso3] = f"Based on {en_lang}: {num_ex}"
                if skipped:
                    sz = "、".join(lang_name(c)[0] for c in skipped)
                    se = ", ".join(lang_name(c)[1] for c in skipped)
                    for key in ("date-format", "decimal"):
                        out[key][1][iso3] = f"CLDR 沒有{sz}的日期寫法，改用人口比例次高的官方語言{zh_lang}。"
                        out[key][2][iso3] = f"CLDR has no date format for {se}, so {en_lang}, the next most widely spoken official language, is used."
        details[iso3] = d
    return details, out


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

    # 夏令時間規則的例外（tzdata 2026f，2026-10-27：古巴 2026-11-01 不改回 UTC−5）
    dst_extra = {
        "CUB": ("2026 年 11 月 1 日起不改回冬令時間，維持 UTC−4 到 2027 年 11 月 7 日（IANA tzdata 2026f）。",
                "From 1 November 2026 Cuba stays on UTC−4 until 7 November 2027 instead of returning to standard time (IANA tzdata 2026f)."),
    }

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
        if iso3 in dst_extra:
            parts_zh.append(dst_extra[iso3][0])
            parts_en.append(dst_extra[iso3][1])
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

    # ── 生活格式（CLDR） ──
    formats, fmt_files = _formats(map_ids, countries)
    for name, (values, f_notes, f_notes_en, hints, hints_en) in fmt_files.items():
        extra = {k: v for k, v in (("notes", f_notes), ("notesEn", f_notes_en), ("hints", hints), ("hintsEn", hints_en)) if v}
        write_json(OUT / f"{name}.json", indicator_file(name, "", [YEAR], values, **extra))

    # ── 側欄用的明細 ──
    for iso3, t in tz.items():
        details.setdefault(iso3, {})["tz"] = [t["std"], t["dst"], t["min"], t["max"], t["zone"]]
    for iso3, d in driving.items():
        if iso3 in details:
            details[iso3]["drive"] = d.side
    for iso3, d in formats.items():
        details.setdefault(iso3, {})["fmt"] = d
    capital_names = {k: v[0] for k, v in capitals.items()}
    for iso3 in details:
        if iso3 in capital_names:
            details[iso3]["capital"] = capital_names[iso3]
    write_json(OUT / "details.json", details)
    write_json(OUT / "manifest.json", {"generatedAt": now_iso(), "tzdata": iana_tz.VERSION, "mainsRevision": wiki_mains.REVISION, "cldr": cldr.VERSION})

    tw = details["TWN"]
    print(f"  台灣：{tw}；時區 {len(tz)} 國、行車方向 {len(drive_values)}、插頭 {len(plugs)}、電壓 {len(power)}（tzdata {iana_tz.VERSION}）")
    print(f"  台灣的生活格式：{formats['TWN']}")
    checks = {"TWN": ("sun", "h", "y/M/d", ".", "metric", "A4"), "USA": ("sun", "h", "M/d/yy", ".", "US", "US-Letter"),
              "GBR": ("mon", "H", "dd/MM/y", ".", "UK", "A4"), "DEU": ("mon", "H", "dd.MM.yy", ",", "metric", "A4"),
              "JPN": ("sun", "H", "y/MM/dd", ".", "metric", "A4"), "LBR": ("mon", "h", "dd/MM/y", ".", "US", "A4")}
    for iso3, want in checks.items():
        f = formats[iso3]
        got = (f["week"][0], f["clock"], f["date"][0], f["number"][0], f["measure"][0], f["paper"])
        if got != want:
            raise RuntimeError(f"CLDR 的生活格式跟預期不同：{iso3} {got} ≠ {want}")
    fmt_values = {name: v[0] for name, v in fmt_files.items()}
    for label, values in (("插頭", plugs), ("電壓", power), ("行車", drive_values), *fmt_values.items()):
        counts: dict[float, int] = {}
        for v in values.values():
            counts[v[0]] = counts.get(v[0], 0) + 1
        print(f"  {label}：{dict(sorted(counts.items()))}")
