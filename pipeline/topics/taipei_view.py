"""從台北看世界（新主題，2026-10-29）：各國首都離台北多遠、在哪個方位，地球儀上的距離圈與大圓航線。

使用者決定（2026-10-29）：主地圖不換投影（MapLibre 只有地球儀與 Web Mercator），地球儀上畫距離圈與到各國首都的
大圓航線，各國的距離、方位是指標，側欄放以台北為中心的方位等距圓盤（前端用 d3-geo 畫）；中心固定台北。

**材料**：首都的經緯度是晝夜與季節主題的 public/data/topics/daylight/capitals.json（國家小檔案的 Wikidata 首都，CC0）。
台北取臺北市政府（北緯 25.0375°、東經 121.5625°）。地球當成半徑 6,371.0088 km 的球（大圓距離，跟橢球的誤差 0.5% 以內）。

**方位**：從台北出發的大圓航線一開始朝哪個方向（真北起順時針），八方位：北 337.5°–22.5°、東北…。航線不是地圖上的直線：
到華盛頓一開始往北偏東 16°（越過阿拉斯加），不是往東。對蹠點附近（阿根廷、巴拉圭、烏拉圭）往哪個方向都差不多遠，方位不穩定。

**輸出**（public/data/topics/taipei-view/）：distance.json（km）、bearing.json（八方位的代碼 1–8）、bearing-deg.json
（方位角，tooltip 與側欄用）、flight-hours.json（搭飛機要幾小時的估算，2026-10-31 第十批 178）、circles.json（1,000、5,000、10,000、15,000、20,000 km 的距離圈）、routes.json（大圓航線，
紀錄 iso3、距離、方位角）、taipei.json（台北的點）。
"""
from __future__ import annotations

import json
import math

from common import OUT_DIR, indicator_file, lines_file, points_file, write_json

OUT = OUT_DIR / "topics" / "taipei-view"
CAPITALS = OUT_DIR / "topics" / "daylight" / "capitals.json"
TAIPEI = (121.5625, 25.0375)
R = 6371.0088
YEAR = 2026
RINGS = [1000, 5000, 10000, 15000, 20000]
# 航線每隔多少公里一點
STEP_KM = 150
# 搭飛機要幾小時（使用者 2026-10-30 決定的估算）：大圓距離 ÷ 850 km/h ＋ 0.5 小時（起飛、爬升、降落、繞行）。
# 用「最長的直飛航線」校正過：新加坡航空 SQ 23 紐約–新加坡 15,349 km 實際 18:55，公式 18.6 小時；
# 長榮 BR 32 桃園–紐瓦克 12,552 km 實際 14:45，公式 15.3 小時（往東順風）
CRUISE_KMH = 850
OVERHEAD_H = 0.5


def distance_bearing(lon1: float, lat1: float, lon2: float, lat2: float) -> tuple[float, float]:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    d = 2 * R * math.asin(min(1, math.sqrt(a)))
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return d, (math.degrees(math.atan2(y, x)) + 360) % 360


def destination(lon: float, lat: float, bearing: float, km: float) -> tuple[float, float]:
    p1, l1, b, dr = math.radians(lat), math.radians(lon), math.radians(bearing), km / R
    p2 = math.asin(math.sin(p1) * math.cos(dr) + math.cos(p1) * math.sin(dr) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(dr) * math.cos(p1), math.cos(dr) - math.sin(p1) * math.sin(p2))
    return math.degrees(l2), math.degrees(p2)


def unwrap(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """經度改成連續的（可以超過 ±180），線才不會橫越整個地圖"""
    out = [points[0]]
    for lon, lat in points[1:]:
        prev = out[-1][0]
        lon += 360 * round((prev - lon) / 360)
        out.append((lon, lat))
    return out


def octant(bearing: float) -> int:
    """1 北、2 東北、3 東、4 東南、5 南、6 西南、7 西、8 西北"""
    return int(((bearing + 22.5) % 360) // 45) + 1


def build() -> None:
    with open(CAPITALS, encoding="utf-8") as f:
        caps = json.load(f)["capitals"]
    lon0, lat0 = TAIPEI
    dist, bear, deg = {}, {}, {}
    routes, records = [], []
    for iso3, (lat, lon, *_rest) in sorted(caps.items()):
        if iso3 == "TWN":
            continue
        d, b = distance_bearing(lon0, lat0, lon, lat)
        dist[iso3], bear[iso3], deg[iso3] = [round(d)], [octant(b)], [round(b, 1)]
        n = max(2, math.ceil(d / STEP_KM))
        pts = [destination(lon0, lat0, b, d * i / n) for i in range(n + 1)]
        routes.append(unwrap(pts))
        records.append({"iso3": iso3, "d": round(d), "b": round(b)})
    OUT.mkdir(parents=True, exist_ok=True)
    notes = {"noValue": {"TWN": "這裡就是台北"}, "noValueEn": {"TWN": "This is Taipei"}}
    write_json(OUT / "distance.json", indicator_file("distance", "km", [YEAR], dist, **notes))
    write_json(OUT / "bearing.json", indicator_file("bearing", "", [YEAR], bear, **notes))
    write_json(OUT / "bearing-deg.json", indicator_file("bearing-deg", "°", [YEAR], deg, **notes))
    hours = {c: [round(v[0] / CRUISE_KMH + OVERHEAD_H, 1)] for c, v in dist.items()}
    write_json(OUT / "flight-hours.json", indicator_file("flight-hours", "h", [YEAR], hours, **notes))
    write_json(OUT / "routes.json", lines_file(
        routes, 0.01, records=records, record_fields=["iso3", "d", "b"], record_scale={"d": 1, "b": 1}))
    rings = []
    for km in RINGS:
        pts = [destination(lon0, lat0, a, km) for a in [i * 2 for i in range(181)]]
        rings.append(unwrap(pts))
    write_json(OUT / "taipei.json", points_file([{"lon": lon0, "lat": lat0, "zh": "台北", "en": "Taipei"}], ["lon", "lat", "zh", "en"], {"lon": 0.0001, "lat": 0.0001}))
    write_json(OUT / "circles.json", lines_file(rings, 0.01, records=[{"km": km} for km in RINGS], record_fields=["km"], record_scale={"km": 1}))
    nearest = sorted(dist, key=lambda c: dist[c][0])
    print(f"  {len(dist)} 個首都；最近 {[(c, dist[c][0]) for c in nearest[:4]]}，最遠 {[(c, dist[c][0]) for c in nearest[-3:]]}")
    for c in ("USA", "GBR", "JPN", "PHL", "PRY", "ARG", "URY", "AUS", "ZAF", "FRA"):
        if c in dist:
            print(f"    {c}：{dist[c][0]:,} km，方位 {deg[c][0]}°（{octant(deg[c][0])}），約 {dist[c][0] / CRUISE_KMH + OVERHEAD_H:.1f} 小時")


if __name__ == "__main__":
    build()
