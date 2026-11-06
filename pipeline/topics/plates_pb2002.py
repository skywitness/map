"""板塊（PB2002）：地震與火山主題的板塊邊界、板塊的面與各板塊的人口（2026-11-06，參考 tectonicplatemap.org，使用者選「板1–板5」）。

資料：Peter Bird（2003）的 PB2002 模型，Hugo Ahlenius（Nordpil）整理的 https://github.com/fraxen/tectonicplates
（ODC-By 1.0，要註明 Hugo Ahlenius、Nordpil 與 Peter Bird；sources/plates.py，固定在同一個 commit）。

輸出 public/data/topics/earthquakes/：
- plates.json：板塊邊界（原本 earthquakes.py 寫的，2026-11-06 搬到這一步，地震目錄不必重抓）。同一條邊界上相連、同一個
  STEPCLASS 的段接成一條線（轉形斷層另外依右移、左移分開），每條線一筆紀錄：兩個板塊（pair，PB2002 的寫法，「TO/PA」是
  第二個〔PA〕隱沒到第一個下面、「NZ\\SA」是第一個〔NZ〕隱沒）、STEPCLASS、相對速度（依長度加權的平均、最小、最大，mm/年）、
  張開（正）或靠近（負）的分量、右移（正）或左移（負）的分量、長度，與地質圖的符號（m：1 隱沒帶的齒、2 張裂的箭頭、
  3 右移、4 左移）。隱沒帶的線轉成上覆板塊在行進方向的左邊（前端的齒畫在線的左邊），依板塊的面判斷哪一邊是哪一塊。
- plate-areas.json：52 塊板塊的面（簡化到約 2 公里），每一塊的中英文名、面積（球面，km²）、大／小／微板塊
  （2,000 萬、100 萬 km² 為界，同 tectonicplatemap.org 的分法）、鄰接的板塊、人口與人口最多的國家。
- plates-population.json：各板塊的人口排名（左側欄）：人口用人口主題的 0.1° 網格（JRC GHS-POP R2023A 2020 年，
  CC BY 4.0，topics/population/grid.json，每一格已經依國界分好國家），每一格依中心點歸到板塊；每塊板塊人口最多的幾國。
"""
from __future__ import annotations

import json
import math
import re
from collections import defaultdict

import numpy as np
import shapely
import shapely.ops
from shapely.geometry import Point, shape

from common import OUT_DIR, download, indicator_file, lines_file, now_iso, points_file, write_json
from sources import plates as pb

OUT = OUT_DIR / "topics" / "earthquakes"
GRID = OUT_DIR / "topics" / "population" / "grid.json"
R_KM = 6371.0088  # IUGG 等面積球的半徑
SIMPLIFY_DEG = 0.02

# PB2002 的 STEPCLASS → 紀錄的代碼（src/topics/earthquakes.ts 的 BOUNDARY_CLASSES 要一致）
STEP_CLASS = {"SUB": 1, "OCB": 2, "CCB": 3, "OSR": 4, "CRB": 5, "OTF": 6, "CTF": 7}
TYPE_OF = {1: pb.CONVERGENT, 2: pb.CONVERGENT, 3: pb.CONVERGENT, 4: pb.DIVERGENT, 5: pb.DIVERGENT, 6: pb.TRANSFORM, 7: pb.TRANSFORM}
TEETH, DIVERGE, DEXTRAL, SINISTRAL = 1, 2, 3, 4

