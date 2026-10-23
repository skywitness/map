"""華盛頓大學聖路易分校大氣成分分析小組（WashU ACAG）的衛星推估 PM2.5（SatPM2.5 V6.GL.02）。

- 資料頁：https://sites.wustl.edu/acag/datasets/surface-pm2-5/ ，標示 CC BY 4.0（V6.GL.02.04）。
  方法：衛星氣膠光學厚度＋GEOS-Chem 化學傳輸模式，再用地面測站校正（Shen et al., 2024, ACS ES&T Air）。
- 這裡只用網頁上的「Processed Datasets」：各國 1998–2023 年的人口加權 PM2.5，以及人口暴露在
  5、10、15、25、35 μg/m³ 以上的比例（檔名標示 V6GL0203，人口用 GPWv4、國界用 GADM 3.6）。
- 檔案放在 Box 的共用連結（不必登入）。先讀共用頁面裡的檔案代碼（typedID），再用 Box 的共用檔下載網址抓 CSV。
- **各國檔沒有台灣、香港、澳門**（國家檔的「China」只有中國大陸：人口 13.99 億，
  分區檔各省加總 14.29 億，差的 3,050 萬剛好是這三區），三區改用同一資料集的「中國分區檔」。
"""
from __future__ import annotations

import csv
import re

from common import download
from sources.countries import from_name

COUNTRY_PAGE = "https://wustl.box.com/s/e673hbmsl75gechxnrjotenel6k4hdfc"  # Annual Global country-level mean PM2.5
CHINA_PAGE = "https://wustl.box.com/s/i06fhiyh664ig5ukm5hg498d8ez50egg"  # Annual China regional-level mean PM2.5
DOWNLOAD = "https://wustl.app.box.com/index.php?rm=box_download_shared_file&shared_name={shared}&file_id={file_id}"

POPULATION = "Total Population [million people]"
MEAN = "Population-Weighted PM2.5 [ug/m3]"
SHARE_ABOVE = "% pop >= {threshold} ug/m3 [%]"

# from_name() 對不上（或模糊比對會配錯：Saint-Martin、Saint-Barthélemy 會配成法國）的名稱；
# 裏海、西沙群島、英屬基地、北賽普勒斯不是國家（地圖上也沒有），不收
NAMES = {
    "Palestina": "PSE", "Republic of Congo": "COG", "Aland": "ALA", "Cocos Islands": "CCK",
    "Pitcairn Islands": "PCN", "Sint Maarten": "SXM", "Virgin Islands; U.S.": "VIR",
    "Bonaire; Sint Eustatius and Saba": "BES", "Saint-Martin": "MAF", "Saint-Barthélemy": "BLM",
}
SKIP = {"Caspian Sea", "Paracel Islands", "Akrotiri and Dhekelia", "Northern Cyprus"}
# 中國分區檔裡當成各自一區的地區
CHINA_REGIONS = {"Taiwan": "TWN", "Hong Kong": "HKG", "Macao": "MAC"}


def _csv(page_url: str, name: str) -> list[dict[str, str]]:
    page = download(page_url, "acag", f"{name}.html").read_text(encoding="utf-8", errors="replace")
    shared = page_url.rsplit("/", 1)[1]
    match = re.search(r'"typedID":"(f_\d+)"', page)
    if not match:
        raise RuntimeError(f"ACAG 的 Box 共用頁面找不到檔案代碼（{page_url}），頁面格式可能變了")
    path = download(DOWNLOAD.format(shared=shared, file_id=match.group(1)), "acag", f"{name}.csv")
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows or MEAN not in rows[0] or POPULATION not in rows[0]:
        raise RuntimeError(f"ACAG {name}.csv 的欄位變了：{list(rows[0]) if rows else '空檔'}")
    return rows


def country_rows() -> dict[str, dict[int, dict[str, str]]]:
    """{iso3: {年: CSV 的一列}}，含從中國分區檔補上的台灣、香港、澳門。"""
    out: dict[str, dict[int, dict[str, str]]] = {}
    unknown = set()
    regions: dict[str, set[str]] = {}  # iso3 -> ACAG 的地區名稱，檢查有沒有兩個地區配到同一國
    for row in _csv(COUNTRY_PAGE, "country-annual"):
        region = row["Region"]
        if region in SKIP:
            continue
        iso3 = NAMES.get(region) or from_name(region)
        if not iso3:
            unknown.add(region)
            continue
        regions.setdefault(iso3, set()).add(region)
        out.setdefault(iso3, {})[int(row["Year"])] = row
    if unknown:
        raise RuntimeError(f"ACAG 的國名對不上 ISO 代碼：{sorted(unknown)}，請加進 acag.NAMES 或 SKIP")
    if duplicated := {iso3: sorted(names) for iso3, names in regions.items() if len(names) > 1}:
        raise RuntimeError(f"ACAG 有好幾個地區配到同一個 ISO 代碼：{duplicated}，請加進 acag.NAMES")
    if any(iso3 in out for iso3 in CHINA_REGIONS.values()):
        raise RuntimeError("ACAG 的各國檔已經有台灣、香港或澳門，不必再從中國分區檔補，請檢查中國的範圍")
    for row in _csv(CHINA_PAGE, "china-annual"):
        if iso3 := CHINA_REGIONS.get(row["Region"]):
            out.setdefault(iso3, {})[int(row["Year"])] = row
    if not all(iso3 in out for iso3 in CHINA_REGIONS.values()):
        raise RuntimeError("ACAG 的中國分區檔找不到台灣、香港或澳門")
    return out


def share_above(threshold: int) -> tuple[dict[str, dict[int, float]], dict[int, float]]:
    """人口暴露在年平均 threshold μg/m³ 以上的比例（%）：(各國 {iso3: {年: %}}, 世界 {年: %})。
    世界值是各國依 ACAG 自己的人口（GPWv4）加權。"""
    column = SHARE_ABOVE.format(threshold=threshold)
    countries: dict[str, dict[int, float]] = {}
    totals: dict[int, list[float]] = {}  # 年 -> [暴露人口, 總人口]
    for iso3, years in country_rows().items():
        for year, row in years.items():
            value, population = row.get(column, ""), float(row[POPULATION])
            if value in ("", "nan", "NaN") or population <= 0:  # 沒有人住的地區（例如無人島）不收
                continue
            countries.setdefault(iso3, {})[year] = float(value)
            total = totals.setdefault(year, [0.0, 0.0])
            total[0] += float(value) * population
            total[1] += population
    world = {year: exposed / population for year, (exposed, population) in totals.items()}
    return countries, world


def mean_pm25(iso3: str) -> dict[int, float]:
    """某個國家（地區）的人口加權 PM2.5 年平均（μg/m³）：{年: 值}。只用在附註當參考（地圖用 WHO 的值）。"""
    return {year: float(row[MEAN]) for year, row in country_rows().get(iso3, {}).items() if row[MEAN] not in ("", "nan", "NaN")}
