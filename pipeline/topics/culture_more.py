"""文化主題的擴充（2026-11-08，製作手冊第二十七批 661、662；步驟 culture-more 與 cinemas-osm，輸出 topics/culture/）。

662（候選 1450、1457、1458、1459；步驟 culture-more）：
- 文化產業的營業額：Eurostat `cult_ent_val` 的 V12110（營業額，百萬歐元），各國最近一年（多半 2020）：J59 影視與音樂製作、
  J60 廣播、J58.11 書籍出版、J58.13 報紙、J58.14 期刊、G47.61 書店零售、G47.63 影音零售。遊戲出版 J58.21 在「遊戲與電競」。
- 文化與創意工作者：Eurostat `cult_emp_art`（創作與表演藝術家、作家、記者與語言工作者，千人），2011–2025。
- 文化就業的七個領域：UNESCO UIS 的 CE.RA.OCCDOMAIN1.1–1.7（占文化職業就業的 %），2010–2016，CC BY-SA 4.0。
661（候選 1448；同一步驟）：去電影院與看現場表演的比例：Eurostat EU-SILC `ilc_scp03` 的 AC521、AC522A（16 歲以上、
  過去 12 個月至少一次），2006、2015、2022 三波，各國最近一波（latestWithin）。
Eurostat 是 CC BY 4.0（英國、科索沃由 sources/eurostat.py 統一排除），只有歐洲；台灣沒有可比的資料，營業額的台灣 noValue 放文化部
「文創產業家數與營業額統計資訊」（data.gov.tw 103019，本機 session 下載到 map-plan 的 data/moc/）最近一年的細類營業額對照。
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import re
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, download, indicator_file, points_file, write_json, write_points
from sources import eurostat, osm_qlever
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "culture"
INDUSTRIES = {"film-music": "J59", "broadcasting": "J60", "books": "J5811", "newspapers": "J5813", "magazines": "J5814",
              "bookshops": "G4761", "music-video-retail": "G4763"}
DOMAINS = {f"d{i}": f"CE.RA.OCCDOMAIN1.{i}.OV.CULOCC1.1" for i in range(1, 8)}
UIS = "https://api.uis.unesco.org/api/public/data/indicators?indicator={}"


def _latest(raw: dict[str, dict[int, float]]) -> tuple[int, dict, dict, dict]:
    latest = {k: (max(s), s[max(s)]) for k, s in raw.items() if s}
    last = max(y for y, _ in latest.values())
    values = {k: [round(v, 1)] for k, (y, v) in sorted(latest.items())}
    hints = {k: f"{y} 年的數字" for k, (y, _) in latest.items() if y != last}
    return last, values, hints, {k: f"Figure for {y}" for k, (y, _) in latest.items() if y != last}


MOC_CREATIVE = CACHE_DIR / "moc" / "moc-creative-industries-2008-2023.csv"
MOC_CREATIVE_SHA = "e3b79a1c3a89b193bf21d2cb108708df0a46afdce700649165a90c98ec9849a2"
# 台灣對照：文化部「文創產業家數與營業額統計資訊」（data.gov.tw 103019，政府資料開放授權條款第 1 版）最近一年的細類營業額。
# 分類跟 NACE 不同、單位是新台幣，只放在台灣的 noValue，不上色。
TW_SUB = {"film-music": (("電影片製作", "電影片製作"), ("流行音樂發行", "流行音樂發行")),
          "broadcasting": (("無線電視頻道經營", "無線電視"), ("衛星電視頻道經營", "衛星電視"), ("廣播電台經營", "廣播電台")),
          "books": (("實體書籍出版", "實體書"), ("數位書籍出版", "數位書")),
          "newspapers": (("實體新聞出版", "實體報紙"), ("數位新聞出版", "數位新聞")),
          "magazines": (("實體雜誌及期刊出版", "實體雜誌"), ("數位雜誌及期刊出版", "數位雜誌")),
          "bookshops": (("書籍、雜誌零售", "書籍雜誌零售"),),
          "music-video-retail": (("音樂光碟、影片光碟零售", "音樂與影片光碟零售"),)}
TW_SUB_EN = {"電影片製作": "film production", "流行音樂發行": "music publishing", "無線電視": "terrestrial TV", "衛星電視": "satellite TV",
             "廣播電台": "radio", "實體書": "print books", "數位書": "digital books", "實體報紙": "print newspapers",
             "數位新聞": "digital news", "實體雜誌": "print magazines", "數位雜誌": "digital magazines",
             "書籍雜誌零售": "book and magazine retail", "音樂與影片光碟零售": "music and video disc retail"}


def _tw_creative() -> tuple[int, dict[str, float]]:
    if not MOC_CREATIVE.exists():
        raise RuntimeError(f"沒有 {MOC_CREATIVE}：請把 map-plan 的 data/moc/{MOC_CREATIVE.name} 複製到這裡")
    if hashlib.sha256(MOC_CREATIVE.read_bytes()).hexdigest() != MOC_CREATIVE_SHA:
        raise RuntimeError(f"{MOC_CREATIVE} 的 SHA-256 跟 map-plan 的 README 不一樣，先看過再改")
    rows = [r for r in csv.DictReader(io.StringIO(MOC_CREATIVE.read_text(encoding="utf-8-sig"))) if r["年"].strip()]
    year = max(int(r["年"]) for r in rows)
    out: dict[str, float] = defaultdict(float)
    for r in rows:
        if int(r["年"]) == year:
            out[r["細類"].strip()] += float(r["營業額_千元"].replace(",", "") or 0)
    return year, out


def industries() -> None:
    tw_year, tw = _tw_creative()
    for item, nace in INDUSTRIES.items():
        raw = eurostat.series("cult_ent_val", indic_sb="V12110", unit="MIO_EUR", nace_r2=nace)
        last, values, hints, hints_en = _latest(raw)
        parts = [(short, tw[sub] / 1e5) for sub, short in TW_SUB[item] if tw.get(sub)]
        nv = {"TWN": f"台灣不在 Eurostat；文化部 {tw_year} 年" + "、".join(f"{s} {v:,.1f} 億元" for s, v in parts) + "（分類不同）"}
        nv_en = {"TWN": f"Taiwan is not in Eurostat; Ministry of Culture, {tw_year}: " + ", ".join(f"{TW_SUB_EN[s]} NT${v / 10:,.2f} billion" for s, v in parts)
                 + " (different classification)"}
        write_json(OUT / "industry" / f"{item}.json", indicator_file(f"industry-{item}", "百萬歐元", [last], values, hints=hints,
                                                                     hintsEn=hints_en, noValue=nv, noValueEn=nv_en, license="CC BY 4.0"))
        print(f"    台灣：{nv['TWN']}")
        ranked = sorted(((v[0], k) for k, v in values.items()), reverse=True)
        print(f"  營業額 {nace}（{item}）：{len(values)} 國；{ranked[:8]}")


def artists() -> None:
    raw = eurostat.series("cult_emp_art", unit="THS_PER")
    years = sorted({y for s in raw.values() for y in s})
    values = {k: [round(s[y], 1) if y in s else None for y in years] for k, s in sorted(raw.items())}
    write_json(OUT / "artists.json", indicator_file("artists", "千人", years, values, latestWithin=3, license="CC BY 4.0"))
    last = years[-1]
    ranked = sorted(((s[last], k) for k, s in raw.items() if last in s), reverse=True)
    print(f"  文化與創意工作者（cult_emp_art）：{years[0]}–{last}；{last} 年 {len(ranked)} 國 {ranked[:10]}")


def domains() -> None:
    for item, code in DOMAINS.items():
        data = json.loads(download(UIS.format(code), "uis", f"{code}.json").read_text(encoding="utf-8"))
        series: dict[str, dict[int, float]] = {}
        for r in data["records"]:
            iso3 = to_iso3(r["geoUnit"])
            if iso3 and r["value"] is not None:
                series.setdefault(iso3, {})[int(r["year"])] = float(r["value"])
        years = list(range(2010, 2017))
        values = {k: [round(s[y], 1) if y in s else None for y in years] for k, s in sorted(series.items()) if any(y in s for y in years)}
        write_json(OUT / "domains" / f"{item}.json", indicator_file(f"domains-{item}", "%", years, values, latestWithin=6,
                                                                    license="CC BY-SA 4.0", noValue={"TWN": "UIS 不收台灣"},
                                                                    noValueEn={"TWN": "UIS does not cover Taiwan"}))
        latest = {k: s[max(s)] for k, s in series.items() if s}
        ranked = sorted(((round(v, 1), k) for k, v in latest.items()), reverse=True)
        print(f"  文化就業領域 {item}（{code}）：{len(values)} 國；最高 {ranked[:6]}；最低 {ranked[-4:]}")


MOC_RATES = CACHE_DIR / "moc" / "moc-participation-rates-2013-2024.csv"
MOC_RATES_SHA = "f0c368d2053cd366db3447662737969fb9d86b9567a60191ff9ce28da3af6f4b"
TW_RATE = {"cinema": ("文化參與率-電影實體參與率(%)", "去電影院", "went to the cinema"),
           "live": ("文化參與率-表演藝術活動整體(含流行音樂)(%)", "看表演藝術（含流行音樂）", "attended performing arts incl. pop music")}


def _tw_rates() -> dict[str, tuple[int, float]]:
    """文化部文化統計網的文化參與率（本機 session 從指標頁抽出的 CSV，map-plan 的 data/moc/）：指標頁的 2024 年是 2024/2025 年的調查。
    問法、年齡跟 EU-SILC 不同，只放在台灣的 noValue。"""
    if not MOC_RATES.exists():
        raise RuntimeError(f"沒有 {MOC_RATES}：請把 map-plan 的 data/moc/{MOC_RATES.name} 複製到這裡")
    if hashlib.sha256(MOC_RATES.read_bytes()).hexdigest() != MOC_RATES_SHA:
        raise RuntimeError(f"{MOC_RATES} 的 SHA-256 跟 map-plan 的 README 不一樣，先看過再改")
    rows = {r["指標"]: r for r in csv.DictReader(io.StringIO(MOC_RATES.read_text(encoding="utf-8")))}
    out = {}
    for item, (name, _, _) in TW_RATE.items():
        y = max(int(k) for k, v in rows[name].items() if k.isdigit() and v.strip())
        out[item] = (y, float(rows[name][str(y)]))
    return out


def participation() -> None:
    tw = _tw_rates()
    for item, act in (("cinema", "AC521"), ("live", "AC522A")):
        raw = eurostat.series("ilc_scp03", frequenc="GE1", acl00=act, isced11="TOTAL", age="Y_GE16", sex="T", unit="PC")
        years = sorted({y for s in raw.values() for y in s})
        values = {k: [round(s[y], 1) if y in s else None for y in years] for k, s in sorted(raw.items())}
        y, v = tw[item]
        _, zh, en = TW_RATE[item]
        nv = {"TWN": f"台灣不在 EU-SILC；文化部調查 {y}/{y + 1} 年{zh} {v:.1f}%（問法不同）"}
        nv_en = {"TWN": f"Taiwan is not in EU-SILC; Ministry of Culture survey {y}/{y + 1}: {v:.1f}% {en} (different survey)"}
        write_json(OUT / f"attend-{item}.json", indicator_file(f"attend-{item}", "%", years, values, latestWithin=8, noValue=nv,
                                                               noValueEn=nv_en, license="CC BY 4.0"))
        print(f"    台灣：{nv['TWN']}")
        latest = {k: (max(s), s[max(s)]) for k, s in raw.items() if s}
        ranked = sorted(((round(v, 1), k, y) for k, (y, v) in latest.items()), reverse=True)
        print(f"  去{item}（{act}）：{years}；{len(values)} 國；最高 {ranked[:8]}；最低 {ranked[-5:]}")


def build() -> None:
    industries()
    artists()
    domains()
    participation()


# ---- 661（候選 1447；步驟 cinemas-osm）：電影院的點圖層 ----
MOC_CINEMAS = CACHE_DIR / "moc" / "bamid-cinemas-2025.csv"
MOC_SHA = "76c3d97668df3a00a6c6e631817e1b394aba2ad5dbec605433aa09a32f8582d5"
NOISE = re.compile(r"(股份有限公司|有限公司|分公司|數位|豪華|電影藝術館|電影院|電影城|電影館|影城|大戲院|戲院|劇院|影院|影廳|cinemas?|theat(re|er)s?|[\s@()（）])", re.I)


def _bigrams(s: str) -> set[str]:
    s = NOISE.sub("", s.replace("臺", "台").lower())
    return {s[i:i + 2] for i in range(len(s) - 1)} or {s}


def _score(moc: str, osm: str) -> float:
    """名稱像不像：兩兩組合的 Jaccard，或 OSM 名稱的組合有多少包含在文化部的名稱裡（OSM 常只寫「威秀影城」）"""
    a, b = _bigrams(moc), _bigrams(osm)
    if not a or not b:
        return 0.0
    return max(len(a & b) / len(a | b), len(a & b) / len(b))


def _tw_cinemas(osm_tw: list[dict]) -> list[dict]:
    """文化部影視局 2025 年的全國電影院（data.gov.tw 22213）：有廳數、只有地址。位置找地址的鄉鎮市區代表點 5 公里內、名稱最像的
    OSM 電影院（_score ≥ 0.75，一個 OSM 點只配一家），找不到放在鄉鎮市區的代表點（a=1）；地址沒寫鄉鎮市區的（例如「台南市永福路」）
    在整個縣市找（20 公里內），再找不到放在縣市各鄉鎮代表點的平均（a=2）。事業名稱空白的用公司名稱（括號裡有戲院名的用括號裡的）。
    鄉鎮改制的（頭份鎮→頭份市）照新名稱。不輸出電話與統一編號。"""
    from topics.tw_factories import _split_address, _towns

    if not MOC_CINEMAS.exists():
        raise RuntimeError(f"沒有 {MOC_CINEMAS}：請把 map-plan 的 data/moc/bamid-cinemas-2025.csv 複製到這裡")
    if hashlib.sha256(MOC_CINEMAS.read_bytes()).hexdigest() != MOC_SHA:
        raise RuntimeError(f"{MOC_CINEMAS} 的 SHA-256 跟 map-plan 的 README 不一樣，先看過再改")
    rows = list(csv.DictReader(io.StringIO(MOC_CINEMAS.read_text(encoding="utf-8-sig"))))
    towns = _towns()
    county_mean: dict[str, list[float]] = {}
    for (cty, _), (lon, lat) in towns.items():
        m = county_mean.setdefault(cty, [0.0, 0.0, 0])
        m[0] += lon; m[1] += lat; m[2] += 1
    county_mean = {k: [v[0] / v[2], v[1] / v[2]] for k, v in county_mean.items()}

    def km(o, c):
        return math.hypot((o["lon"] - c[0]) * math.cos(math.radians(c[1])), o["lat"] - c[1]) * 111

    items = []
    for r in rows:
        name = r["事業名稱"].strip()
        if not name:
            m = re.search(r"（(.+?)）", r["公司名稱"])
            name = m.group(1) if m else r["公司名稱"].strip()
        addr = re.sub(r"(頭份|員林)鎮", r"\1市", r["地址"])
        county, town = _split_address(addr, "", towns)
        center = towns.get((county, town))
        level = 1 if center else 2
        if not center and county in county_mean:
            center = county_mean[county]
        screens = int(r["廳數"]) if r["廳數"].strip().isdigit() else None
        items.append({"name": name, "county": county, "town": town if level == 1 else None, "center": center, "level": level, "s": screens})
    # 先配分數高的，一個 OSM 點只配一家
    pairs = []
    for i, it in enumerate(items):
        if not it["center"]:
            continue
        radius = 5 if it["level"] == 1 else 20
        for j, o in enumerate(osm_tw):
            if km(o, it["center"]) <= radius:
                sc = max(_score(it["name"], o["n"] or ""), _score(it["name"], o["nz"] or ""))
                if sc >= 0.75:
                    pairs.append((-sc, km(o, it["center"]), i, j))
    used_i, used_j, match = set(), set(), {}
    for _, _, i, j in sorted(pairs):
        if i not in used_i and j not in used_j:
            used_i.add(i); used_j.add(j); match[i] = osm_tw[j]
    out, lost = [], []
    for i, it in enumerate(items):
        if i in match:
            lon, lat, a = match[i]["lon"], match[i]["lat"], 0
        elif it["center"]:
            lon, lat, a = round(it["center"][0], 4), round(it["center"][1], 4), it["level"]
        else:
            lost.append(it["name"])
            continue
        out.append({"lon": lon, "lat": lat, "iso3": "TWN", "k": 2, "a": a, "s": it["s"], "n": it["name"], "nz": None, "ne": None,
                    "t": f"{it['county']}{it['town'] or ''}"})
    at: dict[tuple, list] = defaultdict(list)
    for o in out:
        if o["a"]:
            at[(o["lon"], o["lat"])].append(o)
    for (lon, lat), group in at.items():
        for i, o in enumerate(group if len(group) > 1 else []):
            ang = 2 * math.pi * i / len(group)
            o["lon"], o["lat"] = round(lon + 0.006 * math.cos(ang), 4), round(lat + 0.006 * math.sin(ang), 4)
    total = sum(o["s"] or 0 for o in out)
    print(f"  文化部 2025 年電影院：{len(rows)} 家、{total} 廳；對到 OSM {sum(1 for o in out if o['a'] == 0)}、"
          f"放鄉鎮代表點 {sum(1 for o in out if o['a'] == 1)}、只知道縣市 {sum(1 for o in out if o['a'] == 2)}；放不上去 {lost}")
    print("    對到的：" + "、".join(f"{items[i]['name']}→{match[i]['nz'] or match[i]['n']}" for i in sorted(match)))
    return out


def cinemas() -> None:
    from topics.osm_density import density

    n = density(OUT, "amenity", "cinema", "cinemas-osm", "家/十萬人", 1e5, "電影院")
    points: dict[str, dict] = {}
    for r in osm_qlever.features("amenity", "cinema", ("name", "name:zh", "name:en", "screen")):
        if r["osm"] in points or not r["iso3"]:
            continue
        c = osm_qlever.centroid(r["wkt"])
        if not c:
            continue
        s = r["screen"].strip()
        points[r["osm"]] = {"lon": round(c[0], 4), "lat": round(c[1], 4), "iso3": r["iso3"], "k": 1, "a": 0,
                            "s": int(s) if s.isdigit() and 0 < int(s) < 100 else None,
                            "n": r["name"] or None, "nz": r["name:zh"] or None, "ne": r["name:en"] or None, "t": None}
    osm_tw = [p for p in points.values() if p["iso3"] == "TWN"]
    rows = [p for p in points.values() if p["iso3"] != "TWN"] + _tw_cinemas(osm_tw)
    rows.sort(key=lambda p: (p["iso3"], p["lon"]))
    write_points(OUT / "cinema-points.json", points_file(rows, ["lon", "lat", "iso3", "k", "a", "s", "n", "nz", "ne", "t"],
                                                          {"lon": 0.0001, "lat": 0.0001}, strings=("iso3",)), ("n", "nz", "ne", "t"))
    with_s = [p for p in rows if p["k"] == 1 and p["s"]]
    print(f"    點 {len(rows):,}（OSM {sum(1 for p in rows if p['k'] == 1):,}、文化部 {sum(1 for p in rows if p['k'] == 2)}）；"
          f"OSM 有 screen 標籤的 {len(with_s):,}（{len(with_s) / max(1, len(rows)) * 100:.1f}%）；台灣 OSM {len(osm_tw)}、計數 {n.get('TWN')}")
