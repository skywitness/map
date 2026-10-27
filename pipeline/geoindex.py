"""經緯度 → 國家（網站的代碼，ISO alpha-3 等）。

- **判斷位置用 Natural Earth 1:10m 的國界**（ne_10m_admin_0_countries，公有領域），地圖本身仍畫 1:50m（build_geo.py）。
  1:50m 對小地方太粗：香港的形狀只有 23 個頂點，北邊比實際的深圳河偏北 2–3 km，深圳福田、羅湖的店家、大樓、口岸
  都被判成香港（DESIGN.md 第 8 節第 85 點）。1:10m 用 4.1.0 版，跟地圖的 world-atlas 2.0.2（Natural Earth 4.1.0 的
  1:50m）同一版，國家的劃分一樣（克里米亞、西撒哈拉、東耶路撒冷的畫法相同；5.1.2 版把東耶路撒冷畫進以色列），
  只是邊界細很多（香港 399 個頂點）。1:10m 的國界在國界河上仍有幾百公尺的誤差（楚河、噴赤河、普蘇河、沙頭角），
  4.1.0 版的波赫東界更整段偏掉，已知的地方用矩形範圍修正（`BORDER_FIXES`）。
- 國家代碼：名稱跟 1:50m 一樣的單位用 build_geo.unit_id()（world-atlas 的 ISO 數字代碼 → alpha-3，沒有代碼的查
  NO_ID_OVERRIDES），只有 1:10m 才有的單位逐一指定（`TEN_M_ONLY`，沒列到的會報錯）；1:10m 也沒有形狀的台灣離島用
  矩形範圍（`ISLANDS`）。
- 都不在國界內的點（1:10m 的海岸線也有簡化），改找 0.3° 內最近的國界頂點（外環）。
- 速度：先把全世界切成 0.05° 的格子，沒有任何國界線段經過的格子整格屬於同一國（或都不在國界內），用連通區塊一次標好；
  只有國界、海岸線經過的格子才逐點判斷，而且只看跟這個點同一列（緯度帶）的線段。網路速度主題的 2,205 萬個點約 20 秒
  （1:50m 時的逐國射線法約 10 分鐘），建索引 2–6 秒；結果跟逐國、逐環的射線法相同。
- 算面積（`land_polygons()`）仍用地圖的 1:50m，跟地圖畫的形狀一致。
"""
from __future__ import annotations

import json
from functools import lru_cache

from common import OUT_DIR, download

NEAREST_MAX_DEGREES = 0.3
CELL = 0.05  # 預先標好的格子（度）
_CHUNK_CELLS = 4_000_000  # 一批「點數 × 線段數」的上限，控制記憶體

TEN_M_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v4.1.0/geojson/ne_10m_admin_0_countries.geojson"
)
TEN_M_FILE = "ne_10m_admin_0_countries-4.1.0.geojson"

# 1:10m 的名稱 → 1:50m（world-atlas）的名稱：world-atlas 2.0.2 的史瓦帝尼已經改名
NAME_ALIASES = {"Swaziland": "eSwatini"}

