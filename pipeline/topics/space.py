"""太空主題：在軌酬載（依擁有國）、每年入軌發射次數（依發射業者的國家）、累計入軌發射、太空垃圾，發射場畫成點。

- 資料：GCAT（Jonathan McDowell，CC BY 4.0，`sources/gcat.py`）。
- **在軌酬載**：每年年底仍在地球軌道上的酬載（`Type` 第一個字是 P：衛星、太空船、太空站艙段等，不含火箭殘骸與碎片），
  含已經失效、沒有在運作的衛星。「年底仍在軌道上」= 發射日期在那年年底以前，而且 `DDate`（再入、離軌、回收、
  離開地球軌道或不再追蹤的日期）是空的或在那年以後。今年是到資料更新日為止。
- **國家**：酬載用 `State`（擁有者所屬的國家），發射用第一個發射業者（`Agency`）所屬的國家，所以阿利安太空公司從
  法屬圭亞那庫魯發射的算法國，俄羅斯在哈薩克拜科努爾發射的算俄羅斯，Rocket Lab 在紐西蘭發射的算美國。
  蘇聯（SU）的酬載與發射算在繼承國俄羅斯（附註寫明），東德、捷克斯洛伐克等算在今天對應的國家。
  國際組織（歐洲太空總署 ESA、EUMETSAT、Intelsat 等，代碼 I-…）不屬於任何國家，不畫在地圖上，只算進世界合計，數量寫在附註。
- **入軌發射**：`LaunchCode` 第一個字是 O（成功與失敗都算，是「發射次數」不是「成功次數」），1957 年起。
- **太空垃圾**（2026-10-30 加，製作手冊第一百零一節）：`Type` 第一個字是 R（火箭殘骸）、D（碎片）、C（零件，例如整流罩、
  分離的轉接環），每年年底仍在軌道上的（同酬載：`DDate` 空白或在那年以後），依 `State`（碎片算在母體的擁有國）。
  碎片的 `LDate` 是母體的發射日期，產生的年份用 `SDate`（分離或解體的日期）；只有追蹤得到的物體（約 10 cm 以上）。
- **發射場**：有入軌發射的發射場一個點，位置是 GCAT 的經緯度，國家是點所在的國家（`geoindex.country_at`；拜科努爾算哈薩克、瓜加林算馬紹爾群島），
  大小是入軌發射次數，時間軸依第一次入軌發射的年份顯示。
"""
from __future__ import annotations

from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, now_iso, points_file, write_json
from geoindex import country_at
from sources import gcat, wpp

OUT = OUT_DIR / "topics" / "space"
FIRST_YEAR = 1957
SMALL = 120  # 酬載不超過這個數的國家，側欄列出每一顆（台灣 66 顆）
TOP_OWNERS = 8


def _payloads(sat, mapper):
    out = []
    for r in sat:
        if not r["Type"].startswith("P"):
            continue
        launched = gcat.year(r["LDate"])
        if launched is None:
            continue
        out.append({
            "piece": r["Piece"], "name": r["Name"], "plname": r["PLName"], "ldate": r["LDate"], "ddate": r["DDate"],
            "launched": launched, "gone": gcat.year(r["DDate"]), "status": r["Status"],
            "owner": r["Owner"], "state": r["State"], "iso3": mapper.iso3(r["State"]),
        })
    return out


