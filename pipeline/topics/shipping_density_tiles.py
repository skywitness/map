"""航運密度的網格圖磚：「航運與港口」主題的「航運密度」地圖。

- 資料：世界銀行／IMF 的 Global Shipping Traffic Density（sources/ship_density.py，CC BY 4.0），2015 年 1 月到
  2021 年 2 月的 AIS 船位數，原始 0.005°，先平均成 0.02°（每個 500 m 格子的平均 AIS 位置數）。
- Web Mercator、512 px 圖磚、z0–MAX_ZOOM。z4 的一個像素在赤道約 0.044°（約 5 km），放大由 MapLibre 拉大 z4 的圖磚。
  只做到 z4：大小（全部約 2 MB）跟 1 GB 的 GitHub Pages 上限；航道在 z4 已經看得清楚，港內的細節用港口的點。
- 像素比 0.02° 的格子大時取像素範圍內的 cos(緯度) 加權平均（含 0），比格子小時取最近的格子（跟暖化、太陽能與風能的網格一樣）。
- 對數分級：平均不到 MIN_DENSITY 的像素透明（大洋上零星的幾個船位、陸地），其餘依 THRESHOLDS 分 7 級，
  顏色是地圖的橘色循序色（tokens.ts 的 ORANGE，跟其他網格一樣直接讀）。
  主題設定（src/topics/shipping.ts 的 TRAFFIC_THRESHOLDS、TRAFFIC_MIN）要一樣，build() 會檢查。
- 只有一期（PERIOD 的最後一年 2021）；前端的 gridEpoch 一律取這一期。

重新取樣與 PNG 編碼照太陽能與風能的網格（renewables_grid_tiles.py），差別是門檻用在 log10 之後、最低一級以下透明。
圖磚不進版本控制，部署時由 GitHub Actions 產生並快取（.github/workflows/deploy.yml）。
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
import time
from pathlib import Path

import numpy as np
from affine import Affine

from common import ROOT, now_iso, write_json
from sources import ship_density
from topics.population_density_tiles import TILE, occupancy, png, png_palette, replace_dir, spans

OUT = ROOT / "public" / "tiles" / "ship-density"
MAX_ZOOM = 4
FORMAT = 1  # 圖磚的產生方式改了就加一：網址裡的版本跟著換
# 每個 500 m 格子的平均 AIS 位置數；對數分級（前端的圖例寫成 10 的次方）
TRAFFIC_MIN = 3e4
TRAFFIC_THRESHOLDS = [1e5, 3e5, 1e6, 3e6, 1e7, 3e7]
EPOCH = int(ship_density.PERIOD[1][:4])
MIN_WEIGHT = 1e-9


def ramp(n: int) -> list[str]:
    """src/theme/tokens.ts 的 ORANGE 色階（由淺到深），也就是 MAP_TOKENS.sequential（跟太陽能與風能的網格一樣）"""
    text = (ROOT / "src" / "theme" / "tokens.ts").read_text(encoding="utf-8")
    block = re.search(r"const ORANGE = \{(.*?)\}", text, re.S)
    colors = re.findall(r"'(#[0-9a-fA-F]{6})'", block.group(1)) if block else []
    if len(colors) != n:
        raise ValueError(f"tokens.ts 的 ORANGE 應有 {n} 階，讀到 {len(colors)} 階")
    return colors


def check_topic_thresholds() -> None:
    """主題設定（src/topics/shipping.ts）的門檻要跟這裡一樣"""
    text = (ROOT / "src" / "topics" / "shipping.ts").read_text(encoding="utf-8")
    found = re.search(r"TRAFFIC_THRESHOLDS\s*=\s*\[([^\]]*)\]", text)
    values = [float(v) for v in found.group(1).split(",") if v.strip()] if found else None
    found_min = re.search(r"TRAFFIC_MIN\s*=\s*([0-9.e+]+)", text)
    if values != TRAFFIC_THRESHOLDS or not found_min or float(found_min.group(1)) != TRAFFIC_MIN:
        raise ValueError(f"src/topics/shipping.ts 的 TRAFFIC_THRESHOLDS／TRAFFIC_MIN 跟 pipeline 的不同：{values}")


def version(palette: list[str]) -> str:
    spec = json.dumps([FORMAT, TILE, MAX_ZOOM, TRAFFIC_MIN, TRAFFIC_THRESHOLDS, palette, ship_density.URL, ship_density.FACTOR])
    return hashlib.sha256(spec.encode()).hexdigest()[:8]


def build() -> None:
    check_topic_thresholds()
    started = time.perf_counter()
    palette = ramp(len(TRAFFIC_THRESHOLDS) + 1)
    ver = version(palette)
    values, transform = ship_density.load()
    loaded = time.perf_counter() - started
    tmp = OUT.with_name(OUT.name + ".tmp")
    if tmp.exists():
        shutil.rmtree(tmp)
    tiles, size, per_zoom = render(values, transform, png_palette(palette), tmp / ver / str(EPOCH))
    write_json(
        tmp / "meta.json",
        {
            "source": "World Bank / IMF, Global Shipping Traffic Density (all vessel types), AIS positions January 2015 – "
            "February 2021, 0.005° averaged to 0.02°",
            "sourceUrl": ship_density.INFO_URL,
            "attribution": ship_density.ATTRIBUTION,
            "citation": ship_density.CITATION,
            "generatedAt": now_iso(),
            "version": ver,
            "epochs": [EPOCH],
            "tileSize": TILE,
            "maxzoom": MAX_ZOOM,
            "thresholds": TRAFFIC_THRESHOLDS,
            "minDensity": TRAFFIC_MIN,
            "colors": palette,
            "tiles": [occupancy(tiles, z) for z in range(MAX_ZOOM + 1)],
            "bytes": {str(EPOCH): size},
        },
        quiet=True,
    )
    replace_dir(tmp, OUT)
    zooms = "、".join(f"z{z} {n} 張 {b / 2**20:.2f} MB" for z, (n, b) in per_zoom.items())
    print(
        f"  {OUT.relative_to(ROOT)}：{len(tiles)} 張、{size / 2**20:.1f} MB（{zooms}），"
        f"讀資料 {loaded:.0f} 秒、共 {time.perf_counter() - started:.0f} 秒"
    )


def render(values: np.ndarray, t: Affine, pal: bytes, out: Path) -> tuple[set[tuple[int, int, int]], int, dict[int, tuple[int, int]]]:
    """0.02° 網格 → out/z/x/y.png。回傳 (寫了哪些圖磚, 總位元組, {z: (張數, 位元組)})"""
    rows, cols = values.shape
    valid = np.isfinite(values)
    lat = t.f + (np.arange(rows) + 0.5) * t.e
    w_row = np.cos(np.radians(lat)).astype(np.float32)
    weight = valid * w_row[:, None]
    weighted = np.where(valid, values, 0).astype(np.float32) * w_row[:, None]
    del valid
    log_min = math.log10(TRAFFIC_MIN)
    log_thresholds = np.log10(TRAFFIC_THRESHOLDS)

    tiles: set[tuple[int, int, int]] = set()
    size = 0
    per_zoom: dict[int, tuple[int, int]] = {}
    for z in range(MAX_ZOOM + 1):
        n = TILE << z
        y = np.arange(n + 1) / n
        edge_lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * y))))
        redges = (edge_lat - t.f) / t.e
        r0, r1 = spans(redges, rows)
        center = (redges[:-1] + redges[1:]) / 2
        inside = (center >= 0) & (center < rows)
        lon = -180 + 360 * np.arange(n + 1) / n
        c0, c1 = spans((lon - t.c) / t.a, cols)
        first = np.r_[True, (r0[1:] != r0[:-1]) | (r1[1:] != r1[:-1])]
        seg = np.cumsum(first) - 1
        s0, s1 = r0[first], r1[first]
        count = nbytes = 0
        for ty in range(1 << z):
            band = slice(ty * TILE, (ty + 1) * TILE)
            if not inside[band].any():
                continue
            image = np.zeros((TILE, n), np.uint8)
            done: dict[int, np.ndarray] = {}
            for i, (s, ok) in enumerate(zip(seg[band], inside[band])):
                if not ok:
                    continue
                if s not in done:
                    done[s] = classify_rows(weighted, weight, int(s0[s]), int(s1[s]), c0, c1, log_min, log_thresholds)
                image[i] = done[s]
            if not image.any():
                continue
            for tx in range(1 << z):
                tile = image[:, tx * TILE : (tx + 1) * TILE]
                if not tile.any():
                    continue
                data = png(np.ascontiguousarray(tile), pal)
                path = out / str(z) / str(tx) / f"{ty}.png"
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                tiles.add((z, tx, ty))
                count += 1
                nbytes += len(data)
        per_zoom[z] = (count, nbytes)
        size += nbytes
    return tiles, size, per_zoom


def classify_rows(
    weighted: np.ndarray,
    weight: np.ndarray,
    a: int,
    b: int,
    c0: np.ndarray,
    c1: np.ndarray,
    log_min: float,
    log_thresholds: np.ndarray,
) -> np.ndarray:
    """原始列 [a, b) → 一列像素的分級（0 透明，1–7 依 log10 的門檻）"""
    sv = np.concatenate(([0.0], np.cumsum(weighted[a:b].sum(axis=0, dtype=np.float64))))
    sw = np.concatenate(([0.0], np.cumsum(weight[a:b].sum(axis=0, dtype=np.float64))))
    v = sv[c1] - sv[c0]
    w = sw[c1] - sw[c0]
    with np.errstate(invalid="ignore", divide="ignore"):
        logv = np.log10(v / w)
    classes = np.searchsorted(log_thresholds, logv, side="right").astype(np.uint8) + 1
    classes[~(w > MIN_WEIGHT) | ~(logv >= log_min)] = 0
    return classes
