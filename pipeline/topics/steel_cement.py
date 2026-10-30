"""工業主題的鋼鐵與水泥：各國粗鋼、水泥產量（比例圓）與 GEM 的鋼鐵廠、水泥廠（點）。

輸出到 public/data/topics/industry/（跟工業主題同一個資料夾）：
- steel.json、cement.json：USGS Minerals Yearbook 2023 的世界產量表（鋼鐵表 10 粗鋼、水泥表 22），
  2019–2023 年，單位換成公噸；世界合計是表裡的 Total（USGS 四捨五入過）。
  最新一年是 USGS 估計值（註記 e）的國家，附註寫出來（印度的水泥、伊朗等）。
- steel-plants.json、cement-plants.json：Global Energy Monitor 公開地圖的 GeoJSON
  （Global Iron and Steel Tracker 2026 年 9 月版、Global Cement and Concrete Tracker 2026 年 7 月版），
  一座廠一個點；取消（cancelled）與狀態不明（unknown）的不畫。容量：鋼鐵廠是千公噸/年（煉鐵與煉鋼的
  各種製程加總，GEM 的 capacity 欄），水泥廠是百萬公噸/年（水泥產能）。
  GEM 網站上的「Download data」要填表，不用；公開地圖的檔案放在 GEM 的 CDN，不必填表（同發電廠地圖）。
"""
from __future__ import annotations

import json
import re

from common import OUT_DIR, download, indicator_file, points_file, to_series, write_json
from sources import usgs_myb
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "industry"

USGS = {
    "steel": ("myb1-2023-feste-ert.xlsx", "T10"),
    "cement": ("myb1-2023-cemen-ERT.xlsx", "T22"),
}
GEM = {
    "steel": "https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/Current_maps/gist/gist_map_2026-09.geojson",
    "cement": "https://publicgemdata.nyc3.cdn.digitaloceanspaces.com/interim_maps/gcct_map_2026-07.geojson",
}
# GEM 的狀態 → 代碼（src/topics/industry.ts 的 PLANT_STATUS）；不在這裡的（cancelled、unknown）不畫
STATUS = {"operating": 1, "operating pre-retirement": 1, "construction": 2, "announced": 3, "mothballed": 4, "retired": 5}
COUNTRY_ALIASES = {"Türkiye": "TUR", "Kosovo": "XKX"}


def _year(text: object) -> int | None:
    m = re.match(r"\s*(\d{4})", str(text or ""))
    return int(m.group(1)) if m else None


def _production(kind: str) -> None:
    filename, sheet = USGS[kind]
    table = usgs_myb.world_table(filename, sheet)
    years = sorted({y for r in table.values() for y in r.values})
    values, notes, notes_en = {}, {}, {}
    for code, row in table.items():
        if code == "WLD":
            continue
        values[code] = to_series({y: v * 1000 for y, v in row.values.items()}, years, 0)
        last = max(row.values)
        if last in row.estimated:
            notes[code] = f"{last} 年是 USGS 的估計值"
            notes_en[code] = f"{last} figure is a USGS estimate"
    world = table["WLD"].values
    write_json(OUT / f"{kind}.json", indicator_file(
        kind, "公噸", years, values,
        aggregates={"WLD": to_series({y: v * 1000 for y, v in world.items()}, years, 0)},
        notes=notes, notesEn=notes_en))
    top = sorted(values, key=lambda c: -(values[c][-1] or 0))[:5]
    print(f"  {kind}.json：{len(values)} 國，{years[-1]} 年前五 " + "、".join(
        f"{c} {values[c][-1] / 1e6:,.1f}" for c in top) + f"（百萬公噸），台灣 {(values.get('TWN') or [0])[-1] / 1e6:,.2f}")


def _plants(kind: str) -> None:
    url = GEM[kind]
    path = download(url, "gem", url.rsplit("/", 1)[1])
    features = json.loads(path.read_text(encoding="utf-8"))["features"]
    rows, missing = [], set()
    for f in features:
        p = f["properties"]
        status = STATUS.get(str(p.get("status", "")).strip().lower())
        if status is None:
            continue
        country = str(p.get("country-area1", "")).strip()
        iso3 = COUNTRY_ALIASES.get(country) or from_name(country)
        if not iso3:
            missing.add(country)
        lon, lat = f["geometry"]["coordinates"][:2]
        try:
            cap = float(p.get("capacity") or 0)
        except ValueError:
            cap = 0.0
        if kind == "steel":
            kind_text = str(p.get("prod-type") or "").strip()
        else:
            kind_text = str(p.get("plant-type") or "").strip()
        rows.append({
            "lon": lon, "lat": lat, "cap": round(cap, 1 if kind == "cement" else 0), "st": status,
            "start": _year(p.get("start-year")), "name": str(p.get("name", "")).strip(),
            "type": kind_text if kind_text and kind_text.lower() not in ("unknown", "n/a") else None,
            "owner": re.sub(r"\s*\[[^\]]*\]", "", str(p.get("parent") or p.get("owner") or "")).strip() or None,
            "iso3": iso3,
        })
    if missing:
        print(f"  查不到 ISO 代碼的國名：{sorted(missing)}")
    # 依容量由大到小：前端不設 sortField，小廠畫在大廠上面（同發電廠地圖）
    rows.sort(key=lambda r: (-r["cap"], r["name"]))
    fields = ["lon", "lat", "cap", "st", "start", "name", "type", "owner", "iso3"]
    scale = {"lon": 0.001, "lat": 0.001, "cap": 0.1 if kind == "cement" else 1, "st": 1, "start": 1}
    data = points_file(rows, fields, scale, delta=("cap",), strings=("type", "owner", "iso3"))
    write_json(OUT / f"{kind}-plants.json", data, quiet=True)
    tw = sum(1 for r in rows if r["iso3"] == "TWN")
    print(f"  {kind}-plants.json：{len(rows)} 座（台灣 {tw}），{len(json.dumps(data, ensure_ascii=False)) / 1e6:.2f} MB")


def build() -> None:
    for kind in USGS:
        _production(kind)
        _plants(kind)
