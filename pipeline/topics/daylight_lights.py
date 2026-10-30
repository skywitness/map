"""晝夜與季節的夜半邊燈光：夜間燈光主題的 VIIRS 年度合成（sources/vnl.py）縮成 0.1° 的一張灰階 PNG。

晝夜圖層（src/map/nightLayer.ts）在片段著色器裡依太陽高度把這張圖疊在夜半邊：天黑（太陽在地平線下 6° 以下）才亮，
白天的那一半不畫。夜間燈光主題的網格圖磚（night_lights_tiles.py）不進版本控制、要依縮放一張一張下載，
自訂圖層不好遮掉白天的那一半，所以另外做一張整個地球一次讀完的小圖（約 0.1°，赤道約 11 km）：
世界全圖看得到城市、公路與油氣田的燈光，放大後是模糊的光暈。

- 只用最新的一期（vnl.YEARS 的最後一年）：晝夜主題的時間是「此刻」，不跟年份。
- 每格是 24 × 24 個 15 角秒格子的平均輻射亮度（沒有燈光的算 0），依對數轉成 0–255：
  LOW nW/cm²/sr 以下是 0，HIGH 以上是 255。
- 範圍是 vnl.LAT_RANGE（南緯 62° 到北緯 75°）；圖的上緣是北緯 75°。
"""
from __future__ import annotations

import io
import math

import numpy as np
import rasterio
from PIL import Image
from rasterio.windows import Window

from common import OUT_DIR, write_json
from sources import vnl

OUT = OUT_DIR / "topics" / "daylight"
CELL = 24  # 0.1° = 24 個 15 角秒
LOW, HIGH = 0.3, 60.0  # nW/cm²/sr：對數尺度的兩端


def build() -> None:
    year = vnl.YEARS[-1]
    path = vnl.raster_path(year)
    south, north = vnl.LAT_RANGE
    with rasterio.open(path) as src:
        f = vnl.factor(src)
        res = src.res[1]
        if abs(res * CELL - 0.1) > 1e-9 or abs(src.bounds.left + 180) > 1e-6:
            raise ValueError(f"{path.name} 的格子大小或範圍跟預期不同：{src.res}、{src.bounds}")
        top = round((src.bounds.top - north) / res)
        rows = round((north - south) / 0.1)
        width = src.width // CELL
        out = np.zeros((rows, width), np.float32)
        for r in range(rows):
            # 最下面一排可能不滿 24 列（檔案到南緯 62.0008°）
            h = min(CELL, src.height - (top + r * CELL))
            raw = src.read(1, window=Window(0, top + r * CELL, width * CELL, h))
            rad = vnl.radiance(raw, f)
            out[r] = rad.reshape(h, width, CELL).mean(axis=(0, 2))
    scaled = np.log(np.maximum(out, LOW) / LOW) / math.log(HIGH / LOW)
    codes = np.clip(np.round(scaled * 255), 0, 255).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(codes, "L").save(buf, "PNG", optimize=True)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "lights.png").write_bytes(buf.getvalue())
    write_json(
        OUT / "lights.json",
        {
            "year": year,
            "bounds": [-180, south, 180, north],
            "low": LOW,
            "high": HIGH,
            "source": f"EOG Annual VNL V2 average_masked {year}, mean over 0.1° cells; files from Zenodo doi:{vnl.DOI}",
            "notice": vnl.NOTICE,
        },
    )
    lit = int((codes > 0).sum())
    print(f"  lights.png：{width} × {rows}，{len(buf.getvalue()) / 1024:.0f} KB，有燈光的格子 {lit:,}（{year} 年）")
