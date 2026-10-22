"""OpenStreetMap（ODbL，© OpenStreetMap contributors），透過 Overpass API 查詢。

只發一次全球查詢，取回所有標示為數據中心的地點（含中心座標），國家在本地用國界判斷，
不必對公用伺服器發上百次查詢。
"""
from __future__ import annotations

import json
import urllib.parse
from typing import NamedTuple

from common import download

OVERPASS = "https://overpass-api.de/api/interpreter"
DATACENTER_QUERY = (
    '[out:json][timeout:900];'
    '(nwr["telecom"="data_center"];nwr["building"="data_center"];);'
    'out center tags qt;'
)


class Place(NamedTuple):
    osm_id: str
    lon: float
    lat: float
    name: str
    operator: str


def datacenters() -> tuple[list[Place], str]:
    """回傳 (所有數據中心, OSM 資料時間戳)。同時有兩個標籤的同一個物件只算一次。"""
    url = f"{OVERPASS}?data={urllib.parse.quote(DATACENTER_QUERY)}"
    path = download(url, "osm", "datacenters.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    places = []
    for e in data["elements"]:
        point = e if e["type"] == "node" else e.get("center")
        if not point:
            continue
        tags = e.get("tags", {})
        places.append(Place(
            f"{e['type']}/{e['id']}", point["lon"], point["lat"],
            tags.get("name", ""), tags.get("operator", ""),
        ))
    return places, data.get("osm3s", {}).get("timestamp_osm_base", "")
