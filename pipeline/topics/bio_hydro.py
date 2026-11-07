"""發電廠地圖的擴充：生質能與垃圾發電廠、水力的三種型式（2026-11-07，製作手冊第二十七批 618，候選 1352、1353；
步驟 bio-hydro，輸出 topics/power-plants/）。

- **生質能**：GEM Global Bioenergy Power Tracker（GBPT）的公開地圖檔（2026 年 9 月版，CC BY 4.0，同 sources/gem.py 的說明），
  4,815 個機組。GIPT 對生質能有 20 MW 的收錄門檻，GBPT 沒有，所以小廠多很多；兩份有重疊，這裡只用 GBPT，不跟
  「發電廠地圖」原本的生質能（GIPT）相加。`fuel` 欄是「bioenergy: refuse (…), fossil gas: natural gas」這種組合：
  切開後取第一個生質燃料歸類（垃圾、垃圾掩埋氣、農業廢棄物、木材與其他固體生質、紙廠廢料、污泥與廢水沼氣、液體生質燃料、
  不明）；跟化石燃料混燒的（紙廠廢料＋天然氣等）照樣算生質能，點上標「混燒化石燃料」。
  指標：運轉中的容量（MW）依燃料（子項目，第一項是全部）；點：運轉中的電廠（同一個 project-id 的機組加總，顏色是容量最大的
  機組的燃料）。
- **水力的型式**：GIPT（sources/gem.py，發電廠地圖已經下載）的水力機組 tech-type：水庫式（conventional storage）、
  川流式（run-of-river）、抽蓄（pumped storage，混合式 conventional and pumped storage 也算進來）、水庫兼川流
  （conventional and run-of-river）、不明。GIPT 的水力門檻 30 MW，小水力幾乎沒有；跨國電廠只記第一個國家。
  指標：運轉中的容量依型式（子項目）；點：運轉中的水力電廠依型式上色。
"""
from __future__ import annotations

import json
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_points
from sources import gem
from sources.countries import from_name
from topics.power_plants import COUNTRY_ALIASES

OUT = OUT_DIR / "topics" / "power-plants"
YEAR = 2026
GBPT_URL = "https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/Current_maps/gbpt/gbpt_map_2026-09.geojson"
GEM_LICENSE = {"license": "CC BY 4.0", "attribution": "Global Energy Monitor, Global Bioenergy Power Tracker / Global Integrated Power Tracker, September 2026 release"}
# 生質燃料（子項目與點的代碼，前端 bio-hydro.ts 的 BIO_FUELS 要一致）
BIO = [
    ("waste", "refuse (municipal and industrial wastes)"),
    ("landfill", "refuse (landfill gas)"),
    ("agri", "agricultural waste"),
    ("wood", "wood & other biomass"),
    ("paper", "paper mill wastes"),
    ("sludge", "wastewater and sewage sludge"),
    ("liquid", "biodiesel"),
]
BIO_CODE = {k: i + 1 for i, (k, _) in enumerate(BIO)}
BIO_CODE["other"] = len(BIO) + 1
LIQUID = ("biodiesel", "bioethanol", "biogasoline", "other liquid", "liquid")
HYDRO = {"conventional storage": "storage", "run-of-river": "ror", "pumped storage": "pumped",
         "conventional and pumped storage": "pumped", "conventional and run-of-river": "mixed", "unknown": "unknown"}
HYDRO_ITEMS = ["storage", "ror", "pumped", "mixed", "unknown"]


def _bio_kind(fuel: str) -> tuple[str, bool]:
    """「bioenergy: refuse (municipal and industrial wastes), fossil gas: natural gas」→ ('waste', True)"""
    parts = [p.strip() for p in fuel.split(",")]
    # 括號裡也有逗號的情況不多，GEM 的寫法是「類別: 名稱」，用「: 」判斷每一段是不是新的燃料
    fuels: list[str] = []
    for p in parts:
        if ":" in p or not fuels:
            fuels.append(p)
        else:
            fuels[-1] += ", " + p
    bio = [f.split(":", 1)[1].strip() for f in fuels if f.startswith("bioenergy:")]
    fossil = any(f.startswith(("fossil", "coal")) for f in fuels)
    kind = "other"
    if bio:
        first = bio[0]
        for k, text in BIO:
            if first.startswith(text):
                kind = k
                break
        else:
            if any(first.startswith(t) for t in LIQUID):
                kind = "liquid"
    return kind, fossil


def _iso(cache: dict[str, str | None], name: str) -> str | None:
    if name not in cache:
        cache[name] = COUNTRY_ALIASES.get(name) or from_name(name)
    return cache[name]


