"""原產地名稱：各國有幾個受保護的地理標示（新主題，2026-11-07，製作手冊第二十四批 430；步驟 origin-names，
輸出 topics/origin-names/）。

- **歐盟 eAmbrosia**：地理標示登記簿的全部名稱（食品、葡萄酒、烈酒；加味酒已轉進食品的制度）。網頁沒有批次下載，
  使用者 2026-11-05 用瀏覽器按「Export to Excel」，存在 map-plan 的 data/eambrosia/（README 有 SHA-256 與欄位說明），
  重跑前複製到 .cache/eambrosia/。授權：歐盟執委會網站的法律聲明，CC BY 4.0（名稱與標誌本身是工業財產權，不在授權裡；
  這裡只把名稱當事實列出、數件數，不用標誌）。
  - 只算 Status = Registered（3,730 個）；好幾國共有的名稱（「Croatia, Slovenia」這類 13 種寫法）每國各算一次。
  - 歐盟以外的國家（中國 110 個、英國、土耳其、泰國…）是依雙邊協定或直接申請登記在歐盟的，不是那個國家自己的全部。
  - `Date of registration` 有很多是 1973-09-18（歐盟建制前就有的葡萄酒產區一律寫這一天），不做時間軸。
- **台灣**：經濟部智慧財產局「臺灣產地標章註冊資訊」（data.gov.tw 59715，tiponet.tipo.gov.tw 的 CSV；robots.txt 轉址到
  首頁，等於沒有），政府資料開放授權條款第 1 版。132 件：國內的證明標章、團體商標 78 件，國外在台灣註冊的 54 件。
  台灣的制度是商標法下的證明標章與團體商標，跟歐盟的專屬登記制度不同，件數不能直接比。
  - 國內的依商標權人（鄉鎮公所、農會、縣市政府）找鄉鎮的位置畫點（鄉鎮的座標用節慶主題已經快取的 Wikidata 鄉鎮清單，
    舊縣市名稱改成升格後的：臺中縣→臺中市、臺北縣→新北市…；縣市政府畫在那個縣市所有鄉鎮的平均位置）。
  - 國外的依商標權人的國別（日商、義大利商、大陸地區…）算「在台灣註冊的產地標章」各國有幾件。
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, points_file, write_json, write_manifest_part, write_points
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "origin-names"
YEAR = 2026
XLSX = CACHE_DIR / "eambrosia" / "extracteambrosia-gi.xlsx"
XLSX_SHA = "1ce05e37dfad450a558c69a0ae727794431b193c309671dd7e321813a8d7b72a"
TIPO = "https://tiponet.tipo.gov.tw/datagov/tm/119-106-001.csv"
TOWNS = CACHE_DIR / "wikidata" / "taiwan-towns.json"
COUNTRY_FIX = {"United Kingdom (Northern Ireland)": "GBR"}
TYPES = {"Food": "food", "Wine": "wine", "Spirit drink": "spirits"}
# 國外商標權人的國別（名稱開頭）
FOREIGN = [("日商", "JPN"), ("日本", "JPN"), ("義大利商", "ITA"), ("大陸地區", "CHN"), ("大陸商", "CHN"), ("印度商", "IND"),
           ("斯里蘭卡商", "LKA"), ("越南商", "VNM"), ("美商", "USA"), ("英商", "GBR"), ("愛爾蘭商", "IRL"), ("南韓", "KOR"),
           ("法商", "FRA"), ("韓商", "KOR")]
# 舊縣市 → 升格後的直轄市（鄉、鎮、縣轄市改成區）
OLD_COUNTY = {"臺中縣": "臺中市", "臺北縣": "新北市", "桃園縣": "桃園市", "臺南縣": "臺南市", "高雄縣": "高雄市"}
# 商品種類 → 點的種類（src/topics/origin-names.ts 的 PRODUCTS）
PRODUCTS = {"米": 1, "茶": 2, "水果": 3, "咖啡": 4, "酒": 5, "畜產品、水產品及加工品": 6, "其他農產品及加工品": 7, "工藝品及其他": 8}


def _eambrosia() -> list[dict]:
    from openpyxl import load_workbook

    if not XLSX.exists():
        raise RuntimeError(f"沒有 {XLSX}：請把 map-plan 的 data/eambrosia/extracteambrosia-gi.xlsx 複製到這裡")
    if hashlib.sha256(XLSX.read_bytes()).hexdigest() != XLSX_SHA:
        raise RuntimeError(f"{XLSX} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改 XLSX_SHA")
    rows = list(load_workbook(XLSX, read_only=True).active.iter_rows(values_only=True))
    head = rows[0]
    return [dict(zip(head, r)) for r in rows[1:] if r[0] and r[1]]  # 最後一列是匯出時間


def _towns() -> tuple[dict[str, list[tuple[str, tuple[float, float]]]], dict[str, list[tuple[float, float]]]]:
    """鄉鎮名稱 → [(縣市, 座標)]，縣市 → 所有鄉鎮的座標"""
    if not TOWNS.exists():
        raise RuntimeError(f"沒有 {TOWNS}：要先跑節慶主題（festivals）建好台灣鄉鎮的快取")
    by_town: dict[str, list] = defaultdict(list)
    by_county: dict[str, list] = defaultdict(list)
    for r in json.loads(TOWNS.read_text(encoding="utf-8")):
        m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", r["coord"]["value"])
        if not m:
            continue
        p = (float(m.group(1)), float(m.group(2)))
        county = OLD_COUNTY.get(r["county"]["value"].replace("台", "臺"), r["county"]["value"].replace("台", "臺"))
        town = r["label"]["value"]
        by_town[town].append((county, p))
        by_county[county].append(p)
    return by_town, by_county


def _locate(holder: str, by_town, by_county) -> tuple[tuple[float, float], str] | None:
    """商標權人 → (座標, 地名)；兩個機關共有的（「臺北縣政府　臺北市政府」）取兩地的平均、地名都寫"""
    parts = [p.strip() for p in holder.split("　") if p.strip()]
    if len(parts) > 1:
        locs = [_locate(p, by_town, by_county) for p in parts]
        if not all(locs):
            return None
        return ((round(sum(x[0][0] for x in locs) / len(locs), 4), round(sum(x[0][1] for x in locs) / len(locs), 4)),
                "、".join(x[1] for x in locs))
    h = holder.replace("台", "臺").strip()
    m = re.match(r"^(\S{2}[縣市])?(\S{1,3}?)(鄉|鎮|市|區|地區)(公所|農會|區農會)", h)
    if m and m.group(2):
        county = OLD_COUNTY.get(m.group(1) or "", m.group(1) or "")
        base = m.group(2)
        for suffix in ([m.group(3)] if m.group(3) != "地區" else []) + ["鄉", "鎮", "市", "區"]:
            cands = by_town.get(base + suffix, [])
            hit = [c for c in cands if c[0] == county] if county else cands
            if len(hit) >= 1 and (county or len({c[0] for c in cands}) == 1):
                return hit[0][1], (county or hit[0][0]) + base + suffix
    m = re.match(r"^(\S{2}[縣市])(政府|農會|政府產業發展局)", h)
    if m:
        county = OLD_COUNTY.get(m.group(1), m.group(1))
        pts = by_county.get(county)
        if pts:
            return (round(sum(p[0] for p in pts) / len(pts), 4), round(sum(p[1] for p in pts) / len(pts), 4)), county
    return None


def build() -> None:
    # ── 歐盟 ──
    regs = [d for d in _eambrosia() if d["Status"] == "Registered"]
    count: dict[str, Counter] = defaultdict(Counter)
    for d in regs:
        kind = TYPES[d["Product type"]]
        for name in str(d["Country"]).split(", "):
            iso3 = COUNTRY_FIX.get(name.strip()) or from_name(name.strip())
            if not iso3:
                raise RuntimeError(f"eAmbrosia：認不得國名 {name!r}")
            count[iso3][kind] += 1
            count[iso3]["total"] += 1
            count[iso3][d["Type"].split("(")[-1].rstrip(")")] += 1
    hints = {c: f"食品 {n['food']}、葡萄酒 {n['wine']}、烈酒 {n['spirits']}；PDO {n['PDO']}、PGI {n['PGI']}" + (f"、GI {n['GI']}" if n["GI"] else "")
             for c, n in count.items()}
    hints_en = {c: f"Food {n['food']}, wine {n['wine']}, spirits {n['spirits']}; PDO {n['PDO']}, PGI {n['PGI']}" + (f", GI {n['GI']}" if n["GI"] else "")
                for c, n in count.items()}

    # ── 台灣 ──
    raw = download(TIPO, "tipo", "origin-marks.csv").read_bytes().decode("utf-8-sig")
    marks = list(csv.DictReader(raw.splitlines()))
    by_town, by_county = _towns()
    points, unplaced = [], []
    foreign: Counter = Counter()
    foreign_kinds: dict[str, Counter] = defaultdict(Counter)
    for r in marks:
        holder = r["商標權人"].strip()
        product = r["商品種類"].strip()
        if product not in PRODUCTS:
            raise RuntimeError(f"產地標章：認不得商品種類 {product!r}，要加進 PRODUCTS")
        if r["國內外註冊種類"].startswith("國外"):
            iso3 = next((c for p, c in FOREIGN if holder.startswith(p)), None)
            if not iso3:
                raise RuntimeError(f"產地標章：認不得國外商標權人的國別 {holder!r}，要加進 FOREIGN")
            foreign[iso3] += 1
            foreign_kinds[iso3][product] += 1
            continue
        loc = _locate(holder, by_town, by_county)
        if not loc:
            unplaced.append(holder)
            continue
        (lon, lat), place = loc
        points.append({"lon": round(lon, 4), "lat": round(lat, 4), "k": PRODUCTS[product],
                       "c": 1 if "證明" in r["國內外註冊種類"] else 2, "y": int(r["專用期間起日"][:4]),
                       "h": holder, "p": place, "no": r["註冊號"].strip(), "u": r["商標圖樣"].strip()})
    if unplaced:
        raise RuntimeError(f"產地標章：找不到位置的商標權人 {unplaced}")
    points.sort(key=lambda p: (p["y"], p["no"]))
    data = points_file(points, ["lon", "lat", "k", "c", "y", "h", "p", "no", "u"], {"lon": 0.0001, "lat": 0.0001, "k": 1, "c": 1, "y": 1})
    write_points(OUT / "taiwan-marks.json", data, text=("h", "p", "no", "u"))
    domestic = len(points)

    # 指標：歐盟登記的件數（全部、食品、葡萄酒、烈酒）；台灣不在歐盟的登記簿裡，寫原因
    tw_zh = "沒有在歐盟登記（台灣的產地標章是地圖上的點）"
    tw_en = "None in the EU register (Taiwan’s origin marks are the dots)"
    for ind, key in (("eu-gi", "total"), ("eu-gi-food", "food"), ("eu-gi-wine", "wine"), ("eu-gi-spirits", "spirits")):
        values = {c: [n[key]] for c, n in sorted(count.items()) if n[key]}
        write_json(OUT / f"{ind}.json", indicator_file(
            ind, "個", [YEAR], values, hints=dict(sorted(hints.items())), hintsEn=dict(sorted(hints_en.items())),
            noValue={"TWN": tw_zh}, noValueEn={"TWN": tw_en}, license="CC BY 4.0"))
    # 在台灣註冊的產地標章（國外的依原產國；台灣是國內的件數）
    names = {v: k for k, v in PRODUCTS.items()}
    f_hints = {c: "、".join(f"{p} {n}" for p, n in k.most_common()) for c, k in foreign_kinds.items()}
    tw_kinds = Counter(names[p["k"]] for p in points)
    f_hints["TWN"] = "國內的證明標章與團體商標：" + "、".join(f"{p} {n}" for p, n in tw_kinds.most_common())
    write_json(OUT / "taiwan-registered.json", indicator_file(
        "taiwan-registered", "件", [YEAR], {**{c: [n] for c, n in sorted(foreign.items())}, "TWN": [domestic]},
        hints=dict(sorted(f_hints.items())), license="政府資料開放授權條款第 1 版"))
    write_manifest_part(OUT, "origin-names", "origin-names", {
        "sources": ["European Commission, eAmbrosia (CC BY 4.0)", "經濟部智慧財產局 臺灣產地標章註冊資訊 data.gov.tw 59715（政府資料開放授權條款第 1 版）"]})

    total = Counter({c: n["total"] for c, n in count.items()})
    types = Counter(TYPES[d["Product type"]] for d in regs)
    print(f"  eAmbrosia 已登記 {len(regs)} 個（{dict(types)}），{len(count)} 國；最多 {total.most_common(16)}")
    for key in ("food", "wine", "spirits"):
        print(f"    {key}：{Counter({c: n[key] for c, n in count.items() if n[key]}).most_common(8)}")
    print(f"  台灣產地標章 {len(marks)} 件：國內 {domestic}（{Counter(p['c'] for p in points)}）、國外 {sum(foreign.values())}（{foreign.most_common()}）")
    print(f"    國內 {tw_kinds.most_common()}；最早 {[(p['y'], p['h']) for p in points[:3]]}；最新 {points[-1]['y']}")
    print(f"    位置：{Counter(p['p'] for p in points).most_common(8)}")
