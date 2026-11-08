"""樂園（新主題，2026-11-08，製作手冊第二十七批 630，候選 1371、1387、1383、1381、1382；步驟 theme-parks，
輸出 topics/theme-parks/）。樂園的點與 TEA 的人次照舊由「景點地圖」的 pipeline 產生（attractions.py、attractions_extra.py），
前端用 ../attractions/ 的檔；這一步只做新的指標。

- **各國樂園數與每百萬人幾座**：OpenStreetMap `tourism=theme_park`（ODbL 1.0，QLever osm-planet，sources/osm_qlever.py）。
  手冊的陷阱：OSM 的標法很寬（伊朗、俄羅斯多半是城市裡的小遊樂場），也在量 OSM 畫得多完整，所以每百萬人只替 OSM
  覆蓋良好的國家上色（sources/osm_coverage.py，同第二十一批的店家密度）；座數照畫、說明寫明不能當主題樂園排名。
- **開園年份**：Wikidata（CC0，QLever）的主題樂園（Q2416723）與遊樂園（Q194195）含子類別，有座標、有創立時間（P571）、
  沒有停用日期（P576、P3999）的；國家的值是這一國最早的樂園年份，點依開園年份累計出現。手冊的陷阱：P571 只有三成的樂園有，
  有時是公司成立年，沒有逐一核對。
- **台灣**（側欄）：觀光署「民營遊樂園基本資料」（data.gov.tw 38257，政府資料開放授權條款第 1 版）25 處的票價（自由文字，
  規則取「全票」或「成人」的價格，年度多半是 107 年，不是現價），與「歷年國內主要觀光遊憩據點遊客人數月別統計」
  （data.gov.tw 8116，景點地圖已經在讀）依園名對到的每年人次與最近一年的月別人次。手冊說 2024 年的「類型」欄錯置——
  這裡依名稱對（NAME_ALIASES 收改過名的），不用類型欄。
"""
from __future__ import annotations

import csv
import re
import urllib.parse
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, points_file, write_json
from sources import osm_coverage, osm_qlever, qlever_wikidata, wpp
from topics.attractions_extra import TW_CSV_URL

OUT = OUT_DIR / "topics" / "theme-parks"
YEAR = 2026
TW_PARKS_URL = "https://media.taiwan.net.tw/od/07_DTD/" + urllib.parse.quote("民營遊樂園資料.csv")
MIN_POPULATION = 100  # 千人
TIME_FROM = 1850
# 觀光署 38257 的園名 → 8116 人次表裡的名稱（改過名的都列；沒列的用同名）
NAME_ALIASES = {
    "8大森林樂園": ["8大森林樂園", "8大森林博覽樂園"],
    "大路觀溫泉渡假村": ["大路觀主題樂園"],
    "小叮噹科學主題樂園": ["小叮噹科學主題樂園", "小叮噹科學遊樂區"],
    "頑皮世界野生動物園": ["頑皮世界"],
    "遠雄海洋公園股份有限公司": ["遠雄海洋公園", "遠雄海洋公園\nFarglory Ocean Park"],
    "劍湖山世界股份有限公司": ["劍湖山世界"],
    "麗寶樂園": ["麗寶樂園", "麗寶樂園渡假村"],
    "台東原生應用植物園": ["原生應用植物園"],
}
SHORT = {"遠雄海洋公園股份有限公司": "遠雄海洋公園", "劍湖山世界股份有限公司": "劍湖山世界"}
OPENED = """
SELECT ?item ?iso ?coord ?year ?en ?zh WHERE {
  { SELECT ?item (MIN(YEAR(?inc)) AS ?year) WHERE {
      VALUES ?root { wd:Q2416723 wd:Q194195 }
      ?item wdt:P31/wdt:P279* ?root ; wdt:P571 ?inc .
    } GROUP BY ?item }
  ?item wdt:P625 ?coord ; wdt:P17/wdt:P298 ?iso .
  FILTER NOT EXISTS { ?item wdt:P576 ?closed }
  FILTER NOT EXISTS { ?item wdt:P3999 ?closed2 }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh-tw") }
}"""


def _osm() -> None:
    n = osm_qlever.counts("tourism", "theme_park")
    pop = {c: s[2024] for c, s in wpp.demographic(["TPopulation1July"], last_year=2024)["TPopulation1July"].items() if s.get(2024)}
    write_json(OUT / "osm-count.json", indicator_file("osm-count", "座", [YEAR], {c: [v] for c, v in sorted(n.items())}, license="ODbL 1.0"))
    cov, covered = osm_coverage.coverage(), osm_coverage.well_covered()
    values, no_value, no_value_en = {}, {}, {}
    for c in sorted(set(n) | covered):
        if c not in pop:
            continue
        if c not in covered:
            no_value[c], no_value_en[c] = osm_coverage.reason(c, cov.get(c))
        elif pop[c] < MIN_POPULATION:
            no_value[c] = "人口不到 10 萬，一兩座就差很多，不畫"
            no_value_en[c] = "Population under 100,000, too small for a stable rate, so not shown"
        else:
            values[c] = [round(n.get(c, 0) / pop[c] * 1000, 2)]
    write_json(OUT / "osm-per-million.json", indicator_file(
        "osm-per-million", "座/百萬人", [YEAR], values, noValue=no_value, noValueEn=no_value_en, license="ODbL 1.0"))
    top = sorted(n.items(), key=lambda x: -x[1])
    print(f"  OSM tourism=theme_park：{len(n)} 國、{sum(n.values()):,} 座；" + "、".join(f"{c} {v}" for c, v in top[:14]) + f"；台灣 {n.get('TWN')}")
    r = sorted(((c, v[0]) for c, v in values.items()), key=lambda x: -x[1])
    print(f"    每百萬人（覆蓋良好 {len(values)} 國）：" + "、".join(f"{c} {v}" for c, v in r[:12]) + " … "
          + "、".join(f"{c} {values[c][0]}" for c in ("TWN", "JPN", "KOR", "USA", "DEU", "FRA", "GBR", "NLD") if c in values))


