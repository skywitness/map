"""休閒運動場地：三溫暖、滑冰場、保齡球館、飛行傘與跳傘、海水浴場與泳區、獨木舟（2026-11-07，製作手冊第二十四批 428；
步驟 leisure-venues，輸出 topics/diving/，接在「戶外運動場地：潛水與攀岩」）。

- 資料：OpenStreetMap 經 QLever（sources/osm_qlever.py；ODbL 1.0，© OpenStreetMap contributors），2026 年 11 月的快照，
  一個標籤一支查詢、依序跑：leisure=sauna、ice_rink、bowling_alley、beach_resort、swimming_area，
  sport=free_flying（飛行傘與滑翔翼的起降場；手冊更正過，不是 sport=paragliding）、paragliding、parachuting、canoe。
  面與線取所有頂點的平均當代表點；同一個物件落在兩個重疊國界裡的只留一個點，各國個數兩邊都算（跟山屋一樣）。
- 點全部畫；各國的每十萬人只替 OSM 覆蓋良好的國家上色（sources/osm_coverage.py 的共用名單），其他國家寫原因。
  人口用人口主題的 WPP 2024 最近一年。輸出的點（名稱、位置）是 OSM 的衍生資料庫，依 ODbL 1.0 分享。
- **滑冰場的陷阱**：台灣的 leisure=ice_rink 大部分是旱冰（直排輪、滑輪溜冰）場。sport 標籤寫 roller_skating、
  skateboard 這類的，或名稱有「滑輪」「直排輪」「roller」「inline」的，全世界都不算冰場；台灣再逐筆看名稱，只留
  真冰場（TW_ICE，依名稱與 sport=ice_skating 判斷），其他當旱冰場不算。熱帶國家的抽查結果寫在 DESIGN.md。
- 台灣的海水浴場在 OSM 多半標成 natural=beach，所以另畫交通部觀光署「具海洋遊憩活動之景點設施」（data.gov.tw 135722，
  政府資料開放授權條款第 1 版）的 41 處，只畫點、不算進各國個數。
"""
from __future__ import annotations

import csv
import io
import re
from collections import Counter

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_points
from sources import osm_coverage, osm_qlever
from topics.profiles import _read_indicator

OUT = OUT_DIR / "topics" / "diving"
YEAR = 2026
EXTRA = ("name", "name:zh", "name:en", "sport")
TW_MARINE = "https://media.taiwan.net.tw/od/04_TD/具海洋遊憩活動之景點設施.csv"
# 指標 → 點檔與 (key, value, 點的種類 k)
GROUPS: dict[str, tuple[str, list[tuple[str, str, int]]]] = {
    "saunas": ("saunas-points.json", [("leisure", "sauna", 1)]),
    "ice-rinks": ("ice-rinks-points.json", [("leisure", "ice_rink", 1)]),
    "bowling": ("bowling-points.json", [("leisure", "bowling_alley", 1)]),
    "free-flying": ("flying-points.json", [("sport", "free_flying", 1), ("sport", "paragliding", 1), ("sport", "parachuting", 2)]),
    "beach-resorts": ("beaches-points.json", [("leisure", "beach_resort", 1), ("leisure", "swimming_area", 2)]),
    "canoe": ("canoe-points.json", [("sport", "canoe", 1)]),
}
# 各國個數的指標 → 算進去的 (key, value)
COUNTED = {
    "saunas": [("leisure", "sauna")],
    "ice-rinks": [("leisure", "ice_rink")],
    "bowling": [("leisure", "bowling_alley")],
    "free-flying": [("sport", "free_flying"), ("sport", "paragliding")],
    "parachuting": [("sport", "parachuting")],
    "beach-resorts": [("leisure", "beach_resort")],
    "swimming-areas": [("leisure", "swimming_area")],
    "canoe": [("sport", "canoe")],
}
ROLLER_SPORT = re.compile(r"roller|inline|skateboard|滑輪|直排", re.I)
ROLLER_NAME = re.compile(r"滑輪|直排輪|輪滑|roller|inline", re.I)
# 巴西、哥倫比亞的「Patins」「Patinação」「Pista de Patinaje」「Patinódromo」多半是滑輪場（名稱有冰 hielo、gelo、ice 的不算）
ROLLER_LATIN = re.compile(r"patin(?:s\b|ação|aje|[oó]dromo)", re.I)
ICE_WORD = re.compile(r"hielo|gelo|\bice\b|glace", re.I)
# 台灣 70 筆 leisure=ice_rink 逐筆看過（2026-11-07）：名稱是「溜冰場」「滑輪溜冰」「直排輪」的都是旱冰場，
# 中原大學超巨溜冰場、永和獅子溜冰場、微笑公園溜冰場雖然 sport 寫 ice_skating 也是旱冰場（手冊列的旱冰例子），
# 沒有名稱的看不出是什麼；只有桃園滑冰運動世界是真冰場。台北小巨蛋等其他真冰場在 OSM 沒有標成 ice_rink。
TW_ICE = {"w1272174835"}


