"""海洋與漁業主題：專屬經濟海域（面積、界線）、捕撈與養殖產量。

資料：
- Marine Regions Maritime Boundaries 第 12 版（sources/marine_regions.py，VLIZ，CC BY 4.0）：
  - 各國專屬經濟海域的面積：Marine Regions 算好的 area_km2，含內水、群島水域與領海。
  - 界線：簡化成約 500 m 的精度（Douglas–Peucker），依 Marine Regions 的界線性質分 5 類（200 浬外緣、條約或判決、
    等距中線、共同管理區、未解決），基線與連接線的處理見 LINE_TYPES。
  - **重疊主張與共同管理區照 Marine Regions 的分類呈現，不替任何爭議下判斷**：
    - Marine Regions 把屬地兩個欄位都是同一個地方的重疊主張（territory1 = territory2：台灣、福克蘭群島、南喬治亞、
      西撒哈拉、馬約特、烏克蘭、威克島）當成那個地方的海域，只是主權有不同主張，這裡照屬地欄位算給那個地方，附註寫明。
    - 其他重疊主張（釣魚臺列嶼／尖閣諸島、南千島群島、獨島／竹島、南海的西沙與南沙群島一帶…）與共同管理區，
      不算進任何一方的面積，側欄列出相關的各方。
  - 沒有屬地 ISO 代碼的部分（夏威夷、阿拉斯加、亞速群島、加拉巴哥群島…）算給主權國欄位的國家；查哥斯群島
    Marine Regions 列在模里西斯之下（照列，附註寫明）。
- FAO FishStat（sources/fishstat.py，CC BY 4.0）：1950–2024 年的捕撈與養殖產量，只算水生動物（不含藻類），活體重量。
- FAOSTAT 土地利用（sources/faostat.py 的 RL，CC BY 4.0）：陸地面積（不含內陸水域），算「海域是陸地的幾倍」。
- UN WPP 2024（sources/wpp.py，CC BY 3.0 IGO）：人口，算人均漁業產量。
- 台灣：Marine Regions、FAO 本身都有台灣（FAO 寫「Taiwan Province of China」，地圖上照其他主題寫台灣）；
  漁業署《漁業統計年報》（sources/fa_tw.py）只寫在附註與側欄，跟 FAO 比對。

輸出（public/data/topics/oceans/）：eez.json、eez-land.json、capture.json、aquaculture.json、aqua-share.json、
per-capita.json、eez-lines.json（線）、countries/<ISO3>.json（側欄的明細）、manifest.json。
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, lines_file, now_iso, to_series, write_json
from sources import fa_tw, faostat, fishstat, marine_regions, wpp
from topics.transport import _simplify

OUT = OUT_DIR / "topics" / "oceans"
TAIWAN = "TWN"
EEZ_YEAR = marine_regions.VERSION_YEAR

# ── 專屬經濟海域 ─────────────────────────────────────

SIMPLIFY_DEGREES = 0.005  # Douglas–Peucker 容許誤差，約 500 m
QUANTUM = 0.005  # 座標量化單位（度）

# Marine Regions 的界線性質 → (圖例的分類, 細分代碼)。分類：0 外緣、1 條約或判決、2 等距中線、3 共同管理區、4 未解決（虛線）
LINE_TYPES = {
    "200 NM": (0, 0),
    "12 NM": (0, 1),
    "Treaty": (1, 2),
    "Court ruling": (1, 3),
    "Unilateral claim (undisputed)": (1, 4),
    "Median line": (2, 5),
    "Joint regime": (3, 6),
    "Unsettled (land)": (4, 7),
    "Unsettled median line (land)": (4, 8),
    "Unsettled (maritime)": (4, 9),
    "Unsettled median line (maritime)": (4, 10),
}
# 連接線（把條約線的端點接到 200 浬外緣或另一段界線的短線，平均 7 km）：兩邊都有海域的用同一對海域其他界線的分類，
# 只有一邊的算外緣
CONNECTION, CONNECTION_CODE = "Connection line", 11
# 界線資料裡對錯的多邊形代碼：英國與法羅群島之間的條約線寫成 84350，法羅群島的多邊形是 8435
BOUNDARY_FIXES = {84350: 8435}
# 基線（領海基線、群島基線）是沿著海岸的線，不是專屬經濟海域之間的界線，不畫
BASELINES = {"Straight baseline", "Archipelagic baseline", "Normal baseline (official)"}

# 沒有屬地 ISO 代碼、或同一個 ISO 有好幾塊的海域的名稱（Marine Regions 的 territory1）
PART_NAMES: dict[str, tuple[str, str]] = {
    "Amsterdam and Saint Paul Islands": ("阿姆斯特丹島與聖保羅島", "Amsterdam and Saint Paul Islands"),
    "Crozet Islands": ("克羅澤群島", "Crozet Islands"),
    "Kerguélen": ("凱爾蓋朗群島", "Kerguelen Islands"),
    "Europa Island": ("歐羅巴島", "Europa Island"),
    "Juan de Nova Island": ("新胡安島", "Juan de Nova Island"),
    "Bassas da India": ("印度礁", "Bassas da India"),
    "Macquarie Island": ("麥覺理島", "Macquarie Island"),
    "Bonaire": ("波奈", "Bonaire"),
    "Saba": ("沙巴", "Saba"),
    "Sint-Eustatius": ("聖佑達修斯", "Sint Eustatius"),
    "Trindade": ("千里達島與馬丁瓦斯群島", "Trindade and Martim Vaz"),
    "Islas San Félix and San Ambrosio": ("聖菲利克斯島與聖安布羅西奧島", "San Félix and San Ambrosio Islands"),
    "Easter Island": ("復活節島", "Easter Island"),
    "Serrana Bank": ("塞拉納淺灘", "Serrana Bank"),
    "Quitasueño Bank": ("基塔蘇埃尼奧淺灘", "Quitasueño Bank"),
    "Serranilla Bank": ("塞拉尼亞淺灘", "Serranilla Bank"),
    "Bajo Nuevo Bank": ("新淺灘", "Bajo Nuevo Bank"),
    "Galapagos": ("加拉巴哥群島", "Galápagos Islands"),
    "Canary Islands": ("加那利群島", "Canary Islands"),
    "Clipperton Island": ("克利珀頓島", "Clipperton Island"),
    "Andaman and Nicobar": ("安達曼－尼科巴群島", "Andaman and Nicobar Islands"),
    "Phoenix Group": ("鳳凰群島", "Phoenix Islands"),
    "Line Group": ("萊恩群島", "Line Islands"),
    "Gilbert Islands": ("吉爾伯特群島", "Gilbert Islands"),
    "Chagos Archipelago": ("查哥斯群島", "Chagos Archipelago"),
    "Azores": ("亞速群島", "Azores"),
    "Madeira": ("馬德拉群島", "Madeira"),
    "Ascension": ("亞森欣島", "Ascension"),
    "Saint Helena": ("聖赫勒拿島", "Saint Helena"),
    "Tristan da Cunha": ("崔斯坦達庫尼亞群島", "Tristan da Cunha"),
    "Svalbard": ("斯瓦巴", "Svalbard"),
    "Jan Mayen": ("揚馬延島", "Jan Mayen"),
    "Oecusse": ("歐庫西", "Oecusse"),
    "Palmyra Atoll": ("巴爾米拉環礁", "Palmyra Atoll"),
    "Johnston Atoll": ("約翰斯頓環礁", "Johnston Atoll"),
    "Jarvis Island": ("賈維斯島", "Jarvis Island"),
    "Howland and Baker Islands": ("豪蘭島與貝克島", "Howland and Baker Islands"),
    "Hawaii": ("夏威夷", "Hawaii"),
    "Alaska": ("阿拉斯加", "Alaska"),
    "Prince Edward Islands": ("愛德華王子群島", "Prince Edward Islands"),
    "Wake Island": ("威克島", "Wake Island"),
}
# 重疊主張與共同管理區的地名（沒有特定地名的是兩國之間劃界的爭議，只寫各方）。名稱並列各方的稱呼，不選邊
SPECIAL_PLACES: dict[int, tuple[str, str]] = {
    5695: ("烏克蘭（含克里米亞）周邊海域", "Waters off Ukraine (including Crimea)"),
    8319: ("威克島", "Wake Island"),
    8321: ("台灣周邊海域", "Waters around Taiwan"),
    8365: ("直布羅陀", "Gibraltar"),
    8368: ("西撒哈拉", "Western Sahara"),
    8383: ("南喬治亞與南三明治群島", "South Georgia and the South Sandwich Islands"),
    8389: ("福克蘭群島（馬維納斯群島）", "Falkland Islands (Malvinas)"),
    21798: ("托雷斯海峽", "Torres Strait"),
    26582: ("哈拉伊卜三角區", "Halaib Triangle"),
    48944: ("馬約特", "Mayotte"),
    48945: ("格洛里厄斯群島", "Glorioso Islands"),
    48946: ("特羅姆蘭島", "Tromelin Island"),
    48947: ("阿布穆薩島與大、小通布島", "Abu Musa and the Greater and Lesser Tunbs"),
    48948: ("馬修島與獵人島", "Matthew and Hunter Islands"),
    48950: ("南千島群島／北方四島", "Southern Kuril Islands / Northern Territories"),
    48951: ("納瓦薩島", "Navassa Island"),
    48954: ("釣魚臺列嶼／尖閣諸島", "Senkaku / Diaoyu / Tiaoyutai Islands"),
    48955: ("獨島／竹島（利昂庫爾岩）", "Liancourt Rocks (Dokdo / Takeshima)"),
    48956: ("杜梅拉島", "Doumeira Islands"),
    48997: ("查法里納斯群島", "Chafarinas Islands"),
    48998: ("佩雷希爾島", "Perejil Island"),
    48999: ("戈梅拉岩島", "Peñón de Vélez de la Gomera"),
    49000: ("梅利利亞", "Melilla"),
    49001: ("阿盧塞馬斯群島", "Alhucemas Islands"),
    49002: ("休達", "Ceuta"),
    49003: ("南海（西沙、南沙群島一帶）", "South China Sea (Paracel and Spratly area)"),
}
# 南海那一塊 Marine Regions 只列出中國一方，沒有逐一列出其他聲索方：不寫「各方」，側欄另外說明
SOUTH_CHINA_SEA = 49003
# 算給屬地的重疊主張，附註裡各方的中英文名稱（只有這幾個國家用得到）
PARTY_NAMES = {
    "TWN": ("台灣", "Taiwan"), "CHN": ("中國", "China"), "GBR": ("英國", "UK"), "ARG": ("阿根廷", "Argentina"),
    "ESH": ("西撒哈拉", "Western Sahara"), "MAR": ("摩洛哥", "Morocco"), "FRA": ("法國", "France"),
    "COM": ("葛摩", "Comoros"), "UKR": ("烏克蘭", "Ukraine"), "RUS": ("俄羅斯", "Russia"), "USA": ("美國", "US"),
    "MHL": ("馬紹爾群島", "Marshall Islands"), "JPN": ("日本", "Japan"),
}

Series = dict[int, float]


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    polygons = marine_regions.eez_polygons()
    eez = eez_areas(polygons)
    eez["landlocked"] = marine_regions.landlocked() | {"XKX"}  # Marine Regions 沒有科索沃，它也是內陸國
    land = land_areas()
    eez_files(eez, land)
    eez_lines(polygons, eez)

    prod = fishstat.production()
    population = wpp.demographic(["TPopulation1July"], last_year=prod.years[-1])["TPopulation1July"]
    tw = fa_tw.production()
    taiwan_check(prod, tw)
    fisheries_files(prod, population, tw)
    details(eez, prod, tw)
    write_json(
        OUT / "manifest.json",
        {
            "topic": "oceans",
            "generatedAt": now_iso(),
            "sources": [
                marine_regions.CITATION + " Licence: CC BY 4.0 (WFS geo.vliz.be, layers eez and eez_boundaries).",
                fishstat.CITATION,
                "FAO. FAOSTAT: Land Use (Inputs_LandUse_E_All_Data). Licence: CC-BY-4.0.",
                "United Nations, World Population Prospects 2024 (CC BY 3.0 IGO).",
                f"農業部漁業署，{fa_tw.REPORT}（歷年漁業生產量值），僅在台灣的附註與側欄引用數字。",
            ],
            "license": "CC BY 4.0 (Marine Regions, FAO); CC BY 3.0 IGO (WPP)",
        },
    )


# ── 專屬經濟海域的面積 ────────────────────────────────


def _territory_iso(p: dict) -> str | None:
    """這塊海域算給哪個 ISO：200 浬的用屬地（沒有就用主權國）；兩個屬地欄位都是同一處的重疊主張算給那個屬地；其他 None"""
    if p["pol_type"] == "200NM":
        return p["iso_ter1"] or p["iso_sov1"]
    if p["pol_type"] == "Overlapping claim" and p["iso_ter1"] and p["iso_ter1"] == p["iso_ter2"]:
        return p["iso_ter1"]
    return None


def _parties(p: dict) -> list[str]:
    """重疊主張、共同管理區的各方：每一方用屬地的 ISO（沒有就用主權國的），例如英國／法羅群島"""
    out: list[str] = []
    for i in (1, 2, 3):
        iso = p[f"iso_ter{i}"] or p[f"iso_sov{i}"]
        if iso and iso not in out:
            out.append(iso)
    return out


def eez_areas(polygons: list[dict]) -> dict:
    """各 ISO 的專屬經濟海域面積、組成、主權國合計、跟其他國家重疊的海域"""
    by_iso: dict[str, float] = defaultdict(float)
    parts: dict[str, list[dict]] = defaultdict(list)
    sovereign_of: dict[str, str] = {}
    shared: list[dict] = []
    polygon_side: dict[int, dict] = {}
    multi = Counter(_territory_iso(p) for p in polygons if _territory_iso(p))
    for p in polygons:
        iso = _territory_iso(p)
        mrgid = p["mrgid"]
        if iso:
            area = p["area_km2"]
            by_iso[iso] += area
            claim = p["pol_type"] == "Overlapping claim"
            main = p["territory1"] == p["sovereign1"] or (p["iso_ter1"] == iso and multi[iso] == 1) or (claim and multi[iso] == 1)
            name = None if main else PART_NAMES.get(p["territory1"]) or (SPECIAL_PLACES.get(mrgid) if claim else None)
            if not main and name is None:
                raise ValueError(f"Marine Regions 的 {p['geoname']}（{p['territory1']}）沒有中文名稱，加進 PART_NAMES")
            parts[iso].append({
                "mrgid": mrgid, "name": name, "km2": area, "claim": claim,
                "parties": _parties(p) if claim else [],
                "sovereigns": [s for s in (p["iso_sov1"], p["iso_sov2"], p["iso_sov3"]) if s] if claim else [],
            })
            sovereign_of.setdefault(iso, p["iso_sov1"])
            polygon_side[mrgid] = {"iso": iso, "name": name, "kind": 0, "parties": []}
        else:
            kind = 1 if p["pol_type"] == "Overlapping claim" else 2
            parties = [] if mrgid == SOUTH_CHINA_SEA else _parties(p)
            members = {s for i in (1, 2, 3) for s in (p[f"iso_ter{i}"], p[f"iso_sov{i}"]) if s}
            place = SPECIAL_PLACES.get(mrgid)
            if kind == 1 and place is None and len(parties) < 2:
                raise ValueError(f"重疊主張 {p['geoname']} 沒有地名也沒有兩個以上的當事方")
            shared.append({"mrgid": mrgid, "kind": kind, "place": place, "parties": parties, "members": members, "km2": p["area_km2"]})
            polygon_side[mrgid] = {"iso": None, "name": place, "kind": kind, "parties": parties}

    # 主權國合計：Marine Regions 的主權國欄位（sovereign1）相同的屬地加起來
    sovereign_total: dict[str, float] = defaultdict(float)
    territories: dict[str, list[str]] = defaultdict(list)
    for iso, sov in sovereign_of.items():
        sovereign_total[sov] += by_iso[iso]
        if iso != sov:
            territories[sov].append(iso)
    ranked = sorted(sovereign_total, key=lambda k: -sovereign_total[k])
    world = sum(p["area_km2"] for p in polygons)
    return {
        "area": dict(by_iso), "parts": parts, "sovereign_of": sovereign_of, "sovereign_total": dict(sovereign_total),
        "sovereign_rank": {k: i + 1 for i, k in enumerate(ranked)}, "territories": territories,
        "shared": shared, "sides": polygon_side, "world": world,
    }


def land_areas() -> dict[str, float]:
    """FAOSTAT 的陸地面積（km²，不含內陸水域），EEZ 那一年（沒有就用最近一年）"""
    latest: dict[str, tuple[int, float]] = {}
    for r in faostat.rows("RL", {5110}, {6601}):
        if r.area == "WLD":
            continue
        y = r.year
        prev = latest.get(r.area)
        # 優先用 EEZ 那一年，否則用最接近的一年
        if prev is None or abs(y - EEZ_YEAR) < abs(prev[0] - EEZ_YEAR):
            latest[r.area] = (y, r.value * 10)  # 千公頃 → km²
    return {k: v for k, (_, v) in latest.items() if v > 0}


def _fmt_km2(v: float) -> str:
    return f"{v:,.0f}"


def _join_en(items: list[str]) -> str:
    return items[0] if len(items) == 1 else f"{', '.join(items[:-1])} and {items[-1]}"


def eez_files(eez: dict, land: dict[str, float]) -> None:
    area: dict[str, float] = eez["area"]
    notes: dict[str, str] = {}
    notes_en: dict[str, str] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}

    def add(iso: str, zh: str, en: str) -> None:
        notes[iso] = (notes.get(iso, "") + zh).strip()
        notes_en[iso] = (notes_en.get(iso, "") + " " + en).strip()

    for iso, parts in eez["parts"].items():
        named = [p for p in parts if p["name"] and not p["claim"]]
        if named:
            add(iso, f"含{'、'.join(p['name'][0] for p in named)}。", f"Includes {_join_en([p['name'][1] for p in named])}.")
        for p in parts:
            if not p["claim"]:
                continue
            who_zh = "、".join(PARTY_NAMES[s][0] for s in p["sovereigns"])
            who_en = " and ".join(PARTY_NAMES[s][1] for s in p["sovereigns"])
            whole = abs(p["km2"] - area[iso]) < 1
            km2 = _fmt_km2(p["km2"])
            what_zh = "這片海域整片" if whole else f"其中 {km2} km² "
            what_en = "the whole area" if whole else f"{km2} km² of it"
            zh = f"Marine Regions 把{what_zh}標為重疊主張（{who_zh}）；它的屬地欄位就是這個地方，所以算在這裡。"
            en = (f"Marine Regions classifies {what_en} as an overlapping claim ({who_en}); its territory field is this place, "
                  f"so it is counted here.")
            add(iso, zh, en)
            hints[iso] = f"{'' if whole else f'其中 {km2} km² '}Marine Regions 標為重疊主張（{who_zh}）"
            hints_en[iso] = f"{'' if whole else f'{km2} km² '}classified by Marine Regions as an overlapping claim ({who_en})"
            hints_en[iso] = hints_en[iso][0].upper() + hints_en[iso][1:]
    for sov, terrs in eez["territories"].items():
        if sov not in area:
            continue
        total = eez["sovereign_total"][sov]
        rank = eez["sovereign_rank"][sov]
        add(sov, f"海外領地（{len(terrs)} 處）另外計算；依 Marine Regions 的主權國欄位加總是 {_fmt_km2(total)} km²（第 {rank} 名），見側欄。",
            f"Overseas territories ({len(terrs)}) are counted separately; summed by Marine Regions’ sovereign field the total is "
            f"{_fmt_km2(total)} km² (#{rank}); see the side panel.")
    involved: dict[str, list[dict]] = defaultdict(list)
    for s in eez["shared"]:
        for m in s["members"]:
            involved[m].append(s)
    for iso, items in involved.items():
        if iso in (TAIWAN, "CHN"):
            continue  # 下面另外寫
        total = sum(s["km2"] for s in items)
        add(iso, f"另有 {len(items)} 處跟其他國家重疊主張或共同管理的海域（共 {_fmt_km2(total)} km²），沒有算進任何一方，見側欄。",
            f"{len(items)} {'area' if len(items) == 1 else 'areas'} of overlapping claims or joint regimes with other countries "
            f"({_fmt_km2(total)} km² in total) {'is' if len(items) == 1 else 'are'} not counted for any party; see the side panel.")
    # 台灣與中國：寫明南海、釣魚臺列嶼的處理
    scs = next(s for s in eez["shared"] if s["mrgid"] == SOUTH_CHINA_SEA)
    senkaku = next(s for s in eez["shared"] if s["mrgid"] == 48954)
    taiwan_zone = next(p for p in eez["parts"][TAIWAN] if p["claim"])
    add(TAIWAN,
        f"釣魚臺列嶼／尖閣諸島周邊 {_fmt_km2(senkaku['km2'])} km² 是台灣、日本、中國的重疊主張；南海（西沙、南沙群島一帶）"
        f"{_fmt_km2(scs['km2'])} km² 也標為重疊主張，都沒有算進任何一方。",
        f"The {_fmt_km2(senkaku['km2'])} km² around the Senkaku / Diaoyu / Tiaoyutai Islands is an overlapping claim of Taiwan, "
        f"Japan and China, and {_fmt_km2(scs['km2'])} km² of the South China Sea (Paracel and Spratly area) is also classified "
        f"as overlapping claims; neither is counted for any party.")
    add("CHN",
        f"不含台灣周邊海域（Marine Regions 標為台灣、中國的重疊主張，{_fmt_km2(taiwan_zone['km2'])} km² 算在台灣）、"
        f"南海（西沙、南沙群島一帶，{_fmt_km2(scs['km2'])} km²，Marine Regions 這一塊只列出中國，沒有逐一列出其他聲索方）"
        f"與釣魚臺列嶼／尖閣諸島周邊。",
        f"Excludes the waters around Taiwan (an overlapping claim of Taiwan and China in Marine Regions; "
        f"{_fmt_km2(taiwan_zone['km2'])} km² counted for Taiwan), the South China Sea area around the Paracel and Spratly "
        f"Islands ({_fmt_km2(scs['km2'])} km²; Marine Regions lists only China for this area and does not list the other "
        f"claimants) and the area around the Senkaku / Diaoyu / Tiaoyutai Islands.")
    add("MUS", "查哥斯群島的海域 Marine Regions 列在模里西斯之下（第 12 版的主權國欄位），這裡照列。",
        "Marine Regions (version 12) lists the waters of the Chagos Archipelago under Mauritius; shown as such.")

    # 內陸國是 0（沒有專屬經濟海域），不是無資料
    for iso in eez["landlocked"]:
        if iso in area:
            raise ValueError(f"{iso} 是內陸國，卻有專屬經濟海域")
        hints[iso] = "內陸國，沒有專屬經濟海域"
        hints_en[iso] = "Landlocked: no exclusive economic zone"
    years = [EEZ_YEAR]
    values = {iso: [round(v)] for iso, v in area.items()} | {iso: [0] for iso in eez["landlocked"]}
    write_json(OUT / "eez.json", indicator_file(
        "eez", "km²", years, values, aggregates={"WLD": [round(eez["world"])]},
        notes=notes, notesEn=notes_en, hints=hints, hintsEn=hints_en,
    ))
    ratio = {iso: [round(v / land[iso], 2 if v / land[iso] < 10 else 1 if v / land[iso] < 100 else 0)]
             for iso, v in area.items() if iso in land} | {iso: [0] for iso in eez["landlocked"]}
    ratio_notes = {
        TAIWAN: f"台灣的陸地面積用 FAOSTAT 的 {_fmt_km2(land[TAIWAN])} km²（不含內陸水域；內政部公布的土地面積是 36,197 km²）。",
    }
    ratio_notes_en = {
        TAIWAN: f"Taiwan’s land area is FAOSTAT’s {_fmt_km2(land[TAIWAN])} km² (excluding inland water; the Ministry of the "
                f"Interior gives 36,197 km² of land).",
    }
    write_json(OUT / "eez-land.json", indicator_file(
        "eez-land", "倍", years, ratio, aggregates={"WLD": [round(eez["world"] / sum(land.values()), 2)]},
        notes=ratio_notes, notesEn=ratio_notes_en, hints=hints, hintsEn=hints_en,
    ))
    top = sorted(area, key=lambda k: -area[k])[:8]
    tw_rank = sorted(area, key=lambda k: -area[k]).index(TAIWAN) + 1
    print(f"  專屬經濟海域：{len(area)} 個地方，前 8 名 {[(k, round(area[k])) for k in top]}；"
          f"台灣 {area[TAIWAN]:,.0f} km²（第 {tw_rank} 名），陸地的 {area[TAIWAN] / land[TAIWAN]:.1f} 倍；"
          f"沒有陸地面積的：{sorted(set(area) - set(land))}")


# ── 專屬經濟海域的界線 ────────────────────────────────


def eez_lines(polygons: list[dict], eez: dict) -> None:
    features = marine_regions.boundaries()
    sides = eez["sides"]
    # 連接線用同一對海域其他界線的分類（依長度最多的）
    pair_class: dict[tuple, Counter] = defaultdict(Counter)
    for f in features:
        p = f["properties"]
        if p["line_type"] in LINE_TYPES and p["mrgid_eez2"] is not None:
            key = tuple(sorted(BOUNDARY_FIXES.get(int(p[k]), int(p[k])) for k in ("mrgid_eez1", "mrgid_eez2")))
            pair_class[key][LINE_TYPES[p["line_type"]][0]] += float(p["length_km"] or 0)
    unknown = {f["properties"]["line_type"] for f in features} - set(LINE_TYPES) - BASELINES - {CONNECTION}
    if unknown:
        raise ValueError(f"Marine Regions 有沒處理的界線性質：{unknown}")

    lines: list[list[tuple[float, float]]] = []
    types: list[int] = []
    records: list[dict] = []
    kept = Counter()
    vertices = 0
    for f in features:
        p = f["properties"]
        kind = p["line_type"]
        if kind in BASELINES:
            continue
        a = int(p["mrgid_eez1"]) if p["mrgid_eez1"] is not None else None
        b = int(p["mrgid_eez2"]) if p["mrgid_eez2"] is not None else None
        a, b = BOUNDARY_FIXES.get(a, a), BOUNDARY_FIXES.get(b, b)
        if kind == CONNECTION:
            if b is None:
                cls = 0
            else:
                counts = pair_class.get(tuple(sorted((a, b))))
                cls = counts.most_common(1)[0][0] if counts else 2
            code = CONNECTION_CODE
        else:
            cls, code = LINE_TYPES[kind]
        record: dict[str, object] = {"k": code, "km": round(float(p["length_km"] or 0))}
        for prefix, mrgid in (("a", a), ("b", b)):
            side = sides.get(mrgid) if mrgid is not None else None
            if mrgid is not None and side is None:
                raise ValueError(f"界線 {p['line_name']} 的海域 {mrgid} 不在 EEZ 的多邊形裡")
            if side is None:
                continue
            record[prefix] = side["iso"]
            if side["name"]:
                record[prefix + "n"], record[prefix + "nEn"] = side["name"]
            if side["kind"]:
                record[prefix + "k"] = side["kind"]
                record[prefix + "p"] = " ".join(side["parties"])
        geometry = f["geometry"]
        parts = geometry["coordinates"] if geometry["type"] == "MultiLineString" else [geometry["coordinates"]]
        for part in parts:
            simple = _simplify([[x, y] for x, y, *_ in part], SIMPLIFY_DEGREES)
            if len(simple) < 2:
                continue
            xs = [c[0] for c in simple]
            if max(xs) - min(xs) > 180:
                raise ValueError(f"界線 {p['line_name']} 跨過 ±180° 經線，要先展開經度")
            lines.append([(x, y) for x, y in simple])
            types.append(cls)
            records.append(record)
            vertices += len(simple)
        kept[cls] += 1
    fields = ["k", "km", "a", "an", "anEn", "ak", "ap", "b", "bn", "bnEn", "bk", "bp"]
    data = lines_file(lines, QUANTUM, types, records=records, record_fields=fields, record_scale={"k": 1, "km": 1, "ak": 1, "bk": 1})
    write_json(OUT / "eez-lines.json", data)
    print(f"  界線：{len(lines)} 段、{vertices:,} 個頂點（簡化後）；各分類的界線數 {dict(sorted(kept.items()))}")


# ── 漁業 ──────────────────────────────────────────


def taiwan_check(prod: fishstat.Production, tw: dict[int, dict[str, float]]) -> None:
    """FAO 的台灣捕撈量要跟漁業署的遠洋＋近海＋沿岸＋內陸漁撈接近：1959 年起每年相差 6% 以內
    （多半 3% 以內，1997 年差最多 +5.8%，2024 年 0.02%）。養殖不比：FAO 的牡蠣是帶殼的活體重量，差 36–129%"""
    for y in range(1959, prod.years[-1] + 1):
        fao = prod.capture[TAIWAN].get(y)
        fa = sum(tw[y][k] for k in fa_tw.CAPTURE_TYPES)
        if fao is None or abs(fao - fa) / fa > 0.06:
            raise ValueError(f"{y} 年 FAO 的台灣捕撈量 {fao} 跟漁業署的 {fa:,.0f} 公噸差太多")


def fisheries_files(prod: fishstat.Production, population: dict[str, Series], tw: dict[int, dict[str, float]]) -> None:
    years = prod.years
    last = years[-1]
    tw_last = max(tw)
    # 跟側欄的表一樣，先把各漁業種類四捨五入再加總
    fa_cap = {y: sum(round(v[k]) for k in fa_tw.CAPTURE_TYPES) for y, v in tw.items()}
    fa_aqu = {y: sum(round(v[k]) for k in fa_tw.CULTURE_TYPES) for y, v in tw.items()}
    distant_share = tw[last]["distant"] / fa_cap[last]
    oyster = prod.species[("aquaculture", TAIWAN)].get("Pacific cupped oyster", 0)

    china_zh = "FAO 的中國只有大陸，香港、澳門、台灣各自分開列出。"
    china_en = "FAO’s China covers the mainland only; Hong Kong, Macao and Taiwan are listed separately."
    capture_notes = {
        TAIWAN: (
            f"FAO 寫「Taiwan Province of China」，地圖上照其他主題寫台灣。漁業署《漁業統計年報》的捕撈（遠洋、近海、沿岸、"
            f"內陸漁撈）{last} 年 {fa_cap[last]:,.0f} 公噸，跟 FAO 的 {prod.capture[TAIWAN][last]:,.0f} 公噸幾乎一樣；"
            f"其中遠洋漁業 {tw[last]['distant']:,.0f} 公噸（{distant_share:.0%}），魚多半在三大洋捕的，FAO 一樣算在台灣（漁船的船旗國）。"
            f"{tw_last} 年漁業署公布捕撈 {fa_cap[tw_last]:,.0f} 公噸（FAO 還沒有這一年）。"
        ),
        "CHN": china_zh,
        "TZA": "含桑吉巴（FAO 分開列出）。",
    }
    capture_notes_en = {
        TAIWAN: (
            f"FAO lists “Taiwan Province of China”, shown as Taiwan as elsewhere on this site. The Fisheries Agency’s yearbook "
            f"gives {fa_cap[last]:,.0f} t of capture (distant-water, offshore, coastal and inland) in {last}, almost the same as "
            f"FAO’s {prod.capture[TAIWAN][last]:,.0f} t; {tw[last]['distant']:,.0f} t ({distant_share:.0%}) came from the "
            f"distant-water fleet fishing across the three oceans, which FAO also counts for Taiwan (the flag state). For "
            f"{tw_last} the agency reports {fa_cap[tw_last]:,.0f} t (not yet in FAO)."
        ),
        "CHN": china_en,
        "TZA": "Includes Zanzibar (listed separately by FAO).",
    }
    aqua_notes = {
        TAIWAN: (
            f"FAO {last} 年 {prod.aquaculture[TAIWAN][last]:,.0f} 公噸，漁業署《漁業統計年報》的養殖（海面＋內陸）"
            f"是 {fa_aqu[last]:,.0f} 公噸。差距幾乎都是牡蠣：FAO 一律用活體重量（貝類含殼），牡蠣是 {oyster:,.0f} 公噸，"
            f"漁業署的牡蠣是 {fa_tw.OYSTER_2024:,} 公噸。{tw_last} 年漁業署公布養殖 {fa_aqu[tw_last]:,.0f} 公噸。"
        ),
        "CHN": china_zh,
        "TZA": "含桑吉巴（FAO 分開列出）。",
    }
    aqua_notes_en = {
        TAIWAN: (
            f"FAO: {prod.aquaculture[TAIWAN][last]:,.0f} t in {last}; the Fisheries Agency’s yearbook gives "
            f"{fa_aqu[last]:,.0f} t of aquaculture (marine and inland). The gap is almost all oysters: FAO always uses live "
            f"weight (shells included for molluscs), {oyster:,.0f} t of oysters, against the agency’s {fa_tw.OYSTER_2024:,} t. "
            f"For {tw_last} the agency reports {fa_aqu[tw_last]:,.0f} t of aquaculture."
        ),
        "CHN": china_en,
        "TZA": "Includes Zanzibar (listed separately by FAO).",
    }
    # FAO 有列出的國家都收（捕撈或養殖是 0 的年份照寫 0）
    capture = {iso: to_series(s, years, 0) for iso, s in prod.capture.items()}
    aquaculture = {iso: to_series(s, years, 0) for iso, s in prod.aquaculture.items()}
    write_json(OUT / "capture.json", indicator_file(
        "capture", "公噸", years, capture, aggregates={"WLD": to_series(prod.world_capture, years, 0)},
        notes=capture_notes, notesEn=capture_notes_en,
    ))
    write_json(OUT / "aquaculture.json", indicator_file(
        "aquaculture", "公噸", years, aquaculture, aggregates={"WLD": to_series(prod.world_aquaculture, years, 0)},
        notes=aqua_notes, notesEn=aqua_notes_en,
    ))

    share: dict[str, Series] = {}
    per_capita: dict[str, Series] = {}
    for iso in set(prod.capture) | set(prod.aquaculture):
        for y in years:
            c, a = prod.capture[iso].get(y), prod.aquaculture[iso].get(y)
            if c is None or a is None:
                continue
            total = c + a
            if total >= 100:  # 不到 100 公噸的比例沒有意義
                share.setdefault(iso, {})[y] = round(a / total * 100, 1)
            pop = population.get(iso, {}).get(y)
            if pop:
                per_capita.setdefault(iso, {})[y] = total / pop  # 公噸 ÷ 千人 = 公斤／人
    world_share = {y: round(prod.world_aquaculture[y] / (prod.world_aquaculture[y] + prod.world_capture[y]) * 100, 1) for y in years}
    world_pc = {y: (prod.world_aquaculture[y] + prod.world_capture[y]) / population["WLD"][y] for y in years}
    tw_share_fa = fa_aqu[last] / (fa_aqu[last] + fa_cap[last]) * 100
    share_notes = {
        TAIWAN: f"用漁業署的數字算是 {tw_share_fa:.1f}%（{last} 年）：FAO 的牡蠣以帶殼的活體重量計，養殖的比例比較高。",
        "CHN": china_zh,
    }
    share_notes_en = {
        TAIWAN: f"{tw_share_fa:.1f}% using the Fisheries Agency’s figures ({last}): FAO counts oysters by live weight with shells, "
                f"which raises the aquaculture share.",
        "CHN": china_en,
    }
    write_json(OUT / "aqua-share.json", indicator_file(
        "aqua-share", "%", years, {iso: to_series(s, years) for iso, s in share.items()},
        aggregates={"WLD": to_series(world_share, years)}, notes=share_notes, notesEn=share_notes_en,
    ))

    def pc_digits(v: float) -> float:
        return round(v, 2 if v < 10 else 1 if v < 1000 else 0)

    write_json(OUT / "per-capita.json", indicator_file(
        "per-capita", "公斤", years,
        {iso: to_series({y: pc_digits(v) for y, v in s.items()}, years) for iso, s in per_capita.items()},
        aggregates={"WLD": to_series({y: pc_digits(v) for y, v in world_pc.items()}, years)},
        notes={"CHN": china_zh}, notesEn={"CHN": china_en},
    ))
    cap_rank = sorted(capture, key=lambda k: -(prod.capture[k].get(last) or 0))
    aqu_rank = sorted(aquaculture, key=lambda k: -(prod.aquaculture[k].get(last) or 0))
    print(f"  捕撈 {years[0]}–{last}：{len(capture)} 國，{last} 年前 5 名 {cap_rank[:5]}，台灣 "
          f"{prod.capture[TAIWAN][last]:,.0f} 公噸（第 {cap_rank.index(TAIWAN) + 1} 名），世界 {prod.world_capture[last]:,.0f}")
    print(f"  養殖：{len(aquaculture)} 國，前 5 名 {aqu_rank[:5]}，台灣 {prod.aquaculture[TAIWAN][last]:,.0f} 公噸"
          f"（第 {aqu_rank.index(TAIWAN) + 1} 名），世界 {prod.world_aquaculture[last]:,.0f}；"
          f"台灣養殖占比 {share[TAIWAN][last]}%、人均 {per_capita[TAIWAN][last]:.1f} 公斤，世界 {world_share[last]}%、{world_pc[last]:.1f} 公斤")
    for name, data in (("養殖占比", share), ("人均", per_capita)):
        vals = sorted(v[last] for v in data.values() if last in v)
        q = [vals[int(len(vals) * f)] for f in (0.1, 0.25, 0.5, 0.75, 0.9)]
        print(f"  {name} {last} 年分布（10/25/50/75/90%）：{[round(x, 1) for x in q]}，最大 {vals[-1]:.0f}")


# ── 側欄的明細 ────────────────────────────────────────

TOP_GROUPS = 8
TOP_AREAS = 8
TW_YEARS = 4  # 台灣的漁業署數字列最近幾年（側欄約 340 px 寬，放 4 年）


def details(eez: dict, prod: fishstat.Production, tw: dict[int, dict[str, float]]) -> None:
    last = prod.years[-1]
    involved: dict[str, list[dict]] = defaultdict(list)
    for s in eez["shared"]:
        for m in s["members"]:
            involved[m].append(s)
    # 算給屬地的重疊主張，在其他當事方（主權國欄位）的側欄也列出
    claimed_by: dict[str, list[dict]] = defaultdict(list)
    for iso, parts in eez["parts"].items():
        for p in parts:
            if p["claim"]:
                for s in p["sovereigns"]:
                    if s != iso:
                        claimed_by[s].append({"iso": iso, "km2": p["km2"], "sovereigns": p["sovereigns"], "name": p["name"]})

    isos = set(eez["area"]) | set(involved) | set(prod.capture) | set(prod.aquaculture) | set(claimed_by)
    (OUT / "countries").mkdir(parents=True, exist_ok=True)
    for old in (OUT / "countries").glob("*.json"):
        old.unlink()
    written = 0
    for iso in sorted(isos):
        out: dict[str, object] = {}
        block: dict[str, object] = {}
        parts = eez["parts"].get(iso, [])
        if len(parts) > 1 or any(p["claim"] for p in parts):
            block["parts"] = [
                {"zh": p["name"][0] if p["name"] else None, "en": p["name"][1] if p["name"] else None, "km2": p["km2"],
                 **({"claim": p["sovereigns"]} if p["claim"] else {})}
                for p in sorted(parts, key=lambda p: -p["km2"])
            ]
        terrs = eez["territories"].get(iso)
        if terrs and iso in eez["area"]:
            block["sovereign"] = {
                "total": eez["sovereign_total"][iso],
                "rank": eez["sovereign_rank"][iso],
                "of": len(eez["sovereign_total"]),
                "territories": sorted(([t, eez["area"][t]] for t in terrs), key=lambda x: -x[1]),
            }
        if involved.get(iso):
            block["shared"] = [
                {"id": s["mrgid"], "kind": "claim" if s["kind"] == 1 else "joint",
                 "zh": s["place"][0] if s["place"] else None, "en": s["place"][1] if s["place"] else None,
                 "parties": s["parties"], "km2": s["km2"]}
                for s in sorted(involved[iso], key=lambda s: -s["km2"])
            ]
        if claimed_by.get(iso):
            block["claimedElsewhere"] = [
                {"iso": c["iso"], "km2": c["km2"], "parties": c["sovereigns"],
                 **({"zh": c["name"][0], "en": c["name"][1]} if c["name"] else {})}
                for c in claimed_by[iso]
            ]
        if block:
            out["eez"] = block

        groups: dict[str, object] = {}
        for source in ("capture", "aquaculture"):
            g = prod.groups.get((source, iso))
            if g:
                ranked = sorted(g.items(), key=lambda kv: -kv[1])
                shown = [[k, round(v)] for k, v in ranked[:TOP_GROUPS]]
                rest = sum(v for _, v in ranked[TOP_GROUPS:])
                groups[source] = shown + ([["", round(rest)]] if rest >= 0.5 else [])
        if groups:
            out["groups"] = {"year": last, **groups}
        areas = prod.areas.get(iso)
        if areas:
            ranked = sorted(areas.items(), key=lambda kv: -kv[1])
            shown = [[k, round(v)] for k, v in ranked[:TOP_AREAS]]
            rest = sum(v for _, v in ranked[TOP_AREAS:])
            out["areas"] = {"year": last, "items": shown + ([["", round(rest)]] if rest >= 0.5 else [])}
        if iso == TAIWAN:
            ys = sorted(tw)[-TW_YEARS:]
            out["taiwan"] = {
                "years": ys,
                "rows": {k: [round(tw[y][k]) for y in ys] for k in fa_tw.TYPES.values()},
                "fao": {
                    "capture": [round(prod.capture[TAIWAN][y]) if y in prod.capture[TAIWAN] else None for y in ys],
                    "aquaculture": [round(prod.aquaculture[TAIWAN][y]) if y in prod.aquaculture[TAIWAN] else None for y in ys],
                },
                "oyster": {"year": last, "fao": round(prod.species[("aquaculture", TAIWAN)].get("Pacific cupped oyster", 0)),
                           "fa": fa_tw.OYSTER_2024},
                "url": fa_tw.INFO_URL,
            }
        if out:
            write_json(OUT / "countries" / f"{iso}.json", out, quiet=True)
            written += 1
    size = sum(p.stat().st_size for p in (OUT / "countries").glob("*.json"))
    print(f"  側欄明細：{written} 個國家，共 {size / 1024:.0f} KB")
