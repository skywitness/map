"""帝國與疆界的擴充：依日期的殖民地疆界（OpenHistoricalMap，製作手冊第十七批 279，2026-11-03）。

**資料**：OpenHistoricalMap（OHM）的 Overpass（https://overpass-api.openhistoricalmap.org/api/interpreter ，cloud 連得上，
跟 OSM 的 Overpass 不同）。國家層級（boundary=administrative、admin_level=2）共 4,155 個時段，每個時段一個 relation，
有 start_date、end_date（到日）與 start_event、end_event。
**授權**：https://www.openhistoricalmap.org/copyright ：「Except where otherwise noted, OpenHistoricalMap data is dedicated to
the public domain under a Creative Commons CC0 dedication」；例外寫在個別元素的 license=* 標籤（CC BY、CC BY-SA…）。
逐筆檢查：license 沒寫或寫 CC0 的才用，其他的不收（2026-11-03 國家層級只有 CC0-1.0 80 筆、CC0 28 筆，其餘沒寫）。

**範圍**（使用者 2026-11-03 決定：先補 Cliopatria 沒有的殖民地，1800 年以後、依日期，台灣依史實修正）：
- 殖民地類的時段：place 或 border_type 是 colony、protectorate、territory、crown colony、condominium、dominion、occupation、
  mandate，或有 colony_of、dependency_of、protectorate_of、part_of:empire 標籤的；
- 手冊點名的帝國：Empire of Japan、Russian Empire、Ottoman Empire、United States、Qing（它們的海外領地、殖民地多半
  畫在帝國的範圍裡，沒有自己的時段）；
- 結束日期在 1800 年以後（或沒有結束）。
**台灣**：1800 年以後 OHM 的清（到 1895-04-17）、大日本帝國（1895-05-08 到 1945-10-25 含台灣）跟網站的史實一致；
沒有台灣民主國（1895-05-25 到 1895-10-21），依史實補一筆（fx = 1，範圍用 Natural Earth 的台灣本島）。

**畫法**：時間軸是「那一年的 12 月 31 日」：一個時段在 a 年到 b − 1 年的年底存在（不到一年、沒有跨過年底的時段不畫，
左側欄照列）。形狀簡化到約 2 公里。

**輸出**（public/data/topics/empires/）：ohm-borders.json（線檔：每個環一條線，紀錄是時段的名稱、起訖日期與事件、
殖民國的類別 c、OHM 的 relation 編號；同一個時段的環同一組 r）。
"""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request

import opencc
from shapely import wkb
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.ops import polygonize, unary_union

from common import CACHE_DIR, OUT_DIR, USER_AGENT, lines_file, write_json, write_manifest_part

OUT = OUT_DIR / "topics" / "empires"
API = "https://overpass-api.openhistoricalmap.org/api/interpreter"
CACHE = CACHE_DIR / "ohm"
FIRST_YEAR = 1800
COLONIAL = {"colony", "protectorate", "territory", "crown colony", "condominium", "dominion", "occupation", "mandate"}
COLONIAL_KEYS = ("colony_of", "dependency_of", "protectorate_of", "part_of:empire", "part_of:empire_name")
EMPIRES = {"Empire of Japan": "japan", "Russian Empire": "russia", "Ottoman Empire": "ottoman", "United States": "usa", "Qing": "qing"}
CC0 = {"", "cc0", "cc0-1.0", "cc0 1.0"}
# 簡化（度）與最小的塊（平方度）：殖民地 0.03°（約 3 公里）、比 0.01 平方度（約 100 平方公里）小的島不畫；
# 帝國（俄羅斯、美國這種很大、時段又多的）0.08°、0.1 平方度。每個時段至少留最大的一塊（太平洋的小殖民地才不會整個不見）
SIMPLIFY = {False: 0.03, True: 0.08}
MIN_AREA = {False: 0.01, True: 0.1}
# 名稱看得出是殖民地、屬地的（OHM 很多沒有 colony_of、place 標籤，例如荷屬東印度、比屬剛果）
COLONIAL_NAME = re.compile(
    r"\b(Colony|Colonie|Protectorate|Mandate|Territory|Territories|Dominion|Settlements?|Concession|[Oo]ccupation|East Indies|"
    r"West Indies|Raj|Captaincy|Viceroyalty|Presidency)\b"
    r"|^(British|French|Dutch|Spanish|Portuguese|German|Italian|Belgian|Danish|Swedish|Japanese|Russian|US|American) ")
