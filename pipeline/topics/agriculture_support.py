"""農業：農業補貼 %PSE 與政府花多少錢在農業（2026-11-07，製作手冊第二十五批 442，合併候選 1074、1075；
步驟 agriculture-support，輸出 topics/agriculture/）。

- %PSE：OECD 農業政策監測的生產者支持估計（Producer Support Estimate）占農民收入的比例（OECD.TAD.ARP 的 DF_PSE，
  measure PSEP、unit PT_REC_FRM），1986 年起，29 國加 EU、OECD 兩個合計；sdmx.oecd.org（sources/oecd.py，2024 年 7 月起的
  資料 CC BY 4.0）。**歐盟只有一個合計**：成員國用 EU 的值，只填加入以後的年份（ACCESSION），hints 寫「歐盟合計」；英國
  OECD 從 1986 年就有自己的一列，用它自己的。台灣不在 OECD 的監測裡。負值是出口限制、價格管制造成的隱含課稅。
- 農業導向指數（SDG 2.a.1）：FAOSTAT IG（政府支出，CC BY 4.0）element 6197、item 2304（最高一層政府），2001 年起；
  =（農林漁業支出占政府支出）÷（農業附加價值占 GDP），大於 1 是政府支出比農業在經濟裡的份量更偏重農業。農業占 GDP 不到
  TINY_AG（0.5%）的（新加坡、盧森堡、香港）分母太小、指數會放大，hints 寫明。台灣不在 FAOSTAT 的這個檔。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, to_series, write_json, write_manifest_part
from sources import faostat, oecd

OUT = OUT_DIR / "topics" / "agriculture"
PSE_FLOW, PSE_KEY = "OECD.TAD.ARP,DSD_AGR_POLIND@DF_PSE,", ".A.PSEP..PT_REC_FRM"
PSE_FIRST, PSE_LAST = 1986, 2025
AOI_FIRST, AOI_LAST = 2001, 2024
TINY_AG = 0.5
# 歐盟成員國加入的年份（OECD 的 EU 合計依當時的成員）
ACCESSION = {**dict.fromkeys("BEL DEU FRA ITA LUX NLD".split(), 1958), **dict.fromkeys("DNK IRL".split(), 1973), "GRC": 1981,
             **dict.fromkeys("ESP PRT".split(), 1986), **dict.fromkeys("AUT FIN SWE".split(), 1995),
             **dict.fromkeys("CYP CZE EST HUN LVA LTU MLT POL SVK SVN".split(), 2004), **dict.fromkeys("BGR ROU".split(), 2007),
             "HRV": 2013}


def _pse() -> None:
    countries, groups = oecd.series(PSE_FLOW, PSE_KEY)
    years = list(range(PSE_FIRST, PSE_LAST + 1))
    values = {a: to_series(s, years, 1) for a, s in sorted(countries.items())}
    hints, hints_en = {}, {}
    eu = groups.get("EU", {})
    for a, since in ACCESSION.items():
        values[a] = to_series({y: v for y, v in eu.items() if y >= since}, years, 1)
        hints[a] = "歐盟的合計（OECD 只算整個歐盟，不分成員國）"
        hints_en[a] = "EU aggregate (OECD reports the EU as a whole, not by member state)"
    no = {"TWN": "台灣不在 OECD 的農業政策監測裡"}
    no_en = {"TWN": "Taiwan is not covered by the OECD’s agricultural policy monitoring"}
    aggregates = {k: to_series(v, years, 1) for k, v in groups.items() if k in ("OECD",)}
    write_json(OUT / "pse.json", indicator_file("pse", "%", years, values, hints=hints, hintsEn=hints_en, noValue=no,
                                                noValueEn=no_en, aggregates=aggregates, license="CC BY 4.0"))
    for y in (2024, 2025):
        last = sorted(((round(s[y], 1), a) for a, s in countries.items() if y in s), reverse=True)
        print(f"  %PSE {y}：{len(last)} 國；{last}；EU {round(eu.get(y, 0), 1)}；OECD {round(groups.get('OECD', {}).get(y, 0), 1)}")


def _aoi() -> None:
    aoi: dict[str, dict[int, float]] = defaultdict(dict)
    ag_share: dict[str, dict[int, float]] = defaultdict(dict)
    for r in faostat.rows("IG", {6197, 61060}):
        if r.flag == "X" or r.year > AOI_LAST:
            continue
        if r.element == 6197 and r.item == 2304:
            aoi[r.area][r.year] = r.value
        elif r.element == 61060:
            ag_share[r.area][r.year] = r.value
    years = list(range(AOI_FIRST, AOI_LAST + 1))
    values = {a: to_series(s, years, 2) for a, s in sorted(aoi.items()) if a != "WLD"}
    hints, hints_en = {}, {}
    for a, s in aoi.items():
        y = max(s)
        share = ag_share.get(a, {}).get(y)
        if share is not None and share < TINY_AG:
            hints[a] = f"{y} 年農業只占 GDP 的 {share:.2f}%，分母很小，指數容易放大"
            hints_en[a] = f"Agriculture was only {share:.2f}% of GDP in {y}: with so small a denominator the index is inflated"
    no = {"TWN": "台灣不在 FAOSTAT 的政府支出資料裡"}
    no_en = {"TWN": "Taiwan is not in FAOSTAT’s government expenditure data"}
    aggregates = {"WLD": to_series(aoi["WLD"], years, 2)} if "WLD" in aoi else {}
    write_json(OUT / "aoi.json", indicator_file("aoi", "", years, values, hints=hints, hintsEn=hints_en, noValue=no,
                                                noValueEn=no_en, aggregates=aggregates, license="CC BY 4.0"))
    latest = sorted(((s[max(s)], a, max(s)) for a, s in aoi.items() if a != "WLD"), reverse=True)
    print(f"  AOI：{len(latest)} 國；最高 {latest[:10]}；最低 {latest[-6:]}；世界 {aoi.get('WLD', {}).get(AOI_LAST)}；"
          f"農業占 GDP 太小的 {sorted(hints)}")
    print(f"    {[(a, s[max(s)], max(s)) for a, s in aoi.items() if a in ('CHN', 'JPN', 'KOR', 'USA', 'DEU', 'FRA', 'IND', 'VNM', 'NLD', 'BRA', 'THA', 'NOR', 'AUS', 'CHE')]}")
    print(f"    2024 年有值 {sum(1 for s in aoi.values() if AOI_LAST in s)}")


def build() -> None:
    _pse()
    _aoi()
    write_manifest_part(OUT, "agriculture", "agriculture-support", {"sources": [
        "OECD Agricultural Policy Monitoring, DF_PSE (CC BY 4.0)", "FAOSTAT IG (CC BY 4.0)"]})