# 只有 1:10m 才有的單位 → 網站的代碼。None：不算任何國家，點落在裡面時跟海上的點一樣找 0.3° 內最近的國界頂點。
# 規則：網站有自己代碼的用自己的（地圖上只畫圓點的直布羅陀、吐瓦魯）；其他的照地圖的 1:50m 畫成哪一國
# （在範圍裡取格點用 1:50m 判斷，括號裡是比例）；1:50m 沒有畫、網站也沒有代碼的不算任何國家，跟改用 1:10m 以前一樣。
TEN_M_ONLY: dict[str, str | None] = {
    "Gibraltar": "GIB",  # 1:50m 畫在西班牙裡（100%），網站有自己的圓點，人口網格、網路速度也已經另外歸直布羅陀
    "Tuvalu": "TUV",  # 1:50m 沒有形狀（以前判成沒有國家），網站有自己的圓點
    "Akrotiri": "CYP",  # 英屬基地區，1:50m 畫在賽普勒斯裡（100%）；網站沒有代碼，當地的賽普勒斯居民由賽普勒斯政府管理民政
    "Dhekelia": "CYP",  # 同上（1:50m：賽普勒斯 83%、北賽普勒斯 17%）
    "Baikonur": "KAZ",  # 拜科努爾太空發射場，俄羅斯租用，主權屬哈薩克，1:50m 畫在哈薩克裡（100%）；太空主題寫「算哈薩克」
    "USNB Guantanamo Bay": "CUB",  # 美國租用，主權屬古巴，1:50m 畫在古巴裡（100%）
    # 聯合國緩衝區：1:50m 分別畫在賽普勒斯（83%）、北賽普勒斯（17%）裡；不算任何國家，裡面的點歸最近的一邊，跟地圖的分法接近
    "Cyprus U.N. Buffer Zone": None,
    "U.S. Minor Outlying Is.": None,  # 威克島、中途島等，1:50m 沒有形狀；ISO 3166 另有代碼 UMI，不併進美國
    "Clipperton I.": None,  # 法國的無人島，1:50m 沒有形狀
    "Coral Sea Is.": None,  # 澳洲的無人島（只有氣象站），1:50m 沒有形狀
    # 主權有爭議、1:50m 沒有形狀的島礁：不替爭議下判斷（南沙群島各島分別由越南、菲律賓、中國、馬來西亞、台灣占領，
    # Natural Earth 併成一個單位，台灣的太平島也在裡面）
    "Spratly Is.": None,
    "Scarborough Reef": None,
    "Serranilla Bank": None,
    "Bajo Nuevo Bank": None,
}

# 1:10m 也沒有形狀的台灣離島：馬祖、烏坵、東沙不在台灣的形狀裡，馬祖最近的頂點在福建沿岸（會判成中國），東沙找不到國家；
# 澎湖只有 3 個島有形狀（七美、望安一帶離最近的頂點超過 0.3°）。範圍裡的點一律歸台灣（原本是網路速度主題的
# TAIWAN_ISLANDS，2026-10-27 改用 1:10m 時移到這裡給所有主題用）。範圍都只框住島本身，跟大陸沿岸（黃岐半島約 119.9°E、
# 26.3°N，平潭約 25.7°N 以南，湄洲島約 119.1°E）保持距離，範圍裡沒有 1:10m 中國的多邊形（逐格檢查過）；
# 蘭嶼、綠島在 1:10m 有形狀（框起來也一樣），金門在國界裡、不必框。
ISLANDS: dict[str, tuple[str, tuple[float, float, float, float]]] = {
    "澎湖": ("TWN", (119.25, 23.15, 119.75, 23.85)),
    "馬祖（南竿、北竿）": ("TWN", (119.88, 26.12, 120.05, 26.27)),
    "馬祖（莒光）": ("TWN", (119.90, 25.93, 120.00, 26.00)),
    "馬祖（東引）": ("TWN", (120.45, 26.33, 120.53, 26.40)),
    "烏坵": ("TWN", (119.43, 24.96, 119.48, 25.00)),
    "蘭嶼": ("TWN", (121.47, 21.98, 121.63, 22.10)),
    "綠島": ("TWN", (121.45, 22.62, 121.53, 22.70)),
    "東沙": ("TWN", (116.65, 20.65, 116.80, 20.75)),
}

