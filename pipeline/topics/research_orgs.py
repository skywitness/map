"""全世界的研究機構在哪裡（新主題，2026-11-07，製作手冊第二十七批 597，候選 1321；步驟 research-orgs，
輸出 topics/research-orgs/）。

- ROR（Research Organization Registry）v2.15 的 Zenodo 資料傾印（CC0；https://zenodo.org/records/23500708，
  robots.txt 允許 /api/records/*/files，Crawl-delay 10，只下載一次 39 MB 的 zip）。只收 status=active（143,297 個），
  inactive 1,978、withdrawn 1,441 不收。
- 類型：一個機構可以有好幾個（funder 常跟別的並列），取第一個不是 funder 的當主要類型，只有 funder 的才算資助機構；
  檔案館（archive）併進「其他」，地圖最多 8 色。
- 座標是 GeoNames 的城市中心，同一城市的機構疊在一起，所以依城市（geonames_id）群聚成點：機構數、最多的類型。
- 手冊的陷阱：ROR 是社群維護的註冊表，收多少取決於有沒有人登錄（日本比中國多是登錄偏差）；「企業」是出現在論文
  掛名裡的公司。每百萬人用 WPP 2026 年的人口，人口不到 10 萬的不算人均。
- 候選 1324（re3data 的資料典藏庫）：re3data.org 從 cloud 連線被重設，交給本機 session，到了再做。
"""
from __future__ import annotations

import csv
import zipfile
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, points_file, write_json
from common import write_points
from sources import wpp
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "research-orgs"
URL = "https://zenodo.org/api/records/23500708/files/v2.15-2026-10-20-ror-data.zip/content"
NAME = "v2.15-2026-10-20-ror-data"
YEAR = 2026
TYPES = ["education", "company", "healthcare", "nonprofit", "facility", "government", "funder", "other"]
MIN_POPULATION = 100  # 千人


def _rows():
    path = download(URL, "ror", f"{NAME}.zip")
    with zipfile.ZipFile(path) as z, z.open(f"{NAME}.csv") as f:
        yield from csv.DictReader((line.decode("utf-8") for line in f))


def _primary(types: str) -> str:
    ts = [t.strip() for t in types.split(";") if t.strip()]
    main = next((t for t in ts if t != "funder"), "funder" if "funder" in ts else "other")
    return main if main in TYPES else "other"


def build() -> None:
    per_country: dict[str, Counter] = defaultdict(Counter)
    cities: dict[str, dict] = {}
    for r in _rows():
        if r["status"] != "active":
            continue
        iso3 = from_alpha2(r["locations.geonames_details.country_code"])
        if not iso3:
            continue
        t = _primary(r["types"])
        per_country[iso3][t] += 1
        g = r["locations.geonames_id"]
        if r["locations.geonames_details.lat"] and r["locations.geonames_details.lng"]:
            city = cities.setdefault(g, {"lon": float(r["locations.geonames_details.lng"]), "lat": float(r["locations.geonames_details.lat"]),
                                         "city": r["locations.geonames_details.name"], "iso3": iso3, "types": Counter()})
            city["types"][t] += 1
    points = []
    for c in cities.values():
        n = sum(c["types"].values())
        top = c["types"].most_common(1)[0][0]
        points.append({"lon": round(c["lon"], 3), "lat": round(c["lat"], 3), "n": n, "t": TYPES.index(top) + 1,
                       "e": c["types"].get("education", 0), "co": c["types"].get("company", 0), "city": c["city"], "iso3": c["iso3"]})
    points.sort(key=lambda p: -p["n"])
    data = points_file(points, ["lon", "lat", "n", "t", "e", "co", "iso3", "city"],
                       {"lon": 0.001, "lat": 0.001, "n": 1, "t": 1, "e": 1, "co": 1}, strings=("iso3",))
    write_points(OUT / "cities.json", data, text=("city",))

    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items() if YEAR in s}
    totals = {c: sum(v.values()) for c, v in per_country.items()}
    hints = {c: "、".join(f"{k} {v:,}" for k, v in per_country[c].most_common(3)) for c in per_country}
    write_json(OUT / "orgs.json", indicator_file("research-orgs", "個", [YEAR], {c: [n] for c, n in sorted(totals.items())}, license="CC0"))
    per_m = {c: [round(n / pop[c] * 1000, 2)] for c, n in sorted(totals.items()) if pop.get(c, 0) >= MIN_POPULATION}
    write_json(OUT / "orgs-per-million.json", indicator_file("research-orgs-per-million", "個／百萬人", [YEAR], per_m, license="CC0"))
    detail = {c: {"types": [per_country[c].get(t, 0) for t in TYPES],
                  "cities": [[p["city"], p["n"]] for p in points if p["iso3"] == c][:10]} for c in per_country}
    write_json(OUT / "detail.json", {"types": TYPES, "countries": detail, "license": "CC0"})

    print(f"  {sum(totals.values()):,} 個機構、{len(totals)} 國、{len(points):,} 個城市")
    print(f"  最多：{sorted(((n, c) for c, n in totals.items()), reverse=True)[:12]}；台灣 {totals.get('TWN')}")
    print(f"  每百萬人：{sorted(((v[0], c) for c, v in per_m.items()), reverse=True)[:10]}；台灣 {per_m.get('TWN')}")
    print(f"  類型：{sum(per_country.values(), Counter()).most_common()}")
    print(f"  台灣：{per_country['TWN'].most_common()}；城市 {detail['TWN']['cities'][:5]}")
    print(f"  最大的城市點：{[(p['city'], p['iso3'], p['n']) for p in points[:8]]}")
