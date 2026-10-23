"""國家科學及技術委員會（國科會）「全國科技動態調查」的開放資料（政府資料開放授權條款）：補上 UNESCO／世界銀行沒有的台灣。

- 下載網址是 data.gov.tw 資料集頁面上的連結（mas.nstc.gov.tw）。找不到檔案時伺服器回傳一段 JavaScript 警告
  （「找不到檔案，請聯絡系統管理員」），HTTP 狀態仍是 200。
- UTF-8（含 BOM），1999 年起每年一列「全國」，其他列是各執行部門（企業、政府、高等教育、私人非營利）。
- 數字有的帶千分位逗號，「..」是無資料。
- 跟 OECD MSTI 的 Chinese Taipei 一致（MSTI 的台灣資料就是國科會提供的）。
- mas.nstc.gov.tw 只接受 TLS 1.2 的舊式 CBC-SHA1 加密套件（ECDHE-RSA-AES256-SHA），OpenSSL 3 預設的安全等級會直接
  握手失敗，所以這裡自己下載：把安全等級降到 1（憑證與主機名稱照樣驗證），快取規則跟 common.download() 一樣。
"""
from __future__ import annotations

import csv
import ssl
import urllib.request
from pathlib import Path

import common

URL = "https://mas.nstc.gov.tw/OPENDATA/GetFile?format=csv&serialno={serial}&fileodr={order}"
GERD = (49, 2, "gerd.csv")  # data.gov.tw 7562 全國各研發執行部門研發經費統計資料
PERSONNEL_FTE = (54, 0, "personnel-fte.csv")  # data.gov.tw 7564 全國各研發執行部門研發人力統計資料_全時約當數


def _download(url: str, filename: str) -> Path:
    target = common.CACHE_DIR / "nstc" / filename
    if target.exists() and not common.REFRESH:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    print(f"  下載 {url}")
    context = ssl.create_default_context()
    context.set_ciphers("DEFAULT:@SECLEVEL=1")
    request = urllib.request.Request(url, headers={"User-Agent": common.USER_AGENT})
    tmp = target.with_suffix(target.suffix + ".part")
    with urllib.request.urlopen(request, context=context) as resp, open(tmp, "wb") as f:
        while chunk := resp.read(1 << 20):
            f.write(chunk)
    tmp.replace(target)
    return target


def _national(source: tuple[int, int, str], column: str) -> dict[int, float]:
    """「全國」那一列的某個欄位：{西元年: 值}。"""
    serial, order, filename = source
    path = _download(URL.format(serial=serial, order=order), filename)
    with open(path, encoding="utf-8-sig", newline="") as f:
        text = f.read()
    if text.lstrip().startswith("<"):
        path.unlink()  # 下次重新下載
        raise RuntimeError(f"國科會回傳的是網頁不是 CSV（serialno={serial}），下載網址可能變了")
    out: dict[int, float] = {}
    for row in csv.DictReader(text.splitlines()):
        if row["執行部門"].strip() != "全國":
            continue
        cell = row[column].replace(",", "").strip()
        if cell and cell != "..":
            out[int(row["年"])] = float(cell)
    if not out:
        raise RuntimeError(f"國科會 {filename} 沒有「全國」的資料，欄位可能變了")
    return out


def gerd() -> dict[int, float]:
    """全國研究發展經費（GERD），新臺幣百萬元。"""
    return _national(GERD, "研發經費(百萬元)")


def researchers_fte() -> dict[int, float]:
    """全國研究人員，全時約當數（FTE，人年）。不含技術人員與支援人員，跟 UNESCO 的 researchers 同一個定義。"""
    return _national(PERSONNEL_FTE, "全國研發人力-研究人員")
