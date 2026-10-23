"""UCDP（Uppsala Conflict Data Program，烏普薩拉大學和平與衝突研究系）的資料集，版本 26.1（2026 年 6 月發布）。

- 下載頁：https://ucdp.uu.se/downloads/ 。頁面寫明「All datasets are free of charge and licensed under CC BY 4.0 —
  you are free to use and redistribute them provided you cite the relevant publications listed with each dataset.」
  （2026-10-23 查）。每個資料集要引用的文獻見 CITATIONS。
- 用到兩個資料集（CSV 壓縮檔，直接從 zip 裡讀，不解壓）：
  - UCDP Georeferenced Event Dataset（GED）Global 26.1：1989–2025 年每一起組織性暴力事件（約 42 萬筆、zip 39 MB、
    解壓後 274 MB），有經緯度、當時的國家（Gleditsch–Ward 編號）、暴力類型（1 以國家為一方、2 非國家、3 單方面）、
    死亡人數的最佳估計（best）。
  - UCDP/PRIO Armed Conflict Dataset（ACD）26.1：1946–2025 年以國家為一方的武裝衝突，每個衝突每年一列，
    有所在國（gwno_loc，可能好幾國）、強度（1 小型、2 戰爭）、衝突類型、爭議（領土／政府）。
- 國家代碼是 Gleditsch–Ward（GW）編號，用 GW_ISO3 換成 ISO alpha-3；新版出現沒列的編號會報錯。
"""
from __future__ import annotations

import csv
import io
import zipfile
from dataclasses import dataclass
from datetime import date

from common import download

VERSION = "26.1"
BASE = "https://ucdp.uu.se/downloads/"
GED_URL = BASE + "ged/ged261-csv.zip"
ACD_URL = BASE + "ucdpprio/ucdp-prio-acd-261-csv.zip"
DOWNLOADS_PAGE = "https://ucdp.uu.se/downloads/"
LICENSE = "CC BY 4.0"

# 下載頁「Please cite」列的文獻（資料檔的 manifest 與 DESIGN.md 用）
CITATIONS = {
    "common": "Davies, Shawn, Therése Pettersson & Magnus Öberg (2026). Organized violence 1989–2025, and violent "
              "political protests. Journal of Peace Research. https://doi.org/10.1093/jopres/xjag046",
    "ged": "Sundberg, Ralph & Erik Melander (2013). Introducing the UCDP Georeferenced Event Dataset. "
           "Journal of Peace Research 50(4).",
    "acd": "Gleditsch, Nils Petter, Peter Wallensteen, Mikael Eriksson, Margareta Sollenberg & Håvard Strand (2002). "
           "Armed Conflict 1946–2001: A New Dataset. Journal of Peace Research 39(5).",
}

