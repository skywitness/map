"""國界：Natural Earth 1:50m（world-atlas 套件），把 id 從 ISO 數字代碼改成 ISO alpha-3。

前端與所有主題資料都用 alpha-3 當 key，這樣地圖與資料只需要對一次。
"""
from __future__ import annotations

import json

import pycountry

from common import OUT_DIR, download, write_json

WORLD_ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json"

# world-atlas 裡沒有 ISO 數字代碼的區域。底線開頭代表非 ISO 代碼，不會有統計資料。
NO_ID_OVERRIDES = {
    "Kosovo": ("XKX", "XK"),  # 非正式 ISO，但 World Bank 等機構都用 XKX
    "Somaliland": ("_SOL", None),
    "N. Cyprus": ("_CYN", None),
    "Indian Ocean Ter.": ("_IOT", None),  # 澳洲的聖誕島與科科斯群島
    "Siachen Glacier": ("_SIA", None),
}


def as_multipolygon_arcs(geom: dict) -> list:
    if geom["type"] == "Polygon":
        return [geom["arcs"]]
    if geom["type"] == "MultiPolygon":
        return geom["arcs"]
    raise ValueError(f"未預期的幾何類型 {geom['type']}")


def load_countries() -> dict[str, dict]:
    """讀回 build() 產生的國界，解成 {iso3: GeoJSON 幾何}（經緯度）。"""
    with open(OUT_DIR / "geo" / "countries-50m.json", encoding="utf-8") as f:
        topo = json.load(f)
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs: list[list[tuple[float, float]]] = []
    for arc in topo["arcs"]:  # 量化後逐點差分編碼
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * sx + tx, y * sy + ty))
        arcs.append(points)

    def ring(ids: list[int]) -> list[tuple[float, float]]:
        coords: list[tuple[float, float]] = []
        for i in ids:
            points = arcs[i] if i >= 0 else arcs[~i][::-1]  # 負數代表反向的 arc
            coords.extend(points if not coords else points[1:])
        return coords

    return {
        geom["id"]: {
            "type": "MultiPolygon",
            "coordinates": [[ring(r) for r in polygon] for polygon in as_multipolygon_arcs(geom)],
        }
        for geom in topo["objects"]["countries"]["geometries"]
    }


def build() -> None:
    src = download(WORLD_ATLAS_URL, "world-atlas", "countries-50m.json")
    with open(src, encoding="utf-8") as f:
        topo = json.load(f)

    merged: dict[str, dict] = {}
    for geom in topo["objects"]["countries"]["geometries"]:
        name = geom["properties"]["name"]
        numeric = geom.get("id")
        if numeric is None:
            iso3, iso2 = NO_ID_OVERRIDES[name]
        else:
            country = pycountry.countries.get(numeric=numeric)
            iso3, iso2 = country.alpha_3, country.alpha_2

        if iso3 in merged:
            # 同一個 ISO 代碼出現兩次（例如澳洲與阿什莫爾-卡蒂埃群島），合併成一個 MultiPolygon
            target = merged[iso3]
            target["arcs"] = as_multipolygon_arcs(target) + as_multipolygon_arcs(geom)
            target["type"] = "MultiPolygon"
            continue

        props = {"name": name}
        if iso2:
            props["iso2"] = iso2
        merged[iso3] = {"type": geom["type"], "arcs": geom["arcs"], "id": iso3, "properties": props}

    topo["objects"] = {
        "countries": {"type": "GeometryCollection", "geometries": list(merged.values())}
    }
    write_json(OUT_DIR / "geo" / "countries-50m.json", topo)
    print(f"  共 {len(merged)} 個國家/區域")

    # 國家對照表：涵蓋地圖上沒有形狀的國家（例如吐瓦魯），前端用 iso2 取繁中國名
    # 英文名優先用通用名稱（Taiwan、South Korea），不用 ISO 正式名稱（Taiwan, Province of China）
    reference = {
        c.alpha_3: {"iso2": c.alpha_2, "name": getattr(c, "common_name", c.name)} for c in pycountry.countries
    }
    for name, (iso3, iso2) in NO_ID_OVERRIDES.items():
        reference[iso3] = {"iso2": iso2, "name": name} if iso2 else {"name": name}
    write_json(OUT_DIR / "countries.json", dict(sorted(reference.items())))


if __name__ == "__main__":
    build()