# 板塊的中英文名（中文名依常見的譯名，沒有通行譯名的微板塊依地名音譯）
NAMES = {
    "AF": ("非洲板塊", "African Plate"), "AN": ("南極洲板塊", "Antarctic Plate"), "SO": ("索馬利亞板塊", "Somali Plate"),
    "IN": ("印度板塊", "Indian Plate"), "AU": ("澳洲板塊", "Australian Plate"), "EU": ("歐亞板塊", "Eurasian Plate"),
    "NA": ("北美洲板塊", "North American Plate"), "SA": ("南美洲板塊", "South American Plate"), "NZ": ("納斯卡板塊", "Nazca Plate"),
    "PA": ("太平洋板塊", "Pacific Plate"), "AR": ("阿拉伯板塊", "Arabian Plate"), "SU": ("巽他板塊", "Sunda Plate"),
    "TI": ("帝汶板塊", "Timor Plate"), "KE": ("克馬德克板塊", "Kermadec Plate"), "TO": ("東加板塊", "Tonga Plate"),
    "NI": ("紐阿福歐板塊", "Niuafo'ou Plate"), "WL": ("伍德拉克板塊", "Woodlark Plate"), "MO": ("毛克板塊", "Maoke Plate"),
    "SB": ("南俾斯麥板塊", "South Bismarck Plate"), "SS": ("索羅門海板塊", "Solomon Sea Plate"),
    "NB": ("北俾斯麥板塊", "North Bismarck Plate"), "NH": ("新赫布里底板塊", "New Hebrides Plate"),
    "CA": ("加勒比板塊", "Caribbean Plate"), "CO": ("科科斯板塊", "Cocos Plate"), "OK": ("鄂霍次克板塊", "Okhotsk Plate"),
    "JF": ("胡安德富卡板塊", "Juan de Fuca Plate"), "AP": ("阿爾蒂普拉諾板塊", "Altiplano Plate"),
    "ND": ("北安地斯板塊", "North Andes Plate"), "ON": ("沖繩板塊", "Okinawa Plate"), "PS": ("菲律賓海板塊", "Philippine Sea Plate"),
    "AM": ("阿穆爾板塊", "Amur Plate"), "CL": ("加羅林板塊", "Caroline Plate"), "MA": ("馬里亞納板塊", "Mariana Plate"),
    "FT": ("富圖納板塊", "Futuna Plate"), "SC": ("斯科細亞板塊", "Scotia Plate"), "SL": ("謝德蘭板塊", "Shetland Plate"),
    "AS": ("愛琴海板塊", "Aegean Sea Plate"), "AT": ("安納托利亞板塊", "Anatolian Plate"), "YA": ("揚子板塊", "Yangtze Plate"),
    "BU": ("緬甸板塊", "Burma Plate"), "RI": ("里維拉板塊", "Rivera Plate"), "BH": ("鳥頭板塊", "Bird's Head Plate"),
    "MS": ("摩鹿加海板塊", "Molucca Sea Plate"), "BS": ("班達海板塊", "Banda Sea Plate"), "MN": ("馬努斯板塊", "Manus Plate"),
    "CR": ("康威礁板塊", "Conway Reef Plate"), "BR": ("巴爾莫勒爾礁板塊", "Balmoral Reef Plate"),
    "EA": ("復活節島板塊", "Easter Plate"), "JZ": ("胡安費南德斯板塊", "Juan Fernandez Plate"),
    "GP": ("加拉巴哥板塊", "Galápagos Plate"), "SW": ("南三明治板塊", "Sandwich Plate"), "PM": ("巴拿馬板塊", "Panama Plate"),
}
MAJOR_KM2, MINOR_KM2 = 20e6, 1e6
# 不分年份的指標檔用一個欄位（前端 timeless）
YEAR = 2026
# 每塊板塊列出的國家：在這塊板塊上的人口至少這麼多、而且至少占那一國的這個比例（避免網格在國界上的零頭）
COUNTRY_MIN_POP, COUNTRY_MIN_SHARE = 10_000, 0.005
TOP_COUNTRIES = 8


def _zh_people(n: float) -> str:
    return f"{n / 1e8:.2f} 億人" if n >= 1e8 else f"{n / 1e4:,.0f} 萬人" if n >= 1e4 else f"{n:,.0f} 人"


def _en_people(n: float) -> str:
    return f"{n / 1e9:.2f} billion" if n >= 1e9 else f"{n / 1e6:.1f} million" if n >= 1e6 else f"{n / 1e3:,.0f} thousand"


