"""排放達峰了嗎：二氧化碳排放最高的那一年（2026-11-07，製作手冊第二十五批 475，候選 1138；擴充「溫室氣體排放」）。

純衍生指標：讀 climate 步驟已經輸出的 public/data/topics/climate/co2.json（Global Carbon Project 經 Our World in Data，
CC BY 4.0，1850 年起的領域排放；用 common.read_indicator 解差分編碼），所以要在 climate 步驟之後跑。
- co2-peak.json：最高那一年分成 7 類（類別代碼見 PEAK_CLASSES），hint 寫確切的年份與高峰、最新一年的排放量；
- co2-from-peak.json：最新一年比高峰少了幾 %。
年排放直接取最大值，不做移動平均（說明寫 2020 年疫情與 2008 年金融危機、蘇聯解體與戰爭造成的下降不是減碳成果）。
"""

from __future__ import annotations

from common import OUT_DIR, indicator_file, read_indicator, write_json

OUT = OUT_DIR / "topics" / "climate"
# (類別代碼, 這一類的第一年)；最後一年（還在創新高）另外一類
PEAK_CLASSES = [(0, 0), (1, 1980), (2, 1990), (3, 2000), (4, 2010), (5, 2020)]
STILL_RISING = 6
SKIP = {"ATA", "WLD"}  # 南極（研究站的排放）
MIN_PEAK = 1e5  # 高峰不到 10 萬公噸的小島國不算（一兩艘船、一座發電機就會讓年份亂跳）


def _mt(v: float) -> str:
    return f"{v / 1e6:,.1f}"


def build() -> None:
    years, co2 = read_indicator(OUT / "co2.json")
    last = years[-1]
    peak_class: dict[str, list[float | None]] = {}
    from_peak: dict[str, list[float | None]] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    for iso3, series in co2.items():
        if iso3 in SKIP or last not in series:
            continue
        peak = max(series, key=lambda y: series[y])
        if series[peak] < MIN_PEAK:
            continue
        code = STILL_RISING if peak == last else max(c for c, first in PEAK_CLASSES if peak >= first)
        peak_class[iso3] = [code]
        change = (series[last] / series[peak] - 1) * 100
        from_peak[iso3] = [round(change, 1)]
        if peak == last:
            hints[iso3] = f"{last} 年 {_mt(series[last])} 百萬公噸，是歷年最高"
            hints_en[iso3] = f"{_mt(series[last])} million tonnes in {last}, the highest on record"
        else:
            hints[iso3] = f"{peak} 年最高（{_mt(series[peak])} 百萬公噸），{last} 年 {_mt(series[last])}（{change:+.1f}%）"
            hints_en[iso3] = (f"Peaked in {peak} ({_mt(series[peak])} million tonnes); {_mt(series[last])} in {last} "
                              f"({change:+.1f}%)")
    write_json(OUT / "co2-peak.json", indicator_file("co2-peak", "類別", [last], peak_class, hints=hints,
                                                       hintsEn=hints_en, license="CC BY 4.0"))
    write_json(OUT / "co2-from-peak.json", indicator_file("co2-from-peak", "%", [last], from_peak, hints=hints,
                                                            hintsEn=hints_en, license="CC BY 4.0"))
    counts = {c: sum(1 for v in peak_class.values() if v[0] == c) for c in range(STILL_RISING + 1)}
    print(f"  {len(peak_class)} 國；各類 {counts}")