# Gleditsch–Ward 國家編號 → ISO alpha-3（今天的國家）。只列 1946 年以後存在過的國家；
# 已經不存在的國家對到今天繼承它的國家：
# 260 德國（1949–1990 是西德）、265 東德 → DEU；315 捷克斯洛伐克 → CZE；345「Serbia (Yugoslavia)」→ SRB；
# 365「Russia (Soviet Union)」→ RUS；678「Yemen (North Yemen)」、680 南葉門 → YEM；
# 816「Vietnam (North Vietnam)」、817 南越 → VNM；751 海德拉巴（1948 年併入印度）→ IND；
# 711 西藏 → CHN；511 尚吉巴 → TZA；730 朝鮮（1910 年以前）不會出現。
GW_ISO3 = {
    2: "USA", 20: "CAN", 31: "BHS", 40: "CUB", 41: "HTI", 42: "DOM", 51: "JAM", 52: "TTO", 53: "BRB", 54: "DMA",
    55: "GRD", 56: "LCA", 57: "VCT", 58: "ATG", 60: "KNA", 70: "MEX", 80: "BLZ", 90: "GTM", 91: "HND", 92: "SLV",
    93: "NIC", 94: "CRI", 95: "PAN", 100: "COL", 101: "VEN", 110: "GUY", 115: "SUR", 130: "ECU", 135: "PER",
    140: "BRA", 145: "BOL", 150: "PRY", 155: "CHL", 160: "ARG", 165: "URY",
    200: "GBR", 205: "IRL", 210: "NLD", 211: "BEL", 212: "LUX", 220: "FRA", 221: "MCO", 223: "LIE", 225: "CHE",
    230: "ESP", 232: "AND", 235: "PRT", 260: "DEU", 265: "DEU", 290: "POL", 305: "AUT", 310: "HUN", 315: "CZE",
    316: "CZE", 317: "SVK", 325: "ITA", 327: "VAT", 331: "SMR", 338: "MLT", 339: "ALB", 341: "MNE", 343: "MKD",
    344: "HRV", 345: "SRB", 346: "BIH", 347: "XKX", 349: "SVN", 350: "GRC", 352: "CYP", 355: "BGR", 359: "MDA",
    360: "ROU", 365: "RUS", 366: "EST", 367: "LVA", 368: "LTU", 369: "UKR", 370: "BLR", 371: "ARM", 372: "GEO",
    373: "AZE", 375: "FIN", 380: "SWE", 385: "NOR", 390: "DNK", 395: "ISL",
    402: "CPV", 403: "STP", 404: "GNB", 411: "GNQ", 420: "GMB", 432: "MLI", 433: "SEN", 434: "BEN", 435: "MRT",
    436: "NER", 437: "CIV", 438: "GIN", 439: "BFA", 450: "LBR", 451: "SLE", 452: "GHA", 461: "TGO", 471: "CMR",
    475: "NGA", 481: "GAB", 482: "CAF", 483: "TCD", 484: "COG", 490: "COD", 500: "UGA", 501: "KEN", 510: "TZA",
    511: "TZA", 516: "BDI", 517: "RWA", 520: "SOM", 522: "DJI", 530: "ETH", 531: "ERI", 540: "AGO", 541: "MOZ",
    551: "ZMB", 552: "ZWE", 553: "MWI", 560: "ZAF", 565: "NAM", 570: "LSO", 571: "BWA", 572: "SWZ", 580: "MDG",
    581: "COM", 590: "MUS", 591: "SYC",
    600: "MAR", 615: "DZA", 616: "TUN", 620: "LBY", 625: "SDN", 626: "SSD", 630: "IRN", 640: "TUR", 645: "IRQ",
    651: "EGY", 652: "SYR", 660: "LBN", 663: "JOR", 666: "ISR", 670: "SAU", 678: "YEM", 680: "YEM", 690: "KWT",
    692: "BHR", 694: "QAT", 696: "ARE", 698: "OMN",
    700: "AFG", 701: "TKM", 702: "TJK", 703: "KGZ", 704: "UZB", 705: "KAZ", 710: "CHN", 711: "CHN", 712: "MNG",
    713: "TWN", 731: "PRK", 732: "KOR", 740: "JPN", 750: "IND", 751: "IND", 760: "BTN", 770: "PAK", 771: "BGD",
    775: "MMR", 780: "LKA", 781: "MDV", 790: "NPL", 800: "THA", 811: "KHM", 812: "LAO", 816: "VNM", 817: "VNM",
    820: "MYS", 830: "SGP", 835: "BRN", 840: "PHL", 850: "IDN", 860: "TLS",
    900: "AUS", 910: "PNG", 920: "NZL", 935: "VUT", 940: "SLB", 950: "FJI", 970: "KIR", 971: "NRU", 972: "TON",
    973: "TUV", 983: "MHL", 986: "PLW", 987: "FSM", 990: "WSM",
}

STATE_BASED, NON_STATE, ONE_SIDED = 1, 2, 3


def gw_iso3(code: str | int) -> str:
    gw = int(code)
    if gw not in GW_ISO3:
        raise RuntimeError(f"UCDP 的 Gleditsch–Ward 編號 {gw} 沒有對到 ISO alpha-3，要加進 GW_ISO3")
    return GW_ISO3[gw]


