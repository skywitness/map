"""網路速度的網格圖磚：「網路速度」主題的「下載速度」切到「約 2 km 網格」時的地圖圖層（固網、行動各一組）。

- 資料：Ookla Open Data 最新一季（sources/ookla.py，CC BY-NC-SA 4.0；圖磚是改作，同樣以 CC BY-NC-SA 4.0 提供），
  z16 的 Web Mercator 圖塊（赤道約 610 m），每塊有測試次數與平均下載速度。
- 圖磚也是 Web Mercator、512 px，所以縮放 z 的一個像素剛好是 z+9 級的一個圖塊：z5 的像素 = z14 的圖塊
  = 4 × 4 個 Ookla 圖塊（赤道約 2.4 km，台灣約 2.2 km，歐洲約 1.6 km，叫「約 2 km 網格」）。不必重新取樣，直接依四分樹往上併。
- 每個像素的值跟各國的值同一個算法：像素裡各圖塊的平均下載速度依測試次數加權的中位數
  （topics/internet_speed.py 的 weighted_medians）。縮小時一個像素涵蓋更多圖塊，就是那一帶所有測試的中位數。
- 測試次數不到 MIN_TESTS 的像素透明（一兩次測試的值很不穩定，也透出底圖讓人看出哪裡沒人測）。
- 7 級，門檻跟國家的面量圖一樣（src/topics/internet-speed.ts 的 FIXED_DOWNLOAD、MOBILE_DOWNLOAD，build() 會檢查），
  顏色是地圖的橘色循序色（tokens.ts 的 ORANGE）。
- 只做到 z5（兩組共約 3.1 MB；只做到 z4 是 1.5 MB、像素約 5 km，台灣的城鄉差別比較糊），再放大由 MapLibre 拉大
  z5 的圖磚。只有一期（最新一季），不跟著時間軸換。

圖磚不進版本控制，部署時由 GitHub Actions 產生並快取（.github/workflows/deploy.yml）。
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import time
from pathlib import Path

import numpy as np

from common import ROOT, now_iso, write_json
from sources import ookla
from topics.internet_speed import weighted_medians
from topics.population_density_tiles import TILE, occupancy, png, png_palette, ramp, replace_dir

MAX_ZOOM = 5
FORMAT = 1  # 圖磚的產生方式改了就加一：網址裡的版本跟著換
PERIOD = (2026, 3)  # 最新一季（年, 季）；換季時改這裡，前端的 epoch 是年份
MIN_TESTS = 5
# 下載速度（Mbps）的分級門檻：跟 src/topics/internet-speed.ts 的 FIXED_DOWNLOAD、MOBILE_DOWNLOAD 一樣
THRESHOLDS = {
    "fixed": [10, 25, 50, 100, 200, 300],
    "mobile": [10, 25, 50, 100, 150, 250],
}
CONST_NAMES = {"fixed": "FIXED_DOWNLOAD", "mobile": "MOBILE_DOWNLOAD"}


def out_dir(kind: str) -> Path:
    return ROOT / "public" / "tiles" / f"internet-speed-{kind}"


def check_topic_thresholds() -> None:
    """主題設定（src/topics/internet-speed.ts）的門檻要跟這裡一樣"""
    text = (ROOT / "src" / "topics" / "internet-speed.ts").read_text(encoding="utf-8")
    for kind, name in CONST_NAMES.items():
        found = re.search(rf"const {name}\s*=\s*\[([^\]]*)\]", text)
        values = [float(v) for v in found.group(1).split(",") if v.strip()] if found else None
        if values != [float(v) for v in THRESHOLDS[kind]]:
            raise ValueError(f"src/topics/internet-speed.ts 的 {name} 跟 pipeline 的不同：{values}")


def version(kind: str, colors: list[str]) -> str:
    spec = json.dumps([FORMAT, TILE, MAX_ZOOM, MIN_TESTS, THRESHOLDS[kind], colors, ookla.key(kind, *PERIOD)])
    return hashlib.sha256(spec.encode()).hexdigest()[:8]


def build() -> None:
    check_topic_thresholds()
    colors = ramp()
    for kind in ookla.KINDS:
        started = time.perf_counter()
        t = ookla.tiles(kind, *PERIOD)
        ver = version(kind, colors)
        out = out_dir(kind)
        tmp = out.with_name(out.name + ".tmp")
        if tmp.exists():
            shutil.rmtree(tmp)
        tiles, size, per_zoom = render(t, THRESHOLDS[kind], png_palette(colors), tmp / ver / str(PERIOD[0]))
        label = "fixed broadband" if kind == "fixed" else "mobile"
        write_json(
            tmp / "meta.json",
            {
                "source": f"Speedtest by Ookla Global Fixed and Mobile Network Performance Maps, {label}, "
                f"Q{PERIOD[1]} {PERIOD[0]}: tests-weighted median of z16 tile average download speeds",
                "sourceUrl": ookla.INFO_URL,
                "attribution": ookla.ATTRIBUTION,
                "citation": ookla.citation(f"Q{PERIOD[1]} {PERIOD[0]}"),
                "license": "CC BY-NC-SA 4.0",
                "generatedAt": now_iso(),
                "version": ver,
                "epochs": [PERIOD[0]],
                "tileSize": TILE,
                "maxzoom": MAX_ZOOM,
                "thresholds": THRESHOLDS[kind],
                "minTests": MIN_TESTS,
                "colors": colors,
                "tiles": [occupancy(tiles, z) for z in range(MAX_ZOOM + 1)],
                "bytes": {str(PERIOD[0]): size},
            },
            quiet=True,
        )
        replace_dir(tmp, out)
        zooms = "、".join(f"z{z} {n} 張 {b / 2**20:.2f} MB" for z, (n, b) in per_zoom.items())
        print(f"  {out.relative_to(ROOT)}：{len(tiles)} 張、{size / 2**20:.2f} MB（{zooms}），{time.perf_counter() - started:.0f} 秒")


def render(
    t: dict[str, np.ndarray], thresholds: list[float], pal: bytes, out: Path
) -> tuple[set[tuple[int, int, int]], int, dict[int, tuple[int, int]]]:
    """z16 圖塊 → out/z/x/y.png。回傳 (寫了哪些圖磚, 總位元組, {z: (張數, 位元組)})"""
    mbps = t["d"].astype(np.float64) / 1000
    tests = t["tests"].astype(np.int64)
    tiles: set[tuple[int, int, int]] = set()
    size = 0
    per_zoom: dict[int, tuple[int, int]] = {}
    for z in range(MAX_ZOOM + 1):
        level = z + 9  # 512 px 的圖磚：一個像素是 z+9 級的一個圖塊
        shift = ookla.ZOOM - level
        px = (t["x"].astype(np.int64) >> shift)
        py = (t["y"].astype(np.int64) >> shift)
        keys, groups = np.unique(py << level | px, return_inverse=True)
        n = len(keys)
        median = weighted_medians(groups, mbps, tests, n)
        count = np.bincount(groups, weights=tests, minlength=n)
        classes = (np.searchsorted(thresholds, median, side="right") + 1).astype(np.uint8)
        classes[count < MIN_TESTS] = 0
        kx, ky = keys & ((1 << level) - 1), keys >> level
        keep = classes > 0
        kx, ky, classes = kx[keep], ky[keep], classes[keep]
        tile_key = (ky >> 9) << z | (kx >> 9)
        order = np.argsort(tile_key, kind="stable")
        tile_key, kx, ky, classes = tile_key[order], kx[order], ky[order], classes[order]
        bounds = np.flatnonzero(np.r_[True, tile_key[1:] != tile_key[:-1], True])
        count_z = nbytes = 0
        for s, e in zip(bounds[:-1], bounds[1:]):
            tx, ty = int(kx[s] >> 9), int(ky[s] >> 9)
            image = np.zeros((TILE, TILE), np.uint8)
            image[ky[s:e] & 511, kx[s:e] & 511] = classes[s:e]
            data = png(image, pal)
            path = out / str(z) / str(tx) / f"{ty}.png"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            tiles.add((z, tx, ty))
            count_z += 1
            nbytes += len(data)
        per_zoom[z] = (count_z, nbytes)
        size += nbytes
    return tiles, size, per_zoom
