"""迪士尼郵輪：母港與船籍、噸位與載客量、私人島（2026-11-08，製作手冊第二十八批 674，候選 1479、1495、1490；
擴充「迪士尼」；步驟 disney-cruise，輸出 topics/disney/）。

使用者 2026-11-08 的決定：「航程」畫不出來（迪士尼官網的條款禁止編成資料庫、OSM 全世界只有 7 個 cruise_port、IMF PortWatch
沒有郵輪船種、Wikidata 8 艘只有 1 艘有 P504），改成**母港點＋船籍線**，加上**噸位與載客數的成長**。

- 船隊：英文維基「Disney Cruise Line」固定版本 1384145065（/wiki/…?oldid=，robots.txt 允許；CC BY-SA 4.0，只引用噸位、
  載客、客房、日期、船廠、港名這類事實）的 Current fleet（8 艘）與 Future fleet（5 艘）兩張表。
- 母港：同一個版本的條目文字（Terminals 一節）：卡納維拉爾港 8 號碼頭 Fantasy、Treasure、Magic，10 號碼頭 Wish；
  大沼澤港 4 號碼頭 Destiny（另一艘季節性）；新加坡 Adventure（2026 年 3 月起全年）；東京 Imagination（2029 年，東方樂園公司
  擁有與營運）。**Dream 與 Wonder 條目沒有寫固定母港**（依季節部署），不猜。
- 船籍：條目寫「All vessels are registered in Nassau, Bahamas, with the exception of the Disney Imagination, which will instead
  be registered in Tokyo」。
- 座標：卡納維拉爾港 8 號碼頭與大沼澤港 4 號碼頭用條目 infobox 的座標；新加坡、東京、拿索用 IMF PortWatch 的港口資料庫
  （順序 579 已下載的快取）；私人島 Castaway Cay 用 Wikidata Q999988。**Lookout Cay at Lighthouse Point 沒有 Wikidata 項目**
  （同名的 Lighthouse Point 有 25 個以上，不能用名稱配），不畫，說明寫原因。
- **未交船的船不給確定的日期**（手冊）：Future fleet 表的「Planned service」照寫成「預定」，母港與船籍未定的寫未定。
"""
from __future__ import annotations

import json
import math
import re

from common import CACHE_DIR, OUT_DIR, indicator_file, lines_file, points_file, write_json
from sources.wikipedia_html import page, tables

OUT = OUT_DIR / "topics" / "disney"
TITLE, REVID = "Disney Cruise Line", 1384145065
SOURCE = f"https://en.wikipedia.org/wiki/Disney_Cruise_Line?oldid={REVID}"
YEAR = 2026

# 港口：代碼 → (中文, 英文, ISO3, 緯度, 經度, 種類) 種類 1 母港、2 未來的母港、3 私人島、4 船籍港
PORTS = {
    "canaveral": ("卡納維拉爾港（8、10 號郵輪碼頭）", "Port Canaveral (cruise terminals 8 and 10)", "USA", 28.413108579754674, -80.62977801554493, 1),
    "everglades": ("大沼澤港（4 號郵輪碼頭）", "Port Everglades (cruise terminal 4)", "USA", 26.09612041113019, -80.12198191441779, 1),
    "singapore": ("新加坡", "Singapore", "SGP", None, None, 1),
    "tokyo": ("東京", "Tokyo", "JPN", None, None, 2),
    "castaway": ("Castaway Cay（私人島）", "Castaway Cay (private island)", "BHS", 26.083306, -77.533350, 3),
    "nassau": ("拿索（船籍登記港）", "Nassau (port of registry)", "BHS", None, None, 4),
}
PORTWATCH_NAME = {"singapore": "Singapore", "tokyo": "Tokyo", "nassau": "Nassau"}
# 船 → 母港（條目 Terminals 一節）；沒有的是條目沒寫固定母港
HOMEPORT = {"Disney Fantasy": "canaveral", "Disney Treasure": "canaveral", "Disney Magic": "canaveral",
            "Disney Wish": "canaveral", "Disney Destiny": "everglades", "Disney Adventure": "singapore",
            "Disney Imagination": "tokyo"}
REGISTRY_EXCEPTION = {"Disney Imagination": "JPN"}
CLASSES = ["Magic", "Dream", "Wish", "Global"]


def _int(text: str) -> int | None:
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


def _year(text: str) -> int | None:
    m = re.search(r"(19|20)\d\d", text)
    return int(m.group(0)) if m else None


