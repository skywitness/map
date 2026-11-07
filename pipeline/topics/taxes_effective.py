"""稅率：企業新投資的有效平均稅率、遺產及贈與稅占 GDP（2026-11-07，製作手冊第二十五批 458，合併候選 1101、1102；
步驟 taxes-effective，輸出 topics/taxes/）。

- 有效平均稅率（eatr.json）：OECD Corporate Tax Statistics 的前瞻性有效稅率（OECD.CTP.TPS 的 DSD_ETR@DF_ETR_BASELINE，
  CC BY 4.0），MEASURE=EATR、ETR_SCENARIO=FIXED（固定的利率與通膨，手冊建議；CS 是各國實際的利率與通膨，高通膨國家會跳）、
  ETR_TAX_TYPE=COMPOSITE（各類資產合計），105 個轄區，2017–2025。EMTR（邊際稅率）有 −55% 到 185% 的極端值，沒做。
  台灣跟法定公司稅一樣不在 OECD Corporate Tax Statistics。
- 淨有效碳稅率（net-carbon-tax.json，第二十五批 459，候選 1103）：OECD Net Effective Carbon Rates（DSD_NECR@DF_NECRS，1.1 版）
  的 NETECR（碳稅＋排放交易許可價格＋燃料貨物稅－化石燃料補貼，每噸 CO2 當量歐元，現價），STATISTICAL_OPERATION=MEANW
  （依排放量加權的平均），全部部門與排放源；**一定加 key**（整個資料流 308 MB）。只有 2018、2021、2023 三期，85 個經濟體；
  部門別沒有 NETECR（試過回 404）。台灣不在資料裡。
- 遺產及贈與稅占 GDP（inheritance-tax.json）：OECD 全球稅收統計的 T_4300（遺產、繼承與贈與稅），sources/oecd_revenue.py，
  1990 年起；台灣用財政部財政統計資料庫的稅目別實徵淨額（i0401 的「遺產及贈與稅」，含撥入長照基金的部分，不重複加）
  ÷ 主計總處的名目 GDP（sources/dgbas.py）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import dgbas, mof, oecd, oecd_revenue

OUT = OUT_DIR / "topics" / "taxes"
ETR_FLOW = "OECD.CTP.TPS,DSD_ETR@DF_ETR_BASELINE,2.1"
NECR_FLOW, NECR_KEY = "OECD.CTP.TPS,DSD_NECR@DF_NECRS,1.1", "._T._T.NETECR._Z.EUR_TCO2E.MEANW.V.A"
INHERITANCE_FIRST = 1990


def build() -> None:
    eatr, _ = oecd.series(ETR_FLOW, MEASURE="EATR", ETR_SCENARIO="FIXED", ETR_TAX_TYPE="COMPOSITE")
    last = max(y for s in eatr.values() for y in s)
    years = list(range(min(y for s in eatr.values() for y in s), last + 1))
    values = {c: to_series(s, years, 1) for c, s in sorted(eatr.items())}
    no = {"TWN": "台灣不在 OECD 的企業稅統計裡（法定營所稅率 20%）"}
    no_en = {"TWN": "Taiwan is not in the OECD Corporate Tax Statistics (statutory rate 20%)"}
    write_json(OUT / "eatr.json", indicator_file("eatr", "%", years, values, noValue=no, noValueEn=no_en, license="CC BY 4.0"))
    top = sorted(((round(s[last], 1), c) for c, s in eatr.items() if last in s), reverse=True)
    print(f"  EATR {last}：{len(top)} 轄區；最高 {top[:8]}；最低 {top[-9:]}")
    print(f"    {[(c, round(eatr[c][last], 1)) for c in ('USA', 'JPN', 'KOR', 'DEU', 'FRA', 'GBR', 'CHN', 'IND', 'SGP', 'HKG', 'IRL') if last in eatr.get(c, {})]}")

    necr, groups = oecd.series(NECR_FLOW, NECR_KEY)
    years = sorted({y for s in necr.values() for y in s})
    values = {c: to_series(s, years, 1) for c, s in sorted(necr.items())}
    no = {"TWN": "台灣不在 OECD 的有效碳稅率資料裡"}
    no_en = {"TWN": "Taiwan is not in the OECD effective carbon rates data"}
    write_json(OUT / "net-carbon-tax.json", indicator_file("net-carbon-tax", "歐元/噸 CO2e", years, values, noValue=no, noValueEn=no_en,
                                                           license="CC BY 4.0"))
    top = sorted(((round(s[years[-1]], 1), c) for c, s in necr.items() if years[-1] in s), reverse=True)
    print(f"  淨有效碳稅率 {years}：{len(top)} 國；最高 {top[:10]}；最低 {top[-8:]}；負的 {sum(1 for v, _ in top if v < 0)} 國")
    print(f"    {[(c, round(necr.get(c, {}).get(years[-1], -999), 1)) for c in ('USA', 'JPN', 'KOR', 'CHN', 'IND', 'GBR', 'FRA', 'CAN', 'AUS', 'IDN')]}；合計 {groups.keys()}")

    inh = oecd_revenue.inheritance_tax()
    tax = mof.table("i0401")
    gdp = dgbas.gdp_by_industry()
    taiwan = {y: row["遺產及贈與稅"] * 1000 / (gdp[y]["GDP"] * 1e6) * 100 for y, row in tax.items()
              if "遺產及贈與稅" in row and y in gdp and "GDP" in gdp[y] and y >= INHERITANCE_FIRST}
    inh["TWN"] = taiwan
    last = max(y for s in inh.values() for y in s)
    years = list(range(INHERITANCE_FIRST, last + 1))
    values = {c: to_series(s, years, 3) for c, s in sorted(inh.items())}
    hints = {"TWN": "財政部稅目別的遺產及贈與稅實徵淨額 ÷ 主計總處名目 GDP"}
    hints_en = {"TWN": "Ministry of Finance net estate and gift tax collections ÷ DGBAS nominal GDP"}
    write_json(OUT / "inheritance-tax.json", indicator_file("inheritance-tax", "%", years, values, hints=hints, hintsEn=hints_en,
                                                            latestWithin=3, license="CC BY 4.0"))
    y = 2024
    top = sorted(((round(s[y], 3), c) for c, s in inh.items() if y in s), reverse=True)
    zero = [c for v, c in top if v == 0]
    print(f"  遺產稅 {y}：{len(top)} 轄區；最高 {top[:12]}；0 的 {len(zero)} 個 {zero[:15]}")
    print(f"    台灣 {[(yy, round(taiwan[yy], 3)) for yy in (2015, 2020, 2023, 2024, 2025) if yy in taiwan]}；"
          f"{[(c, round(inh[c].get(y, -1), 3)) for c in ('USA', 'JPN', 'KOR', 'DEU', 'FRA', 'GBR', 'CHE', 'SWE', 'AUT')]}")
