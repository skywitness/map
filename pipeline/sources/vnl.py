"""VIIRS 夜間燈光：科羅拉多礦業學院地球觀測組（EOG）的 Annual VNL V2（每年平均，background 已遮掉的 average_masked）。

- 原始的 EOG 下載站（eogdata.mines.edu）要註冊、登入，這裡不用。改用 Tomislav Hengl（OpenGeoHub）放在 Zenodo 的
  轉存版（RECORD，CC BY 4.0，不必登入）：2012–2024 年是 EOG 原本的 average_masked（每個檔的 TIFFTAG_DOCUMENTNAME
  寫著原始檔名，例如 VNL_npp_2024_global_vcmslcfg_v2_c202502261200.average_masked.dat.tif），只換成
  Cloud-Optimized GeoTIFF、存成整數（int16，nodata −32768）。
  同一個 record 的 2000–2011 年是用 2012 年以後的趨勢往回推的外插值（不是觀測），沒有用。
- **數值的換算兩段不同**（2026-10 實測，Zenodo 的說明只寫「0–200 換成 0–2000」）：
  - 2013–2021 年（EOG 的 V2.1）存的是 nW/cm²/sr × 10，GDAL scale 標 1；2022–2024 年（V2.2）存的就是 nW/cm²/sr，
    scale 標 10。也就是作者的「0–2000」= 整數 × scale，亮度 = 整數 × scale ÷ 10（factor()）。
  - 驗證：Light Every Night（AWS 上 EOG 的每晚原始輻射亮度 rade9，不必登入）2016-01-04 晴朗的一晚，台北
    （121.4–121.65°E、24.95–25.15°N）平均 26.4 nW/cm²/sr；這裡換算後 2016 年 27.4、2021 年 25.1、2024 年 27.3。
  - 兩段都只到整數 nW/cm²/sr（2013–2021 年的整數都是 10 的倍數），所以比 1 暗的格子都是 0。
  - 2013–2021 年 × 10 後碰到 int16 的上限，燃燒塔最亮的像素被截在 3,276.7；2022 年起沒有截。各年要能比較，
    全部截在 CLIP（radiance()）。
- 15 角秒（赤道約 460 m）、86400 × 35849，北緯 87.37° 到南緯 62°（EOG 的 VNL 到南緯 65°，但這個檔只到 62°；
  北緯 75° 以北沒有值）。
- 單位 nW/cm²/sr（輻射亮度）。average_masked 是把每月的無雲平均再取年平均，去掉火災等短暫的光源與極端值，
  沒有燈光的背景設為 0；海上有固定漁場的漁船燈光、油氣田的燃燒塔都留著。
- 2012 年只有 4–12 月（衛星 2011 年底才發射），所以從 2013 年開始用。
- 授權：EOG 的 VNL 是 CC BY 4.0（https://eogdata.mines.edu/files/EOG_products_CC_License.pdf ），衍生的圖表要寫
  NOTICE；Zenodo 的轉存版也是 CC BY 4.0。

Zenodo 的速度時好時壞：2026-10-25 晚上在台灣每條連線只有約 25 KB/s、約 2.5 分鐘就被切斷，隔天同一個檔 15 秒就下載完，所以檔案切成 CHUNK 一段、THREADS 條連線平行下載，
下載完用 Zenodo API 給的 MD5 檢查。
"""
from __future__ import annotations

import hashlib
import json
import shutil
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

import common
from common import CACHE_DIR, USER_AGENT

SOURCE = "vnl"
RECORD = 17294744
RECORD_URL = f"https://zenodo.org/records/{RECORD}"
DOI = "10.5281/zenodo.17294744"
EOG_URL = "https://eogdata.mines.edu/products/vnl/"
YEARS = list(range(2013, 2025))
NODATA = -32768
CLIP = 3276.7  # nW/cm²/sr：2013–2021 年存成 × 10 的 int16 上限，各年一律截在這裡
LAT_RANGE = (-62.0, 75.0)  # 有資料的範圍：檔案只到南緯 62°，北緯 75° 以北是 nodata
CHUNK = 4 << 20
THREADS = 24
RETRIES = 5
MAX_WAITS = 20  # HTTP 429 最多等幾次

# EOG 的授權文件要求衍生產品（含圖表）寫上這段，篇幅不夠時改寫 CREDIT
NOTICE = (
    "This product was made utilizing VIIRS Nighttime Lights (Annual VNL V2) data produced by the Earth Observation "
    "Group, Payne Institute for Public Policy, Colorado School of Mines."
)
CREDIT = "Source: EOG, Colorado School of Mines"
CITATION = (
    "Elvidge, C.D., Zhizhin, M., Ghosh, T., Hsu, F.-C., Taneja, J. (2021). Annual time series of global VIIRS "
    "nighttime lights derived from monthly averages: 2012 to 2019. Remote Sensing 13(5), 922. "
    "doi:10.3390/rs13050922; files: Hengl, T. (2025). Annual time series of global VIIRS nighttime lights "
    "(v0.4), Zenodo, doi:10.5281/zenodo.17294744"
)


