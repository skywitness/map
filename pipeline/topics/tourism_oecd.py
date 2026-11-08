"""觀光：觀光衛星帳與觀光的收支比（2026-11-08，製作手冊第二十七批 668，候選 1471、1472；步驟 tourism-oecd，輸出 topics/tourism/）。

- OECD 觀光統計 Key tourism economic indicators（DSD_TOURISM_KEY@DF_KEY_IND_PC）：觀光業直接占 GDP（GDP_SH，分母 B1GQ）、
  占附加價值（GVA_SH，分母 B1G）、觀光產業占總就業（EMP_SH），2008–2025，各國最近一年差很多（latestWithin 10，滑過看年份）。
  三個分母不同，分成三個指標、不放同一個色階。REF_AREA 的次國家代碼（BE1 等）由 to_iso3 篩掉。
- OECD Receipts and expenditure（DSD_TOURISM_RECEIPTS@DF_RECEIPTS）：國際觀光收入 REC_INT ÷ 支出 EXP_INT，同一年、同一幣別，
  SERVICE 用 E10_SD（旅行），不用 _T（旅行加國際客運：客運跟著航空公司的國籍走）。大於 1 是靠觀光賺錢。
  台灣用中央銀行國際收支的「服務-旅行-收入」÷「服務-旅行-支出」（BPM6 的 travel，跟 OECD 同一個口徑）。
- OECD 的資料條款可以轉載、改作（DESIGN.md 第 8 節 2026-10-17 的查證）。台灣不在觀光衛星帳裡（觀光署的衛星帳沒有開放資料）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import cbc, oecd

OUT = OUT_DIR / "topics" / "tourism"
KEY = "OECD.CFE.TOU,DSD_TOURISM_KEY@DF_KEY_IND_PC,"
RECEIPTS = "OECD.CFE.TOU,DSD_TOURISM_RECEIPTS@DF_RECEIPTS,"
FIRST = 2008


def _write(name: str, unit: str, series: dict[str, dict[int, float]], digits: int, **extra) -> None:
    years = list(range(FIRST, max(y for s in series.values() for y in s) + 1))
    values = {c: [round(s[y], digits) if y in s else None for y in years] for c, s in sorted(series.items()) if any(y in s for y in years)}
    write_json(OUT / f"{name}.json", indicator_file(name, unit, years, values, latestWithin=10, **extra))
    latest = {c: (max(s), s[max(s)]) for c, s in series.items() if s}
    ranked = sorted(((round(v, digits), c, y) for c, (y, v) in latest.items()), reverse=True)
    print(f"  {name}：{len(values)} 國；最高 {ranked[:10]}；最低 {ranked[-6:]}")


def satellite() -> None:
    for measure, name in (("GDP_SH", "tsa-gdp"), ("GVA_SH", "tsa-gva"), ("EMP_SH", "tsa-jobs")):
        countries, _ = oecd.series(KEY, "all", MEASURE=measure)
        _write(name, "%", countries, 1, license="OECD 資料條款（可轉載、改作）",
               noValue={"TWN": "台灣不在 OECD 的觀光衛星帳裡"}, noValueEn={"TWN": "Taiwan is not in the OECD tourism satellite accounts"})


def balance() -> None:
    rec, _ = oecd.series(RECEIPTS, "all", MEASURE="REC_INT", SERVICE="E10_SD")
    exp, _ = oecd.series(RECEIPTS, "all", MEASURE="EXP_INT", SERVICE="E10_SD")
    ratio = {c: {y: rec[c][y] / exp[c][y] for y in rec[c] if exp.get(c, {}).get(y)} for c in rec}
    bop = cbc.balance_of_payments(["服務-旅行-收入", "服務-旅行-支出"])
    ratio["TWN"] = {y: v / bop["服務-旅行-支出"][y] for y, v in bop["服務-旅行-收入"].items()
                    if y >= FIRST and bop["服務-旅行-支出"].get(y)}
    ratio = {c: s for c, s in ratio.items() if s}
    _write("travel-balance", "倍", ratio, 2, license="OECD 資料條款（可轉載、改作）；台灣：中央銀行",
           hints={"TWN": "中央銀行國際收支的旅行收入 ÷ 旅行支出"}, hintsEn={"TWN": "Central bank balance of payments: travel credit ÷ travel debit"})
    print(f"    台灣：{ {y: round(v, 2) for y, v in sorted(ratio['TWN'].items())[-6:]} }")


def build() -> None:
    satellite()
    balance()