def _id(osm: str) -> str:
    return osm.rsplit("/", 2)[-2][0] + osm.rsplit("/", 1)[-1]


def _is_roller(r: dict) -> bool:
    if ROLLER_SPORT.search(r["sport"]) and not re.search(r"ice|hockey|curling", r["sport"], re.I):
        return True
    if ROLLER_NAME.search(r["name"]) or ROLLER_NAME.search(r["name:zh"]):
        return True
    if ROLLER_LATIN.search(r["name"]) and not ICE_WORD.search(r["name"]):
        return True
    return r["iso3"] == "TWN" and _id(r["osm"]) not in TW_ICE


def _coords(px: str, py: str) -> tuple[float, float] | None:
    """觀光署的 Px、Py：多半是十進位度，13 筆寫成度分秒（「121°55'03.5"E」，內埤沙灘兩個值都寫在 Px）；
    台灣的經度大於 100、緯度小於 30，依大小分"""
    try:
        return float(px), float(py)
    except ValueError:
        pass
    vals = [int(d) + int(m) / 60 + float(sec) / 3600
            for d, m, sec in re.findall(r"(\d+)°\s*(\d+)['′]\s*([\d.]+)", f"{px} {py}")]
    lon = [v for v in vals if v > 100]
    lat = [v for v in vals if v < 30]
    return (lon[0], lat[0]) if len(lon) == 1 and len(lat) == 1 else None


def _tw_marine() -> list[dict]:
    raw = download(TW_MARINE, "tw-marine", "marine-sites.csv").read_bytes().decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(raw)))
    out = []
    for r in rows:
        c = _coords(r["Px"], r["Py"])
        if not c:
            print(f"    觀光署：{r['CName']} 的座標讀不出來（{r['Px']!r}, {r['Py']!r}）")
            continue
        lon, lat = c
        out.append({"lon": round(lon, 4), "lat": round(lat, 4), "k": 3, "iso3": "TWN", "n": None,
                    "nz": r["CName"].strip() or None, "ne": r["EName"].strip() or None, "id": f"tw{len(out) + 1}"})
    return out