def ring_area_km2(coords: list[tuple[float, float]]) -> float:
    """經緯度環的球面面積（Chamberlain & Duquette 2007 的公式）；沿南緯 90° 的邊這一項是 0，包著極點的環照樣對"""
    total = 0.0
    for (x1, y1), (x2, y2) in zip(coords, coords[1:]):
        total += math.radians(x2 - x1) * (2 + math.sin(math.radians(y1)) + math.sin(math.radians(y2)))
    return abs(total) * R_KM * R_KM / 2


def polygons() -> dict[str, list]:
    """板塊代碼 → shapely 多邊形（PB2002 在 180° 經線切開的板塊有好幾塊）"""
    with open(download(pb.PLATES_URL, "plates", "PB2002_plates.json"), encoding="utf-8") as f:
        features = json.load(f)["features"]
    out: dict[str, list] = defaultdict(list)
    for feat in features:
        geom = shape(feat["geometry"])
        out[feat["properties"]["Code"]].extend(list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom])
    missing = set(out) ^ set(NAMES)
    if missing:
        raise RuntimeError(f"PB2002 的板塊代碼跟 NAMES 對不上：{sorted(missing)}")
    return out


def _wrap(lon: float) -> float:
    return ((lon + 180) % 360) - 180


def _plate_at(lon: float, lat: float, polys: dict[str, list]) -> str | None:
    p = Point(_wrap(lon), lat)
    for code, parts in polys.items():
        if any(part.contains(p) for part in parts):
            return code
    return None


def _orient_subduction(line: list[tuple[float, float]], over: str, polys: dict[str, list]) -> list[tuple[float, float]] | None:
    """隱沒帶的線轉成上覆板塊在行進方向的左邊；從中間的段往兩端找，判斷不出來回傳 None（不畫齒）"""
    n = len(line) - 1
    order = sorted(range(n), key=lambda i: abs(i - n / 2))
    for i in order:
        (x0, y0), (x1, y1) = line[i], line[i + 1]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        c = math.cos(math.radians(my))
        dx, dy = (x1 - x0) * c, y1 - y0
        norm = math.hypot(dx, dy)
        if norm == 0:
            continue
        # 左邊的法向量（-dy, dx），距離 0.15°（約 17 公里）
        d = 0.15
        lx, ly = mx + (-dy / norm) * d / max(c, 0.05), my + (dx / norm) * d
        rx, ry = mx - (-dy / norm) * d / max(c, 0.05), my - (dx / norm) * d
        left, right = _plate_at(lx, ly, polys), _plate_at(rx, ry, polys)
        if left == over:
            return line
        if right == over:
            return line[::-1]
    return None


