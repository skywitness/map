"""衛生福利部統計處「衛生福利統計專區」的統計表（政府資料開放授權條款第 1 版；製作手冊第二十九批 688、689 共用）。

- 索引頁（`dep.mohw.gov.tw/DOS/cp-…`）每一列是一張表：「1.6 醫療院所家數、病床數及平均每萬人口病床數」＋ xlsx、ods 的連結。
  下載連結是 `www.mohw.gov.tw/dl-<編號>-<GUID>.html`，GUID 是隨機的、不能自己組，換版時也會換，所以每次從索引頁的 `<tr>`
  依表號找 xlsx 的連結（手冊 689 的提醒），索引頁與檔案都存在 .cache/mohw-tables/。
- 授權：衛生福利部〈政府網站資料開放宣告〉（https://www.mohw.gov.tw/cp-81-155-1.html）：全球資訊網上刊載的資料
  採政府資料開放授權條款第 1 版，使用時註明出處。
- 民國年 + 1911 = 西元年。
"""
from __future__ import annotations

import html
import re
from pathlib import Path

from common import CACHE_DIR, download

# 索引頁：5301 是「醫療機構、醫事人員、藥政、疾病」那一頁（表 1.6、1.7、2.2.2），5223 是「全民健康保險」那一頁（表 3.2.8、3.3.8）
INDEXES = {
    "5301": "https://dep.mohw.gov.tw/DOS/cp-5301-62356-113.html",
    "5223": "https://dep.mohw.gov.tw/DOS/cp-5223-62358-113.html",
}
SOURCE = "mohw-tables"


def _rows(index: str) -> list[tuple[str, list[str]]]:
    path = download(INDEXES[index], SOURCE, f"index-{index}.html")
    text = path.read_text(encoding="utf-8")
    out = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", text, re.S):
        title = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", row))).strip()
        links = re.findall(r'href="(https://www\.mohw\.gov\.tw/dl-[^"]+)"', row)
        out.append((title, links))
    return out


def table(index: str, number: str, must: str) -> tuple[Path, str, str]:
    """表號 number（例如 "1.6"）的 xlsx：回傳（快取的檔案、表名、下載網址）。must 是表名裡一定要有的字，防止表號換了內容。"""
    for title, links in _rows(index):
        m = re.match(rf"^{re.escape(number)}\s+(\S.*?)\s+(?:年|月|半年|季|衛生福利部|xlsx)", title)
        if not m or not links:
            continue
        name = m.group(1)
        if must not in name:
            raise RuntimeError(f"衛福部統計表 {number} 的表名變了：{name!r}（應該有 {must!r}）")
        url = links[0]  # 每一列第一個連結是 xlsx，第二個是 ods
        path = download(url, SOURCE, f"{number}.xlsx")
        return path, name, url
    raise RuntimeError(f"衛福部的索引頁（{INDEXES[index]}）找不到表 {number}")


def roc(year: int | str) -> int:
    """民國年 → 西元年"""
    return int(year) + 1911
