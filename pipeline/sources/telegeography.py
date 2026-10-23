"""TeleGeography Submarine Cable Map（https://www.submarinecablemap.com/）：海底電纜的路線、登陸點與明細。

網站本身用的 API（v3，JSON，不需金鑰）：
- `cable/cable-geo.json`：所有電纜的路線（GeoJSON MultiLineString，同一條電纜可能有好幾個 feature，例如 `rising-8-0`、`rising-8-1`）。
- `landing-point/landing-point-geo.json`：所有登陸點（GeoJSON Point，只有 id、名稱、is_tbd）。
- `cable/all.json`：電纜清單（id、名稱）。
- `cable/<id>.json`：每條電纜的明細：長度（「45,000 km」字串）、登陸點（含國家的英文名稱）、擁有者（逗號分隔的字串）、
  供應商、RFS（ready for service，「2024 Q3」「2026」這類字串）與 `rfs_year`、`is_planned`、網址、附註。

明細要一條一條抓（2026-10 是 713 條），每次請求間隔 REQUEST_DELAY 秒，不對 TeleGeography 的伺服器猛打；
都有快取（`.cache/telegeography/cable/<id>.json`），要抓新版得加 `--refresh`（全部重抓約 6 分鐘）。

**授權**：TeleGeography 在 GitHub 的 `telegeography/www.submarinecablemap.com` 儲存庫（2022 年底刪除，Wayback Machine 有存檔）
README 的「How can I download the dataset?」一節連到的就是這些 API 檔（`web/public/api/v3/cable/cable-geo.json` 等），
同一份 README 的「License」寫「Our map is made available under the following Creative Commons License:
Attribution-NonCommercial-ShareAlike 3.0 Unported (CC BY-NC-SA 3.0)」，LICENSE 檔也是 CC BY-NC-SA 3.0 的條文
（2019 年起的存檔都一樣，例如 http://web.archive.org/web/20221110120103/https://github.com/telegeography/www.submarinecablemap.com ）。
TeleGeography 現在的說明頁（https://www2.telegeography.com/cite-telegeography-map ）寫公開的地圖是 CC BY-SA 4.0、
「underlying databases」只給付費訂戶；API 的資料就是儲存庫當年公開的那份資料集，所以照較嚴的 CC BY-NC-SA 3.0
使用與標示（本站非商業），衍生的資料檔也依同一授權分享。
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field

import common
from common import CACHE_DIR, download

API = "https://www.submarinecablemap.com/api/v3"
SOURCE = "telegeography"
REQUEST_DELAY = 0.4  # 秒；只有真的發出請求時才等


@dataclass
class LandingPoint:
    id: str
    name: str
    lon: float
    lat: float
    tbd: bool


@dataclass
class Cable:
    id: str
    name: str
    # 路線：所有 feature 的所有線段（經緯度，原樣，尚未展開跨 180° 經線）
    parts: list[list[tuple[float, float]]] = field(default_factory=list)
    length_km: float | None = None
    owners: list[str] = field(default_factory=list)
    suppliers: list[str] = field(default_factory=list)
    rfs: str | None = None
    rfs_year: int | None = None
    planned: bool = False
    url: str | None = None
    notes: str | None = None
    # 登陸點：(登陸點 id, 名稱, 國家英文名稱)
    landings: list[tuple[str, str, str]] = field(default_factory=list)


def _load(path) -> object:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _detail(cable_id: str) -> dict:
    target = CACHE_DIR / SOURCE / "cable" / f"{cable_id}.json"
    fresh = common.REFRESH or not target.exists()  # run.py 的 --refresh 在 import 之後才設定，要在呼叫時讀
    path = download(f"{API}/cable/{cable_id}.json", SOURCE, f"cable/{cable_id}.json")
    if fresh:
        time.sleep(REQUEST_DELAY)
    return _load(path)


def _length_km(text: str | None) -> float | None:
    """「45,000 km」「1,234.5 km」→ 數字；沒有長度（「n.a.」、空字串）回傳 None"""
    if not text:
        return None
    m = re.match(r"^\s*([\d,]+(?:\.\d+)?)\s*km\s*$", text)
    return float(m.group(1).replace(",", "")) if m else None


def _split(text: str | None) -> list[str]:
    return [s.strip() for s in (text or "").split(",") if s.strip()]


def landing_points() -> dict[str, LandingPoint]:
    data = _load(download(f"{API}/landing-point/landing-point-geo.json", SOURCE, "landing-point-geo.json"))
    out = {}
    for f in data["features"]:
        p = f["properties"]
        lon, lat = f["geometry"]["coordinates"][:2]
        out[p["id"]] = LandingPoint(p["id"], p["name"], float(lon), float(lat), bool(p.get("is_tbd")))
    return out


def cables() -> list[Cable]:
    """所有電纜（路線＋明細），依 id 排序。"""
    listing = _load(download(f"{API}/cable/all.json", SOURCE, "all.json"))
    geo = _load(download(f"{API}/cable/cable-geo.json", SOURCE, "cable-geo.json"))
    by_id: dict[str, Cable] = {c["id"]: Cable(c["id"], c["name"]) for c in listing}
    for f in geo["features"]:
        cid = f["properties"]["id"]
        if cid not in by_id:
            raise RuntimeError(f"cable-geo.json 有 {cid}，但 all.json 沒有")
        geom = f["geometry"]
        if geom["type"] == "LineString":
            parts = [geom["coordinates"]]
        elif geom["type"] == "MultiLineString":
            parts = geom["coordinates"]
        else:
            raise RuntimeError(f"{cid} 的路線是 {geom['type']}")
        by_id[cid].parts += [[(float(x), float(y)) for x, y, *_ in part] for part in parts]
    for i, c in enumerate(sorted(by_id.values(), key=lambda c: c.id)):
        d = _detail(c.id)
        if i and i % 100 == 0:
            print(f"  電纜明細 {i}/{len(by_id)}")
        c.name = d.get("name") or c.name
        c.length_km = _length_km(d.get("length"))
        c.owners = _split(d.get("owners"))
        c.suppliers = _split(d.get("suppliers"))
        c.rfs = d.get("rfs") or None
        c.rfs_year = int(d["rfs_year"]) if d.get("rfs_year") else None
        c.planned = bool(d.get("is_planned"))
        c.url = d.get("url") or None
        c.notes = d.get("notes") or None
        c.landings = [(lp["id"], lp["name"], lp.get("country") or "") for lp in d.get("landing_points") or []]
    return sorted(by_id.values(), key=lambda c: c.id)
