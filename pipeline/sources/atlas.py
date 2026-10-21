"""Harvard Growth Lab, Atlas of Economic Complexity（Harvard Dataverse，CC0）。

各國依 HS92 兩位碼的商品出口額（美元），1995 年起，含台灣。
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


def _file_id(doi: str, name: str) -> int:
    path = download(f"{DATAVERSE}/datasets/:persistentId/?persistentId={doi}", "atlas", "dataset.json")
    with open(path, encoding="utf-8") as f:
        files = json.load(f)["data"]["latestVersion"]["files"]
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
