"""台灣的中醫：健保特約的中醫院所，依鄉鎮市區（2026-11-08，使用者要求「更詳細的中醫診所和中醫醫院清單與位置」；步驟 taiwan-tcm-clinics）。

- 資料：健保署資料開放平台（info.nhi.gov.tw）的「健保特約醫事機構」診所、醫學中心、區域醫院、地區醫院四份資料集，
  本機 session 用平台的 datastore API 取出、篩成中醫的（型態別是中醫，或診療科別有中醫一般科），只留醫事機構代碼、名稱、
  地址、型態別、特約類別、終止合約或歇業日期六欄（不留電話、負責醫師、看診時段），放在 map-plan 的 data/nhi-tcm/clinics.csv
  （cloud 連不上健保署的平台）；重跑前把它複製到 .cache/nhi-tcm/clinics.csv。授權：政府資料開放授權條款第 1 版。
- 只算現在特約的：「終止合約或歇業日期」早於資料產生當天的不算（本機 session 查過：那些列的科別與服務項目都是空的）。
- 三類：中醫醫院（型態別「中醫醫院」）、中醫診所（型態別是中醫的診所）、醫院的中醫科（西醫醫院的診療科別有中醫一般科）。
- **位置**（使用者 2026-11-09 選：不用 TGOS，改用 OpenStreetMap）：清單沒有座標，地址先比對內政部的鄉鎮市區名稱
  （divisions 步驟的 TWN.json 的 u2），再依序找：
  1. 名稱一樣、在同一個鄉鎮市區的 OSM 院所（名稱含「中醫」的點與 way；幾個點相距不到約 300 公尺才用平均）；
  2. 地址的路（含段）在同一個鄉鎮市區的 OSM 道路中點的中位數；
  3. 同一條路不分段；
  4. 都找不到就放在鄉鎮市區的標籤點。
  每一家記下是哪一層（q）。OSM 的兩張表由本機 session 從 Geofabrik 的台灣檔（2026-11-08T21:21Z）取出，放在 map-plan 的
  data/osm-tw/（roads.csv.gz、tcm-pois.csv），重跑前複製到 .cache/osm-tw/；鄉鎮市區的界線用內政部 1140318 版
  （.cache/nlsc/town-1140318.zip，divisions 步驟下載的）。座標是 OSM 的衍生資料庫，照 ODbL 1.0 提供。
  同一個位置有好幾家（同一段路）時，依序錯開約 15 公尺，地圖上才點得到每一家。
"""
from __future__ import annotations

import csv
import gzip
import json
import math
import re
import shutil
import unicodedata
import zipfile
from collections import Counter, defaultdict
from datetime import date
from statistics import median

from common import CACHE_DIR, OUT_DIR, indicator_file, points_file, write_json, write_points

