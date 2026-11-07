"""歐盟派駐地城市的房租（2026-11-07，製作手冊第二十五批 470，候選 1121；步驟 real-estate-rents，輸出 topics/housing/rents/，
新主題「房價與房租」〔real-estate〕的資料跟原本的房價一樣放在 housing/）。

- Eurostat `prc_colc_rents`（Average rent per month in cities by type of dwelling，2013–2025，CC BY 4.0）：
  44 個城市、五種房型（FLAT1／FLAT2／FLAT3 一到三房公寓、HOUSE_D 獨棟、HOUSE_ND 連棟），歐元。這是 Eurostat 替
  歐盟職員算生活補正係數的派駐地調查（給外派人員的典型出租住宅），不是各國主要城市的樣本：有卡爾斯魯厄、波昂、
  瓦雷澤（伊斯普拉的聯合研究中心）、海牙，沒有巴塞隆納、米蘭、漢堡。倫敦、Culham（英國）與普里斯提納（科索沃）
  照網站的規則不收（sources/eurostat.py 的 NONCOMMERCIAL）。
- 城市位置：Natural Earth 1:10m populated places（公有領域，topics/travel.py 已在用）的首都與城市；瓦雷澤不在 Natural
  Earth，用 Wikidata（CC0，QLever）的座標。
- 台灣：內政部實價登錄的租賃案件（plvr.land.moi.gov.tw 的季資料 zip，政府資料開放授權條款），2026 年第 3 季發布的
  六都：整棟（戶）出租、公寓／華廈／住宅大樓、住家用或集合住宅、至少 1 廳，依「房」數對到一到三房，月租扣掉車位的
  租金後取中位數；用 Eurostat 2025 年的歐元兌新台幣年平均匯率換成歐元，放在 2025 年的位置（說明寫明）。只有有申報的租約，
  筆數寫在 tooltip。
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import re
import statistics
import zipfile

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_manifest_part
from sources import qlever_wikidata
from sources.eurostat import NONCOMMERCIAL, URL, _iso3
from topics.travel import POPULATED_PLACES_URL

OUT = OUT_DIR / "topics" / "housing" / "rents"  # rents.json 寫在 housing/ 底下
TYPES = {"FLAT1": "flat1", "FLAT2": "flat2", "FLAT3": "flat3", "HOUSE_D": "house-d", "HOUSE_ND": "house-nd"}
FIRST, LAST = 2013, 2025
SEASON = "115S3"
TW_SEASON = "2026 年第 3 季"
LVR = "https://plvr.land.moi.gov.tw//DownloadSeason?season={}&type=zip&fileName=lvr_landcsv.zip"
# 派駐地（不是首都）的城市：Eurostat 代碼 → Natural Earth 的名稱（瓦雷澤另外查）
DELEGATIONS = {"CH_DEL": "Geneva", "DE_DEL1": "Karlsruhe", "DE_DEL2": "Munich", "DE_DEL3": "Bonn", "NL_DEL": "The Hague",
               "IT_DEL": None}
ZH = {
    "AL_CAP": "地拉那", "AT_CAP": "維也納", "BA_CAP": "塞拉耶佛", "BE_CAP": "布魯塞爾", "BG_CAP": "索菲亞", "CH_CAP": "伯恩",
    "CH_DEL": "日內瓦", "CY_CAP": "尼科西亞", "CZ_CAP": "布拉格", "DE_CAP": "柏林", "DE_DEL1": "卡爾斯魯厄", "DE_DEL2": "慕尼黑",
    "DE_DEL3": "波昂", "DK_CAP": "哥本哈根", "EE_CAP": "塔林", "EL_CAP": "雅典", "ES_CAP": "馬德里", "FI_CAP": "赫爾辛基",
    "FR_CAP": "巴黎", "HR_CAP": "札格瑞布", "HU_CAP": "布達佩斯", "IE_CAP": "都柏林", "IS_CAP": "雷克雅維克", "IT_CAP": "羅馬",
    "IT_DEL": "瓦雷澤", "LT_CAP": "維爾紐斯", "LU_CAP": "盧森堡", "LV_CAP": "里加", "ME_CAP": "波德里查", "MK_CAP": "斯科普里",
    "MT_CAP": "瓦萊塔", "NL_DEL": "海牙", "NO_CAP": "奧斯陸", "PL_CAP": "華沙", "PT_CAP": "里斯本", "RO_CAP": "布加勒斯特",
    "RS_CAP": "貝爾格勒", "SE_CAP": "斯德哥爾摩", "SI_CAP": "盧布爾雅那", "SK_CAP": "布拉提斯拉瓦", "TR_CAP": "安卡拉",
}
# 台灣六都：實價登錄的縣市代碼 → (中文, 英文, Natural Earth 的名稱)
TW_CITIES = {"a": ("臺北市", "Taipei", "Taipei"), "f": ("新北市", "New Taipei", "New Taipei"),
             "h": ("桃園市", "Taoyuan", "Taoyuan"), "b": ("臺中市", "Taichung", "Taichung"),
             "d": ("臺南市", "Tainan", "Tainan"), "e": ("高雄市", "Kaohsiung", "Kaohsiung")}
TW_TYPES = {1: "flat1", 2: "flat2", 3: "flat3"}
TW_BUILDINGS = ("公寓", "華廈", "住宅大樓")


def _places() -> tuple[dict[str, tuple[str, float, float]], dict[tuple[str, str], tuple[float, float]]]:
    """({ISO3: (首都英文名, 緯度, 經度)}, {(ISO3, 名稱): (緯度, 經度)})"""
    path = download(POPULATED_PLACES_URL, "natural-earth", "ne_10m_populated_places.geojson")
    capitals: dict[str, tuple[float, tuple[str, float, float]]] = {}
    named = {}
    for feat in json.loads(path.read_text(encoding="utf-8"))["features"]:
        p = feat["properties"]
        named[(p["ADM0_A3"], p["NAME"])] = (p["LATITUDE"], p["LONGITUDE"])
        if p["FEATURECLA"] in ("Admin-0 capital", "Admin-0 capital alt"):
            rank = (p["FEATURECLA"] == "Admin-0 capital") * 1e12 + (p.get("POP_MAX") or 0)
            if p["ADM0_A3"] not in capitals or rank > capitals[p["ADM0_A3"]][0]:
                capitals[p["ADM0_A3"]] = (rank, (p["NAME"], p["LATITUDE"], p["LONGITUDE"]))
    return {k: v for k, (_, v) in capitals.items()}, named


def _varese() -> tuple[float, float]:
    rows = qlever_wikidata.cached("varese-coord", """SELECT ?coord WHERE {
  ?c rdfs:label "Varese"@it ; wdt:P31 wd:Q747074 ; wdt:P625 ?coord . }""")
    lon, lat = re.search(r"\(([-\d.]+) ([-\d.]+)\)", rows[0]["coord"]["value"]).groups()
    return float(lat), float(lon)


def _eurostat() -> dict[str, dict[str, dict[int, float]]]:
    """{城市代碼: {房型: {年: 歐元}}}"""
    path = download(URL.format(dataset="prc_colc_rents"), "eurostat", "prc_colc_rents.tsv.gz")
    out: dict[str, dict[str, dict[int, float]]] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        header = f.readline().rstrip("\n").split("\t")
        years = [int(h) for h in header[1:]]
        for line in f:
            cells = line.rstrip("\n").split("\t")
            _, building, currency, geo = cells[0].split(",")
            if currency != "EUR" or building not in TYPES:
                continue
            values = {}
            for y, cell in zip(years, cells[1:]):
                num = cell.strip().split(" ")[0]
                if num not in (":", ""):
                    values[y] = float(num)
            out.setdefault(geo, {})[TYPES[building]] = values
    return out


def _eur_twd() -> tuple[int, float]:
    path = download(URL.format(dataset="ert_bil_eur_a"), "eurostat", "ert_bil_eur_a.tsv.gz")
    with gzip.open(path, "rt", encoding="utf-8") as f:
        years = [int(h) for h in f.readline().rstrip("\n").split("\t")[1:]]
        for line in f:
            cells = line.rstrip("\n").split("\t")
            if cells[0] == "A,AVG,NAC,TWD":
                vals = {y: float(c.split(" ")[0]) for y, c in zip(years, cells[1:]) if c.strip().split(" ")[0] not in (":", "")}
                return max(vals), vals[max(vals)]
    raise RuntimeError("Eurostat ert_bil_eur_a 沒有 TWD")


def _taiwan() -> dict[str, dict[str, tuple[float, int]]]:
    """{縣市代碼: {房型: (月租中位數新台幣, 筆數)}}"""
    path = download(LVR.format(SEASON), "moi-lvr", f"{SEASON}.zip")
    out: dict[str, dict[str, tuple[float, int]]] = {}
    with zipfile.ZipFile(path) as z:
        for code in TW_CITIES:
            rows = list(csv.reader(io.StringIO(z.read(f"{code}_lvr_land_c.csv").decode("utf-8-sig"))))
            col = {k: i for i, k in enumerate(rows[0])}
            rents: dict[str, list[float]] = {t: [] for t in TW_TYPES.values()}
            for r in rows[2:]:
                if (r[col["出租型態"]] != "整棟(戶)出租" or not r[col["建物型態"]].startswith(TW_BUILDINGS)
                        or r[col["主要用途"]] not in ("住家用", "集合住宅") or not r[col["交易標的"]].startswith("租賃房屋")):
                    continue
                try:
                    rooms, halls = int(r[col["建物現況格局-房"]]), int(r[col["建物現況格局-廳"]])
                    rent = float(r[col["總額元"]]) - float(r[col["車位總額元"]] or 0)
                except ValueError:
                    continue
                if rooms in TW_TYPES and halls >= 1 and rent > 0:
                    rents[TW_TYPES[rooms]].append(rent)
            out[code] = {t: (statistics.median(v), len(v)) for t, v in rents.items() if len(v) >= 10}
    return out


def build() -> None:
    capitals, named = _places()
    data = _eurostat()
    rate_year, rate = _eur_twd()
    tw = _taiwan()
    cities = []
    for geo, by_type in sorted(data.items()):
        iso3 = _iso3(geo.split("_")[0])
        if not iso3 or iso3 in NONCOMMERCIAL:
            continue
        if geo in DELEGATIONS:
            lat, lon = _varese() if geo == "IT_DEL" else named[(iso3, DELEGATIONS[geo])]
            en = DELEGATIONS[geo] or "Varese"
        else:
            en, lat, lon = capitals[iso3]
        cities.append({"name": ZH[geo], "nameEn": en, "iso3": iso3, "lon": round(lon, 3), "lat": round(lat, 3),
                       "tw": 0, **{f"{t}_{y}": v for t, s in by_type.items() for y, v in s.items() if FIRST <= y <= LAST}})
    for code, (zh, en, ne) in TW_CITIES.items():
        lat, lon = named[("TWN", ne)]
        rec = {"name": zh, "nameEn": en, "iso3": "TWN", "lon": round(lon, 3), "lat": round(lat, 3), "tw": 1}
        for t, (ntd, n) in tw[code].items():
            rec[f"{t}_{LAST}"] = round(ntd / rate)
            rec[f"{t}_ntd"] = round(ntd)
            rec[f"{t}_n"] = n
        cities.append(rec)
    fields = sorted({k for c in cities for k in c} - {"name", "nameEn", "iso3", "lon", "lat"})
    quanta = {"lon": 0.001, "lat": 0.001}
    write_json(OUT.parent / "rents.json", points_file(cities, ["lon", "lat", "name", "nameEn", "iso3", *fields], quanta))
    top = sorted(((c.get(f"flat1_{LAST}"), c["name"]) for c in cities if c.get(f"flat1_{LAST}")), reverse=True)
    print(f"  {len(cities)} 個城市（台灣 6）；歐元兌新台幣 {rate_year} 年 {rate}")
    print(f"  一房 {LAST}：{top}")
    for code, (zh, *_rest) in TW_CITIES.items():
        print(f"    {zh}：{ {t: v for t, v in tw[code].items()} }")
    # 「城市的房租」指標的檔：只給時間軸的年份與說明，國家不上色（值是空的）；一個房型一個檔，前端才會有房型的選單
    for t in TYPES.values():
        write_json(OUT.parent / "city-rent" / f"{t}.json", indicator_file("city-rent", "", list(range(FIRST, LAST + 1)), {},
                                                                      license="CC BY 4.0"), quiet=True)
    write_manifest_part(OUT.parent, "housing", "real-estate-rents", {"eurTwd": [rate_year, rate], "taiwanSeason": TW_SEASON})
