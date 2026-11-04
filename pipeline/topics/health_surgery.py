"""各國健康與醫療：每十萬人手術量與外科、麻醉、婦產科專科醫師（2026-11-04，製作手冊第二十批 306）。

- 世界銀行 WDI（CC BY 4.0）：`SH.SGR.PROC.P5`（每十萬人手術量，原始來源 Lancet Commission on Global Surgery 與 UCSF）、
  `SH.MED.SAOP.P5`（每十萬人外科、麻醉與婦產科專科醫師）。年份很零散（多半集中在 2012–2016 年），
  指標檔用 `latestWithin`，各國用 10 年內最近的一年。
- 台灣：WDI 沒有。衛福部《醫療機構現況及醫院醫療服務量統計年報》表 11「歷年醫院醫療服務量統計」的手術人次
  （門診手術＋住院手術，2001–2025 年；政府資料開放授權條款），除以 WPP 2024 的年中人口。定義跟 WDI 不同
  （WDI 只算要全身或區域麻醉的開刀房手術，台灣的手術人次含門診小手術、只算醫院），附註寫明；只算住院手術的值也寫在附註。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, latest_year_span, to_series, write_json
from sources import mohw, worldbank, wpp

OUT = OUT_DIR / "topics" / "health"
WITHIN = 10


def build() -> None:
    surgery, _ = worldbank.fetch("SH.SGR.PROC.P5", 2000)
    surgeons, _ = worldbank.fetch("SH.MED.SAOP.P5", 2000)
    tw = mohw.surgeries()
    last = max(tw["total"])
    pop = wpp.demographic(["TPopulation1July"], last_year=last)["TPopulation1July"]["TWN"]
    per = {k: {y: v / pop[y] * 100 for y, v in s.items() if pop.get(y)} for k, s in tw.items()}
    years = latest_year_span(surgery, WITHIN)
    # 台灣每年都有，但時間軸依各國的資料截；比時間軸新的年份（例如 2025 年）寫附註
    tw_years = [y for y in per["total"] if years[0] <= y <= years[-1]]
    surgery["TWN"] = {y: per["total"][y] for y in tw_years}
    y = last
    notes = {"TWN": (
        f"世界銀行沒有台灣；這是衛福部醫院醫療服務量統計的手術人次（門診加住院），除以年中人口。"
        f"台灣的手術人次只算醫院、含門診小手術，世界銀行的定義只算要全身或區域麻醉的開刀房手術，只能大略比較。"
        f"{y} 年每十萬人 {per['total'][y]:,.0f} 次（門診 {per['outpatient'][y]:,.0f}、住院 {per['inpatient'][y]:,.0f}）"
        f"（地圖的年份到 {years[-1]} 年）。")}
    notes_en = {"TWN": (
        f"Taiwan is not in World Bank data; this is surgical operations in hospitals (outpatient plus inpatient) from the Ministry of "
        f"Health and Welfare, divided by mid-year population. Taiwan’s figure covers hospitals only and includes minor outpatient "
        f"procedures, whereas the World Bank counts only operating-theatre procedures under general or regional anaesthesia, so it "
        f"is only roughly comparable. {y}: {per['total'][y]:,.0f} per 100,000 (outpatient {per['outpatient'][y]:,.0f}, "
        f"inpatient {per['inpatient'][y]:,.0f}) (the map runs to {years[-1]}).")}
    write_json(OUT / "surgery.json", indicator_file(
        "surgery", "每十萬人", years, {c: to_series(s, years, 0) for c, s in sorted(surgery.items())},
        latestWithin=WITHIN, notes=notes, notesEn=notes_en))
    years2 = latest_year_span(surgeons, WITHIN)
    write_json(OUT / "surgical-workforce.json", indicator_file(
        "surgical-workforce", "每十萬人", years2, {c: to_series(s, years2, 1) for c, s in sorted(surgeons.items())},
        latestWithin=WITHIN))
    latest = {c: (max(s), s[max(s)]) for c, s in surgery.items() if c != "TWN"}
    top = sorted(latest.items(), key=lambda kv: -kv[1][1])
    print(f"  手術量：{len(surgery)} 國（含台灣），{years[0]}–{years[-1]}；最高 {top[:5]}；最低 {top[-4:]}")
    print(f"  台灣：{ {k: round(v[y]) for k, v in per.items()} }（{y} 年）")
    latest2 = sorted(((s[max(s)], c) for c, s in surgeons.items()), reverse=True)
    print(f"  外科、麻醉、婦產科醫師：{len(surgeons)} 國，{years2[0]}–{years2[-1]}；最高 {latest2[:4]}；最低 {latest2[-3:]}")
