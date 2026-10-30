"""晝夜與季節主題：各國首都的位置與時區、地圖上的赤道、回歸線與極圈（DESIGN.md 第 8 節第 87 點）。

白天長度、正午太陽高度這些依日期變的指標在瀏覽器裡算（src/lib/solar.ts，NOAA Solar Calculator 的公式），
跟地圖上的晝夜界線、側欄的全年圖表是同一份程式；這裡只準備算的材料：

- 首都：國家小檔案主題（profiles.py）從 Wikidata 整理的首都（public/data/topics/profiles/capitals.json，同一份資料，
  所以要先跑 profiles）。有好幾個首都的國家取小檔案排在第一個的：唯一或法定的首都，其次行政首都、立法、司法、
  政府所在地（南非取行政首都普勒托利亞、玻利維亞取行政首都拉巴斯、荷蘭取阿姆斯特丹、貝南取波多諾伏）；
  蒙哲臘的法定首都普利茅斯 1997 年火山爆發後廢棄，改用政府所在的布萊茲。其他首都列在側欄。
  沒有首都的地區用主要的城鎮（MAIN_TOWNS：香港、澳門、西撒哈拉的阿尤恩、托克勞、聖誕島）；小檔案沒有、
  Natural Earth 1:10m populated places 的 Admin-0 capital 有的用它（目前沒有），再沒有就不算（南極洲、赫德島、錫亞琴冰川）。
- 時區：IANA 時區資料庫（sources/iana_tz.py，tzdata 套件，公有領域），跟旅行實用主題同一套規則：Natural Earth 首都的
  TIMEZONE 在那個國家的 zone.tab 清單裡就用它，否則用 zone.tab 離首都最近的代表城市。存標準時間的 UTC 偏移
  （「時鐘和太陽差多少」用標準時間）；前端顯示日出日落時用瀏覽器的 Intl 依 IANA 時區名稱換算，含夏令時間。
- 極區的參考地點：國土伸進北極圈、南極圈的國家，側欄另外列一個圈內的城鎮（特羅姆瑟、基律納、莫曼斯克…）的
  極晝、極夜期間；首都都不在極圈內。
- 回歸線與極圈：緯度 ±ε、±(90° − ε)，ε 是 2026 年的黃赤交角（Meeus 式 22.2，23.4361°，每年減少約 0.47″）。

輸出 capitals.json、circles.json（common.lines_file()）、manifest.json。
"""
from __future__ import annotations

import json
import math

from common import OUT_DIR, lines_file, now_iso, write_json
from sources import iana_tz
from topics.travel import TZ_OVERRIDES, _capitals as ne_capitals, _km

OUT = OUT_DIR / "topics" / "daylight"
YEAR = 2026

# 國家小檔案的首都角色排序（profiles.py 的 order）：排在前面的優先
ROLE_ORDER = {None: 0, "": 0, "dejure": 1, "claimed": 1, "exec": 2, "leg": 3, "jud": 4, "seat": 5, "admin": 6, "defacto": 7, "unofficial": 8}
# 小檔案排在第一個、但不適合代表這個國家的首都
CAPITAL_OVERRIDES = {
    "MSR": "Brades",  # 法定首都普利茅斯 1997 年火山爆發後廢棄，政府在布萊茲
}
# 首都的中文名稱：台灣寫「台北」（小檔案是 Wikidata 的「臺北市」）
NAME_OVERRIDES = {"TWN": ("台北", "Taipei")}
# 沒有首都的地區（特別行政區、屬地、爭議地區）用主要的城鎮（名稱、緯度、經度）；tooltip 寫「以香港計算」，不寫「首都」
MAIN_TOWNS = {
    "HKG": ("香港", "Hong Kong", 22.28, 114.16),
    "MAC": ("澳門", "Macau", 22.19, 113.54),
    "ESH": ("阿尤恩", "Laayoune", 27.15, -13.2),
    "TKL": ("法考福", "Fakaofo", -9.38, -171.22),
    "_IOT": ("飛魚灣（聖誕島）", "Flying Fish Cove, Christmas Island", -10.42, 105.68),
}
# 種類：1 首都、2 沒有首都的地區的主要城鎮
CAPITAL, MAIN_TOWN = 1, 2

