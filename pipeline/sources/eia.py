"""U.S. Energy Information Administration（EIA）的 International Energy Statistics：各國的能源產量、消費量與進出口。

- 資料：EIA 開放資料的整批下載 https://www.eia.gov/opendata/bulk/INTL.zip （不必 API key、不必登入，約 24 MB，
  解開是一個 128.9 MB 的 INTL.txt，一行一個 JSON：系列或分類）。大約每月更新，重跑時年份會往後多一年。
- 系列代碼 `INTL.{產品}-{活動}-{地區}-{單位}.{頻率}`，例如 `INTL.57-1-TWN-TBPD.A`（台灣的原油產量，千桶/日，年資料）。
  `data` 是 `[["2024", 數值], …]`，數值有時是字串 "NA"、"--"，當成缺值。
- 授權：公有領域。https://www.eia.gov/about/copyrights_reuse.php ：「U.S. government publications are in the public
  domain and are not subject to copyright protection.」要求標示發布日期（「Source: U.S. Energy Information Administration
  (Oct 2008)」）；每個系列的 `copyright` 欄位也是 "None"。EIA 的標誌不能用。
- 地區代碼大多是 ISO alpha-3，另外有區域合計（WORL、OECD、OPEC、EU27、WP11…）與已經不存在的國家
  （SUN 蘇聯、DDR、DEUW、CSK、YUG、SCG、NLDA），由呼叫的主題決定怎麼處理；XKS 是科索沃（地圖用 XKX）。
"""
from __future__ import annotations

import json
import zipfile

from common import download

URL = "https://www.eia.gov/opendata/bulk/INTL.zip"
RELEASE_TEXT = "October 2026"  # INTL.zip 的 Last-Modified 2026-10-19
RELEASE_ZH = "2026 年 10 月"

# EIA 的地區代碼不是 ISO 的
CODE_FIX = {"XKS": "XKX"}


def annual(wanted: list[str]) -> dict[str, dict[str, dict[int, float]]]:
    """讀年資料。wanted 是「產品-活動-單位」，例如 '57-1-TBPD'；回傳 {wanted: {地區代碼: {年: 值}}}。

    地區代碼原樣回傳（含區域合計與已經不存在的國家），只把 XKS 換成 XKX。整個檔掃一次約 10 秒。
    """
    path = download(URL, "eia", "INTL.zip")
    keys: dict[tuple[str, str], str] = {}
    for w in wanted:
        product, activity, unit = w.split("-")
        keys[(f"INTL.{product}-{activity}-", f"-{unit}.A")] = w
    out: dict[str, dict[str, dict[int, float]]] = {w: {} for w in wanted}
    with zipfile.ZipFile(path) as z, z.open("INTL.txt") as f:
        for line in f:
            # 分類的行沒有 series_id；先用字串比對篩掉大部分不要的系列，不必每行都解析 JSON
            if not line.startswith(b'{"series_id":"INTL.'):
                continue
            head = line[14:80].decode("utf-8", "replace")
            sid = head.split('"', 1)[0]
            match = None
            for (prefix, suffix), w in keys.items():
                if sid.startswith(prefix) and sid.endswith(suffix):
                    match = w
                    break
            if match is None:
                continue
            d = json.loads(line)
            region = sid[len("INTL."):].split("-")[2]
            region = CODE_FIX.get(region, region)
            values: dict[int, float] = {}
            for year, v in d.get("data", []):
                if isinstance(v, (int, float)):
                    values[int(year)] = float(v)
            if values:
                out[match][region] = values
    return out
