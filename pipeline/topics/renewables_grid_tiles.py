"""太陽能與風能潛力的網格圖磚：「太陽能與風能潛力」主題切到網格時的地圖圖層。

- 太陽能：Global Solar Atlas 2 的 PVOUT（kWh/kWp/日，sources/gsa.py），30 角秒每 2 × 2 平均成 1 角分。
- 風能：Global Wind Atlas 4.0 的 100 公尺風功率密度（W/m²，sources/gwa.py），檔案內現成的 0.02° 縮小版。
- 兩個都是長期平均，只有一期（前端的 gridEpoch 一律取這一期；主題是 timeless，沒有時間軸）。

- Web Mercator、512 px 圖磚、z0–MAX_ZOOM。z5 的一個像素在赤道約 0.022°，跟風能網格一樣大、比太陽能的 1 角分略大；
  再放大由 MapLibre 拉大 z5 的圖磚（raster-resampling: nearest，格子維持方塊）。
- 像素比格子小時取像素中心所在的格子（最近鄰）；比格子大時取像素範圍內有資料的格子的 cos(緯度) 加權平均，
  沒有資料的格子（海面、資料範圍外）不算進分母。整個像素範圍都沒有資料的是調色盤 0 號（透明）：
  太陽能的海面、北緯 65° 以北（俄羅斯大多是 60° 以北）、冰島；風能的公海（專屬經濟海域以外）、北緯 80° 以北與南極洲。
- 7 級，門檻跟國家面量圖一樣（產生時檢查 src/topics/renewables.ts 的 SOLAR_THRESHOLDS、WIND_THRESHOLDS 跟這裡一樣）；
  顏色是地圖的橘色循序色（MAP_TOKENS.sequential），從 src/theme/tokens.ts 的 ORANGE 讀。

重新取樣跟暖化網格（topics/temperature_grid_tiles.py）一樣，但格子多很多（風能 1.3 億格），不做二維累加表：
每個縮放級數把「對應到同一段原始列」的像素列合成一段，每段先把那幾列依權重加總成一列，再用一維累加算每個像素的欄範圍。
PNG 編碼、位元表與換資料夾 import 人口密度那一支（population_density_tiles.py），不修改它。
圖磚不進版本控制，部署時由 GitHub Actions 產生並快取（.github/workflows/deploy.yml）。
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass
from itertools import repeat
from pathlib import Path

import numpy as np
from affine import Affine

import common
from common import ROOT, now_iso, write_json
from sources import gsa, gwa
from topics.population_density_tiles import TILE, occupancy, png, png_palette, replace_dir, spans

# ── 分級門檻（網格與國家面量圖共用）──────────────
# 主題設定（src/topics/renewables.ts）要一樣，build() 會檢查；部署的快取鍵也含那兩行，改了門檻會重新產生圖磚。
SOLAR_THRESHOLDS = [3.0, 3.4, 3.8, 4.2, 4.6, 5.0]  # PVOUT，kWh/kWp/日（×365 約 1,100–1,830 kWh/kWp/年）
WIND_THRESHOLDS = [100, 200, 300, 400, 600, 800]  # 100 公尺的風功率密度，W/m²（200 以上參考 NREL 的風能等級）

MAX_ZOOM = 5
FORMAT = 1  # 圖磚的產生方式改了就加一：網址裡的版本跟著換
MIN_WEIGHT = 1e-9


@dataclass(frozen=True)
class Layer:
    key: str  # 'solar' | 'wind'
    out: Path
    thresholds: list[float]
    epoch: int  # 唯一的一期：長期平均的最後一年
    source: str
    source_url: str
    attribution: str
    citation: str
    data_version: str


LAYERS = [
    Layer(
        "solar",
        ROOT / "public" / "tiles" / "renewables-solar",
        SOLAR_THRESHOLDS,
        gsa.PERIOD[1],
        "Global Solar Atlas 2.0, PVOUT long-term yearly average of daily totals (kWh/kWp), 30 arc-seconds "
        "averaged to 1 arc-minute",
        gsa.INFO_URL,
        gsa.ATTRIBUTION,
        gsa.ATTRIBUTION_FULL,
        f"{gsa.NAME}|{gsa.FORMAT}",
    ),
    Layer(
        "wind",
        ROOT / "public" / "tiles" / "renewables-wind",
        WIND_THRESHOLDS,
        gwa.PERIOD[1],
        f"Global Wind Atlas {gwa.VERSION}, mean wind power density at {gwa.HEIGHT_M} m (W/m²), "
        f"0.02° overview of the 250 m grid",
        gwa.INFO_URL,
        gwa.ATTRIBUTION,
        gwa.ATTRIBUTION_FULL,
        f"{gwa.FILE_ID}|{gwa.OVERVIEW_WIDTH}",
    ),
]


def ramp(n: int) -> list[str]:
    """src/theme/tokens.ts 的 ORANGE 色階（由淺到深），也就是 MAP_TOKENS.sequential"""
    text = (ROOT / "src" / "theme" / "tokens.ts").read_text(encoding="utf-8")
    block = re.search(r"const ORANGE = \{(.*?)\}", text, re.S)
    colors = re.findall(r"'(#[0-9a-fA-F]{6})'", block.group(1)) if block else []
    if len(colors) != n:
        raise ValueError(f"tokens.ts 的 ORANGE 應有 {n} 階，讀到 {len(colors)} 階")
    return colors


def check_topic_thresholds() -> None:
    """主題設定（src/topics/renewables.ts）的門檻要跟這裡一樣，否則網格與國家平均的顏色對不起來"""
    text = (ROOT / "src" / "topics" / "renewables.ts").read_text(encoding="utf-8")
    for name, expected in (("SOLAR_THRESHOLDS", SOLAR_THRESHOLDS), ("WIND_THRESHOLDS", WIND_THRESHOLDS)):
        found = re.search(rf"{name}\s*=\s*\[([^\]]*)\]", text)
        values = [float(v) for v in found.group(1).split(",") if v.strip()] if found else None
        if values != [float(v) for v in expected]:
            raise ValueError(f"src/topics/renewables.ts 的 {name} {values} 跟 pipeline 的 {expected} 不同")


def version(layer: Layer, palette: list[str]) -> str:
    spec = json.dumps([FORMAT, TILE, MAX_ZOOM, layer.thresholds, palette, layer.data_version, layer.epoch])
    return hashlib.sha256(spec.encode()).hexdigest()[:8]


def build() -> None:
    check_topic_thresholds()
    started = time.perf_counter()
    # 兩層各一個行程：各自下載、讀資料（風能約 1.3 億格、太陽能約 1.6 億格，各約 2 GB 記憶體）
    with ProcessPoolExecutor(max_workers=len(LAYERS)) as pool:
        for line in pool.map(build_layer, [layer.key for layer in LAYERS], repeat(common.REFRESH)):
            print(line)
    print(f"  共 {time.perf_counter() - started:.0f} 秒")


def load(key: str) -> tuple[np.ndarray, Affine]:
    grid = gsa.load() if key == "solar" else gwa.load()
    return grid.values, grid.transform


def build_layer(key: str, refresh: bool = False) -> str:
    common.REFRESH = refresh  # Windows 的子行程是重新 import 的，不會繼承 run.py 設的 --refresh
    layer = next(lv for lv in LAYERS if lv.key == key)
    started = time.perf_counter()
    palette = ramp(len(layer.thresholds) + 1)
    ver = version(layer, palette)
    values, transform = load(key)
    loaded = time.perf_counter() - started

    tmp = layer.out.with_name(layer.out.name + ".tmp")
    if tmp.exists():
        shutil.rmtree(tmp)
    tiles, size, per_zoom = render(values, transform, layer.thresholds, png_palette(palette), tmp / ver / str(layer.epoch))
    write_json(
        tmp / "meta.json",
        {
            "source": layer.source,
            "sourceUrl": layer.source_url,
            "attribution": layer.attribution,
            "citation": layer.citation,
            "generatedAt": now_iso(),
            "version": ver,
            "epochs": [layer.epoch],
            "tileSize": TILE,
            "maxzoom": MAX_ZOOM,
            "thresholds": layer.thresholds,
            "colors": palette,
            "tiles": [occupancy(tiles, z) for z in range(MAX_ZOOM + 1)],
            "bytes": {str(layer.epoch): size},
        },
        quiet=True,
    )
    replace_dir(tmp, layer.out)
    zooms = "、".join(f"z{z} {n} 張 {b / 2**20:.1f} MB" for z, (n, b) in per_zoom.items())
    return (
        f"  {layer.out.relative_to(ROOT)}：{len(tiles)} 張、{size / 2**20:.1f} MB（{zooms}），"
        f"讀資料 {loaded:.0f} 秒、共 {time.perf_counter() - started:.0f} 秒"
    )


def render(
    values: np.ndarray, t: Affine, thresholds: list[float], pal: bytes, out: Path
) -> tuple[set[tuple[int, int, int]], int, dict[int, tuple[int, int]]]:
    """網格 → out/z/x/y.png。回傳 (寫了哪些圖磚, 總位元組, {z: (張數, 位元組)})"""
    rows, cols = values.shape
    valid = np.isfinite(values)
    lat = t.f + (np.arange(rows) + 0.5) * t.e
    w_row = np.cos(np.radians(lat)).astype(np.float32)
    weight = valid * w_row[:, None]  # float32
    weighted = np.where(valid, values, 0).astype(np.float32) * w_row[:, None]
    del valid

    tiles: set[tuple[int, int, int]] = set()
    size = 0
    per_zoom: dict[int, tuple[int, int]] = {}
    for z in range(MAX_ZOOM + 1):
        n = TILE << z
        y = np.arange(n + 1) / n
        edge_lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * y))))
        redges = (edge_lat - t.f) / t.e
        r0, r1 = spans(redges, rows)
        # 像素中心在資料範圍（列）以外的透明：spans() 會把它夾到最邊的一列
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
                    done[s] = classify_rows(weighted, weight, int(s0[s]), int(s1[s]), c0, c1, thresholds)
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
    weighted: np.ndarray, weight: np.ndarray, a: int, b: int, c0: np.ndarray, c1: np.ndarray, thresholds: list[float]
) -> np.ndarray:
    """原始列 [a, b) → 一列像素的分級（0 透明，1–7 依 thresholds）"""
    sv = np.concatenate(([0.0], np.cumsum(weighted[a:b].sum(axis=0, dtype=np.float64))))
    sw = np.concatenate(([0.0], np.cumsum(weight[a:b].sum(axis=0, dtype=np.float64))))
    v = sv[c1] - sv[c0]
    w = sw[c1] - sw[c0]
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = v / w
    classes = np.searchsorted(thresholds, mean, side="right").astype(np.uint8) + 1
    classes[~(w > MIN_WEIGHT)] = 0
    return classes