OUT = OUT_DIR / "topics" / "taiwan-tcm"
SRC = CACHE_DIR / "nhi-tcm" / "clinics.csv"
HOSPITAL, CLINIC, DEPARTMENT = 1, 2, 3  # src/topics/taiwan-tcm.ts 的 KINDS
# 清單的縣市順序（直轄市、省轄市、縣，最後是金門、連江）
COUNTY_ORDER = ["臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市", "基隆市", "新竹市", "嘉義市", "新竹縣", "苗栗縣", "彰化縣", "南投縣",
                "雲林縣", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣"]
OLD_COUNTIES = {"臺北縣": "新北市", "桃園縣": "桃園市", "臺中縣": "臺中市", "臺南縣": "臺南市", "高雄縣": "高雄市"}
OSM = CACHE_DIR / "osm-tw"
OSM_SRC = OUT_DIR.parent.parent.parent / "map-plan" / "data" / "osm-tw"
TOWN_ZIP = CACHE_DIR / "nlsc" / "town-1140318.zip"
NOT_ROADS = {"footway", "path", "steps", "cycleway", "bridleway", "corridor", "proposed", "construction", "platform", "elevator"}
CN = "零一二三四五六七八九十"
ON_POI, ON_SECTION, ON_ROAD, ON_TOWN = 1, 2, 3, 4  # src/topics/taiwan-tcm.ts 的 PRECISION
TCM_TYPES = {"中醫醫院": HOSPITAL, "中醫綜合醫院": HOSPITAL, "中醫一般診所": CLINIC, "中醫診所": CLINIC, "中醫專科診所": CLINIC,
             "中醫醫務室": CLINIC}


def _kind(row: dict) -> int:
    t = row["醫事機構種類"]
    if t in TCM_TYPES:
        return TCM_TYPES[t]
    if row["特約類別"] in ("1", "2", "3"):
        return DEPARTMENT
    if "中醫" in row["醫事機構名稱"]:  # 型態別是一般診所、名稱是中醫診所的（農會附設）
        return CLINIC
    raise ValueError(f"分不出類別：{row['醫事機構代碼']} {row['醫事機構種類']}")


def _norm(s: str) -> str:
    return re.sub(r"[\s()（）·・]", "", unicodedata.normalize("NFKC", s or "")).replace("台", "臺")


def _sections(name: str) -> str:
    """「八德路4段」→「八德路四段」"""
    def cn(m):
        n = int(m.group(1))
        return (CN[n] if n <= 10 else "十" + CN[n - 10] if n < 20 else m.group(1)) + "段"
    return re.sub(r"(\d+)段", cn, name)


def _road(addr: str, area: str) -> tuple[str | None, str | None]:
    """地址 → (路名, 路名＋段)；地址要先拿掉縣市與鄉鎮市區"""
    a = _norm(addr)
    for p in (_norm(area),):
        if a.startswith(p):
            a = a[len(p):]
    a = re.sub(r"^[^路街道]{1,6}?[里村]", "", a)  # 村里
    a = re.sub(r"^\d+鄰", "", a)
    m = re.match(r"^(.{1,10}?(?:路|街|大道))(?:(\d+|[一二三四五六七八九十]+)段)?", a)
    if not m:
        return None, None
    base = m.group(1)
    return base, (_sections(base + m.group(2) + "段") if m.group(2) else None)


def _copy(name: str):
    target = OSM / name
    if not target.exists():
        if not (OSM_SRC / name).exists():
            raise RuntimeError(f"沒有 {target}：請把 map-plan 的 data/osm-tw/{name} 複製到這裡")
        OSM.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(OSM_SRC / name, target)
    return target


def _locate(rows: list[dict]) -> Counter:
    """依店名、路段、路名找每一家的位置，寫進 lon、lat、q；回傳各層的家數"""
    import numpy as np
    import shapefile
    from shapely import STRtree, points
    from shapely.geometry import shape
    z = zipfile.ZipFile(TOWN_ZIP)
    shp = next(n for n in z.namelist() if n.upper().startswith("TOWN_MOI") and n.lower().endswith(".shp"))
    reader = shapefile.Reader(shp=z.open(shp), dbf=z.open(shp[:-4] + ".dbf"), shx=z.open(shp[:-4] + ".shx"), encoding="utf-8")
    keys, geoms = [], []
    for sr in reader.iterShapeRecords():
        rec = sr.record.as_dict()
        keys.append((rec["COUNTYNAME"].replace("台", "臺"), rec["TOWNNAME"]))
        geoms.append(shape(sr.shape.__geo_interface__))
    tree = STRtree(geoms)

    def towns_of(lons, lats):
        out = [None] * len(lons)
        if not lons:
            return out
        src, dst = tree.query(points(np.array(lons), np.array(lats)), predicate="intersects")
        for i, j in zip(src, dst):
            out[i] = keys[j]
        return out

    # 1. OSM 的中醫院所
    poi: dict[tuple, list] = defaultdict(list)
    with _copy("tcm-pois.csv").open(encoding="utf-8", newline="") as fh:
        prow = list(csv.DictReader(fh))
    for r, t in zip(prow, towns_of([float(r["lon"]) for r in prow], [float(r["lat"]) for r in prow])):
        if t:
            poi[(*t, _norm(r["name"]))].append((float(r["lon"]), float(r["lat"])))
    # 2、3. 道路：只留地址用得到的路名
    want: set[str] = set()
    for r in rows:
        base, full = _road(r["addr"], r["area"])
        r["_road"] = (base, full)
        want.update(x for x in (base, full) if x)
    road: dict[tuple, list] = defaultdict(list)
    with gzip.open(_copy("roads.csv.gz"), "rt", encoding="utf-8", newline="") as fh:
        rrow = [r for r in csv.DictReader(fh) if r["highway"] not in NOT_ROADS and _sections(_norm(r["name"])) in want]
    for r, t in zip(rrow, towns_of([float(r["lon"]) for r in rrow], [float(r["lat"]) for r in rrow])):
        if t:
            road[(*t, _sections(_norm(r["name"])))].append((float(r["lon"]), float(r["lat"])))
    q = Counter()
    check: dict[int, list[float]] = defaultdict(list)  # 對到 OSM 院所的，路段、路名中間差多遠（公里）
    for r in rows:
        county, town = r["_ct"]
        base, full = r.pop("_road")
        got, level = None, ON_TOWN
        pts = poi.get((county, town, _norm(r["name"])), []) if town else []
        if pts:
            mx, my = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
            if all(math.hypot(p[0] - mx, p[1] - my) < 0.003 for p in pts):
                got, level = (mx, my), ON_POI
        for name, lv in ((full, ON_SECTION), (base, ON_ROAD)):
            if name and town and road.get((county, town, name)):
                pts = road[(county, town, name)]
                mid = (median(p[0] for p in pts), median(p[1] for p in pts))
                if got is None:
                    got, level = mid, lv
                elif level == ON_POI:
                    dx = (mid[0] - got[0]) * 111.32 * math.cos(math.radians(got[1]))
                    check[lv].append(math.hypot(dx, (mid[1] - got[1]) * 110.57))
        if got:
            r["lon"], r["lat"] = round(got[0], 5), round(got[1], 5)
        r["q"] = level
        q[level] += 1
    # 同一個位置有好幾家：依序錯開（約 15 公尺一圈）
    same: dict[tuple, list] = defaultdict(list)
    for r in rows:
        same[(r["lon"], r["lat"])].append(r)
    for group in same.values():
        for i, r in enumerate(group[1:], 1):
            ang, rad = i * 2.39996, 0.00014 * math.sqrt(i)
            r["lon"] = round(r["lon"] + rad * math.cos(ang), 5)
            r["lat"] = round(r["lat"] + rad * math.sin(ang), 5)
    for lv, label in ((ON_SECTION, "路段"), (ON_ROAD, "路名")):
        d = sorted(check[lv])
        if d:
            print(f"  驗證（對到 OSM 院所的 {len(d)} 家，假如改用{label}中間）：差距中位數 {d[len(d) // 2]:.2f} 公里、"
                  f"75% {d[len(d) * 3 // 4]:.2f}、90% {d[len(d) * 9 // 10]:.2f}、最大 {d[-1]:.2f}；1 公里以內 {sum(x <= 1 for x in d) / len(d):.0%}")
    return q


def build() -> None:
    if not SRC.exists():
        raise RuntimeError(f"沒有 {SRC}：請把 map-plan 的 data/nhi-tcm/clinics.csv 複製到這裡")
    OUT.mkdir(parents=True, exist_ok=True)
    div = json.loads((OUT_DIR / "divisions" / "TWN.json").read_text(encoding="utf-8"))
    counties = {u[0]: u for u in div["u1"]}
    towns = defaultdict(list)  # 縣市名稱 → [(鄉鎮市區名稱, u2)]
    for u in div["u2"]:
        towns[counties[u[8]][1]].append((u[1], u))
    today = date.today().strftime("%Y%m%d")
    rows, skipped, unmatched, county_only = [], 0, [], []
    with SRC.open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            if r["終止合約或歇業日期"] and r["終止合約或歇業日期"] < today:
                skipped += 1
                continue
            addr_show = unicodedata.normalize("NFKC", r["地址"])  # 全形數字改半形（顯示用，其他照原樣）
            addr = addr_show.replace("台", "臺").replace(" ", "")
            legacy = False
            for old, new in OLD_COUNTIES.items():  # 2010、2014 年改制前的縣名（「桃園縣桃園市」→ 桃園市桃園區）
                if addr.startswith(old):
                    addr, legacy = new + addr[len(old):], True
            county = next((c for c in towns if addr.startswith(c)), None)
            rest = addr[len(county):] if county else ""
            # 最長的鄉鎮市區名稱優先（「東區」與「東勢區」）；改制前的地址把「市、鎮、鄉」當成「區」再比一次
            cands = sorted(towns.get(county, []), key=lambda x: -len(x[0]))
            town = next((u for name, u in cands if rest.startswith(name)), None)
            if not town and legacy:
                town = next((u for name, u in cands if name.endswith("區") and any(rest.startswith(name[:-1] + x) for x in "市鎮鄉")), None)
            if not town:
                cu = next((u for u in div["u1"] if u[1] == county), None)
                if not cu:
                    unmatched.append(r["地址"])
                    continue
                # 地址沒寫鄉鎮市區（「新竹市西門街…」）：放在縣市的標籤點，鄉鎮市區留白
                county_only.append(r["地址"])
                rows.append({"lon": cu[7][0], "lat": cu[7][1], "iso3": "TWN", "k": _kind(r), "t": cu[0], "name": r["醫事機構名稱"],
                             "addr": addr_show, "area": county, "areaEn": cu[2], "o": COUNTY_ORDER.index(county), "_ct": (county, None)})
                continue
            rows.append({"lon": town[7][0], "lat": town[7][1], "iso3": "TWN", "k": _kind(r), "t": town[0],
                         "name": r["醫事機構名稱"], "addr": addr_show, "area": f"{county}{town[1]}", "areaEn": f"{town[2]}, {counties[town[8]][2]}",
                         "o": COUNTY_ORDER.index(county), "_ct": (county, town[1])})
    if unmatched:
        raise RuntimeError(f"有 {len(unmatched)} 個地址對不到鄉鎮市區：{unmatched[:10]}")
    rows.sort(key=lambda r: (r["o"], r["t"], r["k"], r["name"]))
    q = _locate(rows)
    data = points_file(rows, ["lon", "lat", "iso3", "k", "q", "name", "addr", "area", "areaEn"],
                       {"lon": 0.00001, "lat": 0.00001, "k": 1, "q": 1}, strings=("iso3",))
    data["license"] = "ODbL 1.0（座標，© OpenStreetMap contributors）；名單：政府資料開放授權條款第 1 版（健保署）"
    write_points(OUT / "nhi-clinics.json", data, ("name", "addr", "area", "areaEn"))
    print(f"  位置：OSM 院所 {q[ON_POI]}、路段 {q[ON_SECTION]}、路名 {q[ON_ROAD]}、只到鄉鎮市區 {q[ON_TOWN]}")
    # 各鄉鎮市區的家數（印出來給說明用）
    per: dict[str, Counter] = defaultdict(Counter)
    for r in rows:
        if r["t"].count("-") == 2:  # 只放在縣市標籤點的（沒寫鄉鎮市區）不畫圓，只在清單
            per[r["t"]][r["k"]] += 1
    u2 = {u[0]: u for u in div["u2"]}
    town_rows = [{"lon": u2[t][7][0], "lat": u2[t][7][1], "n": sum(c.values()), "h": c[HOSPITAL] + c[DEPARTMENT], "cl": c[CLINIC],
                  "c": f"{counties[u2[t][8]][1]}{u2[t][1]}", "en": f"{u2[t][2]}, {counties[u2[t][8]][2]}"} for t, c in per.items()]
    town_rows.sort(key=lambda r: -r["n"])
    kinds = Counter(r["k"] for r in rows)
    write_json(OUT / "nhi-clinics-total.json", indicator_file(
        "nhi-clinics", "家", [int(today[:4])], {"TWN": [len(rows)]},
        hints={"TWN": f"中醫醫院 {kinds[HOSPITAL]}、中醫診所 {kinds[CLINIC]}、設有中醫科的醫院 {kinds[DEPARTMENT]}"},
        hintsEn={"TWN": f"{kinds[HOSPITAL]} Chinese medicine hospitals, {kinds[CLINIC]} clinics, {kinds[DEPARTMENT]} hospitals with a Chinese medicine department"},
        license="名單：政府資料開放授權條款第 1 版（衛生福利部中央健康保險署）；座標：ODbL 1.0（© OpenStreetMap contributors）"))
    print(f"  健保特約的中醫院所 {len(rows)} 家（不算已終止合約的 {skipped} 列）：中醫醫院 {kinds[HOSPITAL]}、中醫診所 {kinds[CLINIC]}、"
          f"醫院的中醫科 {kinds[DEPARTMENT]}；地址沒寫鄉鎮市區、放在縣市的 {len(county_only)}：{county_only}")
    print(f"    {len(town_rows)} 個鄉鎮市區有：" + "、".join(f"{r['c']} {r['n']}" for r in town_rows[:12]))
    zero = [f"{counties[u[8]][1]}{u[1]}" for u in div["u2"] if u[0] not in per]
    print(f"    沒有的 {len(zero)} 個：" + "、".join(zero[:30]))
    by_county = Counter()
    for r in rows:
        by_county[r["area"][:3]] += 1
    print("    依縣市：" + "、".join(f"{c} {n}" for c, n in by_county.most_common()))
    print("    中醫醫院：" + "、".join(f"{r['name']}（{r['area']}）" for r in rows if r["k"] == HOSPITAL))
