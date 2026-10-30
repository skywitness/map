"""最長的直飛航線（新主題，科技與交通類，2026-10-30）：世界最長的 30 條直飛定期航線與停飛的前 30 名，畫成大圓弧。

使用者決定（2026-10-30，製作手冊第九十五節）：照候選清單，現行前 30 名加停飛的前 30 名；直達（中途停靠）的表與未來航線不畫。

**資料**：英文維基百科「Longest flights」固定版本 REVISION（CC BY-SA 4.0，衍生的資料檔依同一授權分享）：
「Non-stop flights (top 30, by great-circle distance)」與「Discontinued non-stop flights (top 30, by great-circle distance)」
兩張表（Rank、From、To、Airline、Flight number、Distance、Scheduled duration、Aircraft、First flight／Final flight），
表裡有 rowspan（同一個機場、航空公司、機型跨好幾列），用 `sources/wikitable.py` 展開。距離是條目寫的大圓距離（{{cvt|…|km}}），
實際飛的距離較長（避開逆風、繞過關閉的空域）；同一城市對、不同航空公司分開算（同名次兩列）。

**機場**：表格的機場是維基條目的連結，用 OurAirports（公有領域）的 wikipedia_link 對到 IATA 代碼與座標；
條目名稱跟 OurAirports 不同的（樟宜機場、桃園機場、已經關閉的啟德機場…）手工對（AIRPORT_LINKS）。
現行表第 30 名 QR 713 的杜哈連到舊的「Doha International Airport」，卡達航空 2014 年起都從哈馬德國際機場（DOH）起降，改成 DOH。
國家依機場的座標（geoindex）。

**輸出**（public/data/topics/aviation/）：routes.json（大圓弧，紀錄：表 t 1 現行／2 停飛、名次、起訖 IATA、航空公司、
班號、距離、表定時間、機型、首航或最後一班的日期）、route-airports.json（起訖機場的點，現行與停飛的航線數）、
routes.json 的國家指標 routes（現行前 30 名有幾條在這國起降）、longest（這國起降最長的一條，km）、discontinued（停飛前 30 名的條數）。
"""
from __future__ import annotations

import csv
import math
import re
import urllib.parse
from collections import Counter, defaultdict

from common import OUT_DIR, download, indicator_file, lines_file, now_iso, points_file, write_json, write_manifest_part
from geoindex import country_at
from sources import wikitable as W

OUT = OUT_DIR / "topics" / "aviation"  # 航空主題（2026-10-30 航空公司、最長的直飛航線、交通的航空指標合併）
PAGE = "Longest flights"
REVISION = 1380354690  # 2026-10-15T06:02:10Z
YEAR = 2026
R = 6371.0088
STEP_KM = 200
CURRENT, DISCONTINUED = 1, 2
AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"
# 維基條目 → IATA（OurAirports 的 wikipedia_link 是別的寫法、連到中文維基、或是城市的條目）
AIRPORT_LINKS = {
    "Auckland Airport": "AKL", "Ben Gurion Airport": "TLV", "Changi Airport": "SIN",
    "Dallas Fort Worth International Airport": "DFW", "Dulles International Airport": "IAD", "Faaʻa International Airport": "PPT",
    "São Paulo/Guarulhos International Airport": "GRU", "Taoyuan International Airport": "TPE", "Zayed International Airport": "AUH",
    "Los Angeles": "LAX", "Kai Tak Airport": "HKG-KT",
    # 條目連到舊的杜哈國際機場，卡達航空 2014 年起在哈馬德國際機場起降
    "Doha International Airport": "DOH",
}
# 已經關閉、OurAirports 沒有 IATA 的機場：(經度, 緯度, 國家)
CLOSED = {"HKG-KT": (114.1942, 22.3283, "HKG")}
# 機場的中文名稱（城市＋機場，跟條目的英文寫法對應）
ZH = {
    "JFK": "紐約甘迺迪", "EWR": "紐瓦克", "SIN": "新加坡", "AKL": "奧克蘭", "DOH": "杜哈", "PER": "伯斯", "LHR": "倫敦希斯洛",
    "DFW": "達拉斯沃斯堡", "MEL": "墨爾本", "CDG": "巴黎戴高樂", "DXB": "杜拜", "SZX": "深圳", "MEX": "墨西哥城",
    "LAX": "洛杉磯", "IAH": "休士頓洲際", "SYD": "雪梨", "MNL": "馬尼拉", "SFO": "舊金山", "JNB": "約翰尼斯堡",
    "ATL": "亞特蘭大", "JED": "吉達", "BNE": "布里斯本", "FCO": "羅馬菲烏米奇諾", "CPT": "開普敦", "HKG": "香港",
    "ADL": "阿得雷德", "SEA": "西雅圖", "PPT": "帕皮提", "BKK": "曼谷蘇凡納布", "DRW": "達爾文", "TLV": "特拉維夫",
    "BOM": "孟買", "AUH": "阿布達比", "HYD": "海德拉巴", "ORD": "芝加哥歐海爾", "IAD": "華盛頓杜勒斯", "PVG": "上海浦東",
    "DTW": "底特律", "FLL": "勞德岱堡", "TPE": "台灣桃園", "HKG-KT": "香港啟德", "DPS": "峇里島登巴薩", "MIA": "邁阿密",
    "LFW": "洛美", "CKG": "重慶", "GRU": "聖保羅瓜魯柳斯", "MSP": "明尼亞波利斯", "YYZ": "多倫多皮爾森", "YVR": "溫哥華",
}


