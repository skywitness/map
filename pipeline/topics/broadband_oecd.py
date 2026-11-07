"""光纖、5G、每用戶每月用掉幾 GB、電信業的投資（2026-11-07，製作手冊第二十五批 504，候選 1175；擴充「網路速度」）。

OECD Broadband and telecom databases（SDMX 資料流 OECD.STI.DEP,DSD_BB_DATABASE@DF_BB_TEL_DATABASE,2.0；
維度順序 REF_AREA.FREQ.NETWORK_TYPE.MEASURE.NETWORK_ACCESS_MODE.NETWORK_SPEED.UNIT_MEASURE，key `.A.....` 只抓年值，
年值等於第 4 季，不抓季值才不會重複）。OECD 資料條款（DESIGN.md 第 8 節第 12 點）可以改作、商用，註明出處。
- 固網寬頻依技術（SUB、FBB、PT_SB_FBB：光纖與 LAN、Cable、DSL、固定無線接取 FWA、衛星；OECD 自己算的比例，不自己除）
- 5G 用戶（每百人，MBB、5GS、100HB）
- 每個行動寬頻用戶每月數據量（DATA、GBIT_SB_M；英文代碼寫 gigabits，法文說明寫 gigaoctets，OECD 的發布都寫 GB，用 GB）
- 電信業投資與營收（TEL_INV、TEL_REV，百萬美元 PPP）÷ WPP 2024 人口 → 每人美元 PPP
- 宣傳速率 1 Gbps 以上的固網方案占比（ADV_PLN、ST_1000）
OECD、EU27 合計不收。沒有台灣。輸出 public/data/topics/internet-speed/oecd/…，側欄用 broadband-mix.json。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import oecd, wpp
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "internet-speed" / "oecd"
FLOW = "OECD.STI.DEP,DSD_BB_DATABASE@DF_BB_TEL_DATABASE,2.0"
KEY = ".A....."
TECH = {"fibre": "FIB", "cable": "CAB", "dsl": "DSL", "fwa": "FWA", "satellite": "SAT", "other": "OTH"}
MAP_TECH = ["fibre", "cable", "dsl", "fwa", "satellite"]
LICENSE = "OECD Terms and Conditions"


def _series(rows, **filters: str) -> dict[str, dict[int, float]]:
    out: dict[str, dict[int, float]] = {}
    for r in rows:
        if r["OBS_VALUE"] == "" or any(r[k] != v for k, v in filters.items()):
            continue
        iso3 = to_iso3(r["REF_AREA"])
        if iso3:
            out.setdefault(iso3, {})[int(r["TIME_PERIOD"][:4])] = float(r["OBS_VALUE"])
    return out


def _write(path, unit: str, data: dict[str, dict[int, float]], digits: int, within: int = 2) -> list[int]:
    years = list(range(min(y for s in data.values() for y in s), max(y for s in data.values() for y in s) + 1))
    values = {k: [round(s[y], digits) if y in s else None for y in years] for k, s in sorted(data.items())}
    write_json(path, indicator_file(path.stem, unit, years, values, latestWithin=within, license=LICENSE))
    return years


def build() -> None:
    rows = [r for r in oecd.rows(FLOW, KEY) if r["FREQ"] == "A"]
    sub = dict(MEASURE="SUB", NETWORK_TYPE="FBB", UNIT_MEASURE="PT_SB_FBB")
    mix = {item: _series(rows, NETWORK_ACCESS_MODE=code, **sub) for item, code in TECH.items()}
    for item in MAP_TECH:
        years = _write(OUT / "fixed-tech" / f"{item}.json", "%", mix[item], 2)
        print(f"  固網 {item}：{len(mix[item])} 國（{years[0]}–{years[-1]}）")

    five_g = _series(rows, MEASURE="SUB", NETWORK_TYPE="MBB", NETWORK_ACCESS_MODE="5GS", UNIT_MEASURE="100HB")
    data = _series(rows, MEASURE="DATA", UNIT_MEASURE="GBIT_SB_M")
    gig = _series(rows, MEASURE="ADV_PLN", NETWORK_SPEED="ST_1000", UNIT_MEASURE="PT_P_ADV_FBB")
    _write(OUT / "5g.json", "per 100", five_g, 2)
    _write(OUT / "mobile-data.json", "GB", data, 2)
    _write(OUT / "gigabit-plans.json", "%", gig, 2)
    print(f"  5G {len(five_g)} 國、數據量 {len(data)} 國、1 Gbps 方案 {len(gig)} 國")

    pop = wpp.demographic(["TPopulation1July"], 2025)["TPopulation1July"]  # 千人
    for item, measure in (("investment", "TEL_INV"), ("revenue", "TEL_REV")):
        raw = _series(rows, MEASURE=measure, UNIT_MEASURE="USD_PPP")  # 百萬美元 PPP
        per = {k: {y: v * 1e6 / (pop[k][y] * 1e3) for y, v in s.items() if v > 0 and y in pop.get(k, {})} for k, s in raw.items()}
        per = {k: s for k, s in per.items() if s}
        _write(OUT / "telecom" / f"{item}.json", "USD PPP", per, 1, within=3)
        print(f"  電信{item}：{len(per)} 國")

    # 側欄：這一國固網寬頻依技術的比例（歷年）
    years = sorted({y for s in mix.values() for c in s.values() for y in c})
    countries = sorted({c for s in mix.values() for c in s})
    write_json(OUT / "broadband-mix.json", {
        "years": years,
        "items": list(TECH),
        "countries": {c: {item: [mix[item].get(c, {}).get(y) for y in years] for item in TECH} for c in countries},
    })
