"""生質燃料與氫：產量與產能（新主題，2026-11-07，製作手冊第二十七批 620，候選 1356、1357；
步驟 biofuels-hydrogen，輸出 topics/biofuels-hydrogen/）。

- **生質燃料的產量（全世界）**：EIA International Energy Statistics（公有領域，INTL.zip 已快取），產品 79 生質燃料合計、
  80 乙醇、81 生質柴油，活動 1（產量），單位 MT（千公噸）換成百萬公噸。手冊的陷阱：巴西的乙醇、美國的玉米乙醇比歐盟大很多，
  只畫歐洲的產能會給錯誤印象，所以用 EIA 補全世界。EIA 的區域合計（代碼不是三個字母或含「+」）不算。
- **生質燃料的產能（歐洲）**：Eurostat `nrg_inf_lbpc`（千公噸/年，1990–2024，CC BY 4.0），siec：R5220P 純生質柴油、
  R5210P 純生質汽油、R5230P 純生質航空燃油、R5290 其他液體生質燃料。表裡有英國，`sources.eurostat.series` 一律不收。
- **氫的產能（歐洲）**：Eurostat `nrg_inf_h2stpc`（兆焦耳/年，2022–2024），plant_tec CAP_PRD、siec HYD；
  全部（TOTAL）與電解（ELC_ELCYS）。指標：產能（存成 PJ，德國 148,510 TJ 這種 6 位數整數在指標檔會掉最後一位）與電解占產能的 %。
  產能含既有的天然氣重組廠（灰氫），不是「氫能計畫」。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eia, eurostat
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "biofuels-hydrogen"
EUROSTAT = {"license": "CC BY 4.0", "attribution": "Eurostat"}
EIA = {"license": "Public domain (EIA)"}
PRODUCTION = {"all": "79-1-MT", "ethanol": "80-1-MT", "biodiesel": "81-1-MT"}
CAPACITY = {"biodiesel": "R5220P", "biogasoline": "R5210P", "biojet": "R5230P", "other": "R5290"}
MIN_MT = 0.001  # 至少 1,000 公噸


def _years(series: dict[str, dict[int, float]]) -> list[int]:
    return sorted({y for s in series.values() for y in s})


def _top(series: dict[str, dict[int, float]], year: int, n: int = 10, fmt: str = "{:,.1f}") -> str:
    r = sorted(((c, s[year]) for c, s in series.items() if s.get(year) is not None), key=lambda x: -x[1])
    return "、".join(f"{c} {fmt.format(v)}" for c, v in r[:n])


def _write(name: str, unit: str, series: dict[str, dict[int, float]], digits: int, **extra: object) -> list[int]:
    years = _years(series)
    vals = {c: [round(s[y], digits) if y in s else None for y in years] for c, s in sorted(series.items()) if s}
    write_json(OUT / f"{name}.json", indicator_file(name, unit, years, vals, **extra))
    return years


def build() -> None:
    # EIA 的產量（千公噸 → 百萬公噸）
    data = eia.annual(list(PRODUCTION.values()))
    for k, key in PRODUCTION.items():
        raw = data[key]
        series = {}
        world: dict[int, float] = {}
        for r, s in raw.items():
            iso = to_iso3(r) if len(r) == 3 and "+" not in r else None
            if r == "WORL":
                world = {y: v / 1000 for y, v in s.items()}
            if not iso:
                continue
            v = {y: x / 1000 for y, x in s.items() if y >= 1980 and x / 1000 >= MIN_MT}
            if v:
                series[iso] = v
        years = _years(series)
        _write(f"production/{k}", "百萬公噸", series, 3,
               aggregates={"WLD": [round(world[y], 3) if y in world else None for y in years]}, **EIA)
        y = 2024
        print(f"  EIA {k} {years[0]}–{years[-1]}：世界 {world.get(y, 0):,.1f} Mt；{_top(series, y)}")
        print("    " + "、".join(f"{c} {series[c].get(y, 0):,.2f}" for c in ("TWN", "DEU", "FRA", "CHN", "IND", "THA") if c in series))

    # Eurostat 的產能（千公噸/年）
    cap = {}
    for k, siec in CAPACITY.items():
        s = eurostat.series("nrg_inf_lbpc", siec=siec, plant_tec="CAP_PRD", unit="THS_TY")
        cap[k] = {c: {y: v for y, v in x.items() if v > 0} for c, x in s.items()}
        cap[k] = {c: x for c, x in cap[k].items() if x}
    total: dict[str, dict[int, float]] = {}
    for s in cap.values():
        for c, x in s.items():
            for y, v in x.items():
                total.setdefault(c, {}).setdefault(y, 0.0)
                total[c][y] += v
    cap["all"] = total
    for k, s in cap.items():
        _write(f"capacity/{k}", "千公噸/年", s, 1, **EUROSTAT)
        print(f"  產能 {k} 2024（{sum(1 for x in s.values() if 2024 in x)} 國，合計 {sum(x.get(2024, 0) for x in s.values()):,.0f}）：{_top(s, 2024, 10, '{:,.0f}')}")

    # 氫的產能（TJ → PJ）與電解的比例
    h_total = eurostat.series("nrg_inf_h2stpc", plant_tec="CAP_PRD", nrg_tech="TOTAL", siec="HYD", unit="TJ")
    h_elc = eurostat.series("nrg_inf_h2stpc", plant_tec="CAP_PRD", nrg_tech="ELC_ELCYS", siec="HYD", unit="TJ")
    pj = {c: {y: v / 1000 for y, v in s.items() if v > 0} for c, s in h_total.items()}
    pj = {c: s for c, s in pj.items() if s}
    _write("hydrogen-capacity", "PJ/年", pj, 3, **EUROSTAT)
    share = {}
    for c, s in h_total.items():
        v = {y: h_elc.get(c, {}).get(y, 0.0) / t * 100 for y, t in s.items() if t > 0 and y in h_elc.get(c, {})}
        if v:
            share[c] = v
    _write("hydrogen-electrolysis", "%", share, 2, **EUROSTAT)
    print(f"  氫產能 2024（PJ）：{_top(pj, 2024, 12)}；合計 {sum(s.get(2024, 0) for s in pj.values()):,.1f}")
    print(f"    電解 TJ：" + "、".join(f"{c} {h_elc.get(c, {}).get(2024)}" for c in ("DEU", "NLD", "ESP", "GRC", "POL", "FRA", "ITA", "SWE", "CZE")))
    print(f"    電解 %：{_top(share, 2024, 12)}；全部電解 {sum(h_elc.get(c, {}).get(2024, 0) for c in h_total):,.0f} TJ")