def _airports() -> dict[str, dict]:
    path = download(AIRPORTS_URL, "ourairports", "airports.csv")
    by_link: dict[str, dict] = {}
    by_iata: dict[str, dict] = {}
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if not r["iata_code"] or r["type"] == "closed":
                continue
            a = {"iata": r["iata_code"], "lon": float(r["longitude_deg"]), "lat": float(r["latitude_deg"]), "name": r["name"]}
            # 同一個 IATA 有好幾筆時留大型機場
            if r["iata_code"] not in by_iata or r["type"] == "large_airport":
                by_iata[r["iata_code"]] = a
            link = r["wikipedia_link"]
            if link.startswith("https://en.wikipedia.org/wiki/"):
                by_link[urllib.parse.unquote(link.rsplit("/", 1)[1]).replace("_", " ")] = a
    out = dict(by_link)
    for title, code in AIRPORT_LINKS.items():
        if code in CLOSED:
            lon, lat, _ = CLOSED[code]
            out[title] = {"iata": code, "lon": lon, "lat": lat, "name": title}
        else:
            out[title] = by_iata[code]
    return out


def _date(cell: str) -> str | None:
    if m := re.search(r"\{\{\s*sort\s*\|\s*(\d{4})-(\d{1,2})-(\d{1,2})", cell):
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return None


def _km(cell: str) -> int:
    m = re.search(r"\{\{\s*cvt\s*\|\s*([\d,.]+)\s*\|\s*km", cell)
    return round(float(m.group(1).replace(",", "")))


def _flights(table: str, kind: int, airports: dict[str, dict]) -> list[dict]:
    out = []
    for r in W.rows(table):
        rank, frm, to, airline, number, dist, dur, aircraft, date = r[:9]
        ends = []
        for cell in (frm, to):
            link = W.links(cell)[0]
            ends.append(airports[link])
        out.append({
            "t": kind, "rank": int(W.text(rank)), "a": ends[0]["iata"], "b": ends[1]["iata"],
            "an": W.text(frm), "bn": W.text(to), "airline": W.text(airline), "no": W.text(number),
            "km": _km(dist), "dur": re.sub(r"\s*\|.*", "", W.text(dur)), "ac": W.text(aircraft).replace("\n", ", ").replace(" ,", ","),
            "date": _date(date), "ends": ends,
        })
    return out


def _arc(a: dict, b: dict) -> list[tuple[float, float]]:
    """大圓弧（球面線性內插），經度展開成連續的"""
    p1, l1, p2, l2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    v1 = (math.cos(p1) * math.cos(l1), math.cos(p1) * math.sin(l1), math.sin(p1))
    v2 = (math.cos(p2) * math.cos(l2), math.cos(p2) * math.sin(l2), math.sin(p2))
    omega = math.acos(max(-1.0, min(1.0, sum(x * y for x, y in zip(v1, v2)))))
    n = max(2, math.ceil(omega * R / STEP_KM))
    pts: list[tuple[float, float]] = []
    for i in range(n + 1):
        f = i / n
        s1, s2 = math.sin((1 - f) * omega) / math.sin(omega), math.sin(f * omega) / math.sin(omega)
        x, y, z = (s1 * u + s2 * v for u, v in zip(v1, v2))
        lon, lat = math.degrees(math.atan2(y, x)), math.degrees(math.atan2(z, math.hypot(x, y)))
        if pts:
            lon += 360 * round((pts[-1][0] - lon) / 360)
        pts.append((lon, lat))
    return pts


