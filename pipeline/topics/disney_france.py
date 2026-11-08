"""迪士尼在法國的法人：營業額、淨利、員工級距；迪士尼商店（2026-11-08，製作手冊第二十八批 679，候選 1483、1496、1491、1489；
1498 專利照手冊不做；擴充「迪士尼」；步驟 disney-france，輸出 topics/disney/）。

- **法人是固定的白名單** `pipeline/data/disney/france.csv`（SIREN）：2026-11-08 用法國政府的公司查詢 API
  （recherche-entreprises.api.gouv.fr）搜「euro disney」「walt disney」，人工挑出名稱與行業確定是迪士尼的（排掉員工福利委員會、
  同名的無關公司、沒有總部位置的外國公司登記），之後只更新數字。
- **數字的出處**：營業額與淨利是 INPI（法國工業產權局）的財報申報，員工級距是 INSEE 的 Base Sirene，兩者都是 data.gouv.fr 上
  Licence Ouverte 2.0（lov2）的開放資料（「Base Sirene des entreprises et de leurs établissements」「Ratios financiers
  BCE / INPI」）；查詢 API 只當找 SIREN 的工具（api.gouv.fr 上那支 API 的授權欄是「未填」，手冊：引用 lov2 的資料集）。
  財報資料集本身在 data.economie.gouv.fr，那個網站的 robots.txt 不准程式讀 /api/，所以不直接下載。
- **員工級距是代碼不是人數**：INSEE 的代碼 52＝5,000–9,999 人、53＝10,000 人以上（API Entreprise 的 INSEE 欄位說明；手冊寫
  53＝5,000–9,999 是錯的）。迪士尼巴黎的營運公司是 53。
- **不加總**：迪士尼巴黎的營運公司（27 億歐元）與套裝行程公司（18 億）之間有大量集團內的買賣（套裝行程裡就有門票與住宿），
  加起來會重複算，指標只用營運公司一家。跟順序 633 的 Eurostat R9321（法國 2024 年 5,663.06 百萬歐元）並列：營運公司 2025 年
  占約 47%，年份差一年、R9321 也含流動遊樂場，說明寫「約」。
- **迪士尼商店**：OpenStreetMap 的 `brand:wikidata=Q1047009`（Disney Store），QLever osm-planet；國家依座標（QLever 的
  `ogc:sfContains` 回 HTTP 400）。手冊：嚴重偏向北美，**不能當成各國店數排名**，指標不上色、不排名，只畫點。
"""
from __future__ import annotations

import csv
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

import geoindex
from common import CACHE_DIR, OUT_DIR, ROOT, USER_AGENT, indicator_file, points_file, read_indicator, write_json
from sources import osm_qlever

OUT = OUT_DIR / "topics" / "disney"
CSV = ROOT / "pipeline" / "data" / "disney" / "france.csv"
API = "https://recherche-entreprises.api.gouv.fr/search"
GROUPS = ["resort", "media", "holding"]  # 前端 disney.ts 的 FR_GROUPS（代碼是索引 + 1）
# INSEE 的員工級距（API Entreprise 的 INSEE 欄位說明，2026-11-08）
EMPLOYEES = {"00": "0", "01": "1–2", "02": "3–5", "03": "6–9", "11": "10–19", "12": "20–49", "21": "50–99", "22": "100–199",
             "31": "200–249", "32": "250–499", "41": "500–999", "42": "1,000–1,999", "51": "2,000–4,999", "52": "5,000–9,999",
             "53": "10,000+"}
OPERATOR = "397471822"  # 迪士尼巴黎的營運公司（EURO DISNEY ASSOCIES SAS）
SPREAD = 0.006
NO_VALUE = {
    "HKG": ("香港迪士尼營運公司的營收只在立法會文件裡，這裡連不上立法會網站；旅發局的資料不能用、data.gov.hk 沒有",
            "Hong Kong Disneyland’s revenue appears only in Legislative Council papers, which could not be reached; no open dataset has it"),
    "CHN": ("上海迪士尼的營運公司不是上市公司，沒有公開的營業額", "Shanghai Disney Resort’s operating company is not listed and publishes no revenue"),
    "USA": ("美國證管會（SEC）的財報從這裡連不上；迪士尼的財報也只有整個樂園部門的數字，沒有各樂園",
            "SEC filings could not be reached from here, and Disney reports only its whole parks segment, not individual parks"),
    "JPN": ("東京迪士尼的營運公司（東方樂園）是上市公司，但這次沒有取得財報",
            "Tokyo Disney Resort’s operator (Oriental Land) is listed, but its reports could not be retrieved this time"),
    "TWN": ("台灣沒有迪士尼的樂園；公司登記的公開資料這次查不到迪士尼的公司", "Taiwan has no Disney park, and the company register returned no Disney companies"),
}


