"""移民與難民的擴充：移民路上的死亡與失蹤（IOM Missing Migrants Project，製作手冊第十七批 276，2026-11-03）。

**資料**：國際移民組織（IOM）Missing Migrants Project 的下載頁（https://missingmigrants.iom.int/downloads ）
「Download all data」的 CSV（Missing_Migrants_Global_Figures_allData.csv，2014 年起每一起死亡、失蹤事件一列，不必登入）。
**授權**：下載頁寫「The downloads above are licensed under a Creative Commons Attribution 4.0 International License …
This includes stating that the source is 'IOM's Missing Migrants Project', and indicating if changes were made to the data」
（2026-11-03 讀）→ 可用，前端的來源寫「IOM's Missing Migrants Project」並註明改過哪裡（台灣的 2 起）。
**陷阱**：
- 數字是「最低估計」，位置多半是大概的（下載頁的提醒，說明有寫）。
- 「Country of Incident」在海上也寫最近的國家（地中海中線多寫 Libya），國家的值照 IOM 的國家，不依座標重算。
- 台灣沒有自己的類別：台灣附近的事件寫 China。使用者 2026-11-03 決定依座標改歸台灣、附註寫明（`TAIWAN_FIX`）。
- 死因可能同時有好幾種（約 45 起），只有一種明確的死因時用它，其餘算「多種或不明」。

**輸出**（public/data/topics/migration/）：
- missing-migrants/<年>.json：那一年的事件點（經緯度、月日 md、死亡與失蹤 n、死亡 d、失蹤 m、倖存 s、死因 c、路線 r、
  國家 iso3、原籍國 o〔ISO3，空白分隔〕、地點 pl、消息來源 src、網址 url、改歸台灣的 fix），一年一個檔，
  地圖與左側欄只讀時間軸那一年。沒有座標的 3 起不畫點。
- missing-migrants.json：各國每年死亡與失蹤的人數（指標，沒有座標的也算）。
"""
from __future__ import annotations

import csv
from collections import Counter, defaultdict

import numpy as np

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_manifest_part
from geoindex import countries_at
from sources.countries import from_name
from topics.typhoons import NearIndex

OUT = OUT_DIR / "topics" / "migration"
URL = ("https://missingmigrants.iom.int/sites/g/files/tmzbdl601/files/report-migrant-incident/"
       "Missing_Migrants_Global_Figures_allData.csv")
LICENSE_PAGE = "https://missingmigrants.iom.int/downloads"
# 前端 src/topics/missing-migrants.ts 的 CAUSES 同一個順序（最後一個是多種或不明）
CAUSES = [
    "Drowning",
    "Vehicle accident / death linked to hazardous transport",
    "Harsh environmental conditions / lack of adequate shelter, food, water",
    "Sickness / lack of access to adequate healthcare",
    "Violence",
    "Accidental death",
    "Mixed or unknown",
]
MIXED = len(CAUSES) - 1
# 前端的 ROUTES 同一個順序；沒有路線的是 0（不在這個表裡的新路線會讓 build 報錯，前端要一起加）
ROUTES = [
    "",
    "Central Mediterranean", "Western Mediterranean", "Eastern Mediterranean",
    "Western Africa / Atlantic route to the Canary Islands", "Sahara Desert crossing",
    "US-Mexico border crossing", "Darien", "Caribbean to US", "Dominican Republic to Puerto Rico",
    "Haiti to Dominican Republic", "Venezuela to Caribbean", "Caribbean to Central America",
    "Afghanistan to Iran", "Iran to Türkiye", "Syria to Türkiye", "Türkiye-Europe land route", "Western Balkans",
    "Belarus-EU border", "Mainland Europe to the UK", "Italy to France", "Ukraine to Europe",
    "Eastern Route to/from EHOA", "Northern Route from EHOA", "Horn of Africa Route", "Route to Southern Africa",
    "DRC to Uganda", "Sea crossings to Mayotte", "Bay of Bengal/Andaman Sea", "Naf River crossing",
]
# 聯合國的正式國名（pycountry 對不到的）
ALIASES = {
    "Bolivia (Plurinational State of)": "BOL", "Iran (Islamic Republic of)": "IRN", "Venezuela (Bolivarian Republic of)": "VEN",
    "China, Hong Kong Special Administrative Region": "HKG", "China, Macao Special Administrative Region": "MAC",
    "United States Virgin Islands": "VIR", "Türkiye": "TUR", "Mixed/Unknown": None, "Unknown": None,
    # pycountry 的模糊比對會把「Republic of Korea」對到北韓
    "Republic of Korea": "KOR", "Democratic People's Republic of Korea": "PRK",
}
NEAR_KM = 200  # 海上的事件：離台灣國界 200 公里內、而且最近的是台灣，才改歸台灣
PLACE_MAX = 160
SOURCE_MAX = 100


