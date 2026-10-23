"""僑務委員會 歷年海外臺灣僑民人數（data.gov.tw 9732，政府資料開放授權條款）。

「海外臺灣僑民」是從臺灣（臺澎金馬）移出的僑民及其後代，含在海外出生的第二代以後，所以比 UN DESA 依出生地或國籍
統計的「台灣移民」多很多。人數是千人，只列各洲與美國、印尼、加拿大。
"""
from __future__ import annotations

import csv

from common import download

URL = "https://oas.ocac.gov.tw/OCAC_openDATA/API/CSV_EXPORT?TableID=A0009732"


def overseas_taiwanese() -> dict[int, dict[str, int]]:
    """{西元年: {僑居地（合計、亞洲、美國…）: 人數}}"""
    path = download(URL, "ocac", "overseas-taiwanese.csv")
    out: dict[int, dict[str, int]] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            try:
                out.setdefault(int(row["年別"]) + 1911, {})[row["僑居地別"].strip()] = round(float(row["人數-千人"]) * 1000)
            except (KeyError, ValueError):
                continue
    if not out:
        raise RuntimeError("僑委會的海外臺灣僑民人數讀不到資料，格式可能變了")
    return out
