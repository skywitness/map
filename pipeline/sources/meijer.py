"""Meijer et al. (2021) 的河川塑膠入海量：31,819 個河口，每年流進海洋的漂浮大型塑膠（公噸，模型估計值）。

Meijer, L.J.J., van Emmerik, T., van der Ent, R., Schmidt, C. & Lebreton, L. More than 1000 rivers account for 80%
of global riverine plastic emissions into the ocean. Science Advances 7, eaaz5803 (2021).
https://doi.org/10.1126/sciadv.aaz5803

- 資料：figshare「Supplementary data for 'More than 1000 rivers…'」https://doi.org/10.6084/m9.figshare.14515590.v1
  （figshare API 的 license 是 CC BY 4.0，2026-10-26 查；論文本身是 CC BY-NC 4.0，這裡只用 figshare 的資料）。
  中間情境（mid-point）的 GIS 點檔（shapefile，WGS84），一個欄位 dots_exten（公噸／年），沒有河名與國家。
- 論文：2015 年的排放（輸入的管理不當塑膠垃圾是 Lebreton & Andrady 2019 估計的 2015 年），全世界約 100 萬公噸
  （範圍 80 萬–270 萬）；只算年排放 0.1 公噸以上的河口（論文寫 31,904 個，figshare 的檔是 31,819 個）。
- 國家：依河口的位置用 Natural Earth 1:50m 國界判斷（geoindex.countries_at，海邊的點找 0.3° 內最近的國界），
  論文附錄的國家表是 CC BY-NC，沒有用；pipeline 拿 Our World in Data 轉載的幾個大國比對過（plastic.py）。
"""
from __future__ import annotations

import struct
import zipfile

from common import download

URL = "https://ndownloader.figshare.com/files/27807774"
DOI = "https://doi.org/10.6084/m9.figshare.14515590.v1"
PAPER = "https://doi.org/10.1126/sciadv.aaz5803"
CITATION = (
    "Meijer, L.J.J., van Emmerik, T., van der Ent, R., Schmidt, C. & Lebreton, L. More than 1000 rivers account for 80% "
    "of global riverine plastic emissions into the ocean. Science Advances 7, eaaz5803 (2021). "
    "Data: figshare, doi:10.6084/m9.figshare.14515590.v1 (CC BY 4.0)."
)
YEAR = 2015
BASE = "Meijer2021_midpoint_emissions"
FIELD = "dots_exten"


def _dbf(data: bytes) -> list[dict[str, str]]:
    n, header_len, record_len = struct.unpack("<IHH", data[4:12])
    fields = []
    pos = 32
    while data[pos] != 0x0D:
        name = data[pos : pos + 11].split(b"\0")[0].decode()
        fields.append((name, data[pos + 16]))
        pos += 32
    out = []
    for i in range(n):
        record = data[header_len + i * record_len : header_len + (i + 1) * record_len]
        off, row = 1, {}
        for name, size in fields:
            row[name] = record[off : off + size].decode("latin1").strip()
            off += size
        out.append(row)
    return out


def _points(data: bytes) -> list[tuple[float, float]]:
    out = []
    pos = 100
    while pos < len(data):
        _num, length = struct.unpack(">II", data[pos : pos + 8])
        shape = struct.unpack("<i", data[pos + 8 : pos + 12])[0]
        if shape != 1:
            raise RuntimeError(f"{BASE}.shp 不是點（shape type {shape}）")
        out.append(struct.unpack("<dd", data[pos + 12 : pos + 28]))
        pos += 8 + length * 2
    return out


def outlets() -> list[tuple[float, float, float]]:
    """[(經度, 緯度, 公噸／年)]，依檔案順序。"""
    path = download(URL, "meijer", "Meijer2021_midpoint_emissions.zip")
    with zipfile.ZipFile(path) as z:
        records = _dbf(z.read(f"{BASE}.dbf"))
        points = _points(z.read(f"{BASE}.shp"))
    if len(records) != len(points) or len(points) < 30000:
        raise RuntimeError(f"{BASE} 的點與屬性數量不對（{len(points)}、{len(records)}）")
    return [(x, y, float(r[FIELD])) for (x, y), r in zip(points, records)]
