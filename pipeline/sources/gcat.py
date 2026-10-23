"""Jonathan McDowell 的 GCAT（General Catalog of Artificial Space Objects，https://planet4589.org/space/gcat/ ，CC BY 4.0）。

引用：McDowell, Jonathan C., 2020. General Catalog of Artificial Space Objects, Release 1.8.8, https://planet4589.org/space/gcat
（網頁寫「This data may be freely reproduced as long as you cite it」，授權連到 CC BY 4.0）。

用到的表（TSV，第一列是 # 開頭的欄名，第二列是「# Updated …」）：
- `cat/satcat.tsv`：所有編目物體（約 7 萬個）；`Type` 第一個字是 P 的是酬載（衛星、太空船），`LDate` 發射日期、
  `DDate` 再入／離軌／回收／離開地球軌道（或不再追蹤）的日期、`Status`、`Owner`（機構代碼）、`State`（國家代碼）。
- `launch/launch.tsv`：發射紀錄（含次軌道）；`LaunchCode` 第一個字是 O 的是入軌發射（OS 成功、OF 失敗…），
  `Agency` 是發射業者（機構代碼，好幾個時用 / 分開）、`Launch_Site` 是發射場代碼。
- `tables/orgs.tsv`：機構與國家；`StateCode` 是那個機構所屬的國家代碼，國家本身是 `Type` 為 CY／CYP 的列（`Parent` 是上一層）。
- `tables/sites.tsv`：發射場（經緯度、所屬國家代碼）。
"""
from __future__ import annotations

from dataclasses import dataclass

import pycountry

from common import download

BASE = "https://planet4589.org/space/gcat/tsv/"
RELEASE = "1.8.8"

# GCAT 的國家代碼 → ISO alpha-3：兩個字母而且是 ISO alpha-2 的直接換（HK、PR、GU…），其他寫在這裡
STATE_ISO = {
    "SU": "RUS",  # 蘇聯：酬載與發射算在繼承國俄羅斯（主題的附註寫明）
    "J": "JPN", "F": "FRA", "D": "DEU", "I": "ITA", "E": "ESP", "L": "LUX", "N": "NOR", "S": "SWE", "T": "THA",
    "B": "BEL", "P": "PRT", "UK": "GBR", "UAE": "ARE", "BGN": "BGR", "MYM": "MMR", "PAR": "PAN", "GRD": "GRD",
    "PLRL": "POL", "CSSR": "CZE", "CSFR": "CZE", "DD": "DEU", "DR": "DEU", "DX": "DEU",
    "HK": "HKG", "MOCN": "MAC", "GUF": "FRA", "CYM": "CYM", "BM": "BMU", "GI": "GIB", "GL": "GRL",
    "KORS": "CUW", "ANTN": "CUW", "KGSR": "KGZ", "ZR": "COD", "COLP": "COD", "TW": "TWN",
}
# 蘇聯、東德、捷克斯洛伐克等已經不存在的國家：算到今天的哪一國（附註用）
HISTORICAL = {"SU": "RUS", "DD": "DEU", "CSSR": "CZE", "CSFR": "CZE", "PLRL": "POL", "BGN": "BGR", "ZR": "COD"}


def read(path: str, filename: str) -> list[dict[str, str]]:
    local = download(BASE + path, "gcat", filename)
    with open(local, encoding="utf-8") as f:
        lines = [l for l in f if not l.startswith("# ")]
    header = lines[0].lstrip("#").rstrip("\n").split("\t")
    return [dict(zip(header, [c.strip() for c in l.rstrip("\n").split("\t")])) for l in lines[1:]]


def satcat() -> list[dict[str, str]]:
    return read("cat/satcat.tsv", "satcat.tsv")


def launches() -> list[dict[str, str]]:
    return read("launch/launch.tsv", "launch.tsv")


def orgs() -> dict[str, dict[str, str]]:
    return {r["Code"]: r for r in read("tables/orgs.tsv", "orgs.tsv")}


def sites() -> dict[str, dict[str, str]]:
    return {r["Site"]: r for r in read("tables/sites.tsv", "sites.tsv")}


@dataclass
class StateMapper:
    """GCAT 的國家代碼 → ISO alpha-3；國際組織（I-ESA、I-INT…）回傳 None。省、州、自治區依 Parent 往上找到國家。"""

    orgs: dict[str, dict[str, str]]

    def iso3(self, state: str) -> str | None:
        seen = set()
        code = state
        while code and code not in seen:
            seen.add(code)
            if code.startswith("I-"):
                return None
            if code in STATE_ISO:
                return STATE_ISO[code]
            if len(code) == 2:
                country = pycountry.countries.get(alpha_2=code)
                if country:
                    return country.alpha_3
            parent = self.orgs.get(code, {}).get("Parent", "-")
            code = parent if parent not in ("-", "") else None
        return None

    def org_state(self, org: str) -> str:
        """機構代碼 → 所屬國家的 GCAT 代碼（找不到回傳 ""）"""
        return self.orgs.get(org, {}).get("StateCode", "")


def year(date: str) -> int | None:
    """「1957 Oct  4 1933」→ 1957；「-」→ None；「2011?」也取年份"""
    head = date.strip()[:4]
    return int(head) if head.isdigit() else None
