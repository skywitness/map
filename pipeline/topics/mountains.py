"""山脈（海拔主題的擴充，2026-10-29）：GMBA Mountain Inventory v2 的 291 個主要山系（standard_300）。

**來源**：GMBA Mountain Inventory v2.0（EarthEnv，Snethlage et al. 2022），CC BY 4.0（https://www.earthenv.org/mountains ）。
`GMBA_Inventory_v2.0_standard_300.zip`（約 32 MB）：291 個山系的多邊形，合起來就是 GMBA 依地形起伏定義的全部山區
（南極洲除外）；屬性有八種語言的名稱、Wikidata 編號、面積、所在國家、Color300（相鄰的山系顏色不同的 5 色編號）。
使用者決定（2026-10-29）：當海拔主題的疊加圖層，用 291 個主要山系。

讀法：標準函式庫讀 .shp、.dbf（不需要 GDAL 的 OGR），shapely 組成多邊形、簡化。

**中文名稱**：Wikidata 的 zh-tw、zh-hant 標籤（沒有時用中文維基百科的條目名稱或 zh 標籤，OpenCC 轉繁體，
topics.reads.wikidata_labels），再來是 GMBA 的 Name_ZH（簡體，OpenCC s2twp 轉台灣用語），都沒有的寫在 ZH_NAMES；
ZH_FIX 改掉中國大陸的譯名或不通順的。

**輸出**（public/data/topics/elevation/）：
- mountains.json：山系的範圍（線圖層的 fill，每個環一筆紀錄 r＝山系的編號、k＝是不是洞；山系的名稱、面積、顏色編號放 groups）
- mountain-labels.json：名稱標在哪裡（polylabel），依面積排序，縮小時只標大的
- mountain.json：各國國土在山區的比例（%）。0.025° 的網格（約 2.8 km），國界跟海拔主題一樣（population_grid.country_shapes），
  每格依緯度加權；國界含湖面
- mountain-ranges.json：側欄的「主要山脈」：每國面積最大的幾個山系 [山系編號, 在這一國的面積 km²]
"""
from __future__ import annotations

import struct
import zipfile
from collections import defaultdict

import numpy as np

from common import OUT_DIR, download, indicator_file, lines_file, points_file, write_json
from topics.elevation import YEAR

OUT = OUT_DIR / "topics" / "elevation"
URL = "https://data.earthenv.org/mountains/standard/GMBA_Inventory_v2.0_standard_300.zip"
STEM = "GMBA_Inventory_v2.0_standard_300"
SIMPLIFY_DEG = 0.04
QUANTUM = 0.01
# 小於這個面積（平方度，赤道約 120 km²）的碎片與洞（小島、邊緣的小塊、山區裡的小盆地）不畫
MIN_PART = 0.01
GRID_DEG = 0.025
TOP_RANGES = 6
# 陸地少於這個面積（km²）的國家在 0.025° 的網格上太粗（摩納哥、聖馬利諾），不輸出比例
MIN_LAND_KM2 = 100

