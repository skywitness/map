"""Climate TRACE 排放清冊 5.12.0（https://climatetrace.org，CC BY 4.0；製作手冊第十七批 268，2026-11-02）。

- 來源：Climate TRACE 放在 Zenodo 的官方存檔（RECORD，DOI 10.5281/zenodo.23789204，2026-10-29，資料到 2026 年 8 月）。
  下載頁（downloads.climatetrace.org/latest）的國家包、部門包到 2026-11-02 還是 5.10.0，最新版只在 Zenodo（使用者 2026-11-02
  決定用 Zenodo）。每個子部門一個 zip，裡面是 Parquet：
  - `<子部門>_country_emissions_monthly_v5_12_0.parquet`：各國每月的排放（2015 年 1 月起），氣體 co2、ch4、n2o、co2e_100yr、co2e_20yr。
  - `<子部門>_emissions_sources_v5_12_0.parquet`：每個排放源每月的排放（2021 年 1 月起），含座標、名稱、類型。
  zip 裡的檔都沒有壓縮（stored），所以用 HTTP Range 只讀需要的檔（zipfile 的 seek），不必下載全部約 7 GB；
  排放源的檔也只讀需要的欄位、只留 co2e_100yr，存成小的 Parquet 快取。
- 授權：Zenodo 的 license 是 cc-by-4.0；資料說明（ABOUT_THE_DATA/about_the_data_v5_12_0.pdf）寫「All Climate TRACE data is freely
  available under the Creative Commons Attribution 4.0 International Public License, unless otherwise noted below」，例外是：
  - EDGAR_SUBSECTORS 的國家值取自 EDGAR v8.0（含 IEA-EDGAR CO₂，CC BY-NC-ND 4.0）與 CEDS v_2024_07_08（CC BY 4.0），分不出哪一國
    用哪一份 → 這些子部門的二氧化碳不用，甲烷、氧化亞氮、含氟氣體照用（使用者 2026-11-02 決定；EDGAR 的這幾種是 CC BY 4.0）。
  - 部分子部門的國家值取自 FAOSTAT（CC BY 4.0），照用。
  - 「其他製造」「掩埋場」有一部分排放源取自美國 EPA FLIGHT、E-PRTR、以色列 PRTR、LMOP、加拿大 GHGRP，檔案裡分不出是哪幾個
    （reporting_entity 都寫 climate-trace）→ 排放源地圖只收 POINT_SUBSECTORS（Climate TRACE 自己估計的設施，使用者 2026-11-02 決定）。
- CO₂ 當量是 IPCC AR6 的 GWP-100（甲烷約 27–30），網站其他指標（EDGAR、環境部清冊）是 AR5。
- 引用：「Climate TRACE (2026), Climate TRACE Emissions Inventory v5.12.0, https://climatetrace.org」。
"""
from __future__ import annotations

import io
import json
import urllib.request
import zipfile
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

import common

RECORD = "23789204"
VERSION = "5.12.0"
DOI = "10.5281/zenodo.23789204"
ZENODO = f"https://zenodo.org/api/records/{RECORD}"
PAGE = f"https://doi.org/{DOI}"
CACHE = "climate-trace"
TAG = "v" + VERSION.replace(".", "_")  # 檔名裡的版本：v5_12_0
CITATION = f"Climate TRACE (2026), Climate TRACE Emissions Inventory v{VERSION}, https://climatetrace.org"
# 資料到哪個月（2026 年 8 月）：更新版本時跟著改，前端 src/topics/climate-trace.ts 的 LATEST 也要一起改
LATEST = (2026, 8)
FIRST_COUNTRY_YEAR = 2015
FIRST_SOURCE_YEAR = 2021

