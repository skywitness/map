"""世界銀行 Poverty and Inequality Platform（PIP）API（https://api.worldbank.org/pip/v1/，不必金鑰）。

WDI 轉載的 PIP 序列（SI.POV.GINI、SI.POV.DDAY、SI.SPR.PGAP）沒有台灣，PIP API 有（「Taiwan, China」，調查代碼
FIDES-LIS：主計總處家庭收支調查，經盧森堡所得研究 LIS 整理），也有 WDI 沒有的每人每日所得中位數。
授權：世界銀行自己產製的資料集預設 CC BY 4.0（https://datacatalog.worldbank.org/public-licenses ）；PIP 在資料目錄的
Percentiles 條目（0063646）寫「Creative Commons Attribution 4.0」，WDI 轉載的序列 metadata 也是 CC BY-4.0
（DESIGN.md 第 8 節第 12 點、第 279 點）。

`pip?country=all&year=all` 每一列是一次調查（reporting_year 是調查年），同一國同一年可能有：
- 全國以外的層級：阿根廷、早年的蘇利南只有都市（WDI 照用都市），中國、印度、印尼另有城鄉；
- 所得與消費兩種調查（88 個國家年份）。
`survey_series()` 每國每年取一列：全國優先，沒有全國才用都市；兩種調查都有時取吉尼係數跟 WDI 一樣的那一列
（跟網站的吉尼係數地圖同一次調查），對不上用所得。
"""
from __future__ import annotations

import json

from common import download
from sources.countries import to_iso3

API = "https://api.worldbank.org/pip/v1"
POVERTY_LINE = 3  # 每人每天 3 美元（2021 年購買力平價），國際貧窮線
LEVELS = ("national", "urban")


def rows() -> list[dict]:
    path = download(f"{API}/pip?country=all&year=all&povline={POVERTY_LINE}&format=json", "pip", f"pip-all-{POVERTY_LINE}.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def version() -> str:
    """資料版本（例如 20260922_2021_01_02_PROD），寫在附註與 DESIGN"""
    path = download(f"{API}/citation?format=json", "pip", "citation.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)["version_id"][0]


def survey_series(fields: list[str], wdi_gini: dict[str, dict[int, float]] | None = None) -> dict[str, dict[str, dict[int, float]]]:
    """{欄位: {iso3: {調查年: 值}}}。wdi_gini 是 WDI 的 SI.POV.GINI（用來在所得與消費之間挑同一次調查）"""
    by_key: dict[tuple[str, int], list[dict]] = {}
    for r in rows():
        if r["reporting_level"] in LEVELS and (iso3 := to_iso3(r["country_code"])):
            by_key.setdefault((iso3, int(r["reporting_year"])), []).append(r)
    out: dict[str, dict[str, dict[int, float]]] = {f: {} for f in fields}
    for (iso3, year), rs in by_key.items():
        level = next(lv for lv in LEVELS if any(r["reporting_level"] == lv for r in rs))
        rs = [r for r in rs if r["reporting_level"] == level]
        if len(rs) > 1:
            target = (wdi_gini or {}).get(iso3, {}).get(year)
            same = [r for r in rs if target is not None and r["gini"] is not None and round(r["gini"] * 100, 1) == round(target, 1)]
            rs = same or [r for r in rs if r["welfare_type"] == "income"] or rs
        row = rs[0]
        for f in fields:
            if row.get(f) is not None:
                out[f].setdefault(iso3, {})[year] = float(row[f])
    return out