# Wikidata 與 GMBA 都沒有中文的：檔案裡的順序 → (GMBA 的 MapName, 中文)。同名的山系不只一個（兩個 Cordillera Central），
# 所以用順序、再核對名稱（GMBA 改版時順序變了會報錯）。2026-10-29 自己翻
ZH_NAMES: dict[int, tuple[str, str]] = {
    2: ('Cordillera Centroamericana', '中美洲山脈'),
    6: ('Western Indian Ocean Islands', '西印度洋群島'),
    7: ('Eastern Indian Ocean Islands', '東印度洋群島'),
    9: ('Eastern Pacific Islands', '東太平洋群島'),
    21: ('Cordillera de la Costa', '厄瓜多海岸山脈'),
    23: ('Plateau of Mozambique', '莫三比克高原'),
    30: ('Tumucumaque Uplands', '圖穆庫馬克山地'),
    35: ('Arctic Cordillera', '北極山脈'),
    40: ('Levant Ranges', '黎凡特山地'),
    52: ('Stewart Island', '斯圖爾特島'),
    54: ('Khentei-Daur Highlands', '肯特-達烏爾高地'),
    56: ('Selenga Highlands', '色楞格高地'),
    58: ('Yankan - Tukuringra - Soktakhan - Dzhagdy group of mountain ranges', '揚坎-圖庫林格拉山群'),
    59: ('Sistema periférico', '哥倫比亞外圍山系'),
    60: ('Meseta Patagónica', '巴塔哥尼亞高原'),
    61: ('Central Highland', '巴西中部高地'),
    62: ('Maranhão-Piauí Highlands', '馬拉尼昂-皮奧伊高地'),
    63: ('Southern Highland', '巴西南部高地'),
    64: ('Northeastern Highland', '巴西東北高地'),
    68: ('Flinders Lofty Block', '弗林德斯-洛夫蒂山地'),
    69: ('Central Ranges', '澳洲中部山脈'),
    70: ('West Coast Ranges', '澳洲西岸山地'),
    71: ('Northern Ranges', '澳洲北部山地'),
    72: ('Western Lowlands', '馬達加斯加西部低地'),
    73: ('Eastern Escarpment (Madagascar)', '馬達加斯加東部斷崖'),
    75: ('South Canadian Arctic Islands', '加拿大北極群島南部'),
    77: ('Volta Highlands', '沃爾特高地'),
    79: ('Nigerian Highlands', '奈及利亞高地'),
    80: ('Yablonov Mountain System*', '雅布洛諾夫山脈'),
    81: ('Southern Rift Mountains', '馬拉威湖周邊山地'),
    82: ('Mongolian Highlands', '蒙古高原'),
    85: ('Central Range', '馬達加斯加中央山地'),
    88: ('Cordones Serranos Bonaerenses', '布宜諾斯艾利斯丘陵'),
    90: ('Lower Guinea Swell', '下幾內亞隆起'),
    92: ('Asande Highland', '阿贊德高地'),
    164: ('Great Basin Ranges', '大盆地山脈'),
    167: ('Insular Mountains', '溫哥華島山脈'),
    168: ('Klamath Mountains', '克拉馬斯山脈'),
    172: ('Anatolian Plateau', '安那托利亞高原'),
    174: ('Alaska Intermountain Ranges', '阿拉斯加內陸山地'),
    179: ('Central Iranian Range', '伊朗中部山脈'),
    188: ('Central Myanmar Ranges', '緬甸中部山地'),
    192: ('Patagonian Andes', '巴塔哥尼亞安地斯山脈'),
    194: ('Eastern Iranian Ranges', '伊朗東部山地'),
    195: ('Northwest Ranges', '南島西北山地'),
    198: ('Central Highlands', '中南半島中部高地'),
    201: ('Northwestern Great Escarpment', '大斷崖西北段'),
    202: ('Southwestern Great Escarpment', '大斷崖西南段'),
    204: ('Pannonian Island Mountains', '潘諾尼亞島山'),
    206: ('Hellenides', '希臘山系'),
    207: ('Rila-Rhodope Massif', '里拉-羅多彼山地'),
    208: ('Central Great Dividing Range', '大分水嶺中段'),
    209: ('Northern Great Dividing Range', '大分水嶺北段'),
    211: ('Central Labrador Ranges', '拉布拉多中部山地'),
    213: ('Cordillera Occidental', '西科迪勒拉山脈（北安地斯）'),
    214: ('Cordillera Central', '中科迪勒拉山脈（哥倫比亞）'),
    215: ('Cordillera Oriental', '東科迪勒拉山脈（北安地斯）'),
    216: ('Cordillera Central', '中科迪勒拉山脈（中安地斯）'),
    217: ('Cordillera Oriental', '東科迪勒拉山脈（中安地斯）'),
    222: ('Yukon Intermountain Ranges', '育空內陸山地'),
    224: ('Southwest Basins and Ranges', '西南盆嶺區'),
    225: ('Canadian Arctic Shores', '加拿大北極海岸'),
    226: ('James Region', '詹姆斯灣地區'),
    228: ('Central Montana Rocky Mountains', '蒙大拿中部洛磯山脈'),
    229: ('Far Northern Rockies', '極北洛磯山脈'),
    230: ('Greater Yellowstone Rockies', '大黃石洛磯山脈'),
    231: ('Idaho-Bitterroot Rocky Mountains', '愛達荷-比特魯特洛磯山脈'),
    232: ('Western Rocky Mountains', '西洛磯山脈'),
    233: ('Kwazulu Natal Midlands', '夸祖魯-納塔爾中部'),
    234: ('Eastern Cape Hills', '東開普丘陵'),
    235: ('Geraizinhos Highlands', '熱賴津紐斯高地'),
    236: ('Northeastern Great Escarpment', '大斷崖東北段'),
    237: ('South China Hills', '華南丘陵'),
    238: ('Sierras Subandinas', '次安地斯山脈'),
    239: ('Upper Mesopotamian Hills', '上美索不達米亞丘陵'),
    240: ('Bureya Region', '布列亞山地'),
    242: ('Southern Great Escarpment', '大斷崖南段'),
    243: ('Shandong Mountains', '山東丘陵'),
    244: ('Western Mediterranean Islands', '西地中海群島'),
    245: ('Eastern Mediterranean Islands', '東地中海群島'),
    246: ('Cameroon Island Chain', '喀麥隆火山島鏈'),
    248: ('West Sahara Mountains', '撒哈拉西部山地'),
    249: ('East Sahara Mountains', '撒哈拉東部山地'),
    250: ('South Island Hills', '南島丘陵'),
    252: ('Fell Lapland', '拉普蘭丘陵'),
    253: ('Cameroon Highlands', '喀麥隆高地'),
    254: ('Shanxi Mountains', '山西山地'),
    256: ('Central Highlands', '印度中部高地'),
    261: ('Southern Great Dividing Range', '大分水嶺南段'),
    270: ('Western Sayan', '西薩彥嶺'),
    275: ('North Papuan Mountains', '新幾內亞北部山脈'),
    277: ('Northern California Coast Ranges', '北加州海岸山脈'),
    278: ('Mongolian Altai', '蒙古阿爾泰山'),
    279: ('Gobi-Altai Mountains', '戈壁阿爾泰山'),
    280: ('Southern California Coast Ranges', '南加州海岸山脈'),
    282: ('Northern Altai', '北阿爾泰山'),
    283: ('Northern Scandes', '斯堪地那維亞山脈北段'),
    284: ('Southern Scandes', '斯堪地那維亞山脈南段'),
    285: ('High Plateaux of Katanga', '加丹加高原'),
    289: ('Sulawesi Archipelago', '蘇拉威西島'),
}
# 改掉 Wikidata 的中國大陸譯名、不是山的條目名稱（「斐濟地理」「龍山山脈」）、殘留的簡體字
ZH_FIX: dict[int, tuple[str, str]] = {
    0: ('Arctic Ocean', '北極海群島'),
    3: ('Caribbean Islands', '加勒比海群島'),
    4: ('South Atlantic Islands', '南大西洋群島'),
    5: ('Southern Indian Ocean Islands', '南印度洋群島'),
    10: ('Aldan Mountains', '阿爾丹高原'),
    11: ('Chukotka Mountains', '楚科奇山脈'),
    24: ('Coro Region', '科羅地區'),
    27: ('Tasmania', '塔斯馬尼亞島'),
    29: ('Guiana Highlands', '蓋亞那高地'),
    32: ('Eastern Rift mountains', '格雷戈里裂谷山地'),
    34: ('Guinea Highlands', '幾內亞高地'),
    42: ('Fiji', '斐濟群島'),
    44: ('Vanuatu Islands', '萬那杜群島'),
    50: ('Balochistan Ranges', '俾路支山地'),
    51: ('Albertine Rift Mountains', '艾伯丁裂谷山地'),
    53: ('North Island', '北島（紐西蘭）'),
    65: ('Horn of Africa Highlands', '非洲之角高地'),
    66: ('Macaronesian Islands', '馬卡羅尼西亞群島'),
    86: ('East Siberian Plateaus', '東西伯利亞高原'),
    89: ('Sudanese Highlands', '蘇丹高地'),
    94: ('Patom Highlands', '帕托姆高原'),
    95: ('European Alps', '阿爾卑斯山脈'),
    98: ('Alborz Mountains', '厄爾布爾士山脈'),
    100: ('Altiplano', '阿爾蒂普拉諾高原'),
    110: ('Coast Mountains', '海岸山脈（北美）'),
    114: ('Dinaric Alps', '第拿里阿爾卑斯山脈'),
    115: ('Drakensberg', '德拉肯斯堡山脈'),
    117: ('Trans-Mexican Volcanic Belt', '橫貫墨西哥火山帶'),
    119: ('Jura Mountains', '侏羅山脈'),
    120: ('Sikhote-Alin', '錫霍特-阿林山脈'),
    123: ('Pontic Mountains', '龐廷山脈'),
    124: ('Kuznetsk Alatau', '庫茲涅茨克阿拉套山'),
    133: ('Rif', '里夫山脈'),
    144: ('Sistema Central', '伊比利中央山脈'),
    145: ('Sistema Iberico', '伊比利山脈'),
    158: ('Cape Fold Mountains', '開普褶皺山脈'),
    160: ('Canadian Rockies', '加拿大洛磯山脈'),
    166: ('Columbia Mountains', '哥倫比亞山脈（北美）'),
    175: ('Laurentian Mountains', '勞倫琴山脈'),
    177: ('Ouachita Mountains', '沃希托山脈'),
    178: ('Sarawat Mountains', '薩拉瓦特山脈'),
    181: ('Fiordland', '峽灣地區（紐西蘭）'),
    182: ('Philippine Archipelago', '菲律賓群島'),
    184: ('Crimean Mountains', '克里米亞山脈'),
    186: ('Montes de Toledo', '托雷多山脈'),
    190: ('Oregon Coast Range', '奧勒岡海岸山脈'),
    191: ('Cordillera Occidental', '西科迪勒拉山脈（中安地斯）'),
    196: ('Kaikoura Ranges', '凱庫拉山脈'),
    210: ('Central Uplands', '德國中部山地'),
    212: ('Black Hills', '黑山（美國）'),
    241: ('Dry Andes', '乾燥安地斯山脈'),
    251: ('Qiangtang', '羌塘高原'),
    257: ('Najd', '內志高原'),
    258: ('Alashan Plateau', '阿拉善高原'),
    259: ('Honshu', '本州'),
    263: ('Anti-Atlas Range', '反阿特拉斯山脈'),
    264: ('High Atlas Range', '高阿特拉斯山脈'),
    274: ("Bird's Head Peninsula", '鳥頭半島'),
    286: ('Central Range', '新幾內亞高地'),
}


