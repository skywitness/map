"""石油、天然氣與煤的擴充：蘊藏量還能採幾年（R/P 比，2026-11-07，製作手冊第二十七批 616，候選 1348；
步驟 reserves-ratio，輸出 topics/fossil-fuels/rp-ratio/）。

R/P 比 ＝ 探明蘊藏量 ÷ 一年的產量，單位是「年」。來源都是這個主題已經在用的：
- **原油、天然氣**：蘊藏量是 CIA World Factbook 的 2021 年估計（sources/factbook.py，鏡像 factbook/factbook.json 固定在
  停刊前最後一次的 commit，跟「蘊藏量」指標同一份；手冊寫的 61dadec0 是較舊的版本，美國的蘊藏量還是 2020 年估計的 471 億桶），
  產量是 EIA International Energy Statistics 2024 年（原油含凝結油 57-1，乾天然氣 26-1）。兩邊年份不同，只有一個年份 2024。
  原油至少 10 千桶/日、天然氣至少 0.5 十億立方公尺才算。
- **煤**：蘊藏量與產量都是 EIA（7-6 百萬短噸、7-1 千公噸），同一年相除，2008–2023 年。至少 1 百萬公噸才算。
  （Factbook 的煤蘊藏量就是抄 EIA 的，例如美國 2,478.83 億公噸＝EIA 2,732.44 億短噸。）
- 台灣：三種都沒有商業開採（EIA 的原油產量 0.196 千桶/日是沿用的舊值），R/P 沒有意義，不畫、寫原因。
陷阱（手冊）：R/P 不是「幾年後用完」，蘊藏量會隨價格與技術重估；委內瑞拉的數字高是因為產量崩跌。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eia, factbook
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "fossil-fuels" / "rp-ratio"
YEAR = 2024
OIL, GAS, COAL_PROD, COAL_RES = "57-1-TBPD", "26-1-BCM", "7-1-MT", "7-6-MST"
SHORT_TON = 0.90718474
MIN_OIL_KBD = 10
MIN_GAS_BCM = 0.5
MIN_COAL_MT = 1
TAIWAN = {
    "oil": ("台灣沒有商業開採的原油：Factbook 的蘊藏量 238 萬桶，EIA 的產量 0.196 千桶/日是沿用的舊值，相除沒有意義",
            "Taiwan has no commercial crude oil production: Factbook lists 2.38 million barrels of reserves and EIA's 0.196 "
            "thousand b/d of output is a carried-over value, so the ratio is meaningless"),
    "gas": ("台灣沒有商業規模的天然氣開採：Factbook 的蘊藏量 62.3 億立方公尺，EIA 的產量 0.06 十億立方公尺是沿用的舊值",
            "Taiwan has no commercial-scale gas production: Factbook lists 6.23 billion cubic metres of reserves and EIA's "
            "0.06 billion cubic metres of output is a carried-over value"),
    "coal": ("台灣 2001 年起沒有產煤", "Taiwan has mined no coal since 2001"),
}
LICENSE = "Public domain (CIA World Factbook via factbook/factbook.json, CC0; EIA)"


def _iso(code: str) -> str | None:
    return to_iso3(code) if len(code) == 3 and "+" not in code else None


def _write(fuel: str, years: list[int], values: dict[str, list], **extra: object) -> None:
    zh, en = TAIWAN[fuel]
    write_json(OUT / f"{fuel}.json", indicator_file(
        f"rp-ratio/{fuel}", "年", years, values, noValue={"TWN": zh}, noValueEn={"TWN": en}, license=LICENSE, **extra))


def build() -> None:
    data = eia.annual([OIL, GAS, COAL_PROD, COAL_RES])
    fb = factbook.reserves()
    # 原油：十億桶 ÷（千桶/日 × 365）
    for fuel, key, minimum, per_year in (("oil", OIL, MIN_OIL_KBD, 365e3), ("gas", GAS, MIN_GAS_BCM, 1e9)):
        prod = {_iso(c): s.get(YEAR) for c, s in data[key].items() if _iso(c)}
        vals: dict[str, list] = {}
        for iso, (reserve, ry) in fb[fuel].items():
            p = prod.get(iso)
            if iso == "WLD" or iso == "TWN" or not p or p < minimum or reserve <= 0:
                continue
            vals[iso] = [round(reserve / (p * per_year), 2)]
        notes = {}
        notes_en = {}
        if fuel == "oil":
            ven = data[OIL].get("VEN", {})
            notes["VEN"] = (f"委內瑞拉的原油產量從 2013 年的 {ven[2013]:,.0f} 千桶/日掉到 {YEAR} 年的 {ven[YEAR]:,.0f}，"
                            "R/P 高是因為產量崩跌，不是地質。")
            notes_en["VEN"] = (f"Venezuela's crude output fell from {ven[2013]:,.0f} thousand b/d in 2013 to {ven[YEAR]:,.0f} "
                               f"in {YEAR}; the high ratio reflects collapsing output, not geology.")
        _write(fuel, [YEAR], dict(sorted(vals.items())), notes=notes, notesEn=notes_en)
        top = sorted(vals.items(), key=lambda x: -x[1][0])
        print(f"  R/P {fuel}（{len(vals)} 國）：" + "、".join(f"{c} {v[0]:,.0f}" for c, v in top[:8]))
        print("    " + "、".join(f"{c} {vals[c][0]:,.1f}" for c in ("IRN", "SAU", "IRQ", "KWT", "ARE", "QAT", "RUS", "CAN",
                                                                     "NOR", "USA", "CHN", "BRA", "TKM") if c in vals))
    # 煤：百萬短噸 × 0.907 ÷（千公噸 ÷ 1000）
    res = {_iso(c): s for c, s in data[COAL_RES].items() if _iso(c)}
    prod = {_iso(c): s for c, s in data[COAL_PROD].items() if _iso(c)}
    years = sorted({y for s in res.values() for y in s})
    vals = {}
    for iso in sorted(res):
        if iso == "TWN":
            continue
        row = []
        for y in years:
            r = res[iso].get(y)
            p = prod.get(iso, {}).get(y)
            row.append(round(r * SHORT_TON / (p / 1000), 2) if r and p and p / 1000 >= MIN_COAL_MT else None)
        if any(v is not None for v in row):
            vals[iso] = row
    _write("coal", years, vals, latestWithin=1)
    last = sorted(((c, s[-1]) for c, s in vals.items() if s[-1] is not None), key=lambda x: -x[1])
    print(f"  R/P coal {years[0]}–{years[-1]}（{len(last)} 國）：" + "、".join(f"{c} {v:,.0f}" for c, v in last[:8]))
    print("    " + "、".join(f"{c} {v:,.0f}" for c, v in last if c in ("CHN", "IND", "USA", "RUS", "AUS", "IDN", "ZAF",
                                                                         "DEU", "POL", "KAZ", "TUR", "VNM", "COL")))
