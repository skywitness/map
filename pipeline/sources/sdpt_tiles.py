"""WRI Spatial Database of Planted Trees v2.0（SDPT，Richter 等 2024，CC BY 4.0）的向量圖磚。

GFW Data API 的查詢與下載要 API key（使用者不能申請），GeoTIFF、GeoPackage 在不公開的 S3；只有 GFW 網站用的向量圖磚
（https://tiles.globalforestwatch.org/gfw_planted_forests/v20231128/dynamic/{z}/{x}/{y}.pbf）不必金鑰。
4 級以下回 504，5 級一張要 20–30 秒產生，所以用 6 級（一張 1–6 MB、約 4 秒）：陸地上的圖磚（每張取 12 × 12 個點，
有一點在國界內就算）一張一張下載，一次 PARALLEL 張，快取在 .cache/sdpt/<z>/<x>/<y>.pbf（空的圖磚也留著，不再下載）。
多邊形很密的圖磚（歐洲、中國）伺服器 90 秒產生不出來、回 504：改抓下一級的 4 張，最多到 MAX_ZOOM 級
（失敗的記在 <y>.fail，不再重試；匈牙利東北部有一塊到 10 級都產生不出來，略過，DESIGN.md 寫明）。第一次約 1,000 張、1–2 小時。
"""
from __future__ import annotations

import math
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from common import CACHE_DIR, USER_AGENT

URL = "https://tiles.globalforestwatch.org/gfw_planted_forests/v20231128/dynamic/{z}/{x}/{y}.pbf"
ZOOM = 6
MAX_ZOOM = 8
PARALLEL = 4
# 南極與北極圈以北沒有人工林：只抓這個緯度範圍
LAT_RANGE = (-56.0, 72.0)
CACHE = CACHE_DIR / "sdpt"


def tile_bounds(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    n = 2 ** z
    lon = lambda i: i / n * 360 - 180  # noqa: E731
    lat = lambda j: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * j / n))))  # noqa: E731
    return lon(x), lat(y + 1), lon(x + 1), lat(y)


def land_tiles(z: int = ZOOM) -> list[tuple[int, int]]:
    from geoindex import countries_at

    out = []
    n = 2 ** z
    for y in range(n):
        w, s, e, nn = tile_bounds(z, 0, y)
        if nn < LAT_RANGE[0] or s > LAT_RANGE[1]:
            continue
        for x in range(n):
            w, s, e, nn = tile_bounds(z, x, y)
            lons = [w + (e - w) * (i + 0.5) / 12 for i in range(12) for _ in range(12)]
            lats = [s + (nn - s) * (j + 0.5) / 12 for _ in range(12) for j in range(12)]
            if any(countries_at(lons, lats, nearest=False)):
                out.append((x, y))
    return out


def path_of(z: int, x: int, y: int) -> Path:
    return CACHE / str(z) / str(x) / f"{y}.pbf"


def fetch_one(z: int, x: int, y: int) -> bool:
    """下載一張；伺服器一直回 504（產生不出來）時回傳 False"""
    path = path_of(z, x, y)
    fail = path.with_suffix(".fail")
    if path.exists():
        return True
    if fail.exists():
        return False
    req = urllib.request.Request(URL.format(z=z, x=x, y=y), headers={"User-Agent": USER_AGENT})
    timeouts = 0
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = r.read()
            break
        except urllib.error.HTTPError as err:
            if err.code == 404:
                data = b""
                break
            if err.code not in (429, 500, 502, 503, 504):
                raise
            if err.code == 504:
                timeouts += 1
                if timeouts >= 1:
                    fail.parent.mkdir(parents=True, exist_ok=True)
                    fail.write_text("504")
                    return False
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(10 * (attempt + 1))
    else:
        raise RuntimeError(f"SDPT 圖磚 {z}/{x}/{y} 一直失敗")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return True


def fetch_tree(z: int, x: int, y: int) -> list[tuple[int, int, int]]:
    """這一張（產生不出來時改抓下一級的 4 張，遞迴）實際拿到的圖磚"""
    if fetch_one(z, x, y):
        return [(z, x, y)]
    if z >= MAX_ZOOM:
        print(f"    SDPT：{z}/{x}/{y} 到 {MAX_ZOOM} 級還是產生不出來，略過", flush=True)
        return []
    return [t for dx in (0, 1) for dy in (0, 1) for t in fetch_tree(z + 1, 2 * x + dx, 2 * y + dy)]


def fetch_all(z: int = ZOOM) -> list[tuple[int, int, int]]:
    """全部陸地上的圖磚（z, x, y），含改抓下一級的"""
    tiles = land_tiles(z)
    print(f"    SDPT：{len(tiles)} 張陸地上的圖磚", flush=True)
    out: list[tuple[int, int, int]] = []
    done = 0
    with ThreadPoolExecutor(PARALLEL) as pool:
        for got in pool.map(lambda t: fetch_tree(z, *t), tiles):
            out += got
            done += 1
            if done % 50 == 0:
                print(f"    SDPT：{done} / {len(tiles)}", flush=True)
    return out


if __name__ == "__main__":
    fetch_all()
