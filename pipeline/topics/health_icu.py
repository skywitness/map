"""各國健康與醫療：加護病床（2026-11-04，製作手冊第二十批 314）。

- OECD Health Statistics 的 `DSD_HEALTH_REAC_HOSP@DF_BEDS_ICU,1.1`（OECD 的資料條款，同手冊 812）：每十萬人的
  加護病床（HBU_ICU，含成人、兒科、新生兒，35 國）與成人加護病床（HBU_ICU_A，33 國），2004–2025 年。
  成人重症照護床（HBU_CC_A，含高依賴病床）不用，不跟 ICU 混。
- 台灣：OECD 沒有。衛福部《醫療機構現況及醫院醫療服務量統計年報》表 3「歷年醫療院所病床數」的加護病床＋燒傷加護病床
  （年底，2001–2025 年；精神科加護病床不算；政府資料開放授權條款），除以 WPP 2024 的年中人口，放在全部加護病床；
  台灣的統計不分成人、兒科，成人加護病床沒有台灣。台灣是核定開放的床數，不一定都能運作。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, latest_year_span, to_series, write_json
from sources import mohw, oecd, wpp

OUT = OUT_DIR / "topics" / "health"
FLOW = "OECD.ELS.HD,DSD_HEALTH_REAC_HOSP@DF_BEDS_ICU,1.1"
WITHIN = 5


def build() -> None:
    icu, _ = oecd.series(FLOW, MEASURE="HBU_ICU", UNIT_MEASURE="10P5HB")
    adult, _ = oecd.series(FLOW, MEASURE="HBU_ICU_A", UNIT_MEASURE="10P5HB")
    tw = mohw.icu_beds()
    last = max(tw["icu"])
    pop = wpp.demographic(["TPopulation1July"], last_year=last)["TPopulation1July"]["TWN"]
    tw_per = {y: (tw["icu"][y] + tw["burn-icu"].get(y, 0)) / pop[y] * 100 for y in tw["icu"] if pop.get(y)}
    years = latest_year_span(icu, WITHIN)
    icu["TWN"] = {y: v for y, v in tw_per.items() if years[0] <= y <= years[-1]}
    notes = {"TWN": (
        f"OECD 沒有台灣；這是衛福部的醫療院所病床統計：加護病床加燒傷加護病床（不含精神科加護病床），除以年中人口。"
        f"{last} 年底加護病床 {tw['icu'][last]:,.0f} 床、燒傷加護 {tw['burn-icu'][last]:,.0f} 床，每十萬人 {tw_per[last]:.1f} 床。"
        f"台灣的是核定開放的床數，不一定每一床都有人力運作；各國對加護病床的定義也不同，只能大略比較。")}
    notes_en = {"TWN": (
        f"Taiwan is not in OECD data; this is intensive care plus burn intensive care beds (excluding psychiatric intensive care) "
        f"from the Ministry of Health and Welfare, divided by mid-year population. End of {last}: {tw['icu'][last]:,.0f} ICU beds and "
        f"{tw['burn-icu'][last]:,.0f} burn ICU beds, {tw_per[last]:.1f} per 100,000. Taiwan counts licensed beds, not all of which are "
        f"necessarily staffed, and countries define ICU beds differently, so comparisons are approximate.")}
    write_json(OUT / "icu-beds.json", indicator_file(
        "icu-beds", "每十萬人", years, {c: to_series(s, years, 1) for c, s in sorted(icu.items())},
        latestWithin=WITHIN, notes=notes, notesEn=notes_en))
    years2 = latest_year_span(adult, WITHIN)
    write_json(OUT / "icu-beds-adult.json", indicator_file(
        "icu-beds-adult", "每十萬人", years2, {c: to_series(s, years2, 1) for c, s in sorted(adult.items())},
        latestWithin=WITHIN,
        noValue={"TWN": "台灣的加護病床統計不分成人、兒科（全部的加護病床見另一個指標）"},
        noValueEn={"TWN": "Taiwan’s ICU bed statistics do not separate adult and paediatric beds (see the all-ICU indicator)"}))
    for name, s in (("加護病床", icu), ("成人加護病床", adult)):
        latest = sorted(((v[max(v)], c, max(v)) for c, v in s.items() if v), reverse=True)
        print(f"  {name}：{len(s)} 國；最高 {[(c, round(v, 1), y) for v, c, y in latest[:5]]}；最低 {[(c, round(v, 1), y) for v, c, y in latest[-4:]]}")
    print(f"  台灣：{ {y: round(v, 1) for y, v in tw_per.items() if y >= last - 4} }；時間軸 {years[0]}–{years[-1]}")
