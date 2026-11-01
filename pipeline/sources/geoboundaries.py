"""geoBoundaries（gbOpen，William & Mary geoLab）：各國的行政區界，簡化版（製作手冊第十六批 265，2026-11-01）。

- **API**：https://www.geoboundaries.org/api/current/gbOpen/ALL/<ADM1|ADM2>/ 列出每一國那一級的中繼資料
  （`boundaryLicense`、`boundarySource`、`boundaryYearRepresented`、`boundaryCanonical`、`simplifiedGeometryGeoJSON`…）。
- **檔案**：API 給的是 github.com/wmgeolab/geoBoundaries/raw/<commit>/… 的網址，檔案放在 Git LFS；cloud 的 git proxy
  不轉 github.com 的 raw（2026-11-01），改用 media.githubusercontent.com/media/wmgeolab/geoBoundaries/<commit>/…
  （同一個 commit 的 LFS 內容，回 200）。
- **授權依各國**（`boundaryLicense`）：寫進輸出的資料檔與頁尾；CC BY-SA、ODbL 的國家，那一份照同樣授權分享。
  阿曼的第二級是「Other - Direct Permission」（只授權給 geoBoundaries），使用者 2026-11-01 決定不用（`EXCLUDED`）。
"""
from __future__ import annotations

import json
import re

from common import ROOT, download

API = "https://www.geoboundaries.org/api/current/gbOpen/ALL/{level}/"
PINNED = ROOT / "pipeline" / "data" / "geoboundaries"
# 沒有給我們用的授權：不下載、不用
EXCLUDED = {("OMN", "ADM2"): "Other - Direct Permission（只授權給 geoBoundaries，使用者 2026-11-01 決定不用）"}
_RAW = re.compile(r"^https://github\.com/wmgeolab/geoBoundaries/raw/([0-9a-f]+)/(.+)$")


def metadata(level: str) -> list[dict]:
    """那一級每一國的中繼資料。用 repo 裡固定的那一份（pipeline/data/geoboundaries/api-<級>.json，2026-11-01 從 API 存下來），
    檔案網址都指到同一個 commit（9469f09），本機 session 重跑（切圖）時跟 cloud 拿到一樣的檔、編號一樣。
    要更新時刪掉那兩個檔、重跑一次會從 API 重抓（網址換到新的 commit）"""
    pinned = PINNED / f"api-{level}.json"
    if not pinned.exists():
        pinned.parent.mkdir(parents=True, exist_ok=True)
        pinned.write_bytes(download(API.format(level=level), "geoboundaries", f"api-{level}.json").read_bytes())
    rows = json.loads(pinned.read_text(encoding="utf-8"))
    return [r for r in rows if (r["boundaryISO"], level) not in EXCLUDED]


def media_url(raw_url: str) -> str:
    """github.com 的 raw 網址 → media.githubusercontent.com（LFS 的內容）"""
    m = _RAW.match(raw_url)
    if not m:
        raise ValueError(f"看不懂的 geoBoundaries 網址：{raw_url}")
    commit, path = m.groups()
    return f"https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/{commit}/{path}"


def simplified(row: dict) -> dict:
    """一國一級的簡化版 GeoJSON（FeatureCollection）"""
    iso, level = row["boundaryISO"], row["boundaryType"]
    path = download(media_url(row["simplifiedGeometryGeoJSON"]), "geoboundaries", f"{iso}-{level}-simplified.geojson")
    text = path.read_text(encoding="utf-8")
    if text.startswith("version https://git-lfs"):
        raise RuntimeError(f"{iso} {level}：拿到的是 LFS 的指標檔，不是內容（{path}）")
    return json.loads(text)
