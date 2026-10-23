"""Eurostat（https://ec.europa.eu/eurostat，CC BY 4.0）：歐洲各國的 EU-SILC 住宅統計。

- 用 SDMX 2.1 API 下載整個資料集的 TSV（gzip），在本地依維度篩選。
- TSV 第一欄是逗號分隔的維度代碼（最後一個是 geo），之後每年一欄；
  缺值寫「:」，數字後面可能跟著旗標（b 序列中斷、u 可信度低、p 初步值、e 估計值），旗標不影響數值，照收。
- 國家代碼是 alpha-2，但希臘是 EL、英國是 UK；EU27_2020、EA20 這類合計不收。
"""
from __future__ import annotations

import gzip

import pycountry

from common import download

URL = "https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/{dataset}/?format=TSV&compressed=true"
ALPHA2_ALIASES = {"EL": "GRC", "UK": "GBR", "XK": "XKX"}


def _iso3(geo: str) -> str | None:
    if geo in ALPHA2_ALIASES:
        return ALPHA2_ALIASES[geo]
    if len(geo) != 2:
        return None  # EU27_2020、EA20 等合計
    country = pycountry.countries.get(alpha_2=geo)
    return country.alpha_3 if country else None


def series(dataset: str, **filters: str) -> dict[str, dict[int, float]]:
    """回傳 {iso3: {year: value}}。filters 指定 geo 以外每個維度的代碼，例如 unit="PC"。"""
    path = download(URL.format(dataset=dataset), "eurostat", f"{dataset}.tsv.gz")
    out: dict[str, dict[int, float]] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        dims = header[0].split("\\")[0].split(",")
        unknown = set(filters) - set(dims)
        if unknown:
            raise RuntimeError(f"{dataset} 沒有維度 {unknown}（有 {dims}）")
        years = [int(h) for h in header[1:]]
        for line in f:
            cells = line.rstrip("\n").split("\t")
            key = dict(zip(dims, cells[0].split(",")))
            if any(key[k] != v for k, v in filters.items()):
                continue
            iso3 = _iso3(key["geo"])
            if not iso3:
                continue
            if iso3 in out:
                raise RuntimeError(f"{dataset} 的 {iso3} 有好幾列，filters 要指定 geo 以外的所有維度")
            values = {}
            for year, cell in zip(years, cells[1:]):
                number = cell.strip().split(" ")[0]
                if number not in (":", ""):
                    values[year] = float(number)
            if values:
                out[iso3] = values
    return out
