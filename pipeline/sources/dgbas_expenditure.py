"""主計總處 國民所得統計：國內生產毛額依支出分（年，當期價格，新臺幣百萬元）。

政府資料開放平臺的兩個資料集（政府資料開放授權條款－第 1 版）：
- 44221「國民所得統計-國內生產毛額及平減指數依支出分-年(1951-1980)」
- 44224「國民所得統計-國內生產毛額及平減指數依支出分-年(1981以後)」
XML 每一筆是 <Obs><Item>當期價格(新臺幣百萬元)、4.商品及服務輸出:4.1--4.2合計</Item><TIME_PERIOD>…
<TYPE>原始值</TYPE><Item_VALUE>…；同一個項目還有年增率、平減指數，只取當期價格的原始值。
兩個檔的項目編號不同（GDP 在 1951–1980 是 6、1981 以後是 8），用名稱對。
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET

from common import download

BASE = "https://ws.dgbas.gov.tw/001/Upload/461/relfile/11525/230514/"
FILES = ["na8102a1a.xml", "na8102a5a.xml"]  # 1951–1980、1981 以後
PREFIX = "當期價格(新臺幣百萬元)、"
EXPORTS, IMPORTS = "商品及服務輸出", "商品及服務輸入"


def current_prices() -> dict[int, dict[str, float]]:
    """{年: {項目名稱: 新臺幣百萬元}}，項目名稱去掉編號與「:4.1--4.2合計」，例如「商品及服務輸出」「GDP」。"""
    out: dict[int, dict[str, float]] = {}
    for name in FILES:
        root = ET.parse(download(BASE + name, "dgbas", name)).getroot()
        for obs in root.iter("Obs"):
            item = (obs.findtext("Item") or "").strip()
            if not item.startswith(PREFIX) or (obs.findtext("TYPE") or "").strip() != "原始值":
                continue
            # 「4.商品及服務輸出:4.1--4.2合計」→「商品及服務輸出」；「4.1商品、運輸與保險」是細項，名稱照留
            key = re.sub(r"^[\d.]+", "", item[len(PREFIX):]).split(":", 1)[0]
            try:
                value = float((obs.findtext("Item_VALUE") or "").replace(",", ""))
            except ValueError:
                continue
            out.setdefault(int(obs.findtext("TIME_PERIOD")), {})[key] = value
    return out


def trade_share_of_gdp() -> dict[int, float]:
    """（商品及服務輸出＋輸入）÷ GDP（%），跟世界銀行 NE.TRD.GNFS.ZS 同一個定義"""
    return {
        year: (v[EXPORTS] + v[IMPORTS]) / v["GDP"] * 100
        for year, v in sorted(current_prices().items())
        if {EXPORTS, IMPORTS, "GDP"} <= v.keys() and v["GDP"]
    }
