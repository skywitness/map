"""Wikimedia Commons 的照片（2026-11-06，城2：tooltip 的照片卡）：檔名 → 縮圖路徑、攝影者與授權。

- 縮圖路徑「2/23/檔名」：Commons 存檔的方式（檔名底線化後 MD5 的前一、前二碼），前端 src/lib/commons.ts 組成
  upload.wikimedia.org 的縮圖網址；照片本身不存在這個網站。
- 攝影者、授權：Commons 的 API（imageinfo 的 extmetadata：Artist 去掉 HTML、LicenseShortName），一次 50 個檔，
  回 429 時照 Retry-After 等；結果依檔名組快取。
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from common import CACHE_DIR, USER_AGENT

API = "https://commons.wikimedia.org/w/api.php"


def image_path(filename: str) -> str:
    """Commons 的檔名（「File:」之後，空格或底線都可以）→ 縮圖路徑「2/23/檔名」"""
    name = filename.replace(" ", "_")
    h = hashlib.md5(name.encode()).hexdigest()
    return f"{h[0]}/{h[:2]}/{name}"


def from_url(url: str) -> str:
    """Special:FilePath 或 upload.wikimedia.org 的網址 → 檔名"""
    if "FilePath/" in url:
        return urllib.parse.unquote(url.split("FilePath/", 1)[1].split("?", 1)[0])
    return urllib.parse.unquote(url.rsplit("/", 1)[1])


def credit(by: str | None) -> str | None:
    """攝影者的名字：「pjt56 --- If you use…」這種附註只留名字；未知的是 None；太長的截斷"""
    if not by:
        return None
    by = re.sub(r"\s+", " ", by).strip()
    by = re.split(r"\s+-{2,}\s+|\s+•\s+", by)[0].strip()
    if by.lower() in ("unknown author", "unknown", "anonymous", ""):
        return None
    return by[:60] + "…" if len(by) > 60 else by


def metadata(files: list[str], cache: Path | None = None) -> dict[str, tuple[str | None, str | None]]:
    """檔名 → (攝影者, 授權)；Commons 上已經沒有的檔不在結果裡"""
    cache = cache or CACHE_DIR / "commons"
    out: dict[str, tuple[str | None, str | None]] = {}
    files = sorted(set(files))
    for i in range(0, len(files), 50):
        part = files[i:i + 50]
        key = hashlib.md5("|".join(part).encode()).hexdigest()[:12]
        path = cache / f"commons-meta-{key}.json"
        if not path.exists():
            url = API + "?" + urllib.parse.urlencode({
                "action": "query", "format": "json", "formatversion": "2", "prop": "imageinfo", "iiprop": "extmetadata",
                "iiextmetadatafilter": "Artist|LicenseShortName", "titles": "|".join(f"File:{f}" for f in part),
            })
            for attempt in range(8):
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                    with urllib.request.urlopen(req, timeout=60) as r:
                        path.parent.mkdir(parents=True, exist_ok=True)
                        path.write_bytes(r.read())
                    break
                except urllib.error.HTTPError as err:
                    if err.code != 429 or attempt == 7:
                        raise
                    wait = int(err.headers.get("retry-after") or 30) + 2
                    print(f"    Commons 回 429，等 {wait} 秒", flush=True)
                    time.sleep(wait)
            time.sleep(2)
        data = json.loads(path.read_text(encoding="utf-8"))
        norm = {n["to"]: n["from"] for n in data["query"].get("normalized", [])}
        for page in data["query"]["pages"]:
            if page.get("missing"):
                continue
            meta = ((page.get("imageinfo") or [{}])[0].get("extmetadata") or {})
            artist = meta.get("Artist", {}).get("value")
            text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", artist))).strip() if artist else None
            lic = meta.get("LicenseShortName", {}).get("value")
            title = norm.get(page["title"], page["title"]).removeprefix("File:").replace("_", " ")
            out[title] = (text, html.unescape(lic).strip() if lic else None)
    return out
