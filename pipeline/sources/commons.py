"""Wikimedia Commons：國旗主題的國旗圖檔（SVG）與每個檔案的授權。

- 檔案資訊用 MediaWiki API（commons.wikimedia.org/w/api.php 的 prop=imageinfo，iiprop=url|size|sha1|extmetadata），
  每 50 個檔一批。extmetadata 是 Commons 從檔案頁的授權模板整理出來的欄位：LicenseShortName（例如 Public domain、CC0）、
  License、Copyrighted、Restrictions（insignia：國徽、國旗這類標誌，使用可能受各國法律限制）、AttributionRequired、
  Artist、LicenseUrl。topics/flags.py 依這些欄位逐檔檢查授權，不在允許清單裡的會報錯。
- 圖檔從 upload.wikimedia.org 下載，存在 .cache/commons/flags/<sha1>.svg（檔案換了版本 sha1 就不同，會重新下載），
  下載後核對 sha1。每個檔間隔 0.2 秒。
- User-Agent 寫專案網址（common.USER_AGENT，符合 Wikimedia 的 User-Agent 規範），不帶個人資料；不用帳號、不用金鑰。
- API 的回應存在 .cache/commons/info-*.json，要更新加 --refresh。
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import time
import urllib.parse
from dataclasses import dataclass

import common
from common import CACHE_DIR

API = "https://commons.wikimedia.org/w/api.php"
BATCH = 50
META_FIELDS = (
    "LicenseShortName",
    "License",
    "LicenseUrl",
    "UsageTerms",
    "Copyrighted",
    "Restrictions",
    "AttributionRequired",
    "Artist",
    "Credit",
)


@dataclass
class FileInfo:
    name: str  # 檔名（不含 File:）
    url: str  # upload.wikimedia.org 的原始檔
    page: str  # 檔案說明頁
    sha1: str
    width: int
    height: int
    size: int
    meta: dict[str, str]  # extmetadata 的欄位（純文字，HTML 標籤已拿掉）


def _plain(value: str) -> str:
    """extmetadata 的值有 HTML（作者的連結、表格），只留文字"""
    text = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def file_info(names: list[str]) -> dict[str, FileInfo]:
    """{檔名: FileInfo}；Commons 上沒有的檔不在結果裡"""
    ids = sorted(set(names))
    out: dict[str, FileInfo] = {}
    for start in range(0, len(ids), BATCH):
        batch = ids[start:start + BATCH]
        params = {
            "action": "query",
            "titles": "|".join(f"File:{n}" for n in batch),
            "prop": "imageinfo",
            "iiprop": "url|size|sha1|extmetadata",
            "iiextmetadatafilter": "|".join(META_FIELDS),
            "format": "json",
            "formatversion": "2",
        }
        digest = hashlib.sha1("|".join(batch).encode()).hexdigest()[:12]
        path = common.download(f"{API}?{urllib.parse.urlencode(params)}", "commons", f"info-{digest}.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        # API 會把檔名正規化（底線換成空白、第一個字大寫），用 normalized 對回原本的寫法
        renamed = {n["to"]: n["from"] for n in data["query"].get("normalized", [])}
        for page in data["query"]["pages"]:
            if "imageinfo" not in page:
                continue
            title = renamed.get(page["title"], page["title"])
            name = title.removeprefix("File:")
            ii = page["imageinfo"][0]
            meta = {k: _plain(str(v.get("value", ""))) for k, v in ii.get("extmetadata", {}).items()}
            out[name] = FileInfo(
                name=name,
                url=ii["url"],
                page=ii["descriptionurl"],
                sha1=ii["sha1"],
                width=int(ii["width"]),
                height=int(ii["height"]),
                size=int(ii["size"]),
                meta=meta,
            )
    return out


def download(info: FileInfo) -> bytes:
    """下載原始檔（依 sha1 快取），核對 sha1"""
    target = CACHE_DIR / "commons" / "flags" / f"{info.sha1}.svg"
    fresh = not target.exists()
    path = common.download(info.url, "commons/flags", f"{info.sha1}.svg")
    data = path.read_bytes()
    if hashlib.sha1(data).hexdigest() != info.sha1:
        path.unlink()
        raise ValueError(f"{info.name} 的 sha1 對不上（{info.sha1}），已刪除快取，請重跑")
    if fresh:
        time.sleep(0.2)
    return data