# 資料說明「Detailed terms of use and licensing information」列出國家值取自 EDGAR／CEDS 的子部門（v5.12.0）
EDGAR_SUBSECTORS = {
    "other-energy-use", "railways", "other-transport", "other-onsite-fuel-usage", "other-solid-fuels",
    "other-manufacturing", "solid-waste-disposal", "biological-treatment-of-solid-waste-and-biogenic",
    "incineration-and-open-burning-of-waste", "other-chemicals", "wood-and-wood-products", "other-metals",
    "other-mining-quarrying", "glass", "lime", "food-beverage-tobacco", "textiles-leather-apparel", "fluorinated-gases",
}
# 國家的合計跟 Climate TRACE 一樣不含森林與土地利用（API 的國家合計也不含）
LAND_SECTOR = "forestry-and-land-use"

# 排放源地圖的子部門 → 類別（前端 climate-trace.ts 的 CATEGORIES 同一組代碼）
POINT_SUBSECTORS = {
    "electricity-generation": 1,
    "iron-and-steel": 2,
    "cement": 3,
    "aluminum": 4,
    "chemicals": 4,
    "petrochemical-steam-cracking": 4,
    "pulp-and-paper": 4,
    "oil-and-gas-refining": 5,
    "oil-and-gas-production": 6,
    "oil-and-gas-transport": 6,
    "coal-mining": 6,
    "copper-mining": 6,
    "iron-mining": 6,
    "bauxite-mining": 6,
    "domestic-aviation": 7,
    "international-aviation": 7,
    "domestic-shipping": 8,
    "international-shipping": 8,
}
SOURCE_COLUMNS = ["source_id", "source_name", "source_type", "iso3_country", "subsector", "start_time", "lat", "lon",
                  "geometry_ref", "gas", "emissions_quantity", "capacity", "capacity_units"]

# Climate TRACE 的代碼 → 網站的代碼（北賽普勒斯是地圖上的 _CYN）
ISO3_ALIASES = {"ZNC": "_CYN"}
UNKNOWN = "UNK"  # 不知道停靠港的船（non-broadcasting-vessels）：國家值裡有，只算進世界合計


class _RangeFile(io.RawIOBase):
    """用 HTTP Range 讀遠端檔的任一段（給 zipfile、pyarrow 當成可以 seek 的檔）"""

    def __init__(self, url: str):
        self.pos = 0
        request = urllib.request.Request(url, headers={"User-Agent": common.USER_AGENT, "Range": "bytes=0-0"})
        with urllib.request.urlopen(request, timeout=120) as resp:
            if resp.status != 206:
                raise RuntimeError(f"{url} 不支援 Range（HTTP {resp.status}）")
            self.size = int(resp.headers["Content-Range"].rsplit("/", 1)[1])
            self.url = resp.url  # Zenodo 的 /content 會轉到檔案伺服器

    def seekable(self) -> bool:
        return True

    def readable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, offset: int, whence: int = 0) -> int:
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos

    def readinto(self, buffer) -> int:
        if self.pos >= self.size or not len(buffer):
            return 0
        end = min(self.pos + len(buffer), self.size) - 1
        request = urllib.request.Request(self.url, headers={"User-Agent": common.USER_AGENT, "Range": f"bytes={self.pos}-{end}"})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(request, timeout=120) as resp:
                    data = resp.read()
                break
            except OSError:
                if attempt == 3:
                    raise
        buffer[: len(data)] = data
        self.pos += len(data)
        return len(data)


