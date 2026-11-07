"""油價裡的燃料稅（2026-11-05，製作手冊第二十三批 404〔候選 1019〕；步驟 fuel-tax，輸出 topics/fuel-tax/；原本在電價與油價，2026-11-07 搬出來）。

- 歐盟 Weekly Oil Bulletin 的歷史檔（topics/energy_prices.py 已經在讀同一個 xlsx 的含稅價；檔內寫「Reproduction is authorised
  provided the source is acknowledged」，執委會網站是 CC BY 4.0）。同一國同一週的「Prices with taxes」與「Prices wo taxes」：
  稅占零售價的比例 = 1 − 未稅價 ÷ 含稅價（稅含貨物稅、加值稅與其他間接稅），一年至少 40 週才算年平均，2005–2026（2026 年到
  資料的最後一週）。
- 2026-11-06 起拆成加值稅與「燃料稅與其他間接稅」：同一個檔的「VAT」工作表是各國加值稅率的歷史（「Since」那一天起的
  稅率，汽油、柴油各一欄），加值稅占含稅價的比例 = 稅率 ÷（100 ＋ 稅率），其餘的稅（貨物稅加其他間接稅）= 稅的比例 − 加值稅。
  這樣不用換匯（貨物稅表是各國貨幣、每千公升）。稅率表有空白格（例如匈牙利 2015-01-01 那一列只改了暖氣油），當作沒變、沿用
  前一個稅率。「其他間接稅」各國定義不同（手冊提醒），不再細分。
- 台灣不在 Weekly Oil Bulletin；台灣的汽油稅費（貨物稅、營業稅、石油基金、空污費）沒有現成的比例統計，不畫。
"""
from __future__ import annotations

import statistics
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from topics.energy_prices import WOB_URL, eurostat_iso3

OUT = OUT_DIR / "topics" / "fuel-tax"  # 2026-11-07（第二十七批 585）從電價與油價搬出來，獨立成交通政策與投資的主題
FUELS = {"euro95": "gasoline", "diesel": "diesel"}
MIN_WEEKS = 40


def _sheet(wb, name: str, kind: str) -> dict[tuple[str, str], dict]:
    """{(iso3, fuel): {日期: 每千公升歐元}}"""
    rows = wb[name].iter_rows(values_only=True)
    names = next(rows)
    cols = {}
    for i, n in enumerate(names):
        if not isinstance(n, str):
            continue
        for suffix, fuel in FUELS.items():
            if n.endswith(f"_price_{kind}_{suffix}"):
                geo = n.split("_", 1)[0]
                if geo not in ("EU", "EUR"):
                    cols[i] = (eurostat_iso3({"GR": "EL"}.get(geo, geo)), fuel)
    out: dict[tuple[str, str], dict] = defaultdict(dict)
    for row in rows:
        if not hasattr(row[0], "year"):
            continue
        for i, key in cols.items():
            v = row[i]
            if isinstance(v, (int, float)) and v > 0:
                out[key][row[0].date()] = v
    return out


def _vat(wb) -> dict[tuple[str, str], list[tuple[object, float]]]:
    """{(iso3, fuel): [(起始日, 稅率 %), …]}，依日期排好；空白格沿用前一個稅率"""
    rows = list(wb["VAT"].iter_rows(values_only=True))
    raw: dict[str, list[tuple[object, object, object]]] = defaultdict(list)
    geo = None
    for r in rows[4:]:
        if isinstance(r[0], str) and r[0].endswith("_"):
            geo = r[0][:-1]
        if geo and hasattr(r[1], "year"):
            raw[geo].append((r[1].date(), r[2], r[3]))
    out: dict[tuple[str, str], list[tuple[object, float]]] = {}
    for geo, entries in raw.items():
        iso3 = eurostat_iso3({"GR": "EL"}.get(geo, geo))
        for col, fuel in ((1, "gasoline"), (2, "diesel")):
            steps, rate = [], None
            for e in sorted(entries, key=lambda e: e[0]):
                if isinstance(e[col], (int, float)):
                    rate = float(e[col])
                if rate is not None:
                    steps.append((e[0], rate))
            if iso3 and steps:
                out[(iso3, fuel)] = steps
    return out