# 國土伸進極圈的國家：圈內的一個參考地點（名稱、緯度、經度、IANA 時區），側欄列出它的極晝、極夜期間
POLAR_PLACES = {
    "NOR": ("特羅姆瑟", "Tromsø", 69.6492, 18.9553, "Europe/Oslo"),
    "SWE": ("基律納", "Kiruna", 67.8558, 20.2253, "Europe/Stockholm"),
    "FIN": ("烏茨約基", "Utsjoki", 69.9079, 27.0268, "Europe/Helsinki"),
    "RUS": ("莫曼斯克", "Murmansk", 68.9585, 33.0827, "Europe/Moscow"),
    "USA": ("烏特恰維克（阿拉斯加）", "Utqiaġvik, Alaska", 71.2906, -156.7887, "America/Anchorage"),
    "CAN": ("伊努維克", "Inuvik", 68.3607, -133.7230, "America/Inuvik"),
    "GRL": ("伊盧利薩特", "Ilulissat", 69.2198, -51.0986, "America/Nuuk"),
    "ATA": ("麥克默多站", "McMurdo Station", -77.8419, 166.6863, "Antarctica/McMurdo"),
}

# 2026 年的黃赤交角（Meeus 式 22.2 的平黃赤交角）
T_2026 = (YEAR + 0.5 - 2000) / 100
OBLIQUITY = 23 + 26 / 60 + (21.448 - 46.815 * T_2026 - 0.00059 * T_2026**2 + 0.001813 * T_2026**3) / 3600


def _profile_capitals() -> dict[str, list[dict]]:
    """國家小檔案的首都（points_file 的格式還原），依角色排序"""
    with open(OUT_DIR / "topics" / "profiles" / "capitals.json", encoding="utf-8") as f:
        data = json.load(f)
    cols = dict(zip(data["fields"], data["columns"]))
    out: dict[str, list[dict]] = {}
    lon = 0
    for i in range(len(cols["lon"])):
        lon += cols["lon"][i]
        row = {"lon": lon * 0.01, "lat": cols["lat"][i] * 0.01, "zh": cols["zh"][i], "en": cols["en"][i], "role": cols["role"][i]}
        out.setdefault(cols["iso3"][i], []).append(row)
    for rows in out.values():
        rows.sort(key=lambda r: ROLE_ORDER.get(r["role"], 9))
    return out


def _zone(iso3: str, iso2: str | None, lat: float, lon: float, ne: dict) -> str | None:
    """首都的 IANA 時區（旅行實用主題的規則）"""
    if iso3 in TZ_OVERRIDES:
        return TZ_OVERRIDES[iso3]
    own = iana_tz.zones_by_country().get(iso2 or "", [])
    cap = ne.get(iso3)
    # Natural Earth 的首都跟這裡用的是同一個地方（300 km 內，有好幾個首都的國家可能取了另一個）時用它的 TIMEZONE
    if cap and (not own or cap[3] in {z.name for z in own}) and _km(lat, lon, cap[1], cap[2]) < 300:
        return cap[3]
    if own:
        return min(own, key=lambda z: _km(lat, lon, z.lat, z.lon)).name
    return cap[3] if cap else None


# 有好幾個時區（zone.tab）但官方只用一個的國家
SINGLE_ZONE = {"CHN"}

# 一條緯線切成幾段：一整條從 −180° 到 180° 的直線（Web Mercator 上是水平的），MapLibre 的 GeoJSON 圖磚在低縮放時
# 只有含起點的那幾張圖磚畫得出來（2026-10-28 實測：東半球那一張整條不見），切成 30° 一段就正常
CIRCLE_SEGMENT = 30


def _circle(lat: float) -> list[list[tuple[float, float]]]:
    return [
        [(float(lon), lat) for lon in range(start, start + CIRCLE_SEGMENT + 1)]
        for start in range(-180, 180, CIRCLE_SEGMENT)
    ]


