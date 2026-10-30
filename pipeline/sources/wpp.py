"""UN World Population Prospects 2024（CC BY 3.0 IGO，含台灣）：人口主題以外也會用到的人口動態指標。

2026-01-19 的期中更新（rev.1，https://population.un.org/wpp/assets/Files/WPP2024_Release-Note-rev1.pdf ）只修正多哥
（依 2022 年普查，1950–2023 年的估計與中推估），其他國家與合計不變。更新的檔（`WPP2024_CSV_files_update.zip`，約 0.9 MB）
只有多哥的列，rows() 讀原本的檔、把多哥換成更新檔的列（製作手冊第八批 153）。下一版 WPP 延到 2027-07-11。
"""
from __future__ import annotations

import csv
import gzip
import io
import zipfile
from collections.abc import Iterator

from common import download

URL = (
    "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/"
    "CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz"
)
AGE5_URL = (
    "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/"
    "CSV_FILES/WPP2024_PopulationByAge5GroupSex_Medium.csv.gz"
)
UPDATE_URL = "https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/WPP2024_CSV_files_update.zip"
# rows() 的種類 → (原本的網址, 快取檔名, 更新檔裡的檔名)
FILES = {
    "indicators": (URL, "WPP2024_Demographic_Indicators_Medium.csv.gz", "WPP2024_Demographic_Indicators_Medium_Update.csv"),
    "age5": (AGE5_URL, "WPP2024_PopulationByAge5GroupSex_Medium.csv.gz", "WPP2024_PopulationByAge5GroupSex_Medium_Update.csv"),
}
LAST_ESTIMATE = 2023  # WPP 2024：2023 年以前是估計值，之後是推估值

COUNTRY, WORLD = "4", "1"  # LocTypeID


def rows(kind: str) -> Iterator[dict[str, str]]:
    """WPP 檔的每一列（kind 見 FILES），期中更新改過的地方（多哥）換成更新檔的列，放在原本的位置"""
    url, cache, member = FILES[kind]
    with zipfile.ZipFile(download(UPDATE_URL, "wpp", "WPP2024_CSV_files_update.zip")) as z:
        updated = list(csv.DictReader(io.TextIOWrapper(z.open(member), encoding="utf-8-sig", newline="")))
    locations = {r["LocID"] for r in updated}
    if not updated or len(locations) > 3:
        raise RuntimeError(f"WPP 期中更新的 {member} 有 {len(locations)} 個地區，跟預期（只有多哥）不同")
    emitted = False
    with gzip.open(download(url, "wpp", cache), "rt", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["LocID"] in locations:
                if not emitted:
                    yield from updated
                    emitted = True
                continue
            yield row
    if not emitted:
        raise RuntimeError(f"{cache} 裡找不到期中更新的地區 {locations}")


def demographic(columns: list[str], last_year: int = LAST_ESTIMATE) -> dict[str, dict[str, dict[int, float]]]:
    """回傳 {欄位: {iso3 或 'WLD': {年: 值}}}，只取到 last_year。"""
    out: dict[str, dict[str, dict[int, float]]] = {c: {} for c in columns}
    for row in rows("indicators"):
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


def population_by_age_sex(first_year: int, last_year: int = LAST_ESTIMATE) -> dict[str, dict[int, dict[str, dict[int, float]]]]:
    """所有國家的年中人口按性別與五歲年齡組：{iso3: {年: {'male'/'female': {年齡組起點: 人數}}}}，100 歲以上的起點是 100。"""
    out: dict[str, dict[int, dict[str, dict[int, float]]]] = {}
    for row in rows("age5"):
        if row["LocTypeID"] != COUNTRY or not row["ISO3_code"] or row["Variant"] != "Medium":
            continue
        year = int(row["Time"])
        if first_year <= year <= last_year:
            by_sex = out.setdefault(row["ISO3_code"], {}).setdefault(year, {"male": {}, "female": {}})
            start = int(row["AgeGrpStart"])
            by_sex["male"][start] = float(row["PopMale"]) * 1000  # 千人
            by_sex["female"][start] = float(row["PopFemale"]) * 1000
    return out


def population_by_age(iso3: str, first_year: int, last_year: int = LAST_ESTIMATE) -> dict[int, dict[str, float]]:
    """某國年中人口按五歲年齡組：{年: {'30-34': 人數}}（檔案約 30 MB，第一次會下載）。"""
    out: dict[int, dict[str, float]] = {}
    for row in rows("age5"):
        if row["ISO3_code"] != iso3 or row["Variant"] != "Medium":
            continue
        year = int(row["Time"])
        if first_year <= year <= last_year:
            out.setdefault(year, {})[row["AgeGrp"]] = float(row["PopTotal"]) * 1000  # 千人
    if not out:
        raise RuntimeError(f"WPP 年齡別人口沒有 {iso3}")
    return out
