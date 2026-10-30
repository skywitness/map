"""世界視角的地形陰影圖磚（2026-10-30）：npm run data -- relief-tiles

彩色地形底圖（OpenFreeMap 的 liberty 樣式）低縮放時疊一層 Natural Earth II 的陰影點陣圖（ne2sr，公有領域），
是 256px 的 PNG：地球儀一開就要 0–3 級的 32 張、約 3.2 MB，占首頁第一次載入的八成（比例圓、點圖層的主題；
面量圖的主題世界視角不畫它，見 DESIGN.md 第 13 節）。這裡把 0–3 級（共 85 張）下載下來轉成 WebP，
放在 public/relief/<z>/<x>/<y>.webp，跟網站一起部署；4 級以上照舊用 OpenFreeMap 的（src/map/style.ts 的 localRelief）。

畫質：WebP 有損 82，跟原本的 PNG 比 OKLab 色差平均小於 1（看不出差別），一張約 25–40 KB。
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image

import common

SOURCE = "https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png"
MAX_ZOOM = 3
QUALITY = 82
OUT = common.ROOT / "public" / "relief"


def build() -> None:
    total_png = total_webp = 0
    for z in range(MAX_ZOOM + 1):
        for x in range(2**z):
            for y in range(2**z):
                png = common.download(SOURCE.format(z=z, x=x, y=y), "ne2sr", f"{z}-{x}-{y}.png")
                image = Image.open(png)
                # 陰影圖是不透明的（海是白色、60% 不透明度在樣式裡設）；有透明度的話保留
                if image.mode not in ("RGB", "RGBA"):
                    image = image.convert("RGBA" if "transparency" in image.info else "RGB")
                buffer = BytesIO()
                image.save(buffer, "WEBP", quality=QUALITY, method=6)
                target: Path = OUT / str(z) / str(x) / f"{y}.webp"
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(buffer.getvalue())
                total_png += png.stat().st_size
                total_webp += target.stat().st_size
    print(f"  輸出 public/relief：{sum(4**z for z in range(MAX_ZOOM + 1))} 張，PNG {total_png / 1e6:.1f} MB → WebP {total_webp / 1e6:.1f} MB")