def build() -> None:
    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        countries = json.load(f)
    with open(OUT_DIR / "geo" / "countries-50m.json", encoding="utf-8") as f:
        map_ids = {g["id"] for g in json.load(f)["objects"]["countries"]["geometries"]}
    units = sorted(map_ids | {"TUV", "TKL", "GIB"})
    profile = _profile_capitals()
    ne = ne_capitals()

    capitals: dict[str, list] = {}
    others: dict[str, list] = {}
    missing = []
    for iso3 in units:
        rows = profile.get(iso3, [])
        if iso3 in CAPITAL_OVERRIDES:
            rows = sorted(rows, key=lambda r: r["en"] != CAPITAL_OVERRIDES[iso3])
        kind = CAPITAL
        if iso3 in MAIN_TOWNS:
            zh, en, lat, lon = MAIN_TOWNS[iso3]
            kind = MAIN_TOWN
        elif rows:
            main = rows[0]
            lat, lon, zh, en = main["lat"], main["lon"], main["zh"] or main["en"], main["en"] or main["zh"]
            if len(rows) > 1:
                others[iso3] = [[r["zh"] or r["en"], r["en"] or r["zh"], r["role"] or ""] for r in rows[1:]]
        elif iso3 in ne:
            en, lat, lon, _tz = ne[iso3]
            zh = None
        else:
            missing.append(iso3)
            continue
        zh, en = NAME_OVERRIDES.get(iso3, (zh, en))
        iso2 = countries.get(iso3, {}).get("iso2")
        zone = _zone(iso3, iso2, lat, lon, ne)
        if not zone:
            missing.append(iso3)
            continue
        std, _dst = iana_tz.offsets(zone, YEAR)
        capitals[iso3] = [round(lat, 2), round(lon, 2), zone, round(std * 60), zh, en, kind]
    if missing:
        print(f"  沒有首都（或時區）的地圖區域，不算：{missing}")

    # 有好幾個時區的國家（zone.tab）：滑到地圖上任一點時，取國內代表地點最近的那個時區（2026-10-30 起）。
    # 中國官方只有北京時間（zone.tab 另有新疆的 Asia/Urumqi），照首都
    zones: dict[str, list] = {}
    by_country = iana_tz.zones_by_country()
    for iso3 in capitals:
        own = by_country.get(countries.get(iso3, {}).get("iso2") or "", [])
        if len(own) > 1 and iso3 not in SINGLE_ZONE:
            zones[iso3] = [
                [z.name, round(z.lat, 2), round(z.lon, 2), round(iana_tz.offsets(z.name, YEAR)[0] * 60)] for z in own
            ]

    polar = {}
    for iso3, (zh, en, lat, lon, zone) in POLAR_PLACES.items():
        std, _dst = iana_tz.offsets(zone, YEAR)
        polar[iso3] = [lat, lon, zone, round(std * 60), zh, en]

    write_json(
        OUT / "capitals.json",
        {
            # std：標準時間的 UTC 偏移（分鐘）；kind：1 首都、2 沒有首都的地區的主要城鎮
            "fields": ["lat", "lon", "zone", "std", "zh", "en", "kind"],
            "capitals": capitals,
            # 有好幾個首都的國家，其他首都 [中文, 英文, 角色]（角色見 src/topics/profiles.ts 的 CAPITAL_ROLES）
            "others": others,
            "polar": polar,
            # 有好幾個時區的國家：[IANA 時區, 代表地點的緯度, 經度, 標準時間的 UTC 偏移（分鐘）]
            "zones": zones,
            "tzdata": iana_tz.VERSION,
        },
    )

    # ── 赤道、回歸線、極圈 ──
    tropic = round(OBLIQUITY, 4)
    polar_circle = round(90 - OBLIQUITY, 4)
    circles = [
        (0.0, 1, "赤道", "Equator"),
        (tropic, 2, "北回歸線", "Tropic of Cancer"),
        (-tropic, 2, "南回歸線", "Tropic of Capricorn"),
        (polar_circle, 3, "北極圈", "Arctic Circle"),
        (-polar_circle, 3, "南極圈", "Antarctic Circle"),
    ]
    write_json(
        OUT / "circles.json",
        lines_file(
            [seg for lat, *_ in circles for seg in _circle(lat)],
            quantum=0.0001,
            types=[k for _lat, k, *_ in circles for _ in _circle(0)],
            # 同一條緯線的各段紀錄相同，滑過時整條一起標出
            records=[{"lat": lat, "k": k, "n": zh, "e": en} for lat, k, zh, en in circles for _ in _circle(0)],
            record_fields=["lat", "k", "n", "e"],
            record_scale={"lat": 0.0001, "k": 1},
        ),
    )
    write_json(OUT / "manifest.json", {"generatedAt": now_iso(), "tzdata": iana_tz.VERSION, "obliquity": tropic})

    tw = capitals.get("TWN")
    print(f"  首都 {len(capitals)} 個（其他首都 {len(others)} 國）、極區參考地點 {len(polar)} 個；台灣：{tw}")
    print(f"  黃赤交角 {tropic}°（回歸線），極圈 {polar_circle}°；tzdata {iana_tz.VERSION}")
    # 時鐘和太陽的差（標準時間）：幾個常被拿來講的國家
    for iso3 in ("CHN", "ESP", "IND", "ARG", "TWN", "ISL", "FRA", "RUS"):
        c = capitals.get(iso3)
        if c:
            diff = c[3] / 60 - c[1] / 15
            diff = (diff + 12) % 24 - 12
            print(f"  {iso3} {c[5]}（{c[2]}，UTC{c[3] / 60:+g}）：平均太陽正午比 12:00 {'晚' if diff > 0 else '早'} {abs(diff) * 60:.0f} 分")
    assert math.isfinite(OBLIQUITY)