def _dbf(data: bytes) -> list[dict[str, str]]:
    n, hlen, rlen = struct.unpack("<IHH", data[4:12])
    fields = []
    pos = 32
    while data[pos] != 0x0D:
        fields.append((data[pos : pos + 11].split(b"\0")[0].decode(), data[pos + 16]))
        pos += 32
    out = []
    for i in range(n):
        off = hlen + i * rlen + 1
        rec = {}
        for name, size in fields:
            rec[name] = data[off : off + size].decode("utf-8", "replace").strip()
            off += size
        out.append(rec)
    return out


def _shapes(data: bytes):
    """.shp 的每一筆 Polygon（類型 5）→ shapely 的（Multi）Polygon：順時針的環是外環、逆時針的是洞"""
    from shapely.geometry import MultiPolygon, Polygon

    out = []
    pos = 100
    while pos + 8 <= len(data):
        _num, length = struct.unpack(">ii", data[pos : pos + 8])
        content = data[pos + 8 : pos + 8 + length * 2]
        pos += 8 + length * 2
        shape = struct.unpack("<i", content[:4])[0]
        if shape != 5:
            raise ValueError(f"GMBA 不是 Polygon（shape type {shape}）")
        nparts, npoints = struct.unpack("<ii", content[36:44])
        parts = list(struct.unpack(f"<{nparts}i", content[44 : 44 + 4 * nparts]))
        pts = np.frombuffer(content[44 + 4 * nparts : 44 + 4 * nparts + 16 * npoints], dtype="<f8").reshape(-1, 2)
        outers: list[list] = []
        holes: list = []
        for i, start in enumerate(parts):
            ring = pts[start : parts[i + 1] if i + 1 < nparts else npoints]
            x, y = ring[:, 0], ring[:, 1]
            signed = float(np.sum(x[:-1] * y[1:] - x[1:] * y[:-1]))
            (holes if signed > 0 else outers).append(ring)
        polys = [[Polygon(o), []] for o in outers]
        for h in holes:
            hp = Polygon(h)
            owner = next((p for p in polys if p[0].contains(hp.representative_point())), None)
            if owner:
                owner[1].append(h)
        geoms = [Polygon(p[0].exterior.coords, p[1]).buffer(0) for p in polys]
        out.append(MultiPolygon([g for geom in geoms for g in (geom.geoms if geom.geom_type == "MultiPolygon" else [geom])]))
    return out


