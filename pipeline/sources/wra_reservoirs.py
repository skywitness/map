"""台灣的水庫（DESIGN.md 第 8 節第 96 點）：GDW 只有台灣 32 座、6 座有名字，翡翠、德基都對不到，改用水利署的公告水庫。

- 名單與容量：經濟部水利署「水庫基本資料」（data.gov.tw 32726，113 年，40 座；政府資料開放授權條款第 1 版）：
  名稱、河川、型式、壩高、目前總容量（萬立方公尺，換成百萬立方公尺要除以 100）、功能。沒有座標、沒有完工年份。
- 座標：Wikidata（CC0）的壩或水庫項目（QID 寫在 RESERVOIRS，壩優先，因為 GDW 的點在壩上）；直潭壩 Wikidata 沒有座標，
  用 GDW 的點（GDW_ID 19182，跟 OpenStreetMap 的直潭壩差 150 m）；小池水庫兩邊都沒有，用 OpenStreetMap（ODbL）
  way 419003681 的位置。
- 完工年份：水利署網站「主要水庫簡介」各水庫的「興建時間」的結束年（22 座，網址寫在 YEARS；政府網站資料開放宣告，
  政府資料開放授權條款第 1 版，DESIGN.md 第 8 節第 12 點）；集集攔河堰、東衛水庫用 Wikidata 的 P571。其他 16 座找不到
  可用的出處，年份不明（地圖上灰色）。
"""
from __future__ import annotations

import csv
import json
import re
import urllib.parse
from dataclasses import dataclass

from common import download

CSV_URL = "https://opendata.wra.gov.tw/api/v2/708a43b0-24dc-40b7-9ed2-fca6a291e7ae?sort=_importdate%20asc&format=CSV"
DATASET = "https://data.gov.tw/dataset/32726"
WRA_INTRO = "https://www.wra.gov.tw/News_Content.aspx?n=3254&s={}"
SPARQL = "https://query.wikidata.org/sparql"

# 水庫名稱 → (Wikidata QID 或座標, 英文名稱)。QID 選壩的項目（翡翠水壩、石門水壩…），沒有壩的項目才用水庫；
# 英文名稱用 Wikidata 的英文標籤，沒有才用這裡寫的（漢語拼音）
RESERVOIRS: dict[str, tuple[str | tuple[float, float], str]] = {
    "新山水庫": ("Q11082376", "Xinshan Reservoir"),
    "西勢水庫": ("Q15911729", "Xishi Reservoir"),
    "翡翠水庫": ("Q5441591", "Feitsui Dam"),
    "直潭壩": ((121.5327, 24.9254), "Zhitan Dam"),  # GDW_ID 19182
    "石門水庫": ("Q7496474", "Shihmen Dam"),
    "寶山水庫": ("Q113958550", "Baoshan Reservoir"),
    "寶山第二水庫": ("Q113958525", "Baoshan Second Reservoir"),
    "大埔水庫": ("Q11051816", "Dapu Reservoir"),
    "永和山水庫": ("Q28485836", "Yonghershan Reservoir"),
    "明德水庫": ("Q6864810", "Mingde Dam"),
    "鯉魚潭水庫": ("Q101096721", "Liyutan Dam"),
    "德基水庫": ("Q7692199", "Techi Dam"),
    "谷關水庫": ("Q15240721", "Kukuan Dam"),
    "石岡壩": ("Q14870433", "Shigang Dam"),
    "霧社水庫": ("Q15453614", "Wushe Dam"),
    "日月潭水庫": ("Q716206", "Sun Moon Lake"),
    "集集攔河堰": ("Q15906505", "Jiji Weir"),
    "湖山水庫": ("Q15904733", "Hushan Dam"),
    "仁義潭水庫": ("Q50809016", "Renyitan Dam"),
    "蘭潭水庫": ("Q15910017", "Lantan Reservoir"),
    "鹿寮溪水庫": ("Q11174996", "Luliaoxi Reservoir"),
    "白河水庫": ("Q15920340", "Baihe Reservoir"),
    "尖山埤水庫": ("Q11038113", "Jianshanpi Reservoir"),
    "德元埤水庫": ("Q15914512", "Deyuanpi Reservoir"),
    "烏山頭水庫": ("Q16903794", "Wushantou Dam"),
    "曾文水庫": ("Q11091530", "Tsengwen Dam"),
    "南化水庫": ("Q10907029", "Nanhua Dam"),
    "鏡面水庫": ("Q15911069", "Jingmian Reservoir"),
    "鹽水埤水庫": ("Q11174907", "Yanshuipi Reservoir"),
    "虎頭埤水庫": ("Q85444602", "Hutoupi Reservoir"),
    "阿公店水庫": ("Q15910782", "Agongdian Reservoir"),
    "鳳山水庫": ("Q11173758", "Fengshan Reservoir"),
    "澄清湖水庫": ("Q57333", "Chengcing Lake"),
    "牡丹水庫": ("Q15909789", "Mudan Dam"),
    "成功水庫": ("Q17164627", "Chenggong Reservoir"),
    "興仁水庫": ("Q20688952", "Xingren Reservoir"),
    "東衛水庫": ("Q116875049", "Dongwei Reservoir"),
    "小池水庫": ((119.5096, 23.6102), "Xiaochi Reservoir"),  # OpenStreetMap way 419003681
    "西安水庫": ("Q107740049", "Xi'an Reservoir"),
    "七美水庫": ("Q10864722", "Qimei Reservoir"),
}

