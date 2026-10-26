"""Speedtest by Ookla Global Fixed and Mobile Network Performance Maps（AWS Open Data，CC BY-NC-SA 4.0）。

- 官方說明：https://github.com/teamookla/ookla-open-data （README 的 License 與 Suggested Attribution），
  AWS 登錄頁 https://registry.opendata.aws/speedtest-global-performance/ 。
- 公開的 S3 bucket（s3://ookla-open-data，us-west-2），不必登入、不必金鑰：每季一個 parquet，固網（fixed）與行動（mobile）
  各一個，2019 年第 1 季起。每一列是一個 z16 的 Web Mercator 圖塊（赤道約 610 m），有那一季在這個圖塊裡的
  測試次數（tests）、裝置數（devices）與平均下載速度、平均上傳速度（kbps）、平均延遲（ms）。
- 「固網」是手機或電腦經由 Wi-Fi、乙太網路測的（非行動網路），「行動」是經由行動網路（4G、5G）測的；
  只收有 GPS 等級定位的測試。
- 讀法：pyarrow 的 S3FileSystem(anonymous=True) 只讀需要的欄位（WKT 的 tile 欄占檔案約六成，不讀），
  quadkey 換成 z16 的 x、y，存成 .npz 快取（`.cache/ookla/`）。一個檔讀 10–30 秒。
- Ookla 會為了 GDPR 等個資請求重新彙整舊資料（README），不同時間下載的測試次數可能略有差異。
"""
from __future__ import annotations

import time

import numpy as np

from common import CACHE_DIR, REFRESH

BUCKET = "ookla-open-data"
REGION = "us-west-2"
KINDS = ("fixed", "mobile")
ZOOM = 16
COLUMNS = ["quadkey", "avg_d_kbps", "avg_u_kbps", "avg_lat_ms", "tests", "devices"]
INFO_URL = "https://github.com/teamookla/ookla-open-data"
AWS_URL = "https://aws.amazon.com/marketplace/pp/prodview-breawk6ljkovm#resources"
ACCESSED = "27 October 2026"
LICENSEE = "World Data Map"
# 地圖右下角的短標示（網格圖磚的 meta.json）
ATTRIBUTION = "Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps (CC BY-NC-SA 4.0)"


def citation(period: str) -> str:
    """README 的「Suggested Attribution」，方括號照填（含商標聲明，一字不改）"""
    return (
        f"Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps was accessed on {ACCESSED} from AWS. "
        f"Based on {LICENSEE}’s analysis of Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps "
        f"for {period}. Ookla trademarks used under license and reprinted with permission."
    )


def key(kind: str, year: int, quarter: int) -> str:
    month = (quarter - 1) * 3 + 1
    return (
        f"parquet/performance/type={kind}/year={year}/quarter={quarter}/"
        f"{year}-{month:02d}-01_performance_{kind}_tiles.parquet"
    )


def url(kind: str, year: int, quarter: int) -> str:
    return f"https://{BUCKET}.s3.amazonaws.com/{key(kind, year, quarter)}"


def _decode_quadkeys(column) -> tuple[np.ndarray, np.ndarray]:
    """quadkey（16 個 0–3 的字元）→ z16 的 x、y。直接讀 Arrow 字串陣列的緩衝區，每個 quadkey 一定是 16 個字元。"""
    import pyarrow as pa

    qk = column.combine_chunks()
    if qk.null_count:
        raise ValueError("quadkey 有缺值")
    large = pa.types.is_large_string(qk.type)
    offsets = np.frombuffer(qk.buffers()[1], dtype=np.int64 if large else np.int32)[qk.offset : qk.offset + len(qk) + 1]
    if not np.all(np.diff(offsets) == ZOOM):
        raise ValueError("quadkey 不是 16 個字元（不是 z16 的圖塊）")
    data = np.frombuffer(qk.buffers()[2], dtype=np.uint8)[offsets[0] : offsets[-1]]
    digits = (data.reshape(-1, ZOOM) - ord("0")).astype(np.uint16)
    if digits.max() > 3:
        raise ValueError("quadkey 有 0–3 以外的字元")
    x = np.zeros(len(qk), np.uint16)
    y = np.zeros(len(qk), np.uint16)
    for i in range(ZOOM):
        bit = np.uint16(ZOOM - 1 - i)
        x |= (digits[:, i] & 1) << bit
        y |= ((digits[:, i] >> 1) & 1) << bit
    return x, y


def tiles(kind: str, year: int, quarter: int) -> dict[str, np.ndarray]:
    """一季的所有圖塊：x、y（z16）、d、u（kbps）、lat（ms）、tests、devices"""
    cache = CACHE_DIR / "ookla" / f"{kind}-{year}q{quarter}.npz"
    if cache.exists() and not REFRESH:
        with np.load(cache) as z:
            return {k: z[k] for k in z.files}
    import pyarrow.parquet as pq
    from pyarrow import fs

    started = time.perf_counter()
    s3 = fs.S3FileSystem(anonymous=True, region=REGION)
    path = f"{BUCKET}/{key(kind, year, quarter)}"
    info = s3.get_file_info(path)
    if info.type != fs.FileType.File:
        raise RuntimeError(f"Ookla 的 bucket 沒有這個檔：{path}")
    table = pq.read_table(path, filesystem=s3, columns=COLUMNS)
    x, y = _decode_quadkeys(table.column("quadkey"))

    def ints(name: str) -> np.ndarray:
        col = table.column(name)
        if col.null_count:
            raise ValueError(f"{path} 的 {name} 有缺值")
        a = col.to_numpy()
        if a.min() < 0 or a.max() >= 2**31:
            raise ValueError(f"{path} 的 {name} 超出範圍")
        return a.astype(np.int32)

    out = {
        "x": x, "y": y,
        "d": ints("avg_d_kbps"), "u": ints("avg_u_kbps"), "lat": ints("avg_lat_ms"),
        "tests": ints("tests"), "devices": ints("devices"),
        "modified": np.array(info.mtime_ns // 1_000_000_000, dtype=np.int64),
    }
    if (out["tests"] <= 0).any():
        raise ValueError(f"{path} 有測試次數為 0 的圖塊")
    cache.parent.mkdir(parents=True, exist_ok=True)
    np.savez(cache, **out)
    print(f"  Ookla {kind} {year} Q{quarter}：{len(x):,} 個圖塊、{int(out['tests'].sum()):,} 次測試（{time.perf_counter() - started:.0f} 秒）")
    return out


def tile_centers(x: np.ndarray, y: np.ndarray, zoom: int = ZOOM) -> tuple[np.ndarray, np.ndarray]:
    """Web Mercator 圖塊中心的經緯度"""
    n = 2.0**zoom
    lon = (x.astype(np.float64) + 0.5) / n * 360.0 - 180.0
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * (y.astype(np.float64) + 0.5) / n))))
    return lon, lat
