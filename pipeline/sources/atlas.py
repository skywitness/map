"""Harvard Growth Lab, Atlas of Economic Complexity（Harvard Dataverse，CC0）。

- 各國依 HS92 兩位碼的商品出口額（美元），1995 年起，含台灣（exports_by_chapter()，工業主題）。
- SITC Rev. 2（doi:10.7910/DVN/H8SFD2，2026-11-02 是第 18 版，CC0 1.0）：1962–2024 年的雙邊貿易總額（sitc_bilateral()）與
  各國依一位碼十大類的出口（sitc_sections()），製作手冊第十七批 270。UN Comtrade 的原始申報經 Growth Lab 的 Bustos-Yildirim
  方法用雙邊申報互相調和；台灣沒有向聯合國申報，台灣的值是貿易夥伴的申報。1991 年以前的蘇聯算在俄羅斯；捷克斯洛伐克、
  南斯拉夫、東德沒有資料（拆分後的國家從獨立那一年起才有）。
檔案 id 會隨版本更新改變，所以透過資料集 DOI 找檔名。
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict

from common import download
from sources.countries import to_iso3

DATAVERSE = "https://dataverse.harvard.edu/api"
HS92_DOI = "doi:10.7910/DVN/T4CHWJ"
FILE = "hs92_country_product_year_2"
SITC_DOI = "doi:10.7910/DVN/H8SFD2"
SITC_BILATERAL = "sitc_country_country_year"
SITC_SECTIONS = "sitc_country_product_year_1"
# 資料集的快取檔名（HS92 沿用原本的 dataset.json）
_DATASET_CACHE = {HS92_DOI: "dataset.json", SITC_DOI: "dataset-sitc.json"}


def _file_id(doi: str, name: str) -> int:
    path = download(f"{DATAVERSE}/datasets/:persistentId/?persistentId={doi}", "atlas", _DATASET_CACHE[doi])
    with open(path, encoding="utf-8") as f:
        version = json.load(f)["data"]["latestVersion"]
    license_name = (version.get("license") or {}).get("name")
    if license_name != "CC0 1.0":
        raise RuntimeError(f"Dataverse 資料集 {doi} 的授權是 {license_name}，不是 CC0 1.0，先查清楚再用")
    files = version["files"]
    for entry in files:
        data_file = entry["dataFile"]
        if data_file["filename"].rsplit(".", 1)[0] == name:
            return data_file["id"]
    raise RuntimeError(f"Dataverse 資料集 {doi} 找不到 {name}")


def exports_by_chapter() -> dict[str, dict[int, dict[str, float]]]:
    """{iso3: {year: {HS 兩位碼: 出口額（美元）}}}，只含商品（01–97 章）。"""
    file_id = _file_id(HS92_DOI, FILE)
    path = download(f"{DATAVERSE}/access/datafile/{file_id}?format=original", "atlas", f"{FILE}.csv")
    out: dict[str, dict[int, dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            chapter = row["product_hs92_code"]
            if not (len(chapter) == 2 and chapter.isdigit()) or not row["export_value"]:
                continue
            iso3 = to_iso3(row["country_iso3_code"])
            if iso3:
                out[iso3][int(row["year"])][chapter] = float(row["export_value"])
    return out


def _sitc_csv(name: str):
    file_id = _file_id(SITC_DOI, name)
    return download(f"{DATAVERSE}/access/datafile/{file_id}?format=original", "atlas", f"{name}.csv")


def sitc_bilateral() -> dict[int, dict[str, dict[str, dict[str | None, float]]]]:
    """{年: {"export": {iso3: {夥伴 iso3 或 None: 美元}}, "import": {…}}}，1962–2024 年的商品貿易總額（SITC Rev. 2）。
    夥伴不是網站的國家（ANS「其他地區」、荷屬安地列斯）時是 None，只算進總額"""
    out: dict[int, dict[str, dict[str, dict[str | None, float]]]] = defaultdict(
        lambda: {"export": defaultdict(lambda: defaultdict(float)), "import": defaultdict(lambda: defaultdict(float))})
    with open(_sitc_csv(SITC_BILATERAL), encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            iso3 = to_iso3(row["country_iso3_code"])
            if not iso3:
                continue
            partner = to_iso3(row["partner_iso3_code"])
            year = int(row["year"])
            for direction in ("export", "import"):
                v = float(row[f"{direction}_value"] or 0)
                if v > 0:
                    out[year][direction][iso3][partner] += v
    return out


def sitc_sections() -> dict[str, dict[int, dict[str, float]]]:
    """{iso3: {年: {SITC 一位碼 "0"–"9": 出口額（美元）}}}，1962–2024 年"""
    out: dict[str, dict[int, dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
    with open(_sitc_csv(SITC_SECTIONS), encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            iso3 = to_iso3(row["country_iso3_code"])
            code = row["product_sitc_code"]
            if iso3 and len(code) == 1 and code.isdigit() and row["export_value"]:
                out[iso3][int(row["year"])][code] = float(row["export_value"])
    return out
