"""CEPII BACI：各國之間的商品貿易（HS 六位碼），已把進出口兩邊的申報調和成一個數字。

https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37
- 授權：Etalab 2.0（Licence Ouverte，與 CC BY 相容），需註明 CEPII。
- 數值是千美元，以 FOB 計（進口申報的 CIF 已扣掉估計的運費與保險）。
- 數量是公噸（q 欄，CEPII 依單位價格補過；仍有少數空白，塑膠廢料 HS 3915 空白的占金額 0.1% 以下，1995 年 1.2%）。
- 貿易、半導體主題用 HS17 版（2017–2024 年，zip 約 800 MB）；塑膠污染主題的塑膠廢料用 HS92 版（1995–2024 年，2.4 GB，
  `yearly_product_flows(…, hs="HS92")`），才看得到 2018 年中國禁止進口以前的變化。
- 國家代碼大致是 ISO 數字代碼，對照表附在 zip 裡：
  - 490「Other Asia, nes」就是台灣（UN Comtrade 的慣例），明確改成 TWN。
  - 697「Europe EFTA, nes」這類無法歸到單一國家的代碼回傳 None，只計入總額。
"""
from __future__ import annotations

import csv
import io
import re
import zipfile
from collections import defaultdict
from collections.abc import Iterator

from common import download
from sources.countries import to_iso3

VERSION = "V202601"
HS = "HS17"
FILENAME = f"BACI_{HS}_{VERSION}.zip"
URL = f"https://www.cepii.fr/DATA_DOWNLOAD/baci/data/{FILENAME}"
TAIWAN = "490"

Pairs = dict[tuple[str | None, str | None], float]


def _archive(hs: str):
    filename = f"BACI_{hs}_{VERSION}.zip"
    return download(f"https://www.cepii.fr/DATA_DOWNLOAD/baci/data/{filename}", "baci", filename)


def _country_codes(z: zipfile.ZipFile) -> dict[bytes, str | None]:
    member = next(n for n in z.namelist() if n.startswith("country_codes"))
    with z.open(member) as raw:
        reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8"))
        codes: dict[bytes, str | None] = {}
        for row in reader:
            code = row["country_code"]
            codes[code.encode()] = "TWN" if code == TAIWAN else to_iso3(row["country_iso3"])
    return codes


def yearly_totals(hs: str = HS) -> Iterator[tuple[int, Pairs]]:
    """逐年回傳 {(出口國, 進口國): 千美元}，所有商品加總。hs 是 BACI 的版本（'HS92' 從 1995 年起）。"""
    path = _archive(hs)
    with zipfile.ZipFile(path) as z:
        codes = _country_codes(z)
        members = sorted(n for n in z.namelist() if re.match(rf"BACI_{hs}_Y\d{{4}}_", n))
        for member in members:
            year = int(re.search(r"_Y(\d{4})_", member).group(1))
            # 每年約 1,100 萬列；不用 csv 模組，直接切逗號比較快（這個檔沒有引號）
            by_code: dict[tuple[bytes, bytes], float] = defaultdict(float)
            with z.open(member) as raw:
                next(raw)
                for line in raw:
                    _, i, j, _, v, _ = line.split(b",")
                    by_code[(i, j)] += float(v)
            pairs: Pairs = defaultdict(float)
            for (i, j), v in by_code.items():
                pairs[(codes.get(i), codes.get(j))] += v
            yield year, pairs


