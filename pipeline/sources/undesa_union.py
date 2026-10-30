"""聯合國人口司「Estimates and Projections of Women of Reproductive Age Who Are Married or in a Union 2024」
（CC BY 3.0 IGO，xlsx 約 10 MB，不必登入）：15–49 歲女性有偶或同居的比例，模型估計與推估。

- 檔名寫 1970-2030，實際是 1970–2050 年（說明頁也寫 1970 to 2050），225 個國家或地區（含 China, Taiwan Province of China）。
- 每一列有 DataProcess：最後一次調查（普查、DHS、MICS、PMA、戶籍登記等）以前是 Estimate，之後是 Projection，
  每個國家的分界不同。
- Countries 分頁用 ISO 數字代碼，Regions 分頁的 World 是 900。
"""
from __future__ import annotations

import openpyxl

from common import download
from sources.countries import from_numeric

URL = (
    "https://www.un.org/development/desa/pd/sites/www.un.org.development.desa.pd/files/"
    "undesa_pd_ds_1970-2030_fp_rev-2024_rev.xlsx"
)
AGE = "15-49"


def married_or_in_union() -> tuple[dict[str, dict[int, float]], dict[int, float], dict[str, int]]:
    """回傳（{ISO3: {年: %}}, 世界 {年: %}, {ISO3: 第一個推估的年份}）；全部是推估的國家沒有第三項。"""
    path = download(URL, "undesa_fp", URL.rsplit("/", 1)[-1])
    wb = openpyxl.load_workbook(path, read_only=True)
    values: dict[str, dict[int, float]] = {}
    projected: dict[str, int] = {}
    for row in wb["Countries"].iter_rows(min_row=7, values_only=True):
        if not row or row[0] is None or row[4] != AGE:
            continue
        name, code, _, year, _, pct, _, process = row[:8]
        iso3 = from_numeric(code)
        if iso3 is None:
            raise ValueError(f"有偶或同居比例的國家代碼對不到 ISO3：{name} {code}")
        values.setdefault(iso3, {})[int(year)] = float(pct)
        if process == "Projection":
            projected[iso3] = min(projected.get(iso3, 9999), int(year))
        elif process != "Estimate":
            raise ValueError(f"沒看過的 DataProcess：{process}")
    world: dict[int, float] = {}
    for row in wb["Regions"].iter_rows(min_row=7, values_only=True):
        if row and row[0] == "World" and row[5] == AGE:
            world[int(row[4])] = float(row[6])
    return values, world, projected