def boundaries(polys: dict[str, list]) -> tuple[list, list[int], list[dict]]:
    with open(download(pb.URL, "plates", "PB2002_steps.json"), encoding="utf-8") as f:
        steps = sorted((feat["properties"] for feat in json.load(f)["features"]), key=lambda p: p["SEQNUM"])
    groups: list[dict] = []
    prev = None
    for p in steps:
        cls = STEP_CLASS[p["STEPCLASS"]]
        # 轉形斷層依右移、左移分開（畫的箭頭方向不同）
        sense = (1 if p["VELOCITYRI"] >= 0 else -1) if cls in (6, 7) else 0
        x0, y0, x1, y1 = p["STARTLONG"], p["STARTLAT"], p["FINALLONG"], p["FINALLAT"]
        joined = (
            prev is not None
            and prev["PLATEBOUND"] == p["PLATEBOUND"]
            and groups[-1]["cls"] == cls
            and groups[-1]["sense"] == sense
            and abs(((prev["FINALLONG"] - x0 + 180) % 360) - 180) < 1e-6
            and abs(prev["FINALLAT"] - y0) < 1e-6
        )
        if not joined:
            groups.append({"pair": p["PLATEBOUND"], "cls": cls, "sense": sense, "line": [(x0, y0)], "steps": []})
        g = groups[-1]
        px = g["line"][-1][0]
        g["line"].append((x1 + 360 * round((px - x1) / 360), y1))
        g["steps"].append(p)
        prev = p

    lines, types, records = [], [], []
    no_side = 0
    for g in groups:
        st = g["steps"]
        length = sum(s["STEPLENGTH"] for s in st)
        w = lambda key: sum(s[key] * s["STEPLENGTH"] for s in st) / length  # noqa: E731
        a, sep, b = re.match(r"^([A-Z]{2})([-/\\])([A-Z]{2})$", g["pair"]).groups()
        line, mark, down = g["line"], 0, None
        if g["cls"] == 1:
            # 「A/B」B 隱沒到 A 下面，「A\B」A 隱沒到 B 下面
            down, over = (b, a) if sep == "/" else (a, b)
            oriented = _orient_subduction(line, over, polys)
            if oriented is None:
                no_side += 1
            else:
                line, mark = oriented, TEETH
        elif g["cls"] in (4, 5):
            mark = DIVERGE
        elif g["cls"] in (6, 7):
            mark = DEXTRAL if g["sense"] > 0 else SINISTRAL
        lines.append(line)
        types.append(TYPE_OF[g["cls"]])
        records.append({
            "a": a, "b": b, "az": NAMES[a][0], "ae": NAMES[a][1], "bz": NAMES[b][0], "be": NAMES[b][1],
            "c": g["cls"], "dn": down, "m": mark or None,
            "v": round(w("VELOCITYLE"), 1), "vmin": round(min(s["VELOCITYLE"] for s in st), 1),
            "vmax": round(max(s["VELOCITYLE"] for s in st), 1),
            "di": round(w("VELOCITYDI"), 1), "rl": round(w("VELOCITYRI"), 1), "len": round(length),
        })
    if no_side:
        print(f"  隱沒帶判斷不出上覆板塊在哪一邊、不畫齒的：{no_side} 條")
    return lines, types, records


def plate_population(polys: dict[str, list]) -> tuple[dict[str, float], dict[str, dict[str, float]], list[str]]:
    """人口網格（每一格依國家分好）依中心點歸到板塊：{板塊: 人口}、{板塊: {國家: 人口}}、網格的國家清單"""
    grid = json.loads(GRID.read_text(encoding="utf-8"))
    cols, size = grid["cols"], grid["cellSize"]
    cell = np.cumsum(np.asarray(grid["cell"], dtype=np.int64))
    country = np.asarray(grid["country"], dtype=np.int64)
    pop = np.asarray(grid["pop"], dtype=np.float64)
    row, col = np.divmod(cell, cols)
    x = -180 + (col + 0.5) * size
    y = 90 - (row + 0.5) * size
    plate = np.full(len(cell), -1, dtype=np.int64)
    codes = list(polys)
    for k, code in enumerate(codes):
        for part in polys[code]:
            minx, miny, maxx, maxy = part.bounds
            idx = np.nonzero((plate < 0) & (x >= minx) & (x <= maxx) & (y >= miny) & (y <= maxy))[0]
            if len(idx):
                inside = shapely.contains_xy(part, x[idx], y[idx])
                plate[idx[inside]] = k
    # 正好落在邊界上的格（點在線上不算 contains）：找附近 0.05° 的點
    for i in np.nonzero(plate < 0)[0]:
        for dx, dy in ((0.05, 0), (-0.05, 0), (0, 0.05), (0, -0.05)):
            hit = _plate_at(x[i] + dx, y[i] + dy, polys)
            if hit:
                plate[i] = codes.index(hit)
                break
    lost = pop[plate < 0].sum()
    if lost > 1000:
        raise RuntimeError(f"有 {lost:,.0f} 人的網格歸不到任何板塊")
    totals: dict[str, float] = defaultdict(float)
    by_country: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for k, c, n in zip(plate.tolist(), country.tolist(), pop.tolist()):
        if k < 0:
            continue
        totals[codes[k]] += n
        # 國家是 -1 的格：國界外、沒有歸到國家的（population_grid.py 的 code - 1），只算進板塊的人口
        if c >= 0:
            by_country[codes[k]][grid["countries"][c]] += n
    return totals, by_country, grid["countries"]


