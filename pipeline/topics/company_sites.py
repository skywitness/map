"""大企業的據點（新主題，經濟 › 企業，2026-10-31，使用者在 map cloud 直接要求）：12 家大企業的總部、辦公室、研發中心、
工廠（含晶圓廠、封裝測試廠、火箭與衛星工廠）、資料中心、發射場。

使用者 2026-10-31 決定：
- 公司：Apple、NVIDIA、Microsoft、Amazon、TSMC、SpaceX、Meta、Broadcom、Samsung（三星電子）、Micron、AMD、Intel。
- 類型：總部、辦公室、研發中心；工廠、晶圓廠、發射場；資料中心。不收零售店與物流倉庫。
- 資料：各公司官方公開的資料手工整理（官網的據點頁、年報、永續報告書、官方新聞稿），每一列附出處；授權寫「引用事實並註明出處」
  （跟雲端機房的區域一樣）。
- 呈現：新主題，選公司看點，國家的值是據點數。

**資料**：`pipeline/data/company-sites/sites.csv`（手工整理的事實表，欄位說明見同一個資料夾的 README.md），加上
AWS 與 Azure 的雲端區域（沿用 sources/cloud_regions.py，Amazon 與 Microsoft 的「雲端區域」：業者不公開機房位置，點在區域的城市）。

**輸出**（public/data/topics/company-sites/）：
- points/<公司>.json、points/all.json：營運中的據點（點）。
- future/<公司>.json、future/all.json：興建中與已宣布的據點（空心的點，不算進據點數）。
- count/<公司>.json、count/all.json：各國營運中的據點數（雲端區域也算一個）。
- companies.json：12 家裡有幾家在這國有營運中的據點。
"""
from __future__ import annotations

import csv
import math
from collections import Counter, defaultdict

from common import OUT_DIR, ROOT, indicator_file, points_file, write_json, write_manifest_part
from sources import cloud_regions

OUT = OUT_DIR / "topics" / "company-sites"
CSV = ROOT / "pipeline" / "data" / "company-sites" / "sites.csv"
YEAR = 2026
# 前端 company-sites.ts 的 COMPANIES 依同樣的順序（使用者列的順序）
COMPANIES = ["apple", "nvidia", "microsoft", "amazon", "tsmc", "spacex", "meta", "broadcom", "samsung", "micron", "amd", "intel"]
# 類型代碼（前端 KINDS）：總部、辦公室、研發中心、工廠、資料中心、雲端區域、發射場與試驗場
KINDS = {"hq": 1, "office": 2, "rnd": 3, "factory": 4, "datacenter": 5, "cloud": 6, "launch": 7}
STATUS = {"open": 1, "building": 2, "planned": 3}
FIELDS = ["company", "kind", "status", "name", "name_zh", "city", "iso3", "lat", "lon", "precision", "year", "source", "note"]
CLOUD = {"aws": "amazon", "azure": "microsoft"}
CLOUD_SOURCE = "https://github.com/skywitness/map/blob/main/pipeline/sources/cloud_regions.py"
# 同一個座標有好幾個點時在這個半徑（度）的圓上錯開，放大才分得開
SPREAD = 0.025


