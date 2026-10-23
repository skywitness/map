"""人口密度的 1 km 網格圖磚：人口主題「人口密度」切到「1 km 網格」時的地圖圖層。

JRC GHS-POP R2023A 的 30 角秒網格（赤道約 0.93 km）：每格人數 ÷ 這一格在球面上的真實面積
= 每 km² 人數，依固定的對數分級上色，切成 Web Mercator 的 512 px PNG 圖磚（z0–MAX_ZOOM）。

- z7 的一個像素是 19.8 角秒，比原始網格細：每個像素直接取所在的那一格（最近鄰），所以是完整解析度；
  再放大由 MapLibre 拉大 z7 的圖磚（raster-resampling: nearest，格子維持方塊）。
- 縮小時一個像素涵蓋好幾格：像素範圍內的總人數 ÷ 總面積（含海洋與無人居住的格子），也就是那個範圍的平均密度。
- 每 km² 不到 MIN_DENSITY 人的像素透明，透出底圖（見 MIN_DENSITY 的說明）。
- 色階是地圖的橘色循序色，直接從 src/theme/tokens.ts 的 ORANGE 讀，顏色只有一個來源。

圖磚每期約 5 千張，不進版本控制：輸出到 public/tiles/（在 .gitignore 裡），部署時由 GitHub Actions
產生並快取（.github/workflows/deploy.yml）。前端讀 meta.json 得知有哪幾期、分級門檻與哪些圖磚有內容。
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import shutil
import struct
import time
import zlib
from collections.abc import Iterator
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from itertools import repeat
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine
from rasterio.windows import Window

from common import ROOT, now_iso, write_json
from sources import ghsl

OUT = ROOT / "public" / "tiles" / "population-density"
TILE = 512  # MapLibre 的縮放級數以 512 px 為準：z7 的圖磚剛好在地圖縮放 7 時一比一顯示
MAX_ZOOM = 7
# 分級門檻（人/km²），對數間距；7 級剛好對應 7 階的橘色循序色
THRESHOLDS = [1, 10, 50, 250, 1000, 5000]
# GHS-POP 把普查區的人口依建成區分配到格子，沒有建成區的普查區會平均攤到整區，沙漠、凍原上出現大片
# 每 km² 只有零點零幾人的格子。這些在地圖上視為無人居住（透明），否則整片撒哈拉、西伯利亞都會上色。
MIN_DENSITY = 0.1
EPOCHS = ghsl.EPOCHS  # 全部 12 期（1975–2030），前端依時間軸挑一期
FORMAT = 1  # 圖磚的產生方式改了就加一：網址裡的版本跟著換，瀏覽器與 service worker 不會拿到舊圖磚
EARTH_RADIUS_KM = 6371.0088
READ_ROWS = 256  # 原始檔的區塊高度
JOBS = 4  # 同時處理幾期（GitHub Actions 的機器是 4 核心、16 GB）
# 讀完一期就刪掉下載的 zip 與解壓的 GeoTIFF（部署時用，12 期全部留著要 10 GB）
PRUNE = os.environ.get("GHSL_PRUNE") == "1"


def ramp() -> list[str]:
    """src/theme/tokens.ts 的 ORANGE 色階（由淺到深）"""
    text = (ROOT / "src" / "theme" / "tokens.ts").read_text(encoding="utf-8")
    block = re.search(r"const ORANGE = \{(.*?)\}", text, re.S)
    colors = re.findall(r"'(#[0-9a-fA-F]{6})'", block.group(1)) if block else []
    if len(colors) != len(THRESHOLDS) + 1:
        raise ValueError(f"tokens.ts 的 ORANGE 應有 {len(THRESHOLDS) + 1} 階，讀到 {len(colors)} 階")
    return colors


def version(colors: list[str]) -> str:
    spec = json.dumps([FORMAT, TILE, MAX_ZOOM, THRESHOLDS, MIN_DENSITY, colors])
    return hashlib.sha256(spec.encode()).hexdigest()[:8]


def build() -> None:
    colors = ramp()
    ver = version(colors)
    # 先寫到暫存資料夾，全部成功才換掉舊的：部署時下載失敗，快取裡上一版的圖磚還在（見 deploy.yml）
    tmp = OUT.with_name(OUT.name + ".tmp")
    if tmp.exists():
        shutil.rmtree(tmp)
    occupied: set[tuple[int, int, int]] = set()
    written: dict[int, set[tuple[int, int, int]]] = {}
    sizes: dict[int, int] = {}
    # 每一期各自下載、讀一次原始檔，幾期同時跑（每個行程約 0.5 GB 記憶體）
    with ProcessPoolExecutor(max_workers=min(JOBS, len(EPOCHS))) as pool:
        for epoch, tiles, size in pool.map(render_epoch, EPOCHS, repeat(tmp / ver), repeat(colors)):
            written[epoch], sizes[epoch] = tiles, size
            occupied |= tiles

    # 前端只請求「任何一期有內容」的圖磚；某一期剛好沒有內容的補一張透明圖磚，不必分期記錄
    empty = png(np.zeros((TILE, TILE), np.uint8), png_palette(colors))
    for epoch in EPOCHS:
        for z, x, y in occupied - written[epoch]:
            path = tmp / ver / str(epoch) / str(z) / str(x) / f"{y}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(empty)
            sizes[epoch] += len(empty)

    write_json(
        tmp / "meta.json",
        {
            "source": "JRC GHS-POP R2023A, 30 arc-seconds",
            "sourceUrl": "https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php",
            "citation": ghsl.CITATION,
            "generatedAt": now_iso(),
            "version": ver,
            "epochs": EPOCHS,
            "projectionFrom": ghsl.PROJECTION_FROM,
            "tileSize": TILE,
            "maxzoom": MAX_ZOOM,
            "thresholds": THRESHOLDS,
            "minDensity": MIN_DENSITY,
            "colors": colors,
            # 有內容的圖磚：每個縮放級數一串位元（第 y × 2^z + x 個位元），base64
            "tiles": [occupancy(occupied, z) for z in range(MAX_ZOOM + 1)],
            "bytes": {str(e): sizes[e] for e in EPOCHS},
        },
        quiet=True,
    )
    replace_dir(tmp, OUT)
    print(f"  輸出 {OUT.relative_to(ROOT)}：{len(occupied)} 個圖磚位置 × {len(EPOCHS)} 期，{sum(sizes.values()) / 2**20:.0f} MB")


def replace_dir(src: Path, dst: Path) -> None:
    """用 src 取代 dst。Windows 上資料夾被監看時（例如開著 Vite 開發伺服器）改名會被拒絕，改成複製。"""
    if dst.exists():
        shutil.rmtree(dst)
    try:
        src.rename(dst)
    except PermissionError:
        shutil.copytree(src, dst)
        shutil.rmtree(src, ignore_errors=True)


def render_epoch(epoch: int, out: Path, colors: list[str]) -> tuple[int, set[tuple[int, int, int]], int]:
    """一期的圖磚寫到 out/<epoch>/z/x/y.png，回傳 (epoch, 寫了哪些圖磚, 總位元組)"""
    started = time.perf_counter()
    tif = ghsl.raster_path(epoch)
    palette = png_palette(colors)
    tiles: set[tuple[int, int, int]] = set()
    size = 0
    for z, x, y, classes in render(tif):
        data = png(classes, palette)
        path = out / str(epoch) / str(z) / str(x) / f"{y}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        tiles.add((z, x, y))
        size += len(data)
    if PRUNE:
        tif.unlink()
        tif.with_suffix(".zip").unlink(missing_ok=True)
    print(f"  {epoch}：{len(tiles)} 張、{size / 2**20:.1f} MB，{time.perf_counter() - started:.0f} 秒", flush=True)
    return epoch, tiles, size


def occupancy(tiles: set[tuple[int, int, int]], z: int) -> str:
    n = 1 << z
    bits = np.zeros(n * n, np.uint8)
    for tz, x, y in tiles:
        if tz == z:
            bits[y * n + x] = 1
    return base64.b64encode(np.packbits(bits, bitorder="little").tobytes()).decode()


# ── 重新取樣：原始網格（經緯度）→ Web Mercator 像素 ─────────────────


def spans(edges: np.ndarray, limit: int) -> tuple[np.ndarray, np.ndarray]:
    """像素的邊界（以原始格為單位的分數位置）→ 每個像素涵蓋的原始格範圍 [lo, hi)。

    像素比原始格大時取邊界四捨五入之間的格子（相鄰像素剛好接上、不重複）；
    比原始格小時取像素中心所在的那一格（最近鄰）。
    """
    lo = np.rint(edges[:-1]).astype(np.int64)
    hi = np.rint(edges[1:]).astype(np.int64)
    center = np.floor((edges[:-1] + edges[1:]) / 2).astype(np.int64)
    thin = hi <= lo
    lo[thin] = center[thin]
    hi[thin] = center[thin] + 1
    lo = np.maximum.accumulate(np.clip(lo, 0, limit - 1))
    hi = np.maximum.accumulate(np.clip(hi, 1, limit))
    return lo, np.maximum(hi, lo + 1)


@dataclass
class Level:
    """一個縮放級數的重新取樣狀態。原始檔由北往南一個區塊一個區塊讀進來，湊滿一整排圖磚就輸出。

    像素列對應的原始列範圍相同的（放大時好幾列像素取同一列原始格）合成一「段」，每段只算一次。
    """

    z: int
    span: np.ndarray  # 每一列像素屬於第幾段
    r0: np.ndarray  # 每一段的原始列範圍 [r0, r1)
    r1: np.ndarray
    c0: np.ndarray  # 每一欄像素的原始欄範圍 [c0, c1)
    c1: np.ndarray
    pending: dict[int, list] = field(default_factory=dict)  # 還沒讀完的段：[每欄人數加總, 每格面積加總]
    rows: dict[int, np.ndarray] = field(default_factory=dict)  # 算好的段：一列像素的分級
    finished: int = 0  # 第 0 到 finished−1 段已經算好
    done: int = 0  # 已經輸出的圖磚排數

    @classmethod
    def create(cls, z: int, t: Affine, height: int, width: int) -> Level:
        n = TILE << z
        y = np.arange(n + 1) / n
        lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * y))))
        r0, r1 = spans((lat - t.f) / t.e, height)
        lon = -180 + 360 * np.arange(n + 1) / n
        c0, c1 = spans((lon - t.c) / t.a, width)
        first = np.r_[True, (r0[1:] != r0[:-1]) | (r1[1:] != r1[:-1])]
        return cls(z, np.cumsum(first) - 1, r0[first], r1[first], c0, c1)

    def feed(self, pop: np.ndarray, area: np.ndarray, b0: int) -> Iterator[tuple[int, int, int, np.ndarray]]:
        """讀進原始檔的第 b0 列起的一個區塊（pop：人數，area：每一列一格的面積 km²）"""
        b1 = b0 + len(pop)
        lo = int(np.searchsorted(self.r1, b0, side="right"))
        hi = int(np.searchsorted(self.r0, b1, side="left"))
        for s in range(lo, hi):
            a, b = max(int(self.r0[s]), b0) - b0, min(int(self.r1[s]), b1) - b0
            people = pop[a] if b - a == 1 else pop[a:b].sum(axis=0)
            if s in self.pending:
                self.pending[s][0] += people
                self.pending[s][1] += float(area[a:b].sum())
            else:
                self.pending[s] = [people.astype(np.float64), float(area[a:b].sum())]
            if self.r1[s] <= b1:
                self.rows[s] = self.classify(*self.pending.pop(s))
                self.finished = s + 1
        yield from self.emit()

    def classify(self, people: np.ndarray, cell_km2: float) -> np.ndarray:
        """一段原始列 → 一列像素的分級（0 透明，1–7 依 THRESHOLDS）"""
        cum = np.concatenate(([0.0], np.cumsum(people)))
        density = (cum[self.c1] - cum[self.c0]) / (cell_km2 * (self.c1 - self.c0))
        classes = np.searchsorted(THRESHOLDS, density, side="right").astype(np.uint8) + 1
        classes[density < MIN_DENSITY] = 0
        return classes

    def emit(self) -> Iterator[tuple[int, int, int, np.ndarray]]:
        n = 1 << self.z
        while self.done < n and self.span[(self.done + 1) * TILE - 1] < self.finished:
            top = self.done * TILE
            image = np.stack([self.rows[s] for s in self.span[top : top + TILE]])
            nxt = self.span[top + TILE] if top + TILE < len(self.span) else self.finished
            for s in [s for s in self.rows if s < nxt]:
                del self.rows[s]
            for x in range(n):
                tile = image[:, x * TILE : (x + 1) * TILE]
                if tile.any():
                    yield self.z, x, self.done, np.ascontiguousarray(tile)
            self.done += 1


def render(tif: Path) -> Iterator[tuple[int, int, int, np.ndarray]]:
    """一期的所有圖磚 (z, x, y, 分級)；整排都透明的圖磚不輸出。原始檔只讀一次，所有級數一起算。"""
    with rasterio.open(tif) as src:
        t = src.transform
        levels = [Level.create(z, t, src.height, src.width) for z in range(MAX_ZOOM + 1)]
        start = min(int(lv.r0[0]) for lv in levels) // READ_ROWS * READ_ROWS
        end = max(int(lv.r1[-1]) for lv in levels)
        for b0 in range(start, end, READ_ROWS):
            h = min(READ_ROWS, end - b0)
            pop = src.read(1, window=Window(0, b0, src.width, h))
            pop[~np.isfinite(pop) | (pop < 0)] = 0
            # 一格的球面面積：R² × 經度寬 × (sin 北緣 − sin 南緣)
            north = np.radians(t.f + np.arange(b0, b0 + h) * t.e)
            area = EARTH_RADIUS_KM**2 * np.radians(t.a) * (np.sin(north) - np.sin(north + np.radians(t.e)))
            for lv in levels:
                yield from lv.feed(pop, area, b0)
        for lv in levels:
            assert lv.done == 1 << lv.z, f"z{lv.z} 只輸出 {lv.done} 排圖磚"


# ── PNG：調色盤模式、每像素 4 位元，0 號是透明 ─────────────────────


def png_palette(colors: list[str]) -> bytes:
    return bytes([0, 0, 0] + [int(c[i : i + 2], 16) for c in colors for i in (1, 3, 5)])


def png(classes: np.ndarray, palette: bytes) -> bytes:
    h, w = classes.shape
    packed = (classes[:, 0::2] << 4) | classes[:, 1::2]
    raw = np.hstack([np.zeros((h, 1), np.uint8), packed]).tobytes()  # 每列開頭是濾波方式 0（不濾波）

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 4, 3, 0, 0, 0)),
            chunk(b"PLTE", palette),
            chunk(b"tRNS", b"\x00"),  # 只有 0 號透明，其餘不透明
            chunk(b"IDAT", zlib.compress(raw, 9)),
            chunk(b"IEND", b""),
        ]
    )