def _iso3(name: str) -> str | None:
    name = name.strip()
    if name in ALIASES:
        return ALIASES[name]
    return from_name(name)


def _origin(text: str) -> str | None:
    """原籍國（可能好幾國，逗號分隔；聯合國國名本身有逗號的先換掉）→ ISO3 空白分隔，對不到的不寫"""
    for k in sorted(ALIASES, key=len, reverse=True):  # 長的先換（「Republic of Korea」在北韓的國名裡）
        text = text.replace(k, ALIASES[k] or "")
    codes = []
    for part in text.split(","):
        part = part.strip()
        code = part if len(part) == 3 and part.isupper() else _iso3(part) if part else None
        if code and code not in codes:
            codes.append(code)
    return " ".join(codes) or None


def _cause(text: str) -> int:
    found = {c for c in (s.strip() for s in _split_causes(text)) if c in CAUSES and c != CAUSES[MIXED]}
    return CAUSES.index(found.pop()) if len(found) == 1 else MIXED


def _split_causes(text: str) -> list[str]:
    """死因用逗號分隔，但「Harsh environmental conditions / lack of adequate shelter, food, water」本身有逗號"""
    out, rest = [], text
    for c in sorted(CAUSES, key=len, reverse=True):
        if c in rest:
            out.append(c)
            rest = rest.replace(c, "")
    return out


def _num(v: str) -> int:
    v = (v or "").strip()
    return int(float(v)) if v else 0


def _url(v: str) -> str | None:
    v = (v or "").strip().split()[0].rstrip(",") if (v or "").strip() else ""
    return v if v.startswith("http") and len(v) <= 300 else None


def _cut(v: str, n: int) -> str | None:
    v = " ".join((v or "").split())
    return (v[: n - 1] + "…" if len(v) > n else v) or None


