"""The Economist 的 COVID-19 超額死亡模型（https://github.com/TheEconomist/covid-19-the-economist-global-excess-deaths-model）。

- 授權：版本庫的 LICENCE 是 MIT（「Copyright (c) 2021 The Economist Newspaper」），涵蓋版本庫裡的檔案（含 output-data 的估計值）；
  轉載要附上版權與許可聲明（頁尾與 manifest.json 照寫）。README 另外請使用者引用
  「The Economist and Solstad, S. (corresponding author), 2021. The pandemic's true death toll.」。
  使用者原本以為是 CC BY 4.0（Our World in Data 轉載時標 CC BY 4.0），但原始的版本庫寫的是 MIT，照 MIT 標示。
- 檔案：`output-data/export_country_per_100k_cumulative.csv`（各國）與 `export_world_per_100k_cumulative.csv`（世界），
  2020-01-01 起每週一筆的累計超額死亡（每 10 萬人）：中間估計與 95% 區間。模型 2024-06-18 最後一次更新（到 2024-06-17），
  網址固定在那個 commit。
- 有通報全死因死亡數的國家（含台灣）模型會盡量貼近實際的超額死亡；沒有的國家（多數非洲國家、印度、中國…）
  完全是模型依其他指標推估，區間很寬。
"""
from __future__ import annotations

import csv
from dataclasses import dataclass

from common import download
from sources.countries import to_iso3

COMMIT = "94cac43992719a6122b57e9f03dd2882898d9d57"
BASE = f"https://raw.githubusercontent.com/TheEconomist/covid-19-the-economist-global-excess-deaths-model/{COMMIT}/output-data/"
EST = "cumulative_estimated_daily_excess_deaths_per_100k"
TOP = "cumulative_estimated_daily_excess_deaths_ci_95_top_per_100k"
BOT = "cumulative_estimated_daily_excess_deaths_ci_95_bot_per_100k"


@dataclass(frozen=True)
class Estimate:
    value: float  # 中間估計，累計每 10 萬人
    low: float  # 95% 區間的下限
    high: float  # 95% 區間的上限


def _read(filename: str, key: str) -> dict[str, dict[str, Estimate]]:
    path = download(BASE + filename, "economist", filename)
    out: dict[str, dict[str, Estimate]] = {}
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not {key, "date", EST, TOP, BOT} <= set(reader.fieldnames or []):
            raise RuntimeError(f"The Economist 的 {filename} 欄位變了：{reader.fieldnames}")
        for row in reader:
            code = "WLD" if key == "world" else to_iso3(row[key])
            if code:
                out.setdefault(code, {})[row["date"]] = Estimate(float(row[EST]), float(row[BOT]), float(row[TOP]))
    return out


def excess() -> dict[str, dict[str, Estimate]]:
    """{iso3 或 'WLD': {日期: Estimate}}"""
    out = _read("export_country_per_100k_cumulative.csv", "iso3c")
    out.update(_read("export_world_per_100k_cumulative.csv", "world"))
    if "TWN" not in out or "WLD" not in out:
        raise RuntimeError("The Economist 的估計沒有台灣或世界")
    return out
