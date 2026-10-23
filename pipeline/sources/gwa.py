"""Global Wind Atlas 4.0（丹麥技術大學 DTU 風能系，與世界銀行 ESMAP 合作；中尺度模擬由 Vortex 製作）：
100 公尺高的平均風功率密度（W/m²）。

- 全球檔是 250 m（0.0025°）、14.8 GB 的 Cloud Optimized GeoTIFF（float32、zstd），放在 DTU 的 figshare
  （GWA 的下載頁 https://globalwindatlas.info/en/download/gis-files「Global → Power density → 100 m」連過去）。
  整個檔下載不實際，這裡只取檔案裡現成的 1/8 縮小版（overview，0.02°，赤道約 2.2 km；GDAL 產生縮小版時是
  區塊平均，見 DESIGN.md 第 14 節）：COG 的縮小版在檔案裡是連續的一段（約 182 MB），用 HTTP Range 分段平行下載，
  再加上檔頭（約 0.5 MB 的 IFD），用 GDAL 的 /vsisparse/ 組回一個「只有這兩段」的虛擬檔給 rasterio 讀。
- 範圍：北緯 80° 到南緯 64°；陸地加上各國的專屬經濟海域（離岸最遠 200 浬），再外面的公海沒有資料（NaN）。
  南極洲沒有資料。
- 模擬期間：ERA5 再分析資料的 2008–2017 年（Vortex 的 3 km 中尺度模擬，再用 DTU 的 WAsP 細化到 250 m）。
- 授權：CC BY 4.0（GWA 網站的 Terms of Use），要求的引用文字見 ATTRIBUTION_FULL。

figshare 網頁上的下載網址（figshare.com/ndownloader/…）有瀏覽器驗證；程式改用 figshare API 回傳的
下載網址 ndownloader.figshare.com/files/<id>（不必登入），它會轉址到 DTU 的 S3（簽名網址 10 秒內有效，
每段各自重新要一次）。
"""
from __future__ import annotations

import struct
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from affine import Affine

import common
from common import CACHE_DIR, USER_AGENT

SOURCE = "gwa"
FILE_ID = 54313655  # power_density_cog_100m.tif
URL = f"https://ndownloader.figshare.com/files/{FILE_ID}"
INFO_URL = "https://globalwindatlas.info/en/download/gis-files"
LICENSE_URL = "https://globalwindatlas.info/en/about/TermsOfUse"
VERSION = "4.0"
PERIOD = (2008, 2017)
LAT_RANGE = (-64.0, 80.0)  # 檔案的範圍
HEIGHT_M = 100
ATTRIBUTION_FULL = (
    "Data obtained from the Global Wind Atlas version 4.0, a free, web-based application developed, owned and operated "
    "by the Technical University of Denmark (DTU). The Global Wind Atlas version 4.0 is released in partnership with "
    "the World Bank Group, utilizing data provided by Vortex, using funding provided by the Energy Sector Management "
    "Assistance Program (ESMAP). For additional information: https://globalwindatlas.info"
)
# 地圖右下角的短標示（純文字）
ATTRIBUTION = f"Global Wind Atlas {VERSION} (DTU, World Bank/ESMAP), CC BY 4.0"
OVERVIEW_WIDTH = 18000  # 取哪一層縮小版：0.02°（全解析度 144000 欄的 1/8）
HEADER_BYTES = 1 << 20  # 檔頭（所有 IFD 與圖塊位置表）在前 0.5 MB 內
PARTS = 8  # 平行下載幾段（DTU 的伺服器每條連線大約只有 0.2–1 MB/s）
RETRIES = 4


@dataclass
class Grid:
    """風功率密度（W/m²）的 0.02° 網格：values[列, 欄]，北邊在上，沒有資料是 NaN"""

    values: np.ndarray  # float32
    transform: Affine


def fetch_range(start: int, end: int, target: Path) -> None:
    """下載 [start, end) 寫到 target（已存在就用快取）"""
    if target.exists() and not common.REFRESH:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(target.suffix + ".part")
    for attempt in range(RETRIES):
        try:
            request = urllib.request.Request(URL, headers={"User-Agent": USER_AGENT, "Range": f"bytes={start}-{end - 1}"})
            with urllib.request.urlopen(request, timeout=120) as resp, open(tmp, "wb") as f:
                if resp.status != 206:
                    raise OSError(f"HTTP {resp.status}，伺服器不支援 Range")
                while chunk := resp.read(1 << 20):
                    f.write(chunk)
            if tmp.stat().st_size != end - start:
                raise OSError(f"只收到 {tmp.stat().st_size} / {end - start} bytes")
            tmp.replace(target)
            return
        except OSError as e:
            if attempt == RETRIES - 1:
                raise
            print(f"  {target.name} 下載失敗（{e}），重試")
            time.sleep(5 * (attempt + 1))