# 1:10m（4.1.0 版）國界已知錯的地方：{名稱: ([範圍…], 規則, 理由與證據)}，範圍是 (經度起, 緯度起, 經度迄, 緯度迄)。
# 規則是國家代碼時，範圍裡的點一律歸那一國；「50m:代碼」時，範圍裡 1:50m（地圖畫的國界）算在那一國的點歸那一國，
# 其他的點照 1:10m。範圍只框住判錯的地方，逐點、逐圖塊檢查過（DESIGN.md 第 8 節第 85 點）；店名、地名是獨立於國界的證據。
Box = tuple[float, float, float, float]
BORDER_FIXES: dict[str, tuple[list[Box], str, str]] = {
    "波赫東部": (
        # 三個範圍拼起來，留出德里納河東岸塞爾維亞的柳博維亞（44.19°N、19.37°E，1:50m 也畫進波赫；店名 Аман 是塞爾維亞的連鎖）
        [(18.20, 42.55, 19.60, 44.15), (18.20, 44.15, 19.36, 44.24), (18.20, 44.24, 19.60, 44.92)], "50m:BIH",
        "4.1.0 版 1:10m 的波赫東界、南界整段偏進波赫（約 5,000 km²：塞姆貝里亞、茲沃爾尼克、魯多、恰伊尼切畫成塞爾維亞、"
        "蒙特內哥羅、克羅埃西亞）；5.1.2 版修正了，修正後的界線跟 1:50m 一致（範圍裡 1:50m 算波赫的 0.01° 格點 97.7% 跟 "
        "5.1.2 相同）；店名是波士尼亞的拉丁字母與塞族共和國的西里爾字母（Novo Rudo、s.t.r. Tojić、Trgovina mješovite robe），"
        "茲沃爾尼克北邊的 nestro 是塞族共和國的加油站連鎖",
    ),
    "托克馬克": (
        [(75.255, 42.838, 75.325, 42.853)], "50m:KGZ",
        "吉爾吉斯的托克馬克（Natural Earth 城市點 42.83°N、75.28°E）在楚河南岸，1:10m 的國界偏南把市區畫進哈薩克；"
        "店名有吉爾吉斯文（Жыргал、Эне-Сай、Ала-Тоо、Нуржаз）；北邊 1:50m 也算哈薩克的店（Аружан、Триада）照舊",
    ),
    "肯布倫": (
        [(75.118, 42.871, 75.168, 42.877)], "50m:KGZ",
        "楚河南岸吉爾吉斯的肯布倫村（店名「Каныкей с. Кен-булун」寫明在 Кен-Булун 村），1:10m 畫成哈薩克",
    ),
    "噴赤河：魯山以西 A": (
        [(71.380, 37.908, 71.388, 37.916)], "TJK",
        "噴赤河沿岸塔吉克一側的店（店名是塔吉克的西里爾字母 Магазин、Омехта），1:10m 畫成阿富汗",
    ),
    "噴赤河：魯山以西 B": (
        [(71.426, 37.924, 71.439, 37.930)], "TJK",
        "同上（Фирдавс、Магазин）",
    ),
    "噴赤河：蘭加爾": (
        [(72.670, 37.048, 72.678, 37.055)], "TJK",
        "瓦罕谷塔吉克一側的蘭加爾村（店名 Беҳруз 是塔吉克的西里爾字母），1:10m、1:50m 都有畫成阿富汗的",
    ),
    "韋肖洛耶": (
        [(39.980, 43.384, 40.0045, 43.4075)], "RUS",
        "索契市阿德勒區的韋肖洛耶在普蘇河西岸（俄羅斯），1:10m 把它畫進阿布哈茲（喬治亞）；店是俄羅斯的連鎖"
        "（Магнит、克拉斯諾達爾邊疆區的「Агрокомплекс Выселковский」）；範圍只到這些店的東邊（40.0045°E）與北邊（43.4075°N），"
        "河邊靠近口岸、沒有店名的幾家照 1:10m",
    ),
    "班吉市中心": (
        [(18.570, 4.358, 18.600, 4.372)], "CAF",
        "中非首都班吉的市中心（Natural Earth 城市點 4.37°N、18.56°E，中央市場 Marché Central）在烏班吉河北岸，"
        "1:10m 把河岸一帶畫成剛果民主共和國；對岸的宗戈在 4.33°N",
    ),
    "哈尼伊埃雷齊": (
        [(21.290, 42.142, 21.312, 42.158)], "XKX",
        "科索沃的哈尼伊埃雷齊（OSM 的數據中心寫 addr:country=XK、addr:city=Hani i Elezit），1:10m 的國界偏北、畫成北馬其頓",
    ),
    "沙頭角北邊": (
        [(114.220, 22.550, 114.290, 22.575)], "CHN",
        "深圳鹽田區的沙頭角在香港沙頭角（中英街）的北邊，1:10m 的香港往北、往東多畫了約 1 km；範圍的南界 22.550°N "
        "在香港那一側的店（22.546°N 的 7-Eleven）北邊，範圍裡的店名都是簡體字（美宜佳、麦当劳），美宜佳是廣東的連鎖、香港沒有",
    ),
}