def read() -> list[dict]:
    path = download(URL, "gmba", f"{STEM}.zip")
    with zipfile.ZipFile(path) as z:
        recs = _dbf(z.read(f"{STEM}.dbf"))
        geoms = _shapes(z.read(f"{STEM}.shp"))
    if len(recs) != len(geoms):
        raise ValueError(f"GMBA 的 .dbf 有 {len(recs)} 筆、.shp 有 {len(geoms)} 筆")
    for r, g in zip(recs, geoms):
        r["geom"] = g
        url = r["WikiDataUR"]
        r["qid"] = url.rsplit("/", 1)[-1] if url.startswith("https://www.wikidata.org/wiki/Q") else None
    return recs


def zh_names(recs: list[dict]) -> dict[int, str | None]:
    from opencc import OpenCC

    from topics.reads import wikidata_labels

    s2twp = OpenCC("s2twp")
    labels = wikidata_labels({r["qid"] for r in recs if r["qid"]})
    out: dict[int, str | None] = {}
    sources = defaultdict(int)
    for table in (ZH_NAMES, ZH_FIX):
        for i, (name, _zh) in table.items():
            if recs[i]["MapName"] != name:
                raise ValueError(f"GMBA 第 {i} 個是 {recs[i]['MapName']}，不是 {name}（順序變了，要重新對照）")
    for i, r in enumerate(recs):
        zh = ZH_FIX[i][1] if i in ZH_FIX else None
        src = "fix"
        if not zh and r["qid"]:
            zh, src = (labels.get(r["qid"]) or [None])[0], "wikidata"
        if not zh and r["Name_ZH"]:
            zh, src = s2twp.convert(r["Name_ZH"]), "gmba"
        if not zh and i in ZH_NAMES:
            zh, src = ZH_NAMES[i][1], "manual"
        # Wikidata 的「海岸山脈 (北美)」改成全形括號
        out[i] = zh.replace(" (", "（").replace("(", "（").replace(")", "）") if zh else None
        sources[src if zh else "missing"] += 1
    print(f"  中文名稱：{dict(sources)}")
    return out


