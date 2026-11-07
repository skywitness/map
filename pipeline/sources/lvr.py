"""內政部 不動產成交案件實際資訊（實價登錄）的季資料（2026-11-07，製作手冊第二十五批 471）。

https://plvr.land.moi.gov.tw/DownloadSeason?season=<民國年>S<季>&type=zip&fileName=lvr_landcsv.zip：一季一個 zip（8–16 MB），
22 縣市 × 買賣（_a）、預售屋（_b）、租賃（_c）各一個 CSV 加明細檔。政府資料開放授權條款第 1 版（data.gov.tw 18703、77051）。
plvr.land.moi.gov.tw 的 robots.txt 是 302（沒有限制）。

這裡只讀成屋買賣（<縣市代碼>_lvr_land_a.csv）：每一季的 zip 下載後抽出要用的欄位存成 .cache/moi-lvr/sales/<季>.json.gz，
zip 用完就刪（租賃主題 real_estate_rents.py 的那一季除外），重跑時只讀抽出來的小檔。
"""

from __future__ import annotations

import csv
import gzip
import io
import json
import time
import zipfile

from common import CACHE_DIR, download

URL = "https://plvr.land.moi.gov.tw//DownloadSeason?season={}&type=zip&fileName=lvr_landcsv.zip"
KEEP_ZIPS = {"115S3"}  # real_estate_rents.py 用的那一季

# 縣市代碼（檔名的第一個字母）
COUNTIES = {
    "a": "臺北市", "b": "臺中市", "c": "基隆市", "d": "臺南市", "e": "高雄市", "f": "新北市", "g": "宜蘭縣",
    "h": "桃園市", "i": "嘉義市", "j": "新竹縣", "k": "苗栗縣", "m": "南投縣", "n": "彰化縣", "o": "新竹市",
    "p": "雲林縣", "q": "嘉義縣", "t": "屏東縣", "u": "花蓮縣", "v": "臺東縣", "w": "金門縣", "x": "澎湖縣",
    "z": "連江縣",
}
# 算「住宅」的建物型態（店面、辦公商業大樓、工廠、廠辦、倉庫、農舍、其他不算）
DWELLINGS = ("住宅大樓", "華廈", "公寓", "透天厝", "套房")
BUILDING_DEALS = ("房地(土地+建物)", "房地(土地+建物)+車位", "建物")


def seasons(first: str, last: str) -> list[str]:
    """'110S1'、'115S3' → ['110S1', '110S2', …, '115S3']"""
    y, q = int(first[:-2]), int(first[-1])
    out = []
    while True:
        s = f"{y}S{q}"
        out.append(s)
        if s == last:
            return out
        y, q = (y + 1, 1) if q == 4 else (y, q + 1)


def _float(text: str) -> float:
    try:
        return float(text or 0)
    except ValueError:
        return 0.0


def _extract(season: str) -> list[list]:
    """一季的住宅買賣：[編號, 縣市代碼, 西元年月 YYYYMM, 每平方公尺單價（扣車位，沒有就 0）, 特殊交易 0/1]"""
    path = download(URL.format(season), "moi-lvr", f"{season}.zip")
    rows_out: list[list] = []
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())
        for code in COUNTIES:
            name = f"{code}_lvr_land_a.csv"
            if name not in names:
                continue
            rows = list(csv.reader(io.StringIO(z.read(name).decode("utf-8-sig"))))
            col = {k: i for i, k in enumerate(rows[0])}
            for r in rows[2:]:
                if len(r) < len(col) or r[col["交易標的"]] not in BUILDING_DEALS:
                    continue
                if not r[col["建物型態"]].startswith(DWELLINGS):
                    continue
                date = r[col["交易年月日"]].strip()
                if not date.isdigit() or len(date) < 6:
                    continue
                roc_year, month = int(date[:-4]), int(date[-4:-2])
                if not 1 <= month <= 12:
                    continue
                area = _float(r[col["建物移轉總面積平方公尺"]]) - _float(r[col["車位移轉總面積平方公尺"]])
                price = _float(r[col["總價元"]]) - _float(r[col["車位總價元"]])
                unit = round(price / area) if area >= 10 and price > 0 else 0
                special = 1 if r[col["備註"]].strip() else 0
                rows_out.append([r[col["編號"]], code, (roc_year + 1911) * 100 + month, unit, special])
    if season not in KEEP_ZIPS:
        path.unlink()
    return rows_out


def sales(first: str, last: str) -> list[list]:
    """first 到 last 各季的住宅買賣，依編號去重（同一筆在好幾季出現時留第一次），每列最後加上季別（'114S2'）。

    交易年月日不一定是登記的時候：每一季都有好幾千筆是兩三年前的日期（預售屋完工後過戶的那一筆寫的是當初簽約的日子，
    也有逾期申報的），算「一年賣掉幾間」要依季別（公開的那一季，大致是申報登記的時候），不要依交易年月日"""
    out: list[list] = []
    seen: set[str] = set()
    for season in seasons(first, last):
        cache = CACHE_DIR / "moi-lvr" / "sales" / f"{season}.json.gz"
        if cache.exists():
            with gzip.open(cache, "rt", encoding="utf-8") as f:
                rows = json.load(f)
        else:
            rows = _extract(season)
            cache.parent.mkdir(parents=True, exist_ok=True)
            with gzip.open(cache, "wt", encoding="utf-8") as f:
                json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
            time.sleep(3)  # 一季一個大檔，間隔幾秒
        for row in rows:
            if row[0] not in seen:
                seen.add(row[0])
                out.append([*row, season])
    return out
