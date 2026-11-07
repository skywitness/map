"""勞動權利與解僱保護（新主題，2026-11-07，製作手冊第二十五批 455，合併候選 1127、1129；步驟 labour-rights，
輸出 topics/labour-rights/）。

- 解僱保護的嚴格程度（epl/<regular|temporary>.json）：OECD Employment Protection Legislation（OECD.ELS.JAI 的
  DSD_EPL@DF_EPL，CC BY 4.0），0–6 分越高越嚴。**四個 VERSION 是四套方法，不能混**：照手冊用 VERSION1（1985–2025、
  73 國，含 OECD 以外的國家）；EPL_R（正式契約的個別解僱，VERSION1 的 EPL_OV 跟它一樣）與 EPL_T（定期契約）。手冊列的
  2025 年數字（捷克 3.02、美國 0.75）是 VERSION4（2013 年起、43 國的新方法），VERSION1 的美國一直是 0.09。
- 勞動權利的遵守程度（labour-rights.json）：ILOSTAT SDG 8.8.2（DF_SDG_0882_NOC_RT，CC BY 4.0），國家對結社自由與團體
  協商權的遵守程度，0–10 越高越嚴重違反（依 ILO 監督機制的違規紀錄計分，不是權利保障程度的量尺），2015–2024 年。
- 台灣：兩個都沒有台灣（OECD 73 國不含台灣、SDG 指標不含台灣），只在說明寫勞動基準法的制度，不自己打分數。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import ilostat, oecd
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "labour-rights"
EPL_FLOW = "OECD.ELS.JAI,DSD_EPL@DF_EPL,1.0"
EPL = {"regular": "EPL_R", "temporary": "EPL_T"}
VERSION = "VERSION1"
EPL_FIRST = 1985
RIGHTS = "SDG_0882_NOC_RT_A"
RIGHTS_FIRST = 2015
NO_TW = {"TWN": "OECD 與 ILO 的資料都沒有台灣"}
NO_TW_EN = {"TWN": "Taiwan is not in the OECD or ILO data"}


def build() -> None:
    by: dict[str, dict[str, dict[int, float]]] = {k: defaultdict(dict) for k in EPL}
    measure_key = {v: k for k, v in EPL.items()}
    for r in oecd.rows(EPL_FLOW):
        key = measure_key.get(r["MEASURE"])
        if key and r["VERSION"] == VERSION and r["OBS_VALUE"] and (iso3 := to_iso3(r["REF_AREA"])):
            by[key][iso3][int(r["TIME_PERIOD"])] = float(r["OBS_VALUE"])
    for key, series in by.items():
        last = max(y for s in series.values() for y in s)
        years = list(range(EPL_FIRST, last + 1))
        values = {c: to_series(s, years, 2) for c, s in sorted(series.items())}
        write_json(OUT / "epl" / f"{key}.json", indicator_file("epl", "", years, values, latestWithin=10, noValue=NO_TW, noValueEn=NO_TW_EN,
                                                               license="CC BY 4.0"), quiet=True)
        top = sorted(((round(s[last], 2), c) for c, s in series.items() if last in s), reverse=True)
        print(f"  EPL {key} {last}：{len(top)} 國；最高 {top[:10]}；最低 {top[-10:]}")
        print(f"    {[(c, round(series[c].get(last, -1), 2)) for c in ('DEU', 'FRA', 'JPN', 'KOR', 'GBR', 'CHN', 'IND', 'BRA')]}")
    countries, world = ilostat.fetch(RIGHTS)
    last = max(y for s in countries.values() for y in s)
    years = list(range(RIGHTS_FIRST, last + 1))
    values = {c: to_series(s, years, 2) for c, s in sorted(countries.items())}
    write_json(OUT / "labour-rights.json", indicator_file("labour-rights", "", years, values, noValue=NO_TW, noValueEn=NO_TW_EN,
                                                          license="CC BY 4.0"))
    top = sorted(((round(s[last], 2), c) for c, s in countries.items() if last in s), reverse=True)
    zero = [c for v, c in top if v == 0]
    print(f"  勞動權利 {last}：{len(top)} 國；最差 {top[:12]}；0 分 {len(zero)} 國 {zero}")
    print(f"    {[(c, round(countries.get(c, {}).get(last, -1), 2)) for c in ('USA', 'DEU', 'JPN', 'KOR', 'GBR', 'FRA', 'IND', 'BRA', 'CHN')]}")
    write_json(OUT / "manifest.json", {"topic": "labour-rights", "generatedAt": now_iso(),
                                       "sources": ["OECD Employment Protection Legislation (VERSION1)", "ILOSTAT SDG 8.8.2"]})