def _opened() -> None:
    rows = qlever_wikidata.cached("theme-parks-opened", OPENED)
    by_item: dict[str, dict] = {}
    for r in rows:
        q = r["item"]["value"].rsplit("/", 1)[1]
        m = re.match(r"POINT\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"]["value"], re.I)
        if not m or q in by_item:
            continue
        y = int(float(r["year"]["value"]))
        if not 1500 <= y <= YEAR:
            continue
        by_item[q] = {"lon": float(m.group(1)), "lat": float(m.group(2)), "year": y, "iso3": r["iso"]["value"],
                      "en": r.get("en", {}).get("value", ""), "zh": r.get("zh", {}).get("value", "")}
    first: dict[str, int] = {}
    for d in by_item.values():
        first[d["iso3"]] = min(first.get(d["iso3"], 9999), d["year"])
    # 時間軸從 1850 年起（點依開園年份累計出現，更早的 6 座在 1850 年就畫）；國家的值從最早的樂園那年起才有
    years = list(range(TIME_FROM, YEAR + 1))
    write_json(OUT / "first-park.json", indicator_file(
        "first-park", "年", years, {c: [y if t >= max(y, TIME_FROM) else None for t in years] for c, y in sorted(first.items())},
        license="CC0 1.0"))
    pts = sorted(by_item.values(), key=lambda d: d["year"])
    write_json(OUT / "opened.json", {**points_file(pts, ["lon", "lat", "year", "iso3", "en", "zh"], {"lon": 0.001, "lat": 0.001, "year": 1},
                                                   delta=("year",), strings=("iso3",)), "license": "CC0 1.0"})
    dec: dict[int, int] = defaultdict(int)
    for d in pts:
        dec[d["year"] // 10 * 10] += 1
    oldest = sorted(first.items(), key=lambda x: x[1])[:10]
    print(f"  Wikidata 有開園年份的樂園 {len(pts)} 座、{len(first)} 國；最早：" + "、".join(f"{c} {y}" for c, y in oldest)
          + f"；台灣 {first.get('TWN')}、日本 {first.get('JPN')}、美國 {first.get('USA')}")
    print("    依年代：" + "、".join(f"{d}s {n}" for d, n in sorted(dec.items()) if d >= 1900))
    print("    最早的 6 座：" + "、".join(f"{d['en'] or d['zh']}（{d['iso3']} {d['year']}）" for d in pts[:6]))


def _price(text: str) -> int | None:
    """票價的自由文字 → 全票（或成人票、一般票）一個數字；找不到這些字時取第一個三、四位數的價格"""
    t = re.sub(r"\s+", "", text)
    m = re.search(r"(全票|成人票|成人|一般|活動票|單園[^：:]*[：:]?全票)[^0-9]{0,12}(\d{3,4})", t)
    if m:
        return int(m.group(2))
    m = re.search(r"(?<![\d.])(\d{3,4})(?=元)", t) or re.search(r"\$(\d{3,4})", t)
    return int(m.group(1)) if m else None


def _county(addr: str) -> str:
    m = re.search(r"(..[縣市])", re.sub(r"^[\d\s(),:：;郵遞區號地址園區]+", "", addr))
    return m.group(1).replace("台", "臺") if m else ""


def _taiwan() -> None:
    with open(download(TW_PARKS_URL, "taiwan-net", "amusement-parks-38257.csv"), encoding="utf-8-sig", newline="") as f:
        parks = list(csv.DictReader(f))
    visits: dict[str, dict[int, list[int]]] = defaultdict(dict)  # 名稱 → 年 → 12 個月
    with open(download(TW_CSV_URL, "taiwan-net", "visitors-by-site.csv"), encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            name = (r["細分"] or "").strip()
            name = name if name and name != "-" else r["觀光遊憩區"].strip()
            try:
                months = [int(float(r[f"{m}月"] or 0)) for m in range(1, 13)]
                visits[name][int(r["年別"])] = months
            except ValueError:
                continue
    rows = []
    for p in parks:
        name = p["園區名稱"].strip()
        series: dict[int, list[int]] = {}
        for alias in NAME_ALIASES.get(name, [name]):
            for y, months in visits.get(alias, {}).items():
                if y not in series or sum(months) > sum(series[y]):
                    series[y] = months
        price = _price(p["票價及相關價格資料"])
        years = sorted(series)
        rows.append({
            "name": SHORT.get(name, name), "county": _county(p["郵遞區號+園區地址"]), "price": price,
            "priceYear": int(p["年度"]) + 1911 if p["年度"].strip().isdigit() else None,
            "years": years, "annual": [sum(series[y]) for y in years],
            "months": series[years[-1]] if years else None, "monthYear": years[-1] if years else None,
        })
    rows.sort(key=lambda r: -(r["annual"][-1] if r["annual"] else 0))
    write_json(OUT / "taiwan.json", {"parks": rows, "license": "政府資料開放授權條款第 1 版", "attribution": "交通部觀光署"})
    for r in rows:
        print(f"    {r['name']}（{r['county']}）全票 {r['price']}（{r['priceYear']}）；{r['monthYear']} 年 {r['annual'][-1] if r['annual'] else '-':,}"
              if r["annual"] else f"    {r['name']}（{r['county']}）全票 {r['price']}（{r['priceYear']}）；沒有人次")


def build() -> None:
    _osm()
    _opened()
    _taiwan()