Ring = list[tuple[float, float]]


# ── 地圖的 1:50m（算面積） ─────────────────────────────────────────


@lru_cache(maxsize=1)
def _polygons() -> list[tuple[str, list[list[Ring]]]]:
    """地圖的 1:50m 國界：每個國家的多邊形清單，每個多邊形是 [外環, 洞…]（原始的經度，跨過 ±180° 的環會跳 360°）"""
    path = OUT_DIR / "geo" / "countries-50m.json"
    if not path.exists():
        raise RuntimeError("找不到國界檔，請先執行 geo 步驟")
    with open(path, encoding="utf-8") as f:
        topo = json.load(f)
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs: list[Ring] = []
    for arc in topo["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * sx + tx, y * sy + ty))
        arcs.append(points)

    def ring(indexes: list[int]) -> Ring:
        points: Ring = []
        for i in indexes:
            arc = arcs[i] if i >= 0 else arcs[~i][::-1]
            points.extend(arc if not points else arc[1:])
        return points

    out = []
    for geom in topo["objects"]["countries"]["geometries"]:
        polygons = [geom["arcs"]] if geom["type"] == "Polygon" else geom["arcs"]
        out.append((geom["id"], [[ring(r) for r in polygon] for polygon in polygons]))
    return out


def land_polygons() -> list[tuple[str, list[list[Ring]]]]:
    """算面積用：地圖的 1:50m 國界，跨過 ±180° 的展開成連續經度，不含 _wrapped() 補的平移 360° 的副本。

    面積跟地圖畫的形狀一致（交通主題的鐵路密度用這個面積）；平移的副本會重複計算（俄羅斯本土的環整個多一份，
    面積變成兩倍），換日線修好以前跳 360° 的邊則讓俄羅斯少算約 600 萬 km²、斐濟多算約 14 萬 km²。
    """
    return [(iso3, [_wrapped(polygon)[0] for polygon in polygons]) for iso3, polygons in _polygons()]


def _unwrap(ring: Ring) -> Ring:
    """跨過 ±180° 的環改成連續的經度；繞極的環（南極洲）展開後頭尾接不起來，維持原樣（同 population_grid.unwrap）"""
    out = [ring[0]]
    for x, y in ring[1:]:
        x += 360 * round((out[-1][0] - x) / 360)
        out.append((x, y))
    return out if abs(out[-1][0] - out[0][0]) < 1e-9 else ring


def _wrapped(polygon: list[Ring]) -> list[list[Ring]]:
    """跨過 ±180° 的多邊形：展開成連續經度，超出 ±180° 的部分再補一份平移 360° 的。

    不展開的話，從 179.9° 跳到 −180° 的邊會橫跨整個地圖，射線法在那幾個緯度把整條帶子都判成在環裡：
    1:50m 俄羅斯本土的環在北緯約 65°–69°（楚科奇）有這樣的邊，原本挪威的博德、芬蘭的羅瓦涅米、瑞典的呂勒奧
    這些點都被判成俄羅斯（2026-10-27 網路速度主題發現的）；斐濟跨過 ±180° 的多邊形也一樣，南緯約 16.5° 的
    玻利維亞拉巴斯、馬達加斯加、波拉波拉島的點被判成斐濟（DESIGN.md 第 8 節第 79 點）。1:10m 的環在 ±180° 切開，
    沒有這樣的環，仍然照同樣的方式處理。
    """
    unwrapped = [_unwrap(r) for r in polygon]
    if unwrapped == polygon:
        return [polygon]
    out = [unwrapped]
    xs = [x for r in unwrapped for x, _y in r]
    if max(xs) > 180:
        out.append([[(x - 360, y) for x, y in r] for r in unwrapped])
    if min(xs) < -180:
        out.append([[(x + 360, y) for x, y in r] for r in unwrapped])
    return out


# ── 判斷位置的 1:10m ───────────────────────────────────────────────


def ten_m_units() -> list[tuple[str, str | None]]:
    """1:10m 的每個單位：(Natural Earth 的名稱, 網站的代碼或 None)。對不上的報錯。"""
    from build_geo import unit_id, world_atlas_units

    fifty = world_atlas_units()
    out = []
    unknown = []
    for feature in _ten_m_features():
        name = feature["properties"]["NAME"]
        key = NAME_ALIASES.get(name, name)
        if key in fifty:
            out.append((name, unit_id(key, fifty[key])[0]))
        elif name in TEN_M_ONLY:
            out.append((name, TEN_M_ONLY[name]))
        else:
            unknown.append(name)
    if unknown:
        raise ValueError(f"1:10m 有 1:50m 沒有、也沒有寫在 TEN_M_ONLY 的單位：{unknown}")
    unused = set(TEN_M_ONLY) - {name for name, _iso in out}
    if unused:
        raise ValueError(f"TEN_M_ONLY 的 {sorted(unused)} 不在 1:10m 的國界裡")
    known = {unit_id(k, v)[0] for k, v in fifty.items()} | {"GIB", "TUV", "TKL"}  # 後三個是地圖上只畫圓點的地方
    bad = {iso for _name, iso in out if iso is not None and iso not in known}
    if bad:
        raise ValueError(f"1:10m 的單位對到地圖沒有的代碼：{sorted(bad)}")
    return out


@lru_cache(maxsize=1)
def _ten_m_features() -> list[dict]:
    path = download(TEN_M_URL, "natural-earth", TEN_M_FILE)
    with open(path, encoding="utf-8") as f:
        return json.load(f)["features"]


@lru_cache(maxsize=1)
def _countries() -> list[tuple[str, list[list[Ring]]]]:
    """判斷位置用：(國家, 多邊形)，依 1:10m 的順序，同一個代碼的單位合併；跨過 ±180° 的多邊形含 _wrapped() 補的副本"""
    merged: dict[str, list[list[Ring]]] = {}
    for feature, (_name, iso3) in zip(_ten_m_features(), ten_m_units()):
        if iso3 is None:
            continue
        geom = feature["geometry"]
        polygons = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
        target = merged.setdefault(iso3, [])
        for polygon in polygons:
            target.extend(_wrapped([[(float(x), float(y)) for x, y, *_ in ring] for ring in polygon]))
    return list(merged.items())


class _Index:
    """1:10m 國界的索引：所有線段依緯度列分組、0.05° 格子的預先判斷、外環頂點依 0.3° 分桶。"""

    def __init__(self) -> None:
        import numpy as np
        from scipy import ndimage

        countries = _countries()
        self.codes = [iso3 for iso3, _polygons in countries]
        x1, y1, x2, y2, edge_ring = [], [], [], [], []
        ring_poly, ring_hole, poly_country = [], [], []
        vx, vy, vc = [], [], []
        for ci, (_iso3, polygons) in enumerate(countries):
            for polygon in polygons:
                pi = len(poly_country)
                poly_country.append(ci)
                for k, ring in enumerate(polygon):
                    a = np.asarray(ring, dtype=float)
                    if len(a) < 2:
                        continue
                    if (a[0] != a[-1]).any():
                        a = np.vstack([a, a[:1]])
                    ri = len(ring_poly)
                    ring_poly.append(pi)
                    ring_hole.append(k > 0)
                    x1.append(a[:-1, 0])
                    y1.append(a[:-1, 1])
                    x2.append(a[1:, 0])
                    y2.append(a[1:, 1])
                    edge_ring.append(np.full(len(a) - 1, ri))
                    if k == 0:
                        vx.append(a[:, 0])
                        vy.append(a[:, 1])
                        vc.append(np.full(len(a), ci))
        self.x1, self.y1 = np.concatenate(x1), np.concatenate(y1)
        self.x2, self.y2 = np.concatenate(x2), np.concatenate(y2)
        self.edge_ring = np.concatenate(edge_ring)
        self.ring_poly = np.asarray(ring_poly)
        self.ring_hole = np.asarray(ring_hole)
        self.poly_country = np.asarray(poly_country)
        self.nx, self.ny = round(360 / CELL), round(180 / CELL)

        # 線段依緯度列分組（射線往東，只有 y 範圍含這個點的線段會相交，一定在這個點的那一列）
        r0 = self._row(np.minimum(self.y1, self.y2))
        r1 = self._row(np.maximum(self.y1, self.y2))
        span = r1 - r0 + 1
        edges = np.repeat(np.arange(len(self.x1)), span)
        rows = np.repeat(r0, span) + (np.arange(len(edges)) - np.repeat(np.cumsum(span) - span, span))
        order = np.lexsort((edges, rows))  # 同一列裡依線段順序，也就是依環的順序
        self.row_edges = edges[order]
        self.row_ptr = np.searchsorted(rows[order], np.arange(self.ny + 1))

        # 有線段經過的格子（線段先切成不超過一格長，每段的範圍外擴一點點，落在格線上的也算兩邊）
        marked = np.zeros((self.ny, self.nx), dtype=bool)
        dx, dy = self.x2 - self.x1, self.y2 - self.y1
        pieces = np.maximum(1, np.ceil(np.maximum(np.abs(dx), np.abs(dy)) / CELL)).astype(np.int64)
        e = np.repeat(np.arange(len(dx)), pieces)
        k = np.arange(len(e)) - np.repeat(np.cumsum(pieces) - pieces, pieces)
        t0, t1 = k / pieces[e], (k + 1) / pieces[e]
        ax, ay = self.x1[e] + dx[e] * t0, self.y1[e] + dy[e] * t0
        bx, by = self.x1[e] + dx[e] * t1, self.y1[e] + dy[e] * t1
        eps = 1e-9
        cx0, cx1 = self._col(np.minimum(ax, bx) - eps), self._col(np.maximum(ax, bx) + eps)
        cy0, cy1 = self._row(np.minimum(ay, by) - eps), self._row(np.maximum(ay, by) + eps)
        for ox in range(3):
            for oy in range(3):
                ok = (cx0 + ox <= cx1) & (cy0 + oy <= cy1)
                marked[cy0[ok] + oy, cx0[ok] + ox] = True
        self.marked_share = marked.mean()

        # 沒有線段經過的格子：連通的一片整片在同一國（或都不在國界內），每片取一格的中心判斷
        labels, n = ndimage.label(~marked)
        first = np.unique(labels.ravel(), return_index=True)[1][1:]  # 每片的第一格（標籤 0 是有線段的格子）
        fy, fx = np.divmod(first, self.nx)
        found = self._exact((fx + 0.5) * CELL - 180, (fy + 0.5) * CELL - 90)
        lookup = np.concatenate([[-2], found]).astype(np.int16)  # -2：有線段經過，要逐點判斷；-1：不在任何國界內
        self.cell = lookup[labels]
        self.pieces = n

        # 外環的頂點依 0.3° 分桶（找最近的頂點用）；_wrapped() 的副本只留 ±180° 外 0.3° 以內的
        self.vx, self.vy, self.vc = np.concatenate(vx), np.concatenate(vy), np.concatenate(vc)
        keep = np.abs(self.vx) <= 180 + 2 * NEAREST_MAX_DEGREES
        self.vx, self.vy, self.vc = self.vx[keep], self.vy[keep], self.vc[keep]
        vkey = self._bucket(self.vx, self.vy)
        order = np.argsort(vkey, kind="stable")
        self.vx, self.vy, self.vc, self.vkey = self.vx[order], self.vy[order], self.vc[order], vkey[order]

    def _row(self, y):
        import numpy as np

        return np.clip(np.floor((y + 90) / CELL).astype(np.int64), 0, self.ny - 1)

    def _col(self, x):
        import numpy as np

        return np.clip(np.floor((x + 180) / CELL).astype(np.int64), 0, self.nx - 1)

    _NB = round(360 / NEAREST_MAX_DEGREES) + 8  # 分桶的欄數（含 ±180° 外的副本）

    def _bucket(self, x, y):
        import numpy as np

        bx = np.floor((x + 180) / NEAREST_MAX_DEGREES).astype(np.int64) + 4
        by = np.floor((y + 90) / NEAREST_MAX_DEGREES).astype(np.int64) + 4
        return by * self._NB + bx

    def _exact(self, x, y):
        """逐點的射線法（規則同 1:50m 時的 _inside()）：第一個包含這個點的國家（依國家順序），都不在時是 -1"""
        import numpy as np

        out = np.full(len(x), -1)
        rows = self._row(y)
        order = np.argsort(rows, kind="stable")
        bounds = np.searchsorted(rows[order], np.arange(self.ny + 1))
        for r in np.nonzero(np.diff(bounds))[0]:
            pts = order[bounds[r] : bounds[r + 1]]
            edges = self.row_edges[self.row_ptr[r] : self.row_ptr[r + 1]]
            if not len(edges):
                continue
            ex1, ey1, ex2, ey2 = self.x1[edges], self.y1[edges], self.x2[edges], self.y2[edges]
            rings = self.edge_ring[edges]
            starts = np.concatenate([[0], np.nonzero(np.diff(rings))[0] + 1])
            ring_ids = rings[starts]
            polys, inverse = np.unique(self.ring_poly[ring_ids], return_inverse=True)
            weight = np.zeros((len(ring_ids), len(polys)), dtype=np.int32)
            weight[np.arange(len(ring_ids)), inverse] = np.where(self.ring_hole[ring_ids], -2, 1)
            country = self.poly_country[polys]
            step = max(1, _CHUNK_CELLS // len(edges))
            with np.errstate(divide="ignore", invalid="ignore"):
                for s in range(0, len(pts), step):
                    p = pts[s : s + step]
                    px, py = x[p, None], y[p, None]
                    cross = ((ey1 > py) != (ey2 > py)) & (px < (ex2 - ex1) * (py - ey1) / (ey2 - ey1) + ex1)
                    parity = np.add.reduceat(cross.astype(np.uint8), starts, axis=1) & 1  # uint8 溢位不影響奇偶
                    inside = (parity.astype(np.int32) @ weight) == 1  # 在外環裡、不在任何洞裡
                    best = np.where(inside, country[None, :], np.iinfo(np.int64).max).min(axis=1)
                    out[p] = np.where(best == np.iinfo(np.int64).max, -1, best)
        return out

    def _nearest(self, x, y):
        """0.3° 內最近的外環頂點所屬的國家（同樣近的取國家順序在前的），沒有時是 -1"""
        import numpy as np

        out = np.full(len(x), -1)
        keys = self._bucket(x, y)
        order = np.argsort(keys, kind="stable")
        uniq, first = np.unique(keys[order], return_index=True)
        bounds = np.append(first, len(order))
        r2 = NEAREST_MAX_DEGREES**2
        for i, key in enumerate(uniq):
            pts = order[bounds[i] : bounds[i + 1]]
            cand = []
            for dy in (-1, 0, 1):
                lo = np.searchsorted(self.vkey, key + dy * self._NB - 1, "left")
                hi = np.searchsorted(self.vkey, key + dy * self._NB + 1, "right")
                cand.append(np.arange(lo, hi))
            v = np.concatenate(cand)
            if not len(v):
                continue
            step = max(1, _CHUNK_CELLS // len(v))
            for s in range(0, len(pts), step):
                p = pts[s : s + step]
                d2 = (self.vx[v][None, :] - x[p, None]) ** 2 + (self.vy[v][None, :] - y[p, None]) ** 2
                m = d2.min(axis=1)
                tie = np.where(d2 == m[:, None], self.vc[v][None, :], np.iinfo(np.int64).max).min(axis=1)
                out[p] = np.where(m < r2, tie, -1)
        return out

    def lookup(self, x, y):
        import numpy as np

        found = self.cell[self._row(y), self._col(x)].astype(np.int64)
        edge = np.nonzero(found == -2)[0]
        if len(edge):
            found[edge] = self._exact(x[edge], y[edge])
        rest = np.nonzero(found < 0)[0]
        if len(rest):
            found[rest] = self._nearest(x[rest], y[rest])
        return found


@lru_cache(maxsize=1)
def _index() -> _Index:
    return _Index()


@lru_cache(maxsize=None)
def _fifty_m_rings(iso3: str) -> list[tuple[object, list[object]]]:
    """地圖的 1:50m 裡這個國家的多邊形：[(外環, [洞…])]，numpy 的 (x, y) 陣列（BORDER_FIXES 的「50m:」規則用）"""
    import numpy as np

    for code, polygons in land_polygons():
        if code == iso3:
            return [(np.asarray(p[0], dtype=float), [np.asarray(h, dtype=float) for h in p[1:]]) for p in polygons]
    raise ValueError(f"1:50m 沒有 {iso3}")


def _inside_ring(x, y, ring):
    """射線法（規則同 _Index._exact），x、y 是一批點"""
    import numpy as np

    xi, yi = ring[:, 0], ring[:, 1]
    xj, yj = np.roll(xi, 1), np.roll(yi, 1)
    out = np.zeros(len(x), dtype=bool)
    step = max(1, _CHUNK_CELLS // len(ring))
    with np.errstate(divide="ignore", invalid="ignore"):
        for s in range(0, len(x), step):
            px, py = x[s : s + step, None], y[s : s + step, None]
            cross = ((yi > py) != (yj > py)) & (px < (xj - xi) * (py - yi) / (yj - yi) + xi)
            out[s : s + step] = (cross.sum(axis=1) % 2) == 1
    return out


def _in_fifty_m(iso3: str, x, y):
    """這些點在不在地圖的 1:50m 裡的這個國家"""
    import numpy as np

    out = np.zeros(len(x), dtype=bool)
    for outer, holes in _fifty_m_rings(iso3):
        hit = _inside_ring(x, y, outer)
        for hole in holes:
            hit &= ~_inside_ring(x, y, hole)
        out |= hit
    return out


def countries_at(lons, lats) -> list[str | None]:
    """一批點各自的國家：第一個包含這個點的國家（依 1:10m 的順序）；都不在國界內時取 0.3° 內最近的國界頂點，再沒有是 None。
    ISLANDS、BORDER_FIXES 範圍裡的點照它們的規則。"""
    import numpy as np

    x, y = np.asarray(lons, dtype=float), np.asarray(lats, dtype=float)
    if not len(x):
        return []
    index = _index()
    out = np.array([index.codes[c] if c >= 0 else None for c in index.lookup(x, y)], dtype=object)
    for iso3, (x0, y0, x1, y1) in ISLANDS.values():
        out[(x >= x0) & (x <= x1) & (y >= y0) & (y <= y1)] = iso3
    for boxes, rule, _why in BORDER_FIXES.values():
        inside = np.zeros(len(x), dtype=bool)
        for x0, y0, x1, y1 in boxes:
            inside |= (x >= x0) & (x <= x1) & (y >= y0) & (y <= y1)
        hit = np.nonzero(inside)[0]
        if not len(hit):
            continue
        if rule.startswith("50m:"):
            iso3 = rule[4:]
            hit = hit[_in_fifty_m(iso3, x[hit], y[hit])]
        else:
            iso3 = rule
        out[hit] = iso3
    return out.tolist()


def country_at(lon: float, lat: float) -> str | None:
    return countries_at([lon], [lat])[0]
