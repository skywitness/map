"""2050、2080 年會熱幾度：CMIP6 的升溫推估（2026-11-07，製作手冊第二十五批 478，候選 1143；擴充「氣溫與降雨」）。

世界銀行 Climate Change Knowledge Portal（CCKP）的 API（cckpapi.worldbank.org，不必金鑰，沒有 robots.txt；CC BY 4.0，
DESIGN.md 第 8 節第 12 點）：CMIP6 0.25° 降尺度、多模式中位數的年平均氣溫（tas）氣候值，246 個國家或地區的陸地面積平均。
- 基期 1995–2014（historical），四個情境（SSP1-2.6、SSP2-4.5、SSP3-7.0、SSP5-8.5）× 四個時期（2020–2039、2040–2059、
  2060–2079、2080–2099）；升溫 ＝ 推估 − 基期（手冊的陷阱：`tasanom` 變數名回空陣列，要用 `tas` 自己相減）。
- 時間軸的「年份」是每一期的中間年（2030、2050、2070、2090），前端寫成「2020–2039」。
- 使用者 2026-11-07 決定做（候選 56 的排除不是因為 CCKP 本身）。CCKP 的國家值是陸地格子的面積平均，跟主題原本的 CRU TS 口徑不同。
輸出 public/data/topics/temperature/warming-projection/{ssp126,ssp245,ssp370,ssp585}.json。
"""

from __future__ import annotations

import json
import time

from common import OUT_DIR, download, indicator_file, write_json

OUT = OUT_DIR / "topics" / "temperature" / "warming-projection"
URL = "https://cckpapi.worldbank.org/cckp/v1/cmip6-x0.25_climatology_tas_climatology_annual_{period}_median_{scenario}_ensemble_all_mean/all_countries?_format=json"
SCENARIOS = ["ssp126", "ssp245", "ssp370", "ssp585"]
PERIODS = ["2020-2039", "2040-2059", "2060-2079", "2080-2099"]
ISO_FIX = {"XKX": "XKX"}


def _get(period: str, scenario: str) -> dict[str, float]:
    path = download(URL.format(period=period, scenario=scenario), "cckp", f"tas-{period}-{scenario}.json")
    d = json.loads(path.read_text(encoding="utf-8"))
    if d.get("metadata", {}).get("status") != "success" or not d.get("data"):
        raise RuntimeError(f"CCKP {period} {scenario} 沒有資料：{d.get('metadata')}")
    time.sleep(1)
    return {k: next(iter(v.values())) for k, v in d["data"].items() if v}


def build() -> None:
    base = _get("1995-2014", "historical")
    years = [int(p[:4]) + 10 for p in PERIODS]
    extra = {"license": "CC BY 4.0", "attribution": "World Bank Climate Change Knowledge Portal, CMIP6 0.25° (multi-model median)"}
    for sc in SCENARIOS:
        per = [_get(p, sc) for p in PERIODS]
        data = {k: [round(per[i][k] - base[k], 2) if k in per[i] else None for i in range(len(PERIODS))]
                for k in sorted(base) if any(k in p for p in per)}
        write_json(OUT / f"{sc}.json", indicator_file(f"warming-projection/{sc}", "°C", years, data, **extra))
        last = sorted(((v[-1], k) for k, v in data.items() if v[-1] is not None), reverse=True)
        print(f"  {sc} 2080–2099：{len(last)} 國；最多 {last[:6]}；最少 {last[-5:]}；"
              f"{[(k, data[k][-1]) for k in ('TWN', 'JPN', 'USA', 'CHN', 'CAN', 'RUS') if k in data]}；台灣各期 {data.get('TWN')}")
    print(f"  基期 1995–2014：台灣 {base.get('TWN')}、日本 {base.get('JPN')}、俄羅斯 {base.get('RUS')}")
