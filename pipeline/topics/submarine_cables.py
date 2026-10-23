"""海底電纜主題：TeleGeography Submarine Cable Map（CC BY-NC-SA 3.0，見 sources/telegeography.py）。

地圖上的疊加圖層：
- cables.json：電纜路線（`lines_file()`，每條線一筆屬性：名稱、啟用年份、長度、擁有者），依「營運中／規劃中」分類。
  同一條電纜在 TeleGeography 是好幾段（MultiLineString，跨 180° 經線的也切開），首尾相接的段接成一條線，
  經度展開成連續的（可以超過 ±180）；分岔的支線仍是另外一條線。
- landing-points.json：登陸點（`points_file()`，有 iso3，滑過標出國家、點一下選取）。

國家統計（`indicator_file()`，每年年底累計）：
- cables.json（「海底電纜地圖」與「登陸的電纜數」共用）：有登陸點在這個國家的不同電纜數。
- partners.json（國際連線數）：經由電纜直接連到的其他國家數（同一條電纜登陸的國家兩兩都算連到）。
- landings.json（登陸點數）：有電纜登陸的地點數。

**時間**：用 TeleGeography 的 RFS（ready for service）年份累計。TeleGeography 只收「營運中與規劃中」的電纜，
已經退役的（例如 TAT-8、TPC-3）不在裡面，所以早期的數字偏少，只代表「今天還在用的電纜是哪一年啟用的」。
- 今年（資料下載的那一年）是「現在已經啟用的電纜」：營運中的電纜依 RFS 年份算。
- 規劃中的電纜（`is_planned`）從明年起依預計啟用年份算進去（預計今年底前啟用、或預定年份已過但還沒啟用的，算在明年），
  明年起標成推估（`projectionFrom`），說明寫「規劃中」。
- 沒有 RFS 年份的：營運中的算在今年（只知道現在有、不知道哪一年啟用），規劃中的算在最後一年。

**國家**：登陸點的國家是 TeleGeography 明細裡的英文國名，屬地照自己的 ISO 代碼（關島 GUM、法屬玻里尼西亞 PYF、
留尼旺 REU…）；COUNTRY_NAMES 對照 pycountry 查不到或會查錯的寫法，對不上就報錯。
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date

from common import OUT_DIR, ROOT, indicator_file, lines_file, now_iso, points_file, write_json
from sources import telegeography
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "submarine-cables"
THIS_YEAR = date.today().year
IN_SERVICE, PLANNED = 1, 2  # 線的分類代碼，跟 src/topics/submarine-cables.ts 的 CABLE_TYPES 一致
QUANTUM = 0.01  # 座標量化（度），約 1 公里
OWNERS_SHOWN = 4  # 線的屬性只放前幾個擁有者（tooltip 用），完整的清單在側欄的國家檔裡

# TeleGeography 的英文國名 → ISO alpha-3（pycountry 查不到、或模糊比對會配錯的）
COUNTRY_NAMES = {
    "Congo, Dem. Rep.": "COD",
    "Congo, Rep.": "COG",
    "Côte d'Ivoire": "CIV",
    "Korea, Rep.": "KOR",
    "Korea, Dem. People's Rep.": "PRK",
    "Taiwan": "TWN",
    "China": "CHN",
    "Hong Kong": "HKG",
    "Macao": "MAC",
    "Russia": "RUS",
    "Iran": "IRN",
    "Syria": "SYR",
    "Turkey": "TUR",
    "Türkiye": "TUR",
    "Vietnam": "VNM",
    "Brunei": "BRN",
    "Micronesia": "FSM",
    "Virgin Islands (U.K.)": "VGB",
    "Virgin Islands (U.S.)": "VIR",
    "Bonaire, Sint Eustatius and Saba": "BES",
    "Saint Martin": "MAF",
    "Sint Maarten": "SXM",
    "Curaçao": "CUW",
    "Réunion": "REU",
    "Saint Barthélemy": "BLM",
    "Saint Helena, Ascension and Tristan da Cunha": "SHN",
    "Falkland Islands": "FLK",
    "Faroe Islands": "FRO",
    "Svalbard": "SJM",
    "Svalbard and Jan Mayen": "SJM",
    "Cape Verde": "CPV",
    "Cabo Verde": "CPV",
    "Gambia": "GMB",
    "Bahamas": "BHS",
    "Laos": "LAO",
    "Palestine": "PSE",
    "Timor-Leste": "TLS",
    "East Timor": "TLS",
    "Sao Tome and Principe": "STP",
    "São Tomé and Príncipe": "STP",
    "Wallis and Futuna": "WLF",
    "Northern Mariana Islands": "MNP",
    "American Samoa": "ASM",
    "Guam": "GUM",
    "French Polynesia": "PYF",
    "New Caledonia": "NCL",
    "Saint Pierre and Miquelon": "SPM",
    "Turks and Caicos Islands": "TCA",
    "Cayman Islands": "CYM",
    "Anguilla": "AIA",
    "Montserrat": "MSR",
    "Bermuda": "BMU",
    "Greenland": "GRL",
    "Guernsey": "GGY",
    "Jersey": "JEY",
    "Isle of Man": "IMN",
    "Gibraltar": "GIB",
    "Mayotte": "MYT",
    "Guadeloupe": "GLP",
    "Martinique": "MTQ",
    "French Guiana": "GUF",
    # 聖誕島與科科斯群島在地圖上是同一個形狀「澳屬印度洋領地」（build_geo.py 的 _IOT），算在那裡才看得到
    "Christmas Island": "_IOT",
    "Cocos (Keeling) Islands": "_IOT",
    "Norfolk Island": "NFK",
    "Cook Islands": "COK",
    "Niue": "NIU",
    "Tokelau": "TKL",
    "Tuvalu": "TUV",
    "Netherlands": "NLD",
    "United States": "USA",
    "United Kingdom": "GBR",
    "Moldova": "MDA",
    "Tanzania": "TZA",
    "Venezuela": "VEN",
    "Bolivia": "BOL",
    "Eswatini": "SWZ",
    "Kosovo": "XKX",
    "Somaliland": "_SOL",
    "Sudan": "SDN",
    "South Sudan": "SSD",
}

# 地圖上併在本國形狀裡、但電纜依自己的 ISO 代碼計算的海外地區（1:50m 國界沒有它們自己的形狀，DESIGN.md §8 第 8 點）
SOVEREIGNS = {"FRA": ("法國", "France"), "NLD": ("荷蘭", "the Netherlands")}
MERGED_IN = {
    "GLP": ("FRA", "瓜地洛普", "Guadeloupe"),
    "GUF": ("FRA", "法屬圭亞那", "French Guiana"),
    "MTQ": ("FRA", "馬丁尼克", "Martinique"),
    "MYT": ("FRA", "馬約特", "Mayotte"),
    "REU": ("FRA", "留尼旺", "Réunion"),
    "BES": ("NLD", "荷蘭加勒比區（波奈、聖佑達修斯、沙巴）", "the Caribbean Netherlands (Bonaire, Sint Eustatius and Saba)"),
}

# 台灣的交叉比對：中央社 2025-01-10〈海纜安全危機4／台灣成海纜樞紐 中華電信強化韌性備援多路齊發〉
# （https://www.cna.com.tw/news/aipl/202501100035.aspx ，數字來自中華電信與數位發展部）寫台灣聯外海纜約 14 條，
# 提到 SJC2、Apricot、APCN2、FNAL/RNAL、EAC、C2C、CSCN、TSE-1、TPE、APG、FASTER、NCP，未來還有 TPU、ORCA；
# 國內海纜 10 條（台馬、台金、台澎、澎金各兩條），都由中華電信投資維護。只引用事實，不轉載內容。
# 這裡列出這些電纜在 TeleGeography 的 id，資料管線每次都檢查，名單變了（新增、改名、下架）會印出來。
TAIWAN_EXPECTED = {
    "SJC2": "southeast-asia-japan-cable-2-sjc2",
    "Apricot": "apricot",
    "APCN-2": "apcn-2",
    "FNAL/RNAL": "flag-north-asia-loopreach-north-asia-loop",
    "EAC-C2C": "eac-c2c",
    "CSCN": "cross-straits-cable-network-cscn",
    "TSE-1": "taiwan-strait-express-1-tse-1",
    "TPE": "trans-pacific-express-tpe-cable-system",
    "APG": "asia-pacific-gateway-apg",
    "FASTER": "faster",
    "NCP": "new-cross-pacific-ncp-cable-system",
    "PLCN": "pacific-light-cable-network-plcn",
    "TPU": "tpu",
    "ORCA": "orca",
    "E2A": "e2a",
}
# 1999 年啟用、曾在台灣登陸的 SEA-ME-WE 3 不在 TeleGeography 現在的清單裡（all.json 只有 SeaMeWe-4、5、6）
TAIWAN_ABSENT = {"SEA-ME-WE 3": "seamewe-3"}


def _iso3(country: str, where: str) -> str:
    code = COUNTRY_NAMES.get(country) or from_name(country)
    if not code:
        raise RuntimeError(f"{where} 的國家「{country}」對不到 ISO 代碼，要加進 COUNTRY_NAMES")
    return code


# ── 路線：展開跨 180° 經線、把首尾相接的段接起來 ─────────────────────────
def _unwrap(part: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """經度展開成連續的：跟前一個點的經度差超過 180° 時改成另一側的寫法（可以超過 ±180）。"""
    out = [part[0]]
    for x, y in part[1:]:
        px = out[-1][0]
        out.append((x + 360 * round((px - x) / 360), y))
    return out


JOIN_TOLERANCE = 0.05  # 度：TeleGeography 在 180° 經線切開的兩段，端點不一定完全一樣（TPU 是 179.9999 與 −179.9768）


def _near(p: tuple[float, float], q: tuple[float, float]) -> bool:
    """兩個端點是不是同一點：經度差先換到 −180–180（±180 是同一條經線）"""
    dx = (p[0] - q[0] + 180) % 360 - 180
    return abs(dx) <= JOIN_TOLERANCE and abs(p[1] - q[1]) <= JOIN_TOLERANCE


def _shifted(part: list[tuple[float, float]], to: tuple[float, float], at: tuple[float, float]) -> list[tuple[float, float]]:
    """把 part 平移 360° 的倍數，讓它的點 at 跟 to 在同一側"""
    dx = 360 * round((to[0] - at[0]) / 360)
    return [(x + dx, y) for x, y in part] if dx else part


def _stitch(parts: list[list[tuple[float, float]]]) -> list[list[tuple[float, float]]]:
    """首尾相接、而且接點只有這兩段的線段接成一條（分岔點有三段以上，不接）。
    跨 180° 經線被切開的線也是這樣接回來，後面那段平移 360°，整條線的經度是連續的。"""
    parts = [p for p in (_unwrap(p) for p in parts) if len(p) >= 2]
    while True:
        ends = [p[e] for p in parts for e in (0, -1)]
        degree = lambda pt: sum(_near(pt, q) for q in ends)  # noqa: E731
        done = True
        for i in range(len(parts)):
            for j in range(i + 1, len(parts)):
                a, b = parts[i], parts[j]
                for ea in (-1, 0):
                    for eb in (0, -1):
                        if not _near(a[ea], b[eb]) or degree(a[ea]) != 2:
                            continue
                        # 都轉成 a 的尾接 b 的頭
                        aa = a if ea == -1 else a[::-1]
                        bb = b if eb == 0 else b[::-1]
                        bb = _shifted(bb, aa[-1], bb[0])
                        parts[i] = aa + bb[1:]
                        del parts[j]
                        done = False
                        break
                    if not done:
                        break
                if not done:
                    break
            if not done:
                break
        if done:
            return parts


# ── 年份 ─────────────────────────────────────────
def _effective_year(c: telegeography.Cable, last_year: int) -> int:
    """這條電纜從哪一年年底起算進統計與地圖（見檔頭的「時間」）"""
    if not c.planned:
        return min(c.rfs_year, THIS_YEAR) if c.rfs_year else THIS_YEAR
    if c.rfs_year:
        return max(c.rfs_year, THIS_YEAR + 1)
    return last_year


def _quantized_points(line: list[tuple[float, float]]) -> int:
    """跟 common.lines_file() 一樣量化、去掉連續重複的點之後剩幾個點"""
    q = [(round(x / QUANTUM), round(y / QUANTUM)) for x, y in line]
    return sum(1 for j, p in enumerate(q) if j == 0 or p != q[j - 1])


def _place(name: str, country: str) -> str:
    """登陸點名稱去掉結尾的國名（「Toucheng, Taiwan」→「Toucheng」）；國名寫法不同的（「Kralendijk, Bonaire, Netherlands」）不動"""
    suffix = f", {country}"
    return name[: -len(suffix)] if country and name.endswith(suffix) and len(name) > len(suffix) else name


def _owners_short(owners: list[str]) -> str:
    return ", ".join(owners[:OWNERS_SHOWN])


def build() -> None:
    cables = telegeography.cables()
    points = telegeography.landing_points()
    print(f"  {len(cables)} 條電纜、{len(points)} 個登陸點")

    # ── 每條電纜登陸的國家 ──
    landing_country: dict[str, str] = {}
    cable_countries: dict[str, list[str]] = {}
    for c in cables:
        isos = []
        for lp_id, lp_name, country in c.landings:
            iso = _iso3(country, f"{c.name} 的登陸點 {lp_name}")
            if landing_country.setdefault(lp_id, iso) != iso:
                raise RuntimeError(f"登陸點 {lp_name} 在不同電纜裡的國家不一樣：{landing_country[lp_id]}、{iso}")
            if iso not in isos:
                isos.append(iso)
        cable_countries[c.id] = isos

    # ── 年份 ──
    planned_years = [c.rfs_year for c in cables if c.planned and c.rfs_year]
    last_year = max(THIS_YEAR + 1, max(planned_years, default=THIS_YEAR + 1))
    year_of = {c.id: _effective_year(c, last_year) for c in cables}
    first_year = min(year_of.values())
    years = list(range(first_year, last_year + 1))
    no_rfs = [c for c in cables if not c.rfs_year]
    late_planned = [c for c in cables if c.planned and c.rfs_year and c.rfs_year <= THIS_YEAR]
    future_active = [c for c in cables if not c.planned and c.rfs_year and c.rfs_year > THIS_YEAR]
    print(
        f"  年份 {first_year}–{last_year}；規劃中 {sum(c.planned for c in cables)} 條"
        f"（預定今年或更早、還沒啟用 {len(late_planned)} 條，算在 {THIS_YEAR + 1} 年）；"
        f"沒有 RFS 年份 {len(no_rfs)} 條（營運中 {sum(not c.planned for c in no_rfs)}、規劃中 {sum(c.planned for c in no_rfs)}）；"
        f"營運中但 RFS 在今年以後 {len(future_active)} 條"
    )

    # ── 國家統計 ──
    all_countries = sorted({iso for isos in cable_countries.values() for iso in isos})
    geo = json.loads((ROOT / "public" / "data" / "geo" / "countries-50m.json").read_text(encoding="utf-8"))
    shapes = {g["id"] for g in next(iter(geo["objects"].values()))["geometries"] if g.get("id")}
    # 地圖上的國家都列（沒有電纜的是 0），自訂代碼（_SIA 錫亞琴冰川等）只列有電纜的
    countries = sorted(set(all_countries) | {iso for iso in shapes if not iso.startswith("_")})
    shapeless = sorted(set(all_countries) - shapes)
    print(f"  有電纜登陸的國家／地區 {len(all_countries)} 個；地圖上沒有形狀的：{', '.join(shapeless)}")

    # 登陸點：最早那條電纜的年份
    lp_cables: dict[str, list[str]] = defaultdict(list)
    for c in cables:
        for lp_id, _, _ in c.landings:
            if c.id not in lp_cables[lp_id]:
                lp_cables[lp_id].append(c.id)
    lp_year = {lp: min(year_of[cid] for cid in cids) for lp, cids in lp_cables.items()}

    n_cables: dict[str, list[float | None]] = {}
    n_partners: dict[str, list[float | None]] = {}
    n_landings: dict[str, list[float | None]] = {}
    by_country = defaultdict(list)
    for c in cables:
        for iso in cable_countries[c.id]:
            by_country[iso].append(c)
    lps_by_country = defaultdict(list)
    for lp, iso in landing_country.items():
        lps_by_country[iso].append(lp)
    for iso in countries:
        mine = by_country.get(iso, [])
        n_cables[iso] = [sum(year_of[c.id] <= y for c in mine) for y in years]
        n_partners[iso] = [
            len({p for c in mine if year_of[c.id] <= y for p in cable_countries[c.id] if p != iso}) for y in years
        ]
        n_landings[iso] = [sum(lp_year[lp] <= y for lp in lps_by_country.get(iso, [])) for y in years]
    world_cables = [sum(year_of[c.id] <= y for c in cables) for y in years]
    world_landings = [sum(v <= y for v in lp_year.values()) for y in years]

    # 附註：台灣，以及地圖上併在本國形狀裡的海外地區
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    tw_note, tw_note_en = _taiwan_check(cables, cable_countries, year_of)
    notes["TWN"], notes_en["TWN"] = tw_note, tw_note_en
    for sovereign, (sov_zh, sov_en) in SOVEREIGNS.items():
        parts = [(code, zh, en) for code, (sov, zh, en) in MERGED_IN.items() if sov == sovereign and code in all_countries]
        if not parts:
            continue
        for code, zh, en in parts:
            notes[code] = f"地圖上{zh}併在{sov_zh}的形狀裡；電纜依 ISO 代碼分開算，{sov_zh}的數字不含這裡。"
            notes_en[code] = f"On the map {en} is part of the shape of {sov_en}; cables are counted by ISO code, so the figures for {sov_en} exclude it."
        notes[sovereign] = f"不含{'、'.join(zh for _, zh, _ in parts)}：這些地區另外計算（地圖上併在{sov_zh}的形狀裡）。"
        notes_en[sovereign] = f"Excludes {', '.join(en for _, _, en in parts)}, which are counted separately (on the map they are part of the shape of {sov_en})."
    extra = {"projectionFrom": THIS_YEAR + 1, "notes": notes, "notesEn": notes_en}
    write_json(OUT / "cables.json", indicator_file("cables", "條", years, n_cables, aggregates={"WLD": world_cables}, **extra))
    write_json(OUT / "partners.json", indicator_file("partners", "國", years, n_partners, **extra))
    write_json(OUT / "landings.json", indicator_file("landings", "處", years, n_landings, aggregates={"WLD": world_landings}, **extra))

    # ── 疊加圖層：電纜路線 ──
    lines: list[list[tuple[float, float]]] = []
    types: list[int] = []
    rows: list[dict[str, object]] = []
    order = sorted(cables, key=lambda c: (year_of[c.id], c.name.lower()))
    vertices = 0
    for c in order:
        for line in _stitch(c.parts):
            lines.append(line)
            types.append(PLANNED if c.planned else IN_SERVICE)
            vertices += len(line)
            rows.append({
                "name": c.name,
                "year": year_of[c.id],
                "rfs": c.rfs_year,
                "plan": 1 if c.planned else 0,
                "len": round(c.length_km) if c.length_km else None,
                "own": _owners_short(c.owners) or None,
                "nown": len(c.owners) or None,
            })
    parts_in = sum(len(c.parts) for c in cables)
    print(f"  路線：{parts_in} 段接成 {len(lines)} 條線、{vertices} 個頂點")
    # 量化後不到 2 個點的線（很短的支線）先拿掉，屬性才會跟線一一對應
    keep = [i for i, line in enumerate(lines) if _quantized_points(line) >= 2]
    if len(keep) < len(lines):
        print(f"  量化後太短、不畫的線：{len(lines) - len(keep)} 條（{', '.join(sorted({rows[i]['name'] for i in range(len(lines)) if i not in set(keep)}))}）")
    lines = [lines[i] for i in keep]
    types = [types[i] for i in keep]
    rows = [rows[i] for i in keep]
    fields = ["name", "year", "rfs", "plan", "len", "own", "nown"]
    scale = {"year": 1, "rfs": 1, "plan": 1, "len": 1, "nown": 1}
    data = lines_file(lines, quantum=QUANTUM, types=types)
    data["records"] = points_file(rows, fields, scale, delta=("year",))
    if len(data["lines"]) != len(rows):
        raise RuntimeError("線與屬性的筆數對不上")
    write_json(OUT / "cables-lines.json", data)

    # ── 疊加圖層：登陸點 ──
    lp_country_name = {lp_id: country for c in cables for lp_id, _, country in c.landings}
    lp_rows = []
    for lp_id, cids in lp_cables.items():
        p = points.get(lp_id)
        if p is None:
            raise RuntimeError(f"登陸點 {lp_id} 不在 landing-point-geo.json 裡")
        planned = sum(1 for cid in cids if next(c for c in cables if c.id == cid).planned)
        lp_rows.append({
            "lon": p.lon, "lat": p.lat, "iso3": landing_country[lp_id], "name": _place(p.name, lp_country_name[lp_id]),
            "year": lp_year[lp_id], "n": len(cids), "np": planned or None, "tbd": 1 if p.tbd else None,
        })
    lp_rows.sort(key=lambda r: (r["lon"], r["lat"]))
    unused = len(points) - len(lp_rows)
    print(f"  登陸點：{len(lp_rows)} 個有電纜（{unused} 個沒有任何電纜用到，不畫）；位置未定（TBD）{sum(1 for r in lp_rows if r['tbd'])} 個")
    write_json(
        OUT / "landing-points.json",
        points_file(
            lp_rows,
            ["lon", "lat", "iso3", "name", "year", "n", "np", "tbd"],
            {"lon": 0.01, "lat": 0.01, "year": 1, "n": 1, "np": 1, "tbd": 1},
            delta=("lon",),
        ),
    )

    # ── 側欄：每個國家登陸的電纜 ──
    # [名稱, RFS 年份, 地圖上的年份, 長度（km）, 擁有者（逗號分隔）, 規劃中, 這國的登陸點名稱, 連到的其他國家]
    lp_name = {lp_id: _place(name, country) for c in cables for lp_id, name, country in c.landings}
    for stale in (OUT / "countries").glob("*.json"):  # 國家代碼改過（例如聖誕島改算 _IOT）時，舊的檔不留
        stale.unlink()
    for iso, mine in by_country.items():
        rows_out = []
        for c in sorted(mine, key=lambda c: (-year_of[c.id], c.name.lower())):
            here = [lp_name[lp] for lp in lp_cables_order(c) if landing_country[lp] == iso]
            rows_out.append([
                c.name,
                c.rfs_year,
                year_of[c.id],
                round(c.length_km) if c.length_km else None,
                ", ".join(c.owners),
                1 if c.planned else 0,
                here,
                [p for p in cable_countries[c.id] if p != iso],
            ])
        write_json(OUT / "countries" / f"{iso}.json", {"cables": rows_out}, quiet=True)
    write_json(OUT / "countries" / "index.json", sorted(by_country))

    write_json(OUT / "manifest.json", {
        "topic": "submarine-cables",
        "generatedAt": now_iso(),
        "source": "TeleGeography Submarine Cable Map (CC BY-NC-SA 3.0)",
        "cables": len(cables),
        "landingPoints": len(lp_rows),
        "years": [first_year, last_year],
    })

    # ── 檢查用的數字 ──
    last = {iso: s[years.index(THIS_YEAR)] for iso, s in n_cables.items()}
    top = sorted(((v, k) for k, v in last.items() if v), reverse=True)[:10]
    print(f"  {THIS_YEAR} 年登陸的電纜數前 10：" + "、".join(f"{k} {v}" for v, k in top))
    lastp = {iso: s[years.index(THIS_YEAR)] for iso, s in n_partners.items()}
    topp = sorted(((v, k) for k, v in lastp.items() if v), reverse=True)[:10]
    print(f"  {THIS_YEAR} 年國際連線數前 10：" + "、".join(f"{k} {v}" for v, k in topp))
    print(f"  分布（國際連線數）：{sorted(Counter(lastp.values()).items())}")
    print(f"  台灣：{last.get('TWN')} 條電纜、連到 {lastp.get('TWN')} 國；最後一年 {n_cables['TWN'][-1]} 條")


def lp_cables_order(c: telegeography.Cable) -> list[str]:
    seen: list[str] = []
    for lp_id, _, _ in c.landings:
        if lp_id not in seen:
            seen.append(lp_id)
    return seen


def _taiwan_check(
    cables: list[telegeography.Cable], cable_countries: dict[str, list[str]], year_of: dict[str, int]
) -> tuple[str, str]:
    """台灣的電纜：TeleGeography 收了哪些、常見的國際電纜缺了哪些，寫成附註。"""
    tw = sorted((c for c in cables if "TWN" in cable_countries[c.id]), key=lambda c: (year_of[c.id], c.name.lower()))
    ids = {c.id for c in tw}
    all_ids = {c.id for c in cables}
    for c in tw:
        print(f"    台灣：{c.name}（{c.id}）RFS {c.rfs_year}{'，規劃中' if c.planned else ''}，連到 {', '.join(p for p in cable_countries[c.id] if p != 'TWN') or '（國內）'}")
    missing = [name for name, cid in TAIWAN_EXPECTED.items() if cid not in ids]
    if missing:
        print(f"    警告：中央社報導提到、TeleGeography 卻沒有在台灣登陸的：{missing}（要改附註）")
    back = [name for name, cid in TAIWAN_ABSENT.items() if cid in all_ids]
    if back:
        print(f"    警告：{back} 又出現在 TeleGeography 的清單裡（要改附註）")
    domestic = [c for c in tw if cable_countries[c.id] == ["TWN"]]
    international = [c for c in tw if c not in domestic and not c.planned]
    planned = [c for c in tw if c not in domestic and c.planned]
    short = lambda c: (m.group(1) if (m := re.search(r"\(([^)]+)\)", c.name)) else c.name)  # noqa: E731  名稱裡括號的縮寫（TPE、SJC2）
    names = "、".join(short(c) for c in international)
    names_en = ", ".join(short(c) for c in international)
    zh = (
        f"TeleGeography 收錄 {len(international)} 條在台灣登陸、營運中的國際電纜（{names}；CSCN 的登陸點在金門），"
        f"跟中央社 2025 年 1 月報導中華電信與數位發展部提供的「台灣聯外海纜約 14 條」相近；"
        f"另有 {len(planned)} 條規劃中（{'、'.join(short(c) for c in planned)}）。"
        f"國內電纜只收了 {len(domestic)} 個系統（{'、'.join(c.name for c in domestic)}，串起本島與澎湖、金門、馬祖），"
        "同一篇報導說國內海纜有 10 條（台馬、台金、台澎、澎金各兩條），TeleGeography 沒有逐條收錄。"
        "1999 年啟用、曾在台灣登陸的 SEA-ME-WE 3 不在 TeleGeography 現在的清單裡。"
    )
    en = (
        f"TeleGeography lists {len(international)} international cables in service landing in Taiwan ({names_en}; CSCN lands on Kinmen), "
        "close to the “about 14” international cables that Chunghwa Telecom and the Ministry of Digital Affairs gave the Central News Agency in January 2025; "
        f"{len(planned)} more are planned ({', '.join(short(c) for c in planned)}). "
        f"Only {len(domestic)} domestic systems are listed ({', '.join(c.name for c in domestic)}, linking the main island with Penghu, Kinmen and Matsu), "
        "whereas the same report counts 10 domestic cables (two each on the Taiwan–Matsu, Taiwan–Kinmen, Taiwan–Penghu and Penghu–Kinmen routes). "
        "SEA-ME-WE 3, in service since 1999 with a landing in Taiwan, is not in TeleGeography's current list."
    )
    return zh, en