def build() -> None:
    orgs = gcat.orgs()
    mapper = gcat.StateMapper(orgs)
    sat = gcat.satcat()
    payloads = _payloads(sat, mapper)
    last = max(p["launched"] for p in payloads)
    years = list(range(FIRST_YEAR, last + 1))

    unmapped = Counter(p["state"] for p in payloads if p["iso3"] is None and not p["state"].startswith("I-"))
    if unmapped:
        print(f"  對不到國家的酬載（只算進世界合計）：{dict(unmapped)}")
    intl = Counter(p["state"] for p in payloads if p["state"].startswith("I-"))

    # ── 在軌酬載 ──
    def in_orbit(p: dict, y: int) -> bool:
        return p["launched"] <= y and (p["gone"] is None or p["gone"] > y)

    by_country: dict[str, list[dict]] = defaultdict(list)
    for p in payloads:
        if p["iso3"]:
            by_country[p["iso3"]].append(p)
    orbit_values = {iso3: [sum(in_orbit(p, y) for p in ps) for y in years] for iso3, ps in by_country.items()}
    orbit_world = [sum(in_orbit(p, y) for p in payloads) for y in years]

    # ── 入軌發射 ──
    launches = [r for r in gcat.launches() if r["LaunchCode"].startswith("O")]
    launch_country: list[tuple[int, str | None, dict]] = []
    for r in launches:
        y = gcat.year(r["Launch_Date"])
        agency = r["Agency"].split("/")[0]
        state = mapper.org_state(agency)
        launch_country.append((y, mapper.iso3(state) if state else None, r))
    no_country = Counter(r["Agency"] for _, iso3, r in launch_country if iso3 is None)
    if no_country:
        print(f"  對不到國家的發射業者：{dict(no_country)}")
    per_year: dict[str, Counter] = defaultdict(Counter)
    for y, iso3, _ in launch_country:
        if iso3:
            per_year[iso3][y] += 1
    world_year = Counter(y for y, _, _ in launch_country)
    annual = {iso3: [c.get(y, 0) for y in years] for iso3, c in per_year.items()}
    cumulative = {iso3: [sum(c.get(k, 0) for k in years if k <= y) for y in years] for iso3, c in per_year.items()}

    # 沒有酬載、沒有發射的國家是 0（地圖上的國家都列，比例圓沒有圓、排名表不列）
    pop = wpp.demographic(["TPopulation1July"])["TPopulation1July"]
    for iso3 in set(pop) - {"WLD"}:
        orbit_values.setdefault(iso3, [0] * len(years))
        annual.setdefault(iso3, [0] * len(years))
        cumulative.setdefault(iso3, [0] * len(years))

    # ── 太空垃圾：火箭殘骸（R）、碎片（D）、零件（C），年底仍在軌道上，依擁有國 ──
    junk = []
    for r in sat:
        if r["Type"][:1] not in "RDC":
            continue
        # 碎片的 LDate 是母體的發射日期，產生的日期是 SDate（例如風雲一號 C 1999 年發射、2007 年被擊碎）
        born = gcat.year(r["SDate"]) or gcat.year(r["LDate"])
        if born is None:
            continue
        junk.append({"born": born, "gone": gcat.year(r["DDate"]), "state": r["State"], "iso3": mapper.iso3(r["State"]),
                     "kind": r["Type"][:1], "fy1c": "FY-1C" in r["Name"]})
    junk_alive = lambda j, y: j["born"] <= y and (j["gone"] is None or j["gone"] > y)  # noqa: E731
    junk_by: dict[str, list[dict]] = defaultdict(list)
    for j in junk:
        if j["iso3"]:
            junk_by[j["iso3"]].append(j)
    debris_values = {iso3: [sum(junk_alive(j, y) for j in js) for y in years] for iso3, js in junk_by.items()}
    debris_world = [sum(junk_alive(j, y) for j in junk) for y in years]
    for iso3 in set(pop) - {"WLD"}:
        debris_values.setdefault(iso3, [0] * len(years))
    fy1c = sum(1 for j in junk if j["fy1c"] and junk_alive(j, last))
    fy1c_2007 = sum(1 for j in junk if j["fy1c"] and j["born"] == 2007)
    tw_junk = junk_by.get("TWN", [])
    debris_notes = {
        "RUS": f"含蘇聯時期的火箭殘骸與碎片（GCAT 的國家代碼 SU），{last} 年仍在軌道上 {sum(1 for j in junk if j['state'] == 'SU' and junk_alive(j, last)):,} 個，算在繼承國俄羅斯。",
        "CHN": f"2007 年 1 月風雲一號 C 氣象衛星被反衛星飛彈擊碎，編目的碎片 {fy1c_2007:,} 個，{last} 年仍在軌道上 {fy1c:,} 個。",
        "TWN": f"台灣擁有的物體裡有碎片 {len(tw_junk)} 個，都已經再入大氣層，{last} 年在軌道上的太空垃圾是 0。",
    }
    debris_notes_en = {
        "RUS": f"Includes Soviet-era rocket bodies and debris (GCAT state code SU): {sum(1 for j in junk if j['state'] == 'SU' and junk_alive(j, last)):,} still in orbit in {last}, counted for Russia as the successor state.",
        "CHN": f"China’s anti-satellite test destroyed the Fengyun-1C weather satellite in January 2007: {fy1c_2007:,} catalogued fragments, {fy1c:,} still in orbit in {last}.",
        "TWN": f"Taiwan owns {len(tw_junk)} catalogued debris objects, all of which have re-entered; none was in orbit in {last}.",
    }
    write_json(OUT / "debris.json", indicator_file("debris", "個", years, debris_values, aggregates={"WLD": debris_world}, notes=debris_notes, notesEn=debris_notes_en))

    rus_su = sum(1 for p in payloads if p["state"] == "SU")
    rus_su_orbit = sum(1 for p in payloads if p["state"] == "SU" and in_orbit(p, last))
    su_launches = sum(1 for _, _, r in launch_country if mapper.org_state(r["Agency"].split("/")[0]) == "SU")
    notes = {
        "RUS": f"含蘇聯時期的酬載與發射（GCAT 的國家代碼 SU）：蘇聯的酬載 {rus_su:,} 顆（{last} 年仍在軌道上 {rus_su_orbit:,} 顆）、入軌發射 {su_launches:,} 次，算在繼承國俄羅斯。",
    }
    notes_en = {
        "RUS": f"Includes the Soviet era (GCAT state code SU): {rus_su:,} Soviet payloads ({rus_su_orbit:,} still in orbit in {last}) and {su_launches:,} orbital launches are counted for Russia as the successor state.",
    }
    intl_orbit = sum(1 for p in payloads if p["state"].startswith("I-") and in_orbit(p, last))

    write_json(OUT / "in-orbit.json", indicator_file("in-orbit", "顆", years, orbit_values, aggregates={"WLD": orbit_world}, notes=notes, notesEn=notes_en))
    write_json(OUT / "launches.json", indicator_file("launches", "次", years, annual, aggregates={"WLD": [world_year.get(y, 0) for y in years]}, notes=notes, notesEn=notes_en))
    write_json(OUT / "launches-cumulative.json", indicator_file(
        "launches-cumulative", "次", years, cumulative,
        aggregates={"WLD": [sum(world_year.get(k, 0) for k in years if k <= y) for y in years]}, notes=notes, notesEn=notes_en,
    ))

    # ── 發射場 ──
    sites = gcat.sites()
    used: dict[str, list[int]] = defaultdict(list)
    for y, _, r in launch_country:
        used[r["Launch_Site"]].append(y)
    rows = []
    for code, ys in used.items():
        s = sites.get(code)
        try:
            lon, lat = float(s["Longitude"]), float(s["Latitude"])
        except (TypeError, ValueError, KeyError):
            print(f"  發射場 {code} 沒有經緯度（{len(ys)} 次），不畫")
            continue
        iso3 = country_at(lon, lat) or mapper.iso3(s.get("StateCode", ""))
        name = s.get("ShortEName") if s.get("ShortEName") not in (None, "", "-") else s.get("ShortName")
        rows.append({"lon": lon, "lat": lat, "first": min(ys), "last": max(ys), "n": len(ys), "iso3": iso3, "name": name, "full": s.get("EName") if s.get("EName") not in (None, "", "-") else s.get("Name")})
    rows.sort(key=lambda r: r["lon"])
    write_json(OUT / "sites.json", points_file(rows, ["lon", "lat", "first", "last", "n", "iso3", "name", "full"], {"lon": 0.01, "lat": 0.01, "first": 1, "last": 1, "n": 1}, delta=("lon",)))

    # ── 側欄：主要擁有者、酬載清單（小國） ──
    org_name = lambda code: (orgs.get(code, {}).get("ShortEName") or "").strip("-") or orgs.get(code, {}).get("ShortName") or code
    index = []
    for iso3, ps in by_country.items():
        current = [p for p in ps if in_orbit(p, last)]
        # 同一個機構可能有好幾個代碼（NSPO、NSPT 都是國家太空計畫室），依顯示的名稱合併
        owners = Counter()
        for p in current:
            owners[org_name(p["owner"].split("/")[0])] += 1
        entry: dict[str, object] = {
            "total": len(ps),
            "first": min(p["launched"] for p in ps),
            "owners": [[o, n] for o, n in owners.most_common(TOP_OWNERS)],
            "soviet": sum(1 for p in ps if p["state"] == "SU"),
        }
        if len(ps) <= SMALL:
            entry["payloads"] = [
                [p["piece"], p["name"], p["plname"] if p["plname"] not in ("-", p["name"]) else "", p["ldate"][:11].strip(),
                 p["ddate"][:11].strip() if p["gone"] else "", p["owner"]]
                for p in sorted(ps, key=lambda p: (p["ldate"], p["piece"]))
            ]
        write_json(OUT / "countries" / f"{iso3}.json", entry, quiet=True)
        index.append(iso3)
    write_json(OUT / "countries" / "index.json", sorted(index))
    write_json(OUT / "manifest.json", {
        "generatedAt": now_iso(), "gcatRelease": gcat.RELEASE, "lastYear": last,
        "international": {"inOrbit": intl_orbit, "byCode": dict(intl.most_common())},
    })

    tw = by_country["TWN"]
    print(f"  {len(payloads):,} 個酬載，{last} 年在軌 {orbit_world[-1]:,}（美國 {orbit_values['USA'][-1]:,}、中國 {orbit_values['CHN'][-1]:,}、"
          f"俄羅斯 {orbit_values['RUS'][-1]:,}、台灣 {orbit_values['TWN'][-1]}）；國際組織在軌 {intl_orbit}")
    print(f"  太空垃圾 {last} 年在軌 {debris_world[-1]:,}（俄羅斯 {debris_values['RUS'][-1]:,}、中國 {debris_values['CHN'][-1]:,}、"
          f"美國 {debris_values['USA'][-1]:,}、法國 {debris_values['FRA'][-1]:,}、台灣 {debris_values['TWN'][-1]}）；風雲一號 C 的碎片在軌 {fy1c:,}")
    print(f"  入軌發射 {len(launches):,} 次，{last} 年 {world_year[last]}；台灣的酬載 {len(tw)} 顆；發射場 {len(rows)} 個")
