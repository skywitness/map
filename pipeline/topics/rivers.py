"""河流與流域（DESIGN.md 第 8 節第 86 點）：全球的河流依最後流進哪一個大洋上色，各國的國土流向哪一個大洋。

- 河道：HydroRIVERS v1.0（sources/hydrorivers.py，HydroSHEDS 授權協議，見 DESIGN.md 第 8 節第 12 點）。
  每個河流系統是同一個出口（MAIN_RIV，最下游那一段的 ID）的所有河道。
- 流進哪一個大洋：出口那一段的最後一個點（河口）落在 IHO 的哪一片海（sources/sea_areas.py，最近的海），
  那片海屬於哪一個大洋依 Marine Regions 的 Global Oceans and Seas（IHO 2002 年草案的分章，海域大部分的面積落在哪一章）：
  地中海（含黑海）、波羅的海、墨西哥灣、加勒比海算大西洋，哈德遜灣算北冰洋，紅海、波斯灣算印度洋。
  草案把南海與印尼群島諸海另列一章，這一章的海依位置分（ARCHIPELAGIC）。內流區是 HydroRIVERS 的 ENDORHEIC = 1
  （出口在內陸，例如流進裏海的窩瓦河）。
- 各國：所有 847.8 萬段河道依出口那一點（下游端）判斷國家（geoindex，Natural Earth 1:10m），把每段自己的集水面積
  （CATCH_SKM）算給那一國，再依它的河流系統流進哪一個大洋加總，得到國土流向各大洋的比例；河道長度也一樣加總。
- 地圖上的線：依流量與集水面積挑出大河（主檔，地球儀一打開就畫）與比較小的河（10° 一格的分區，放大到 4 級以上才依畫面
  下載），相鄰的河道接成一條線（上游只接一條被挑中的河道時），再用 Douglas–Peucker 簡化、量化。
- 名稱：HydroRIVERS 沒有名稱。Natural Earth 1:10m 的河流中心線（公有領域）沿線取點、對到最近的河道，依票數找出主流的
  那一段（_stem()）；中文用 Natural Earth 附的 Wikidata 項目的繁體中文標籤（CC0），沒有的用 Natural Earth 的 name_zht。
  Natural Earth 沒有台灣的河流，台灣的主要河川寫在 TAIWAN（依河口位置與流域面積對到出口）。
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict

import numpy as np

import geoindex
from common import CACHE_DIR, OUT_DIR, download, indicator_file, lines_file, now_iso, points_file, write_json
from panel_parts import river_parts, write_country_parts
from sources import hydrorivers as hr
from sources import sea_areas
from sources import wikidata_buildings as wd

OUT = OUT_DIR / "topics" / "rivers"
YEAR = 2019  # HydroRIVERS v1.0 發布的年份（流量是 1971–2000 年的長期平均）；資料不隨時間變化，只是指標檔要有一個年份

# 類別代碼（前端 src/topics/rivers.ts 的 OCEAN 一致）
PACIFIC, ATLANTIC, INDIAN, ARCTIC, ENDORHEIC, SOUTHERN = 1, 2, 3, 4, 5, 6
CLASS_KEYS = {PACIFIC: "pacific", ATLANTIC: "atlantic", INDIAN: "indian", ARCTIC: "arctic", ENDORHEIC: "endorheic", SOUTHERN: "southern"}
CLASS_ZH = {PACIFIC: "太平洋", ATLANTIC: "大西洋", INDIAN: "印度洋", ARCTIC: "北冰洋", ENDORHEIC: "內流區", SOUTHERN: "南冰洋"}
CLASS_EN = {PACIFIC: "Pacific", ATLANTIC: "Atlantic", INDIAN: "Indian", ARCTIC: "Arctic", ENDORHEIC: "Inland", SOUTHERN: "Southern"}

# Global Oceans and Seas 的 10 章 → 大洋
GOAS_OCEAN = {
    "North Pacific Ocean": PACIFIC,
    "South Pacific Ocean": PACIFIC,
    "North Atlantic Ocean": ATLANTIC,
    "South Atlantic Ocean": ATLANTIC,
    "Mediterranean Region": ATLANTIC,
    "Baltic Sea": ATLANTIC,
    "Indian Ocean": INDIAN,
    "Arctic Ocean": ARCTIC,
    "Southern Ocean": SOUTHERN,
    "South China and Easter Archipelagic Seas": None,  # 草案另列一章，依 ARCHIPELAGIC
}
# 「南海與東部群島諸海」那一章（GOaS 沒有歸到太平洋或印度洋）的 17 片海：麻六甲海峽（安達曼海與南海之間，北邊接印度洋）、
# 莎瓦海（小巽他群島之間，向南通印度洋）算印度洋；南海、泰國灣、爪哇海、峇里海、弗洛勒斯海、班達海這些群島裡面與北邊、
# 東邊的海算太平洋（大英百科全書把南海、爪哇海、班達海寫成西太平洋的一部分）。帝汶海、阿拉弗拉海在草案本來就屬於印度洋那一章。
ARCHIPELAGIC = {
    "Malacca Strait": INDIAN,
    "Savu Sea": INDIAN,
}
ARCHIPELAGIC_DEFAULT = PACIFIC
# HydroSHEDS 把裏海、哈薩克的田吉茲湖這類大的內陸湖當成海面：流進去的河 ENDORHEIC 是 0，河口離 IHO 的海 450–1,650 km。
# 離最近的海超過這麼遠的出口算內流區（河口跟 IHO 海岸線的落差都在 100 km 以內，中間沒有出口）
INLAND_KM = 150
# IHO 的南海北界是富貴角到海壇島的連線，台灣海峽整個劃在南海裡；畫面上的名稱改寫台灣海峽（大洋不變）：
# 在 IHO 的南海裡、鵝鑾鼻到廣東南澳島連線以北的河口
TAIWAN_STRAIT = (("台灣海峽", "Taiwan Strait"), (117.1, 23.4), (120.85, 21.9))

# IHO 海域 → 畫面上的名稱（中文、英文）；None 是大洋本身（北太平洋這類），tooltip 只寫大洋
SEAS: dict[str, tuple[str, str] | None] = {
    "Rio de La Plata": ("拉布拉他河口", "Río de la Plata"),
    "Bass Strait": ("巴斯海峽", "Bass Strait"),
    "Great Australian Bight": ("大澳大利亞灣", "Great Australian Bight"),
    "Tasman Sea": ("塔斯曼海", "Tasman Sea"),
    "Mozambique Channel": ("莫三比克海峽", "Mozambique Channel"),
    "Savu Sea": ("莎瓦海", "Savu Sea"),
    "Timor Sea": ("帝汶海", "Timor Sea"),
    "Bali Sea": ("峇里海", "Bali Sea"),
    "Coral Sea": ("珊瑚海", "Coral Sea"),
    "Flores Sea": ("弗洛勒斯海", "Flores Sea"),
    "Solomon Sea": ("索羅門海", "Solomon Sea"),
    "Arafura Sea": ("阿拉弗拉海", "Arafura Sea"),
    "Gulf of Boni": ("波尼灣", "Gulf of Bone"),
    "Java Sea": ("爪哇海", "Java Sea"),
    "Ceram Sea": ("斯蘭海", "Seram Sea"),
    "Bismarck Sea": ("俾斯麥海", "Bismarck Sea"),
    "Banda Sea": ("班達海", "Banda Sea"),
    "Gulf of California": ("加利福尼亞灣", "Gulf of California"),
    "Bay of Fundy": ("芬地灣", "Bay of Fundy"),
    "Strait of Gibraltar": ("直布羅陀海峽", "Strait of Gibraltar"),
    "Alboran Sea": ("阿爾沃蘭海（地中海）", "Alboran Sea (Mediterranean)"),
    "Caribbean Sea": ("加勒比海", "Caribbean Sea"),
    "Gulf of Alaska": ("阿拉斯加灣", "Gulf of Alaska"),
    "Bering Sea": ("白令海", "Bering Sea"),
    "Chukchi Sea": ("楚科奇海", "Chukchi Sea"),
    "Beaufort Sea": ("波弗特海", "Beaufort Sea"),
    "Labrador Sea": ("拉布拉多海", "Labrador Sea"),
    "Hudson Strait": ("哈德遜海峽", "Hudson Strait"),
    "Davis Strait": ("戴維斯海峽", "Davis Strait"),
    "Baffin Bay": ("巴芬灣", "Baffin Bay"),
    "Lincoln Sea": ("林肯海", "Lincoln Sea"),
    "Bristol Channel": ("布里斯托海峽", "Bristol Channel"),
    "Irish Sea and St. George's Channel": ("愛爾蘭海", "Irish Sea"),
    "Inner Seas off the West Coast of Scotland": ("蘇格蘭西岸的內海", "Inner Seas off western Scotland"),
    "Gulf of Aden": ("亞丁灣", "Gulf of Aden"),
    "Gulf of Oman": ("阿曼灣", "Gulf of Oman"),
    "Red Sea": ("紅海", "Red Sea"),
    "Gulf of Aqaba": ("阿卡巴灣（紅海）", "Gulf of Aqaba (Red Sea)"),
    "Persian Gulf": ("波斯灣", "Persian Gulf"),
    "Ionian Sea": ("愛奧尼亞海（地中海）", "Ionian Sea (Mediterranean)"),
    "Tyrrhenian Sea": ("第勒尼安海（地中海）", "Tyrrhenian Sea (Mediterranean)"),
    "Adriatic Sea": ("亞得里亞海（地中海）", "Adriatic Sea (Mediterranean)"),
    "Gulf of Suez": ("蘇伊士灣（紅海）", "Gulf of Suez (Red Sea)"),
    "Mediterranean Sea - Eastern Basin": ("地中海", "Mediterranean Sea"),
    "Aegean Sea": ("愛琴海（地中海）", "Aegean Sea (Mediterranean)"),
    "Sea of Marmara": ("馬爾馬拉海", "Sea of Marmara"),
    "Singapore Strait": ("新加坡海峽", "Singapore Strait"),
    "Celebes Sea": ("西里伯斯海", "Celebes Sea"),
    "Malacca Strait": ("麻六甲海峽", "Strait of Malacca"),
    "Sulu Sea": ("蘇祿海", "Sulu Sea"),
    "Gulf of Thailand": ("泰國灣", "Gulf of Thailand"),
    "Eastern China Sea": ("東海", "East China Sea"),
    "Seto Naikai or Inland Sea": ("瀨戶內海", "Seto Inland Sea"),
    "Philippine Sea": ("菲律賓海", "Philippine Sea"),
    "Yellow Sea": ("黃海", "Yellow Sea"),
    "Gulf of Riga": ("里加灣（波羅的海）", "Gulf of Riga (Baltic)"),
    "Baltic Sea": ("波羅的海", "Baltic Sea"),
    "Gulf of Finland": ("芬蘭灣（波羅的海）", "Gulf of Finland (Baltic)"),
    "Gulf of Bothnia": ("波的尼亞灣（波羅的海）", "Gulf of Bothnia (Baltic)"),
    "White Sea": ("白海", "White Sea"),
    "East Siberian Sea": ("東西伯利亞海", "East Siberian Sea"),
    "South Atlantic Ocean": None,
    "Southern Ocean": None,
    "Gulf of Tomini": ("托米尼灣", "Gulf of Tomini"),
    "Makassar Strait": ("望加錫海峽", "Makassar Strait"),
    "Halmahera Sea": ("哈馬黑拉海", "Halmahera Sea"),
    "Molukka Sea": ("摩鹿加海", "Molucca Sea"),
    "Indian Ocean": None,
    "Bay of Bengal": ("孟加拉灣", "Bay of Bengal"),
    "South China Sea": ("南海", "South China Sea"),
    "Arabian Sea": ("阿拉伯海", "Arabian Sea"),
    "North Pacific Ocean": None,
    "The Coastal Waters of Southeast Alaska and British Columbia": ("阿拉斯加東南與英屬哥倫比亞的沿岸海域", "Coastal waters of SE Alaska and BC"),
    "Gulf of Mexico": ("墨西哥灣", "Gulf of Mexico"),
    "North Atlantic Ocean": None,
    "Gulf of St. Lawrence": ("聖羅倫斯灣", "Gulf of St. Lawrence"),
    "Balearic (Iberian Sea)": ("巴利亞利海（地中海）", "Balearic Sea (Mediterranean)"),
    "Bay of Biscay": ("比斯開灣", "Bay of Biscay"),
    "Celtic Sea": ("凱爾特海", "Celtic Sea"),
    "Mediterranean Sea - Western Basin": ("地中海", "Mediterranean Sea"),
    "Hudson Bay": ("哈德遜灣", "Hudson Bay"),
    "The Northwestern Passages": ("西北航道", "Northwest Passages"),
    "Arctic Ocean": None,
    "English Channel": ("英吉利海峽", "English Channel"),
    "Barentsz Sea": ("巴倫支海", "Barents Sea"),
    "Greenland Sea": ("格陵蘭海", "Greenland Sea"),
    "North Sea": ("北海", "North Sea"),
    "Andaman or Burma Sea": ("安達曼海", "Andaman Sea"),
    "Black Sea": ("黑海", "Black Sea"),
    "Sea of Azov": ("亞速海", "Sea of Azov"),
    "Japan Sea": ("日本海", "Sea of Japan"),
    "Sea of Okhotsk": ("鄂霍次克海", "Sea of Okhotsk"),
    "Kara Sea": ("喀拉海", "Kara Sea"),
    "Laptev Sea": ("拉普帖夫海", "Laptev Sea"),
    "Kattegat": ("卡特加特海峽", "Kattegat"),
    "Laccadive Sea": ("拉克代夫海", "Laccadive Sea"),
    "Skagerrak": ("斯卡格拉克海峽", "Skagerrak"),
    "Norwegian Sea": ("挪威海", "Norwegian Sea"),
    "Ligurian Sea": ("利古里亞海（地中海）", "Ligurian Sea (Mediterranean)"),
    "Gulf of Guinea": ("幾內亞灣", "Gulf of Guinea"),
    "South Pacific Ocean": None,
}

# ── 地圖上的線 ───────────────────────────────────────────────
# 河道的大小：平均流量（m³/s）與集水面積（km²）÷ 1,000 取大的，乾燥地區流量小但流域大的河（澳洲的庫珀溪、
# 撒哈拉的乾河）也排得上；地圖依它決定縮放到幾級才畫（前端 minValue）
BASE_MIN = 40  # 主檔（地球儀一打開就下載）：流量 40 m³/s 或集水面積 4 萬 km² 以上
DETAIL_MIN = 8  # 分區：流量 8 m³/s 或集水面積 8,000 km² 以上（台灣的主要河川大部分的河段都有）
BASE_TOLERANCE, BASE_QUANTUM = 0.015, 0.01  # Douglas–Peucker 容許誤差與量化（度），約 1.7 km、1.1 km
DETAIL_TOLERANCE, DETAIL_QUANTUM = 0.006, 0.005  # 約 650 m、550 m
TILE = 10  # 分區的大小（度）
CHAIN_RATIO = 2.5  # 接成一條線時，流量比這一條的起點多這麼多倍就斷開（線寬依每一條的出口流量）

# ── 名稱 ──────────────────────────────────────────────────────
NE_FILES = [
    # (檔名, 優先順序)：主檔的河流比較重要，區域補充檔（歐洲、北美、澳洲）有更多小河
    ("ne_10m_rivers_lake_centerlines_scale_rank", 0),
    ("ne_10m_rivers_europe", 1),
    ("ne_10m_rivers_north_america", 1),
    ("ne_10m_rivers_australia", 1),
]
NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/{}.geojson"
SAMPLE = 0.02  # 沿 Natural Earth 的線每 0.02° 取一點
JUMP = 1.4  # 主流的路徑上集水面積一下子多 40% 以上：有一條不小的河匯入（_stem() 在這裡截掉零星的票）
NEAR_MOUTH = 0.95  # 水系的名稱：流到集水面積達出口九成五的主流
MATCH_KM = 9.0  # 取的點離河道多遠以內才算對到

# 台灣的主要河川（Natural Earth 沒有台灣的河）：(中文, 英文, Wikidata, 河口經度, 緯度, 流域面積 km²，水利署或 Wikidata)。
# 依河口位置（0.2° 內）與流域面積（HydroRIVERS 的出口集水面積在 0.6–1.6 倍之間、最接近的）對到出口；
# 支流（TAIWAN_TRIBUTARIES）依匯流處對到那一段，往上游沿集水面積最大的那一支命名到源頭。
TAIWAN = [
    ("濁水溪", "Zhuoshui River", "Q708374", 120.254, 23.840, 3155),
    ("高屏溪", "Gaoping River", "Q57256", 120.415, 22.480, 3257),
    ("淡水河", "Tamsui River", "Q2420747", 121.421, 25.173, 2726),
    ("烏溪", "Wu River", "Q5208125", 120.463, 24.203, 2026),
    ("秀姑巒溪", "Xiuguluan River", "Q708591", 121.501, 23.462, 1790),
    ("卑南溪", "Beinan River", "Q699259", 121.176, 22.766, 1603),
    ("花蓮溪", "Hualien River", "Q707891", 121.609, 23.943, 1507),
    ("大甲溪", "Dajia River", "Q714246", 120.551, 24.333, 1236),
    ("曾文溪", "Zengwen River", "Q697324", 120.067, 23.050, 1177),
    ("蘭陽溪", "Lanyang River", "Q708461", 121.833, 24.711, 978),
    ("大安溪", "Da'an River", "Q278671", 120.596, 24.408, 758),
    ("北港溪", "Beigang River", "Q475758", 120.150, 23.527, 645),
    ("立霧溪", "Liwu River", "Q11598263", 121.660, 24.139, 616),
    ("頭前溪", "Touqian River", None, 120.930, 24.850, 566),
    ("和平溪", "Heping River", "Q10921471", 121.760, 24.330, 562),
    ("後龍溪", "Houlong River", "Q11070260", 120.753, 24.615, 537),
    ("八掌溪", "Bazhang River", "Q699075", 120.117, 23.328, 475),
    ("東港溪", "Donggang River", None, 120.440, 22.470, 472),
    ("中港溪", "Zhonggang River", "Q10875824", 120.831, 24.669, 446),
    ("朴子溪", "Puzi River", "Q11094995", 120.157, 23.455, 427),
    ("急水溪", "Jishui River", None, 120.110, 23.290, 379),
    ("二仁溪", "Erren River", None, 120.180, 22.910, 350),
    ("林邊溪", "Linbian River", None, 120.520, 22.430, 344),
    ("鳳山溪", "Fengshan River", "Q5465035", 120.930, 24.853, 250),
    ("鹽水溪", "Yanshui River", None, 120.150, 23.000, 222),
    ("太麻里溪", "Taimali River", None, 121.000, 22.580, 214),
    ("南澳溪", "Nan'ao River", None, 121.810, 24.444, 300),
]
TAIWAN_TRIBUTARIES = [
    ("大漢溪", "Dahan River", "Q199374", 121.480, 25.040, 1163),
    ("新店溪", "Xindian River", "Q199378", 121.484, 25.037, 921),
    ("基隆河", "Keelung River", "Q708976", 121.464, 25.112, 493),
    ("貓羅溪", "Maoluo River", "Q3845177", 120.628, 24.060, 377),
    ("北勢溪", "Beishi River", "Q3637532", 121.557, 24.905, 310),
]

# 前 60 大的河流系統逐一看過名稱（DESIGN.md 第 8 節第 86 點）；這裡改正系統的名稱：出口一帶只有分流、汊道有名稱的
# （尼羅河的羅塞塔支流、多瑙河的基利亞分流、勒拿河的比科夫斯卡亞水道），兩條大河共用出口的（恆河與布拉馬普特拉河、珠江的西江）。
# {出口的大約位置 (經度, 緯度): (中文, 英文)}，0.5° 內集水面積最大的出口
SYSTEM_NAMES: dict[tuple[float, float], tuple[str, str]] = {
    (30.39, 31.44): ("尼羅河", "Nile"),
    (29.70, 45.25): ("多瑙河", "Danube"),
    (90.63, 23.22): ("恆河—布拉馬普特拉河", "Ganges–Brahmaputra"),
    (113.26, 22.40): ("珠江", "Pearl River"),
    (128.56, 72.00): ("勒拿河", "Lena"),
}
# Wikidata 的台灣標籤不是台灣慣用譯名的（大河才改）；Natural Earth 的英文名稱截斷的
ZH_FIXES = {
    "亞馬孫河": "亞馬遜河",
    "贊比西河": "尚比西河",
    "墨累河": "墨瑞河",
    "馬更些河": "麥肯錫河",
    "第聶伯河": "聶伯河",
}
EN_FIXES = {"Syr Dar": "Syr Darya"}


def build() -> None:
    a = hr.attributes()
    first, last = hr.ends()
    n = len(a["HYRIV_ID"])
    ids = a["HYRIV_ID"]
    down = np.where(a["NEXT_DOWN"] == 0, -1, np.searchsorted(ids, a["NEXT_DOWN"]))
    up, dis, length = a["UPLAND_SKM"], a["DIS_AV_CMS"], a["LENGTH_KM"]

    # ── 河流系統：依出口的集水面積由大到小編號（側欄與滑過時的組別都用這個編號） ──
    outlets = np.nonzero(down < 0)[0]
    outlets = outlets[np.argsort(-up[outlets], kind="stable")]
    system_of_outlet = np.full(n, -1, np.int64)
    system_of_outlet[outlets] = np.arange(len(outlets))
    system = system_of_outlet[np.searchsorted(ids, a["MAIN_RIV"])]
    if (system < 0).any():
        raise ValueError("有河道的 MAIN_RIV 不是出口")
    print(f"  {n:,} 段河道、{len(outlets):,} 個河流系統（內流 {int((a['ENDORHEIC'][outlets] == 1).sum()):,}）")

    sea, ocean = classify_outlets(a, last, outlets)
    reach_class = ocean[system]

    # ── 各國 ──
    iso = np.array(geoindex.countries_at(last[:, 0], last[:, 1]), dtype=object)
    country_stats = countries(a, iso, reach_class, system)

    # ── 名稱 ──
    names = name_reaches(a, first, last, down, system, outlets)
    sys_names = system_names(names, up, length, system, outlets)
    apply_system_names(sys_names, outlets, last, up)

    # ── 地圖上的線 ──
    score = np.maximum(dis, up / 1000)
    base = downstream_closure(score >= BASE_MIN, down)
    detail = downstream_closure(score >= DETAIL_MIN, down) & ~base
    systems_meta = system_meta(a, first, last, system, outlets, sea, ocean, sys_names)
    geom = hr.Geometry()
    base_chains = chains(base, down, dis)
    detail_chains = chains(detail, down, dis)
    print(f"  主檔 {int(base.sum()):,} 段河道接成 {len(base_chains):,} 條線，分區 {int(detail.sum()):,} 段接成 {len(detail_chains):,} 條")
    OUT.mkdir(parents=True, exist_ok=True)
    tiles = write_detail(detail_chains, geom, a, system, ocean, names, systems_meta, score)
    write_lines(OUT / "rivers.json", base_chains, geom, a, system, ocean, names, systems_meta, score,
                BASE_TOLERANCE, BASE_QUANTUM, detail={"file": "detail/{tile}.json", "tiles": tiles})

    write_indicators(country_stats)
    write_panel(country_stats, systems_meta)
    write_notice()
    write_json(OUT / "manifest.json", {
        "topic": "rivers",
        "generatedAt": now_iso(),
        "source": "HydroRIVERS v1.0 (Lehner & Grill 2013; HydroSHEDS v1, © WWF 2006-2022, used under license); "
        "Marine Regions IHO Sea Areas v3 and Global Oceans and Seas v1 (CC BY 4.0); Natural Earth (public domain); "
        "Wikidata (CC0)",
        "license": "HydroSHEDS v1 License Agreement (see HYDROSHEDS-NOTICE.txt)",
    })
    spot_checks(country_stats, systems_meta)


# ── 流進哪一個大洋 ───────────────────────────────────────────


def ocean_of_seas() -> dict[str, int]:
    """每個 IHO 海域屬於哪一個大洋：大部分面積落在 GOaS 的哪一章（南海與群島那一章依 ARCHIPELAGIC）"""
    chapters = sea_areas.chapter_of_areas()
    missing = set(SEAS) ^ set(chapters)
    if missing:
        raise ValueError(f"IHO 海域跟 SEAS 對不上：{sorted(missing)}")
    out = {}
    print("  IHO 海域 → GOaS 的章（占比）→ 大洋：")
    for name, (chapter, share) in sorted(chapters.items(), key=lambda kv: kv[1][0]):
        o = GOAS_OCEAN[chapter]
        if o is None:
            o = ARCHIPELAGIC.get(name, ARCHIPELAGIC_DEFAULT)
        elif name in ARCHIPELAGIC:
            raise ValueError(f"{name} 在 GOaS 是 {chapter}，不是群島那一章，ARCHIPELAGIC 不該列它")
        out[name] = o
        print(f"    {name}：{chapter}（{share:.0%}）→ {CLASS_ZH[o]}")
    return out


def classify_outlets(a, last, outlets):
    """每個出口流進的 IHO 海域（索引，-1 是內流）與每個系統的類別（依系統編號）"""
    iho, iho_names, _goas, _goas_names = sea_areas.rasters()
    to_ocean = ocean_of_seas()
    flagged = a["ENDORHEIC"][outlets] == 1
    label, dist = sea_areas.nearest_sea(iho, last[outlets, 0], last[outlets, 1])
    inland = (~flagged) & (dist > INLAND_KM)
    endo = flagged | inland
    sea = np.where(endo, -1, label - 1)
    ocean = np.array([ENDORHEIC if e else to_ocean[iho_names[s]] for e, s in zip(endo, sea)], dtype=np.int8)
    up = a["UPLAND_SKM"][outlets]
    coastal = ~endo
    print(
        f"  河口到最近的海：中位數 {np.median(dist[coastal]):.1f} km，10–{INLAND_KM} km 的 {int((coastal & (dist > 10)).sum())} 個"
        f"（集水面積合計 {up[coastal & (dist > 10)].sum():,.0f} km²，最遠 {dist[coastal].max():.0f} km）"
    )
    print(
        f"  ENDORHEIC 是 0、離海超過 {INLAND_KM} km、改算內流區的出口 {int(inland.sum()):,} 個，集水面積 {up[inland].sum():,.0f} km²："
        + "、".join(f"({last[outlets[k], 0]:.2f}, {last[outlets[k], 1]:.2f}) {up[k]:,.0f} km²" for k in np.nonzero(inland)[0][np.argsort(-up[inland])][:6])
    )
    totals = Counter()
    for o, c in zip(outlets, ocean):
        totals[int(c)] += a["UPLAND_SKM"][o]
    print("  各類的集水面積：" + "、".join(f"{CLASS_ZH[c]} {v / 1e6:.1f} 百萬 km²" for c, v in sorted(totals.items())))
    if SOUTHERN in totals:
        print("  有河流系統流進南冰洋")
    return sea, ocean


# ── 各國 ───────────────────────────────────────────────────────


def countries(a, iso, reach_class, system):
    """各國：各類的面積、河道長度、各河流系統在國內的面積"""
    codes = sorted({c for c in set(iso.tolist()) if c})
    idx = {c: i for i, c in enumerate(codes)}
    ci = np.array([idx.get(c, -1) for c in iso], dtype=np.int64)
    ok = ci >= 0
    catch = a["CATCH_SKM"].astype(np.float64)
    area = np.zeros((len(codes), 7))
    np.add.at(area, (ci[ok], reach_class[ok].astype(np.int64)), catch[ok])
    river_km = np.bincount(ci[ok], weights=a["LENGTH_KM"][ok].astype(np.float64), minlength=len(codes))
    # 各系統在各國的面積
    key = ci[ok] * (int(system.max()) + 1) + system[ok]
    keys, inverse = np.unique(key, return_inverse=True)
    sums = np.bincount(inverse, weights=catch[ok])
    by_country: dict[str, list[tuple[int, float]]] = defaultdict(list)
    nsys = int(system.max()) + 1
    for k, s in zip(keys, sums):
        by_country[codes[k // nsys]].append((int(k % nsys), float(s)))
    unassigned = catch[~ok].sum()
    print(f"  找不到國家的河道：{int((~ok).sum()):,} 段，集水面積 {unassigned:,.0f} km²（{unassigned / catch.sum():.2%}）")
    return {
        "codes": codes,
        "area": {c: area[i] for c, i in idx.items()},
        "km": {c: float(river_km[i]) for c, i in idx.items()},
        "systems": {c: sorted(v, key=lambda t: -t[1]) for c, v in by_country.items()},
    }


# ── 名稱 ───────────────────────────────────────────────────────


def _ne_features() -> list[tuple[dict, list[np.ndarray], int]]:
    out = []
    for name, priority in NE_FILES:
        path = download(NE_URL.format(name), "natural-earth", f"{name}-5.1.2.geojson")
        with open(path, encoding="utf-8") as f:
            for feat in json.load(f)["features"]:
                p = feat["properties"]
                if not p.get("name") or "Lake" in str(p.get("featurecla") or "") or "Canal" in str(p.get("featurecla") or ""):
                    continue
                g = feat["geometry"]
                parts = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
                out.append((p, [np.asarray(part, float)[:, :2] for part in parts if len(part) >= 2], priority))
    return out


def _densify(line: np.ndarray, step: float) -> np.ndarray:
    seg = np.diff(line, axis=0)
    lengths = np.hypot(seg[:, 0], seg[:, 1])
    pts = [line[:1]]
    for p, s, L in zip(line[:-1], seg, lengths):
        k = max(1, int(math.ceil(L / step)))
        t = (np.arange(1, k + 1) / k)[:, None]
        pts.append(p + s * t)
    return np.concatenate(pts)


def _xyz(lon, lat):
    lon, lat = np.radians(lon), np.radians(lat)
    return np.stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)], axis=1)


def name_reaches(a, first, last, down, system, outlets):
    """每段河道的名稱：{河道索引: (中文, 英文, 優先順序)}；Natural Earth 對到的主流，加上台灣的主要河川"""
    from scipy.spatial import cKDTree

    up, dis = a["UPLAND_SKM"], a["DIS_AV_CMS"]
    score = np.maximum(dis, up / 1000)
    cand = np.nonzero(score >= DETAIL_MIN)[0]
    geom = hr.Geometry()
    pts, owner = [], []
    for r in cand:
        line = geom.line(int(r))
        pts.append(line)
        owner.append(np.full(len(line), r))
    pts = np.concatenate(pts)
    owner = np.concatenate(owner)
    tree = cKDTree(_xyz(pts[:, 0], pts[:, 1]))
    print(f"  名稱：候選河道 {len(cand):,} 段（{len(pts):,} 個點）")

    feats = _ne_features()
    # 同一條河在 Natural Earth 常切成好幾段（同一個 rivernum 或同名）：合在一起投票
    groups: dict[tuple, list] = defaultdict(list)
    for p, parts, priority in feats:
        key = (priority, p.get("rivernum"), p.get("name_en") or p.get("name"))
        groups[key].append((p, parts))
    qids = sorted({p["wikidataid"] for p, _parts, _pr in feats if p.get("wikidataid")}, key=lambda q: int(q[1:]))
    labels = {q: wd.names(e) for q, e in wd.entities(qids, "ne-rivers", props="labels").items()}

    names: dict[int, tuple[str | None, str, tuple]] = {}
    dist_dn = a["DIST_DN_KM"]
    matched = 0
    for (priority, _rivernum, en), members in groups.items():
        p0 = members[0][0]
        samples = np.concatenate([_densify(part, SAMPLE) for _p, parts in members for part in parts])
        d, k = tree.query(_xyz(samples[:, 0], samples[:, 1]))
        km = 2 * np.arcsin(np.clip(d / 2, 0, 1)) * 6371.0
        hit = owner[k[km <= MATCH_KM]]
        if len(hit) < 3:
            continue
        votes = Counter(hit.tolist())
        stem = _stem(votes, down, up, dist_dn)
        if not stem:
            continue
        matched += 1
        qid = next((p.get("wikidataid") for p, _parts in members if p.get("wikidataid")), None)
        zh = (labels.get(qid) or (None, None))[0] if qid else None
        zh = zh or p0.get("name_zht") or None
        # Wikidata 的標籤有時帶消歧義的括號（「喬丹河 (猶他州)」）
        zh = re.sub(r"\s*[（(][^（()）]*[)）]\s*$", "", zh) if zh else None
        zh = ZH_FIXES.get(zh, zh) if zh else None
        en_name = p0.get("name_en") or p0.get("name")
        en_name = EN_FIXES.get(en_name, en_name)
        rank = (priority, p0.get("scalerank") if p0.get("scalerank") is not None else 99, -len(stem))
        for r in stem:
            if r not in names or rank < names[r][2]:
                names[r] = (zh, en_name, rank)
    print(f"  Natural Earth：{len(groups):,} 條河，對到 {matched:,} 條，命名 {len(names):,} 段河道")

    # 台灣：系統依河口，支流依匯流處；從那一段往上游沿集水面積最大的那一支命名到源頭
    upstream = defaultdict(list)
    for r in np.nonzero(down >= 0)[0]:
        upstream[int(down[r])].append(int(r))
    tw_rank = (-1, -1, 0)
    for zh, en, _qid, lon, lat, area in TAIWAN:
        o = _match_outlet(outlets, last, up, lon, lat, area)
        for r in _main_stem(o, upstream, up):
            names[r] = (zh, en, tw_rank)
    for zh, en, _qid, lon, lat, area in TAIWAN_TRIBUTARIES:
        near = np.nonzero((np.abs(last[:, 0] - lon) < 0.05) & (np.abs(last[:, 1] - lat) < 0.05))[0]
        near = near[(up[near] > 0.6 * area) & (up[near] < 1.6 * area)]
        if not len(near):
            raise ValueError(f"台灣的支流 {zh} 在 ({lon}, {lat}) 附近對不到集水面積相近的河道")
        r0 = int(near[np.argmin(np.hypot(last[near, 0] - lon, last[near, 1] - lat) + np.abs(np.log(up[near] / area)) * 0.02)])
        for r in _main_stem(r0, upstream, up):
            names[r] = (zh, en, tw_rank)
    return names


def _match_outlet(outlets, last, up, lon, lat, area) -> int:
    near = outlets[(np.abs(last[outlets, 0] - lon) < 0.2) & (np.abs(last[outlets, 1] - lat) < 0.2)]
    near = near[(up[near] > 0.6 * area) & (up[near] < 1.6 * area)]
    if not len(near):
        raise ValueError(f"({lon}, {lat}) 附近沒有集水面積接近 {area} km² 的出口")
    return int(near[np.argmin(np.abs(np.log(up[near] / area)) + np.hypot(last[near, 0] - lon, last[near, 1] - lat))])


def _main_stem(r: int, upstream, up) -> list[int]:
    out = [r]
    while upstream.get(r):
        r = max(upstream[r], key=lambda x: up[x])
        out.append(r)
    return out


def _path(r: int, down, limit: int = 20000) -> list[int]:
    out = [r]
    while down[r] >= 0 and len(out) < limit:
        r = int(down[r])
        out.append(r)
    return out


def _stem(votes: Counter, down, up, dist_dn) -> list[int]:
    """一條 Natural Earth 的河對到的主流：從最上游、路徑上票數最多的那一段，往下到最下游有票的那一段。
    支流的取樣點在匯流處常會對到大河的河道：路徑在某處集水面積多 40% 以上（有不小的河匯入）、之後的票數不到 4 票時，
    在匯流處截斷，大河不會被冠上支流的名字。"""
    total = sum(votes.values())
    best: list[int] = []
    best_cover = 0
    for r in sorted(votes, key=lambda x: -dist_dn[x])[:6]:
        path = _path(r, down)
        cover = sum(votes.get(x, 0) for x in path)
        if cover > best_cover:
            best, best_cover = path, cover
    if best_cover < 0.5 * total:
        return []
    voted = [i for i, x in enumerate(best) if x in votes]
    end = voted[-1]
    # 截掉匯流處以下的零星票
    while True:
        jumps = [i for i in range(1, end + 1) if up[best[i]] > JUMP * up[best[i - 1]]]
        if not jumps:
            break
        j = jumps[-1]
        below = sum(votes.get(x, 0) for x in best[j : end + 1])
        if below >= 4:
            break
        prior = [i for i in voted if i < j]
        if not prior:
            break
        end = prior[-1]
    return best[voted[0] : end + 1]


def system_names(names, up, length, system, outlets) -> dict[int, tuple[str | None, str]]:
    """河流系統的名稱：流到出口附近（集水面積達出口的九成）的主流裡最長的那一條——三角洲上的分流、汊道
    （萊茵河的萊克河、尼羅河的羅塞塔支流）比幹流短，不會蓋掉幹流（九成五：NEAR_MOUTH）；沒有的話，系統裡有名稱、集水面積最大的那一條
    （至少是出口的一半）。"""
    stems: dict[int, dict[tuple, list[float]]] = defaultdict(dict)
    for r, (zh, en, _rank) in names.items():
        s = int(system[r])
        stat = stems[s].setdefault((zh, en), [0.0, 0.0])
        stat[0] = max(stat[0], float(up[r]))
        stat[1] += float(length[r])
    out = {}
    for s, by_name in stems.items():
        outlet_up = float(up[outlets[s]])
        near_mouth = [(km, name) for name, (u, km) in by_name.items() if u >= NEAR_MOUTH * outlet_up]
        if near_mouth:
            out[s] = max(near_mouth)[1]
            continue
        u, name = max((u, name) for name, (u, _km) in by_name.items())
        if u >= 0.5 * outlet_up:
            out[s] = name
    return out


def apply_system_names(sys_names, outlets, last, up) -> None:
    """SYSTEM_NAMES 的改正：位置 0.5° 內集水面積最大的出口"""
    for (lon, lat), (zh, en) in SYSTEM_NAMES.items():
        near = np.nonzero((np.abs(last[outlets, 0] - lon) < 0.5) & (np.abs(last[outlets, 1] - lat) < 0.5))[0]
        if not len(near):
            raise ValueError(f"SYSTEM_NAMES 的 ({lon}, {lat}) 附近沒有出口")
        sys_names[int(near[np.argmax(up[outlets[near]])])] = (zh, en)


# ── 線 ─────────────────────────────────────────────────────────


def downstream_closure(mask: np.ndarray, down: np.ndarray) -> np.ndarray:
    """被挑中的河道一路往下游到出口都挑（流量在乾燥地區會往下游變少，不補的話線會斷掉）"""
    mask = mask.copy()
    cur = np.nonzero(mask)[0]
    while len(cur):
        d = down[cur]
        d = d[d >= 0]
        new = np.unique(d[~mask[d]])
        mask[new] = True
        cur = new
    return mask


def chains(mask: np.ndarray, down: np.ndarray, dis: np.ndarray) -> list[list[int]]:
    """相鄰的河道接成一條線：下游那一段只有這一條被挑中的上游時接起來；流量變多 CHAIN_RATIO 倍以上就斷開"""
    sel = np.nonzero(mask)[0]
    nup = np.zeros(len(mask), np.int32)
    d = down[sel]
    np.add.at(nup, d[(d >= 0)], 1)
    out = []
    for s0 in sel[nup[sel] != 1]:
        chain, base, r = [int(s0)], dis[s0], int(s0)
        while True:
            d = int(down[r])
            if d < 0 or not mask[d] or nup[d] != 1:
                break
            if dis[d] > CHAIN_RATIO * max(base, 0.1):
                out.append(chain)
                chain, base = [d], dis[d]
            else:
                chain.append(d)
            r = d
        out.append(chain)
    return out


def _dp(pts: np.ndarray, tol: float) -> np.ndarray:
    """Douglas–Peucker（迭代版）"""
    n = len(pts)
    if n < 3:
        return pts
    keep = np.zeros(n, bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i, j = stack.pop()
        if j - i < 2:
            continue
        p0, p1 = pts[i], pts[j]
        seg = pts[i + 1 : j]
        dx, dy = p1 - p0
        norm = math.hypot(dx, dy)
        if norm == 0:
            dd = np.hypot(seg[:, 0] - p0[0], seg[:, 1] - p0[1])
        else:
            dd = np.abs(dy * (seg[:, 0] - p0[0]) - dx * (seg[:, 1] - p0[1])) / norm
        k = int(np.argmax(dd))
        if dd[k] > tol:
            k += i + 1
            keep[k] = True
            stack += [(i, k), (k, j)]
    return pts[keep]


def _chain_points(chain: list[int], geom: hr.Geometry) -> np.ndarray:
    parts = [geom.line(r) if k == 0 else geom.line(r)[1:] for k, r in enumerate(chain)]
    pts = np.concatenate(parts)
    # 跨 180° 經線的河（楚科奇的河道）經度展開成連續的
    x = pts[:, 0].copy()
    jump = np.diff(x)
    if np.abs(jump).max(initial=0) > 180:
        x[1:] -= 360 * np.cumsum(np.round(jump / 360))
        pts = np.stack([x, pts[:, 1]], axis=1)
    return pts


def _chain_record(chain, a, system, names, score) -> dict:
    """一條線的紀錄：系統編號、出口端的流量與集水面積、大小（決定幾級才畫）、名稱（依長度多數決）"""
    r = chain[-1]
    named = Counter()
    for x in chain:
        if x in names:
            named[(names[x][0], names[x][1])] += float(a["LENGTH_KM"][x])
    total = float(sum(a["LENGTH_KM"][x] for x in chain))
    name = named.most_common(1)[0][0] if named and named.most_common(1)[0][1] >= 0.5 * total else (None, None)
    return {
        "g": int(system[r]),
        "d": float(a["DIS_AV_CMS"][r]),
        "u": float(a["UPLAND_SKM"][r]),
        "z": level(float(score[r])),
        "n": name[0],
        "m": name[1],
    }


# 線的級別（前端 minValue 的欄位 z）：大小（流量或集水面積 ÷ 1,000 取大的）過了幾個門檻，越大越早畫
LEVELS = (8, 12, 20, 30, 60, 120)


def level(s: float) -> int:
    return sum(1 for t in LEVELS if s >= t)


# 紀錄依流量由小到大排（大河疊在上面），流量存差分（排序過，差分很小）；集水面積存到 10 km²
RECORD_FIELDS = ["g", "d", "u", "z", "n", "m"]
RECORD_SCALE = {"g": 1, "d": 0.1, "u": 10, "z": 1}
RECORD_DELTA = ["d"]
GROUP_FIELDS = ["g", "o", "sz", "se", "oz", "oe", "A", "Q", "L"]
GROUP_SCALE = {"g": 1, "o": 1, "A": 1, "Q": 0.1, "L": 1}


def _groups(systems_meta, used: set[int]) -> dict:
    rows = []
    for g in sorted(used):
        m = systems_meta[g]
        rows.append({
            "g": g, "o": m["ocean"], "sz": m["zh"], "se": m["en"], "oz": m["seaZh"], "oe": m["seaEn"],
            "A": m["A"], "Q": m["Q"], "L": m["L"],
        })
    return points_file(rows, GROUP_FIELDS, GROUP_SCALE, strings=["sz", "se", "oz", "oe"])


def write_lines(path, chain_list, geom, a, system, ocean, names, systems_meta, score, tol, quantum, detail=None):
    # 小河先畫、大河後畫（大河疊在上面）
    order = sorted(range(len(chain_list)), key=lambda i: a["DIS_AV_CMS"][chain_list[i][-1]])
    lines, types, records = [], [], []
    for i in order:
        chain = chain_list[i]
        pts = _dp(_chain_points(chain, geom), tol)
        lines.append([(float(x), float(y)) for x, y in pts])
        rec = _chain_record(chain, a, system, names, score)
        types.append(int(ocean[rec["g"]]))
        records.append(rec)
    used = {r["g"] for r in records}
    data = lines_file(
        lines, quantum, types,
        records=records, record_fields=RECORD_FIELDS, record_scale=RECORD_SCALE, record_delta=RECORD_DELTA,
        record_strings=["n", "m"],
        groups=("g", _groups(systems_meta, used)),
    )
    if detail is not None:
        data["detail"] = detail
    write_json(path, data, quiet=detail is None)
    return lines


def write_detail(chain_list, geom, a, system, ocean, names, systems_meta, score):
    """分區：依每條線中間那一點分到 TILE° 的格子，每格一個檔；回傳 [id, 西, 南, 東, 北]"""
    by_tile: dict[str, list[list[int]]] = defaultdict(list)
    for chain in chain_list:
        mid = chain[len(chain) // 2]
        x, y = geom.line(mid)[0]
        by_tile[f"{int((x + 180) // TILE)}_{int((y + 90) // TILE)}"].append(chain)
    tiles = []
    folder = OUT / "detail"
    if folder.exists():
        for old in folder.glob("*.json"):
            old.unlink()
    total = 0
    for tile_id in sorted(by_tile):
        lines = write_lines(folder / f"{tile_id}.json", by_tile[tile_id], geom, a, system, ocean, names, systems_meta, score,
                            DETAIL_TOLERANCE, DETAIL_QUANTUM)
        xs = [x for line in lines for x, _y in line]
        ys = [y for line in lines for _x, y in line]
        tiles.append([tile_id, round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2)])
        total += (folder / f"{tile_id}.json").stat().st_size
    print(f"  分區 {len(tiles)} 個檔，共 {total / 1e6:.2f} MB")
    return tiles


def _flow(q: float) -> float:
    """河口的流量：10 m³/s 以上取整數，以下留一位小數"""
    return round(q) if q >= 10 else round(q, 1)


def system_meta(a, first, last, system, outlets, sea, ocean, sys_names):
    """每個系統：名稱、流進的海、集水面積、河口的流量、最長的河道長度（從最遠的源頭到河口）、範圍。
    集水面積是系統裡每段河道自己的集水面積（CATCH_SKM）加總，跟各國的面積同一種算法（國內的不會比全流域大）；
    出口的 UPLAND_SKM 是另一種算法，小的系統兩者差幾個百分點"""
    iho_names = sea_areas.rasters()[1]
    ns = len(outlets)
    catch = np.bincount(system, weights=a["CATCH_SKM"].astype(np.float64), minlength=ns)
    lo = np.full((ns, 2), np.inf)
    hi = np.full((ns, 2), -np.inf)
    for pts in (first, last):
        np.minimum.at(lo, system, pts)
        np.maximum.at(hi, system, pts)
    out = []
    (strait, (x0, y0), (x1, y1)) = TAIWAN_STRAIT
    for s, o in enumerate(outlets):
        sea_name = SEAS.get(iho_names[sea[s]]) if sea[s] >= 0 else None
        if sea[s] >= 0 and iho_names[sea[s]] == "South China Sea":
            x, y = last[o]
            if x > x0 and y > y0 + (y1 - y0) * (x - x0) / (x1 - x0):
                sea_name = strait
        zh, en = sys_names.get(s, (None, None))
        out.append({
            "zh": zh, "en": en,
            "seaZh": sea_name[0] if sea_name else None, "seaEn": sea_name[1] if sea_name else None,
            "ocean": int(ocean[s]),
            "A": round(float(catch[s])),
            "Q": _flow(float(a["DIS_AV_CMS"][o])),
            "L": round(float(a["DIST_UP_KM"][o])),
            "box": [round(float(lo[s, 0]), 2), round(float(lo[s, 1]), 2), round(float(hi[s, 0]), 2), round(float(hi[s, 1]), 2)],
        })
    return out


# ── 輸出 ───────────────────────────────────────────────────────


OCEAN_CLASSES = (PACIFIC, ATLANTIC, INDIAN, ARCTIC, SOUTHERN)
MIN_COVERED_KM2 = 1.0  # 河道的集水面積合計不到這麼大的地方不算（找不到河的小島）


def shares(stats) -> dict[str, dict[int, float]]:
    """各國的國土流向各類的比例（%，分母是有河道經過的面積）"""
    out = {}
    for c in stats["codes"]:
        area = stats["area"][c]
        total = float(area[1:].sum())
        if total >= MIN_COVERED_KM2:
            out[c] = {k: float(area[k] / total * 100) for k in (*OCEAN_CLASSES, ENDORHEIC)}
    return out


def _breakdown(share: dict[int, float], zh: bool) -> str:
    """tooltip 的第三行：「大西洋 62%、北冰洋 27%、太平洋 11%」（1% 以上的，由大到小）"""
    parts = [(k, v) for k, v in sorted(share.items(), key=lambda kv: -kv[1]) if v >= 1 or (v > 0 and len(share) == 1)]
    names = CLASS_ZH if zh else CLASS_EN
    text = ("、" if zh else ", ").join(f"{names[k]} {v:.0f}%" if v >= 1 else f"{names[k]} <1%" for k, v in parts)
    return text


def write_indicators(stats) -> None:
    sh = shares(stats)
    land = land_areas()
    keep = sorted(sh)
    notes, notes_en = {}, {}
    for c in keep:
        covered = float(stats["area"][c][1:].sum())
        if c in land and covered < 0.8 * land[c]:
            pct = covered / land[c] * 100
            notes[c] = (
                f"HydroRIVERS 的河道（集水面積 10 km² 以上或平均流量每秒 0.1 立方公尺以上）只經過約 {pct:.0f}% 的國土"
                f"（FAOSTAT 陸地面積 {land[c]:,.0f} km²），比例以有河道經過的 {covered:,.0f} km² 計算。"
            )
            notes_en[c] = (
                f"HydroRIVERS reaches (10 km² catchment or 0.1 m³/s mean flow and above) cover only about {pct:.0f}% of the "
                f"land (FAOSTAT land area {land[c]:,.0f} km²); shares are of the {covered:,.0f} km² they drain."
            )
    hints = {c: _breakdown({k: v for k, v in sh[c].items() if v > 0}, True) for c in keep}
    hints_en = {c: _breakdown({k: v for k, v in sh[c].items() if v > 0}, False) for c in keep}
    km = {c: [round(stats["km"][c])] for c in keep}
    extra = {"notes": notes, "notesEn": notes_en}
    write_json(OUT / "length.json", indicator_file("length", "km", [YEAR], km, hints=hints, hintsEn=hints_en, **extra))
    main = {}
    for c in keep:
        k = max(sh[c], key=lambda x: sh[c][x])
        main[c] = [k]
    write_json(OUT / "main-ocean.json", indicator_file("main-ocean", "", [YEAR], main, hints=hints, hintsEn=hints_en, **extra))
    for k in (*OCEAN_CLASSES, ENDORHEIC):
        if k == SOUTHERN and not any(sh[c][k] > 0 for c in keep):
            continue
        values = {c: [round(sh[c][k], 2)] for c in keep}
        name = "endorheic" if k == ENDORHEIC else f"share/{CLASS_KEYS[k]}"
        write_json(OUT / f"{name}.json", indicator_file(name.replace("/", "-"), "%", [YEAR], values, **extra))
    print(f"  指標：{len(keep)} 個國家/地區；有附註（河道只經過不到八成的國土）的 {len(notes)} 個")


def land_areas() -> dict[str, float]:
    from topics.oceans import land_areas as fao_land

    return fao_land()


TOP_SYSTEMS = 8


def write_panel(stats, systems_meta) -> None:
    """側欄：各國的流向比例與國內面積最大的河流系統（最多 8 個），加上這些系統的資料"""
    sh = shares(stats)
    used: set[int] = set()
    countries = {}
    for c in sorted(sh):
        top = [(g, a) for g, a in stats["systems"].get(c, []) if a >= 1][:TOP_SYSTEMS]
        used.update(g for g, _a in top)
        countries[c] = {
            "km2": round(float(stats["area"][c][1:].sum())),
            "share": [round(sh[c][k], 2) for k in (PACIFIC, ATLANTIC, INDIAN, ARCTIC, ENDORHEIC, SOUTHERN)],
            "top": [[g, round(a)] for g, a in top],
            "n": sum(1 for _g, a in stats["systems"].get(c, []) if a >= 1),
        }
    systems = {}
    for g in sorted(used):
        m = systems_meta[g]
        systems[str(g)] = {k: m[k] for k in ("zh", "en", "ocean", "seaZh", "seaEn", "A", "Q", "L", "box")}
    # 側欄依國家分檔（panel_parts.py）：panel/<ISO3>.json 是那一國的統計與它的前幾大河流系統
    write_country_parts(OUT / "panel", river_parts(countries, systems))


NOTICE = f"""River data in this folder (rivers.json, detail/*.json, panel/*.json and the indicator files) are derived from
HydroRIVERS v1.0 and are provided only as part of World Data Map (https://skywitness.github.io/map/?topic=rivers).

Required attribution (HydroSHEDS v1 License Agreement, Exhibit B):
{hr.ATTRIBUTION}

Scientific citation: {hr.CITATION}

Terms for users of these derived files: they are provided "as is", without warranty of any kind; they may be used with
this map but may not be extracted and redistributed, licensed or sold as a stand-alone dataset, and may not be
decompiled or reverse engineered back into the HydroSHEDS data. For the original data and its licence see
https://www.hydrosheds.org/. Use of the World Wildlife Fund name or logos is not permitted.

Ocean classification: Marine Regions (Flanders Marine Institute) IHO Sea Areas v3 ({sea_areas.IHO_DOI}) and
Global Oceans and Seas v1 ({sea_areas.GOAS_DOI}), CC BY 4.0. River names: Natural Earth (public domain) and
Wikidata (CC0); Taiwan's rivers from the Water Resources Agency's list of central rivers.

本資料夾的河流資料（rivers.json、detail/*.json、panel/*.json 與各指標檔）是 HydroRIVERS v1.0 的衍生資料，只作為
世界資料地圖的一部分提供，不保證正確；可以搭配本地圖使用，但不得抽出來當成獨立的資料集再散布、授權或販售，也不得
還原成 HydroSHEDS 的原始資料。原始資料與授權條款見 https://www.hydrosheds.org/ 。
"""


def write_notice() -> None:
    path = OUT / "HYDROSHEDS-NOTICE.txt"
    path.write_text(NOTICE, encoding="utf-8")
    print(f"  輸出 {path.name}")


SPOT = ("TWN", "EGY", "KAZ", "MNG", "TCD", "RUS", "USA", "BRA", "AUS", "CHE", "CHN", "IND", "CAN", "TUR", "IRN", "ZAF")


def spot_checks(stats, systems_meta) -> None:
    sh = shares(stats)
    land = land_areas()
    print("  國家抽查（流向比例，分母是有河道經過的面積；覆蓋 = 有河道經過的面積 ÷ FAOSTAT 陸地面積）：")
    for c in SPOT:
        if c not in sh:
            print(f"    {c}：沒有資料")
            continue
        covered = float(stats["area"][c][1:].sum())
        cover = f"{covered / land[c]:.0%}" if c in land else "?"
        text = "、".join(f"{CLASS_ZH[k]} {v:.1f}%" for k, v in sorted(sh[c].items(), key=lambda kv: -kv[1]) if v > 0.05)
        print(f"    {c}：{text}｜覆蓋 {cover}｜河道 {stats['km'][c]:,.0f} km")
    total_land = sum(land.get(c, 0) for c in sh)
    total_cov = sum(float(stats["area"][c][1:].sum()) for c in sh)
    print(f"  全部國家：有河道經過 {total_cov / 1e6:.1f} 百萬 km²，FAOSTAT 陸地 {total_land / 1e6:.1f} 百萬 km²")
    print("  前 60 大的河流系統（集水面積）：")
    for g, m in enumerate(systems_meta[:60]):
        print(
            f"    {g:2d} {m['zh'] or '（無名）'} / {m['en'] or '-'}：{CLASS_ZH[m['ocean']]}・{m['seaZh'] or '-'}"
            f"｜{m['A']:,} km²｜{m['Q']:,} m³/s｜{m['L']:,} km"
        )
    print("  台灣的河流系統（國內面積）：")
    for g, a in stats["systems"].get("TWN", [])[:30]:
        m = systems_meta[g]
        print(f"    {m['zh'] or '（無名）'}：{a:,.0f} km²（全流域 {m['A']:,}）｜{m['Q']} m³/s｜{m['L']} km｜{m['seaZh']}")
