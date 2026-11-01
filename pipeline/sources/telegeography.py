"""TeleGeography Submarine Cable Map 2022 年 11 月以 CC BY-NC-SA 3.0 公開的最後一版：海底電纜的路線、登陸點與明細。

**為什麼用 2022 年的版本**（製作手冊第十八批 286、第一百四十一節，使用者 2026-11-01 決定）：TeleGeography 當年在 GitHub 的
`telegeography/www.submarinecablemap.com` 儲存庫以 CC BY-NC-SA 3.0 公開資料（README 的「License」：「Our map is made available
under the following Creative Commons License: Attribution-NonCommercial-ShareAlike 3.0 Unported (CC BY-NC-SA 3.0)」，LICENSE 檔是
同一份條文），儲存庫 2022 年底刪除。現在的 FAQ 寫「We no longer maintain or update a GitHub repository for our data or source
code. The raw, geocoded data underlying TeleGeography's interactive maps is available via an annual license」，網站 API 的**現在的**
資料沒有授權可以轉載（引用頁的 CC BY-SA 4.0 只涵蓋地圖截圖與網址）。原本從 submarinecablemap.com 的 API 抓現在的資料，
2026-11-01 起改用當年公開的最後一版；CC 授權不能撤回，這一版照 CC BY-NC-SA 3.0 使用、標示，衍生的資料檔也依同一授權分享。

**這一版**：TeleGeography 的 commit `91265d81`（2022-11-14 17:34 UTC，作者 systems@telegeography.com），`api/v3/config.json` 的
`creation_time` 是 2022-11-14T11:38:10-05:00。儲存庫刪除前最後找得到的 commit：本機 session 2026-11-01 從 GitHub 上的 fork
（jordi-farrpoint，最後一個 commit 後 4 分鐘建立，沒有自己的 commit）`git clone`、`git fsck` 檢查，再跟 Wayback Machine 的存檔
（2022-08-16 的 zip、2022-09-02 的 cable-geo.json、repo 首頁上的 commit 編號）逐位元對過。檔案放在 skywitness/map-plan 的
`data/telegeography-2022/`（README 寫存檔網址、時間戳、SHA-256），重跑前把 `api/`、`upstream/` 與 `SHA256SUMS` 複製到
`pipeline/.cache/telegeography-2022/`；這裡讀檔前先核對 SHA-256。

- `api/v3/cable/cable-geo.json`：所有電纜的路線（GeoJSON MultiLineString，527 條電纜、533 個 feature）。
- `api/v3/landing-point/landing-point-geo.json`：所有登陸點（GeoJSON Point，1,436 個，只有 id、名稱、is_tbd）。
- `api/v3/cable/all.json`：電纜清單（id、名稱）。
- `api/v3/cable/<id>.json`：每條電纜的明細：長度（「45,000 km」字串）、登陸點（含國家的英文名稱）、擁有者（逗號分隔的字串）、
  供應商、RFS（ready for service，「2024 Q3」「2026」這類字串）與 `rfs_year`、`is_planned`、網址、附註。
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field

from common import CACHE_DIR

DATA = CACHE_DIR / "telegeography-2022"
# 這一版的日期（config.json 的 creation_time）：地圖、統計與說明都寫「到這一天的狀態」
SNAPSHOT = "2022-11-14"
SNAPSHOT_YEAR = 2022
COMMIT = "91265d812a3e5f3734d48f6069ad600f3b0bdd66"
LICENSE = "CC BY-NC-SA 3.0"
LICENSE_URL = "https://creativecommons.org/licenses/by-nc-sa/3.0/"
# 原儲存庫已刪除，網址用 Wayback Machine 最後一次存到的首頁
SOURCE_URL = "https://web.archive.org/web/20221110120103/https://github.com/telegeography/www.submarinecablemap.com"
ATTRIBUTION = (f"TeleGeography, Submarine Cable Map data (github.com/telegeography/www.submarinecablemap.com, commit {COMMIT[:8]}, "
               f"{SNAPSHOT}), {LICENSE} ({LICENSE_URL}); adapted (cables stitched, counted by country) by world-map-viz")
# map-plan data/telegeography-2022/README.md 的 SHA-256（明細的 527 個檔另外依 SHA256SUMS 核對）
EXPECTED = {
    "api/v3/cable/cable-geo.json": "94a7f490c5b941bbb4d011e38608e1f15851f4b47ddf28a2b860fbcbf76b036a",
    "api/v3/landing-point/landing-point-geo.json": "e04c10f560bb7c040d0c495975fde0b97ff0c49c62572cc8138065fd03c0304f",
    "api/v3/cable/all.json": "02cfbd9e838a88b8de692fecb25bced051351872e8c3c48ac2d04de95d0cea77",
    "api/v3/config.json": "ed750231b3dc53cbc2f1696766c7995216b8b0410d158c5d7c1e653f2fc6924e",
    "upstream/LICENSE": "c1544c7c86e567001b5b7fb6a1b987a15295993483664d4ae3a76f0ac3b1969a",
}


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


def _sha256(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify() -> None:
    """檔案都在、SHA-256 跟 map-plan 的 README 與 SHA256SUMS 一樣，LICENSE 是 CC BY-NC-SA 3.0"""
    if not (DATA / "SHA256SUMS").exists():
        raise RuntimeError(f"沒有 {DATA}：請把 map-plan 的 data/telegeography-2022/ 的 api/、upstream/、SHA256SUMS 複製到這裡")
    sums = {}
    for line in (DATA / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        digest, _, name = line.partition("  ")
        sums[name.strip()] = digest
    bad = [name for name, digest in {**sums, **EXPECTED}.items() if not (DATA / name).exists() or _sha256(DATA / name) != digest]
    if bad:
        raise RuntimeError(f"telegeography-2022 的檔跟 SHA256SUMS 不一樣：{bad[:5]}")
    head = (DATA / "upstream" / "LICENSE").read_text(encoding="utf-8")[:300]
    if "Attribution-NonCommercial-ShareAlike 3.0 Unported" not in head:
        raise RuntimeError("upstream/LICENSE 不是 CC BY-NC-SA 3.0 Unported")
    created = json.loads((DATA / "api" / "v3" / "config.json").read_text(encoding="utf-8"))["creation_time"]
    if not created.startswith(SNAPSHOT):
        raise RuntimeError(f"config.json 的 creation_time 是 {created}，不是 {SNAPSHOT}")


def _load(rel: str) -> object:
    with open(DATA / "api" / "v3" / rel, encoding="utf-8") as f:
        return json.load(f)


def _length_km(text: str | None) -> float | None:
    """「45,000 km」「1,234.5 km」→ 數字；沒有長度（「n.a.」、空字串）回傳 None"""
    if not text:
        return None
    m = re.match(r"^\s*([\d,]+(?:\.\d+)?)\s*km\s*$", text)
    return float(m.group(1).replace(",", "")) if m else None


def _split(text: str | None) -> list[str]:
    return [s.strip() for s in (text or "").split(",") if s.strip()]


def landing_points() -> dict[str, LandingPoint]:
    data = _load("landing-point/landing-point-geo.json")
    out = {}
    for f in data["features"]:
        p = f["properties"]
        lon, lat = f["geometry"]["coordinates"][:2]
        out[p["id"]] = LandingPoint(p["id"], p["name"], float(lon), float(lat), bool(p.get("is_tbd")))
    return out


def cables() -> list[Cable]:
    """所有電纜（路線＋明細），依 id 排序。"""
    verify()
    listing = _load("cable/all.json")
    geo = _load("cable/cable-geo.json")
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
    for c in sorted(by_id.values(), key=lambda c: c.id):
        d = _load(f"cable/{c.id}.json")
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
