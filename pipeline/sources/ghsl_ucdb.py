"""JRC GHSL 的城市資料（CC BY 4.0，© European Union）：GHS-UCDB R2024A（Urban Centre Database 2025）與各國的城鄉人口。

全部是 GHSL 2023 年資料包（GHS P2023：GHS-POP R2023A 人口網格、GHS-SMOD R2023A 城鄉分類）這一系列，彼此一致：
- 城市（urban centre，城市中心）：依「城鄉程度」（Degree of Urbanisation，聯合國統計委員會 2020 年採用的國際比較定義），
  每 km² 1,500 人以上的 1 km 格子連成一片、合計 5 萬人以上，邊界再平滑、補洞。是「連續的市區」，不是行政區。
- `GENERAL`：UCDB 的一般屬性（主要名稱、範圍內的地名、國家、首都、2025 年的範圍與人口）與人口加權的中心點
  （GeoPackage 的 `UC_centroids` 表，Mollweide 投影 ESRI:54009，這裡換成經緯度）。CSV 是 UTF-8，名稱用它。
- `MTUC`：UCDB 的多時期城市（multitemporal urban centres），1975–2030 每 5 年，每一期用那一期的城市範圍算人口與面積，
  還不是城市的年份是空的；2025 年的每個城市都在裡面（同一個 ID）。CSV 是 cp1252，非拉丁字母的名稱變成「?」，
  而且數字有千分位，所以只用它的 ID 與數值。另外有 264 個 2025 年 UCDB 沒有收的實體（國家欄是 #N/A），不用。
- `STATS`：GHS-COUNTRY-STATS R2024A，GADM 4.1 每個國家、每一期住在城市（UC）、城鎮與半密集區（urban cluster，UCL）、
  鄉村（RUR）的人口。GADM 的「China」含香港、澳門；台灣是 TWN，計算用的是網格，所以有台灣。
  跟 MTUC 同一套網格與分類：2025 年各國城市人口的合計跟 MTUC 的城市加總完全相同（台灣 18,781,891 人）。

GHSL 另外有 GHS-WUP R2025（給聯合國 World Urbanization Prospects 2025 用的長期推估，配合 WPP 2024 的人口），
JRC 寫明它跟 P2023、UCDB R2024A 是「不相容的資料流」，所以這裡全部用 P2023 這一系列（見 DESIGN.md 第 8 節第 67 點）。
"""
from __future__ import annotations

import csv
import io
import sqlite3
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

import openpyxl
from rasterio.warp import transform

from common import download

BASE = "https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL"
GENERAL_NAME = "GHS_UCDB_THEME_GENERAL_CHARACTERISTICS_GLOBE_R2024A"
GENERAL = (
    f"{BASE}/GHS_UCDB_GLOBE_R2024A/GHS_UCDB_THEME_GLOBE_R2024A/{GENERAL_NAME}/V1-2/{GENERAL_NAME}_V1_2.zip"
)
MTUC_NAME = "GHS_UCDB_MTUC_GLOBE_R2024A"
MTUC = f"{BASE}/GHS_UCDB_GLOBE_R2024A/{MTUC_NAME}/V1-2/{MTUC_NAME}_V1_2.zip"
STATS = f"{BASE}/GHS_COUNTRY_STATS_MT_GLOBE_R2024A/V1-0/GHS_COUNTRY_STATS_MT_GLOBE_R2024A.zip"
STATS_XLSX = "GHS-COUNTRY-STATS_MT_GLOBE_R2024_V1_0.xlsx"
CACHE = "ghsl-ucdb"

EPOCHS = list(range(1975, 2031, 5))
PROJECTION_FROM = 2025  # GHS-POP R2023A 的 2025、2030 是推估

CITATION_UCDB = (
    "Mari Rivero, I., Melchiorri, M., Florio, P., Schiavina, M., Goch, K., Politis, P., Uhl, J. H., Pesaresi, M., "
    "Maffenini, L., Sulis, P., Crippa, M., Guizzardi, D., Pisoni, E., Belis, C., Jacome Felix Oom, D., Branco, A., "
    "Mwaniki, D., Kochulem, E., Githira, D., Carioli, A., Ehrlich, D., Tommasi, P., Kemper, T., Dijkstra, L. (2024): "
    "GHS-UCDB R2024A - GHS Urban Centre Database 2025. European Commission, Joint Research Centre (JRC). "
    "doi:10.2905/1a338be6-7eaf-480c-9664-3a8ade88cbcd"
)
CITATION_STATS = (
    "Carioli, A., Schiavina, M., Melchiorri, M. (2024): GHS-COUNTRY-STATS R2024A - GHSL Country Statistics by "
    "Degree of Urbanisation, multitemporal (1975-2030). European Commission, Joint Research Centre (JRC)."
)


@dataclass
class UrbanCentre:
    id: int
    name: str
    names: list[str]  # 範圍內的地名（GC_UCN_LIS，依 OSM 的人口排序，第一個不一定是主要名稱）
    country: str  # GADM 的國名
    capital: bool
    lon: float
    lat: float
    pop: dict[int, float] = field(default_factory=dict)  # 期 → 人口（那一期的城市範圍）；還不是城市的期沒有
    area: dict[int, float] = field(default_factory=dict)  # 期 → km²


def _zip(url: str) -> Path:
    return download(url, CACHE, url.rsplit("/", 1)[1])


