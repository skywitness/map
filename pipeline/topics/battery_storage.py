"""發電廠地圖的擴充：電池儲能，裝了多少 MW、能存幾度（2026-11-07，製作手冊第二十七批 612，候選 1342；
步驟 battery-storage，輸出 topics/power-plants/）。

- Eurostat `nrg_inf_bt`（Batteries power capacities and energy storage，CC BY 4.0；41 個 geo 不含英國，科索沃照網站的規則不收），
  siec=BA100（全部電池）：CAP_BAP 功率（MW）、CAP_BAST 儲電量（MWh）、BA_G_ELC_I／U 併網充入、放出（GWh）。
- 指標：電池的功率（MW，比例圓）、能撐幾小時（MWh ÷ MW，兩個都有申報、功率至少 10 MW 才算）。
- 手冊的陷阱：只有歐洲；MW 與 MWh 的申報國不完全一樣；不含電動車與大部分家用小電池。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "power-plants"
MIN_MW = 10


def build() -> None:
    mw = eurostat.series("nrg_inf_bt", freq="A", plant_tec="CAP_BAP", siec="BA100", unit="MW")
    mwh = eurostat.series("nrg_inf_bt", freq="A", plant_tec="CAP_BAST", siec="BA100", unit="MWH")
    years = list(range(2020, max(y for v in mw.values() for y in v) + 1))  # 2020 年以前都沒有申報
    power = {c: [round(v[y], 1) if v.get(y) else None for y in years] for c, v in sorted(mw.items())}
    power = {c: s for c, s in power.items() if any(s)}
    hours = {}
    for c in sorted(set(mw) & set(mwh)):
        row = [round(mwh[c][y] / mw[c][y], 3) if mw[c].get(y, 0) >= MIN_MW and mwh[c].get(y) else None for y in years]
        if any(row):
            hours[c] = row
    write_json(OUT / "battery-power.json", indicator_file("battery-power", "MW", years, power, license="CC BY 4.0"))
    write_json(OUT / "battery-hours.json", indicator_file("battery-hours", "小時", years, hours, license="CC BY 4.0"))
    y = years[-1]
    r = sorted(((c, v[y], mwh.get(c, {}).get(y)) for c, v in mw.items() if v.get(y)), key=lambda x: -x[1])
    print(f"  電池功率 {y}（{len(r)} 國）：" + "、".join(f"{c} {p:,.0f} MW／{e or 0:,.0f} MWh" for c, p, e in r[:12]))
    h = sorted(((c, s[-1]) for c, s in hours.items() if s[-1]), key=lambda x: -x[1])
    print(f"  能撐幾小時 {y}（{len(h)} 國）：" + "、".join(f"{c} {v:.2f}" for c, v in h))
    print("  逐年合計：" + "、".join(f"{yy} {sum(v.get(yy, 0) for v in mw.values()):,.0f}" for yy in years))
