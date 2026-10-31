"""發電廠地圖的擴充（2026-10-31，製作手冊第十批 165）：核電機組、儲能、各國最大的電廠。power_plants.build() 最後呼叫。

核電機組（708，GEM GIPT 的 asset-type nuclear）：
- 時間軸 1951–2026：一部機組從商轉年份（start-year）算到退役年份（end-year，那一年起不算）。GEM 列為封存（mothballed，
  日本停機待審的 16 部等）的仍算未退役；從來沒有商轉、沒有 start-year 的（Shoreham、Bataan、V.C. Summer 2、3 號機、
  東通 TEPCO）不算。
- 重新啟動的日本機組 GEM 的 start-year 是重啟的年份，使用者決定改成原本的商轉年份（RESTART_FIX，依英文維基），tooltip 寫明。
- 狀態照 GEM（使用者決定），tooltip 註明實際情況（NOTES）：札波羅熱 6 部 GEM 算運轉中、實際 2022 年起被占領停機；
  日本封存的是停機待審；柏崎刈羽 7 號機 GEM 寫興建中（1997 年就商轉，等待重啟）；台灣核三。
- nuclear-units.json、nuclear-capacity.json：各國每年未退役的機組數、容量（GW）。
- nuclear-plants.json：一座核電廠一個點，units 欄位是各機組的「商轉年:退役年:MW:狀態」，前端依時間軸算那一年的狀態與容量。
- nuclear-construction.json：興建中的機組（一座電廠一個點），只在最新的一年畫。
- nuclear-list.json：一部機組一筆，左邊的機組清單用（使用者 2026-10-30 決定：依商轉年份，退役的淡一點，跟時間軸連動）。

儲能（718）：
- storage.json：EIA International Energy Statistics 的抽蓄水力裝置容量（82-7，百萬瓩 = GW），1980–2024 年。
- pumped-plants.json：GEM 的抽蓄水力電廠（tech-type pumped storage，加上 conventional and pumped storage 混合式），
  運轉中、興建中、規劃中（籌備中與已宣布）各自一個狀態代碼。
- batteries.json：電池儲能電站（sources/battery_storage.py，英文維基的清單加 Wikidata，CC BY-SA 4.0，不完整）。

各國最大的電廠（722）：
- 依 GEM 的 project-id 加總運轉中的機組（使用者決定不合併同一地點的不同 project-id），能源取容量最大的 asset-type。
- 跨國電廠（BINATIONAL）照兩國的份額各算一次（使用者決定）：伊泰普在巴西、巴拉圭都算 7,000 MW。
- largest.json：類別圖，值是最大電廠的能源代碼，hints 寫電廠名稱與容量；largest-plants.json：那些電廠的點。
"""
from __future__ import annotations

from collections import defaultdict

from common import indicator_file, points_file, write_json
from sources import battery_storage, eia, gem
from sources.countries import from_name
from topics.fossil_fuels import known_countries, map_regions

FIRST_NUCLEAR = 1951
# 重新啟動的機組：(電廠名稱的一部分, 機組) → 原本的商轉年份（英文維基各電廠條目的機組表，2026-10-31 讀）
RESTART_FIX = {
    ("Kashiwazaki Kariwa", "6"): 1996,  # Kashiwazaki-Kariwa Nuclear Power Plant：Commission date 7 November 1996
    ("Onagawa", "2"): 1995,  # Onagawa Nuclear Power Plant：Commercial operation 28 July 1995
    ("Shimane", "2"): 1989,  # Shimane Nuclear Power Plant：Commission date 10 February 1989
}
# 核電廠的附註代碼（前端 power-plants.ts 的 NUCLEAR_NOTES）
NOTE_ZAPORIZHZHIA, NOTE_JAPAN_IDLE, NOTE_MAANSHAN, NOTE_RESTART, NOTE_KK7 = 1, 2, 3, 4, 5
UNIT_STATUS = {"operating": 1, "mothballed": 2, "retired": 3, "construction": 4}
# 抽蓄電廠的狀態代碼
PUMPED_STATUS = {"operating": 1, "construction": 2, "pre-construction": 3, "announced": 3}
PUMPED_TECH = {"pumped storage", "conventional and pumped storage"}


def _short(name: str) -> str:
    """「Jinshan nuclear power plant」→「Jinshan」"""
    for tail in (" nuclear power plant", " nuclear power station", " power plant", " power station"):
        if name.lower().endswith(tail):
            return name[: -len(tail)]
    return name


