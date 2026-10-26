"""NGA 的 World Port Index（Pub. 150，世界港口索引）：全世界約 3,800 個港口的位置、大小、類型與設施。

- 美國國家地理空間情報局（NGA）Maritime Safety Information 網站的 CSV（UpdatedPub150.csv，不必登入）。
- 授權：美國聯邦政府的職務作品，公有領域（17 U.S.C. § 105；WPI 的版權頁寫「No copyright claimed under Title 17 U.S.C.」）。
- 檔案本身沒有版次與日期，2026-10-26 下載的是 3,807 個港口。
- 國家欄（Country Code）是英文國名，這裡換成 ISO alpha-3；對不到的國名直接報錯，不會默默丟掉港口。
"""
from __future__ import annotations

import csv
import time
import urllib.error
from pathlib import Path
from typing import NamedTuple

import common
from sources.countries import from_name

URL = "https://msi.nga.mil/api/publications/download?key=16920959/SFH00000/UpdatedPub150.csv&type=download"
INFO_URL = "https://msi.nga.mil/Publications/WPI"

# WPI 的國名 → ISO alpha-3（pycountry 與 countries.NAME_ALIASES 查不到的）
COUNTRY_ALIASES = {
    "Congo (Brazzaville)": "COG",
    "Congo (Kinshasa)": "COD",
    "Falkland Islands (Islas Malvinas)": "FLK",
    "Federated States of Micronesia": "FSM",
    "Saint Helena, Ascension, and Tristan da Cunha": "SHN",
    "Saint Vincent and the Grenadines (Windward Islands)": "VCT",
    "The Bahamas": "BHS",
    "The Gambia": "GMB",
    "Caribbean Netherlands": "BES",
    "Johnson Atoll": "UMI",
    "Midway Islands": "UMI",
    "Wake Island": "UMI",
    "Svalbard": "SJM",
    "Antarctica": "ATA",
    "South Georgia and South Sandwich Islands": "SGS",
    "Western Sahara": "ESH",
    "Sint Maarten": "SXM",
    "U.S. Virgin Islands": "VIR",
    "British Virgin Islands": "VGB",
    "Christmas Island": "CXR",
    "Norfolk Island": "NFK",
    "British Indian Ocean Territory": "IOT",
}

# 港口大小（Harbor Size）：1 很小、2 小、3 中、4 大；空白是 0（不明）
SIZES = {"Very Small": 1, "Small": 2, "Medium": 3, "Large": 4}

# 港口類型（Harbor Type）的代碼：依類別排在一起，前端依代碼的範圍上色（海岸天然、海岸人工、河港與運河湖泊、開放錨地）
TYPES = {
    "Coastal (Natural)": 1,
    "Coastal (Breakwater)": 2,
    "Coastal (Tide Gates)": 3,
    "Typhoon Harbor": 4,
    "River (Natural)": 5,
    "River (Basins)": 6,
    "River (Tide Gates)": 7,
    "Canal or Lake": 8,
    "Open Roadstead": 9,
}
UNKNOWN_TYPE = 10


class Port(NamedTuple):
    number: int  # World Port Index Number
    name: str
    alternate: str
    locode: str  # 'TWKHH'（去掉空白）；沒有的是空字串
    iso3: str
    size: int
    type: int
    lon: float
    lat: float
    container: bool  # Facilities - Container 是 Yes


def country_iso3(name: str) -> str:
    code = COUNTRY_ALIASES.get(name) or from_name(name)
    if not code:
        raise ValueError(f"World Port Index 的國名對不到 ISO 代碼：{name}")
    return code


def _download() -> Path:
    """NGA 的 CDN 常常隨機回 503（2026-10-26 同一個網址連續試，大約一半 503、一半 200），失敗時等一下再試"""
    for attempt in range(6):
        try:
            return common.download(URL, "wpi", "UpdatedPub150.csv")
        except urllib.error.HTTPError as e:
            if e.code != 503 or attempt == 5:
                raise
            print(f"  NGA 回 503，{5 * (attempt + 1)} 秒後重試")
            time.sleep(5 * (attempt + 1))
    raise AssertionError("unreachable")


def load() -> list[Port]:
    path = _download()
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    ports = []
    for r in rows:
        size_text = r["Harbor Size"].strip()
        type_text = r["Harbor Type"].strip()
        if size_text and size_text not in SIZES:
            raise ValueError(f"沒見過的港口大小：{size_text}")
        if type_text and type_text not in TYPES:
            raise ValueError(f"沒見過的港口類型：{type_text}")
        ports.append(
            Port(
                number=int(float(r["World Port Index Number"])),
                name=r["Main Port Name"].strip(),
                alternate=r["Alternate Port Name"].strip(),
                locode=r["UN/LOCODE"].replace(" ", "").strip(),
                iso3=country_iso3(r["Country Code"].strip()),
                size=SIZES.get(size_text, 0),
                type=TYPES.get(type_text, UNKNOWN_TYPE),
                lon=float(r["Longitude"]),
                lat=float(r["Latitude"]),
                container=r["Facilities - Container"].strip() == "Yes",
            )
        )
    # 同一個港口列了兩次（2026-10 的檔：冰島的 Seydisfjordur，編號、位置都一樣，一筆沒有大小）：留資料多的那筆。
    # 編號一樣、位置不同的是不同的港口（奈及利亞的 Escravos 與 Lekki 都是 46135），兩筆都留
    best: dict[tuple[int, float, float], Port] = {}
    for p in ports:
        key = (p.number, round(p.lat, 3), round(p.lon, 3))
        if key not in best or (best[key].size, best[key].type != UNKNOWN_TYPE) < (p.size, p.type != UNKNOWN_TYPE):
            best[key] = p
    return list(best.values())
