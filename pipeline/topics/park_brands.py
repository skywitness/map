"""樂園品牌的據點（2026-11-08，製作手冊第二十七批 632，候選 1372；步驟 park-brands，輸出 topics/theme-parks/brands/）。

手冊的結論：OSM 的 brand:wikidata 在樂園上只有 0.6%、Wikidata 的所有權屬性只有 15.6%，**品牌對應不能自動做**，要照
「大企業的據點」（DESIGN.md 第 8 節第 270 點）手工整理成表：`pipeline/data/park-brands/brands.csv`（欄位說明見同一個資料夾的
README.md），每一列附出處。出處是各品牌英文維基條目（中文維基：海昌）的固定版本裡的據點表或據點清單（CC BY-SA 4.0，只引用
「哪個品牌在哪裡有據點、哪一年開」這些事實）；座標取自 Wikidata（CC0），中國的樂園沒有 Wikidata 座標時用 OpenStreetMap
（ODbL 1.0）的同名物件，都沒有時用城市的座標（precision=city）。

- 品牌：迪士尼、環球、樂高樂園、默林的其他樂園、Six Flags、United Parks、Parques Reunidos、PortAventura、華強方特、華僑城、
  長隆、海昌、三麗鷗、富士急、樂天世界、愛寶樂園、台灣五家（六福村、劍湖山、麗寶、義大、九族），加上默林的三個室內品牌
  （樂高探索中心、Sea Life、杜莎夫人蠟像館）。
- 類型：樂園、水上樂園、動物園與水族館、室內景點。**全部品牌合計只算樂園與水上樂園**（手冊的陷阱：樂高探索中心、Sea Life、
  杜莎夫人蠟像館是室內小型景點，跟樂園不是同一量級）；選單選單一品牌時算這個品牌的全部據點。
- 狀態：營運中、興建中或已宣布（空心的點，不算進據點數）；已關閉的不收。
"""
from __future__ import annotations

import csv
import math
from collections import Counter, defaultdict

from common import OUT_DIR, ROOT, indicator_file, points_file, write_json

OUT = OUT_DIR / "topics" / "theme-parks" / "brands"
CSV = ROOT / "pipeline" / "data" / "park-brands" / "brands.csv"
YEAR = 2026
# 前端 theme-parks.ts 的 BRANDS 依同樣的順序（代碼是索引 + 1）
BRANDS = ["disney", "universal", "legoland", "merlin", "sixflags", "united-parks", "parques-reunidos", "portaventura",
          "fantawild", "oct", "chimelong", "haichang", "sanrio", "fujikyu", "lotte", "everland",
          "leofoo", "janfusun", "lihpao", "eda", "formosan", "ldc", "sea-life", "tussauds"]
KINDS = {"park": 1, "water": 2, "animal": 3, "indoor": 4}
# 全部品牌合計只算這兩類
COUNTED = (1, 2)
STATUS = {"open": 1, "planned": 2}
FIELDS = ["brand", "kind", "status", "name", "name_zh", "city", "iso3", "lat", "lon", "precision", "year", "wikidata", "source", "note"]
SPREAD = 0.012