def build() -> None:
    rows: dict[tuple[str, str], list[dict]] = {}
    for _, tags in GROUPS.values():
        for key, value, _k in tags:
            rows[(key, value)] = osm_qlever.features(key, value, EXTRA)

    # 台灣的滑冰場逐筆列出來給人看（TW_ICE 要依這份清單手工維護）
    tw_rinks = [r for r in rows[("leisure", "ice_rink")] if r["iso3"] == "TWN"]
    print(f"  台灣的 leisure=ice_rink：{len(tw_rinks)} 筆")
    for r in sorted(tw_rinks, key=lambda r: r["name"]):
        print(f"    {_id(r['osm'])}\t{r['sport'] or '-'}\t{r['name'] or r['name:zh'] or '（沒有名稱）'}")

    roller = {(r["osm"], r["iso3"]) for r in rows[("leisure", "ice_rink")] if _is_roller(r)}
    for ind, (file, tags) in GROUPS.items():
        points: dict[str, dict] = {}
        for key, value, k in tags:
            for r in rows[(key, value)]:
                if r["osm"] in points or (key, value) == ("leisure", "ice_rink") and (r["osm"], r["iso3"]) in roller:
                    continue
                c = osm_qlever.centroid(r["wkt"])
                if not c:
                    continue
                points[r["osm"]] = {"lon": round(c[0], 4), "lat": round(c[1], 4), "k": k, "iso3": r["iso3"],
                                    "n": r["name"] or None, "nz": r["name:zh"] or None, "ne": r["name:en"] or None,
                                    "id": _id(r["osm"])}
        pts = sorted(points.values(), key=lambda p: (p["iso3"], p["lon"]))
        if ind == "beach-resorts":
            pts += _tw_marine()
        data = points_file(pts, ["lon", "lat", "k", "iso3", "n", "nz", "ne", "id"],
                           {"lon": 0.0001, "lat": 0.0001, "k": 1}, strings=("iso3",))
        write_points(OUT / file, data, text=("n", "nz", "ne", "id"))
        print(f"  {file}：{len(pts)} 點")

    cov = osm_coverage.coverage()
    covered = osm_coverage.well_covered()
    population = _read_indicator(OUT_DIR / "topics" / "population" / "total.json")
    pop_year = max(y for y in population["years"] if y <= 2025)
    pop = {c: v[population["years"].index(pop_year)] for c, v in population["values"].items()}
    for ind, tags in COUNTED.items():
        n: Counter = Counter()
        for key, value in tags:
            seen = set()
            for r in rows[(key, value)]:
                if (r["osm"], r["iso3"]) in seen or (key, value) == ("leisure", "ice_rink") and (r["osm"], r["iso3"]) in roller:
                    continue
                seen.add((r["osm"], r["iso3"]))
                n[r["iso3"]] += 1
        no_value, no_value_en = {}, {}
        for c in n:
            if c not in covered:
                no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
        per = {c: [round(v / pop[c] * 100_000, 3)] for c, v in sorted(n.items()) if c in covered and pop.get(c)}
        hints = {c: f"OpenStreetMap 上有 {v:,} 處" for c, v in n.items()}
        hints_en = {c: f"{v:,} on OpenStreetMap" for c, v in n.items()}
        if ind == "ice-rinks":
            tw_roller = sum(1 for r in tw_rinks if (r["osm"], r["iso3"]) in roller)
            hints["TWN"] = f"OpenStreetMap 上有 {n.get('TWN', 0)} 處真冰場；另有 {tw_roller} 處標成冰場的其實是旱冰（直排輪、滑輪溜冰）場，不算"
            hints_en["TWN"] = f"{n.get('TWN', 0)} ice rinks on OpenStreetMap; another {tw_roller} tagged as ice rinks are roller rinks and are not counted"
        write_json(OUT / f"{ind}.json", indicator_file(
            ind, "處／十萬人", [YEAR], per, hints=dict(sorted(hints.items())), hintsEn=dict(sorted(hints_en.items())),
            noValue=no_value, noValueEn=no_value_en, license="ODbL 1.0"))
        top = n.most_common(15)
        top_per = sorted(((v[0], c) for c, v in per.items()), reverse=True)[:12]
        print(f"  {ind}：{sum(n.values()):,} 處、{len(n)} 國；最多 {top}；台灣 {n.get('TWN')}")
        print(f"    每十萬人（上色 {len(per)} 國）{top_per}；台灣 {per.get('TWN')}；日本 {per.get('JPN')}；南韓 {per.get('KOR')}；德國 {per.get('DEU')}")
    print(f"  滑冰場當旱冰剔除 {len(roller)} 筆：{Counter(c for _, c in roller).most_common(12)}")
