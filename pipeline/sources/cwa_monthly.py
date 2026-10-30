"""中央氣象署「過去氣象觀測」的逐月多要素資料（C-B0026-002）：署屬測站每個月的雨量、降雨日數、日照時數等。

- 開放資料平臺的 S3 公開檔，不必登入：https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Climate/C-B0026-002.zip
  （2025-01-09 版，約 550 KB，mn_Report_201601.xml 到 202412.xml，34 站）。
- 降雨日數是 Precipitation 的 GE01Days（日雨量 ≥ 0.1 mm 的日數，跟 CRU TS 的 wet 同一個門檻），
  日照時數是 SunshineDuration 的 Total（小時）。缺測的月份沒有那個元素（或是負的特殊值），一年缺任何一個月就不算那一年。
- 授權：政府資料開放授權條款（氣象署網站適用政府網站資料開放宣告，DESIGN.md 第 8 節第 12 點）。
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
import zipfile

from common import download

URL = "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/Climate/C-B0026-002.zip"
SOURCE = "cwa"
NS = "{urn:cwa:gov:tw:cwacommon:0.1}"


def monthly() -> dict[str, dict]:
    """{測站名稱: {"en": 英文名, "wet": {(年, 月): 日數}, "sun": {(年, 月): 小時}}}"""
    path = download(URL, SOURCE, "C-B0026-002.zip")
    out: dict[str, dict] = {}
    with zipfile.ZipFile(path) as z:
        for name in sorted(z.namelist()):
            m = re.fullmatch(r"mn_Report_(\d{4})(\d{2})\.xml", name)
            if not m:
                continue
            root = ET.fromstring(z.read(name))
            for loc in root.iter(f"{NS}location"):
                station = loc.find(f"{NS}station")
                stats = loc.find(f"{NS}stationObsStatistics")
                if station is None or stats is None:
                    continue
                zh = station.findtext(f"{NS}StationName", "").strip()
                ym = stats.findtext(f"{NS}YearMonth", "")
                year, month = int(ym[:4]), int(ym[5:7])
                if (year, month) != (int(m.group(1)), int(m.group(2))):
                    raise ValueError(f"{name} 裡有 {ym} 的資料")
                rec = out.setdefault(zh, {"en": station.findtext(f"{NS}StationNameEN", "").strip(), "wet": {}, "sun": {}})
                for key, path_ in (("wet", "Precipitation/monthly/GE01Days"), ("sun", "SunshineDuration/monthly/Total")):
                    text = stats.findtext("/".join(f"{NS}{p}" for p in path_.split("/")))
                    try:
                        value = float(text) if text is not None else None
                    except ValueError:
                        value = None
                    if value is not None and value >= 0:
                        rec[key][(year, month)] = value
    return out


def annual(stations: dict[str, dict], key: str) -> dict[str, dict[int, float]]:
    """{測站: {年: 全年合計}}，只算 12 個月都有值的年份"""
    out: dict[str, dict[int, float]] = {}
    for zh, rec in stations.items():
        years = sorted({y for y, _m in rec[key]})
        for y in years:
            months = [rec[key].get((y, mo)) for mo in range(1, 13)]
            if all(v is not None for v in months):
                out.setdefault(zh, {})[y] = round(sum(months), 1)
    return out
