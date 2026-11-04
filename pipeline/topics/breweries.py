"""菸酒的擴充：啤酒廠與精釀酒廠（2026-11-04，製作手冊第二十一批 370）。

兩份都不完整、不完整的方式不同的清冊，兩份都畫、說明寫明：
- OpenStreetMap 的 craft=brewery（經 QLever，sources/osm_qlever.py；ODbL）：各國比較均衡但量偏低。各國每百萬人的家數
  只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py）；點全部畫（面與線取中心）。
- Open Brewery DB（MIT 授權，GitHub 的 breweries.csv）：23 國、美國占三分之二，法國 3 家、日本 10 家是沒有建置
  不是真的少，所以只畫點、不做各國比較；去掉已歇業（closed）、籌備中（planning）與不是酒廠的類別（bar、beergarden、cidery）。
台灣：OSM 有 5 處，Open Brewery DB 沒有台灣。
"""
from __future__ import annotations

import csv

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_manifest_part
from sources import osm_coverage, osm_qlever, wpp
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "tobacco-alcohol"
YEAR = 2026
OBDB_URL = "https://raw.githubusercontent.com/openbrewerydb/openbrewerydb/master/breweries.csv"
OBDB_LICENSE_URL = "https://raw.githubusercontent.com/openbrewerydb/openbrewerydb/master/LICENSE"
OBDB_TYPES = {"micro", "nano", "brewpub", "regional", "large", "contract", "proprietor", "taproom"}
OBDB_COUNTRY = {"England": "GBR", "Scotland": "GBR", "Wales": "GBR", "Northern Ireland": "GBR", "Isle of Man": "IMN"}
MIN_POPULATION = 100  # 千人


def build() -> None:
    osm = osm_qlever.features("craft", "brewery", extra=("name", "name:zh", "name:en"))
    rows, seen = [], set()
    for r in osm:
        if r["osm"] in seen:
            continue
        seen.add(r["osm"])
        c = osm_qlever.centroid(r["wkt"])
        if c:
            rows.append({"lon": c[0], "lat": c[1], "k": 1, "iso3": r["iso3"], "n": r["name"], "nz": r["name:zh"], "ne": r["name:en"]})
    mit = download(OBDB_LICENSE_URL, "openbrewerydb", "LICENSE").read_text(encoding="utf-8").strip()
    obdb = 0
    with open(download(OBDB_URL, "openbrewerydb", "breweries.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["brewery_type"] not in OBDB_TYPES or not r["latitude"] or not r["longitude"]:
                continue
            iso3 = OBDB_COUNTRY.get(r["country"]) or from_name(r["country"])
            rows.append({"lon": round(float(r["longitude"]), 4), "lat": round(float(r["latitude"]), 4), "k": 2, "iso3": iso3 or "",
                         "n": r["name"], "nz": "", "ne": ""})
            obdb += 1
    rows.sort(key=lambda p: (p["iso3"], p["k"], p["n"] or "~"))
    data = points_file(rows, ["lon", "lat", "k", "iso3", "n", "nz", "ne"], {"lon": 0.0001, "lat": 0.0001, "k": 1}, strings=("iso3",))
    # k=1 是 OSM 的衍生資料庫（ODbL 1.0）；k=2 取自 Open Brewery DB，MIT 授權要求附上著作權與授權聲明
    data["license"] = {"k1": "ODbL 1.0, © OpenStreetMap contributors", "k2": mit}
    write_json(OUT / "breweries.json", data)
    # 各國每百萬人（OSM）
    n: dict[str, int] = {}
    for r in rows:
        if r["k"] == 1 and r["iso3"]:
            n[r["iso3"]] = n.get(r["iso3"], 0) + 1
    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items() if YEAR in s}
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    values, hints, hints_en, no_value, no_value_en = {}, {}, {}, {}, {}
    for c in sorted(set(n) | covered):
        if c not in pop:
            continue
        hints[c] = f"OpenStreetMap 上有 {n.get(c, 0):,} 處啤酒廠"
        hints_en[c] = f"{n.get(c, 0):,} breweries on OpenStreetMap"
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
        elif pop[c] < MIN_POPULATION:
            no_value[c] = "人口不到 10 萬，一兩家就差很多，不畫"
            no_value_en[c] = "Population under 100,000, too small for a stable rate, so not shown"
        else:
            values[c] = [round(n.get(c, 0) / pop[c] * 1000, 2)]  # 人口是千人：每百萬人 = 家數 ÷ 千人 × 1000
    write_json(OUT / "breweries-per-million.json", indicator_file(
        "breweries-per-million", "處／百萬人", [YEAR], values, hints=hints, hintsEn=hints_en, noValue=no_value,
        noValueEn=no_value_en, license="ODbL 1.0"))
    write_manifest_part(OUT, "tobacco-alcohol", "breweries", {
        "sources": ["© OpenStreetMap contributors (ODbL 1.0), via QLever", f"Open Brewery DB (MIT License), {OBDB_URL}"]})
    top = sorted(((v[0], c) for c, v in values.items()), reverse=True)
    print(f"  OSM 啤酒廠 {sum(n.values()):,} 處、{len(n)} 國；Open Brewery DB {obdb:,} 家；每百萬人 {top[:8]}；"
          f"台灣 {n.get('TWN')} 處 {values.get('TWN')}；美國 {n.get('USA')}、法國 {n.get('FRA')}、德國 {n.get('DEU')}、日本 {n.get('JPN')}")
