"""GloRiC v1.0（Global River Classification；Ouellet Dallaire、Lehner、Sayre、Thieme 2019，HydroSHEDS 的附屬產品）。

- 內容：HydroRIVERS 的 847.8 萬段河道（河段 ID 相同），每一段都有水文、物理氣候、地形三個子分類，與合成的 127 種河段類型
  （Reach_type：第 1 位〔10 是兩位〕是簡化的物理氣候區、第 2 位是河的大小、第 3 位是地形：1 水流力弱、2 水流力中到強、
  3 受湖泊或濕地影響，「很大的河」沒有第 3 位、寫 0）。類別名稱在 zip 裡的 GloRiC_ClassNames_v10.xlsx。
- 授權：產品頁「The GloRiC database is freely available for scientific, educational and commercial use. The data are
  distributed under the same license agreement as the HydroSHEDS core products」；技術文件第 4 節：河道的幾何依
  HydroSHEDS 授權協議，版權屬作者（2018）。跟河流主題已經在用的 HydroRIVERS 同一份協議（sources/hydrorivers.py）：
  只輸出各國的統計，不轉載原始檔。
- 引用：Ouellet Dallaire, C., Lehner, B., Sayre, R., Thieme, M. (2019): A multidisciplinary framework to derive global
  river reach classifications at high spatial resolution. Environmental Research Letters, 14(2): 024003.
- 下載：https://data.hydrosheds.org/file/hydrosheds-associated/gloric/GloRiC_v10_shapefile.zip（574,551,820 bytes，
  不必登入）。解壓後 2.8 GB，所以不解壓：.dbf 與 .shp 直接從 zip 串流讀，只留河段 ID、長度、類型與河段的出口
  （每段線的最後一點，跟 topics/rivers.py 判斷國家的方式一樣），存成 .npz 快取。
"""
from __future__ import annotations

import struct
import zipfile

import numpy as np

from common import CACHE_DIR, download

URL = "https://data.hydrosheds.org/file/hydrosheds-associated/gloric/GloRiC_v10_shapefile.zip"
ZIP = "GloRiC_v10_shapefile.zip"
INFO_URL = "https://www.hydrosheds.org/products/gloric"
CACHE = CACHE_DIR / "gloric" / "gloric-v10.npz"
STEM = "GloRiC_v10_shapefile/GloRiC_v10"
# .dbf 每一筆 172 bytes：第 0 個是刪除旗標，之後依欄位寬度（技術文件表 1 的順序）
FIELDS = {"Reach_ID": (1, 11), "Length_km": (21, 34), "Reach_type": (152, 162)}
CHUNK = 200_000


def _dbf(z: zipfile.ZipFile) -> dict[str, np.ndarray]:
    with z.open(STEM + ".dbf") as f:
        head = f.read(32)
        n, header_len, rec_len = struct.unpack("<IHH", head[4:12])
        f.read(header_len - 32)
        ids = np.empty(n, np.int64)
        length = np.empty(n, np.float32)
        rtype = np.empty(n, np.int16)
        done = 0
        while done < n:
            k = min(CHUNK, n - done)
            buf = np.frombuffer(f.read(k * rec_len), dtype=np.uint8).reshape(k, rec_len)

            def col(name: str) -> np.ndarray:
                a, b = FIELDS[name]
                return buf[:, a:b].copy().view(f"S{b - a}").ravel()

            ids[done:done + k] = col("Reach_ID").astype(np.int64)
            length[done:done + k] = col("Length_km").astype(np.float64)
            rtype[done:done + k] = col("Reach_type").astype(np.int64)
            done += k
    return {"id": ids, "length": length, "type": rtype}


def _outlets(z: zipfile.ZipFile, n: int) -> tuple[np.ndarray, np.ndarray]:
    """每一筆 PolyLine 的最後一點（河段的出口）：依序讀過 .shp，每筆的內容長度在記錄標頭裡"""
    lon = np.empty(n, np.float64)
    lat = np.empty(n, np.float64)
    with z.open(STEM + ".shp") as f:
        f.read(100)
        for i in range(n):
            _num, words = struct.unpack(">ii", f.read(8))
            rec = f.read(words * 2)
            lon[i], lat[i] = struct.unpack("<2d", rec[-16:])
    return lon, lat


def reaches() -> dict[str, np.ndarray]:
    """id（河段 ID）、length（公里）、type（127 種河段類型）、lon/lat（河段出口）"""
    if CACHE.exists():
        with np.load(CACHE) as d:
            return {k: d[k] for k in d.files}
    path = download(URL, "gloric", ZIP)
    with zipfile.ZipFile(path) as z:
        out = _dbf(z)
        out["lon"], out["lat"] = _outlets(z, len(out["id"]))
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    np.savez(CACHE, **out)
    return out