def build() -> None:
    wikitext = W.fetch(PAGE, REVISION, "longest-flights")
    heads = {m.group(1).strip(): m.end() for m in re.finditer(r"^=+\s*(.*?)\s*=+\s*$", wikitext, re.M)}

    def table_after(title: str) -> str:
        return W.tables(wikitext[heads[title]:])[0]

    airports = _airports()
    flights = _flights(table_after("Non-stop flights (top 30, by great-circle distance)"), CURRENT, airports)
    flights += _flights(table_after("Discontinued non-stop flights (top 30, by great-circle distance)"), DISCONTINUED, airports)

    # 機場的國家依座標
    codes = {e["iata"]: e for f in flights for e in f["ends"]}
    iso: dict[str, str] = {}
    for code, e in codes.items():
        iso[code] = CLOSED[code][2] if code in CLOSED else country_at(e["lon"], e["lat"])
        assert code in ZH, f"機場 {code} 沒有中文名稱"

    lines, records = [], []
    for f in sorted(flights, key=lambda f: (f["t"], -f["km"])):
        lines.append(_arc(*f["ends"]))
        records.append({k: f[k] for k in ("t", "rank", "a", "b", "an", "bn", "airline", "no", "km", "dur", "ac", "date")}
                       | {"ai": iso[f["a"]], "bi": iso[f["b"]]})
    fields = ["t", "rank", "a", "b", "an", "bn", "ai", "bi", "airline", "no", "km", "dur", "ac", "date"]
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "routes.json", lines_file(
        lines, 0.01, types=[r["t"] for r in records], records=records, record_fields=fields,
        record_scale={"t": 1, "rank": 1, "km": 1}, record_strings=("a", "b", "an", "bn", "ai", "bi", "airline", "ac")))

    # 機場的點：現行、停飛的航線數
    n_cur, n_old = Counter(), Counter()
    names: dict[str, str] = {}
    for f in flights:
        for code, name in ((f["a"], f["an"]), (f["b"], f["bn"])):
            (n_cur if f["t"] == CURRENT else n_old)[code] += 1
            names.setdefault(code, name)
    pts = [{"lon": codes[c]["lon"], "lat": codes[c]["lat"], "iata": c.split("-")[0], "en": names[c], "zh": ZH[c], "iso3": iso[c],
            "n": n_cur[c], "d": n_old[c]} for c in codes]
    pts.sort(key=lambda p: p["lon"])
    write_json(OUT / "route-airports.json", points_file(pts, ["lon", "lat", "iata", "en", "zh", "iso3", "n", "d"],
                                                  {"lon": 0.001, "lat": 0.001, "n": 1, "d": 1}, delta=("lon",)))

    # 國家的指標：一條航線兩端在同一國（沒有）算一次
    routes_n: Counter = Counter()
    old_n: Counter = Counter()
    longest: dict[str, int] = {}
    for f in flights:
        for c in {iso[f["a"]], iso[f["b"]]}:
            if f["t"] == CURRENT:
                routes_n[c] += 1
                longest[c] = max(longest.get(c, 0), f["km"])
            else:
                old_n[c] += 1
    from sources import wpp
    every = set(wpp.demographic(["TPopulation1July"])["TPopulation1July"]) - {"WLD"}
    tw_old = [f for f in flights if "TWN" in (iso[f["a"]], iso[f["b"]])]
    tw_note = "現行前 30 名沒有在台灣起降的航線；停飛的前 30 名有長榮航空 BR 32 桃園–紐瓦克（12,552 公里）。"
    tw_note_en = "None of the current top 30 routes serve Taiwan; the discontinued top 30 include EVA Air BR 32 Taoyuan–Newark (12,552 km)."
    notes = {"notes": {"TWN": tw_note}, "notesEn": {"TWN": tw_note_en}}
    write_json(OUT / "routes-count.json", indicator_file("routes-count", "條", [YEAR], {c: [routes_n.get(c, 0)] for c in every}, **notes))
    write_json(OUT / "longest.json", indicator_file("longest", "km", [YEAR], {c: [v] for c, v in longest.items()}, **notes))
    write_json(OUT / "discontinued.json", indicator_file("discontinued", "條", [YEAR], {c: [old_n.get(c, 0)] for c in every}, **notes))
    write_manifest_part(OUT, "aviation", "longest-flights", {"revision": REVISION})

    cur = [f for f in flights if f["t"] == CURRENT]
    old = [f for f in flights if f["t"] == DISCONTINUED]
    print(f"  現行 {len(cur)} 列（第 1 名 {cur[0]['no']} {cur[0]['a']}–{cur[0]['b']} {cur[0]['km']:,} km，最後 {cur[-1]['km']:,} km）；"
          f"停飛 {len(old)} 列（第 1 名 {old[0]['no']} {old[0]['km']:,} km）；機場 {len(codes)} 座")
    print(f"  現行的國家：{routes_n.most_common(10)}")
    print(f"  台灣：{[(f['no'], f['a'], f['b'], f['km']) for f in tw_old]}")


if __name__ == "__main__":
    build()