def read_sites() -> list[dict]:
    with open(CSV, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != FIELDS:
            raise RuntimeError(f"{CSV.name} 的欄位應該是 {FIELDS}，讀到 {reader.fieldnames}")
        rows = list(reader)
    problems = []
    for i, r in enumerate(rows, start=2):
        if r["company"] not in COMPANIES:
            problems.append(f"第 {i} 列公司 {r['company']!r}")
        if r["kind"] not in KINDS or r["kind"] == "cloud":
            problems.append(f"第 {i} 列類型 {r['kind']!r}")
        if r["status"] not in STATUS:
            problems.append(f"第 {i} 列狀態 {r['status']!r}")
        if r["precision"] not in ("site", "city"):
            problems.append(f"第 {i} 列座標精度 {r['precision']!r}")
        if not (r["source"].startswith("https://") or r["source"].startswith("http://")):
            problems.append(f"第 {i} 列沒有出處")
        if len(r["iso3"]) != 3:
            problems.append(f"第 {i} 列國家 {r['iso3']!r}")
        try:
            lat, lon = float(r["lat"]), float(r["lon"])
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                raise ValueError
        except ValueError:
            problems.append(f"第 {i} 列座標 {r['lat']!r}, {r['lon']!r}")
    if problems:
        raise RuntimeError("sites.csv 有問題：" + "；".join(problems[:20]))
    return rows


def cloud_rows() -> list[dict]:
    """AWS、Azure 已經開放的雲端區域 → Amazon、Microsoft 的「雲端區域」（城市的座標）"""
    out = []
    for provider, code, name, city, iso3, lat, lon, year, _src in cloud_regions.REGIONS:
        if provider not in CLOUD:
            continue
        label = f"AWS {name}" if provider == "aws" else f"Azure {name}"
        out.append({"company": CLOUD[provider], "kind": "cloud", "status": "open", "name": label, "name_zh": "",
                    "city": city, "iso3": iso3, "lat": str(lat), "lon": str(lon), "precision": "city", "year": str(year),
                    "source": CLOUD_SOURCE, "note": code})
    return out


def spread(rows: list[dict]) -> None:
    """同一個座標（小數 3 位）有好幾個點時，依序排在一個小圓上（總部留在中心）"""
    at: dict[tuple[float, float], list[dict]] = defaultdict(list)
    for r in rows:
        at[(round(r["lat"], 3), round(r["lon"], 3))].append(r)
    for (lat, lon), group in at.items():
        if len(group) < 2:
            continue
        group.sort(key=lambda r: (r["k"] != 1, r["co"], r["k"], r["name"]))
        ring = group[1:] if group[0]["k"] == 1 else group
        cos = max(math.cos(math.radians(lat)), 0.2)
        for i, r in enumerate(ring):
            a = 2 * math.pi * i / len(ring)
            r["lat"] = lat + SPREAD * math.sin(a)
            r["lon"] = lon + SPREAD * math.cos(a) / cos


def point_rows(sites: list[dict]) -> list[dict]:
    rows = []
    for r in sites:
        rows.append({
            "lon": float(r["lon"]), "lat": float(r["lat"]), "co": COMPANIES.index(r["company"]) + 1, "k": KINDS[r["kind"]],
            "s": STATUS[r["status"]], "pr": 1 if r["kind"] == "hq" else 0, "y": int(r["year"]) if r["year"] else None,
            "name": r["name"], "zh": r["name_zh"] or None, "city": r["city"], "iso3": r["iso3"],
            "src": None if r["source"] == CLOUD_SOURCE else r["source"],
        })
    spread(rows)
    rows.sort(key=lambda p: (p["co"], p["k"], p["iso3"], p["name"]))
    return rows


POINT_FIELDS = ["lon", "lat", "co", "k", "s", "pr", "y", "name", "zh", "city", "iso3", "src"]
POINT_SCALE = {"lon": 0.0001, "lat": 0.0001, "co": 1, "k": 1, "s": 1, "pr": 1, "y": 1}


def write_points(folder: str, rows: list[dict], key: str) -> None:
    write_json(OUT / folder / f"{key}.json", points_file(rows, POINT_FIELDS, POINT_SCALE, strings=("city", "iso3")))


def build() -> None:
    sites = read_sites() + cloud_rows()
    rows = point_rows(sites)
    open_rows = [r for r in rows if r["s"] == 1]
    future_rows = [r for r in rows if r["s"] != 1]
    counts: dict[str, Counter] = {}
    for key in ["all", *COMPANIES]:
        pick = (lambda r: True) if key == "all" else (lambda r, c=COMPANIES.index(key) + 1: r["co"] == c)
        mine = [r for r in open_rows if pick(r)]
        write_points("points", mine, key)
        write_points("future", [r for r in future_rows if pick(r)], key)
        counts[key] = Counter(r["iso3"] for r in mine)
        values = {iso3: [n] for iso3, n in sorted(counts[key].items())}
        write_json(OUT / "count" / f"{key}.json", indicator_file(
            "sites", "處", [YEAR], values, aggregates={"WLD": [sum(counts[key].values())]}))
    present: dict[str, set[str]] = defaultdict(set)
    for r in open_rows:
        present[r["iso3"]].add(COMPANIES[r["co"] - 1])
    write_json(OUT / "companies.json", indicator_file(
        "companies", "家", [YEAR], {iso3: [len(cos)] for iso3, cos in sorted(present.items())}))
    write_manifest_part(OUT, "company-sites", "company-sites", {
        "source": "各公司官方公開的據點資料（手工整理，出處見 pipeline/data/company-sites/sites.csv）；"
                  "AWS、Azure 的雲端區域見 pipeline/sources/cloud_regions.py",
        "license": "引用事實並註明出處",
    })
    by_kind = Counter((COMPANIES[r["co"] - 1], r["k"]) for r in open_rows)
    for co in COMPANIES:
        kinds = {k: by_kind[(co, v)] for k, v in KINDS.items() if by_kind[(co, v)]}
        top = ", ".join(f"{iso3} {n}" for iso3, n in counts[co].most_common(5))
        print(f"  {co}: 營運中 {sum(kinds.values())}（{kinds}），{len(counts[co])} 國；最多 {top}；"
              f"台灣 {counts[co].get('TWN', 0)}；興建中與已宣布 {sum(1 for r in future_rows if COMPANIES[r['co'] - 1] == co)}")
    many = sorted(present.items(), key=lambda kv: -len(kv[1]))[:8]
    print(f"  合計營運中 {len(open_rows)} 處、{len(counts['all'])} 國；興建中與已宣布 {len(future_rows)} 處；"
          f"12 家都在的國家 {[k for k, v in present.items() if len(v) == 12]}；最多家 {[(k, len(v)) for k, v in many]}")
    precision = Counter(r["precision"] for r in sites)
    print(f"  座標：據點本身 {precision['site']}、城市 {precision['city']}")


if __name__ == "__main__":
    build()