def build_nuclear(units: list[gem.Unit], iso3, out_dir, year: int) -> None:
    nuclear = [u for u in units if u.fuel == "nuclear" and u.status in UNIT_STATUS]
    fixed = 0
    rows = []
    for u in nuclear:
        start = u.start
        note = 0
        for (part, unit), y in RESTART_FIX.items():
            if part in u.name and u.unit == unit:
                start, note = y, NOTE_RESTART
                fixed += 1
        if "Zaporizhzhia" in u.name:
            note = NOTE_ZAPORIZHZHIA
        elif "Kashiwazaki" in u.name and u.unit == "7" and u.status == "construction":
            note = NOTE_KK7
        elif u.country == "Japan" and u.status == "mothballed":
            note = NOTE_JAPAN_IDLE
        elif "Maanshan" in u.name:
            note = NOTE_MAANSHAN
        rows.append((u, start, note))
    print(f"  核電機組：{len(nuclear)} 部（運轉中、封存、退役、興建中），重啟年份改回原本的商轉年份 {fixed} 部")

    # 各國每年未退役的機組數與容量（興建中的不算；沒有商轉年份的不算）
    years = list(range(FIRST_NUCLEAR, year + 1))
    count: dict[str, list[float]] = defaultdict(lambda: [0.0] * len(years))
    cap: dict[str, list[float]] = defaultdict(lambda: [0.0] * len(years))
    for u, start, _note in rows:
        code = iso3(u)
        if u.status == "construction" or not start or not code:
            continue
        for i, y in enumerate(years):
            if start <= y and not (u.end and u.status == "retired" and u.end <= y):
                count[code][i] += 1
                cap[code][i] += u.mw / 1000
    world_n = [sum(v[i] for v in count.values()) for i in range(len(years))]
    world_gw = [round(sum(v[i] for v in cap.values()), 3) for i in range(len(years))]
    # 從來沒有核電的國家不放（地圖留白，不是 0）；有過的國家退役後是 0
    hints = {
        "JPN": ("含 GEM 列為封存的機組（2011 年起停機、等待重新運轉的審查）", "Includes units GEM lists as mothballed (offline since 2011, awaiting restart reviews)"),
        "UKR": ("含札波羅熱 6 部（GEM 列為運轉中；2022 年起被俄軍占領、停機）", "Includes Zaporizhzhia’s six units (operating in GEM; occupied by Russia and shut down since 2022)"),
        "TWN": ("核三 2 號機 2025 年 5 月停機後沒有運轉中的機組", "No operating units since Maanshan unit 2 shut down in May 2025"),
    }
    for name, data, digits in (("nuclear-units", count, 0), ("nuclear-capacity", cap, 3)):
        values = {c: [round(v, digits) if digits else int(v) for v in s] for c, s in sorted(data.items())}
        write_json(out_dir / f"{name}.json", indicator_file(
            name, "部" if digits == 0 else "GW", years, values,
            aggregates={"WLD": world_n if digits == 0 else world_gw},
            hints={c: h[0] for c, h in hints.items()}, hintsEn={c: h[1] for c, h in hints.items()}), quiet=True)
    i = years.index(year)
    print(f"  核電：{year} 年未退役 {int(world_n[i])} 部、{world_gw[i]:,.0f} GW；前 6 國 " + "、".join(
        f"{c} {int(s[i])}" for c, s in sorted(count.items(), key=lambda kv: -kv[1][i])[:6]))

    # 地圖上的點：一座電廠一個點
    plants: dict[str, list] = defaultdict(list)
    construction: dict[str, list] = defaultdict(list)
    for u, start, note in rows:
        if u.status == "construction":
            construction[u.plant].append((u, note))
        elif start:
            plants[u.plant].append((u, start, note))
    plant_rows = []
    for pid, us in plants.items():
        main = max(us, key=lambda x: x[0].mw)[0]
        units_text = ";".join(
            f"{start}:{u.end if u.status == 'retired' and u.end else 0}:{round(u.mw)}:{UNIT_STATUS[u.status]}"
            for u, start, _ in sorted(us, key=lambda x: (x[1], x[0].unit)))
        notes = {n for _, _, n in us if n}
        plant_rows.append({
            "lon": main.lon, "lat": main.lat, "mw": round(sum(u.mw for u, _, _ in us)), "units": units_text,
            "note": min(notes) if notes else 0, "name": _short(main.name), "iso3": iso3(main),
        })
    plant_rows.sort(key=lambda r: -r["mw"])
    write_json(out_dir / "nuclear-plants.json", points_file(
        plant_rows, ["lon", "lat", "mw", "units", "note", "name", "iso3"],
        {"lon": 0.001, "lat": 0.001, "mw": 1, "note": 1}, strings=("units", "name", "iso3")), quiet=True)
    con_rows = []
    for pid, us in construction.items():
        main = max(us, key=lambda x: x[0].mw)[0]
        starts = [u.start for u, _ in us if u.start]
        con_rows.append({
            "lon": main.lon, "lat": main.lat, "mw": round(sum(u.mw for u, _ in us)), "n": len(us),
            "start": min(starts) if starts else None, "note": max(n for _, n in us), "name": _short(main.name),
            "iso3": iso3(main), "yr": year,
        })
    con_rows.sort(key=lambda r: -r["mw"])
    write_json(out_dir / "nuclear-construction.json", points_file(
        con_rows, ["lon", "lat", "mw", "n", "start", "note", "name", "iso3", "yr"],
        {"lon": 0.001, "lat": 0.001, "mw": 1, "n": 1, "start": 1, "note": 1, "yr": 1}, strings=("name", "iso3")), quiet=True)

    # 左邊的機組清單：一部機組一筆（有商轉年份的；興建中的也放，商轉年份是預計的，前端只列到時間軸那一年）
    list_rows = []
    for u, start, note in rows:
        if not start:
            continue
        list_rows.append({
            "lon": u.lon, "lat": u.lat, "start": start,
            "end": u.end if u.status == "retired" and u.end else None, "mw": round(u.mw), "st": UNIT_STATUS[u.status],
            "note": note, "name": _short(u.name), "unit": u.unit, "iso3": iso3(u),
        })
    list_rows.sort(key=lambda r: (r["start"], r["name"], r["unit"]))
    write_json(out_dir / "nuclear-list.json", points_file(
        list_rows, ["lon", "lat", "start", "end", "mw", "st", "note", "name", "unit", "iso3"],
        {"lon": 0.001, "lat": 0.001, "start": 1, "end": 1, "mw": 1, "st": 1, "note": 1}, strings=("name", "unit", "iso3")),
        quiet=True)
    print(f"  核電廠的點 {len(plant_rows)} 座、興建中 {len(con_rows)} 座、機組清單 {len(list_rows)} 部")