@lru_cache(maxsize=1)
def record() -> dict:
    """Zenodo 的紀錄（版本、授權、檔案清單），核對版本與授權"""
    path = common.download(ZENODO, CACHE, f"record-{RECORD}.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    meta = data["metadata"]
    if meta.get("version") != f"V{VERSION}":
        raise RuntimeError(f"Zenodo {RECORD} 的版本是 {meta.get('version')}，不是 V{VERSION}")
    if (meta.get("license") or {}).get("id") != "cc-by-4.0":
        raise RuntimeError(f"Zenodo {RECORD} 的授權是 {meta.get('license')}，不是 CC BY 4.0，先查清楚再用")
    return data


def _packages() -> dict[str, str]:
    """子部門 → zip 的檔名（agriculture_rice-cultivation.zip…；全球的 geometries、ers_plan 不算）"""
    out = {}
    for f in record()["files"]:
        key = f["key"]
        if key in ("geometries.gpkg.zip", "ers_plan_global.zip"):
            continue
        with zipfile.ZipFile(io.BufferedReader(_RangeFile(_url(key)), buffer_size=1 << 16)) as z:
            names = z.namelist()
        country = [n for n in names if n.endswith(f"_country_emissions_monthly_{TAG}.parquet")]
        if len(country) != 1:
            raise RuntimeError(f"{key} 裡的國家檔不是剛好一個：{country}")
        out[Path(country[0]).name.removesuffix(f"_country_emissions_monthly_{TAG}.parquet")] = key
    return out


def _url(key: str) -> str:
    return f"{ZENODO}/files/{key}/content"


@lru_cache(maxsize=1)
def packages() -> dict[str, str]:
    """子部門 → zip（第一次要逐一讀 zip 的目錄，存成快取）"""
    path = common.CACHE_DIR / CACHE / TAG / "packages.json"
    if path.exists() and not common.REFRESH:
        return json.loads(path.read_text(encoding="utf-8"))
    out = _packages()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    return out


def _member(key: str, name: str, target: Path) -> Path:
    """zip 裡的一個檔原樣存到 target（只讀那一段）"""
    if target.exists() and not common.REFRESH:
        return target
    print(f"  讀取 {key} 的 {name}（HTTP Range）")
    with zipfile.ZipFile(io.BufferedReader(_RangeFile(_url(key)), buffer_size=1 << 20)) as z:
        data = z.read(name)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".part")
    tmp.write_bytes(data)
    tmp.replace(target)
    return target


@lru_cache(maxsize=1)
def country_monthly() -> dict[tuple[str, str], dict[str, dict[tuple[int, int], dict[str, float]]]]:
    """{(部門, 子部門): {iso3: {(年, 月): {co2、co2e: 公噸}}}}，全部子部門（含森林與土地利用）；iso3 含 UNKNOWN"""
    import pyarrow as pa
    import pyarrow.compute as pc
    import pyarrow.parquet as pq

    out: dict[tuple[str, str], dict[str, dict[tuple[int, int], dict[str, float]]]] = {}
    unknown: set[str] = set()
    for sub, key in sorted(packages().items()):
        name = f"DATA/{sub}_country_emissions_monthly_{TAG}.parquet"
        path = _member(key, name, common.CACHE_DIR / CACHE / TAG / "country" / Path(name).name)
        table = pq.read_table(path, columns=["iso3_country", "sector", "subsector", "start_time", "gas", "emissions_quantity"])
        table = table.filter(pc.is_in(table["gas"], value_set=pa.array(["co2", "co2e_100yr"])))
        sectors = set(table["sector"].unique().to_pylist())
        if len(sectors) != 1 or set(table["subsector"].unique().to_pylist()) != {sub}:
            raise RuntimeError(f"{name} 的部門 {sectors} 或子部門不對")
        series: dict[str, dict[tuple[int, int], dict[str, float]]] = defaultdict(lambda: defaultdict(dict))
        for iso3, t, gas, v in zip(
            table["iso3_country"].to_pylist(), table["start_time"].to_pylist(), table["gas"].to_pylist(),
            table["emissions_quantity"].to_pylist(),
        ):
            code = ISO3_ALIASES.get(iso3, iso3)
            # UNK（不知道停靠港的船，2025 年約 4 億公噸）留著算進世界合計，不是網站的國家
            if code not in common_countries() and code != UNKNOWN:
                unknown.add(iso3)
                continue
            if v is None:
                continue
            cell = series[code][(t.year, t.month)]
            cell["co2e" if gas == "co2e_100yr" else "co2"] = cell.get("co2e" if gas == "co2e_100yr" else "co2", 0.0) + v
        out[(sectors.pop(), sub)] = {k: dict(v) for k, v in series.items()}
    if unknown:
        print(f"  Climate TRACE 的國家代碼不在網站的國家裡（不收）：{sorted(unknown)}")
    missing = (EDGAR_SUBSECTORS | set(POINT_SUBSECTORS)) - {s for _, s in out}
    if missing:
        raise RuntimeError(f"Zenodo {RECORD} 沒有這些子部門：{sorted(missing)}")
    return out


