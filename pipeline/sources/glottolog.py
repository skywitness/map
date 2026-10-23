"""Glottolog（CLDF 版）：全世界的語言、分布的國家、瀕危程度（CC BY 4.0）。

languages.csv 每個語言一列（Countries 是 ISO 3166 alpha-2，用分號分隔）；
values.csv 有每個語言的類別（category）、譜系分類（classification）與瀕危程度（aes，Agglomerated Endangerment Status）。
"""
from __future__ import annotations

import csv

from common import download

VERSION = "v5.3"
BASE = f"https://raw.githubusercontent.com/glottolog/glottolog-cldf/{VERSION}/cldf"

# 算「語言」的類別：一般口語、手語、皮欽語、混合語。
# 不算的：Bookkeeping（重複或錯誤的條目）、Unattested、Unclassifiable（資料太少）、人造語言、語體（Speech register）
SPOKEN = {"Spoken_L1_Language", "Sign_Language", "Pidgin", "Mixed_Language"}

# AES：not_endangered、threatened、shifting、moribund、nearly_extinct、extinct
ENDANGERED = {"threatened", "shifting", "moribund", "nearly_extinct"}

# Glottolog 把台灣的南島語（阿美、泰雅、布農、排灣、魯凱、撒奇萊雅）與台灣手語只標成 CN，
# 其他台灣南島語則是 CN;TW。座標在台灣（含澎湖、蘭嶼）的語言一律把 CN 改成 TW
TAIWAN_BOX = (119.3, 21.8, 122.1, 25.4)  # 西、南、東、北


def _in_taiwan(row: dict) -> bool:
    try:
        lon, lat = float(row["Longitude"]), float(row["Latitude"])
    except ValueError:  # 沒有座標
        return False
    west, south, east, north = TAIWAN_BOX
    return west <= lon <= east and south <= lat <= north


def languages() -> list[dict]:
    """層級是 language 的條目：{glottocode, name, iso, countries（alpha-2 的 set）, category, aes, classification}。"""
    with open(download(f"{BASE}/languages.csv", "glottolog", f"{VERSION}-languages.csv"), encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    values: dict[str, dict[str, str]] = {}
    with open(download(f"{BASE}/values.csv", "glottolog", f"{VERSION}-values.csv"), encoding="utf-8") as f:
        for v in csv.DictReader(f):
            # aes 的 Value 是 1–6 的數字，名稱在 Code_ID（aes-nearly_extinct）
            if v["Parameter_ID"] == "aes":
                values.setdefault(v["Language_ID"], {})["aes"] = v["Code_ID"].removeprefix("aes-")
            elif v["Parameter_ID"] in ("category", "classification"):
                values.setdefault(v["Language_ID"], {})[v["Parameter_ID"]] = v["Value"]

    out = []
    for row in rows:
        if row["Level"] != "language":
            continue
        countries = set(filter(None, row["Countries"].split(";")))
        if "CN" in countries and _in_taiwan(row):
            countries = (countries - {"CN"}) | {"TW"}
        v = values.get(row["ID"], {})
        out.append({
            "glottocode": row["ID"],
            "name": row["Name"],
            "iso": row["ISO639P3code"] or None,
            "countries": countries,
            "category": v.get("category"),
            "aes": v.get("aes"),
            "classification": v["classification"].split("/") if v.get("classification") else [],
        })
    return out
