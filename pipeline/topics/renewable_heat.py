"""太陽能熱水器與熱泵：不發電的再生能源（新主題，2026-11-07，製作手冊第二十七批 619，候選 1354、1355；
步驟 renewable-heat，輸出 topics/renewable-heat/）。

- **太陽熱集熱板面積**：Eurostat `nrg_inf_stcs`（千平方公尺，1990–2024，CC BY 4.0）。手冊寫這個表含英國（有條件），
  照網站的做法 `sources.eurostat.series` 一律不收英國與科索沃，所以可用。每千人面積用 WPP 人口。
- **太陽熱能的產量**：Eurostat `nrg_cb_rw`（再生能源與廢棄物的商品平衡表）的太陽熱能（siec RA410）初級產量（IPRD，TJ），
  加上台灣：能源署能源供給表（data.gov.tw 8309，sources/moeaea_fuels.py）的「自產能源_再生能源_太陽熱能」（千公噸油當量，
  1 千公噸油當量 = 41.868 TJ）。台灣 2005–2021 年有值，2022 年起表上寫 0，當成沒有資料（附註寫明）。
  指標是每人每年幾度（kWh），1 TJ = 277,778 度。
- **熱泵的環境熱**：Eurostat `nrg_ind_hpind`（TJ，1990–2024），hp_tech：全部（TOTAL）、空氣源（ATH）、地熱源（GTH）、
  水源（HTH）。「環境熱」是熱泵從空氣、地下、水裡搬進來的那一份熱，統計上算再生能源；不是熱泵的出力，也不是台數。
  另有 SPF 達標（*_ABVTH，才算進再生能源占比）的數字，這裡用全部。
- 只有歐洲（加上台灣的太陽熱能）；中國這個最大的太陽能熱水器市場沒有資料（手冊的陷阱），說明寫明。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat, moeaea_fuels, wpp

OUT = OUT_DIR / "topics" / "renewable-heat"
EUROSTAT = {"license": "CC BY 4.0", "attribution": "Eurostat"}
KTOE_TJ = 41.868
TJ_KWH = 277_777.78
TW_SOLAR = "自產能源_再生能源_太陽熱能"
HP = {"total": "TOTAL", "air": "ATH", "ground": "GTH", "water": "HTH"}


def _span(series: dict[str, dict[int, float]]) -> list[int]:
    return sorted({y for s in series.values() for y in s})


def _write(name: str, unit: str, series: dict[str, dict[int, float]], digits: int, **extra: object) -> list[int]:
    years = _span(series)
    vals = {c: [round(s[y], digits) if y in s else None for y in years] for c, s in sorted(series.items()) if s}
    write_json(OUT / f"{name}.json", indicator_file(name, unit, years, vals, **{**EUROSTAT, **extra}))
    return years


def _top(series: dict[str, dict[int, float]], year: int, n: int = 10) -> str:
    r = sorted(((c, s[year]) for c, s in series.items() if year in s), key=lambda x: -x[1])
    return "、".join(f"{c} {v:,.1f}" for c, v in r[:n])


def build() -> None:
    pop = wpp.demographic(["TPopulation1July"], last_year=2025)["TPopulation1July"]  # 千人

    def per_capita(series: dict[str, dict[int, float]], factor: float) -> dict[str, dict[int, float]]:
        out = {}
        for c, s in series.items():
            p = pop.get(c, {})
            v = {y: x * factor / p[y] for y, x in s.items() if p.get(y)}
            if v:
                out[c] = v
        return out

    # 集熱板面積（千平方公尺）
    area = {c: {y: v for y, v in s.items() if v > 0} for c, s in eurostat.series("nrg_inf_stcs", plant_tec="SOL_COL_SURF", unit="THS_M2").items()}
    area = {c: s for c, s in area.items() if s}
    years = _write("collector-area", "千平方公尺", area, 1)
    # 每千人幾平方公尺：千平方公尺 × 1000 ÷ 千人 = 平方公尺／人 × 1000
    area_pc = per_capita(area, 1000)
    _write("collector-per-capita", "平方公尺/千人", area_pc, 1)
    y = years[-1]
    print(f"  集熱板面積 {years[0]}–{y}（{len(area)} 國）：{_top(area, y)}")
    print(f"    每千人：{_top(area_pc, y, 12)}")

    # 太陽熱能的產量（TJ）→ 每人度數
    solar = eurostat.series("nrg_cb_rw", nrg_bal="IPRD", siec="RA410", unit="TJ")
    solar = {c: {y: v for y, v in s.items() if v > 0} for c, s in solar.items()}
    tw = {y: r.get(TW_SOLAR, 0) * KTOE_TJ for y, r in moeaea_fuels.supply().items() if r.get(TW_SOLAR, 0) > 0}
    solar["TWN"] = tw
    solar = {c: s for c, s in solar.items() if s}
    # 度／人：TJ × 277,778 ÷（千人 × 1000）
    solar_pc = per_capita(solar, TJ_KWH / 1000)
    tw_note = ("能源署能源供給表的自產太陽熱能（千公噸油當量換成兆焦耳），2005–2021 年；2022 年起表上寫 0，這裡當成沒有資料。",
               "Domestic solar thermal from Taiwan’s Energy Administration energy supply table (thousand toe converted to TJ), 2005–2021; "
               "the table shows 0 from 2022, treated here as no data.")
    _write("solar-heat", "度/人", solar_pc, 2, notes={"TWN": tw_note[0]}, notesEn={"TWN": tw_note[1]},
           attribution="Eurostat; Energy Administration, Ministry of Economic Affairs (Taiwan)")
    ys = _span(solar_pc)
    print(f"  太陽熱能 {ys[0]}–{ys[-1]}（{len(solar_pc)} 地）：2024 年每人度數 {_top(solar_pc, 2024, 12)}")
    print(f"    台灣：" + "、".join(f"{y} {solar_pc['TWN'][y]:.1f}" for y in sorted(solar_pc["TWN"]) if y in (2005, 2010, 2015, 2020, 2021)))
    print(f"    2024 年總量 TJ：{_top(solar, 2024, 8)}")

    # 熱泵的環境熱（TJ）
    hp = {}
    for k, code in HP.items():
        s = eurostat.series("nrg_ind_hpind", hp_tech=code, nrg_bal="IPRD", plant_tec="AMBT_HEAT", unit="TJ")
        s = {c: {y: v for y, v in x.items() if v > 0} for c, x in s.items()}
        hp[k] = {c: x for c, x in s.items() if x}
    for k, s in hp.items():
        # 存成 PJ（千兆焦耳）：法國 186,817 TJ 這種 6 位數的整數在指標檔會掉最後一位
        _write(f"ambient-heat/{k}", "PJ", {c: {y: v / 1000 for y, v in x.items()} for c, x in s.items()}, 3)
    hp_pc = per_capita(hp["total"], TJ_KWH / 1000)
    _write("ambient-heat-per-capita", "度/人", hp_pc, 1)
    print(f"  熱泵環境熱 2024（TJ）：{_top(hp['total'], 2024, 10)}")
    print(f"    地熱源：{_top(hp['ground'], 2024, 6)}")
    for c in ("SWE", "FRA", "DEU", "NOR", "FIN"):
        t = hp["total"].get(c, {}).get(2024)
        g = hp["ground"].get(c, {}).get(2024)
        if t and g:
            print(f"    {c} 地熱源占 {g / t:.0%}")
    print(f"    每人度數：{_top(hp_pc, 2024, 12)}")