SOVEREIGN_NAME = re.compile(r"\b(Republic|Reich|Empire|Kingdom|Confederation|State)\b")
QUANTUM = 0.01
BATCH = 40

# 線的類別（前端 ohm-borders.ts 的 CLASSES）：殖民地與屬地、帝國的範圍。很多殖民地在 OHM 沒有標殖民國
# （開普殖民地、澳洲各殖民地），不依殖民國上色；有標的（colony_of 等或名稱的形容詞）寫在 tooltip（k，跟殖民帝國指標的
# COLONIZERS 同一組代碼）
COLONY_CLASS = 1
EMPIRE_CLASS = 2
COLONIZER_CODES = [
    (1, ("british", "britain", "united kingdom", "england", "english")),
    (2, ("french", "france")),
    (3, ("spanish", "spain")),
    (4, ("portuguese", "portugal")),
    (5, ("dutch", "netherlands", "holland")),
    (6, ("german", "germany", "belgian", "belgium", "italian", "italy")),
    (7, ("japan", "japanese")),
]
EMPIRE_CODE = 8
OTHER_CODE = 9

# 台灣民主國（OHM 沒有）：依史實補，範圍是台灣本島（Natural Earth）
FORMOSA = {
    "e": "Republic of Formosa", "z": "臺灣民主國", "s": "1895-05-25", "t": "1895-10-21",
    "se": "Proclaimed in Taipei after the Treaty of Shimonoseki", "ee": "Fall of Tainan to Japanese forces",
    "sez": "馬關條約後在臺北成立", "eez": "臺南被日軍占領",
}

_s2t = opencc.OpenCC("s2twp")


def _post(query: str, name: str) -> dict:
    path = CACHE / name
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    CACHE.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        try:
            req = urllib.request.Request(API, data=urllib.parse.urlencode({"data": query}).encode(),
                                         headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=600) as resp:
                data = json.load(resp)
            break
        except Exception as e:  # noqa: BLE001 — Overpass 忙的時候回 429／504，等一下再試
            if attempt == 3:
                raise
            print(f"  Overpass 失敗（{e}），{30 * (attempt + 1)} 秒後重試")
            time.sleep(30 * (attempt + 1))
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def _year(date: str | None) -> int | None:
    m = re.match(r"(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?", date or "")
    return int(m.group(1)) if m else None


def _ymd(date: str | None, end: bool) -> tuple[int, int, int] | None:
    """日期 → (年, 月, 日)；只有年份或年月的，開始取最早、結束取最晚"""
    m = re.match(r"(-?\d{1,4})(?:-(\d{2}))?(?:-(\d{2}))?", date or "")
    if not m:
        return None
    y = int(m.group(1))
    mo = int(m.group(2)) if m.group(2) else (12 if end else 1)
    d = int(m.group(3)) if m.group(3) else (31 if end else 1)
    return y, mo, d


def visible_years(start: str, end: str | None) -> tuple[int, int]:
    """[a, b)：這個時段在哪幾年的 12 月 31 日存在。開始日一定不晚於那一年的年底，所以 a 是開始的年份；
    最後一個在結束日之前的年底是結束年份的前一年（結束在 12-31 當天也是，那天已經不算），所以 b 是結束的年份"""
    s = _ymd(start, False)
    e = _ymd(end, True) if end else None
    return (s[0] if s else FIRST_YEAR), (e[0] if e else 9999)


def _colonizer(tags: dict) -> int:
    name = tags.get("name:en") or tags.get("name") or ""
    if name in EMPIRES:
        return EMPIRE_CODE
    text = " ".join(str(tags.get(k, "")) for k in COLONIAL_KEYS).lower()
    for code, words in COLONIZER_CODES:
        if any(w in text for w in words):
            return code
    first = name.lower()
    for code, words in COLONIZER_CODES:
        if any(re.search(rf"\b{w}\b", first) for w in words):
            return code
    return OTHER_CODE


def _zh(tags: dict) -> str | None:
    for k in ("name:zh-Hant", "name:zh-TW", "name:zh_TW"):
        if tags.get(k):
            return tags[k]
    return _s2t.convert(tags["name:zh"]) if tags.get("name:zh") else None


