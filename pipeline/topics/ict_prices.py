"""上網要花多少錢：行動與固網的資費籃子（2026-11-07，製作手冊第二十五批 505，候選 1176；擴充「數位」）。

ITU 的 ICT 資費籃子（每月價格），datahub.itu.int 從 cloud 回 403，改用 World Bank Data360 轉載的 ITU_DH
（每個指標一個 CSV，跟 digital_extra.py 同一個來源；CC BY-NC-SA 3.0 IGO，衍生檔標同一個授權）：
- PRI_DO_MOB 只用數據的行動寬頻、PRI_FIX_BB_5G 固網寬頻 5 GB、PRI_LU_VD 低用量語音＋數據、PRI_HU_VD 高用量語音＋數據、
  PRI_LU_MOB 低用量行動電話（到 2024 年）
- 單位：USD（美元）與 PT_GNI_PS（占人均 GNI 的 %）；PPP 不用。台灣只有美元（ITU 原檔的 GNI 是 NA）。
Data360 的標籤沒寫只用數據的籃子是幾 GB（ITU 原始 xlsx 的台灣 2 GB 籃子是 9.24 美元，這裡是 16.2，不是同一個籃子），說明不寫 GB 數。
輸出 public/data/topics/digital/prices/{usd,gni}/{item}.json，latestWithin 1。
"""

from __future__ import annotations

import csv

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "digital" / "prices"
DATA360 = "https://data360files.worldbank.org/data360-data/data/ITU_DH/{code}.csv"
BASKETS = {"mobile-data": "PRI_DO_MOB", "fixed": "PRI_FIX_BB_5G", "voice-low": "PRI_LU_VD", "voice-high": "PRI_HU_VD",
           "mobile-low": "PRI_LU_MOB"}
UNITS = {"usd": ("USD", "USD"), "gni": ("PT_GNI_PS", "%")}
EXTRA = {"license": "CC BY-NC-SA 3.0 IGO",
         "attribution": "International Telecommunication Union (ITU), ICT Price Baskets (ITU DataHub), via World Bank Data360"}


def _load(code: str) -> dict[str, dict[str, dict[int, float]]]:
    path = download(DATA360.format(code=code), "data360", f"ITU_DH-{code}.csv")
    out: dict[str, dict[str, dict[int, float]]] = {}
    with open(path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["SEX"] != "_Z" or r["URBANISATION"] != "_Z" or not r["OBS_VALUE"]:
                continue
            iso3 = to_iso3(r["REF_AREA"])
            value = float(r["OBS_VALUE"])
            # 0 是「沒有商業服務」不是免費（手冊的陷阱），不畫
            if iso3 and value > 0:
                out.setdefault(r["UNIT_MEASURE"], {}).setdefault(iso3, {})[int(r["TIME_PERIOD"])] = value
    return out


def build() -> None:
    for item, code in BASKETS.items():
        data = _load(code)
        for folder, (unit_code, unit) in UNITS.items():
            series = data.get(unit_code, {})
            years = list(range(min(y for s in series.values() for y in s), max(y for s in series.values() for y in s) + 1))
            write_json(OUT / folder / f"{item}.json", indicator_file(
                f"price-{folder}", unit, years,
                {k: [round(s[y], 2) if y in s else None for y in years] for k, s in sorted(series.items())},
                latestWithin=1, **EXTRA))
            print(f"  {item} {folder}：{len(series)} 國（{years[0]}–{years[-1]}）")
