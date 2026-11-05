"""各國水資源：都市汙水處理與汙水處理廠地圖（2026-11-05，製作手冊第二十二批 388；步驟 water-wastewater，輸出 topics/water-forest/）。

- 接到至少二級處理的人口比例：Eurostat env_ww_con 的 ww_tp=WWT_GE2、unit=PC（CC BY 4.0），歐洲約 38 國、1970 年起，
  多國最新的年份很舊（冰島 2010、盧森堡 2017），用 latestWithin。Eurostat 的條款：歐盟、EFTA、候選國以外的資料只准
  非商業使用，所以英國（UK、UKC-L）與科索沃（潛在候選國，不是正式候選國）不收；喬治亞 2023 年 12 月起是候選國，照收。
- 台灣：國土管理署「污水下水道用戶接管普及率」（data.gov.tw 26815，政府資料開放授權條款，113 年 = 2024 年）的全國
  公共污水下水道普及率 39.71%，跟歐洲的「接到都市汙水處理廠、至少二級處理」最接近；另外的專用下水道 14.58%、
  建築物污水設施 17.79%（合計 72.09%）不是集中處理，寫在附註，不加進地圖的值。
- 處理的都市汙水量、都市汙水處理廠數：AQUASTAT 批次檔（CC BY 4.0）的「Treated municipal wastewater」（十億立方公尺／年）、
  「Number of municipal wastewater treatment facilities」。AQUASTAT 的產生、收集、處理量是不同年份與口徑拼起來的，
  互除會出現 7500% 這種處理率，所以只畫絕對量、不算比例。
- 汙水處理廠的點：OpenStreetMap 的 man_made=wastewater_plant（經 QLever，sources/osm_qlever.py；ODbL 1.0）。
  OSM 的點同時在量各國畫得多完整（法國的小型村落處理廠被完整匯入，比美國多），只畫點、不算每百萬人。
  地圖縮小時只畫有名稱的（important），其餘放大才載入。
"""
from __future__ import annotations

import csv

from common import OUT_DIR, download, indicator_file, latest_year_span, to_series, write_json, write_layered_points
from sources import aquastat, eurostat, osm_qlever

OUT = OUT_DIR / "topics" / "water-forest"
WITHIN = 10
EXCLUDED = {"GBR", "UKC-L", "XKX"}  # Eurostat：歐盟、EFTA、候選國以外只准非商業
TW_URL = ("https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/C0A3F730-3F32-43EB-88DE-2F156E7FC4C0/"
          "resource/A2EEAD95-CC69-473C-BE3B-50EB477EB9B3/download")
TREATED = "Treated municipal wastewater"
FACILITIES = "Number of municipal wastewater treatment facilities"


def _taiwan() -> tuple[int, dict[str, float]]:
    path = download(TW_URL, "cpami", "sewer-connection.tsv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    row = next(r for r in rows if r["City"] == "全國")
    return int(row["year"]) + 1911, {k: float(row[k]) for k in ("pubsewer", "specializedsewer", "buildingfacilities", "Total")}


def build() -> None:
    conn = {c: s for c, s in eurostat.series("env_ww_con", freq="A", ww_tp="WWT_GE2", unit="PC").items() if c not in EXCLUDED}
    tw_year, tw = _taiwan()
    conn["TWN"] = {tw_year: tw["pubsewer"]}
    years = latest_year_span(conn, WITHIN)
    zh = (f"台灣用國土管理署的公共污水下水道普及率（{tw_year} 年 {tw['pubsewer']:.2f}%），跟歐洲「接到都市汙水處理廠」最接近；"
          f"另有專用下水道 {tw['specializedsewer']:.2f}%、建築物污水設施 {tw['buildingfacilities']:.2f}%，合計 {tw['Total']:.2f}%，"
          "後兩項不是集中處理，沒有算進來。")
    en = (f"Taiwan shows the National Land Management Agency’s public sewer connection rate ({tw['pubsewer']:.2f}% in {tw_year}), "
          f"the closest match to Europe’s connection to urban treatment plants; dedicated sewers ({tw['specializedsewer']:.2f}%) "
          f"and on-site building facilities ({tw['buildingfacilities']:.2f}%), for {tw['Total']:.2f}% in total, are not centralised "
          "treatment and are not included.")
    write_json(OUT / "wastewater-secondary.json", indicator_file(
        "wastewater-secondary", "%", years, {c: to_series(s, years, 2) for c, s in sorted(conn.items())},
        latestWithin=WITHIN, notes={"TWN": zh}, notesEn={"TWN": en},
    ))
    latest = {c: (max(s), s[max(s)]) for c, s in conn.items()}
    print(f"  二級處理普及率 {years[0]}–{years[-1]}：{len(conn)} 國；{sorted(latest.items(), key=lambda kv: -kv[1][1])[:5]}；"
          f"最低 {sorted(latest.items(), key=lambda kv: kv[1][1])[:5]}；台灣 {tw}")

    aq = aquastat.series({TREATED, FACILITIES})
    for key, var, digits in (("wastewater-treated", TREATED, 4), ("wastewater-facilities", FACILITIES, 0)):
        series, world = aq[var]
        series = {c: {y: v for y, v in s.items() if v > 0} for c, s in series.items()}
        series = {c: s for c, s in series.items() if s}
        ys = latest_year_span(series, WITHIN)
        write_json(OUT / f"{key}.json", indicator_file(
            key, "十億立方公尺" if key == "wastewater-treated" else "座", ys,
            {c: to_series(s, ys, digits) for c, s in sorted(series.items())}, latestWithin=WITHIN,
        ))
        lt = {c: (max(s), s[max(s)]) for c, s in series.items()}
        print(f"  {key}：{len(series)} 國；{sorted(lt.items(), key=lambda kv: -kv[1][1])[:6]}")

    feats = osm_qlever.features("man_made", "wastewater_plant", extra=("name",))
    rows, seen = [], set()
    for r in feats:
        if r["osm"] in seen:
            continue
        seen.add(r["osm"])
        c = osm_qlever.centroid(r["wkt"])
        if c:
            rows.append({"lon": c[0], "lat": c[1], "iso3": r["iso3"], "n": r["name"]})
    rows.sort(key=lambda p: (p["iso3"], p["lon"]))
    first, _more = write_layered_points(
        OUT / "wastewater-plants.json", rows, lambda r: bool(r["n"]), ["lon", "lat", "iso3", "n"],
        {"lon": 0.0001, "lat": 0.0001}, strings=("iso3",),
    )
    by_country: dict[str, int] = {}
    for r in rows:
        by_country[r["iso3"]] = by_country.get(r["iso3"], 0) + 1
    print(f"  OSM 汙水處理廠 {len(rows):,} 個、{len(by_country)} 國；{sorted(by_country.items(), key=lambda kv: -kv[1])[:8]}；台灣 {by_country.get('TWN')}")
