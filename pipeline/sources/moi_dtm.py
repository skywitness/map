"""內政部 100 公尺網格數值高程模型（DEM，政府資料開放授權條款），只用來交叉比對台灣的數字。

清單是政府資料開放平台的 CSV（https://data.gov.tw/dataset/7507），每個縣市一個 zip，
zip 裡每幅圖一個文字檔，每行「E N h」（TWD97 二度分帶坐標、公尺）。
- 航空攝影測量（民國 94–95 年），有台灣本島 18 縣市與澎湖，沒有金門、連江。
- 圖幅的範圍含海面，海面的高度是 0，所以 h > 0 的格子才算陸地。
- 相鄰縣市的圖幅會重疊，同一個坐標只算一次。
"""
from __future__ import annotations

import csv
import io
import urllib.parse
import zipfile
from dataclasses import dataclass

import numpy as np

from common import download

INDEX_URL = (
    "https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/"
    "CE15E53E-3C32-495E-AE0E-308991A36B46/resource/CE6FC5E0-FD77-427E-8EEE-5FA248DB1FA9/download"
)
DATASET_URL = "https://data.gov.tw/dataset/7507"
CELL_KM2 = 0.01


@dataclass
class Summary:
    area_km2: float
    mean: float
    max: float
    max_en: tuple[float, float]  # 最高格的 TWD97 坐標（E, N）
    shares: list[float]  # 依 edges 分段的面積占比（%）


def taiwan_summary(edges: list[float]) -> Summary:
    """讀全部縣市的 100 m DEM，算陸地面積、平均海拔、最高格與高度分布。"""
    index = download(INDEX_URL, "moi-dtm", "index.csv")
    with open(index, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    points: dict[tuple[int, int, bool], float] = {}
    for row in rows:
        name = row["圖資名稱"].strip()
        url = urllib.parse.quote(row["連結網址"].strip(), safe=":/")  # 檔名是中文
        archive = download(url, "moi-dtm", f"{name}.zip")
        penghu = "澎湖" in name  # 澎湖用另一個投影帶的坐標，跟本島分開記，免得坐標剛好重疊
        with zipfile.ZipFile(archive) as z:
            for info in z.infolist():
                if not info.filename.lower().endswith(".grd"):
                    continue
                data = np.loadtxt(io.BytesIO(z.read(info)), ndmin=2)
                for e, n, h in data:
                    points[(int(e), int(n), penghu)] = h
    keys = list(points)
    h = np.array([points[k] for k in keys])
    land = h > 0
    hl = h[land]
    i = int(np.argmax(h))
    counts, _ = np.histogram(hl, bins=[-1e9, *edges[1:-1], 1e9])
    return Summary(
        area_km2=float(land.sum() * CELL_KM2),
        mean=float(hl.mean()),
        max=float(h[i]),
        max_en=(keys[i][0], keys[i][1]),
        shares=[float(c / land.sum() * 100) for c in counts],
    )
