"""太空的擴充：探空火箭與次軌道發射（2026-11-07，製作手冊第二十七批 606，候選 1335；步驟 space-suborbital，輸出 topics/space/）。

- 資料是太空主題既有的 GCAT `launch.tsv`（CC BY 4.0）。手冊建議用 `rcat.tsv`，但它 97% 沒有擁有國；`launch.tsv` 本來就收了
  次軌道的發射，國家跟入軌發射一樣用第一個發射業者（`Agency`，去掉表示不確定的「?」）所屬的國家，蘇聯算俄羅斯。
- `LaunchCode` 第一個字（GCAT 說明頁 https://planet4589.org/space/gcat/web/launch/lcols.html）：O 入軌、M 飛彈、
  T 測試火箭、A 大氣層內的火箭、S 飛彈以外的次軌道火箭、D 深空、H 高空探空火箭、R 再入測試、Y 載人的次軌道飛行、
  L 高拋彈道的飛彈試射、N 差一點入軌。手冊的陷阱「混了飛彈試射，要不要算先決定」：這裡算 S、H、Y、T、N，
  不算 M、L（飛彈）、A（沒到太空）、R（多半是彈頭的再入測試）。
- 發射場：有次軌道發射的場址一個點（`sites.tsv` 的經緯度，國家是點所在的國家），大小是次數，依第一次的年份出現。
"""
from __future__ import annotations

from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json
from geoindex import country_at
from sources import gcat

OUT = OUT_DIR / "topics" / "space"
KEEP = set("SHYTN")
FIRST_YEAR = 1945


def build() -> None:
    mapper = gcat.StateMapper(gcat.orgs())
    sites = gcat.sites()
    lic = {"license": "CC BY 4.0", "attribution": f"McDowell, Jonathan C., General Catalog of Artificial Space Objects, Release {gcat.RELEASE}"}
    by: dict[str, Counter] = defaultdict(Counter)
    world: Counter = Counter()
    used: dict[str, list[int]] = defaultdict(list)
    unknown = 0
    for r in gcat.launches():
        y = gcat.year(r["Launch_Date"])
        if r["LaunchCode"][:1] not in KEEP or y is None:
            continue
        world[y] += 1
        used[r["Launch_Site"].rstrip("?")].append(y)
        c = mapper.iso3(mapper.org_state(r["Agency"].split("/")[0].rstrip("?")))
        if c:
            by[c][y] += 1
        else:
            unknown += 1
    first, last = max(FIRST_YEAR, min(world)), max(world)
    years = list(range(first, last + 1))
    write_json(OUT / "suborbital.json", indicator_file(
        "suborbital", "次", years, {c: [cnt.get(y) or None for y in years] for c, cnt in sorted(by.items())},
        aggregates={"WLD": [world.get(y, 0) for y in years]}, **lic))
    total = sum(world.values())
    print(f"  次軌道發射 {total:,} 次（{first}–{last}），對不到國家 {unknown:,}；最多的一年 {max(world, key=world.get)}（{max(world.values()):,}）")
    print("  依國家：" + "、".join(f"{c} {sum(v.values()):,}" for c, v in sorted(by.items(), key=lambda x: -sum(x[1].values()))[:12]))
    print("  每 5 年：" + "、".join(f"{y} {world.get(y, 0):,}" for y in range(1950, last + 1, 5)) + f"、{last - 1} {world.get(last - 1, 0)}")
    print(f"  台灣：{dict(by.get('TWN', {}))}")

    rows, missing = [], Counter()
    for code, ys in used.items():
        s = sites.get(code)
        try:
            lon, lat = float(s["Longitude"]), float(s["Latitude"])
        except (TypeError, ValueError, KeyError):
            missing[code] += len(ys)
            continue
        iso3 = country_at(lon, lat) or mapper.iso3(s.get("StateCode", ""))
        name = s.get("ShortEName") if s.get("ShortEName") not in (None, "", "-") else s.get("ShortName")
        full = s.get("EName") if s.get("EName") not in (None, "", "-") else s.get("Name")
        rows.append({"lon": lon, "lat": lat, "first": min(ys), "last": max(ys), "n": len(ys), "iso3": iso3, "name": name, "full": full})
    rows.sort(key=lambda r: r["lon"])
    write_json(OUT / "suborbital-sites.json", points_file(
        rows, ["lon", "lat", "first", "last", "n", "iso3", "name", "full"], {"lon": 0.01, "lat": 0.01, "first": 1, "last": 1, "n": 1}, delta=("lon",)))
    print(f"  發射場 {len(rows)} 個；沒有經緯度的 {len(missing)} 個（{sum(missing.values()):,} 次，多半是海上或空射）：{missing.most_common(5)}")
    print("  台灣的場址：" + "、".join(f"{r['name']} {r['n']} 次" for r in rows if r["iso3"] == "TWN"))