def build() -> None:
    path = download(URL, "iom-missing-migrants", "Missing_Migrants_Global_Figures_allData.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        raw = list(csv.DictReader(f))
    rows, no_coord, unknown_country = [], [], Counter()
    for r in raw:
        coords = r["Coordinates"].split(",")
        lat, lon = (float(coords[0]), float(coords[1])) if len(coords) == 2 else (None, None)
        date = r["Incident Date"].strip()
        route = r["Migration Route"].strip()
        if route not in ROUTES:
            raise RuntimeError(f"IOM 多了新的路線「{route}」：pipeline 的 ROUTES 與前端 missing-migrants.ts 要一起加")
        country = r["Country of Incident"].strip()
        iso3 = _iso3(country)
        if iso3 is None and country:
            unknown_country[country] += 1
        dead, missing = _num(r["Number of Dead"]), _num(r["Minimum Estimated Number of Missing"])
        rows.append({
            "lon": lon, "lat": lat, "y": int(date[:4]), "md": int(date[5:7]) * 100 + int(date[8:10]),
            "n": _num(r["Total Number of Dead and Missing"]) or dead + missing, "d": dead, "m": missing,
            "s": _num(r["Number of Survivors"]) or None, "c": _cause(r["Cause of Death"]), "r": ROUTES.index(route),
            "iso3": iso3, "o": _origin(r["Country of Origin"]), "pl": _cut(r["Location of Incident"], PLACE_MAX),
            "src": _cut(r["Information Source"], SOURCE_MAX), "url": _url(r["URL"]), "id": r["Main ID"],
        })
        if lon is None:
            no_coord.append(rows.pop())  # 沒有座標的不畫點，國家的人數照算

    # 台灣：IOM 寫 China、但在台灣國界內，或在海上而最近的國家是台灣的，改歸台灣（使用者 2026-11-03 決定）
    china = [x for x in rows if x["iso3"] == "CHN"]
    land = countries_at([x["lon"] for x in china], [x["lat"] for x in china])
    sea = [x for x, c in zip(china, land) if c is None]
    fixed = [x for x, c in zip(china, land) if c == "TWN"]
    if sea:
        index = NearIndex(NEAR_KM)
        hp, hc, hd = index.query(np.array([x["lon"] for x in sea]), np.array([x["lat"] for x in sea]), np.zeros(len(sea), dtype=bool))
        nearest: dict[int, tuple[float, str]] = {}
        for p, c, d in zip(hp.tolist(), hc.tolist(), hd.tolist()):
            if p not in nearest or d < nearest[p][0]:
                nearest[p] = (d, index.codes[c])
        fixed += [sea[p] for p, (_, code) in nearest.items() if code == "TWN"]
    for x in fixed:
        x["iso3"] = "TWN"
        x["fix"] = 1

    rows.sort(key=lambda x: (x["y"], x["md"], x["id"]))
    years = list(range(rows[0]["y"], rows[-1]["y"] + 1))
    fields = ["lon", "lat", "md", "n", "d", "m", "s", "c", "r", "iso3", "o", "pl", "src", "url", "fix"]
    scale = {"lon": 0.001, "lat": 0.001, "md": 1, "n": 1, "d": 1, "m": 1, "s": 1, "c": 1, "r": 1, "fix": 1}
    for y in years:
        this = [x for x in rows if x["y"] == y]
        write_json(OUT / "missing-migrants" / f"{y}.json", points_file(this, fields, scale, strings=("iso3", "o", "src")), quiet=True)

    toll: dict[str, Counter] = defaultdict(Counter)
    for x in rows + no_coord:
        if x["iso3"]:
            toll[x["iso3"]][x["y"]] += x["n"]
    world = [sum(x["n"] for x in rows + no_coord if x["y"] == y) for y in years]
    last = rows[-1]
    as_of = f"{last['y']}-{last['md'] // 100:02d}-{last['md'] % 100:02d}"
    tw = sorted(fixed, key=lambda x: (x["y"], x["md"]))
    tw_zh = "；".join(f"{x['y']}-{x['md'] // 100:02d}-{x['md'] % 100:02d} {x['pl']}（{x['n']} 人）" for x in tw)
    tw_en = "; ".join(f"{x['y']}-{x['md'] // 100:02d}-{x['md'] % 100:02d}, {x['pl']} ({x['n']})" for x in tw)
    write_json(OUT / "missing-migrants.json", indicator_file(
        "missing-migrants", "人", years, {c: [n.get(y, 0) for y in years] for c, n in sorted(toll.items())},
        aggregates={"WLD": world},
        notes={"TWN": f"IOM 沒有台灣的類別，台灣附近的事件寫 China；這裡依座標改歸台灣（{len(tw)} 起：{tw_zh}）。"},
        notesEn={"TWN": f"IOM has no category for Taiwan and lists incidents near it under China; they are moved to Taiwan here by their coordinates ({len(tw)}: {tw_en})."},
    ))
    write_manifest_part(OUT, "migration", "missing-migrants", {
        "source": "IOM's Missing Migrants Project", "url": LICENSE_PAGE, "license": "CC BY 4.0",
        "records": len(rows), "asOf": as_of,
        "changes": "台灣附近的事件依座標改歸台灣（IOM 寫 China）",
    })

    by_year = {y: w for y, w in zip(years, world)}
    print(f"  IOM {len(raw)} 起（沒有座標的 {len(no_coord)} 起不畫點、國家照算），{years[0]}–{years[-1]}，資料到 {as_of}；"
          f"死亡與失蹤合計 {sum(world):,} 人；每年 {by_year}")
    print(f"  對不到國家的：{dict(unknown_country)}；台灣（依座標改歸）{len(tw)} 起：{tw_zh}")
    top = Counter({c: sum(n.values()) for c, n in toll.items()}).most_common(8)
    print(f"  累計最多的國家：{top}")
    print(f"  死因：{Counter(CAUSES[x['c']] for x in rows).most_common()}")
    route_n = Counter()
    for x in rows:
        route_n[ROUTES[x['r']] or '（沒有路線）'] += x["n"]
    print(f"  依路線（人）：{route_n.most_common(8)}")


if __name__ == "__main__":
    build()