def read_rows() -> list[dict]:
    with open(CSV, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != FIELDS:
            raise RuntimeError(f"{CSV.name} 的欄位應該是 {FIELDS}，讀到 {reader.fieldnames}")
        rows = list(reader)
    problems = []
    for i, r in enumerate(rows, start=2):
        if r["brand"] not in BRANDS:
            problems.append(f"第 {i} 列品牌 {r['brand']!r}")
        if r["kind"] not in KINDS:
            problems.append(f"第 {i} 列類型 {r['kind']!r}")
        if r["status"] not in STATUS:
            problems.append(f"第 {i} 列狀態 {r['status']!r}")
        if r["precision"] not in ("site", "city"):
            problems.append(f"第 {i} 列座標精度 {r['precision']!r}")
        if not r["source"].startswith("https://"):
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
        raise RuntimeError("brands.csv 有問題：" + "；".join(problems[:20]))
    return rows


def spread(rows: list[dict]) -> None:
    """同一個座標（小數 3 位）有好幾個點時排在一個小圓上（同一個度假區的幾座樂園、同一座城市的室內景點）"""
    at: dict[tuple[float, float], list[dict]] = defaultdict(list)
    for r in rows:
        at[(round(r["lat"], 3), round(r["lon"], 3))].append(r)
    for (lat, lon), group in at.items():
        if len(group) < 2:
            continue
        group.sort(key=lambda r: (r["b"], r["k"], r["name"]))
        cos = max(math.cos(math.radians(lat)), 0.2)
        for i, r in enumerate(group):
            a = 2 * math.pi * i / len(group)
            r["lat"] = lat + SPREAD * math.sin(a)
            r["lon"] = lon + SPREAD * math.cos(a) / cos


def point_rows(src: list[dict]) -> list[dict]:
    rows = [{
        "lon": float(r["lon"]), "lat": float(r["lat"]), "b": BRANDS.index(r["brand"]) + 1, "k": KINDS[r["kind"]],
        "s": STATUS[r["status"]], "y": int(r["year"]) if r["year"] else None, "ct": 1 if r["precision"] == "city" else 0,
        "name": r["name"], "zh": r["name_zh"] or None, "city": r["city"], "iso3": r["iso3"], "src": r["source"],
    } for r in src]
    spread(rows)
    rows.sort(key=lambda p: (p["b"], p["k"], p["iso3"], p["name"]))
    return rows


POINT_FIELDS = ["lon", "lat", "b", "k", "s", "y", "ct", "name", "zh", "city", "iso3", "src"]
POINT_SCALE = {"lon": 0.0001, "lat": 0.0001, "b": 1, "k": 1, "s": 1, "y": 1, "ct": 1}


def write_points(folder: str, rows: list[dict], key: str) -> None:
    write_json(OUT / folder / f"{key}.json", points_file(rows, POINT_FIELDS, POINT_SCALE, strings=("city", "iso3")))


def build() -> None:
    src = read_rows()
    rows = point_rows(src)
    open_rows = [r for r in rows if r["s"] == 1]
    future = [r for r in rows if r["s"] != 1]
    counts: dict[str, Counter] = {}
    for key in ["all", *BRANDS]:
        if key == "all":
            pick = lambda r: r["k"] in COUNTED  # noqa: E731
            mine = [r for r in open_rows if pick(r)]
            write_points("points", open_rows, key)  # 點全部畫（室內景點也畫），數量只算樂園與水上樂園
            write_points("future", future, key)
        else:
            code = BRANDS.index(key) + 1
            pick = lambda r, c=code: r["b"] == c  # noqa: E731
            mine = [r for r in open_rows if pick(r)]
            write_points("points", mine, key)
            write_points("future", [r for r in future if pick(r)], key)
        counts[key] = Counter(r["iso3"] for r in mine)
        write_json(OUT / "count" / f"{key}.json", indicator_file(
            "brand-sites", "處", [YEAR], {iso3: [n] for iso3, n in sorted(counts[key].items())},
            aggregates={"WLD": [sum(counts[key].values())]}, license="CC BY-SA 4.0",
            attribution="English Wikipedia (brand articles); Wikidata; OpenStreetMap contributors"))
    for b in BRANDS:
        c = counts[b]
        kinds = Counter(r["k"] for r in open_rows if BRANDS[r["b"] - 1] == b)
        print(f"  {b}: 營運中 {sum(c.values())}（{dict(sorted(kinds.items()))}），{len(c)} 國；"
              f"最多 {', '.join(f'{k} {n}' for k, n in c.most_common(4))}；未來 {sum(1 for r in future if BRANDS[r['b'] - 1] == b)}")
    print(f"  合計（樂園與水上樂園）{sum(counts['all'].values())} 處、{len(counts['all'])} 國；最多 "
          + "、".join(f"{k} {n}" for k, n in counts["all"].most_common(8)) + f"；台灣 {counts['all'].get('TWN', 0)}")
    print(f"  全部營運中 {len(open_rows)}、未來 {len(future)}；座標精度 {Counter(r['precision'] for r in src)}")


if __name__ == "__main__":
    build()
