"""台灣的觀光工廠（2026-11-08，製作手冊第二十七批 650，候選 1423；步驟 tw-factories，輸出 topics/attractions/）、
森林遊樂區（651）見 topics/forest_recreation.py（第二十四批 417 的補強已經做了）。

- 觀光工廠：經濟部產業發展署「觀光工廠名錄」（data.gov.tw 6848，政府資料開放授權條款第 1 版；www.ida.gov.tw 的 robots.txt
  是 404，2026-11-08 讀過）158 家。名錄沒有經緯度：先用名稱對 OpenStreetMap（經 QLever，ODbL 1.0；名稱完全相同、
  或去掉「觀光工廠」等字尾後相同，代表點在台灣範圍內、離地址的鄉鎮市區 15 公里以內），對不到的放在地址的鄉鎮市區（內政部國土測繪中心的鄉鎮市區界，
  離邊界最遠的點），點上註明「位置是鄉鎮市區的中心」。預約電話不輸出。
"""
from __future__ import annotations

import csv
import io
import json
import re

from common import OUT_DIR, download, points_file, write_json, write_points
from sources import osm_qlever

FACTORY_URL = "https://www.ida.gov.tw/opendata/02/SDD6848.csv"
SUFFIX = re.compile(r"(觀光工廠|觀光工場|文化館|故事館|博物館|園區|館)$")

def _tw(lon: float, lat: float) -> bool:
    return 118 <= lon <= 123 and 21 <= lat <= 27


def _osm_names(names: list[str], key: str) -> dict[str, tuple[float, float]]:
    """OSM 上 name 完全相同、代表點在台灣的物件 → 代表點（同名的取第一個）"""
    values = " ".join(json.dumps(n, ensure_ascii=False) for n in sorted(set(names)))
    rows = osm_qlever.query(f"""PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
SELECT ?name ?c WHERE {{
  VALUES ?name {{ {values} }}
  ?x osmkey:name ?name ; geo:hasGeometry/geo:asWKT ?wkt .
  BIND(geof:centroid(?wkt) AS ?c)
}}""", key)
    out: dict[str, tuple[float, float]] = {}
    for r in rows:
        m = re.match(r"POINT\(([-\d.eE]+) ([-\d.eE]+)\)", r.get("c", {}).get("value", ""), re.I)
        if m and _tw(float(m.group(1)), float(m.group(2))):
            out.setdefault(r["name"]["value"], (float(m.group(1)), float(m.group(2))))
    return out


def _towns() -> dict[tuple[str, str], list[float]]:
    from divisions import _label_point, _moi

    loaded = _moi()
    if not loaded:
        raise RuntimeError("沒有內政部的縣市、鄉鎮市區界（.cache/nlsc/），先跑 divisions")
    counties, towns = loaded
    cname = {c["key"]: c["zh"] for c in counties}
    return {(cname[t["parent_key"]], t["zh"]): _label_point(t["geom"]) for t in towns}


def _split_address(addr: str, county_col: str, towns: dict) -> tuple[str | None, str | None]:
    """地址 → (縣市, 鄉鎮市區)：去掉郵遞區號與「工廠：」這類前綴；地址沒寫縣市的用縣市欄；鄉鎮市區從 2 到 4 個字逐一試，
    要在內政部的鄉鎮市區名單裡（「新市區」不會被切成「新市」）"""
    addr = re.sub(r"^[^：:]*[：:]", "", addr.replace("台", "臺").strip())
    addr = re.sub(r"^\d{3,6}\s*", "", addr)
    county = county_col.replace("台", "臺").strip()
    m = re.match(r"(.{2}[縣市])", addr)
    if m and any(k[0] == m.group(1) for k in towns):
        county, addr = m.group(1), addr[len(m.group(1)):]
    for n in (2, 3, 4):
        if (county, addr[:n]) in towns:
            return county, addr[:n]
    return county, None


def factories() -> None:
    text = download(FACTORY_URL, "ida", "SDD6848.csv").read_text(encoding="utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(text)))
    names = [r["觀光工廠名稱"].strip() for r in rows]
    variants = {n: SUFFIX.sub("", n) for n in names}
    found = _osm_names(names + [v for v in variants.values() if len(v) >= 3], "tw-factories-names")
    towns = _towns()
    out, approx, lost = [], 0, []
    for r in rows:
        name = r["觀光工廠名稱"].strip()
        county, town = _split_address(r["地址"], r["縣市"], towns)
        where = found.get(name) or found.get(variants[name])
        center = towns.get((county, town))
        if where and center:
            # 同名的別處（例如「台灣玻璃館」對到 93 公里外的同名地點）：離地址的鄉鎮市區超過 15 公里就不用
            import math
            km = math.hypot((where[0] - center[0]) * math.cos(math.radians(where[1])), where[1] - center[1]) * 111
            if km > 15:
                where = None
        a = 0
        if not where and (county, town) in towns:
            where, a = tuple(towns[(county, town)]), 1
        if not where:
            lost.append((name, r["地址"]))
            continue
        approx += a
        out.append({"lon": round(where[0], 5), "lat": round(where[1], 5), "a": a, "name": name, "county": county, "town": town,
                    "url": (r.get("網址") or "").strip() or None})
    # 同一個鄉鎮中心的幾家排成小圈
    import math
    from collections import defaultdict
    at = defaultdict(list)
    for o in out:
        if o["a"]:
            at[(o["lon"], o["lat"])].append(o)
    for (lon, lat), group in at.items():
        if len(group) < 2:
            continue
        for i, o in enumerate(group):
            ang = 2 * math.pi * i / len(group)
            o["lon"] = round(lon + 0.006 * math.cos(ang), 5)
            o["lat"] = round(lat + 0.006 * math.sin(ang), 5)
    out.sort(key=lambda o: (o["county"], o["name"]))
    write_points(OUT_DIR / "topics" / "attractions" / "tw-factories.json",
                 points_file(out, ["lon", "lat", "a", "name", "county", "town", "url"], {"lon": 0.00001, "lat": 0.00001, "a": 1},
                             strings=("county", "town")), ("name", "url"))
    # 指標本身國家不上色（layer none），放一個空的指標檔
    from common import indicator_file
    write_json(OUT_DIR / "topics" / "attractions" / "tw-factories-map.json",
               indicator_file("tw-factories-map", "", [2026], {}, license="政府資料開放授權條款第 1 版"))
    from collections import Counter
    print(f"  觀光工廠：名錄 {len(rows)} 家，畫出 {len(out)}（OSM 對到 {len(out) - approx}、放在鄉鎮市區中心 {approx}），對不到 {lost}")
    print(f"    縣市：{Counter(o['county'] for o in out).most_common(8)}；地區：{Counter(r['地區別'] for r in rows).most_common()}")


def build() -> None:
    factories()

