"""Wittgenstein Centre／IIASA 的人口與人力資本推估（Zenodo，CC BY 4.0）。

用「SSP Population and Human-Capital Projections, 2025-Rebased, 2025–2100 (zen2025V01)」
（doi:10.5281/zenodo.21738149，2026-08-01，Samir KC）。Zenodo 的 license 欄是 cc-by-4.0、README 寫「License: CC-BY 4.0」；
讀檔前核對 license，不是 CC BY 4.0 就報錯。WIC 2023 的 V14（doi:10.5281/zenodo.14718294，2020 年起）license 欄是空的，不用。
README：SSP2（中推估）跟 2020 年起算的版本完全相同，只是從 2025 年開始。

檔案每列是 地區 × 年 × 性別 × 學歷（e1–e6）× 5 歲年齡組（agest，-5 是新生兒的帳，不是存量）的人口（千人）；
地區有國家（regNNN，NNN 是 M49 代碼）與洲、次區域、世界的合計，用 region_level 分。
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict

from common import download
from sources.countries import from_numeric

RECORD = "21738149"
DOI = "10.5281/zenodo.21738149"
API = f"https://zenodo.org/api/records/{RECORD}"
FILE = "PROJresult_AGE_{scenario}y2025_V01.csv"
EDUCATION = ["e1", "e2", "e3", "e4", "e5", "e6"]  # 沒上學、小學沒讀完、小學、國中、高中職、大專以上


def _check_license() -> None:
    path = download(API, "wic", f"record-{RECORD}.json")
    meta = json.loads(path.read_text(encoding="utf-8"))["metadata"]
    if (meta.get("license") or {}).get("id") != "cc-by-4.0":
        raise RuntimeError(f"Wittgenstein Centre 的 Zenodo 授權變了：{meta.get('license')}，要重新確認")


def attainment(scenario: str = "SSP2", min_age: int = 25) -> dict[str, dict[int, list[float]]]:
    """{iso3 或 'WLD': {年: [e1…e6 的人口（千人）]}}，只算 min_age 歲以上"""
    _check_license()
    name = FILE.format(scenario=scenario)
    path = download(f"https://zenodo.org/records/{RECORD}/files/{name}?download=1", "wic", name)
    out: dict[str, dict[int, list[float]]] = defaultdict(lambda: defaultdict(lambda: [0.0] * len(EDUCATION)))
    codes: dict[str, str | None] = {}
    with open(path, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            level = row["region_level"]
            if level not in ("country", "world") or row["edu"] not in EDUCATION:
                continue
            age = int(float(row["agest"]))
            if age < min_age:
                continue
            region = row["region"]
            if level == "world":
                key = "WLD"
            else:
                if region not in codes:
                    codes[region] = from_numeric(region.removeprefix("reg"))
                key = codes[region]
                if key is None:
                    continue
            out[key][int(float(row["Time"]))][EDUCATION.index(row["edu"])] += float(row["pop"] or 0)
    unknown = sorted(r for r, c in codes.items() if c is None)
    if unknown:
        print(f"  Wittgenstein Centre 對不到 ISO 代碼的地區：{unknown}")
    return out