def _extract(archive: Path, member: str) -> Path:
    """GeoPackage 要是實際的檔案 sqlite 才讀得到，解壓到快取資料夾（zip 比較新時重新解壓）。"""
    target = archive.parent / member
    if not target.exists() or target.stat().st_mtime < archive.stat().st_mtime:
        with zipfile.ZipFile(archive) as z, z.open(member) as src, open(target, "wb") as dst:
            while chunk := src.read(1 << 22):
                dst.write(chunk)
    return target


def _number(value: str | None) -> float | None:
    text = (value or "").replace(",", "").strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def urban_centres() -> list[UrbanCentre]:
    """UCDB 2025 的 11,422 個城市，含 1975–2030 每一期的人口與面積。"""
    general = _zip(GENERAL)
    with zipfile.ZipFile(general) as z:
        text = z.read(f"{GENERAL_NAME}.csv").decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(text)))

    gpkg = _extract(general, f"{GENERAL_NAME}.gpkg")
    con = sqlite3.connect(gpkg)
    try:
        centroids = {
            int(i): (x, y) for i, x, y in con.execute("SELECT ID_UC_G0, GC_UCC_LON_2025, GC_UCC_LAT_2025 FROM UC_centroids")
        }
    finally:
        con.close()
    ids = [int(r["ID_UC_G0"]) for r in rows]
    missing = [i for i in ids if i not in centroids]
    if missing:
        raise RuntimeError(f"UCDB 有 {len(missing)} 個城市沒有中心點：{missing[:5]}")
    lons, lats = transform("ESRI:54009", "EPSG:4326", [centroids[i][0] for i in ids], [centroids[i][1] for i in ids])

    centres: dict[int, UrbanCentre] = {}
    for r, lon, lat in zip(rows, lons, lats):
        names = [n.strip() for n in (r["GC_UCN_LIS_2025"] or "").split(";") if n.strip()]
        centres[int(r["ID_UC_G0"])] = UrbanCentre(
            id=int(r["ID_UC_G0"]),
            name=(r["GC_UCN_MAI_2025"] or "").strip() or (names[0] if names else ""),
            names=list(dict.fromkeys(names)),
            country=r["GC_CNT_GAD_2025"],
            capital=r["GC_UCM_CAP"] == "1",
            lon=lon,
            lat=lat,
        )

    with zipfile.ZipFile(_zip(MTUC)) as z:
        mtuc = z.read(f"{MTUC_NAME}.csv").decode("cp1252")
    found = 0
    for r in csv.DictReader(io.StringIO(mtuc)):
        c = centres.get(int(r["ID_MTUC_G0"]))
        if c is None:
            continue  # 2025 年 UCDB 沒有收的實體（國家是 #N/A）
        found += 1
        for y in EPOCHS:
            pop = _number(r.get(f"MT_POP_TOT_{y}"))
            area = _number(r.get(f"MT_UCA_KM2_{y}"))
            if pop and pop > 0 and area and area > 0:
                c.pop[y] = pop
                c.area[y] = area
    if found != len(centres):
        raise RuntimeError(f"MTUC 只對到 {found} 個城市，UCDB 有 {len(centres)} 個")
    no_2025 = [c.name for c in centres.values() if 2025 not in c.pop]
    if no_2025:
        raise RuntimeError(f"有 {len(no_2025)} 個 2025 年的城市在 MTUC 沒有 2025 年的人口：{no_2025[:5]}")
    return list(centres.values())


@dataclass
class CountryStats:
    names: dict[str, str]  # GADM 國名 → GADM ISO
    pop: dict[str, dict[int, tuple[float, float, float]]]  # ISO → 期 → (城市, 城鎮與半密集區, 鄉村)
    built: dict[str, dict[int, float]]  # ISO → 期 → 建物面積（km²，屋頂覆蓋的面積，城鄉加總；工作表 BU_S_km2_L1）


def country_stats() -> CountryStats:
    with zipfile.ZipFile(_zip(STATS)) as z:
        wb = openpyxl.load_workbook(io.BytesIO(z.read(STATS_XLSX)), read_only=True, data_only=True)
    names: dict[str, str] = {}

    def sheet(title: str) -> dict[str, dict[str, list[float]]]:
        """工作表 → ISO → 城鄉類別（UC、UCL、RUR）→ 各期的值"""
        rows = list(wb[title].iter_rows(values_only=True))
        years = [int(str(h)) for h in rows[0][4:]]
        if years != EPOCHS:
            raise RuntimeError(f"GHS-COUNTRY-STATS 的 {title} 年份不是 1975–2030 每 5 年：{years}")
        parts: dict[str, dict[str, list[float]]] = {}
        for r in rows[1:]:
            if not r[1]:
                continue
            iso, name, cls = str(r[1]), str(r[2]), str(r[3])
            names[name] = iso
            parts.setdefault(iso, {})[cls] = [float(v or 0) for v in r[4:]]
        return {iso: p for iso, p in parts.items() if {"UC", "UCL", "RUR"} <= p.keys()}

    pop = {iso: {y: (p["UC"][i], p["UCL"][i], p["RUR"][i]) for i, y in enumerate(EPOCHS)} for iso, p in sheet("POP_L1").items()}
    built = {iso: {y: p["UC"][i] + p["UCL"][i] + p["RUR"][i] for i, y in enumerate(EPOCHS)} for iso, p in sheet("BU_S_km2_L1").items()}
    return CountryStats(names=names, pop=pop, built=built)
