"""低於海平面的地方與地形區（海拔主題的擴充，2026-10-29，製作手冊第五批 65）。

使用者 2026-10-29 決定：候選 367（低於海平面）、371（地形區）合成海拔主題的擴充；地形區排除山脈（山脈另外用 GMBA），
只放沙漠、高原、盆地、平原、窪地；中文名稱改成台灣用語。

- below-sea.json：國土低於海平面的比例（%），海拔主題已經算好的高度分布（profiles.json 的第一段「0 m 以下」，
  GMTED2010 的 1 km 網格，公有領域）。
- landforms.json：Natural Earth 1:10m geography regions（公有領域）裡 FEATURECLA 是 Desert、Plateau、Basin、Plain、
  Lowland、Depression 的面（線圖層的 fill，每個環一筆紀錄 r＝編號、k＝是不是洞；名稱與種類放 groups）。
  這是製圖用的示意範圍（給標籤定位用），邊界很粗、彼此重疊。中文名稱用 NAME_ZHT（混了簡體，OpenCC 轉台灣用語），
  錯譯與中國大陸的譯名在 ZH_FIX 改掉；分類明顯不對的（旁遮普歸在沙漠）在 SKIP 拿掉。
- landform-labels.json：名稱標在哪裡（polylabel），依 SCALERANK 排序，縮小時只標大的。
"""
from __future__ import annotations

import json

from common import OUT_DIR, download, indicator_file, lines_file, points_file, write_json
from topics.elevation import YEAR

OUT = OUT_DIR / "topics" / "elevation"
URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_geography_regions_polys.geojson"
SIMPLIFY_DEG = 0.03
QUANTUM = 0.01
MIN_PART = 0.01  # 平方度
# 種類（前端 LANDFORMS 的順序）：1 沙漠、2 高原、3 盆地與窪地、4 平原與低地
CLASSES = {"Desert": 1, "Plateau": 2, "Basin": 3, "Depression": 3, "Plain": 4, "Lowland": 4}
SKIP = {"PUNJAB"}  # 旁遮普是地區，不是沙漠
# Natural Earth 的 NAME → 台灣用語的中文名稱（NAME_ZHT 錯譯、是中國大陸的譯名或沒有的）
ZH_FIX = {
    "GOBI DESERT": "戈壁沙漠", "GANGES PLAIN": "恆河平原", "PENÍNSULA IBÉRICA": "梅塞塔高原", "WESTERN PLATEAU": "澳洲西部高原",
    "Aoukâr": "奧卡爾窪地", "White Sands": "白沙沙漠", "Big Bend": "大彎", "Hamada du Drâa": "德拉岩漠",
    "Tassili oua-n-Ahaggar": "阿哈加爾塔西利", "Tassili-n-Ajjer": "阿傑爾塔西利", "Sarïr Kalanshiyu ar Ramli al Kabi": "卡蘭肖沙海",
    "Grand Erg Occidental": "西大沙海", "Grand Erg Oriental": "東大沙海", "Mu Us Desert": "毛烏素沙漠", "Negev Desert": "內蓋夫沙漠",
    "Rigestan": "雷吉斯坦沙漠", "Etosha Pan": "埃托沙鹽沼", "CASPIAN DEPRESSION": "裏海窪地", "MANCHURIAN PLAIN": "東北平原",
    "SAHEL": "薩赫爾", "PONTIC STEPPE": "黑海北岸草原", "COASTAL PLAIN": "大西洋沿岸平原", "LLANOS": "亞諾斯平原",
    "PAMPAS": "彭巴草原", "CHACO BOREAL": "北查科", "CHACO AUSTRAL": "南查科", "LES LAURENTIDES": "洛朗蒂德高地",
    "Serengeti Plains": "塞倫蓋提平原", "Masai Steppe": "馬賽草原", "Jabal Nafüsah": "奈富塞山", "Darling Downs": "達令丘陵",
    "Tihāmah": "帖哈麥平原", "Talos Dome": "塔洛斯冰穹", "Dome F (Fuji)": "富士冰穹", "PLANALTO CENTRAL": "巴西中央高原",
    "ALTIPLANO": "阿蒂普拉諾高原", "GUIANA SHIELD": "蓋亞那地盾", "Tagant": "塔甘特高原", "Fouta Djallon": "富塔賈隆高原",
    "Jabal al Abyad Plateau": "阿比亞德高原", "Atherton Tableland": "阿瑟頓高原", "N.I. Volcanic Plateau": "北島火山高原",
    "Horn Plat.": "霍恩高原", "Northern Karroo": "北卡魯", "MURRAY-DARLING BASIN": "墨瑞－達令盆地", "Kavir Desert": "卡維爾鹽漠",
    "CAATINGAS": "卡廷加", "Jabal as Sawdä’": "紹達山", "KIMBERLEY PLATEAU": "金伯利高原", "Great Karroo": "大卡魯高原",
    "Hamada de Tinrhert": "丁赫特岩漠", "DESIERTO DE ATACAMA": "阿塔卡馬沙漠", "PLANALTO DO MATO GROSSO": "馬托格羅索高原",
    "Chota Nägpur Plateau": "喬塔那格浦爾高原", "Tanami Desert": "塔納米沙漠", "NAMIB DESERT": "納米比沙漠",
    "Strzelecki Desert": "斯特澤萊茨基沙漠", "Jilf al Kabir Plateau": "吉勒夫卡比爾高原",
}