def _fetch(siren: str) -> dict:
    """查一個 SIREN（有快取就用快取）；連線常被重設，失敗等 2、4、8、16 秒再試"""
    path = CACHE_DIR / "recherche-entreprises" / f"{siren}.json"
    if not path.exists():
        url = f"{API}?{urllib.parse.urlencode({'q': siren, 'per_page': 5})}"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = r.read()
                json.loads(data)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                break
            except (urllib.error.URLError, ConnectionError, TimeoutError, ValueError) as err:
                if attempt == 4:
                    raise RuntimeError(f"recherche-entreprises 一直失敗（{siren}）：{err}")
                time.sleep(2 ** (attempt + 1))
        time.sleep(0.5)  # 每秒最多 7 次
    found = [r for r in json.loads(path.read_text(encoding="utf-8"))["results"] if r["siren"] == siren]
    if not found:
        raise ValueError(f"查不到 SIREN {siren}")
    return found[0]


def companies() -> list[dict]:
    with open(CSV, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    out, skipped = [], []
    for r in rows:
        c = _fetch(r["siren"])
        siege = c.get("siege") or {}
        if not siege.get("latitude") or not siege.get("longitude"):
            skipped.append(r["siren"])
            continue
        fin = c.get("finances") or {}
        year = max(fin, key=int) if fin else None
        ca = fin[year].get("ca") if year else None
        net = fin[year].get("resultat_net") if year else None
        emp = c.get("tranche_effectif_salarie")
        out.append({
            "lon": float(siege["longitude"]), "lat": float(siege["latitude"]), "siren": r["siren"],
            # 只留法人名稱（nom_complet 括號裡是商業名稱）；不收負責人等個人資料
            "name": c["nom_complet"], "naf": c.get("activite_principale"), "g": GROUPS.index(r["group"]) + 1,
            "note": r["note"], "act": 1 if c.get("etat_administratif") == "A" else 0,
            "y": int(c["date_creation"][:4]) if c.get("date_creation") else None,
            "yc": int(c["date_fermeture"][:4]) if c.get("date_fermeture") else None,
            "city": (siege.get("libelle_commune") or "").title() or None,
            "fy": int(year) if year else None,
            # 營業額 0 的控股公司不寫營業額（手冊）；金額存歐元
            "ca": ca or None, "net": net if net is not None and year else None,
            "emp": EMPLOYEES.get(emp), "empy": c.get("annee_tranche_effectif_salarie"),
        })
    # 同一個總部座標（Chessy 有好幾家）排成小圓
    spots: dict[tuple, list] = defaultdict(list)
    for o in out:
        spots[(round(o["lon"], 3), round(o["lat"], 3))].append(o)
    for (lon, lat), here in spots.items():
        if len(here) < 2:
            continue
        for i, o in enumerate(sorted(here, key=lambda o: o["siren"])):
            a = 2 * math.pi * i / len(here)
            o["lon"] = lon + SPREAD * math.cos(a) / math.cos(math.radians(lat))
            o["lat"] = lat + SPREAD * math.sin(a)
    for o in out:
        o["iso3"] = "FRA"
    print(f"  法國的迪士尼法人：白名單 {len(rows)}，有總部位置 {len(out)}（營運中 {sum(o['act'] for o in out)}），沒有位置 {skipped}")
    for o in sorted(out, key=lambda o: -(o["ca"] or 0)):
        print(f"    {o['siren']} {o['name'][:48]} {o['naf']} {'營運中' if o['act'] else '已註銷'} {o['y']}–{o['yc'] or ''} "
              f"{o['city']} {o['fy']} 營業額 {o['ca']}、淨利 {o['net']}、員工 {o['emp']}（{o['empy']}）")
    return out


def stores() -> list[dict]:
    rows = osm_qlever.query("""SELECT ?x ?wkt ?name ?city ?shop WHERE {
  ?x <https://www.openstreetmap.org/wiki/Key:brand:wikidata> "Q1047009" ; geo:hasGeometry/geo:asWKT ?wkt .
  OPTIONAL { ?x osmkey:name ?name }
  OPTIONAL { ?x <https://www.openstreetmap.org/wiki/Key:addr:city> ?city }
  OPTIONAL { ?x osmkey:shop ?shop }
}""", "disney-store-brand")
    out = []
    for r in rows:
        pt = osm_qlever.centroid(r["wkt"]["value"])
        if not pt:
            continue
        osm = r["x"]["value"].replace("https://www.openstreetmap.org/", "")
        out.append({"lon": pt[0], "lat": pt[1], "osm": osm, "name": r.get("name", {}).get("value"),
                    "city": r.get("city", {}).get("value")})
    for o, c in zip(out, geoindex.countries_at([o["lon"] for o in out], [o["lat"] for o in out])):
        o["iso3"] = c
    out.sort(key=lambda o: (o["iso3"] or "", o["lon"]))
    print(f"  迪士尼商店（OSM brand:wikidata=Q1047009）：{len(out)} 個，各國 {Counter(o['iso3'] for o in out).most_common()}")
    return out


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fr = companies()
    fields = ["lon", "lat", "siren", "name", "naf", "g", "note", "act", "y", "yc", "city", "fy", "ca", "net", "emp", "empy", "iso3"]
    scale = {"lon": 0.0001, "lat": 0.0001, "g": 1, "act": 1, "y": 1, "yc": 1, "fy": 1, "ca": 1, "net": 1}
    write_json(OUT / "france.json", points_file(fr, fields, scale, strings=("naf", "city", "emp")))

    op = next(o for o in fr if o["siren"] == OPERATOR)
    years, r9321 = read_indicator(OUT_DIR / "topics" / "amusement-industry" / "turnover.json")
    fr_industry = r9321["FRA"][2024]
    ca_m = op["ca"] / 1e6
    share = ca_m / fr_industry * 100
    hint = (f"迪士尼巴黎的營運公司（EURO DISNEY ASSOCIES SAS），{op['fy']} 會計年度；淨利 {op['net'] / 1e6:,.0f} 百萬歐元，員工 "
            f"{op['emp']} 人（{op['empy']} 年的級距）。順序 633 的法國主題樂園業 2024 年淨營業額約 {fr_industry:,.0f} 百萬歐元，"
            f"這一家約占 {share:.0f}%（年份差一年，業別也含流動遊樂場）")
    hint_en = (f"Disneyland Paris’s operating company (EURO DISNEY ASSOCIES SAS), financial year {op['fy']}; net income "
               f"€{op['net'] / 1e6:,.0f} million, {op['emp']} employees ({op['empy']} band). France’s whole amusement and theme park "
               f"industry had about €{fr_industry:,.0f} million of net turnover in 2024, so this one company is about {share:.0f}% "
               f"(one year apart, and the industry also includes travelling fairs)")
    write_json(OUT / "france-revenue.json", indicator_file(
        "france-revenue", "百萬歐元", [op["fy"]], {"FRA": [round(ca_m, 1)]}, hints={"FRA": hint}, hintsEn={"FRA": hint_en},
        noValue={k: v[0] for k, v in NO_VALUE.items()}, noValueEn={k: v[1] for k, v in NO_VALUE.items()},
        license="INSEE Base Sirene 與 INPI 財報申報（data.gouv.fr，Licence Ouverte 2.0）"))
    print(f"  迪士尼巴黎的營運公司 {op['fy']} 年營業額 {ca_m:,.1f} 百萬歐元，占法國 R9321 2024 年 {fr_industry:,.2f} 的 {share:.1f}%")

    st = stores()
    write_json(OUT / "stores.json", points_file(st, ["lon", "lat", "osm", "name", "city", "iso3"],
                                                {"lon": 0.0001, "lat": 0.0001}, strings=("name", "city")))
    counts = Counter(o["iso3"] for o in st if o["iso3"])
    write_json(OUT / "stores-count.json", indicator_file(
        "stores", "家", [2026], {c: [n] for c, n in sorted(counts.items())},
        noValue={"TWN": "OpenStreetMap 上台灣沒有標迪士尼商店"},
        noValueEn={"TWN": "OpenStreetMap has no Disney Store mapped in Taiwan"},
        license="OpenStreetMap（ODbL 1.0）"))
