"""留學生的流向（2026-11-04，主題盤點的擴3，放在教育程度主題；前端 src/topics/education.ts 讀 ../student-mobility/）。

資料：UNESCO 統計研究所（UIS）的公開 API（https://api.uis.unesco.org/api/public/data/indicators?indicator=…，
免登入免金鑰；UIS 資料是 CC BY-SA 4.0，資料檔同樣授權，見 DESIGN.md 第 8 節第 115 點）：
- 各國收的國際學生依來源國：「Inbound internationally mobile students from <洲>: Students from <國>, both sexes」，
  一個來源國一個指標（約 210 個，代碼 26421–26630 一帶），數值是收學生的國家通報的大專（ISCED 5–8）學生數。
  指標清單從 API 的 definitions 讀，名稱對到 ISO 代碼；「unknown countries」與已經不存在的「Sudan (pre-secession)」不收。
- 總數與比率：26637 收的國際學生總數（含來源不明的）、OE.5T8.40510 出國的學生總數（UIS 依各收學生國的通報估計）、
  MSEP.5T8 收的國際學生占該國大專學生的比例、MOR.5T8.40510 出國的學生占本國大專學生的比例。
台灣不在 UIS 裡（不是會員），不會出現在地圖上，也不會是來源國；說明寫明。

輸出 public/data/topics/student-mobility/：
- inbound.json、outbound.json、inbound-rate.json、outbound-ratio.json（指標檔，latestWithin 3：很多國家隔幾年才通報）
- flows/<年>.json：每個國家前 15 大來源（import：來這國讀書的學生從哪裡來）與去向（export：這國的學生去哪裡讀書，
  由各收學生國的通報反推，只含有通報的國家）。很多國家隔幾年才通報依來源國的明細（美國 2019、2022 年沒有，中國從來沒有），
  所以每個收學生的國家用那一年以前 3 年內最近一年的明細（跟指標檔的 latestWithin 一樣），一直做到指標檔的最後一年
"""
from __future__ import annotations

import json
import re
import time
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, now_iso, to_series, write_json
from sources.countries import from_name, to_iso3

API = "https://api.uis.unesco.org/api/public"
DATA_URL = API + "/data/indicators?geoUnitType=NATIONAL&" + "{}"
OUT = OUT_DIR / "topics" / "student-mobility"
TOP_N = 15
LATEST_WITHIN = 3
# 一次查幾個指標（URL 不要太長，API 也比較快回應）
BATCH = 20

TOTALS = {
    "inbound": ("26637", "人"),
    "outbound": ("OE.5T8.40510", "人"),
    "inbound-rate": ("MSEP.5T8", "%"),
    "outbound-ratio": ("MOR.5T8.40510", "%"),
}

BILATERAL = re.compile(r"^Inbound internationally mobile students from [^:]+: Students from (.+), both sexes \(number\)$")
# UIS 的國名 pycountry 對不到或會對錯的
NAMES = {
    "the Democratic Republic of the Congo": "COD",
    "the Congo": "COG",
    "the United Republic of Tanzania": "TZA",
    "the Democratic People's Republic of Korea": "PRK",
    "the Republic of Korea": "KOR",
    "Hong Kong, Special Administrative Region of China": "HKG",
    "Macao, Special Administrative Region of China": "MAC",
    "the Lao People's Democratic Republic": "LAO",
    "the Republic of Moldova": "MDA",
    "the Russian Federation": "RUS",
    "Cape Verde": "CPV",
    "Swaziland": "SWZ",
    "Eswatini": "SWZ",
    "the former Yugoslav Republic of Macedonia": "MKD",
    "North Macedonia": "MKD",
    "Turkey": "TUR",
    "Türkiye": "TUR",
    "Côte d'Ivoire": "CIV",
    "Iran (Islamic Republic of)": "IRN",
    "Bolivia (Plurinational State of)": "BOL",
    "Venezuela (Bolivarian Republic of)": "VEN",
    "Micronesia (Federated States of)": "FSM",
    "Palestine": "PSE",
    "Kosovo": "XKX",
}
# 已經不存在的（荷屬安地列斯 2010 年解散、蘇丹 2011 年分治前）不收
SKIP = {"unknown countries", "Sudan (pre-secession)", "the Netherlands Antilles"}


def _get(query: str, name: str) -> dict:
    """查一次 API（快取在 .cache/uis/），新的查詢之間隔 1 秒"""
    path = download(DATA_URL.format(query), "uis", name)
    return json.loads(path.read_text(encoding="utf-8"))


