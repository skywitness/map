"""Pew Research Center, Religious Composition 2010–2020（Global Religious Futures）。

- 201 個國家與地區、2010 與 2020 年，七大類：基督徒、穆斯林、無宗教信仰、佛教徒、印度教徒、猶太教徒、其他宗教
  （民間信仰、道教、神道教、錫克教、巴哈伊…）。2026 年 2 月加了宗教多樣性指數（RDI，0–10）。
- **授權**：Pew 的使用條款（https://www.pewresearch.org/about/terms-and-conditions/ 第 13 條）允許修改與衍生，
  但轉載、發布「只限摘錄，不能全部或大部分發布」，並要附上「Pew Research Center bears no responsibility for
  the analyses or interpretations of the data presented here」。所以這裡只輸出摘錄與衍生值（最大宗教、它的比例、
  無宗教比例、多樣性指數），不輸出七大類各自的比例。
"""
from __future__ import annotations

import csv
import io
import zipfile

from common import download
from sources.countries import from_numeric

URL = "https://www.pewresearch.org/wp-content/uploads/sites/20/2025/06/Religious-Composition-2010-2020-dataset.zip"
FOLDER = "Religious Composition 2010-2020 dataset/"
GROUPS = ["Christians", "Muslims", "Religiously_unaffiliated", "Hindus", "Buddhists", "Jews", "Other_religions"]


def _csv(name: str) -> list[dict[str, str]]:
    path = download(URL, "pew", "religious-composition-2010-2020.zip")
    with zipfile.ZipFile(path) as z, z.open(FOLDER + name) as f:
        return list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig")))


def composition() -> dict[str, dict[int, dict[str, float]]]:
    """{iso3 或 'WLD': {年: {GROUPS 的類別: 百分比}}}，只收國家（Level 1）與全世界。"""
    out: dict[str, dict[int, dict[str, float]]] = {}
    for row in _csv("Religious Composition 2010-2020 (percentages).csv"):
        iso3 = "WLD" if row["Countrycode"] == "900" else from_numeric(row["Countrycode"]) if row["Level"] == "1" else None
        if iso3:
            out.setdefault(iso3, {})[int(row["Year"])] = {g: float(row[g]) for g in GROUPS}
    if len(out) < 190:
        raise RuntimeError(f"Pew 的宗教組成只讀到 {len(out)} 個國家，檔案格式可能變了")
    return out


def diversity() -> dict[str, dict[int, float]]:
    """宗教多樣性指數（RDI，0–10，10 是七大類各占七分之一）：{iso3 或 'WLD': {年: 值}}"""
    out: dict[str, dict[int, float]] = {}
    for row in _csv("Religious Composition 2010-2020 (diversity statistics).csv"):
        iso3 = "WLD" if row["Countrycode"] == "900" else from_numeric(row["Countrycode"]) if row["Level"] == "1" else None
        if iso3 and row["RDI_score"]:
            out.setdefault(iso3, {})[int(row["Year"])] = float(row["RDI_score"])
    return out