def build_storage(units: list[gem.Unit], iso3, out_dir) -> None:
    # EIA 的抽蓄水力裝置容量（GW）
    key = "82-7-MK"
    raw = eia.annual([key])[key]
    mapped = {c: s for c, s in map_regions(raw, known_countries())[0].items() if not c.startswith("_")}
    years = list(range(1980, max(max(s) for s in mapped.values()) + 1))
    values = {c: [round(s[y], 3) if y in s else None for y in years] for c, s in sorted(mapped.items()) if any(s.values())}
    world = raw.get("WORL", {})
    tw_note = ("EIA 的台灣 2024 年 2.6 GW：明潭 1,602 MW、大觀二廠（明湖）1,000 MW；台電的光明抽蓄（610 MW）還在籌備。",
               "The EIA figure for Taiwan in 2024 is 2.6 GW: Mingtan (1,602 MW) and Taikuan II (Minghu, 1,000 MW); Taipower’s Guangming project (610 MW) is still in preparation.")
    write_json(out_dir / "storage.json", indicator_file(
        "storage", "GW", years, values, aggregates={"WLD": [round(world[y], 3) if y in world else None for y in years]},
        notes={"TWN": tw_note[0]}, notesEn={"TWN": tw_note[1]}), quiet=True)
    last = years[-1]
    print(f"  抽蓄（EIA）：{len(values)} 國，{last} 年世界 {world.get(last, 0):,.1f} GW")

    # GEM 的抽蓄電廠
    by_plant: dict[tuple[str, int], list[gem.Unit]] = defaultdict(list)
    for u in units:
        if u.fuel == "hydropower" and u.tech in PUMPED_TECH and u.status in PUMPED_STATUS:
            by_plant[(u.plant, PUMPED_STATUS[u.status])].append(u)
    rows = []
    for (_pid, st), us in by_plant.items():
        main = max(us, key=lambda u: u.mw)
        starts = [u.start for u in us if u.start]
        rows.append({
            "lon": main.lon, "lat": main.lat, "mw": round(sum(u.mw for u in us), 1), "st": st,
            "mixed": int(any(u.tech != "pumped storage" for u in us)), "start": min(starts) if starts else None,
            "name": main.name, "iso3": iso3(main),
        })
    rows.sort(key=lambda r: -r["mw"])
    write_json(out_dir / "pumped-plants.json", points_file(
        rows, ["lon", "lat", "mw", "st", "mixed", "start", "name", "iso3"],
        {"lon": 0.001, "lat": 0.001, "mw": 0.1, "st": 1, "mixed": 1, "start": 1}, strings=("name", "iso3")), quiet=True)
    op = [r for r in rows if r["st"] == 1]
    print(f"  抽蓄電廠（GEM）：{len(rows)} 個點，運轉中 {len(op)} 座 {sum(r['mw'] for r in op) / 1000:,.1f} GW")

    # 電池儲能
    batteries = battery_storage.stations(lambda name: from_name(name) if name else None)
    for b in batteries:
        # 點的大小用 MW；維基只寫 MWh 的，以 4 小時換算成大約的 MW（只用來畫大小，tooltip 只寫原本的數字）
        b["size"] = b["mw"] or (b["mwh"] / 4 if b["mwh"] else 0)
    batteries.sort(key=lambda b: -b["size"])
    data = points_file(
        batteries, ["lon", "lat", "size", "mw", "mwh", "year", "src", "approx", "name", "iso3"],
        {"lon": 0.001, "lat": 0.001, "size": 0.1, "mw": 0.1, "mwh": 0.1, "year": 1, "src": 1, "approx": 1}, strings=("name", "iso3"))
    write_json(out_dir / "batteries.json", {**data, **battery_storage.WIKI_LICENSE}, quiet=True)


