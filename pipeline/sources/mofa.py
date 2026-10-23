"""外交部的駐外館處通訊錄（data.gov.tw 6119，政府資料開放授權條款第 1 版），以及館處所在城市的經緯度。

- 通訊錄是 JSON（UTF-8 有 BOM），每個館處一筆：中文名稱（「駐休士頓辦事處 (駐休士頓台北經濟文化辦事處)」，
  括號裡是正式名稱）、英文名稱、地址、駐在國（「美利堅合眾國」這種正式國名）、館長職稱、轄區…，沒有經緯度。
  「駐歐盟兼駐比利時代表處」在歐洲聯盟與比利時各列一次，只留比利時那一筆。
- 經緯度用 Natural Earth 1:10m populated places（公有領域）的城市點：在駐在國的城市裡，找名稱
  （英文、各國語言、日文、韓文、繁中）出現在館處英文名稱、地址或中文名稱裡的城市，所以是城市中心，不是館處的實際地址。
  找不到的大使館、代表處用該國的首都（例如坎培拉的地址只寫 Barton ACT）。
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache

import pycountry

from common import download

MISSIONS_URL = "https://www.mofa.gov.tw/OpenDataForm.aspx?s=A185CB194559BCF5"
PLACES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_populated_places.geojson"

# 通訊錄的駐在國（正式國名）→ ISO alpha-3；有新的國家時資料管線會報錯，請加在這裡
COUNTRIES = {
    "丹麥王國": "DNK", "以色列": "ISR", "俄羅斯聯邦": "RUS", "加拿大": "CAN", "匈牙利": "HUN", "南非共和國": "ZAF",
    "印度共和國": "IND", "印度尼西亞共和國": "IDN", "厄瓜多共和國": "ECU", "史瓦帝尼王國（原「史瓦濟蘭王國」）": "SWZ",
    "吐瓦魯國": "TUV", "哥倫比亞共和國": "COL", "土耳其共和國": "TUR", "墨西哥合眾國": "MEX",
    "大不列顛暨北愛爾蘭聯合王國": "GBR", "大韓民國": "KOR", "奈及利亞聯邦共和國": "NGA", "奧地利共和國": "AUT",
    "巴布亞紐幾內亞獨立國": "PNG", "巴拉圭共和國": "PRY", "巴林王國": "BHR", "巴西聯邦共和國": "BRA",
    "希臘共和國": "GRC", "帛琉共和國": "PLW", "德意志聯邦共和國": "DEU", "愛爾蘭": "IRL", "拉脫維亞共和國": "LVA",
    "捷克共和國": "CZE", "教廷": "VAT", "斐濟共和國": "FJI", "斯洛伐克共和國": "SVK", "新加坡共和國": "SGP",
    "日本國": "JPN", "智利共和國": "CHL", "比利時王國": "BEL", "汶萊和平之國": "BRN", "沙烏地阿拉伯王國": "SAU",
    "法蘭西共和國": "FRA", "波蘭共和國": "POL", "泰王國": "THA", "海地共和國": "HTI", "澳大利亞聯邦": "AUS",
    "瑞典王國": "SWE", "瑞士聯邦": "CHE", "瓜地馬拉共和國": "GTM", "科威特": "KWT", "秘魯共和國": "PER",
    "立陶宛共和國": "LTU", "約旦哈希米王國": "JOR", "紐西蘭": "NZL", "索馬利蘭共和國": "_SOL",
    "緬甸聯邦共和國": "MMR", "美利堅合眾國": "USA", "義大利共和國": "ITA", "聖克里斯多福及尼維斯聯邦": "KNA",
    "聖文森及格瑞那丁": "VCT", "聖露西亞": "LCA", "芬蘭共和國": "FIN", "荷蘭王國": "NLD", "菲律賓共和國": "PHL",
    "葡萄牙共和國": "PRT", "蒙古國": "MNG", "西班牙王國": "ESP", "象牙海岸共和國": "CIV", "貝里斯": "BLZ",
    "越南社會主義共和國": "VNM", "阿拉伯聯合大公國": "ARE", "阿曼王國": "OMN", "阿根廷共和國": "ARG",
    "馬來西亞": "MYS", "馬紹爾群島共和國": "MHL",
}
SKIP_COUNTRIES = {"歐洲聯盟"}  # 跟比利時是同一個館處

# 館處類型的代碼；跟 src/topics/diplomacy.ts 的 MISSION_TYPES 一致
EMBASSY = 1
CONSULATE_GENERAL = 2
REPRESENTATIVE = 3  # 無邦交國家的主要館處（代表處、代表團、經濟文化中心…）
BRANCH = 4  # 其他城市的辦事處、分處
IGO = 5  # 常駐國際組織的代表團（世界貿易組織）

# Natural Earth 的國家代碼跟 ISO 不同的
NE_COUNTRIES = {"SOL": "_SOL", "KOS": "XKX", "SDS": "SSD", "SAH": "ESH", "PSX": "PSE"}
# 館處所在的海外領地：例如駐關島辦事處的駐在國是美國，城市要在關島找
EXTRA_PLACES = {"USA": ["GUM", "PRI", "VIR", "ASM", "MNP"]}
NAME_FIELDS = (
    "NAME", "NAMEASCII", "NAME_EN", "NAME_DE", "NAME_ES", "NAME_FR", "NAME_IT", "NAME_PT", "NAME_NL", "NAME_SV",
    "NAME_PL", "NAME_HU", "NAME_TR", "NAME_ID", "NAME_VI", "NAME_EL",
)
CJK_FIELDS = ("NAME_JA", "NAME_KO", "NAME_ZHT")


@dataclass
class Mission:
    name: str  # 中文簡稱，例如「駐休士頓辦事處」
    official: str  # 括號裡的正式名稱，例如「駐休士頓台北經濟文化辦事處」（沒有就跟 name 一樣）
    name_en: str
    iso3: str
    type: int
    city: str
    lon: float
    lat: float
    website: str


@dataclass
class Place:
    name: str
    iso3: str
    lon: float
    lat: float
    capital: bool
    pop: float
    names: list[str]
    cjk: list[str]


COUNTRY_NAMES = {
    n for c in pycountry.countries for n in (c.name, getattr(c, "official_name", None), getattr(c, "common_name", None)) if n
}


@lru_cache(maxsize=1)
def places() -> dict[str, list[Place]]:
    """Natural Earth 的城市點，依國家分組"""
    path = download(PLACES_URL, "natural-earth", "ne_10m_populated_places.geojson")
    with open(path, encoding="utf-8") as f:
        features = json.load(f)["features"]
    out: dict[str, list[Place]] = {}
    for feat in features:
        p = feat["properties"]
        iso3 = NE_COUNTRIES.get(p["ADM0_A3"], p["ADM0_A3"])
        names = {p[k] for k in NAME_FIELDS if p.get(k)}
        names |= {n for n in (p.get("NAMEALT") or "").split("|") if len(n) > 3}
        # 「Tel Aviv-Yafo」這種連字號後面是別名的，前半段也算
        names |= {n.split("-")[0] for n in list(names) if "-" in n and len(n.split("-")[0]) >= 5}
        # 有些城市的外語名稱欄位填的是國名（Portalegre 的某個名稱是「Portugal」），國名不算城市名稱
        names -= COUNTRY_NAMES | {p["ADM0NAME"], p["SOV0NAME"]}
        cjk = {re.sub(r"(市|都|府|縣|廣域市|特別市|広域市)$", "", p[k]) for k in CJK_FIELDS if p.get(k)}
        out.setdefault(iso3, []).append(Place(
            re.sub(r"\s+", " ", p["NAME"]), iso3, float(p["LONGITUDE"]), float(p["LATITUDE"]),
            # 海外領地的首府（關島的 Agana）是「Admin-0 region capital」，ADM0CAP 是 0
            bool(p["ADM0CAP"]) or p["FEATURECLA"] == "Admin-0 region capital", float(p["POP_MAX"] or 0),
            sorted(n for n in names if len(n) >= 3), sorted(n for n in cjk if len(n) >= 2),
        ))
    return out


def _found(name: str, text: str) -> bool:
    """拉丁字母的名稱要是完整的詞（前面不是字母，後面不是小寫字母：地址常常黏在一起，例如「Kuala LumpurMalaysia」）"""
    return re.search(rf"(?<![A-Za-zÀ-ÿ]){re.escape(name)}(?![a-zà-ÿ])", text, re.IGNORECASE) is not None


def _geocode(iso3: str, name_en: str, address: str, name_zh: str, primary: bool) -> Place:
    """館處所在的城市：英文名稱裡的城市 3 分、地址 2 分、中文名稱 1 分，同分取名稱較長、人口較多的"""
    candidates = [p for code in [iso3, *EXTRA_PLACES.get(iso3, [])] for p in places().get(code, [])]
    best: tuple | None = None
    for p in candidates:
        score = 0
        length = 0
        for n in p.names:
            hit = 3 * _found(n, name_en) + 2 * _found(n, address) + _found(n, name_zh)
            if hit:
                score, length = max(score, hit), max(length, len(n))
        for n in p.cjk:
            hit = 2 * (n in address) + (n in name_zh)
            if hit:
                score, length = max(score, hit), max(length, len(n))
        if score and (best is None or (score, length, p.pop) > best[:3]):
            best = (score, length, p.pop, p)
    if best:
        return best[3]
    # 找不到城市：海外領地的館處（英文名稱寫「in Guam」）用領地的首府，大使館、代表處用駐在國的首都
    codes = [c for c in EXTRA_PLACES.get(iso3, []) if TERRITORY_NAMES[c].lower() in f"{name_en} {address}".lower()]
    if primary:
        codes.append(iso3)
    for code in codes:
        capitals = [p for p in places().get(code, []) if p.capital]
        if capitals:
            return max(capitals, key=lambda p: p.pop)
    raise RuntimeError(f"找不到館處所在的城市：{name_zh}（{name_en}；{address}）")


TERRITORY_NAMES = {"GUM": "Guam", "PRI": "Puerto Rico", "VIR": "Virgin Islands", "ASM": "American Samoa", "MNP": "Mariana"}


def _split_name(name: str) -> tuple[str, str]:
    """「駐休士頓辦事處 (駐休士頓台北經濟文化辦事處)」→（簡稱, 正式名稱）"""
    name = re.sub(r"\s+", " ", name).strip()
    m = re.match(r"^(.+?)\s*[（(](.+)[）)]$", name)
    return (m.group(1).strip(), m.group(2).strip()) if m else (name, name)


def missions() -> list[Mission]:
    path = download(MISSIONS_URL, "mofa", "overseas-missions.json")
    with open(path, encoding="utf-8-sig") as f:
        rows = json.load(f)
    unknown = sorted({r["CountryName"] for r in rows if r["CountryName"] not in COUNTRIES and r["CountryName"] not in SKIP_COUNTRIES})
    if unknown:
        raise RuntimeError(f"駐外館處通訊錄有新的駐在國，請加進 mofa.COUNTRIES：{unknown}")

    by_country: dict[str, list[dict]] = {}
    for r in rows:
        if r["CountryName"] in SKIP_COUNTRIES:
            continue
        by_country.setdefault(COUNTRIES[r["CountryName"]], []).append(r)

    out: list[Mission] = []
    for iso3, group in by_country.items():
        for r in group:
            short, official = _split_name(r["Name"])
            if "大使館" in short:
                kind = EMBASSY
            elif "總領事館" in short:
                kind = CONSULATE_GENERAL
            elif "世界貿易組織" in short or "常駐" in short:
                kind = IGO
            elif re.search(r"代表處|代表團|代表部", short):
                kind = REPRESENTATIVE
            else:
                kind = BRANCH
            out.append(Mission(short, official, re.sub(r"\s+", " ", r["EnName"]).strip(), iso3, kind, "", 0, 0, r["Website"].strip()))
        # 沒有大使館、也沒有叫代表處的國家（例如駐葡萄牙台北經濟文化中心、駐斐濟臺北商務辦事處、駐杜拜辦事處），
        # 唯一的館處就是主要館處
        mine = [m for m in out if m.iso3 == iso3]
        if not any(m.type in (EMBASSY, REPRESENTATIVE) for m in mine):
            branches = [m for m in mine if m.type == BRANCH]
            if len(branches) != 1:
                raise RuntimeError(f"{iso3} 的館處看不出哪一個是主要館處：{[m.name for m in mine]}")
            branches[0].type = REPRESENTATIVE

    rows_by_name = {_split_name(r["Name"])[0]: r for r in rows if r["CountryName"] not in SKIP_COUNTRIES}
    for m in out:
        r = rows_by_name[m.name]
        place = _geocode(m.iso3, m.name_en, re.sub(r"\s+", " ", r["Address"]), m.name, m.type in (EMBASSY, REPRESENTATIVE, IGO))
        m.city, m.lon, m.lat = place.name, place.lon, place.lat
    return out
