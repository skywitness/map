"""夜間燈光的網格圖磚：「夜間燈光」主題的「平均亮度」切到網格時的地圖圖層。

EOG 的 Annual VNL V2（average_masked，sources/vnl.py）15 角秒網格（赤道約 460 m）：每格的年平均輻射亮度
（nW/cm²/sr），依固定的對數分級上色，切成 Web Mercator 的 512 px PNG 圖磚（z0–MAX_ZOOM）。

- z7 的一個像素是 19.8 角秒，比原始網格（15 角秒）略粗；像素比格子大時取像素範圍內的面積加權平均
  （沒有燈光的格子算 0、一起平均），所以縮小時是「那一帶」的平均亮度：城市還在，鄉間的路燈、漁船會淡掉。
  再放大由 MapLibre 拉大 z7 的圖磚（raster-resampling: nearest）。
- 第一級（平均不到 THRESHOLDS[0]，也就是沒有燈光）是透明的：前端在網格底下鋪一層同色的夜色（meta.json 的
  backdrop，緯度範圍 vnl.LAT_RANGE），所以預設的彩色地形底圖上也是一張夜景，燈光由暗到亮是深褐、橘、黃到近白。
  資料範圍外（北緯 75° 以北、南緯 62° 以南）沒有夜色，透出底圖。
- 7 級，門檻跟國家面量圖一樣（產生時檢查 src/topics/night-lights.ts 的 LIGHT_THRESHOLDS）；顏色是 tokens.ts 的 NIGHT。
- 只做 EPOCHS 這幾年（每期約 3–4 千張、約 30 MB），GitHub Pages 的 1 GB 上限裡人口的 1 km 網格已經占約 585 MB。

重新取樣（逐列區塊讀取、所有級數一起算）、PNG 編碼、位元表與換資料夾 import 人口密度那一支（population_density_tiles.py），
不修改它：把「每格的亮度 × 面積」當成人數餵給它的 Level，「人數 ÷ 面積」就是面積加權的平均亮度。
圖磚不進版本控制，部署時由 GitHub Actions 產生並快取（.github/workflows/deploy.yml）。
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import time
from collections.abc import Iterator
from concurrent.futures import ProcessPoolExecutor
from itertools import repeat
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

import common
from common import ROOT, now_iso, write_json
from sources import vnl
from topics.population_density_tiles import TILE, Level, occupancy, png, png_palette, replace_dir

OUT = ROOT / "public" / "tiles" / "night-lights"
# 分級門檻（nW/cm²/sr），國家平均與網格共用：src/topics/night-lights.ts 的 LIGHT_THRESHOLDS 要一樣，build() 會檢查；
# 部署的快取鍵也含那一行
THRESHOLDS = [0.1, 0.3, 1, 3, 10, 30]
EPOCHS = [2013, 2017, 2020, 2024]  # 2017 年起跟之前不完全可比（night_lights.py 的 METHOD_BREAK），所以有一期從 2017 年開始
MAX_ZOOM = 7
FORMAT = 1  # 圖磚的產生方式改了就加一：網址裡的版本跟著換
EARTH_RADIUS_KM = 6371.0088
READ_ROWS = 512  # COG 的圖塊是 512 × 512，一次讀一整排
JOBS = 4  # 同時處理幾期（GitHub Actions 的機器是 4 核心、16 GB；每個行程約 1 GB）
# 讀完一期就刪掉下載的 GeoTIFF（部署時用）
PRUNE = os.environ.get("VNL_PRUNE") == "1"


def ramp() -> list[str]:
    """src/theme/tokens.ts 的 NIGHT（夜色加 6 級燈光，由暗到亮）"""
    text = (ROOT / "src" / "theme" / "tokens.ts").read_text(encoding="utf-8")
    block = re.search(r"const NIGHT = \{(.*?)\}", text, re.S)
    colors = re.findall(r"'(#[0-9a-fA-F]{6})'", block.group(1)) if block else []
    if len(colors) != len(THRESHOLDS) + 1:
        raise ValueError(f"tokens.ts 的 NIGHT 應有 {len(THRESHOLDS) + 1} 色，讀到 {len(colors)} 色")
    return colors


def check_topic_thresholds() -> None:
    """主題設定的門檻要跟這裡一樣，否則網格與國家平均的顏色對不起來"""
    text = (ROOT / "src" / "topics" / "night-lights.ts").read_text(encoding="utf-8")
    found = re.search(r"LIGHT_THRESHOLDS\s*=\s*\[([^\]]*)\]", text)
    values = [float(v) for v in found.group(1).split(",") if v.strip()] if found else None
    if values != [float(v) for v in THRESHOLDS]:
        raise ValueError(f"src/topics/night-lights.ts 的 LIGHT_THRESHOLDS {values} 跟 pipeline 的 {THRESHOLDS} 不同")


def version(colors: list[str]) -> str:
    spec = json.dumps([FORMAT, TILE, MAX_ZOOM, THRESHOLDS, colors, vnl.RECORD, vnl.CLIP])
    return hashlib.sha256(spec.encode()).hexdigest()[:8]


class LightLevel(Level):
    """人口密度的 Level，換成燈光的分級：餵進來的「人數」是亮度 × 面積，除以面積就是平均亮度"""

    def classify(self, people: np.ndarray, cell_km2: float) -> np.ndarray:
        cum = np.concatenate(([0.0], np.cumsum(people)))
        mean = (cum[self.c1] - cum[self.c0]) / (cell_km2 * (self.c1 - self.c0))
        classes = np.searchsorted(THRESHOLDS, mean, side="right").astype(np.uint8) + 1
        classes[classes <= 1] = 0  # 第一級（沒有燈光）透明，由前端的夜色底顯示
        return classes


def build() -> None:
    check_topic_thresholds()
    colors = ramp()
    ver = version(colors)
    started = time.perf_counter()
    tmp = OUT.with_name(OUT.name + ".tmp")
    if tmp.exists():
        shutil.rmtree(tmp)
    occupied: set[tuple[int, int, int]] = set()
    written: dict[int, set[tuple[int, int, int]]] = {}
    sizes: dict[int, int] = {}
    # 先在主行程一個一個下載（每個檔已經是 24 條連線），4 個行程同時下載會對 Zenodo 發太多請求
    for epoch in EPOCHS:
        vnl.raster_path(epoch)
    with ProcessPoolExecutor(max_workers=min(JOBS, len(EPOCHS))) as pool:
        for epoch, tiles, size in pool.map(render_epoch, EPOCHS, repeat(tmp / ver), repeat(colors), repeat(common.REFRESH)):
            written[epoch], sizes[epoch] = tiles, size
            occupied |= tiles

    # 前端只請求「任何一期有內容」的圖磚；某一期剛好沒有內容的補一張透明圖磚
    empty = png(np.zeros((TILE, TILE), np.uint8), png_palette(colors))
    for epoch in EPOCHS:
        for z, x, y in occupied - written[epoch]:
            path = tmp / ver / str(epoch) / str(z) / str(x) / f"{y}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(empty)
            sizes[epoch] += len(empty)

    south, north = vnl.LAT_RANGE
    write_json(
        tmp / "meta.json",
        {
            "source": "EOG Annual VNL V2 average_masked (VIIRS DNB), 15 arc-seconds; files from Zenodo "
            f"doi:{vnl.DOI}",
            "sourceUrl": vnl.EOG_URL,
            "attribution": f"{vnl.CREDIT} (Annual VNL V2), CC BY 4.0",
            "citation": f"{vnl.NOTICE} {vnl.CITATION}",
            "generatedAt": now_iso(),
            "version": ver,
            "epochs": EPOCHS,
            "tileSize": TILE,
            "maxzoom": MAX_ZOOM,
            "thresholds": THRESHOLDS,
            "colors": colors,
            # 第一級的顏色鋪在這個緯度範圍（資料範圍），圖磚裡第一級是透明的
            "backdrop": {"south": south, "north": north},
            "tiles": [occupancy(occupied, z) for z in range(MAX_ZOOM + 1)],
            "bytes": {str(e): sizes[e] for e in EPOCHS},
        },
        quiet=True,
    )
    replace_dir(tmp, OUT)
    total = sum(sizes.values())
    print(
        f"  輸出 {OUT.relative_to(ROOT)}：{len(occupied)} 個圖磚位置 × {len(EPOCHS)} 期，{total / 2**20:.0f} MB，"
        f"共 {time.perf_counter() - started:.0f} 秒"
    )


def render_epoch(epoch: int, out: Path, colors: list[str], refresh: bool = False) -> tuple[int, set[tuple[int, int, int]], int]:
    """一期的圖磚寫到 out/<epoch>/z/x/y.png，回傳 (epoch, 寫了哪些圖磚, 總位元組)"""
    common.REFRESH = refresh  # Windows 的子行程是重新 import 的，不會繼承 run.py 設的 --refresh
    started = time.perf_counter()
    tif = vnl.raster_path(epoch)
    loaded = time.perf_counter() - started
    palette = png_palette(colors)
    tiles: set[tuple[int, int, int]] = set()
    size = 0
    per_zoom: dict[int, list[int]] = {}
    for z, x, y, classes in render(tif):
        data = png(classes, palette)
        path = out / str(epoch) / str(z) / str(x) / f"{y}.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        tiles.add((z, x, y))
        size += len(data)
        stat = per_zoom.setdefault(z, [0, 0])
        stat[0] += 1
        stat[1] += len(data)
    if PRUNE:
        tif.unlink()
    zooms = "、".join(f"z{z} {n} 張 {b / 2**20:.1f} MB" for z, (n, b) in sorted(per_zoom.items()))
    print(
        f"  {epoch}：{len(tiles)} 張、{size / 2**20:.1f} MB（{zooms}），下載 {loaded:.0f} 秒、"
        f"共 {time.perf_counter() - started:.0f} 秒",
        flush=True,
    )
    return epoch, tiles, size


def render(tif: Path) -> Iterator[tuple[int, int, int, np.ndarray]]:
    """一期的所有圖磚 (z, x, y, 分級)；整張透明的圖磚不輸出。原始檔只讀一次，所有級數一起算。"""
    with rasterio.open(tif) as src:
        t = src.transform
        f = vnl.factor(src)
        levels = [LightLevel.create(z, t, src.height, src.width) for z in range(MAX_ZOOM + 1)]
        start = min(int(lv.r0[0]) for lv in levels) // READ_ROWS * READ_ROWS
        end = max(int(lv.r1[-1]) for lv in levels)
        for b0 in range(start, end, READ_ROWS):
            h = min(READ_ROWS, end - b0)
            # 北緯 75° 以北沒有資料：當成沒有燈光（不上色）
            light = vnl.radiance(src.read(1, window=Window(0, b0, src.width, h)), f)
            # 一格的球面面積：R² × 經度寬 × (sin 北緣 − sin 南緣)
            north = np.radians(t.f + np.arange(b0, b0 + h) * t.e)
            area = EARTH_RADIUS_KM**2 * np.radians(t.a) * (np.sin(north) - np.sin(north + np.radians(t.e)))
            weighted = light * area[:, None].astype(np.float32)
            for lv in levels:
                yield from lv.feed(weighted, area, b0)
        for lv in levels:
            assert lv.done == 1 << lv.z, f"z{lv.z} 只輸出 {lv.done} 排圖磚"