def _rate(steps: list[tuple[object, float]], day) -> float | None:
    rate = None
    for since, r in steps:
        if since <= day:
            rate = r
    return rate


def build() -> None:
    import openpyxl

    path = download(WOB_URL, "eu-oil-bulletin", "Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    with_tax = _sheet(wb, "Prices with taxes", "with_tax")
    wo_tax = _sheet(wb, "Prices wo taxes", "wo_tax")
    vat = _vat(wb)
    shares: dict[str, dict[str, dict[int, list[float]]]] = {f: defaultdict(lambda: defaultdict(list)) for f in FUELS.values()}
    excise: dict[str, dict[str, dict[int, list[float]]]] = {f: defaultdict(lambda: defaultdict(list)) for f in FUELS.values()}
    rates: dict[str, dict[str, dict[int, float]]] = {f: defaultdict(dict) for f in FUELS.values()}
    detail: dict[str, dict[str, dict[int, list[list[float]]]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    for (iso3, fuel), prices in with_tax.items():
        net = wo_tax.get((iso3, fuel), {})
        for day, p in prices.items():
            n = net.get(day)
            if n and 0 < n < p:
                shares[fuel][iso3][day.year].append(1 - n / p)
                detail[iso3][fuel][day.year].append([p, n])
                r = _rate(vat.get((iso3, fuel), []), day)
                if r is not None:
                    excise[fuel][iso3][day.year].append(1 - n / p - r / (100 + r))
                    rates[fuel][iso3][day.year] = r
    years = sorted({y for f in shares.values() for s in f.values() for y in s})
    last = years[-1]
    for fuel, by_country in shares.items():
        values, hints, hints_en = {}, {}, {}
        for iso3, s in by_country.items():
            row = [round(statistics.fmean(s[y]) * 100, 1) if len(s.get(y, [])) >= MIN_WEEKS else None for y in years]
            if any(v is not None for v in row):
                values[iso3] = row
                y = max(yy for yy, v in detail[iso3][fuel].items() if len(v) >= MIN_WEEKS)
                p = statistics.fmean(a for a, _ in detail[iso3][fuel][y]) / 1000
                n = statistics.fmean(b for _, b in detail[iso3][fuel][y]) / 1000
                hints[iso3] = f"{y} 年平均每公升含稅 {p:.2f} 歐元、未稅 {n:.2f} 歐元"
                hints_en[iso3] = f"{y} average per litre: €{p:.2f} with taxes, €{n:.2f} without"
                if len(excise[fuel][iso3].get(y, [])) >= MIN_WEEKS:
                    e = statistics.fmean(excise[fuel][iso3][y]) * 100
                    total = statistics.fmean(s[y]) * 100
                    hints[iso3] += f"；稅占 {total:.1f}%：加值稅 {total - e:.1f}%（稅率 {rates[fuel][iso3][y]:g}%）、燃料稅與其他 {e:.1f}%"
                    hints_en[iso3] += f"; taxes {total:.1f}%: VAT {total - e:.1f}% (rate {rates[fuel][iso3][y]:g}%), excise and other {e:.1f}%"
        write_json(OUT / f"{fuel}-tax-share.json", indicator_file(
            f"{fuel}-tax-share", "%", years, values, latestWithin=2, hints=hints, hintsEn=hints_en))
        ex_values = {}
        for iso3, s in excise[fuel].items():
            row = [round(statistics.fmean(s[y]) * 100, 1) if len(s.get(y, [])) >= MIN_WEEKS else None for y in years]
            if any(v is not None for v in row):
                ex_values[iso3] = row
        write_json(OUT / f"{fuel}-excise-share.json", indicator_file(
            f"{fuel}-excise-share", "%", years, ex_values, latestWithin=2, hints=hints, hintsEn=hints_en))
        ex_latest = sorted(((v[-1], c) for c, v in ex_values.items() if v[-1] is not None), reverse=True)
        print(f"  {fuel} 燃料稅與其他：{len(ex_values)} 國；{last} 年 {ex_latest}")
        latest = sorted(((v[-1], c) for c, v in values.items() if v[-1] is not None), reverse=True)
        print(f"  {fuel}：{len(values)} 國，{years[0]}–{last}；{last} 年 {latest}")
        print(f"  例：{hints.get('DEU')}；{hints.get('FRA')}")