def ships() -> list[dict]:
    html = page(TITLE, REVID)
    ts = tables(html)
    current = next(t for t in ts if [c[0] for c in t[0]][:6] == ["Ship", "Class", "Gross tonnage", "Capacity", "Cabins", "Entered service"])
    future = next(t for t in ts if [c[0] for c in t[0]][:5] == ["Ship", "Class", "Capacity", "Cabins", "Planned service"])
    out = []
    prev: list[str] = []
    for row in current[1:]:
        cells = [c[0] for c in row]
        # 合併的儲存格（同一級的船共用船級、載客、船廠）：tables() 已展開；保險起見短的列用上一列補
        if len(cells) < 7 and prev:
            cells = cells + prev[len(cells):]
        prev = cells
        name, cls, gt, cap, cabins, entered, yard = cells[:7]
        out.append({"name": name, "cls": cls, "gt": _int(gt), "cap": _int(cap), "cabins": _int(cabins),
                    "year": _year(entered), "entered": entered, "yard": yard, "future": False})
    for row in future[1:]:
        name, cls, cap, cabins, planned, yard, gt = [c[0] for c in row][:7]
        out.append({"name": name if name != "TBA" else None, "cls": cls if cls != "TBA" else None, "gt": _int(gt),
                    "cap": _int(cap), "cabins": _int(cabins), "year": _year(planned), "entered": planned, "yard": yard,
                    "future": True})
    if len([s for s in out if not s["future"]]) != 8:
        raise ValueError("Disney Cruise Line 的 Current fleet 不是 8 艘，條目可能改了")
    return out


def _port_coords() -> None:
    db = json.loads((CACHE_DIR / "portwatch" / "ports-database.json").read_text(encoding="utf-8"))
    for code, name in PORTWATCH_NAME.items():
        hit = [p for p in db if p["portname"] == name and p["ISO3"] == PORTS[code][2]]
        if len(hit) != 1:
            raise ValueError(f"PortWatch 找不到 {name}（{PORTS[code][2]}）")
        zh, en, iso3, _, _, kind = PORTS[code]
        PORTS[code] = (zh, en, iso3, hit[0]["lat"], hit[0]["lon"], kind)


def _great_circle(a: tuple[float, float], b: tuple[float, float], n: int = 64) -> list[tuple[float, float]]:
    """兩點（經度, 緯度）之間的大圓，經度展開成連續的"""
    (lon1, lat1), (lon2, lat2) = (map(math.radians, a)), (map(math.radians, b))
    p1 = (math.cos(lat1) * math.cos(lon1), math.cos(lat1) * math.sin(lon1), math.sin(lat1))
    p2 = (math.cos(lat2) * math.cos(lon2), math.cos(lat2) * math.sin(lon2), math.sin(lat2))
    omega = math.acos(max(-1.0, min(1.0, sum(x * y for x, y in zip(p1, p2)))))
    pts, prev = [], None
    for i in range(n + 1):
        t = i / n
        s1, s2 = (math.sin((1 - t) * omega) / math.sin(omega), math.sin(t * omega) / math.sin(omega)) if omega else (1 - t, t)
        x, y, z = (s1 * u + s2 * v for u, v in zip(p1, p2))
        lon, lat = math.degrees(math.atan2(y, x)), math.degrees(math.atan2(z, math.hypot(x, y)))
        if prev is not None:
            while lon - prev > 180:
                lon -= 360
            while lon - prev < -180:
                lon += 360
        pts.append((round(lon, 3), round(lat, 3)))
        prev = lon
    return pts


