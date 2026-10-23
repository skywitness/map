"""UN World Population Prospects 2024（CC BY 3.0 IGO，含台灣）：人口主題以外也會用到的人口動態指標。"""
from __future__ import annotations

import csv
import gzip

from common import download

URL = (
    "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/"
    "CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz"
)
AGE5_URL = (
    "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/"
    "CSV_FILES/WPP2024_PopulationByAge5GroupSex_Medium.csv.gz"
)
LAST_ESTIMATE = 2023  # WPP 2024：2023 年以前是估計值，之後是推估值

COUNTRY, WORLD = "4", "1"  # LocTypeID


def demographic(columns: list[str], last_year: int = LAST_ESTIMATE) -> dict[str, dict[str, dict[int, float]]]:
    """回傳 {欄位: {iso3 或 'WLD': {年: 值}}}，只取到 last_year。"""
    path = download(URL, "wpp", "WPP2024_Demographic_Indicators_Medium.csv.gz")
    out: dict[str, dict[str, dict[int, float]]] = {c: {} for c in columns}
    with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["LocTypeID"] == WORLD:
                area = "WLD"
            elif row["LocTypeID"] == COUNTRY and row["ISO3_code"]:
                area = row["ISO3_code"]
            else:
                continue
            year = int(row["Time"])
            if year > last_year:
                continue
            for c in columns:
                if row[c]:
                    out[c].setdefault(area, {})[year] = float(row[c])
    return out


def population_by_age(iso3: str, first_year: int, last_year: int = LAST_ESTIMATE) -> dict[int, dict[str, float]]:
    """某國年中人口按五歲年齡組：{年: {'30-34': 人數}}（檔案約 30 MB，第一次會下載）。"""
    path = download(AGE5_URL, "wpp", "WPP2024_PopulationByAge5GroupSex_Medium.csv.gz")
    out: dict[int, dict[str, float]] = {}
    with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["ISO3_code"] != iso3 or row["Variant"] != "Medium":
                continue
            year = int(row["Time"])
            if first_year <= year <= last_year:
                out.setdefault(year, {})[row["AgeGrp"]] = float(row["PopTotal"]) * 1000  # 千人
    if not out:
        raise RuntimeError(f"WPP 年齡別人口沒有 {iso3}")
    return out