def parse_ifds(head: bytes) -> list[tuple[int, int, list[int], list[int]]]:
    """BigTIFF 的每個 IFD：(寬, 高, 圖塊位置, 圖塊大小)。第一個是全解析度，之後是縮小版"""
    if head[:4] != b"II+\x00":
        raise ValueError("不是 little-endian 的 BigTIFF")
    types = {3: ("H", 2), 4: ("I", 4), 16: ("Q", 8)}
    out = []
    off = struct.unpack_from("<Q", head, 8)[0]
    while off:
        n = struct.unpack_from("<Q", head, off)[0]
        tags: dict[int, tuple] = {}
        for i in range(n):
            tag, typ, count, raw = struct.unpack_from("<HHQ8s", head, off + 8 + i * 20)
            if tag not in (256, 257, 324, 325):
                continue
            fmt, size = types[typ]
            if count * size <= 8:
                tags[tag] = struct.unpack_from("<" + fmt * count, raw)
            else:
                at = struct.unpack("<Q", raw)[0]
                if at + count * size > len(head):
                    raise ValueError("檔頭比預期的大，HEADER_BYTES 要加大")
                tags[tag] = struct.unpack_from("<" + fmt * count, head, at)
        out.append((tags[256][0], tags[257][0], list(tags[324]), list(tags[325])))
        off = struct.unpack_from("<Q", head, off + 8 + n * 20)[0]
    return out


def sparse_file() -> tuple[str, int]:
    """下載檔頭與 OVERVIEW_WIDTH 那一層縮小版，回傳 (/vsisparse/ 路徑, 第幾層縮小版)"""
    folder = CACHE_DIR / SOURCE
    head_path = folder / f"pd{HEIGHT_M}.header.bin"
    fetch_range(0, HEADER_BYTES, head_path)
    head = head_path.read_bytes()
    ifds = parse_ifds(head)
    level = next(i for i, (w, *_rest) in enumerate(ifds) if w == OVERVIEW_WIDTH)
    _w, _h, offsets, counts = ifds[level]
    first_data = min(o for _w, _h, offs, _c in ifds for o in offs)
    if first_data > HEADER_BYTES:
        raise ValueError("檔頭比預期的大，HEADER_BYTES 要加大")
    # GDAL 的 COG 每個圖塊前後各有 4 bytes（大小、最後 4 bytes 重複一次），一起下載
    lo = min(offsets) - 4
    hi = max(o + c for o, c in zip(offsets, counts)) + 4
    parts = []
    bounds = [lo + (hi - lo) * i // PARTS for i in range(PARTS + 1)]
    started = time.perf_counter()
    with ThreadPoolExecutor(PARTS) as pool:
        for i in range(PARTS):
            target = folder / f"pd{HEIGHT_M}.ov{OVERVIEW_WIDTH}.{i}.bin"
            parts.append((target, bounds[i], bounds[i + 1]))
        missing = [p for p in parts if not p[0].exists() or common.REFRESH]
        if missing:
            print(f"  下載 Global Wind Atlas 的縮小版（{(hi - lo) / 2**20:.0f} MB，{PARTS} 段）：{URL}")
        list(pool.map(lambda p: fetch_range(p[1], p[2], p[0]), missing))
    if missing:
        print(f"  下載完成，{time.perf_counter() - started:.0f} 秒")
    # 虛擬檔只到這一層縮小版的結尾；沒下載的部分（其他層）讀起來是 0，GDAL 不會去讀
    regions = [(head_path, 0, 0, first_data)] + [(p, a, 0, b - a) for p, a, b in parts]
    xml = folder / f"pd{HEIGHT_M}.ov{OVERVIEW_WIDTH}.vsisparse.xml"
    body = "".join(
        f"<SubfileRegion><Filename relative=\"0\">{path.resolve().as_posix()}</Filename>"
        f"<DestinationOffset>{dest}</DestinationOffset><SourceOffset>{src}</SourceOffset>"
        f"<RegionLength>{length}</RegionLength></SubfileRegion>"
        for path, dest, src, length in regions
    )
    xml.write_text(f"<VSISparseFile><Length>{hi}</Length>{body}</VSISparseFile>", encoding="utf-8")
    return f"/vsisparse/{xml.resolve().as_posix()}", level - 1


def load() -> Grid:
    """0.02° 的風功率密度網格（第一次要下載約 182 MB）"""
    import rasterio

    path, overview = sparse_file()
    started = time.perf_counter()
    with rasterio.open(path, overview_level=overview) as src:
        values = src.read(1).astype(np.float32)
        transform = src.transform
    values[~np.isfinite(values) | (values < 0)] = np.nan
    print(f"  Global Wind Atlas：{values.shape[1]} × {values.shape[0]}，{transform.a:.4f}°，讀取 {time.perf_counter() - started:.0f} 秒")
    return Grid(values, transform)
