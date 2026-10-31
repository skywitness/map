"""地震與火山的擴充（第十四批順序 259，N28，2026-10-31）：NASA 全球山崩目錄（Global Landslide Catalog，GLC）的山崩事件。

**資料**：NASA Earthdata GIS 的「COOLR Reports Points」圖層
（https://gis.earthdata.nasa.gov/portal/rest/services/Landslides/COOLR_Reports_Points/FeatureServer/0 ），
`query?where=1=1&outFields=*&f=geojson&resultOffset=…&resultRecordCount=2000` 分 8 頁拿，共 14,750 點。
COOLR 有兩個來源：NASA 的 GLC（event_import_source = GLC，NASA Goddard 從 2007 年起整理新聞、災害資料庫與報告）與
民眾回報的 Landslide Reporter（LRC）；只用 GLC 的 11,452 筆。
**授權**：圖層的 licenseInfo「NASA Landslide Catalog (GLC) PERMISSION TO USE, REPRODUCE, AND DISTRIBUTE」（跟 Apache 2.0
同結構），准許商業與非商業使用與散布；引用 Kirschbaum et al. 2010、2015。
**陷阱**：country_name 不可靠（台灣範圍裡的 73 筆都寫 China），國家一律依座標重新判斷（geoindex.countries_at）。
**年份**：GLC 從 2007 年開始整理，之前只零星補了幾十筆（1915–2006 年），時間軸從 2007 年起，之前的不收（數量寫在說明）。

**輸出**（public/data/topics/earthquakes/）：
- landslides.json：點（經緯度、年份 y、月日 md、類別 c、成因 tr 與成因分組 g、規模 s、死亡 d、受傷 i、國家 iso3、地點 pl），依年份。
- landslides-count.json：各國每年的山崩事件數（指標，國家的值；沒有事件的國家是 0，資料最早到最晚的年份）。
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timezone

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_manifest_part
from geoindex import countries_at

OUT = OUT_DIR / "topics" / "earthquakes"
BASE = "https://gis.earthdata.nasa.gov/portal/rest/services/Landslides/COOLR_Reports_Points/FeatureServer/0/query"
PAGE = 2000
TOTAL = 14750
FIRST = 2007  # GLC 開始整理的年份；之前的零星紀錄不收
# 前端 src/topics/landslides.ts 的代碼要一致
CATEGORIES = ["landslide", "mudslide", "debris_flow", "rock_fall", "complex", "riverbank_collapse", "translational_slide",
              "lahar", "snow_avalanche", "earth_flow", "creep", "topple", "other", "unknown"]
TRIGGERS = ["downpour", "rain", "continuous_rain", "tropical_cyclone", "monsoon", "snowfall_snowmelt", "earthquake",
            "construction", "mining", "flooding", "freeze_thaw", "dam_embankment_collapse", "volcano", "leaking_pipe",
            "no_apparent_trigger", "other", "unknown"]
SIZES = ["small", "medium", "large", "very_large", "catastrophic", "unknown"]
# 地圖上色用的成因分組（g）：1 降雨（豪雨、降雨、連續降雨、季風、淹水）、2 颱風、3 地震與火山、
# 4 人為（工程、採礦、壩或堤防潰決、管線漏水）、5 其他與不明（融雪、凍融、沒有明顯成因、其他、不明）
TRIGGER_GROUPS = {"downpour": 1, "rain": 1, "continuous_rain": 1, "monsoon": 1, "flooding": 1, "tropical_cyclone": 2,
                  "earthquake": 3, "volcano": 3, "construction": 4, "mining": 4, "dam_embankment_collapse": 4,
                  "leaking_pipe": 4}
CITATION = ("Kirschbaum, D. B., Adler, R., Hong, Y., Hill, S., Lerner-Lam, A. (2010). A global landslide catalog for hazard "
            "applications: method, results, and limitations. Natural Hazards 52, 561–575; Kirschbaum, D., Stanley, T., Zhou, Y. "
            "(2015). Spatial and temporal analysis of a global landslide catalog. Geomorphology 249, 4–15. "
            "NASA Global Landslide Catalog (COOLR), NASA Goddard Space Flight Center, landslides.nasa.gov")


def _code(value: str | None, table: list[str]) -> int:
    v = (value or "unknown").strip().lower().replace(" ", "_")
    return table.index(v) if v in table else table.index("other") if "other" in table else len(table) - 1


def features() -> list[dict]:
    out = []
    for k, offset in enumerate(range(0, TOTAL + PAGE, PAGE)):
        url = f"{BASE}?where=1%3D1&outFields=*&f=geojson&resultOffset={offset}&resultRecordCount={PAGE}&orderByFields=objectid"
        with open(download(url, "nasa-glc", f"coolr-{k}.json"), encoding="utf-8") as f:
            page = json.load(f)["features"]
        out.extend(page)
        if len(page) < PAGE:
            break
    return out


def build() -> None:
    feats = features()
    ids = Counter(f["properties"]["objectid"] for f in feats)
    if len(feats) < TOTAL or any(n > 1 for n in ids.values()):
        raise RuntimeError(f"COOLR 只拿到 {len(feats)} 筆（應有 {TOTAL}），或 objectid 重複")
    glc = [f["properties"] for f in feats if (f["properties"].get("event_import_source") or "").upper() == "GLC"]
    rows, unknown_date, early = [], 0, 0
    for p in glc:
        lon, lat = p.get("longitude"), p.get("latitude")
        if lon is None or lat is None:
            continue
        ts = p.get("event_date")
        if ts is None:
            unknown_date += 1
            continue
        d = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
        if d.year < FIRST:
            early += 1
            continue
        place = ", ".join(x for x in (p.get("gazetteer_closest_point"), p.get("admin_division_name")) if x) or None
        rows.append({"lon": round(lon, 3), "lat": round(lat, 3), "y": d.year, "md": d.month * 100 + d.day,
                     "c": _code(p.get("landslide_category"), CATEGORIES), "tr": _code(p.get("landslide_trigger"), TRIGGERS),
                     "g": TRIGGER_GROUPS.get(TRIGGERS[_code(p.get("landslide_trigger"), TRIGGERS)], 5),
                     "s": _code(p.get("landslide_size"), SIZES), "d": p.get("fatality_count"), "i": p.get("injury_count"),
                     "pl": place})
    for r, iso3 in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])):
        r["iso3"] = iso3
    rows.sort(key=lambda r: (r["y"], r["md"]))
    write_json(OUT / "landslides.json", points_file(
        rows, ["lon", "lat", "y", "md", "c", "tr", "g", "s", "d", "i", "iso3", "pl"],
        {"lon": 0.001, "lat": 0.001, "y": 1, "md": 1, "c": 1, "tr": 1, "g": 1, "s": 1, "d": 1, "i": 1}, delta=("y",),
        strings=("iso3",)))
    years = list(range(min(r["y"] for r in rows), max(r["y"] for r in rows) + 1))
    count: dict[str, Counter] = defaultdict(Counter)
    for r in rows:
        if r["iso3"]:
            count[r["iso3"]][r["y"]] += 1
    write_json(OUT / "landslides-count.json", indicator_file(
        "landslides", "次", years, {c: [n.get(y, 0) for y in years] for c, n in sorted(count.items())},
        aggregates={"WLD": [sum(1 for r in rows if r["y"] == y) for y in years]}))
    write_manifest_part(OUT, "earthquakes", "landslides", {"source": CITATION, "records": len(rows), "license":
                        "NASA Landslide Catalog (GLC) Permission to Use, Reproduce, and Distribute"})
    tw = [r for r in rows if r["iso3"] == "TWN"]
    deaths = sum(r["d"] or 0 for r in rows)
    print(f"  GLC {len(glc)} 筆，{FIRST} 年起有日期與座標的 {len(rows)} 筆（{years[0]}–{years[-1]}；沒有日期的 {unknown_date}、{FIRST} 年以前的 {early}）；"
          f"死亡合計 {deaths:,}；台灣（依座標）{len(tw)} 筆；最多 {Counter(r['iso3'] for r in rows).most_common(6)}")
    print(f"  每年：{Counter(r['y'] for r in rows).most_common(8)}")


if __name__ == "__main__":
    build()