def _bio() -> None:
    with open(download(GBPT_URL, "gem", "gbpt_map_2026-09.geojson"), encoding="utf-8") as f:
        features = json.load(f)["features"]
    cache: dict[str, str | None] = {}
    by_country: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    plants: dict[str, list[dict]] = defaultdict(list)
    kinds: dict[str, int] = defaultdict(int)
    for ft in features:
        p = ft["properties"]
        if p.get("status") != "operating":
            continue
        iso = _iso(cache, p["country-area1"])
        if not iso:
            print(f"    GBPT 的國名對不到：{p['country-area1']}")
            continue
        kind, fossil = _bio_kind(p.get("fuel") or "")
        mw = float(p.get("capacity") or 0)
        kinds[kind] += 1
        by_country[iso][kind] += mw
        by_country[iso]["all"] += mw
        plants[p["project-id"]].append({**p, "_kind": kind, "_fossil": fossil, "_iso": iso, "_mw": mw})
    items = ["all", *BIO_CODE]
    for k in items:
        vals = {c: [round(v[k], 1)] for c, v in sorted(by_country.items()) if v.get(k)}
        world = sum(v.get(k, 0) for v in by_country.values())
        write_json(OUT / "bio-fuel" / f"{k}.json", indicator_file(
            f"bio-fuel/{k}", "MW", [YEAR], vals, aggregates={"WLD": [round(world, 1)]}, **GEM_LICENSE))
    rows = []
    for _pid, us in plants.items():
        main = max(us, key=lambda u: u["_mw"])
        total = sum(u["_mw"] for u in us)
        rows.append({
            "lon": main["Longitude"], "lat": main["Latitude"], "mw": round(total, 1), "fuel": BIO_CODE[main["_kind"]],
            "cofire": int(any(u["_fossil"] for u in us)), "approx": int(main.get("location-accuracy") == "approximate"),
            "units": len(us), "name": main["name"], "iso3": main["_iso"],
        })
    rows.sort(key=lambda r: -r["mw"])
    data = points_file(rows, ["lon", "lat", "mw", "fuel", "cofire", "approx", "units", "name", "iso3"],
                       {"lon": 0.001, "lat": 0.001, "mw": 0.1, "fuel": 1, "cofire": 1, "approx": 1, "units": 1}, strings=("iso3",))
    write_points(OUT / "bio-plants.json", {**data, **GEM_LICENSE}, text=("name",))
    total = sum(v["all"] for v in by_country.values())
    print(f"  GBPT 運轉中：{sum(kinds.values())} 個機組、{len(rows)} 座、{total:,.0f} MW、{len(by_country)} 國；依燃料（機組數）{dict(kinds)}")
    waste = sorted(((c, v["waste"]) for c, v in by_country.items() if v.get("waste")), key=lambda x: -x[1])
    counts: dict[str, int] = defaultdict(int)
    for r in rows:
        if r["fuel"] == BIO_CODE["waste"]:
            counts[r["iso3"]] += 1
    print("    垃圾發電（MW／座）：" + "、".join(f"{c} {mw:,.0f}／{counts[c]}" for c, mw in waste[:12]))
    tw = [r for r in rows if r["iso3"] == "TWN"]
    print(f"    台灣 {len(tw)} 座 {sum(r['mw'] for r in tw):,.1f} MW：" + "、".join(f"{r['name']} {r['mw']:g}" for r in tw[:8]))
    for k in items[1:]:
        top = sorted(((c, v[k]) for c, v in by_country.items() if v.get(k)), key=lambda x: -x[1])[:6]
        print(f"    {k}：世界 {sum(v.get(k, 0) for v in by_country.values()):,.0f} MW；" + "、".join(f"{c} {mw:,.0f}" for c, mw in top))


def _hydro() -> None:
    cache: dict[str, str | None] = {}
    by_country: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    plants: dict[str, list[gem.Unit]] = defaultdict(list)
    counts: dict[str, int] = defaultdict(int)
    for u in gem.units():
        if u.fuel != "hydropower" or u.status != "operating":
            continue
        iso = _iso(cache, u.country)
        if not iso:
            continue
        kind = HYDRO.get(u.tech, "unknown")
        counts[kind] += 1
        by_country[iso][kind] += u.mw
        plants[u.plant].append(u)
    for k in HYDRO_ITEMS:
        vals = {c: [round(v[k], 1)] for c, v in sorted(by_country.items()) if v.get(k)}
        world = sum(v.get(k, 0) for v in by_country.values())
        write_json(OUT / "hydro-type" / f"{k}.json", indicator_file(
            f"hydro-type/{k}", "MW", [YEAR], vals, aggregates={"WLD": [round(world, 1)]}, **GEM_LICENSE))
    rows = []
    for _pid, us in plants.items():
        main = max(us, key=lambda u: u.mw)
        starts = [u.start for u in us if u.start]
        rows.append({"lon": main.lon, "lat": main.lat, "mw": round(sum(u.mw for u in us), 1),
                     "type": HYDRO_ITEMS.index(HYDRO.get(main.tech, "unknown")) + 1,
                     "start": min(starts) if starts else None, "name": main.name, "iso3": _iso(cache, main.country)})
    rows.sort(key=lambda r: -r["mw"])
    data = points_file(rows, ["lon", "lat", "mw", "type", "start", "name", "iso3"],
                       {"lon": 0.001, "lat": 0.001, "mw": 0.1, "type": 1, "start": 1}, strings=("iso3",))
    write_points(OUT / "hydro-plants.json", {**data, **GEM_LICENSE}, text=("name",))
    mw = {k: sum(v.get(k, 0) for v in by_country.values()) for k in HYDRO_ITEMS}
    total = sum(mw.values())
    print(f"  GIPT 運轉中的水力：{sum(counts.values())} 個機組、{len(rows)} 座、{total:,.0f} MW；"
          + "、".join(f"{k} {counts[k]} 部 {mw[k]:,.0f} MW（{mw[k] / total:.1%}）" for k in HYDRO_ITEMS))
    for k in HYDRO_ITEMS:
        top = sorted(((c, v[k]) for c, v in by_country.items() if v.get(k)), key=lambda x: -x[1])[:8]
        print(f"    {k}：" + "、".join(f"{c} {m:,.0f}" for c, m in top))
    tw = by_country.get("TWN", {})
    print("    台灣：" + "、".join(f"{k} {tw.get(k, 0):,.0f}" for k in HYDRO_ITEMS))


def build() -> None:
    _bio()
    _hydro()