def build() -> None:
    _port_coords()
    fleet = ships()
    # 船籍：條目寫「All vessels are registered in Nassau」，只有 Imagination 例外；還沒命名的兩艘不寫
    for s in fleet:
        s["home"] = HOMEPORT.get(s["name"] or "")
        s["flag"] = REGISTRY_EXCEPTION.get(s["name"] or "") or ("BHS" if s["name"] else None)

    # 船的紀錄（清單用）：點放在母港，沒有固定母港的放拿索（船籍港）
    port_index = {k: i + 1 for i, k in enumerate(PORTS)}
    rows = []
    for s in fleet:
        where = s["home"] or ("tokyo" if s["flag"] == "JPN" else "nassau")
        _, _, iso3, lat, lon, _ = PORTS[where]
        rows.append({"lon": lon, "lat": lat, "name": s["name"], "cls": CLASSES.index(s["cls"]) + 1 if s["cls"] in CLASSES else 0,
                     "gt": s["gt"], "cap": s["cap"], "cabins": s["cabins"], "y": s["year"], "yard": s["yard"],
                     "home": port_index[s["home"]] if s["home"] else 0, "flag": s["flag"], "fut": 1 if s["future"] else 0,
                     "iso3": PORTS[s["home"]][2] if s["home"] else None})
    write_json(OUT / "cruise-ships.json", points_file(
        rows, ["lon", "lat", "name", "cls", "gt", "cap", "cabins", "y", "yard", "home", "flag", "fut", "iso3"],
        {"lon": 0.001, "lat": 0.001, "cls": 1, "gt": 1, "cap": 1, "cabins": 1, "y": 1, "home": 1, "fut": 1}))

    # 港口的點：母港的大小是現役船的總噸位
    ports = []
    for code, (zh, en, iso3, lat, lon, kind) in PORTS.items():
        here = [s for s in fleet if s["home"] == code and not s["future"]]
        ports.append({"lon": lon, "lat": lat, "zh": zh, "en": en, "iso3": iso3, "kind": kind,
                      "ships": len(here) or None, "gt": sum(s["gt"] for s in here) or None,
                      "cap": sum(s["cap"] for s in here) or None,
                      "names": ", ".join(s["name"] for s in here) or None})
    write_json(OUT / "cruise-ports.json", points_file(
        ports, ["lon", "lat", "zh", "en", "iso3", "kind", "ships", "gt", "cap", "names"],
        {"lon": 0.001, "lat": 0.001, "kind": 1, "ships": 1, "gt": 1, "cap": 1}))

    # 船籍線：母港 → 船籍港（拿索），一個母港一條，紀錄是這個母港的現役船數
    lines, recs = [], []
    nassau = (PORTS["nassau"][4], PORTS["nassau"][3])
    for code in ("canaveral", "everglades", "singapore"):
        _, en, _, lat, lon, _ = PORTS[code]
        here = [s for s in fleet if s["home"] == code and not s["future"]]
        lines.append(_great_circle((lon, lat), nassau))
        recs.append({"from": port_index[code], "ships": len(here)})
    write_json(OUT / "cruise-lines.json", lines_file(lines, 0.01, records=recs, record_fields=["from", "ships"],
                                                     record_scale={"from": 1, "ships": 1}))

    # 國家的值：子項目 homeport（以這國為母港的現役船）、flag（掛這國旗的現役船）
    active = [s for s in fleet if not s["future"]]
    by_home: dict[str, list[dict]] = {}
    for s in active:
        if s["home"]:
            by_home.setdefault(PORTS[s["home"]][2], []).append(s)
    lic = "英文維基百科 Disney Cruise Line（CC BY-SA 4.0）"
    no_home = [s["name"] for s in active if not s["home"]]
    home_vals = {c: [len(v)] for c, v in sorted(by_home.items())}
    home_hints = {c: "、".join(f"{s['name']}（{s['gt']:,} 總噸）" for s in v) for c, v in by_home.items()}
    home_hints_en = {c: ", ".join(f"{s['name']} ({s['gt']:,} GT)" for s in v) for c, v in by_home.items()}
    no_value = {"BHS": "8 艘全部登記在拿索（船籍），但不是母港；私人島 Castaway Cay、Lookout Cay 也在巴哈馬",
                "JPN": "Disney Imagination 預定 2029 年以東京為母港（東方樂園公司擁有與營運）",
                "TWN": "迪士尼郵輪沒有以台灣為母港，英文維基的條目裡也沒有停靠台灣的港口；亞洲唯一的常駐母港是新加坡（2026 年 3 月起）"}
    no_value_en = {"BHS": "All 8 ships are registered in Nassau (flag) but none is based there; the private islands Castaway Cay and Lookout Cay are also in the Bahamas",
                   "JPN": "Disney Imagination is due to be based in Tokyo from 2029 (owned and operated by Oriental Land)",
                   "TWN": "No Disney ship is based in Taiwan, and the Wikipedia article lists no Taiwanese port; the only Asian base is Singapore (from March 2026)"}
    write_json(OUT / "cruise" / "homeport.json", indicator_file(
        "cruise-homeport", "艘", [YEAR], home_vals, hints=home_hints, hintsEn=home_hints_en,
        noValue=no_value, noValueEn=no_value_en, license=lic))
    flags: dict[str, int] = {}
    for s in active:
        flags[s["flag"]] = flags.get(s["flag"], 0) + 1
    write_json(OUT / "cruise" / "flag.json", indicator_file(
        "cruise-flag", "艘", [YEAR], {c: [n] for c, n in flags.items()},
        hints={"BHS": "現役 8 艘全部登記在拿索；2029 年的 Disney Imagination 會登記在東京"},
        hintsEn={"BHS": "All 8 ships in service are registered in Nassau; Disney Imagination (2029) will be registered in Tokyo"},
        noValue={"JPN": "Disney Imagination 預定 2029 年登記在東京", "USA": "母港在美國，但船籍都在巴哈馬"},
        noValueEn={"JPN": "Disney Imagination is due to be registered in Tokyo in 2029", "USA": "Ships are based in the US but flagged in the Bahamas"},
        license=lic))
    print(f"  迪士尼郵輪：現役 {len(active)} 艘、將交 {len(fleet) - len(active)} 艘；母港 {home_vals}；沒有固定母港 {no_home}；船籍 {flags}")
    for s in fleet:
        print(f"    {s['name']}｜{s['cls']}｜{s['gt']}｜{s['cap']}｜{s['cabins']}｜{s['entered']}｜{s['yard']}｜{s['home']}｜{s['flag']}")