def rings_of(g) -> list[tuple[list[tuple[float, float]], int]]:
    """外環與洞（1）；比 MIN_PART 小的洞（山區裡的小盆地、谷地）不留，外框才不會密密麻麻"""
    from shapely.geometry import Polygon

    out = []
    for p in g.geoms if g.geom_type == "MultiPolygon" else [g]:
        out.append((list(p.exterior.coords), 0))
        for hole in p.interiors:
            if Polygon(hole).area >= MIN_PART:
                out.append((list(hole.coords), 1))
    return out


def country_share(recs: list[dict]):
    """各國國土在山區的比例，與每國每個山系的面積（km²）"""
    import rasterio.features
    from affine import Affine
    from rasterio.windows import Window

    from sources.ghsl import country_codes
    from topics.population_grid import OVERRIDES, bbox, country_shapes

    shapes_by_unit = country_shapes()
    codes = sorted(shapes_by_unit.keys() | {target for _s, target, _a in OVERRIDES})
    index = {iso3: i + 1 for i, iso3 in enumerate(codes)}
    shapes = [
        ({"type": "Polygon", "coordinates": polygon}, index[iso3], bbox(polygon))
        for iso3, polygons in shapes_by_unit.items()
        for polygon in polygons
    ]
    width, height = round(360 / GRID_DEG), round(180 / GRID_DEG)
    t = Affine(GRID_DEG, 0, -180, 0, -GRID_DEG, 90)
    n = len(codes) + 1
    land = np.zeros(n)
    by_range = np.zeros((n, len(recs) + 1))
    ranges = [(r["geom"], i + 1) for i, r in enumerate(recs)]
    rows = 400
    for r0 in range(0, height, rows):
        h = min(rows, height - r0)
        window = Window(0, r0, width, h)
        code = country_codes(shapes, window, t).astype(np.int64)
        lat = 90 - (r0 + np.arange(h) + 0.5) * GRID_DEG
        for source, target, (lon0, lat0, lon1, lat1) in [
            (index[s] if s else 0, index[t_], a) for s, t_, a in OVERRIDES
        ]:
            lon = -180 + (np.arange(width) + 0.5) * GRID_DEG
            rr = (lat >= lat0) & (lat <= lat1)
            cc = (lon >= lon0) & (lon <= lon1)
            if rr.any() and cc.any():
                block = code[np.ix_(rr, cc)]
                block[block == source] = target
                code[np.ix_(rr, cc)] = block
        lat_top, lat_bottom = 90 - r0 * GRID_DEG, 90 - (r0 + h) * GRID_DEG
        near = [(g, v) for g, v in ranges if g.bounds[3] >= lat_bottom and g.bounds[1] <= lat_top]
        rng = (
            rasterio.features.rasterize(near, out_shape=(h, width), transform=rasterio.windows.transform(window, t), fill=0, dtype="uint16")
            if near else np.zeros((h, width), np.uint16)
        ).astype(np.int64)
        # 每格的面積（km²）
        area = (np.cos(np.radians(lat)) * (GRID_DEG * 111.19508) ** 2)[:, None] * np.ones((1, width))
        land += np.bincount(code.ravel(), weights=area.ravel(), minlength=n)
        np.add.at(by_range, (code.ravel(), rng.ravel()), area.ravel())
    share, per_country = {}, {}
    for iso3, k in index.items():
        # 「_」開頭的是 population_grid 的爭議地區（錫亞琴冰川），不是國家
        if land[k] < MIN_LAND_KM2 or iso3.startswith("_"):
            continue
        mountain = by_range[k, 1:].sum()
        share[iso3] = round(float(mountain / land[k] * 100), 1)
        top = [(i, float(by_range[k, i + 1])) for i in np.argsort(-by_range[k, 1:])[:TOP_RANGES] if by_range[k, i + 1] >= 1]
        if top:
            per_country[iso3] = [[int(i), round(a)] for i, a in top]
    return share, per_country