def _origins() -> dict[str, str]:
    """雙邊指標的代碼 → 來源國的 ISO 代碼"""
    defs = json.loads(download(API + "/definitions/indicators", "uis", "definitions.json").read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    missing = []
    for d in defs:
        m = BILATERAL.match(d.get("name") or "")
        if not m:
            continue
        name = m.group(1).strip()
        if name in SKIP:
            continue
        iso3 = NAMES.get(name) or from_name(name.removeprefix("the "))
        if not iso3:
            missing.append(name)
            continue
        if iso3 in out.values():
            raise RuntimeError(f"UIS 的來源國 {name} 對到的 {iso3} 重複了")
        out[d["indicatorCode"]] = iso3
    if missing:
        raise RuntimeError(f"UIS 的來源國名稱對不到代碼（加進 NAMES）：{missing}")
    return out


def _records(codes: list[str], tag: str) -> list[dict]:
    out = []
    for i in range(0, len(codes), BATCH):
        part = codes[i : i + BATCH]
        name = f"mobility-{tag}-{i // BATCH:02d}.json"
        cached = (CACHE_DIR / "uis" / name).exists()
        out += _get("&".join(f"indicator={c}" for c in part), name)["records"]
        if not cached:
            time.sleep(1)
    return out


def _totals_cache(_origins: dict[str, str]) -> dict[str, dict[str, dict[int, float]]]:
    """總數與比率：{指標: {iso3: {年: 值}}}"""
    totals: dict[str, dict[str, dict[int, float]]] = {k: {} for k in TOTALS}
    by_code = {code: key for key, (code, _unit) in TOTALS.items()}
    for r in _records([c for c, _u in TOTALS.values()], "totals"):
        iso3 = to_iso3(r["geoUnit"])
        if iso3 and r["value"] is not None:
            totals[by_code[r["indicatorId"]]].setdefault(iso3, {})[int(r["year"])] = float(r["value"])
    return totals


def build() -> None:
    origins = _origins()
    print(f"  UIS 的來源國指標 {len(origins)} 個")
    # 各收學生國每一年依來源國的明細：{host: {year: {origin: n}}}
    reported: dict[str, dict[int, dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
    for r in _records(sorted(origins), "bilateral"):
        host = to_iso3(r["geoUnit"])
        if not host or r["value"] is None:
            continue
        origin = origins[r["indicatorId"]]
        if origin != host:
            reported[host][int(r["year"])][origin] = float(r["value"])
    first = min(y for h in reported.values() for y in h)
    own = defaultdict(int)
    for h in reported.values():
        for y in h:
            own[y] += 1
    totals_years = [y for key in ("inbound", "outbound") for s in _totals_cache(origins).get(key, {}).values() for y in s]
    # 最後一年跟指標檔一樣（時間軸的最後一年也要有流向檔）；2025 年當年通報的只有 2 國，其他國家用 3 年內最近一年的明細
    last = max(max(own), *totals_years)
    pairs: dict[int, dict[tuple[str, str], float]] = {}
    for year in range(first, last + 1):
        year_pairs: dict[tuple[str, str], float] = {}
        for host, by_year in reported.items():
            usable = [y for y in by_year if year - LATEST_WITHIN <= y <= year]
            if usable:
                for origin, n in by_year[max(usable)].items():
                    year_pairs[(origin, host)] = n
        pairs[year] = year_pairs

    totals = _totals_cache(origins)

    years = list(range(first, max(last, *(y for s in totals["inbound"].values() for y in s)) + 1))
    for key, (code, unit) in TOTALS.items():
        digits = 0 if unit == "人" else 2
        values = {iso3: to_series(s, years, digits) for iso3, s in totals[key].items()}
        write_json(OUT / f"{key}.json", indicator_file(key, unit, years, values, latestWithin=LATEST_WITHIN), quiet=True)

    for year, year_pairs in sorted(pairs.items()):
        by: dict[str, dict[str, dict[str, float]]] = {"export": defaultdict(dict), "import": defaultdict(dict)}
        for (origin, host), n in year_pairs.items():
            by["export"][origin][host] = n
            by["import"][host][origin] = n
        data: dict[str, object] = {"item": "students", "year": year, "unit": "人", "scale": 1}
        for direction, countries in by.items():
            total_key = "outbound" if direction == "export" else "inbound"
            entries = {}
            for country, partners in sorted(countries.items()):
                total = totals[total_key].get(country, {}).get(year) or sum(partners.values())
                ranked = sorted(((p, v) for p, v in partners.items() if v >= 0.5), key=lambda kv: -kv[1])[:TOP_N]
                if ranked:
                    entries[country] = [round(total), [[p, round(v)] for p, v in ranked]]
            data[direction] = entries
        write_json(OUT / "flows" / f"{year}.json", data, quiet=True)

    write_json(
        OUT / "manifest.json",
        {
            "topic": "student-mobility",
            "generatedAt": now_iso(),
            "source": "UNESCO Institute for Statistics (UIS), international student mobility",
            "sourceUrl": "https://api.uis.unesco.org/api/public/documentation/",
            "license": "CC BY-SA 4.0",
            "years": [years[0], years[-1]],
        },
    )
    hosts = {h for (_o, h) in pairs[last]}
    print(f"  雙邊 {first}–{last} 年（{last} 年當年通報的 {own[last]} 國）；{last} 年 {len(hosts)} 個收學生的國家、{len(pairs[last])} 組")
    usa = totals["inbound"].get("USA", {})
    chn = totals["outbound"].get("CHN", {})
    print(f"  美國收的國際學生 {max(usa)} 年 {usa[max(usa)]:,.0f}；中國出國 {max(chn)} 年 {chn[max(chn)]:,.0f}")
