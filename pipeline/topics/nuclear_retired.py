"""核電機組的擴充：已退役的機組、核電廠的熱效率（2026-11-07，製作手冊第二十七批 623，候選 1361、1364；
步驟 nuclear-retired，輸出 topics/nuclear-reactors/；手冊說 623–625 可以放「核能」或「核電機組」，退役機組跟運轉中的放在一起）。

- **已退役的機組**：GEM GIPT（sources/gem.py，已快取）的核能、status=retired 的 230 部，end-year（退役年份）都有。
  指標：累計退役的容量（MW）與部數，依退役年份逐年累計（1960 年起），時間軸看得到 2010 年代的高峰。
  點：退役的機組，同一座電廠同一年退役的併成一點，顏色是 GNPT 的機型（同 project-id＋unit-name），依年份累計出現。
  手冊的陷阱：GEM 的 retired 不分永久關閉、等待除役與除役完成；mothballed（封存）的不算。
- **熱效率**：Eurostat `nrg_inf_nuc` 的 PRD_NUCH（核反應爐產生的熱，千公噸油當量，2009–2025，CC BY 4.0；英國照網站規則不收）
  換成 TWh（1 千公噸油當量 ＝ 0.01163 TWh），發電量用同是 Eurostat 的核能毛發電量（`nrg_bal_peh` 的 GEP、N900H，GWh；
  手冊建議的 Ember 發電量口徑不同，法國 2024 年 Ember 380.45 TWh、Eurostat 毛發電量見下面的輸出），熱效率 ＝ 毛發電 ÷ 熱。
  熱是 0 的國家（沒有核電）不算；效率不在 20–45% 之間的年份報錯（單位或口徑不對）。
- 台灣：6 部都已退役（2018–2025）；熱效率的附註用核安會「核能電廠基本資料」的額定熱功率與裝置容量算設計效率。
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_points
from sources import eurostat, gem
from sources.countries import from_name
from topics.nuclear_reactors import GNPT_URL, NUSC_URL, TYPE_CODE
from topics.power_plants import COUNTRY_ALIASES

OUT = OUT_DIR / "topics" / "nuclear-reactors"
FIRST = 1960
LAST = 2026
KTOE_TWH = 0.01163
GEM_LICENSE = {"license": "CC BY 4.0", "attribution": "Global Energy Monitor, Global Integrated Power Tracker (September 2026) / Global Nuclear Power Tracker (August 2026)"}


def _retired() -> None:
    with open(download(GNPT_URL, "gem", "gnpt_map_2026-08.geojson"), encoding="utf-8") as f:
        types = {(p["project-id"], (p.get("unit-name") or "").strip()): TYPE_CODE.get(p.get("reactor-type"), 8)
                 for p in (ft["properties"] for ft in json.load(f)["features"])}
    cache: dict[str, str | None] = {}

    def iso(name: str) -> str | None:
        if name not in cache:
            cache[name] = COUNTRY_ALIASES.get(name) or from_name(name)
        return cache[name]

    units = [u for u in gem.units() if u.fuel == "nuclear" and u.status == "retired"]
    if any(not u.end for u in units):
        raise RuntimeError("GIPT 有沒有退役年份的退役核電機組")
    years = list(range(FIRST, LAST + 1))
    mw: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    n: dict[str, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    groups: dict[tuple[str, int], list[gem.Unit]] = defaultdict(list)
    for u in units:
        c = iso(u.country)
        if not c:
            print(f"    國名對不到：{u.country}")
            continue
        mw[c][max(u.end, FIRST)] += u.mw
        n[c][max(u.end, FIRST)] += 1
        groups[(u.plant, u.end)].append(u)

    def cumulative(series: dict[int, float]) -> list[float | None]:
        out, total = [], 0.0
        for y in years:
            total += series.get(y, 0)
            out.append(round(total, 1) if total else None)
        return out

    cap = {c: cumulative(s) for c, s in sorted(mw.items())}
    cnt = {c: cumulative(s) for c, s in sorted(n.items())}
    world_mw = cumulative({y: sum(s.get(y, 0) for s in mw.values()) for y in years})
    world_n = cumulative({y: sum(s.get(y, 0) for s in n.values()) for y in years})
    write_json(OUT / "retired-capacity.json", indicator_file("retired-capacity", "MW", years, cap, aggregates={"WLD": world_mw}, **GEM_LICENSE))
    write_json(OUT / "retired-count.json", indicator_file("retired-count", "部", years, cnt, aggregates={"WLD": world_n}, **GEM_LICENSE))
    rows = []
    for (_pid, end), us in groups.items():
        m = max(us, key=lambda u: u.mw)
        starts = [u.start for u in us if u.start]
        rows.append({"lon": m.lon, "lat": m.lat, "mw": round(sum(u.mw for u in us), 1), "type": types.get((m.plant, m.unit), 8),
                     "end": end, "start": min(starts) if starts else None, "units": len(us), "iso3": iso(m.country), "name": m.name})
    rows.sort(key=lambda r: -r["mw"])
    data = points_file(rows, ["lon", "lat", "mw", "type", "end", "start", "units", "iso3", "name"],
                       {"lon": 0.001, "lat": 0.001, "mw": 0.1, "type": 1, "end": 1, "start": 1, "units": 1}, strings=("iso3",))
    write_points(OUT / "reactors-retired.json", {**data, **GEM_LICENSE}, text=("name",))
    last = {c: (cnt[c][-1], cap[c][-1]) for c in cap}
    top = sorted(last.items(), key=lambda x: -x[1][0])[:13]
    print(f"  退役：{len(units)} 部、{sum(u.mw for u in units):,.0f} MW；" + "、".join(f"{c} {k:.0f} 部 {m:,.0f} MW" for c, (k, m) in top))
    dec = defaultdict(int)
    for u in units:
        dec[u.end // 10 * 10] += 1
    print("    依年代：" + "、".join(f"{d}s {k}" for d, k in sorted(dec.items())) + f"；點 {len(rows)} 個")
    big = sorted(last.items(), key=lambda x: -x[1][1])[:5]
    print("    容量最多：" + "、".join(f"{c} {m:,.0f}" for c, (_k, m) in big))


def _efficiency() -> None:
    heat = eurostat.series("nrg_inf_nuc", plant_tec="PRD_NUCH", unit="KTOE")
    # 發電量用 Eurostat 自己的核能毛發電量（nrg_bal_peh，GEP、N900H，GWh），跟熱同一個統計口徑
    gen = {c: {y: v / 1000 for y, v in s.items()} for c, s in eurostat.series("nrg_bal_peh", nrg_bal="GEP", siec="N900H", unit="GWH").items()}
    eff: dict[str, dict[int, float]] = {}
    for c, s in heat.items():
        v = {}
        for y, ktoe in s.items():
            g = gen.get(c, {}).get(y)
            if ktoe and ktoe > 0 and g:
                e = g / (ktoe * KTOE_TWH) * 100
                if not 20 <= e <= 45:
                    raise RuntimeError(f"{c} {y} 的核電熱效率 {e:.1f}% 不合理（熱 {ktoe} ktoe、發電 {g} TWh）")
                v[y] = e
        if v:
            eff[c] = v
    years = sorted({y for s in eff.values() for y in s})
    with open(download(NUSC_URL, "nusc", "npp-basic.csv"), encoding="utf-8-sig", newline="") as f:
        tw = [(r["核能電廠基本資料"].strip(), float(r["裝置容量(MWe)"]) / float(r["額定熱功率(MWt)"]) * 100) for r in csv.DictReader(f)]
    plants: dict[str, float] = {}
    for name, e in tw:
        plants[name[:3]] = e  # 同一廠兩部機組的設計值一樣
    zh = "台灣沒有運轉中的核電廠；核安會「核能電廠基本資料」的裝置容量 ÷ 額定熱功率（設計值）：" + "、".join(f"{k} {e:.1f}%" for k, e in plants.items()) + "。"
    en_names = {"核一廠": "Jinshan", "核二廠": "Kuosheng", "核三廠": "Maanshan"}
    en = ("Taiwan has no operating nuclear plants; design efficiency (installed capacity ÷ rated thermal power, Nuclear Safety Commission): "
          + ", ".join(f"{en_names.get(k, k)} {e:.1f}%" for k, e in plants.items()) + ".")
    write_json(OUT / "thermal-efficiency.json", indicator_file(
        "thermal-efficiency", "%", years, {c: [round(s[y], 2) if y in s else None for y in years] for c, s in sorted(eff.items())},
        notes={"TWN": zh}, notesEn={"TWN": en}, license="CC BY 4.0", attribution="Eurostat"))
    y = 2024
    r = sorted(((c, s[y]) for c, s in eff.items() if y in s), key=lambda x: -x[1])
    print(f"  熱效率 {years[0]}–{years[-1]}（{len(eff)} 國）{y}：" + "、".join(f"{c} {v:.1f}" for c, v in r))
    fr = heat["FRA"][y]
    print(f"    法國 {y}：熱 {fr:,.0f} ktoe ＝ {fr * KTOE_TWH:,.1f} TWh，毛發電 {gen['FRA'][y]:,.1f} TWh；{zh}")


def build() -> None:
    _retired()
    _efficiency()