def build() -> None:
    from shapely.ops import polylabel

    recs = read()
    print(f"  GMBA：{len(recs)} 個山系，面積合計 {sum(float(r['Area']) for r in recs):,.0f} km²")
    names = zh_names(recs)
    missing = [r["MapName"] for i, r in enumerate(recs) if not names[i]]
    if missing:
        print(f"  沒有中文名稱的 {len(missing)} 個：{'; '.join(missing)}")

    lines, types, records, groups, labels = [], [], [], [], []
    for i, r in enumerate(recs):
        g = r["geom"].simplify(SIMPLIFY_DEG, preserve_topology=True)
        parts = [p for p in (g.geoms if g.geom_type == "MultiPolygon" else [g]) if p.area >= MIN_PART]
        if not parts:
            continue
        en = r["Name_EN"] or r["MapName"]
        groups.append({"r": i, "n": en, "z": names[i], "s": round(float(r["Area"])), "c": r["CountryISO"].replace(" ", ""), "f": 1})
        for p in parts:
            for ring, hole in rings_of(p):
                lines.append(ring)
                types.append(int(r["Color300"] or 1))
                records.append({"r": i, "k": hole})
        big = max(parts, key=lambda p: p.area)
        pt = polylabel(big, tolerance=0.05)
        labels.append({"lon": round(pt.x, 2), "lat": round(pt.y, 2), "r": i, "n": en, "z": names[i], "s": round(float(r["Area"]))})

    OUT.mkdir(parents=True, exist_ok=True)
    data = lines_file(
        lines, QUANTUM, types, records=records,
        record_fields=["r", "k"], record_scale={"r": 1, "k": 1}, record_delta=["r"],
        groups=("r", points_file(groups, ["r", "n", "z", "s", "c", "f"], {"r": 1, "s": 1, "f": 1}, ("r",), ("n", "z", "c"))),
    )
    write_json(OUT / "mountains.json", data)
    labels.sort(key=lambda p: -p["s"])
    write_json(OUT / "mountain-labels.json", points_file(labels, ["lon", "lat", "r", "n", "z", "s"], {"lon": 0.01, "lat": 0.01, "r": 1, "s": 1}, (), ("n", "z")))

    share, per_country = country_share(recs)
    write_json(OUT / "mountain.json", indicator_file("mountain", "%", [YEAR], {c: [v] for c, v in share.items()}))
    write_json(OUT / "mountain-ranges.json", {
        "ranges": [[r["Name_EN"] or r["MapName"], names[i]] for i, r in enumerate(recs)],
        "countries": per_country,
    })
    for c in ("TWN", "NPL", "CHE", "JPN", "NLD", "USA", "CHN"):
        top = ", ".join(f"{names[i] or recs[i]['MapName']} {a:,}" for i, a in per_country.get(c, [])[:3])
        print(f"    {c}：山區 {share.get(c)}%；{top}")


if __name__ == "__main__":
    build()