def build() -> None:
    polys = polygons()

    # ── 板塊邊界 ──
    lines, types, records = boundaries(polys)
    data = lines_file(lines, 0.01, types, records=records,
                      record_fields=["a", "b", "az", "ae", "bz", "be", "c", "dn", "m", "v", "vmin", "vmax", "di", "rl", "len"],
                      record_scale={"c": 1, "m": 1, "v": 0.1, "vmin": 0.1, "vmax": 0.1, "di": 0.1, "rl": 0.1, "len": 1},
                      record_strings=("a", "b", "az", "ae", "bz", "be", "dn"))
    write_json(OUT / "plates.json", data)
    fastest = max(records, key=lambda r: r["vmax"])
    print(f"  板塊邊界 {len(data['lines'])} 條；最快 {fastest['a']}-{fastest['b']} {fastest['vmax']} mm/年；"
          f"隱沒帶的齒 {sum(1 for r in records if r['m'] == TEETH)} 條")
    for name, (a, b) in {"聖安德列斯（右移）": ("PA", "NA"), "北安納托利亞（右移）": ("AT", "EU")}.items():
        rl = [r["rl"] for r in records if {r["a"], r["b"]} == {a, b} and r["c"] in (6, 7)]
        print(f"  檢查 {name}：右移分量 {rl[:6]}")

    # ── 板塊的面、面積、鄰接 ──
    area = {code: sum(ring_area_km2(list(part.exterior.coords)) for part in parts) for code, parts in polys.items()}
    total_area = sum(area.values())
    earth = 4 * math.pi * R_KM * R_KM
    if abs(total_area - earth) / earth > 1e-4:
        raise RuntimeError(f"52 塊板塊的面積加起來 {total_area:,.0f} km²，地球是 {earth:,.0f} km²")
    neighbours: dict[str, set[str]] = defaultdict(set)
    for r in records:
        neighbours[r["a"]].add(r["b"])
        neighbours[r["b"]].add(r["a"])

    # ── 人口 ──
    totals, by_country, _countries = plate_population(polys)
    country_total: dict[str, float] = defaultdict(float)
    for per in by_country.values():
        for c, n in per.items():
            country_total[c] += n

    def countries_on(code: str) -> list[tuple[str, float]]:
        per = by_country.get(code, {})
        keep = [(c, n) for c, n in per.items() if n >= COUNTRY_MIN_POP and n >= COUNTRY_MIN_SHARE * country_total[c]]
        return sorted(keep, key=lambda kv: -kv[1])

    def cls_of(code: str) -> int:
        return 1 if area[code] >= MAJOR_KM2 else 2 if area[code] >= MINOR_KM2 else 3

    rings, ring_records = [], []
    order = sorted(polys, key=lambda c: -area[c])
    for code in order:
        zh, en = NAMES[code]
        nb = sorted(neighbours[code], key=lambda c: -area[c])
        on = countries_on(code)
        for part in polys[code]:
            simple = part.simplify(SIMPLIFY_DEG, preserve_topology=True)
            rings.append(list(simple.exterior.coords))
            ring_records.append({
                "code": code, "zh": zh, "en": en, "cls": cls_of(code), "area": round(area[code]), "pop": round(totals.get(code, 0)),
                "nbzh": "、".join(NAMES[c][0] for c in nb), "nben": ", ".join(NAMES[c][1] for c in nb),
                "iso": " ".join(c for c, _n in on[:TOP_COUNTRIES]), "ring": 1,
            })
    areas = lines_file(rings, 0.01, [cls_of(r["code"]) for r in ring_records], records=ring_records,
                       record_fields=["code", "zh", "en", "cls", "area", "pop", "nbzh", "nben", "iso", "ring"],
                       record_scale={"cls": 1, "area": 1, "pop": 1, "ring": 1},
                       record_strings=("code", "zh", "en", "nbzh", "nben", "iso"))
    write_json(OUT / "plate-areas.json", areas)

    # 板塊名稱的位置（地圖上的字）：最大那一塊的「離邊界最遠的點」（polylabel）；rank 3 大、2 小、1 微，縮小時只寫大板塊
    labels = []
    for code in order:
        part = max(polys[code], key=lambda g: g.area)
        at = shapely.ops.polylabel(part.simplify(0.1), tolerance=0.1)
        labels.append({"lon": round(at.x, 2), "lat": round(at.y, 2), "zh": NAMES[code][0], "en": NAMES[code][1],
                       "rank": 4 - cls_of(code)})
    write_json(OUT / "plate-labels.json", points_file(labels, ["lon", "lat", "zh", "en", "rank"], {"lon": 0.01, "lat": 0.01, "rank": 1}))

    # ── 各國跨幾塊板塊（「板塊」指標的國家數值）：有人住的部分（同上的門檻），附註寫各板塊上的人數 ──
    plates_of: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for code in polys:
        for c, n in countries_on(code):
            plates_of[c].append((code, n))
    values, notes, notes_en = {}, {}, {}
    for c, lst in sorted(plates_of.items()):
        lst.sort(key=lambda kv: -kv[1])
        values[c] = [len(lst)]
        if len(lst) > 1:
            notes[c] = "、".join(f"{NAMES[k][0]} {_zh_people(n)}" for k, n in lst)
            notes_en[c] = ", ".join(f"{NAMES[k][1]} {_en_people(n)}" for k, n in lst)
    write_json(OUT / "plates-count.json", indicator_file(
        "plates-count", "塊", [YEAR], values, notes=notes, notesEn=notes_en, license="ODC-By 1.0; CC BY 4.0"))
    print(f"  跨最多板塊的國家：{sorted(((v[0], c) for c, v in values.items()), reverse=True)[:8]}")

    # ── 各板塊的人口（左側欄）──
    world = sum(totals.values())
    rows = []
    for code in sorted(polys, key=lambda c: -totals.get(c, 0)):
        on = countries_on(code)
        rows.append([code, NAMES[code][0], NAMES[code][1], cls_of(code), round(area[code]), round(totals.get(code, 0)),
                     [[c, round(n)] for c, n in on[:5]]])
    write_json(OUT / "plates-population.json", {
        "fields": ["code", "zh", "en", "cls", "area", "pop", "countries"],
        "world": round(world),
        # 台灣的人口分在哪幾塊板塊（左側欄的第一行）
        "taiwan": [[k, round(n)] for k, n in sorted(plates_of.get("TWN", []), key=lambda kv: -kv[1])],
        "source": "PB2002 (Bird 2003; fraxen/tectonicplates, ODC-By 1.0) × JRC GHS-POP R2023A 2020 (CC BY 4.0), 0.1° grid",
        "generatedAt": now_iso(),
        "rows": rows,
    })
    top = [(r[1], f"{r[5] / 1e8:.2f} 億") for r in rows[:6]]
    print(f"  板塊 {len(polys)} 塊（大 {sum(1 for c in polys if cls_of(c) == 1)}、小 {sum(1 for c in polys if cls_of(c) == 2)}、"
          f"微 {sum(1 for c in polys if cls_of(c) == 3)}），面積合計 {total_area:,.0f} km²；人口 {world / 1e8:.1f} 億")
    print(f"  人口最多：{top}")
    tw = {code: round(per.get('TWN', 0)) for code, per in by_country.items() if per.get('TWN')}
    print(f"  台灣的人口在：{tw}")