def select(elements: list[dict]) -> tuple[list[dict], dict]:
    keep, skipped = [], {"license": [], "early": 0}
    for e in elements:
        t = e["tags"]
        name = t.get("name:en") or t.get("name") or ""
        # part_of:empire 也標在宗主國本身（葡萄牙王國），名稱或 border_type 像主權國家的不算
        sovereign = SOVEREIGN_NAME.search(name) is not None or t.get("border_type") in ("kingdom", "empire", "republic", "nation")
        colonial = (t.get("place") in COLONIAL or t.get("border_type") in COLONIAL
                    or any(k in t for k in ("colony_of", "dependency_of", "protectorate_of"))
                    or (any(k in t for k in ("part_of:empire", "part_of:empire_name")) and not sovereign)
                    or (COLONIAL_NAME.search(name) is not None and not sovereign))
        if not colonial and name not in EMPIRES:
            continue
        end = _year(t.get("end_date"))
        if end is not None and end < FIRST_YEAR:
            skipped["early"] += 1
            continue
        lic = (t.get("license") or "").strip().lower()
        if lic not in CC0:
            skipped["license"].append((e["id"], name, t.get("license")))
            continue
        keep.append(e)
    return keep, skipped


def geometry(rel: dict):
    outer = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]]) for m in rel.get("members", [])
             if m["type"] == "way" and m.get("role", "outer") in ("outer", "") and len(m.get("geometry") or []) >= 2]
    inner = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]]) for m in rel.get("members", [])
             if m["type"] == "way" and m.get("role") == "inner" and len(m.get("geometry") or []) >= 2]
    if not outer:
        return None
    polys = list(polygonize(unary_union(outer)))
    if not polys:
        return None
    # 外環互相包住的（例如湖中島被畫成另一個外環）：XOR 合併，偶數層是洞
    geom = polys[0]
    for p in polys[1:]:
        geom = geom.symmetric_difference(p)
    if inner:
        holes = list(polygonize(unary_union(inner)))
        if holes:
            geom = geom.difference(unary_union(holes))
    return geom.buffer(0)


def rings(geom) -> list[tuple[list[tuple[float, float]], bool]]:
    """(座標, 是不是洞)"""
    out = []
    parts = geom.geoms if isinstance(geom, MultiPolygon) else [geom] if isinstance(geom, Polygon) else []
    for poly in parts:
        if poly.is_empty:
            continue
        out.append((list(poly.exterior.coords), False))
        out += [(list(r.coords), True) for r in poly.interiors]
    return out


def _shrink(geom, min_area: float):
    """拿掉比 min_area 小的塊，但留最大的一塊"""
    parts = list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom] if isinstance(geom, Polygon) else []
    parts = [p for p in parts if not p.is_empty]
    if len(parts) <= 1:
        return geom
    biggest = max(parts, key=lambda p: p.area)
    keep = [p for p in parts if p is biggest or p.area >= min_area]
    return MultiPolygon(keep) if len(keep) > 1 else keep[0]


def taiwan_island():
    from topics.empires import ten_m_taiwan_parts  # 帝國與疆界主題的台灣範圍（Natural Earth 1:10m）

    tw = ten_m_taiwan_parts()
    parts = tw.geoms if isinstance(tw, MultiPolygon) else [tw]
    return max(parts, key=lambda p: p.area)


