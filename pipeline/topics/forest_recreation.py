"""長途步道與自行車路線：台灣的森林遊樂區（2026-11-07，製作手冊第二十四批 417 的補強；步驟 forest-recreation，
輸出 topics/trails/）。

- 範圍：農業部林業及自然保育署「森林遊樂區範圍界」（data.gov.tw 9931，政府資料開放授權條款第 1 版），
  data.moa.gov.tw 的 KML 連結會轉到一個 KMZ（zip），而且整個檔又用 gzip 包了一層（伺服器不管有沒有要求都這樣送）。
  22 個範圍（19 個國家森林遊樂區，加上退輔會的明池、棲蘭與中興大學的惠蓀林場），屬性有中英文名稱、面積（公頃）、
  管理單位。範圍畫成外框線（shapely 簡化到約 20 公尺），另在範圍的代表點畫一個點。
- 基本資料：「林業保育署所轄森林遊樂區基本資料」（data.gov.tw 37675，同授權）19 處的海拔範圍、所在鄉鎮、管轄分署，
  依名稱併進來（明池、棲蘭、惠蓀不在裡面）。電話與開放時間不輸出。
- data.moa.gov.tw 沒有 robots.txt（回錯誤頁）。自然步道的軌跡（每條步道一個資料集，約 170 個）沒有接。
"""
from __future__ import annotations

import gzip
import io
import json
import re
import zipfile

from shapely.geometry import Polygon
from shapely.ops import unary_union

from common import OUT_DIR, download, lines_file, points_file, write_json, write_manifest_part

OUT = OUT_DIR / "topics" / "trails"
AREAS_URL = "https://data.moa.gov.tw/OpenData/GetOpenDataFile.aspx?id=155&FileType=KML&RID=74545"
BASIC_URL = "https://data.moa.gov.tw//Service/OpenData/ForestAmusementParkData.aspx?IsTransData=1&UnitId=757"
SIMPLIFY = 0.0002  # 度，約 20 公尺


def _kml() -> str:
    raw = download(AREAS_URL, "forestry", "recreation-areas-9931.kmz").read_bytes()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        return z.read("doc.kml").decode("utf-8")


def _field(desc: str, key: str) -> str | None:
    m = re.search(rf"<td>{key}</td>\s*<td>([^<]*)</td>", desc)
    return m.group(1).strip() if m and m.group(1).strip() else None


def _rings(placemark: str) -> list[list[tuple[float, float]]]:
    out = []
    for coords in re.findall(r"<outerBoundaryIs>\s*<LinearRing>\s*<coordinates>(.*?)</coordinates>", placemark, re.S):
        ring = [tuple(map(float, c.split(",")[:2])) for c in coords.split()]
        if len(ring) >= 4:
            out.append(ring)
    return out


def build() -> None:
    basic = {r["RA_name"]: r for r in json.loads(download(BASIC_URL, "forestry", "recreation-areas-37675.json").read_text(encoding="utf-8"))}
    lines, records, points = [], [], []
    for pm in re.findall(r"<Placemark.*?</Placemark>", _kml(), re.S):
        name = re.search(r"<name>([^<]*)</name>", pm).group(1).strip()
        desc = re.search(r"<description><!\[CDATA\[(.*?)\]\]></description>", pm, re.S)
        desc = desc.group(1) if desc else ""
        polys = [Polygon(r).buffer(0) for r in _rings(pm)]
        if not polys:
            continue
        shape = unary_union(polys)
        b = basic.get(name, {})
        ha = _field(desc, "Area_ha")
        rec = {"n": name, "e": _field(desc, "ENAME"), "ha": round(float(ha)) if ha else None,
               "alt": (b.get("RA_ALT") or "").replace(" ", "") or None,
               "mgr": b.get("DEP_NAME") or _field(desc, "Manager"), "adm": b.get("ADMIN_Name")}
        for geom in getattr(shape, "geoms", [shape]):
            ring = list(geom.simplify(SIMPLIFY, preserve_topology=True).exterior.coords)
            lines.append([(round(x, 5), round(y, 5)) for x, y in ring])
            records.append(rec | {"f": 1})  # f：前端畫成半透明的面
        pt = shape.representative_point()
        points.append({"lon": round(pt.x, 4), "lat": round(pt.y, 4)} | rec)
    fields = ["n", "e", "ha", "alt", "mgr", "adm"]
    write_json(OUT / "forest-areas.json", lines_file(lines, 0.0001, records=records, record_fields=fields + ["f"],
                                                     record_scale={"ha": 1, "f": 1}, record_strings=("mgr",)))
    write_json(OUT / "forest-area-points.json", points_file(points, ["lon", "lat"] + fields,
                                                            {"lon": 0.0001, "lat": 0.0001, "ha": 1}, strings=("mgr",)))
    write_manifest_part(OUT, "trails", "forest-recreation", {"sources": [
        "https://data.gov.tw/dataset/9931（農業部林業及自然保育署，政府資料開放授權條款第 1 版）",
        "https://data.gov.tw/dataset/37675（同上）"]})
    print(f"  森林遊樂區 {len(points)} 處、外框 {len(lines)} 條；基本資料對到 {sum(1 for p in points if p['alt'])} 處："
          f"{[(p['n'], p['ha'], p['alt']) for p in points]}")
