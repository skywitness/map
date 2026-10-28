"""國界：Natural Earth 1:50m 與 1:110m（world-atlas 套件），把 id 從 ISO 數字代碼改成 ISO alpha-3。

前端與所有主題資料都用 alpha-3 當 key，這樣地圖與資料只需要對一次。
1:110m 只用在第一次造訪的第一個畫面（檔案小很多），之後換成 1:50m。
"""
from __future__ import annotations

import json

import pycountry

from common import OUT_DIR, download, write_json

WORLD_ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-{scale}.json"
# 世界視角的湖泊（公有領域）：國界不挖掉湖（五大湖、維多利亞湖算在國家裡），縮放 4.5 以下陸地用國界畫，湖要另外蓋上去
LAKES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v4.1.0/geojson/ne_110m_lakes.geojson"

# world-atlas 裡沒有 ISO 數字代碼的區域。底線開頭代表非 ISO 代碼，不會有統計資料。
NO_ID_OVERRIDES = {
    "Kosovo": ("XKX", "XK"),  # 非正式 ISO，但 World Bank 等機構都用 XKX
    "Somaliland": ("_SOL", None),
    "N. Cyprus": ("_CYN", None),
    "Indian Ocean Ter.": ("_IOT", None),  # 澳洲的聖誕島與科科斯群島
    "Siachen Glacier": ("_SIA", None),
}


def unit_id(name: str, numeric: str | None) -> tuple[str, str | None]:
    """world-atlas 的一個單位（名稱、ISO 數字代碼）→ 網站的 (iso3, iso2)；geoindex 的 1:10m 國界也用這一套。"""
    if numeric is None:
        return NO_ID_OVERRIDES[name]
    country = pycountry.countries.get(numeric=numeric)
    return country.alpha_3, country.alpha_2


def world_atlas_units(scale: str = "50m") -> dict[str, str | None]:
    """world-atlas 的 countries-<scale>.json（下載快取）：{名稱: ISO 數字代碼或 None}"""
    src = download(WORLD_ATLAS_URL.format(scale=scale), "world-atlas", f"countries-{scale}.json")
    with open(src, encoding="utf-8") as f:
        topo = json.load(f)
    return {g["properties"]["name"]: g.get("id") for g in topo["objects"]["countries"]["geometries"]}


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


# 排名表的洲別篩選（regions.json）：Natural Earth 1:10m（4.1.0，公有領域，geoindex 判斷位置用的同一份）的 CONTINENT
CONTINENTS = {
    "Africa": "AF",
    "Asia": "AS",
    "Europe": "EU",
    "North America": "NA",  # 含中美洲與加勒比海
    "South America": "SA",
    "Oceania": "OC",
    "Antarctica": "AN",
}
# Natural Earth 寫「Seven seas (open ocean)」的島，與 1:10m 沒有自己單位的地方（併在法國、挪威、澳洲…裡），
# 照聯合國 M49 的地理分區（只當地理事實參考，沒有用它的檔案）
REGION_FIXES = {
    "MDV": "AS", "MUS": "AF", "SYC": "AF", "SHN": "AF", "IOT": "AF", "ATF": "AF", "HMD": "OC", "SGS": "SA",
    "BES": "NA", "GLP": "NA", "MTQ": "NA", "GUF": "SA", "MYT": "AF", "REU": "AF", "SJM": "EU",
    "CCK": "OC", "CXR": "OC", "TKL": "OC", "UMI": "OC", "BVT": "SA",
}


def build_regions() -> None:
    from geoindex import _ten_m_features, ten_m_units

    regions: dict[str, str] = {}
    for feature, (_name, iso3) in zip(_ten_m_features(), ten_m_units()):
        code = CONTINENTS.get(feature["properties"]["CONTINENT"])
        if iso3 and code:
            if regions.get(iso3, code) != code:
                raise ValueError(f"{iso3} 的 1:10m 單位分在不同的洲")
            regions[iso3] = code
    regions.update(REGION_FIXES)
    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        missing = [iso3 for iso3 in json.load(f) if not iso3.startswith("_") and iso3 not in regions]
    if missing:
        raise ValueError(f"這些國家沒有洲別，加到 REGION_FIXES：{missing}")
    write_json(OUT_DIR / "regions.json", dict(sorted(regions.items())))


def build() -> None:
    for scale in ("50m", "110m"):
        count = convert(scale)
        print(f"  {scale}：共 {count} 個國家/區域")

    # 國家對照表：涵蓋地圖上沒有形狀的國家（例如吐瓦魯），前端用 iso2 取繁中國名
    # 英文名優先用通用名稱（Taiwan、South Korea），不用 ISO 正式名稱（Taiwan, Province of China）
    reference = {
        c.alpha_3: {"iso2": c.alpha_2, "name": getattr(c, "common_name", c.name)} for c in pycountry.countries
    }
    for name, (iso3, iso2) in NO_ID_OVERRIDES.items():
        reference[iso3] = {"iso2": iso2, "name": name} if iso2 else {"name": name}
    write_json(OUT_DIR / "countries.json", dict(sorted(reference.items())))
    build_regions()
    build_lakes()


def build_lakes() -> None:
    """Natural Earth 1:110m 的湖泊 → geo/lakes-110m.json（世界視角的底圖，WorldMap 的 base-lakes 圖層）。

    座標取到小數 2 位（約 1 km），只留幾何：縮放 4.5 以上改用底圖圖磚的水域。
    """
    src = download(LAKES_URL, "natural-earth", "ne_110m_lakes-4.1.0.geojson")
    with open(src, encoding="utf-8") as f:
        lakes = json.load(f)

    def rounded(coords):
        if isinstance(coords[0], (int, float)):
            return [round(coords[0], 2), round(coords[1], 2)]
        return [rounded(c) for c in coords]

    features = [
        {"type": "Feature", "properties": {}, "geometry": {"type": f["geometry"]["type"], "coordinates": rounded(f["geometry"]["coordinates"])}}
        for f in lakes["features"]
    ]
    write_json(OUT_DIR / "geo" / "lakes-110m.json", {"type": "FeatureCollection", "features": features})


def convert(scale: str) -> int:
    """下載 world-atlas 的 countries-<scale>.json，id 換成 ISO alpha-3，寫到 geo/countries-<scale>.json。"""
    src = download(WORLD_ATLAS_URL.format(scale=scale), "world-atlas", f"countries-{scale}.json")
    with open(src, encoding="utf-8") as f:
        topo = json.load(f)

    merged: dict[str, dict] = {}
    for geom in topo["objects"]["countries"]["geometries"]:
        name = geom["properties"]["name"]
        iso3, iso2 = unit_id(name, geom.get("id"))

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
    write_json(OUT_DIR / "geo" / f"countries-{scale}.json", topo)
    return len(merged)


if __name__ == "__main__":
    build()
