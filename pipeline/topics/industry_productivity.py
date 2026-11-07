"""產業結構與工業：製造業的產能利用率、工業與服務業的勞動生產力、GDP 的十大產業（2026-11-07，製作手冊第二十五批 447，
合併候選 1085–1087；步驟 industry-productivity，輸出 topics/industry/）。

- 產能利用率（capacity-utilization.json）：Eurostat ei_bsin_q_r2（歐盟執委會 DG ECFIN 的企業調查，CC BY 4.0）的
  BS-ICU-PC、季節調整（SA），32 國，1980 年起（多數國家 1990 年代起）。網站的時間軸是年，地圖用**當年各季的平均**，
  不滿 4 季的年份 hints 寫明幾季；側欄（capacity-quarterly.json）是逐季的線，跟 EU27 對照。這是企業問卷的自評值，
  跨國比較水準要小心（馬爾他、丹麥偏低），比較變化比較有意義。台灣：經濟部的工業生產統計沒有產能利用率的開放資料
  （使用者 2026-11-07 決定台灣留空、說明寫明）。
- 勞動生產力（labour-productivity/<子項目>.json）：World Bank WDI NV.IND.EMPL.KD（工業含營造，每位就業者的附加價值，
  2015 年固定價美元）、NV.SRV.EMPL.KD（服務業），1991 年起。台灣不在 WDI；主計總處的各業平減指數表是季資料、電力業
  有負的附加價值，換成 2015 年固定價美元口徑對不起來，沒有自算。
- GDP 的十大產業（gva-share/<子項目>.json）：Eurostat nama_10_a10 的 B1G（附加價值）、unit PC_TOT（占全部附加價值 %），
  NACE A*10；「礦業與公用事業」用 B-E 減 C（製造業另列），十一項加起來 100%。歐洲 40 國左右（科索沃排除，見
  sources/eurostat.py）；台灣用主計總處的各業 GDP（sources/dgbas.py 的 gdp_by_industry()，行業分類同樣是 A–S 大類），
  分母是各業合計（不含進口稅與加值型營業稅），跟 Eurostat 的基本價格附加價值口徑相近。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import dgbas, eurostat, worldbank

OUT = OUT_DIR / "topics" / "industry"
EU = "EU27_2020"
CU_FIRST = 1985
PROD_CODES = {"industry": "NV.IND.EMPL.KD", "services": "NV.SRV.EMPL.KD"}
PROD_FIRST = 1991
GVA_FIRST = 1995
# 網站的子項目 → NACE A*10（mining-utilities 是 B-E 減 C）
GVA_ITEMS = {"agriculture": "A", "mining-utilities": "B-E", "manufacturing": "C", "construction": "F", "trade": "G-I", "ict": "J",
             "finance": "K", "real-estate": "L", "business": "M_N", "public": "O-Q", "other": "R-U"}
# 主計總處的行業（大類字母）→ 子項目
TW_GVA = {"A": "agriculture", "B": "mining-utilities", "D": "mining-utilities", "E": "mining-utilities", "C": "manufacturing",
          "F": "construction", "G": "trade", "H": "trade", "I": "trade", "J": "ict", "K": "finance", "L": "real-estate",
          "M": "business", "N": "business", "O": "public", "P": "public", "Q": "public", "R": "other", "S": "other"}


def _capacity() -> None:
    q = eurostat.quarterly("ei_bsin_q_r2", extra_geos=(EU,), freq="Q", indic="BS-ICU-PC", s_adj="SA")
    last_year = max(int(p[:4]) for s in q.values() for p in s)
    years = list(range(CU_FIRST, last_year + 1))
    values, hints, hints_en = {}, {}, {}
    for c, s in sorted(q.items()):
        by_year: dict[int, list[float]] = defaultdict(list)
        for p, v in s.items():
            by_year[int(p[:4])].append(v)
        avg = {y: sum(v) / len(v) for y, v in by_year.items() if y >= CU_FIRST}
        if c == EU:
            eu_avg = avg
            continue
        values[c] = to_series(avg, years, 1)
        n = len(by_year.get(last_year, []))
        if 0 < n < 4:
            hints[c] = f"{last_year} 年只有 {n} 季的平均"
            hints_en[c] = f"{last_year}: average of {n} quarter{'s' if n > 1 else ''} only"
    no = {"TWN": "經濟部沒有開放產能利用率的資料"}
    no_en = {"TWN": "Taiwan’s Ministry of Economic Affairs publishes no open data on capacity utilisation"}
    write_json(OUT / "capacity-utilization.json", indicator_file(
        "capacity-utilization", "%", years, values, hints=hints, hintsEn=hints_en, noValue=no, noValueEn=no_en,
        license="CC BY 4.0"))
    # 側欄：逐季
    periods = sorted({p for s in q.values() for p in s if int(p[:4]) >= CU_FIRST})
    write_json(OUT / "capacity-quarterly.json", {
        "quarters": periods,
        "values": {c: [s.get(p) for p in periods] for c, s in sorted(q.items()) if c != EU},
        "eu": [q[EU].get(p) for p in periods],
    })
    y = last_year
    print(f"  產能利用率 {y} 年平均：{sorted(((round(v[y], 1), c) for c, v in ((c, {yy: vv for yy, vv in zip(years, s) if vv is not None}) for c, s in values.items()) if y in v), reverse=True)}")
    print(f"    EU27 {y} {eu_avg.get(y):.1f}、2009 {eu_avg.get(2009):.1f}、2020 {eu_avg.get(2020):.1f}、1993 {eu_avg.get(1993, 0):.1f}；hints {hints}")
    print(f"    最新一季 {max(q[EU])}：{sorted(((s[max(s)], c, max(s)) for c, s in q.items()), reverse=True)[:5]}")


def _productivity() -> None:
    no = {"TWN": "台灣不在世界銀行的資料裡"}
    no_en = {"TWN": "Taiwan is not in World Bank data"}
    for key, code in PROD_CODES.items():
        countries, world = worldbank.fetch(code, PROD_FIRST)
        last = max(y for s in countries.values() for y in s)
        years = list(range(PROD_FIRST, last + 1))
        values = {c: to_series(s, years, 0) for c, s in sorted(countries.items())}
        # 美國只到 2015 年這類：前端用 10 年內最近一年的值，標實際年份
        write_json(OUT / "labour-productivity" / f"{key}.json", indicator_file(
            "labour-productivity", "2015 年美元", years, values, noValue=no, noValueEn=no_en, latestWithin=10,
            aggregates={"WLD": to_series(world, years, 0)}, license="CC BY 4.0"), quiet=True)
        latest = sorted(((round(s[max(s)]), c, max(s)) for c, s in countries.items()), reverse=True)
        print(f"  勞動生產力 {key}：{len(countries)} 國，到 {last}；世界 {round(world.get(last, 0))}；前 8 {latest[:8]}")
        print(f"    {[(c, round(countries[c][max(countries[c])]), max(countries[c])) for c in ('USA', 'KOR', 'JPN', 'DEU', 'CHN', 'MEX', 'BRA', 'IDN', 'IND', 'MAC') if c in countries]}")


def _gva() -> None:
    raw = {nace: eurostat.series("nama_10_a10", freq="A", unit="PC_TOT", na_item="B1G", nace_r2=nace)
           for nace in set(GVA_ITEMS.values()) | {"C"}}
    tw_raw = dgbas.gdp_by_industry()
    last = max(max(max(s) for s in by.values()) for by in raw.values())
    years = list(range(GVA_FIRST, last + 1))
    shares: dict[str, dict[str, dict[int, float]]] = {k: defaultdict(dict) for k in GVA_ITEMS}
    for key, nace in GVA_ITEMS.items():
        for c, s in raw[nace].items():
            for y, v in s.items():
                if y < GVA_FIRST:
                    continue
                if key == "mining-utilities":
                    c_v = raw["C"].get(c, {}).get(y)
                    if c_v is None:
                        continue
                    v = v - c_v
                shares[key][c][y] = v
    for y, row in tw_raw.items():
        if y < GVA_FIRST:
            continue
        total = row.get("合計")
        if not total:
            continue
        sums: dict[str, float] = defaultdict(float)
        for name, v in row.items():
            letter = name.split(".")[0]
            if len(letter) == 1 and letter in TW_GVA:
                sums[TW_GVA[letter]] += v
        if len(sums) == len(GVA_ITEMS):
            for k, v in sums.items():
                shares[k]["TWN"][y] = v / total * 100
    hints = {"TWN": "主計總處的各業 GDP（各業合計為分母）"}
    hints_en = {"TWN": "DGBAS GDP by industry (share of the sum of industries)"}
    for key in GVA_ITEMS:
        values = {c: to_series(s, years, 1) for c, s in sorted(shares[key].items())}
        write_json(OUT / "gva-share" / f"{key}.json", indicator_file("gva-share", "%", years, values, hints=hints,
                                                                     hintsEn=hints_en, license="CC BY 4.0"), quiet=True)
    y = last - 1
    for c in ("TWN", "DEU", "IRL", "LUX", "MLT", "FRA", "NOR", "GRC"):
        print(f"  十大產業 {c} {y}：{[(k, round(shares[k][c].get(y, -1), 1)) for k in GVA_ITEMS]}；合計 {sum(shares[k][c].get(y, 0) for k in GVA_ITEMS):.1f}")
    print(f"    國家數 {len(shares['trade'])}；{y} 年有值 {sum(1 for s in shares['trade'].values() if y in s)}、{last} 年 {sum(1 for s in shares['trade'].values() if last in s)}")
    # 不含製造業最大的產業
    non_mfg = [k for k in GVA_ITEMS if k != "manufacturing"]
    biggest = {c: max(non_mfg, key=lambda k: shares[k].get(c, {}).get(y, -1)) for c in shares["trade"] if y in shares["trade"][c]}
    from collections import Counter
    print(f"    {y} 年製造業以外最大的產業：{Counter(biggest.values())}；{ {c: k for c, k in biggest.items() if k not in ('trade', 'public')} }")


def build() -> None:
    _capacity()
    _productivity()
    _gva()
