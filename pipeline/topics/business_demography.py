"""企業的誕生、死亡與存活（新主題，2026-11-07，製作手冊第二十五批 468，候選 1119；步驟 business-demography，
輸出 topics/business-demography/）。

- Eurostat `bd_size`（Business demography by size class and NACE Rev. 2，CC BY 4.0，sources/eurostat.py 下載整包
  TSV，20 MB；英國、科索沃照網站的規則排除）。全部規模（sizeclas=TOTAL）、NACE「B-S_X_O_S94」（工業、營造與
  服務業，不含控股公司活動與會員組織），2009–2024 年：
  - birth.json：新設率 ENT_BRTHR_PC（當年新設的企業 ÷ 活躍企業，%）。
  - death.json：歇業率 ENT_DTHR_PC（當年歇業的企業 ÷ 活躍企業）。最新一年常常只是初值，latestWithin 1。
  - survival/<y1|y3|y5>.json：ENT_SRVLR_BRTH_PC（N 年前新設的企業到今年還在的比例），**年份改成成立的年份**
    （age=Y3、time=2024 是 2021 年成立、到 2024 年還在，放在 2021 年；手冊說標 2024 會誤導）。
- 台灣（Eurostat 沒有）：經濟部商業發展署的公司登記統計（data.gov.tw，政府資料開放授權條款第 1 版，
  data.gcis.nat.gov.tw 的 CSV，月資料、民國年月）：
  - 新設立公司登記家數（29260）全年合計 ÷ 現有公司登記家數（29275）當年 12 月 → 新設率；
  - 公司解散、撤銷及廢止家數（29266）全年合計 ÷ 同一個分母 → 歇業率。
  口徑跟 Eurostat 不同：分母是登記在案的公司（含沒有營運的），不是活躍企業；只算公司，不含商業登記（行號）。
  存活率沒有。
- **2020 年以前用舊的資料集 `bd_9bd_sz_cl_r2`**（2004–2020，39 MB；新的 bd_size 2021 年以前只有芬蘭、土耳其、冰島
  幾國）：新設率 V97020、歇業率 V97030、1／3／5 年存活率 V97041／V97043／V97045，NACE 是「B-S_X_K642」
  （工業、營造與服務業，不含控股公司），跟新的「B-S_X_O_S94」差一點；兩邊都有的芬蘭差 0–1 個百分點（新設率），
  存活率差比較多（3 年 61 對 74），說明寫明 2020、2021 年之間有斷點。觀察年 ≤ 2020 用舊的、≥ 2021 用新的。
"""
from __future__ import annotations

import csv
import io
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, now_iso, to_series, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "business-demography"
NACE = "B-S_X_O_S94"
GCIS = "https://data.gcis.nat.gov.tw/od/file?oid={}"
TW_FILES = {
    "new": ("29260", "6E7D11F4-748A-4FF3-9686-D616FE163A31"),
    "stock": ("29275", "D142BC2D-C600-4E3A-9DB6-0F9499832ADC"),
    "closed": ("29266", "D80AB27B-5E1D-470E-A761-CBE966DFFADD"),
}
FIRST = 2004
AGES = {"y1": 1, "y3": 3, "y5": 5}
OLD = "bd_9bd_sz_cl_r2"
OLD_NACE = "B-S_X_K642"
SWITCH = 2021  # 觀察年從這一年起用新的 bd_size
OLD_CODES = {"ENT_BRTHR_PC": "V97020", "ENT_DTHR_PC": "V97030", 1: "V97041", 3: "V97043", 5: "V97045"}


def _merged(new: dict[str, dict[int, float]], old: dict[str, dict[int, float]]) -> dict[str, dict[int, float]]:
    out: dict[str, dict[int, float]] = {}
    for c in set(new) | set(old):
        d = {y: v for y, v in old.get(c, {}).items() if y < SWITCH}
        d.update({y: v for y, v in new.get(c, {}).items() if y >= SWITCH})
        if d:
            out[c] = d
    return out


def _gcis(key: str) -> dict[tuple[int, int], float]:
    """{(西元年, 月): 總計家數}"""
    did, oid = TW_FILES[key]
    path = download(GCIS.format(oid), "gcis", f"{did}.csv")
    out = {}
    for r in csv.DictReader(io.StringIO(path.read_text(encoding="utf-8-sig"))):
        ym = (r.get("年月別") or "").strip()
        total = (r.get("總計家數") or "").strip()
        if len(ym) == 5 and ym.isdigit() and total.isdigit():
            out[(int(ym[:3]) + 1911, int(ym[3:]))] = float(total)
    if len(out) < 100:
        raise RuntimeError(f"商業發展署 {did} 的格式可能變了（只讀到 {len(out)} 個月）")
    return out


