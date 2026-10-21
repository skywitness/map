"""人口主題的框選網格：把 GHS-POP 30 角秒網格彙整成 0.1° 網格，每格再依國界拆開。

前端框選時加總框內的網格，再把每個國家的網格人數縮放到該年的 WPP 人口
（網格決定國內怎麼分布，WPP 決定總量），所以時間軸仍然有意義。

國家歸屬用地圖本身的國界（public/data/geo/countries-50m.json），要先跑 geo 步驟。
"""
from __future__ import annotations

import numpy as np

from build_geo import load_countries
from common import OUT_DIR, now_iso, write_json
from sources import ghsl

CELL_DEG = 0.1  # 約 11 km；gzip 後約 1.6 MB，0.25° 約 0.4 MB 但放大框選城市時太粗
# 1:50m 沒有形狀、離海岸太遠沒被 ghsl.GAP_FILL_PIXELS 補到的小島，歸給這個距離內最近的國家
# （澎湖離台灣本島約 45 km）；更遠的（哥倫比亞的聖安德烈斯島、模里西斯的羅德里格斯島）維持不歸國
ISLAND_RADIUS_DEG = 0.6

# 地圖上有形狀、但 WPP 把人口算在另一個國家的區域
WPP_UNIT = {
    "_SOL": "SOM",  # 索馬利蘭
    "_CYN": "CYP",  # 北賽普勒斯：WPP 的賽普勒斯是全島
    "_IOT": "AUS",  # 聖誕島與科科斯群島
    "NFK": "AUS",  # 諾福克島
    "ALA": "FIN",  # 奧蘭群島
}

# 地圖把這些區域畫在另一個國家的形狀裡，但 WPP 分開計算：依多邊形的範圍（lon0, lat0, lon1, lat1）拆出來
PARTS = {
    "FRA": {  # 法國的形狀含海外省，WPP 的法國不含
        "REU": (55.0, -21.5, 56.0, -20.7),
        "MYT": (44.9, -13.1, 45.4, -12.5),
        "GLP": (-61.9, 15.8, -61.0, 16.6),
        "MTQ": (-61.3, 14.3, -60.7, 14.9),
        "GUF": (-54.7, 2.0, -51.5, 5.9),
    },
    "NLD": {"BES": (-68.5, 12.0, -62.9, 17.7)},  # 波奈、聖佑達修斯、沙巴
    "RUS": {"UKR": (32.4, 44.3, 36.6, 46.3)},  # 克里米亞：地圖畫在俄羅斯，WPP 算在烏克蘭
}

# 依矩形範圍（lon0, lat0, lon1, lat1）改歸屬的像素：(原本的國家, 改歸的國家, 範圍)；None 代表不在任何國界內
OVERRIDES = [
    ("MAR", "ESH", (-17.5, 20.5, -8.0, 27.667)),  # 地圖的摩洛哥形狀含西撒哈拉（北緯 27°40′ 以南），WPP 分開算
    ("ESP", "GIB", (-5.37, 36.105, -5.335, 36.158)),  # 直布羅陀在 1:50m 沒有形狀
    (None, "TUV", (176.0, -10.9, 180.0, -5.5)),  # 吐瓦魯、托克勞在 1:50m 沒有形狀
    (None, "TKL", (-172.6, -9.5, -171.1, -8.5)),
]


def bbox(rings: list) -> tuple[float, float, float, float]:
    xs = [x for ring in rings for x, _y in ring]
    ys = [y for ring in rings for _x, y in ring]
    return min(xs), min(ys), max(xs), max(ys)


def inside(inner: tuple[float, ...], outer: tuple[float, ...]) -> bool:
    return outer[0] <= inner[0] and outer[1] <= inner[1] and inner[2] <= outer[2] and inner[3] <= outer[3]