def build() -> None:
    tags = _post('[out:json][timeout:300];relation["boundary"="administrative"]["admin_level"="2"];out tags;', "admin2-tags.json")
    chosen, skipped = select(tags["elements"])
    ids = sorted(e["id"] for e in chosen)
    by_id = {e["id"]: e["tags"] for e in chosen}
    print(f"  OHM 國家層級 {len(tags['elements'])} 個時段，選了 {len(chosen)} 個（{FIRST_YEAR} 年以前結束的 {skipped['early']}，"
          f"授權不是 CC0 的 {len(skipped['license'])}：{skipped['license'][:5]}）")

    # 形狀依 relation 編號快取：之前分批拿過的檔一個一個讀（每個幾十到一百 MB，算完只留簡化後的形狀），
    # 只拿還沒有的，選的範圍改了也不必全部重拿
    records, failed, done = [], [], set()
    # 組好的多邊形另外快取（WKB），改簡化的參數重跑時不必再從幾百 MB 的 Overpass 回應組一次
    shapes_path = CACHE / "shapes.wkb.json"
    shapes: dict[str, str | None] = json.loads(shapes_path.read_text()) if shapes_path.exists() else {}

    def take(elements: list[dict]) -> None:
        for rel in elements:
            t = by_id.get(rel["id"])
            if t is None or rel["id"] in done:
                continue
            done.add(rel["id"])
            if str(rel["id"]) in shapes:
                hexed = shapes[str(rel["id"])]
                geom = wkb.loads(bytes.fromhex(hexed)) if hexed else None
            else:
                geom = geometry(rel)
                shapes[str(rel["id"])] = geom.wkb_hex if geom is not None and not geom.is_empty else None
            if geom is None or geom.is_empty:
                failed.append((rel["id"], t.get("name:en") or t.get("name")))
                continue
            code = _colonizer(t)
            big = code == EMPIRE_CODE
            simple = _shrink(geom.simplify(SIMPLIFY[big], preserve_topology=True), MIN_AREA[big])
            a, b = visible_years(t["start_date"], t.get("end_date"))
            records.append(({
                "e": t.get("name:en") or t.get("name"), "z": _zh(t), "s": t["start_date"], "t": t.get("end_date"),
                "se": t.get("start_event"), "ee": t.get("end_event"), "c": EMPIRE_CLASS if code == EMPIRE_CODE else COLONY_CLASS,
                "k": code if code < EMPIRE_CODE else None, "a": a, "b": b, "o": rel["id"],
            }, simple))

    if all(str(i) in shapes for i in ids):
        take([{"id": i} for i in ids])
    else:
        for path in sorted(CACHE.glob("geom-*.json")):
            try:
                take(json.loads(path.read_text(encoding="utf-8"))["elements"])
            except (json.JSONDecodeError, KeyError):
                print(f"  快取 {path.name} 壞了，不用")
    missing = [i for i in ids if i not in done]
    print(f"  形狀：快取 {len(done)} 個，這次拿 {len(missing)} 個")
    for k in range(0, len(missing), BATCH):
        part = missing[k : k + BATCH]
        take(_post(f"[out:json][timeout:600];relation(id:{','.join(map(str, part))});out geom;", f"geom-{part[0]}-{part[-1]}.json")["elements"])

    shapes_path.write_text(json.dumps(shapes))
    tw = taiwan_island().simplify(SIMPLIFY[False], preserve_topology=True)
    fa, fb = visible_years(FORMOSA["s"], FORMOSA["t"])
    records.append(({"e": FORMOSA["e"], "z": FORMOSA["z"], "s": FORMOSA["s"], "t": FORMOSA["t"], "se": FORMOSA["se"],
                     "ee": FORMOSA["ee"], "c": COLONY_CLASS, "k": None, "a": fa, "b": fb, "o": None, "fx": 1}, tw))

    records.sort(key=lambda r: (r[0]["e"] or "", r[0]["s"]))
    out_lines, out_records = [], []
    for g, (rec, geom) in enumerate(records):
        for coords, hole in rings(geom):
            out_lines.append([(round(x, 4), round(y, 4)) for x, y in coords])
            out_records.append({**rec, "r": g, "h": 1 if hole else None})
    fields = ["e", "z", "s", "t", "se", "ee", "c", "k", "a", "b", "o", "fx", "r", "h"]
    data = lines_file(out_lines, QUANTUM, [r["c"] for r in out_records], record_fields=fields, records=out_records,
                      record_scale={"c": 1, "k": 1, "a": 1, "b": 1, "o": 1, "fx": 1, "r": 1, "h": 1},
                      record_strings=("e", "z", "s", "t", "se", "ee"))
    write_json(OUT / "ohm-borders.json", data)
    write_manifest_part(OUT, "empires", "ohm-borders", {
        "source": "OpenHistoricalMap contributors (Overpass, admin_level=2)", "url": "https://www.openhistoricalmap.org/copyright",
        "license": "CC0 1.0 (elements with other license=* tags are excluded)", "periods": len(records),
        "changes": "simplified to about 2 km; Republic of Formosa (1895) added from historical sources",
    })
    shown = sum(1 for r, _ in records if r["b"] > r["a"])
    by_class = {}
    for r, _ in records:
        by_class[r["c"]] = by_class.get(r["c"], 0) + 1
    print(f"  {len(records)} 個時段（地圖上看得到的 {shown}），{len(out_lines)} 個環；組不成多邊形的 {len(failed)}：{failed[:8]}")
    known = sum(1 for r, _ in records if r.get("k"))
    print(f"  依類別（1 殖民地與屬地、2 帝國）：{dict(sorted(by_class.items()))}；殖民地有標殖民國的 {known}")
    for r, _ in records:
        if r["e"] in ("Empire of Japan", "Qing") or r.get("fx"):
            print(f"    {r['e']} {r['s']} – {r['t']}（年底 {r['a']}–{r['b'] - 1}）{r['ee'] or ''}")


if __name__ == "__main__":
    build()
