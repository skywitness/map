"""鐵路的擴充：鐵路用哪一種電、鐵路車輛（2026-11-07，製作手冊第二十七批 564，候選 1276、1278；步驟 rail-power，
輸出 topics/transport/）。

- Eurostat `rail_if_electri`（電氣化路線長度 km，依供電制度：AC25000、AC15000、DC3000、DC1500、AC_OTH、DC_OTH、TOTAL），
  各國最近一年（德國到 2021 年）。地圖是里程最長的制度（類別圖 6 類），tooltip 列每一種的里程。TOTAL 不等於各制度相加
  （同一段路線兩種制度、或 OTH 另計），不用 TOTAL 算比例。
- 台灣：Eurostat 沒有台灣；英文維基百科「List of railway electrification systems」（revid 1383379414，CC BY-SA 4.0，
  只引事實）把臺鐵與台灣高鐵列在「25 kV AC, 60 Hz」，畫成 25 kV 交流。其他非歐洲國家的維基清單是「系統」不是里程，沒有做。
- 車輛：Eurostat `rail_eq_locon`（機車 LOC 依電力 ELC、柴油 DIE；動力客車 RCA 的 TOTAL）與 `rail_eq_wagon`（貨車 WAG，
  單位 NR），子項目 4 個，比例圓，1970／1990 年起。貨車大跌有一部分是移到租賃公司、不再申報，說明寫明。
- CC BY 4.0；英國、科索沃由 sources/eurostat.py 統一排除。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "transport"
SYSTEMS = [("AC25000", 1, "25 kV 交流", "25 kV AC"), ("AC15000", 2, "15 kV 16.7 Hz 交流", "15 kV 16.7 Hz AC"),
           ("DC3000", 3, "3 kV 直流", "3 kV DC"), ("DC1500", 4, "1.5 kV 直流", "1.5 kV DC"),
           ("AC_OTH", 5, "其他交流", "other AC"), ("DC_OTH", 6, "其他直流", "other DC")]
STOCK = {
    "loco-electric": ("rail_eq_locon", {"vehicle": "LOC", "mot_nrg": "ELC", "unit": "NR"}),
    "loco-diesel": ("rail_eq_locon", {"vehicle": "LOC", "mot_nrg": "DIE", "unit": "NR"}),
    "railcars": ("rail_eq_locon", {"vehicle": "RCA", "mot_nrg": "TOTAL", "unit": "NR"}),
    "wagons": ("rail_eq_wagon", {"vehicle": "WAG", "unit": "NR"}),
}
YEAR = 2024


def build() -> None:
    km = {code: eurostat.series("rail_if_electri", unit="KM", power=code) for code, *_ in SYSTEMS}
    total = eurostat.series("rail_if_electri", unit="KM", power="TOTAL")
    values, hints, hints_en = {}, {}, {}
    for c, s in total.items():
        if not s:
            continue
        y = max(s)
        rows = [(km[code].get(c, {}).get(y, 0), cls, zh, en) for code, cls, zh, en in SYSTEMS]
        rows = [r for r in rows if r[0] > 0]
        if not rows:
            continue
        rows.sort(reverse=True)
        values[c] = [rows[0][1]]
        hints[c] = f"{y} 年：" + "、".join(f"{zh} {v:,.0f} km" for v, _, zh, _ in rows)
        hints_en[c] = f"{y}: " + ", ".join(f"{en} {v:,.0f} km" for v, _, _, en in rows)
    values["TWN"] = [1]
    hints["TWN"] = "臺鐵與台灣高鐵都是 25 kV 60 Hz 交流（英文維基百科的清單；Eurostat 沒有台灣，沒有里程）"
    hints_en["TWN"] = "Taiwan Railway and Taiwan High Speed Rail both use 25 kV 60 Hz AC (English Wikipedia’s list; no lengths, as Eurostat does not cover Taiwan)"
    write_json(OUT / "rail-power.json", indicator_file("rail-power", "category", [YEAR], values, hints=hints, hintsEn=hints_en,
                                                       license="CC BY 4.0"))
    from collections import Counter
    print(f"  電氣化制度：{len(values)} 國；{Counter(v[0] for v in values.values()).most_common()}")
    for c in ("FRA", "DEU", "POL", "ESP", "ITA", "SWE", "CHE", "AUT", "NOR", "TUR", "NLD", "BEL", "CZE", "SVK", "SVN", "HRV", "RUS", "UKR"):
        print(f"    {c}：{values.get(c)} {hints.get(c)}")
    eu = eurostat.series("rail_if_electri", extra_geos=("EU27_2020",), unit="KM", power="TOTAL").get("EU27_2020", {})
    print(f"    EU27 總電氣化 {eu.get(1990)} → {eu.get(2024)}")

    for key, (ds, filters) in STOCK.items():
        data = eurostat.series(ds, **filters)
        years = sorted({y for s in data.values() for y in s})
        write_json(OUT / "rail-stock" / f"{key}.json", indicator_file(
            f"rail-stock-{key}", "輛", years, {c: [s.get(y) for y in years] for c, s in sorted(data.items())}, license="CC BY 4.0"))
        last = {c: (max(s), s[max(s)]) for c, s in data.items() if s}
        top = sorted(((v, c, y) for c, (y, v) in last.items()), reverse=True)
        print(f"  {key}：{years[0]}–{years[-1]}，{len(data)} 國；最新 {top[:6]}")
        for c in ("FRA", "DEU", "ITA", "NLD", "CHE", "POL", "ROU", "UKR"):
            s = data.get(c, {})
            if s:
                print(f"    {c} {min(s)} {s[min(s)]:,.0f} → {max(s)} {s[max(s)]:,.0f}", end="")
        print()