def unwrap(ring: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """跨過 ±180° 的 ring 改成連續經度。

    俄羅斯本土的 ring 在換日線上有兩個點寫成 −180 而不是 180，平面上直接畫會在
    北緯 65°–69° 拉出一條橫跨全球的帶子，把俄羅斯北部挖空。繞極的 ring（南極洲）展開後
    頭尾接不起來，維持原樣。
    """
    out = [ring[0]]
    for x, y in ring[1:]:
        px = out[-1][0]
        x += 360 * round((px - x) / 360)
        out.append((x, y))
    return out if abs(out[-1][0] - out[0][0]) < 1e-9 else ring


def country_shapes() -> dict[str, list[list]]:
    """{WPP 國家代碼: [多邊形, …]}，已經套用 WPP_UNIT 與 PARTS；跨換日線的多邊形另外補一份平移 360° 的。"""
    out: dict[str, list[list]] = {}
    for iso3, geom in load_countries().items():
        for polygon in geom["coordinates"]:
            unit = WPP_UNIT.get(iso3, iso3)
            polygon = [unwrap(ring) for ring in polygon]
            box = bbox(polygon)
            for target, area in PARTS.get(iso3, {}).items():
                if inside(box, area):
                    unit = target
            out.setdefault(unit, []).append(polygon)
            if box[0] < -180 or box[2] > 180:
                shift = 360 if box[0] < -180 else -360
                out[unit].append([[(x + shift, y) for x, y in ring] for ring in polygon])
    return out


def build() -> None:
    tif = ghsl.raster_path()
    shapes_by_unit = country_shapes()
    codes = sorted(shapes_by_unit.keys() | {target for _s, target, _a in OVERRIDES})
    index = {iso3: i + 1 for i, iso3 in enumerate(codes)}  # 0 保留給「不在任何國界內」

    shapes = []
    for iso3, polygons in shapes_by_unit.items():
        for polygon in polygons:
            shapes.append(({"type": "Polygon", "coordinates": polygon}, index[iso3], bbox(polygon)))
    overrides = [ghsl.Override(index[s] if s else 0, index[t], *area) for s, t, area in OVERRIDES]

    grid = attach_islands(ghsl.aggregate(tif, CELL_DEG, shapes, overrides))
    write_output(grid, codes)


def attach_islands(grid: ghsl.GridResult) -> ghsl.GridResult:
    """不在任何國界內的網格，改歸 ISLAND_RADIUS_DEG 內最近、有國家的網格所屬的國家。"""
    cols = round(360 / CELL_DEG)
    band = int(np.ceil(ISLAND_RADIUS_DEG / CELL_DEG))
    known = np.nonzero(grid.code > 0)[0]  # grid.cell 已經排序，同一列的網格是連續的
    known_cell = grid.cell[known]
    known_row, known_col = np.divmod(known_cell, cols)
    code = grid.code.copy()
    for i in np.nonzero(grid.code == 0)[0]:
        row, col = divmod(int(grid.cell[i]), cols)
        lo, hi = np.searchsorted(known_cell, [(row - band) * cols, (row + band + 1) * cols])
        if lo == hi:
            continue
        dy = (known_row[lo:hi] - row) * CELL_DEG
        dx = ((known_col[lo:hi] - col + cols // 2) % cols - cols // 2) * CELL_DEG * np.cos(np.radians(90 - (row + 0.5) * CELL_DEG))
        d2 = dx * dx + dy * dy
        j = int(np.argmin(d2))
        if d2[j] <= ISLAND_RADIUS_DEG**2:
            code[i] = grid.code[known[lo + j]]

    # 改歸以後，同一格可能出現兩筆同一國，合併
    max_code = int(code.max())
    uniq, inverse = np.unique(grid.cell * (max_code + 1) + code, return_inverse=True)
    pop = np.bincount(inverse, weights=grid.pop)
    return ghsl.GridResult(cell=uniq // (max_code + 1), code=uniq % (max_code + 1), pop=pop, raw_total=grid.raw_total)


def write_output(grid: ghsl.GridResult, codes: list[str]) -> None:
    cols = round(360 / CELL_DEG)
    pop = np.rint(grid.pop).astype(np.int64)
    keep = pop > 0  # 四捨五入成 0 的全球加起來只有幾千人
    cell, code, pop = grid.cell[keep], grid.code[keep].astype(np.int64), pop[keep]

    order = np.lexsort((code, cell))
    cell, code, pop = cell[order], code[order], pop[order]
    write_json(
        OUT_DIR / "topics" / "population" / "grid.json",
        {
            "source": f"JRC GHS-POP R2023A, epoch {ghsl.EPOCH}, 30 arc-seconds",
            "sourceUrl": ghsl.URL,
            "citation": ghsl.CITATION,
            "generatedAt": now_iso(),
            "epoch": ghsl.EPOCH,
            "cellSize": CELL_DEG,
            "cols": cols,
            "countries": codes,
            # 網格編號 = row × cols + col，row 0 從北緯 90° 開始；逐筆差分編碼，同一格的第二個國家差分為 0
            "cell": np.diff(cell, prepend=0).tolist(),
            # countries 的索引；−1 是不在任何國界內（1:50m 沒有形狀的小島，例如澎湖、聖安德烈斯島）
            "country": (code - 1).tolist(),
            "pop": pop.tolist(),
        },
    )
    print(
        f"  原始網格 {grid.raw_total / 1e8:.2f} 億人 → 輸出 {pop.sum() / 1e8:.2f} 億人，"
        f"{len(np.unique(cell))} 格、{len(cell)} 筆；不在國界內 {pop[code == 0].sum():,} 人"
    )