def gw_list(text: str) -> list[int]:
    """「630, 645」→ [630, 645]（ACD 的國家欄位，好幾國時用逗號分開）"""
    return [int(p) for p in text.split(",") if p.strip()]


def _rows(url: str, filename: str):
    path = download(url, "ucdp", filename)
    with zipfile.ZipFile(path) as z:
        csvs = [i for i in z.infolist() if i.filename.lower().endswith(".csv")]
        if len(csvs) != 1:
            raise RuntimeError(f"{filename} 裡應該只有一個 CSV，實際是 {[i.filename for i in csvs]}")
        with z.open(csvs[0]) as raw:
            yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""))


@dataclass(frozen=True)
class Event:
    """GED 的一起事件（只留用得到的欄位）"""
    id: int
    year: int
    active: bool  # active_year：這個衝突／行為者在這一年達到 25 人的門檻（UCDP 公布的年度數字只算這些）
    type: int  # 1 以國家為一方、2 非國家、3 單方面暴力
    conflict_id: int  # conflict_new_id：以國家為一方的事件就是 ACD 的 conflict_id
    conflict_name: str
    gw: int  # 事件發生的國家（當時的 GW 國家）
    country: str
    adm_1: str
    place: str  # where_coordinates：UCDP 用來定位的地名（例如「Bakhmut town」）
    where_prec: int  # 1 精確地點 … 6 只知道國家、7 國際水域或空域
    lon: float
    lat: float
    start: date
    deaths: int  # best：死亡人數的最佳估計


def ged_events() -> list[Event]:
    out = []
    for r in _rows(GED_URL, "ged261-csv.zip"):
        out.append(Event(
            id=int(r["id"]), year=int(r["year"]), active=r["active_year"] == "true",
            type=int(r["type_of_violence"]), conflict_id=int(r["conflict_new_id"]),
            conflict_name=r["conflict_name"].strip(), gw=int(r["country_id"]), country=r["country"],
            adm_1=r["adm_1"].strip(), place=r["where_coordinates"].strip(), where_prec=int(r["where_prec"]),
            lon=float(r["longitude"]), lat=float(r["latitude"]),
            start=date.fromisoformat(r["date_start"][:10]), deaths=int(r["best"]),
        ))
    return out


@dataclass(frozen=True)
class ConflictYear:
    """ACD 的一列：一個以國家為一方的武裝衝突在某一年"""
    conflict_id: int
    year: int
    location: str  # UCDP 寫的所在國名稱（「Russia (Soviet Union), Ukraine」）
    location_gw: list[int]  # gwno_loc：被挑戰的國家（國家間衝突是雙方政府的國家），不一定是戰鬥發生的地方
    side_a: str
    side_b: str
    incompatibility: int  # 1 領土、2 政府、3 兩者
    territory: str
    intensity: int  # 1 小型（25–999 人戰鬥死亡）、2 戰爭（1,000 人以上）
    type: int  # 1 殖民地外（extrasystemic）、2 國家間、3 國內、4 有外國介入的國內
    start_date: str


def armed_conflicts() -> list[ConflictYear]:
    out = []
    for r in _rows(ACD_URL, "ucdp-prio-acd-261-csv.zip"):
        if r["version"] != VERSION:
            raise RuntimeError(f"ACD 的版本是 {r['version']}，不是 {VERSION}")
        out.append(ConflictYear(
            conflict_id=int(r["conflict_id"]), year=int(r["year"]), location=r["location"].strip(),
            location_gw=gw_list(r["gwno_loc"]), side_a=r["side_a"].strip(), side_b=r["side_b"].strip(),
            incompatibility=int(r["incompatibility"]), territory=r["territory_name"].strip(),
            intensity=int(r["intensity_level"]), type=int(r["type_of_conflict"]), start_date=r["start_date"],
        ))
    return out
