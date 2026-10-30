"""奧運場館（運動主題的擴充，2026-10-30，製作手冊第九批順序 161、DESIGN.md 第 8 節第 243 點）：各屆奧運的比賽場館。

使用者決定（2026-10-30）：「奧運我想加入各屆奧運場館的地點位置」。範圍（map cloud 定）：夏季、冬季都收，1896 年雅典到 2026 年
米蘭—科爾蒂納，加上已公布場館的 2028 洛杉磯、2030 法國阿爾卑斯、2032 布里斯本（標「預定」）；不收帕運、青年奧運；只收比賽場館
（不含選手村、轉播中心，只辦典禮的也不算）。台灣沒有辦過奧運（高雄世運、台北世大運不是奧運）。

**資料**：英文維基百科各屆的場館條目（sources/wiki_olympic_venues.py，CC BY-SA 4.0，固定版本）；場館的座標用 Wikidata（CC0，
沒有座標的退到地點 P276、所在行政區 P131，記成約略的位置）。同一個場館（同一個 Wikidata 項目）辦過好幾屆就併成一個點。
沒有連結的場館（早期的條目常常只寫名稱）查不到座標，不畫，數量印出來、寫在說明。

**輸出**（public/data/topics/sports/）：venues/<summer|winter>.json（場館的點：名稱、國家、辦過的屆、各屆的項目）、
venue-count/<summer|winter>.json（各國到這一屆為止用過的比賽場館數，累計；年份是各屆，預定的標推估）。
"""
from __future__ import annotations

from collections import defaultdict

import geoindex
from common import OUT_DIR, indicator_file, points_file, write_json, write_manifest_part
from sources import wiki_olympic_venues as wiki
from sources import wiki_racing

OUT = OUT_DIR / "topics" / "sports"

# 條目裡沒有連結的場館：查得到條目的手動對上（其他的不畫）
UNLINKED = {
    (1936, "Olympic Stadium"): "Olympiastadion (Berlin)",
    (1936, "Dietrich Eckart Open-Air Theatre"): "Waldbühne",
    (2022, "Genting Snow Park"): "Genting Resort Secret Garden",
}
# 依座標判斷的國家（geoindex）跟 Wikidata 的 P17 對不上、看過的（條目 → 國家）
COUNTRY_FIXES: dict[str, str] = {}


def build() -> None:
    raw: list[dict] = []
    dropped: list[tuple] = []
    for (season, year), _ in wiki.REVISIONS.items():
        for v in wiki.venues((season, year)):
            title = v.title or UNLINKED.get((year, v.label))
            if not title:
                dropped.append((season, year, v.label))
                continue
            raw.append({"season": season, "year": year, "title": title, "label": v.label, "sports": v.sports,
                        "planned": (season, year) in wiki.PLANNED})
    coords = wiki_racing.coordinates([r["title"] for r in raw])
    for r in raw:
        if r["title"] not in coords:
            dropped.append((r["season"], r["year"], r["label"]))
    raw = [r for r in raw if r["title"] in coords]

    # 同一個 Wikidata 項目（同一個場館）併成一個點；夏季、冬季分開
    by_key: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in raw:
        by_key[(r["season"], coords[r["title"]][2])].append(r)
    points: dict[str, list[dict]] = {"summer": [], "winter": []}
    for (season, qid), rs in by_key.items():
        rs.sort(key=lambda r: r["year"])
        lon, lat, _ = coords[rs[0]["title"]]
        years = sorted({r["year"] for r in rs})
        sports = {}
        for r in rs:
            if r["sports"]:
                sports[r["year"]] = r["sports"] if r["year"] not in sports else f"{sports[r['year']]}, {r['sports']}"
        points[season].append({
            "lon": lon, "lat": lat, "name": rs[-1]["label"], "qid": qid, "title": rs[-1]["title"],
            "approx": 1 if rs[-1]["title"] in wiki_racing.VIA else None,
            "first": years[0], "ed": ",".join(str(y) for y in years),
            "sp": "|".join(f"{y}:{s}" for y, s in sorted(sports.items())) or None,
        })
    allpts = points["summer"] + points["winter"]
    isos = geoindex.countries_at([p["lon"] for p in allpts], [p["lat"] for p in allpts])
    for p, iso3 in zip(allpts, isos):
        p["iso3"] = COUNTRY_FIXES.get(p["title"], iso3)
    wd = wiki_racing.item_countries([p["qid"] for p in allpts])
    for p in allpts:
        known = wd.get(p["qid"], set())
        if known and p["iso3"] not in known:
            print(f"  國家對不上：{p['title']} 依座標是 {p['iso3']}，Wikidata 是 {sorted(known)}")
        if p["iso3"] is None:
            raise ValueError(f"找不到國家：{p}")

    fields = ["lon", "lat", "name", "iso3", "first", "ed", "sp", "approx"]
    scale = {"lon": 0.0001, "lat": 0.0001, "first": 1, "approx": 1}
    summary = {}
    for season, pts in points.items():
        pts.sort(key=lambda p: p["first"])
        write_json(OUT / "venues" / f"{season}.json", points_file(pts, fields, scale, strings=("name",)))
        editions = sorted({y for (s, y) in wiki.REVISIONS if s == season})
        per: dict[str, list[int | None]] = {}
        for iso3 in {p["iso3"] for p in pts}:
            here = [p for p in pts if p["iso3"] == iso3]
            per[iso3] = [sum(1 for p in here if p["first"] <= y) or None for y in editions]
        planned = min(y for (s, y) in wiki.PLANNED if s == season)
        notes = {"TWN": "台灣沒有辦過奧運（2009 年高雄世界運動會、2017 年台北世界大學運動會不是奧運）。"}
        notes_en = {"TWN": "Taiwan has never hosted the Olympics (the 2009 World Games in Kaohsiung and the 2017 Universiade in Taipei are not Olympic Games)."}
        write_json(OUT / "venue-count" / f"{season}.json", indicator_file(
            "venues", "個", editions, per, projectionFrom=planned, notes=notes, notesEn=notes_en))
        summary[season] = {"venues": len(pts), "editions": len(editions)}
        top = sorted(((v[-1] or 0, k) for k, v in per.items()), reverse=True)[:6]
        multi = sorted(pts, key=lambda p: -len(p["ed"].split(",")))[:5]
        print(f"  {season}：{len(pts)} 個場館、{len(editions)} 屆；最多：{top}；辦最多屆：{[(p['name'], p['ed']) for p in multi]}")
    print(f"  沒有座標、不畫的 {len(dropped)} 筆：{dropped}")
    print(f"  用地點或行政區座標的：{sorted(t for t in {r['title'] for r in raw} if t in wiki_racing.VIA)}")
    write_manifest_part(OUT, "sports", "venues", {
        "revisions": {f"{s}-{y}": rev for (s, y), (_, rev, _) in wiki.REVISIONS.items()}, "dropped": len(dropped), **summary})


if __name__ == "__main__":
    build()
