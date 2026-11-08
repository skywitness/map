"""re3data.org（研究資料典藏庫的登錄，索引資料 CC0；https://www.re3data.org/terms）。

- 沒有批次檔；OAI-PMH 的網址有問號，robots.txt 寫 `Disallow: /*?*`，不用。改用 API v1：清單
  `/api/v1/repositories`，再逐筆 `/api/v1/repository/<id>`（沒有問號，robots.txt 允許，2026-11-08 讀過）。
- 一次一支、每支間隔至少 2 秒；429 或 5xx 照 Retry-After 等（沒有就等 60 秒），最多 5 次。逐筆存在 `.cache/re3data/`，
  重跑只抓快取沒有的。
"""
from __future__ import annotations

import hashlib
import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

from common import CACHE_DIR, USER_AGENT, download

BASE = "https://www.re3data.org/api/v1"
NS = {"r3d": "http://www.re3data.org/schema/2-2"}
CACHE = CACHE_DIR / "re3data"
# 本機 session 2026-11-08 照 robots.txt 允許的逐筆 API 抓好、打包放在 map-plan 的 data/re3data/（README 有抓法與檢查）；
# 重跑前把 zip 複製到 pipeline/.cache/re3data/
ZIP = CACHE / "re3data-repositories.zip"
ZIP_SHA256 = "1ebb8e1e9f3e4adfe42c19da24e448c84e692473b09e73ce97dd9bec31a8dc82"


def ids() -> list[str]:
    path = download(f"{BASE}/repositories", "re3data", "repositories.xml")
    return re.findall(r"<id>(r3d\d+)</id>", path.read_text(encoding="utf-8"))


def _get(url: str) -> bytes:
    for attempt in range(5):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                wait = int(e.headers.get("Retry-After") or 60)
                print(f"    re3data：HTTP {e.code}，等 {wait} 秒")
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            print(f"    re3data：{e}，等 60 秒")
            time.sleep(60)
    raise RuntimeError(f"re3data：{url} 試了 5 次都失敗")


def fetch_all(delay: float = 2.0) -> int:
    """把每一筆存進快取；回傳新抓的筆數"""
    CACHE.mkdir(parents=True, exist_ok=True)
    todo = [i for i in ids() if not (CACHE / f"{i}.xml").exists()]
    print(f"  re3data：{len(todo)} 筆要抓")
    for n, rid in enumerate(todo, 1):
        (CACHE / f"{rid}.xml").write_bytes(_get(f"{BASE}/repository/{rid}"))
        if n % 200 == 0:
            print(f"    {n}/{len(todo)}")
        time.sleep(delay)
    return len(todo)


def _sources():
    """(id, XML bytes)：有本機 session 打包的 zip 就讀 zip（map-plan 的 data/re3data/，2026-11-08 抓的 3,541 筆），
    沒有就讀 fetch_all() 逐筆存的快取"""
    if ZIP.exists():
        if hashlib.sha256(ZIP.read_bytes()).hexdigest() != ZIP_SHA256:
            raise RuntimeError(f"{ZIP} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改 ZIP_SHA256")
        with zipfile.ZipFile(ZIP) as z:
            for name in sorted(z.namelist()):
                if re.fullmatch(r"r3d\d+\.xml", name):
                    yield name[:-4], z.read(name)
        return
    for path in sorted(CACHE.glob("r3d*.xml")):
        yield path.stem, path.read_bytes()


def records() -> list[dict]:
    """每一筆：id、name、type（可能多個）、countries（營運機構的國家，ISO3）、start（年）、subjects（DFG 學科，碼的位數是層級）"""
    out = []
    for rid, data in _sources():
        root = ET.fromstring(data)
        repo = root.find("r3d:repository", NS)
        if repo is None:
            continue
        get = lambda tag: [e.text.strip() for e in repo.findall(tag, NS) if e.text and e.text.strip()]  # noqa: E731
        start = (get("r3d:startDate") or [""])[0]
        out.append({
            "id": rid,
            "name": (get("r3d:repositoryName") or [rid])[0],
            "type": get("r3d:type"),
            "countries": sorted({c for c in get("r3d:institution/r3d:institutionCountry") if re.fullmatch(r"[A-Z]{3}", c)}),
            "start": int(start[:4]) if re.match(r"\d{4}", start) else None,
            "subjects": [e.text.strip() for e in repo.findall("r3d:subject", NS) if e.text and e.get("subjectScheme") == "DFG"],
        })
    return out
