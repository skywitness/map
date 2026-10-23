"""暖化的 0.5° 網格圖磚：氣溫與降雨主題「暖化」切到「0.5° 網格」時的地圖圖層。

CRU TS 的 0.5° 月均溫（sources/cru.py），每個陸地格子各自算「近 10 年平均 − 1951–1980 年平均」，
跟國家指標（topics/temperature.py）同一個定義、同一組門檻；每一年一期（1910–最新一年），
前端挑時間軸那一年以前最近的一期。

- Web Mercator、512 px 圖磚、z0–MAX_ZOOM。z4 的一個 0.5° 格子在赤道約 11 px 寬；再放大由 MapLibre 拉大
  z4 的圖磚（raster-resampling: nearest，格子維持方塊）。
- 放大時（像素比格子小）取像素中心所在的格子（最近鄰）；縮小時（z0 一個像素約 0.7°）取像素範圍內
  陸地格子的面積加權平均（cos 緯度），海洋不算進分母。實際上只有 z0 會平均，z1 起都是最近鄰。
- 海洋、南極洲（CRU 沒有資料）是調色盤 0 號（透明）。
- 顏色是地圖的發散色反過來（負值青綠、正值橘，跟國家指標的 reverse: true 一樣），直接從 src/theme/tokens.ts 讀。

重新取樣、PNG 編碼、位元表與換資料夾都沿用人口密度 1 km 網格的程式（topics/population_density_tiles.py），
那支只 import、不修改（改了會讓部署時重新產生人口的圖磚）。圖磚不進版本控制，部署時由 GitHub Actions 產生。
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import time
from concurrent.futures import ProcessPoolExecutor
from itertools import repeat
from pathlib import Path

import numpy as np
from affine import Affine

from common import ROOT, now_iso, write_json
from sources import cru
from topics.population_density_tiles import TILE, occupancy, png, png_palette, replace_dir, spans

# ── 暖化的定義：國家指標（topics/temperature.py）也從這裡 import ──────────────
# 放在這一支而不是 temperature.py：部署時只跑這一支（GitHub Actions 只裝 numpy、rasterio，temperature.py 要的
# 國界程式還需要 pycountry），快取鍵也只看這一支，門檻改了才會重新產生圖磚。
BASE_PERIOD = (1951, 1980)  # 基準期：CRU TS 早期測站稀少的地方填氣候平均值，1901–1930 當基準會低估暖化
WINDOW = 10  # 近幾年的平均
# 分級門檻（°C），國家平均與網格共用；主題設定（src/topics/temperature.ts）要一樣，build() 會檢查
WARMING_THRESHOLDS = [-2, -1, -0.3, 0.3, 1, 2]


def warming_series(annual: np.ndarray, years: list[int]) -> np.ndarray:
    """(年, n) 的年均溫 → (年 − WINDOW + 1, n) 的暖化：近 WINDOW 年平均 − BASE_PERIOD 平均"""
    i0, i1 = years.index(BASE_PERIOD[0]), years.index(BASE_PERIOD[1]) + 1
    base = annual[i0:i1].mean(axis=0)
    cum = np.vstack([np.zeros((1, annual.shape[1])), np.cumsum(annual, axis=0, dtype=np.float64)])
    return (cum[WINDOW:] - cum[:-WINDOW]) / WINDOW - base


OUT = ROOT / "public" / "tiles" / "warming"
MAX_ZOOM = 4
FORMAT = 1  # 圖磚的產生方式改了就加一：網址裡的版本跟著換
JOBS = 4
# 累加表相減會留下 1e-12 左右的誤差，權重比這個小的當成沒有陸地格子（一個格子最小的權重是 cos 89.75° ≈ 0.004）
MIN_WEIGHT = 1e-6


def colors() -> list[str]:
    """MAP_TOKENS.diverging（由負到正：橘 → 灰 → 青綠）反過來：負值青綠、正值橘"""
    text = (ROOT / "src" / "theme" / "tokens.ts").read_text(encoding="utf-8")
    hues = {}
    for name in ("ORANGE", "AQUA"):
        block = re.search(rf"const {name} = \{{(.*?)\}}", text, re.S)
        if not block:
            raise ValueError(f"tokens.ts 找不到 {name}")
        hues[name] = dict(re.findall(r"(\d+):\s*'(#[0-9a-fA-F]{6})'", block.group(1)))
    block = re.search(r"export const MAP_TOKENS\b.*?\n\};", text, re.S)
    # 這一行裡有 ORANGE[600] 這種中括號，取第一個 [ 到最後一個 ] 之間
    line = re.search(r"^\s*diverging:\s*\[(.*)\],?\s*$", block.group(0) if block else "", re.M)
    if not line:
        raise ValueError("tokens.ts 的 MAP_TOKENS 找不到 diverging")
    out = []
    for item in [s.strip() for s in line.group(1).split(",") if s.strip()]:
        ref = re.fullmatch(r"(ORANGE|AQUA)\[(\d+)\]", item)
        literal = re.fullmatch(r"'(#[0-9a-fA-F]{6})'", item)
        if ref:
            out.append(hues[ref.group(1)][ref.group(2)])
        elif literal:
            out.append(literal.group(1))
        else:
            raise ValueError(f"tokens.ts 的 MAP_TOKENS.diverging 有看不懂的顏色：{item}")
    if len(out) != len(WARMING_THRESHOLDS) + 1:
        raise ValueError(f"MAP_TOKENS.diverging 應有 {len(WARMING_THRESHOLDS) + 1} 色，讀到 {len(out)} 色")
    return out[::-1]


def check_topic_thresholds() -> None:
    """主題設定（src/topics/temperature.ts）的暖化門檻要跟這裡一樣，否則網格與國家平均的顏色對不起來"""
    text = (ROOT / "src" / "topics" / "temperature.ts").read_text(encoding="utf-8")
    found = re.search(r"WARMING_THRESHOLDS\s*=\s*\[([^\]]*)\]", text)
    values = [float(v) for v in found.group(1).split(",") if v.strip()] if found else None
    if values != WARMING_THRESHOLDS:
        raise ValueError(f"src/topics/temperature.ts 的 WARMING_THRESHOLDS {values} 跟 pipeline 的 {WARMING_THRESHOLDS} 不同")


def version(palette: list[str]) -> str:
    spec = json.dumps([FORMAT, TILE, MAX_ZOOM, WARMING_THRESHOLDS, palette, cru.VERSION, BASE_PERIOD, WINDOW])
    return hashlib.sha256(spec.encode()).hexdigest()[:8]


def build() -> None:
    check_topic_thresholds()
    palette = colors()
    ver = version(palette)
    started = time.perf_counter()
    grid = cru.load("tmp")
    years = grid.years
    annual = cru.annual_mean(grid)  # (年, 陸地格)
    warming = warming_series(annual, years).astype(np.float32)  # (期, 陸地格)
    epochs = years[WINDOW - 1 :]
    rows, cols = np.nonzero(grid.mask)
    print(f"  CRU TS {cru.VERSION}：{grid.mask.sum():,} 個陸地格子，{len(epochs)} 期（{epochs[0]}–{epochs[-1]}）")

    tmp = OUT.with_name(OUT.name + ".tmp")
    if tmp.exists():
        shutil.rmtree(tmp)
    occupied: set[tuple[int, int, int]] = set()
    written: dict[int, set[tuple[int, int, int]]] = {}
    sizes: dict[int, int] = {}
    grids = []
    for i in range(len(epochs)):
        g = np.full((cru.ROWS, cru.COLS), np.nan, np.float32)
        g[rows, cols] = warming[i]
        grids.append(g)
    with ProcessPoolExecutor(max_workers=JOBS) as pool:
        for epoch, tiles, size in pool.map(render_epoch, epochs, grids, repeat(tmp / ver), repeat(palette), chunksize=4):
            written[epoch], sizes[epoch] = tiles, size
            occupied |= tiles

    empty = png(np.zeros((TILE, TILE), np.uint8), png_palette(palette))
    for epoch in epochs:
        for z, x, y in occupied - written[epoch]:
            path = tmp / ver / str(epoch) / str(z) / str(x) / f"{y}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(empty)
            sizes[epoch] += len(empty)

    write_json(
        tmp / "meta.json",
        {
            "source": f"CRU TS v{cru.VERSION}, 0.5° monthly mean temperature; "
            f"{WINDOW}-year mean minus {BASE_PERIOD[0]}–{BASE_PERIOD[1]} mean",
            "sourceUrl": cru.INFO_URL,
            "attribution": cru.ATTRIBUTION,
            "citation": cru.CITATION,
            "generatedAt": now_iso(),
            "version": ver,
            "epochs": epochs,
            "tileSize": TILE,
            "maxzoom": MAX_ZOOM,
            "thresholds": WARMING_THRESHOLDS,
            "colors": palette,
            "tiles": [occupancy(occupied, z) for z in range(MAX_ZOOM + 1)],
            "bytes": {str(e): sizes[e] for e in epochs},
        },
        quiet=True,
    )
    replace_dir(tmp, OUT)
    total = sum(sizes.values())
    print(
        f"  輸出 {OUT.relative_to(ROOT)}：{len(occupied)} 個圖磚位置 × {len(epochs)} 期 = {len(occupied) * len(epochs):,} 張，"
        f"{total / 2**20:.1f} MB，{time.perf_counter() - started:.0f} 秒"
    )


# ── 一期：0.5° 網格 → 各縮放級數的圖磚 ─────────────────────────


def levels() -> list[tuple[int, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]]:
    """每個縮放級數：(z, 每列像素屬於第幾段, 每段的列範圍 r0/r1, 每欄像素屬於第幾段, 每段的欄範圍 c0/c1)。

    像素對應到同一段格子範圍的（放大時好幾個像素取同一格）合成一段，每段只算一次。
    """
    t = Affine(cru.CELL, 0, -180, 0, -cru.CELL, 90)
    out = []
    for z in range(MAX_ZOOM + 1):
        n = TILE << z
        y = np.arange(n + 1) / n
        lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * y))))
        r0, r1 = spans((lat - t.f) / t.e, cru.ROWS)
        lon = -180 + 360 * np.arange(n + 1) / n
        c0, c1 = spans((lon - t.c) / t.a, cru.COLS)
        out.append((z, *segments(r0, r1), *segments(c0, c1)))
    return out


def segments(lo: np.ndarray, hi: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    first = np.r_[True, (lo[1:] != lo[:-1]) | (hi[1:] != hi[:-1])]
    return np.cumsum(first) - 1, lo[first], hi[first]


def classify(value: np.ndarray, weight: np.ndarray) -> np.ndarray:
    """0 透明（沒有陸地格子），1–7 依 WARMING_THRESHOLDS"""
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = value / weight
    classes = np.searchsorted(WARMING_THRESHOLDS, mean, side="right").astype(np.uint8) + 1
    classes[~(weight > MIN_WEIGHT)] = 0
    return classes


def render_epoch(epoch: int, grid: np.ndarray, out: Path, palette: list[str]) -> tuple[int, set[tuple[int, int, int]], int]:
    """一期的圖磚寫到 out/<epoch>/z/x/y.png，回傳 (epoch, 寫了哪些圖磚, 總位元組)"""
    lat = 90 - (np.arange(cru.ROWS) + 0.5) * cru.CELL
    valid = np.isfinite(grid)
    weight = np.where(valid, np.cos(np.radians(lat))[:, None], 0.0)
    value = np.where(valid, grid, 0.0) * weight
    # 二維累加表：任一個格子範圍的加總 = 四個角相減
    sw = np.zeros((cru.ROWS + 1, cru.COLS + 1))
    sv = np.zeros((cru.ROWS + 1, cru.COLS + 1))
    sw[1:, 1:] = weight.cumsum(0).cumsum(1)
    sv[1:, 1:] = value.cumsum(0).cumsum(1)

    def box(s: np.ndarray, r0, r1, c0, c1) -> np.ndarray:
        return s[np.ix_(r1, c1)] - s[np.ix_(r0, c1)] - s[np.ix_(r1, c0)] + s[np.ix_(r0, c0)]

    pal = png_palette(palette)
    tiles: set[tuple[int, int, int]] = set()
    size = 0
    for z, rseg, r0, r1, cseg, c0, c1 in LEVELS:
        classes = classify(box(sv, r0, r1, c0, c1), box(sw, r0, r1, c0, c1))
        n = 1 << z
        for ty in range(n):
            band = classes[rseg[ty * TILE : (ty + 1) * TILE]]
            if not band.any():
                continue
            for tx in range(n):
                tile = band[:, cseg[tx * TILE : (tx + 1) * TILE]]
                if not tile.any():
                    continue
                data = png(np.ascontiguousarray(tile), pal)
                path = out / str(epoch) / str(z) / str(tx) / f"{ty}.png"
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                tiles.add((z, tx, ty))
                size += len(data)
    return epoch, tiles, size


LEVELS = levels()