def _taiwan() -> tuple[dict[int, float], dict[int, float], dict]:
    new, stock, closed = _gcis("new"), _gcis("stock"), _gcis("closed")
    birth, death, detail = {}, {}, {}
    for y in sorted({y for y, _ in stock}):
        if (y, 12) not in stock or any((y, m) not in new or (y, m) not in closed for m in range(1, 13)):
            continue
        n = sum(new[(y, m)] for m in range(1, 13))
        c = sum(closed[(y, m)] for m in range(1, 13))
        birth[y] = n / stock[(y, 12)] * 100
        death[y] = c / stock[(y, 12)] * 100
        detail[y] = {"new": int(n), "closed": int(c), "stock": int(stock[(y, 12)])}
    return birth, death, detail


def _latest(series: dict[str, dict[int, float]], last: int, within: int = 1) -> list[tuple[float, str, int]]:
    out = []
    for c, s in series.items():
        ys = [y for y in s if last - within <= y <= last]
        if ys:
            out.append((round(s[max(ys)], 1), c, max(ys)))
    return sorted(out, reverse=True)


def _write(path, indicator: str, series: dict[str, dict[int, float]], within: int, **extra) -> list[int]:
    last = max(y for s in series.values() for y in s)
    first = min(y for s in series.values() for y in s)
    years = list(range(first, last + 1))
    values = {c: to_series(s, years, 1) for c, s in sorted(series.items()) if s}
    write_json(path, indicator_file(indicator, "%", years, values, latestWithin=within, license="CC BY 4.0", **extra),
               quiet=True)
    return years


def build() -> None:
    tw_birth, tw_death, tw_detail = _taiwan()
    print(f"  台灣：{ {y: (round(tw_birth[y], 2), round(tw_death[y], 2), tw_detail[y]) for y in sorted(tw_birth)[-4:]} }")
    note = {"TWN": "商業發展署的公司登記：分母是登記在案的公司（含沒有營運的），只算公司，不含行號，跟歐盟的口徑不同"}
    note_en = {"TWN": "Company registrations from Taiwan’s Administration of Commerce: the denominator is all registered "
                      "companies (including dormant ones) and sole proprietorships are excluded, unlike the EU definition"}
    for key, indic, tw in (("birth", "ENT_BRTHR_PC", tw_birth), ("death", "ENT_DTHR_PC", tw_death)):
        s = _merged(eurostat.series("bd_size", freq="A", age="TOTAL", sizeclas="TOTAL", indic_sbs=indic, nace_r2=NACE),
                    eurostat.series(OLD, freq="A", indic_sb=OLD_CODES[indic], sizeclas="TOTAL", nace_r2=OLD_NACE))
        s["TWN"] = tw
        years = _write(OUT / f"{key}.json", key, s, 1, hints=note, hintsEn=note_en)
        top = _latest({c: d for c, d in s.items() if c != "TWN"}, years[-1])
        print(f"  {key}（到 {years[-1]}）{len(top)} 國：最高 {top[:8]}；最低 {top[-6:]}；台灣 {_latest({'TWN': tw}, years[-1])}")
    for key, age in AGES.items():
        s = _merged(eurostat.series("bd_size", freq="A", age=f"Y{age}", sizeclas="TOTAL", indic_sbs="ENT_SRVLR_BRTH_PC",
                                    nace_r2=NACE),
                    eurostat.series(OLD, freq="A", indic_sb=OLD_CODES[age], sizeclas="TOTAL", nace_r2=OLD_NACE))
        cohort = {c: {y - age: v for y, v in d.items() if y - age >= FIRST} for c, d in s.items()}
        cohort = {c: d for c, d in cohort.items() if d}
        years = _write(OUT / "survival" / f"{key}.json", "survival", cohort, 5)
        top = _latest(cohort, years[-1])
        print(f"  {age} 年存活（成立年 {years[0]}–{years[-1]}）{len(top)} 國：最高 {top[:7]}；最低 {top[-6:]}")
    write_json(OUT / "taiwan.json", {"years": sorted(tw_detail), "detail": tw_detail,
                                     "source": "經濟部商業發展署 公司登記統計（data.gov.tw 29260、29266、29275）"})
    write_json(OUT / "manifest.json", {"topic": "business-demography", "generatedAt": now_iso(),
                                       "sources": ["Eurostat bd_size", "經濟部商業發展署 公司登記統計"]})