def yearly_products(prefixes: tuple[str, ...]) -> Iterator[tuple[int, dict[str, Pairs]]]:
    """逐年回傳 {HS 六位碼: {(出口國, 進口國): 千美元}}，只收代碼開頭是 prefixes 之一的商品（例如 '8542'、'903082'）。

    跟 yearly_totals() 一樣一次讀完整個 zip（8 年約 2 分鐘）。每列直接切逗號再比對代碼：
    實測比先用 `b',8542' in line` 篩選還快（每個前綴都要把整列掃一次）。
    """
    path = download(URL, "baci", FILENAME)
    wanted = tuple(p.encode() for p in prefixes)
    with zipfile.ZipFile(path) as z:
        codes = _country_codes(z)
        members = sorted(n for n in z.namelist() if re.match(rf"BACI_{HS}_Y\d{{4}}_", n))
        for member in members:
            year = int(re.search(r"_Y(\d{4})_", member).group(1))
            by_code: dict[tuple[bytes, bytes, bytes], float] = defaultdict(float)
            with z.open(member) as raw:
                next(raw)
                for line in raw:
                    _, i, j, k, v, _ = line.split(b",")
                    if k.startswith(wanted):
                        by_code[(k, i, j)] += float(v)
            products: dict[str, Pairs] = defaultdict(lambda: defaultdict(float))
            for (k, i, j), v in by_code.items():
                products[k.decode()][(codes.get(i), codes.get(j))] += v
            yield year, products


def yearly_product_flows(prefixes: tuple[str, ...], hs: str = HS) -> Iterator[tuple[int, dict[tuple[str | None, str | None], list[float]]]]:
    """逐年回傳 {(出口國, 進口國): [千美元, 公噸, 沒有數量的千美元]}，代碼開頭是 prefixes 之一的商品加總。

    數量空白的列只算進金額（第三個數記下它們的金額，用來看缺多少）。hs 是 BACI 的版本（'HS92' 從 1995 年起）。
    """
    path = _archive(hs)
    wanted = tuple(p.encode() for p in prefixes)
    with zipfile.ZipFile(path) as z:
        codes = _country_codes(z)
        members = sorted(n for n in z.namelist() if re.match(rf"BACI_{hs}_Y\d{{4}}_", n))
        for member in members:
            year = int(re.search(r"_Y(\d{4})_", member).group(1))
            by_code: dict[tuple[bytes, bytes], list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
            with z.open(member) as raw:
                next(raw)
                for line in raw:
                    _, i, j, k, v, q = line.split(b",")
                    if not k.startswith(wanted):
                        continue
                    cell = by_code[(i, j)]
                    cell[0] += float(v)
                    q = q.strip()
                    if q and q != b"NA":
                        cell[1] += float(q)
                    else:
                        cell[2] += float(v)
            pairs: dict[tuple[str | None, str | None], list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
            for (i, j), (v, q, missing) in by_code.items():
                cell = pairs[(codes.get(i), codes.get(j))]
                cell[0] += v
                cell[1] += q
                cell[2] += missing
            yield year, pairs


def yearly_hs6_rows(
    codes: tuple[str, ...], hs: str = HS, extra: dict[str, str] | None = None,
) -> Iterator[tuple[int, list[tuple[str, str | None, str | None, float, float | None]]]]:
    """逐年回傳每一筆雙邊流量 [(HS 六位碼, 出口國, 進口國, 千美元, 公噸或 None)]，不加總，
    給要依六位碼各自的單價清理數量的主題用（石油、天然氣與煤）。codes 是六位碼或前綴。

    extra 是 BACI 的 country_iso3 欄 → 地圖代碼，補上 to_iso3() 對不到的代碼（例如 1999 年以前的南部非洲關稅同盟 ZA1）。
    """
    path = _archive(hs)
    wanted = tuple(c.encode() for c in codes)
    with zipfile.ZipFile(path) as z:
        iso = _country_codes(z)
        if extra:
            member = next(n for n in z.namelist() if n.startswith("country_codes"))
            with z.open(member) as raw:
                for row in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8")):
                    if row["country_iso3"] in extra:
                        iso[row["country_code"].encode()] = extra[row["country_iso3"]]
        members = sorted(n for n in z.namelist() if re.match(rf"BACI_{hs}_Y\d{{4}}_", n))
        for member in members:
            year = int(re.search(r"_Y(\d{4})_", member).group(1))
            rows = []
            with z.open(member) as raw:
                next(raw)
                for line in raw:
                    _, i, j, k, v, q = line.split(b",")
                    if not k.startswith(wanted):
                        continue
                    q = q.strip()
                    rows.append((k.decode(), iso.get(i), iso.get(j), float(v), float(q) if q and q != b"NA" else None))
            yield year, rows
