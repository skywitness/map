"""一國有幾種氣候類型（2026-11-07，製作手冊第二十五批 477，候選 1142；擴充「氣候分區（柯本）」）。

純衍生指標：讀 koppen 步驟已經輸出的 public/data/topics/koppen/panel.json（每國每期的柯本類型與面積千分比，
Beck 等人 2023，CC BY 4.0），數每國每期有幾種類型（panel 只列面積至少 1‰ 的類型），要在 koppen 步驟之後跑。
輸出 diversity/{ssp245,ssp585}.json（1901–1930 到 1991–2020 兩個情境一樣，2041 年以後依情境）。
側欄另外在瀏覽器裡數「占 1% 以上的類型」（KoppenPanel）。
"""

from __future__ import annotations

import json

from common import OUT_DIR, indicator_file, write_json

OUT = OUT_DIR / "topics" / "koppen"
YEARS = [1901, 1931, 1961, 1991, 2041, 2071]
SCENARIOS = ["ssp245", "ssp585"]


def build() -> None:
    panel = json.loads((OUT / "panel.json").read_text(encoding="utf-8"))
    for scenario in SCENARIOS:
        values: dict[str, list[float | None]] = {}
        for iso3, periods in panel["countries"].items():
            row = []
            for y in YEARS:
                key = str(y) if y <= 1991 else f"{y}-{scenario}"
                types = periods.get(key)
                row.append(len(types) if types else None)
            if any(v is not None for v in row):
                values[iso3] = row
        write_json(OUT / "diversity" / f"{scenario}.json",
                   indicator_file("diversity", "種", YEARS, values, projectionFrom=2041, license="CC BY 4.0"))
    print(f"  {len(values)} 個國家或地區")
