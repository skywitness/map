"""國家通訊傳播委員會（NCC）的電信統計開放資料（政府資料開放授權條款）：補上 ITU / 世界銀行沒有的台灣。

www.ncc.gov.tw 有 Cloudflare 驗證，程式只能從 api.ncc.gov.tw 下載。民國年，每月一筆，取每年 12 月。
"""
from __future__ import annotations

import csv
import io
import urllib.parse
from collections import defaultdict

from common import download

# 少了 filedisplay（任何檔名都可以）會回傳「您的瀏覽器未送出Cookie」的網頁，HTTP 狀態仍是 200
URL = "https://api.ncc.gov.tw/uploaddowndoc?file=datagov/{name}&filedisplay=data.csv&flag=doc"
MOBILE = "行動通信業務用戶統計數.csv"  # data.gov.tw 22589，2012 年起
BROADBAND = "1557323870061465600.csv"  # data.gov.tw 7164，2019 年起
BROADBAND_OLD = "1407602807476850688.csv"  # data.gov.tw 27953，2007–2020 年 8 月，已停止更新
ROC_OFFSET = 1911


def _rows(name: str, filename: str) -> list[dict[str, str]]:
    path = download(URL.format(name=urllib.parse.quote(name)), "ncc", filename)
    with open(path, encoding="utf-8-sig", newline="") as f:
        text = f.read()
    if text.lstrip().startswith("<"):
        path.unlink()  # 下次重新下載
        raise RuntimeError(f"NCC 回傳的是網頁不是 CSV（{name}），下載網址的參數可能變了")
    return list(csv.DictReader(io.StringIO(text)))


def _int(text: str) -> int:
    return int(text.replace(",", "").strip())


def mobile_subscriptions() -> dict[int, int]:
    """每年 12 月的行動電話用戶數（2G + 3G + 行動寬頻，月租加預付卡，含純數據門號）。

    4G 用戶 2015 年 1 月才開始列入，2014 年（4G 開台後）少算約 400 萬，不收。
    """
    totals: dict[int, int] = defaultdict(int)
    for row in _rows(MOBILE, "mobile.csv"):
        period = row["統計期"].strip()  # 民國年 + 月，例如 11312
        if period[-2:] != "12" or row["業者名稱"].strip() != "總計":
            continue
        totals[int(period[:-2]) + ROC_OFFSET] += _int(row["用戶數"])
    totals.pop(2014, None)
    return dict(totals)


def fixed_broadband() -> dict[int, int]:
    """每年 12 月的固網（有線）寬頻帳號數：ADSL + 光纖 + 纜線數據機 + 專線，不含公眾無線區域網路（PWLAN）。"""
    out: dict[int, int] = {}
    for row in _rows(BROADBAND_OLD, "broadband-old.csv"):
        if row["月份"].strip() == "12":
            out[int(row["年度"]) + ROC_OFFSET] = sum(
                _int(row[c]) for c in ("有線寬頻帳號-ADSL", "有線寬頻帳號-FTTX", "有線寬頻帳號-Cable Modem", "有線寬頻帳號-固接專線")
            )
    for row in _rows(BROADBAND, "broadband.csv"):
        roc_year, month = row["年月"].split("/")
        if month.strip() == "12":
            out[int(roc_year) + ROC_OFFSET] = _int(row["小計_固網（有線）寬頻帳號數"])
    return out