def below_sea() -> None:
    with open(OUT / "profiles.json", encoding="utf-8") as f:
        profiles = json.load(f)
    if profiles["edges"][:2] != [None, 0]:
        raise RuntimeError(f"profiles.json 的第一段不是「0 m 以下」：{profiles['edges'][:3]}")
    # 沒有低於海平面的土地的國家寫 null（前端的 missing 寫「沒有低於海平面的土地」），地圖只畫有的 52 國
    values = {c: [round(p["bands"][0], 2) or None] for c, p in profiles["countries"].items() if p.get("bands")}
    write_json(OUT / "below-sea.json", indicator_file("below-sea", "%", [YEAR], values))
    top = sorted(((v[0], c) for c, v in values.items() if v[0]), reverse=True)
    print(f"  低於海平面：{len(top)} 國有；最多 {top[:8]}；台灣 {values.get('TWN')}")


def landforms() -> None:
    from opencc import OpenCC
    from shapely.geometry import shape
    from shapely.ops import polylabel

    from topics.mountains import rings_of

    s2twp = OpenCC("s2twp")
    with open(download(URL, "natural-earth", "ne_10m_geography_regions_polys-5.1.2.geojson"), encoding="utf-8") as f:
        features = json.load(f)["features"]
    lines, types, records, groups, labels = [], [], [], [], []
    no_zh = []
    for i, feat in enumerate(features):
        pr = feat["properties"]
        kind = CLASSES.get(pr["FEATURECLA"])
        if not kind or pr["NAME"] in SKIP:
            continue
        en = pr.get("NAME_EN") or pr["NAME"].title()
        zh = ZH_FIX.get(pr["NAME"]) or (s2twp.convert(pr["NAME_ZHT"]) if pr.get("NAME_ZHT") else None)
        if not zh:
            no_zh.append(pr["NAME"])
        g = shape(feat["geometry"]).buffer(0).simplify(SIMPLIFY_DEG, preserve_topology=True)
        parts = [p for p in (g.geoms if g.geom_type == "MultiPolygon" else [g]) if p.area >= MIN_PART]
        if not parts:
            continue
        rank = int(pr["SCALERANK"])
        groups.append({"r": i, "n": en, "z": zh, "t": kind, "s": rank, "f": 1})
        for p in parts:
            for ring, hole in rings_of(p):
                lines.append(ring)
                types.append(kind)
                records.append({"r": i, "k": hole})
        big = max(parts, key=lambda p: p.area)
        pt = polylabel(big, tolerance=0.05)
        # ns＝−SCALERANK：前端的 minValue 要「越大越重要」
        labels.append({"lon": round(pt.x, 2), "lat": round(pt.y, 2), "r": i, "n": en, "z": zh, "t": kind, "s": rank, "ns": -rank})
    if no_zh:
        raise RuntimeError(f"沒有中文名稱，要補進 ZH_FIX：{no_zh}")
    data = lines_file(
        lines, QUANTUM, types, records=records,
        record_fields=["r", "k"], record_scale={"r": 1, "k": 1}, record_delta=["r"],
        groups=("r", points_file(groups, ["r", "n", "z", "t", "s", "f"], {"r": 1, "t": 1, "s": 1, "f": 1}, ("r",), ("n", "z"))),
    )
    write_json(OUT / "landforms.json", data)
    labels.sort(key=lambda p: p["s"])
    write_json(OUT / "landform-labels.json", points_file(
        labels, ["lon", "lat", "r", "n", "z", "t", "s", "ns"], {"lon": 0.01, "lat": 0.01, "r": 1, "t": 1, "s": 1, "ns": 1}, (), ("n", "z")))
    from collections import Counter
    print(f"  地形區 {len(groups)} 個：{Counter(g['t'] for g in groups)}")


def build() -> None:
    below_sea()
    landforms()


if __name__ == "__main__":
    build()
