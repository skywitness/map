"""CEPII BACI：各國之間的商品貿易（HS 六位碼），已把進出口兩邊的申報調和成一個數字。

https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37
- 授權：Etalab 2.0（Licence Ouverte，與 CC BY 相容），需註明 CEPII。
- 數值是千美元，以 FOB 計（進口申報的 CIF 已扣掉估計的運費與保險）。
- 用 HS17 版（2017–2024 年，zip 約 800 MB）；HS92 版從 1995 年開始，但有 2.4 GB。
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


def _country_codes(z: zipfile.ZipFile) -> dict[bytes, str | None]:
    member = next(n for n in z.namelist() if n.startswith("country_codes"))
    with z.open(member) as raw:
        reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8"))
        codes: dict[bytes, str | None] = {}
        for row in reader:
            code = row["country_code"]
            codes[code.encode()] = "TWN" if code == TAIWAN else to_iso3(row["country_iso3"])
    return codes


def yearly_totals() -> Iterator[tuple[int, Pairs]]:
    """逐年回傳 {(出口國, 進口國): 千美元}，所有商品加總。"""
    path = download(URL, "baci", FILENAME)
    with zipfile.ZipFile(path) as z:
        codes = _country_codes(z)
        members = sorted(n for n in z.namelist() if re.match(rf"BACI_{HS}_Y\d{{4}}_", n))
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