def file_name(year: int) -> str:
    return f"nightlights.average_viirs.v21_m_500m_s_{year}0101_{year}1231_go_epsg4326_v20250904.tif"


def file_url(year: int) -> str:
    return f"{RECORD_URL}/files/{file_name(year)}?download=1"


def record_files() -> dict[str, dict]:
    """Zenodo API 的檔案清單：{檔名: {"size", "checksum"}}（快取在 .cache/vnl/record.json）"""
    path = common.download(f"https://zenodo.org/api/records/{RECORD}", SOURCE, "record.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    return {f["key"]: {"size": f["size"], "checksum": f["checksum"]} for f in data["files"]}


def _fetch(url: str, start: int, end: int, target: Path) -> None:
    """下載 [start, end) 寫到 target（已經完整的就跳過）。

    Zenodo 大約 2.5 分鐘就切斷一條連線（不報錯，只是提早結束），所以斷掉時從已經收到的位置接著下載。
    """
    if target.exists() and target.stat().st_size == end - start:
        return
    tmp = target.with_suffix(".part")
    tmp.unlink(missing_ok=True)
    failures = waits = 0
    while True:
        got = tmp.stat().st_size if tmp.exists() else 0
        if got == end - start:
            tmp.replace(target)
            return
        before = got
        try:
            headers = {"User-Agent": USER_AGENT, "Range": f"bytes={start + got}-{end - 1}"}
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=120) as resp, open(tmp, "ab") as f:
                if resp.status != 206:
                    raise OSError(f"HTTP {resp.status}，伺服器不支援 Range")
                while chunk := resp.read(1 << 16):
                    f.write(chunk)
        except urllib.error.HTTPError as e:
            if e.code == 429 and waits < MAX_WAITS:
                # 請求太多（Zenodo 的速率限制）：照 Retry-After 等一下再接著下載，不算失敗
                waits += 1
                after = e.headers.get("Retry-After") or ""
                time.sleep(min(int(after), 300) if after.isdigit() else 30)
                continue
            failures += 1
            if failures >= RETRIES:
                raise
            print(f"  {target.name} 下載失敗（HTTP {e.code}），重試", flush=True)
            time.sleep(5 * failures)
        except OSError as e:
            got = tmp.stat().st_size if tmp.exists() else 0
            if got == before:  # 完全沒有進度才算失敗
                failures += 1
                if failures >= RETRIES:
                    raise
                print(f"  {target.name} 下載失敗（{e}），重試", flush=True)
                time.sleep(5 * failures)


def raster_path(year: int) -> Path:
    """下載某一年的 GeoTIFF 到快取（約 60–85 MB），回傳路徑"""
    name = file_name(year)
    target = CACHE_DIR / SOURCE / name
    if target.exists() and not common.REFRESH:
        return target
    info = record_files()[name]
    size = info["size"]
    url = file_url(year)
    parts_dir = CACHE_DIR / SOURCE / f"{name}.parts"
    parts_dir.mkdir(parents=True, exist_ok=True)
    bounds = list(range(0, size, CHUNK)) + [size]
    jobs = [(url, a, b, parts_dir / f"{i:04d}.bin") for i, (a, b) in enumerate(zip(bounds[:-1], bounds[1:]))]
    print(f"  下載 {year} 年（{size / 2**20:.0f} MB，{len(jobs)} 段、{THREADS} 條連線）：{url}", flush=True)
    started = time.perf_counter()
    with ThreadPoolExecutor(THREADS) as pool:
        list(pool.map(lambda j: _fetch(*j), jobs))
    md5 = hashlib.md5()
    tmp = target.with_suffix(".tif.part")
    with open(tmp, "wb") as out:
        for *_rest, part in jobs:
            data = part.read_bytes()
            md5.update(data)
            out.write(data)
    expected = info["checksum"].removeprefix("md5:")
    if md5.hexdigest() != expected:
        tmp.unlink()
        shutil.rmtree(parts_dir)
        raise OSError(f"{name} 的 MD5 不符（{md5.hexdigest()} ≠ {expected}），已刪掉重來")
    tmp.replace(target)
    shutil.rmtree(parts_dir)
    print(f"  {year} 年下載完成，{time.perf_counter() - started:.0f} 秒", flush=True)
    return target


def factor(src) -> float:
    """這個檔的整數 × factor = nW/cm²/sr（src 是 rasterio 打開的檔）。見檔頭「數值的換算」"""
    scale = src.scales[0]
    if scale not in (1.0, 10.0):
        raise ValueError(f"{src.name} 的 scale {scale} 不是 1 或 10，換算方式要重新確認")
    return scale / 10


def radiance(raw: np.ndarray, f: float) -> np.ndarray:
    """整數 → nW/cm²/sr（float32）；nodata 與負值是 0，太亮的截在 CLIP"""
    out = raw.astype(np.float32) * np.float32(f)
    out[(raw == NODATA) | (raw < 0)] = 0
    np.minimum(out, np.float32(CLIP), out=out)
    return out