# 完工年份：水利署「主要水庫簡介」的興建時間（結束年），值是 (年, 網頁的 s 參數)；
# 南化水庫的興建時間 1985–1999 含甲仙攔河堰，用簡介寫的「1993 年 11 月主壩完工蓄水」；
# 新山水庫 1980 年完工、1999 年加高；蘭潭水庫 1944 年完工，之後加高
YEARS: dict[str, tuple[int, int]] = {
    "新山水庫": (1980, 19367),
    "翡翠水庫": (1987, 19368),
    "石門水庫": (1964, 19369),
    "寶山水庫": (1985, 19370),
    "寶山第二水庫": (2006, 19371),
    "永和山水庫": (1984, 19372),
    "鯉魚潭水庫": (1992, 19373),
    "明德水庫": (1970, 19374),
    "德基水庫": (1974, 19375),
    "石岡壩": (1977, 19376),
    "霧社水庫": (1959, 19377),
    "日月潭水庫": (1934, 19378),
    "湖山水庫": (2016, 19379),
    "蘭潭水庫": (1944, 19380),
    "仁義潭水庫": (1987, 19381),
    "白河水庫": (1965, 19382),
    "曾文水庫": (1973, 19383),
    "烏山頭水庫": (1930, 19384),
    "南化水庫": (1993, 19385),
    "阿公店水庫": (1953, 19386),
    "牡丹水庫": (1995, 19387),
    "成功水庫": (1973, 19388),
}
# Wikidata 英文標籤的錯字
EN_FIXES = {"Fongshan Reservior": "Fongshan Reservoir"}
# Wikidata 的 P571（成立或建造時間）
WIKIDATA_YEARS = {"集集攔河堰": 2001, "東衛水庫": 1981}

# 功能 → gdw.USES 的位元（工業用水也算給水；攔砂、生態保育、引水算其他）
FUNCTIONS = {"灌溉": 1, "發電": 2, "公共給水": 4, "工業用水": 4, "防洪": 8, "觀光": 16}


@dataclass
class Reservoir:
    name: str
    name_en: str
    river: str
    height: float | None
    capacity: float | None  # 目前總容量，百萬立方公尺
    uses: int
    year: int | None
    lon: float
    lat: float


def _num(v: str) -> float | None:
    v = v.replace(",", "").strip()
    try:
        return float(v)
    except ValueError:
        return None


def _wikidata(qids: list[str]) -> dict[str, tuple[float, float, str | None]]:
    """{QID: (經度, 緯度, 英文標籤或 None)}"""
    query = (
        "SELECT ?item ?coord ?en WHERE { VALUES ?item { %s } ?item wdt:P625 ?coord "
        'OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en) = "en") } }' % " ".join(f"wd:{q}" for q in qids)
    )
    url = f"{SPARQL}?{urllib.parse.urlencode({'query': query, 'format': 'json'})}"
    with open(download(url, "wikidata", "tw-reservoirs.json"), encoding="utf-8") as f:
        rows = json.load(f)["results"]["bindings"]
    out: dict[str, tuple[float, float, str | None]] = {}
    for row in rows:
        qid = row["item"]["value"].rsplit("/", 1)[1]
        lon, lat = map(float, re.findall(r"-?[\d.]+", row["coord"]["value"]))
        # 有兩個座標的（翡翠水壩）取第一個，兩個相差不到 50 m
        out.setdefault(qid, (lon, lat, row.get("en", {}).get("value")))
    return out


def reservoirs() -> list[Reservoir]:
    path = download(CSV_URL, "wra", "reservoirs.csv")
    with open(path, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    wd = _wikidata([q for q, _ in RESERVOIRS.values() if isinstance(q, str)])
    out = []
    for r in rows:
        name = r["水庫名稱"].strip()
        if name not in RESERVOIRS:
            raise ValueError(f"水利署的水庫基本資料多了 {name}，要在 RESERVOIRS 加上座標")
        where, name_en = RESERVOIRS[name]
        if isinstance(where, str):
            lon, lat, label = wd[where]
            name_en = EN_FIXES.get(label, label) if label else name_en
        else:
            lon, lat = where
        uses = 0
        for part in re.split(r"[、,，]", r["功能"]):
            uses |= FUNCTIONS.get(part.strip(), 512 if part.strip() else 0)
        cap = _num(r["目前總容量"])
        year = YEARS[name][0] if name in YEARS else WIKIDATA_YEARS.get(name)
        out.append(Reservoir(
            name=name,
            name_en=name_en,
            river=re.sub(r"\s+", "", r["河川名稱"]),
            height=_num(r["壩堰高"]),
            capacity=cap / 100 if cap is not None else None,
            uses=uses,
            year=year,
            lon=lon,
            lat=lat,
        ))
    missing = set(RESERVOIRS) - {r.name for r in out}
    if missing:
        print(f"  水利署的水庫基本資料少了 {', '.join(sorted(missing))}")
    return out