def build_largest(units: list[gem.Unit], iso3, shares: dict[str, dict[str, float]], fuels: dict, out_dir, year: int) -> None:
    by_plant: dict[str, list[gem.Unit]] = defaultdict(list)
    for u in units:
        if u.status == "operating" and u.fuel in fuels:
            by_plant[u.plant].append(u)
    best: dict[str, tuple[float, str]] = {}
    plants = {}
    for pid, us in by_plant.items():
        mw = sum(u.mw for u in us)
        by_fuel: dict[str, float] = defaultdict(float)
        for u in us:
            by_fuel[u.fuel] += u.mw
        main = max(us, key=lambda u: u.mw)
        plants[pid] = (main, mw, fuels[max(by_fuel, key=lambda f: by_fuel[f])][0])
        for code, share in (shares.get(pid) or ({iso3(main): 1.0} if iso3(main) else {})).items():
            if code not in best or mw * share > best[code][0]:
                best[code] = (mw * share, pid)
    values, hints, hints_en = {}, {}, {}
    of: dict[str, list[str]] = defaultdict(list)
    for code, (mw, pid) in sorted(best.items()):
        main, total, fuel = plants[pid]
        values[code] = [fuel]
        of[pid].append(code)
        if pid in shares:
            hints[code] = f"{main.name} · {mw:,.0f} MW（跨國電廠，算這一國的份額）"
            hints_en[code] = f"{main.name} · {mw:,.0f} MW (cross-border plant, this country’s share)"
        else:
            hints[code] = hints_en[code] = f"{main.name} · {mw:,.0f} MW"
    write_json(out_dir / "largest.json", indicator_file(
        "largest", "", [year], values, hints=hints, hintsEn=hints_en), quiet=True)
    rows = []
    for pid, codes in of.items():
        main, total, fuel = plants[pid]
        rows.append({"lon": main.lon, "lat": main.lat, "mw": round(total, 1), "fuel": fuel, "name": main.name,
                     "of": ",".join(sorted(codes)), "iso3": iso3(main)})
    rows.sort(key=lambda r: -r["mw"])
    write_json(out_dir / "largest-plants.json", points_file(
        rows, ["lon", "lat", "mw", "fuel", "name", "of", "iso3"], {"lon": 0.001, "lat": 0.001, "mw": 0.1, "fuel": 1},
        strings=("name", "of", "iso3")), quiet=True)
    counts = defaultdict(int)
    for v in values.values():
        counts[v[0]] += 1
    print(f"  各國最大的電廠：{len(values)} 國（能源代碼：國數 {dict(sorted(counts.items()))}）；前 5："
          + "、".join(f"{r['name']} {r['mw']:,.0f}" for r in rows[:5]))