@lru_cache(maxsize=1)
def common_countries() -> dict[str, dict]:
    """網站的國家與地區（public/data/countries.json：iso3 → {iso2, name}）"""
    return json.loads((common.OUT_DIR / "countries.json").read_text(encoding="utf-8"))


def sources(subsector: str) -> list[dict]:
    """一個子部門的排放源：[{id、name、type、iso3、lat、lon、cap、cap_units、years: {年: 公噸 CO₂e（AR6 GWP-100）}}]。
    只收有座標、不是行政區合計（geometry_ref 是空的）的；每年是 12 個月的合計，最新一年不滿 12 個月的不收"""
    import pyarrow as pa
    import pyarrow.compute as pc
    import pyarrow.parquet as pq

    key = packages()[subsector]
    name = f"DATA/{subsector}_emissions_sources_{TAG}.parquet"
    cache = common.CACHE_DIR / CACHE / TAG / "sources" / f"{subsector}_co2e.parquet"
    if not cache.exists() or common.REFRESH:
        print(f"  讀取 {key} 的 {name}（HTTP Range，只讀 co2e_100yr）")
        with zipfile.ZipFile(io.BufferedReader(_RangeFile(_url(key)), buffer_size=1 << 20)) as z:
            info = z.getinfo(name)
            if info.compress_type != zipfile.ZIP_STORED:
                raise RuntimeError(f"{name} 有壓縮，不能只讀需要的欄位")
            pf = pq.ParquetFile(z.open(name))
            parts = []
            for i in range(pf.num_row_groups):
                t = pf.read_row_group(i, columns=SOURCE_COLUMNS)
                parts.append(t.filter(pc.equal(t["gas"], "co2e_100yr")))
        cache.parent.mkdir(parents=True, exist_ok=True)
        pq.write_table(pa.concat_tables(parts), cache)
    table = pq.read_table(cache)
    rows: dict[int, dict] = {}
    months: dict[int, dict[int, set[int]]] = defaultdict(lambda: defaultdict(set))
    for r in table.to_pylist():
        if r["lat"] is None or r["lon"] is None or r["geometry_ref"]:
            continue
        sid = r["source_id"]
        row = rows.get(sid)
        if row is None:
            row = rows[sid] = {
                "id": sid, "name": (r["source_name"] or "").strip(), "type": (r["source_type"] or "").strip(),
                "iso3": ISO3_ALIASES.get(r["iso3_country"], r["iso3_country"]), "subsector": subsector,
                "lat": r["lat"], "lon": r["lon"], "cap": r["capacity"], "cap_units": r["capacity_units"], "years": defaultdict(float),
            }
        year = r["start_time"].year
        if r["emissions_quantity"] is not None:
            row["years"][year] += r["emissions_quantity"]
            months[sid][year].add(r["start_time"].month)
        if r["capacity"] is not None and year == LATEST[0] - 1:
            row["cap"] = r["capacity"]
    out = []
    for sid, row in rows.items():
        # 每年都要 12 個月（2026 年不滿一年，不收）
        row["years"] = {y: v for y, v in row["years"].items() if len(months[sid][y]) == 12 and y < LATEST[0]}
        if row["iso3"] in common_countries():
            out.append(row)
    return out


def check_latest() -> None:
    """資料的最新月份跟 LATEST 一樣（前端寫死了「1–8 月」）"""
    latest = max(ym for series in country_monthly()[("power", "electricity-generation")].values() for ym in series)
    if latest != LATEST:
        raise RuntimeError(f"Climate TRACE 資料到 {latest}，LATEST 寫 {LATEST}：兩邊（含前端 climate-trace.ts）一起改")
