"""外食的擴充：米其林三星餐廳（2026-11-04，製作手冊第二十一批 368）。

- 英文維基百科「List of Michelin 3-star restaurants」（CC BY-SA 4.0，固定 oldid 1377608286，2026-09-30 的版本，
  頁面寫 2025 年版指南）：依國家一節一表，四欄「餐廳、主廚、地點、獲得三星的年份」。米其林官網的條款禁止抓取與轉載，不用。
- 國家：章節名稱；「France & Monaco」依地點分法國、摩納哥；中國那節的香港、澳門依地點分開（地圖上是不同的區塊）。
- 位置：餐廳本身有維基條目而 Wikidata 有座標的用它，其次用地點欄連到的城市條目；都沒有的不畫點（照樣算家數）。
  一支 WDQS 查詢（維基條目 → Wikidata 的座標），CC0。
- 米其林只在有出版指南的地方評星，沒有三星餐廳的國家不是 0，是沒有評或沒有三星，說明寫明，不畫 0。
- 輸出的清單（名稱、主廚、城市、年份）是維基的整理，依 CC BY-SA 4.0 分享。
"""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, points_file, write_json
from sources import wikitable, wpp
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "dining"
PAGE = "List of Michelin 3-star restaurants"
OLDID = 1377608286
YEAR = 2026
SECTION_ISO = {"France & Monaco": "FRA", "South Korea": "KOR", "United Arab Emirates": "ARE", "Taiwan": "TWN"}
# 地點欄裡寫了這些地名的，算到那個地區（地圖上跟所在國分開畫的）
PLACE_ISO = {"Monaco": "MCO", "Monte Carlo": "MCO", "Monte-Carlo": "MCO", "Hong Kong": "HKG", "Macau": "MAC", "Macao": "MAC"}
WDQS = "https://query.wikidata.org/sparql"


def _coords(titles: list[str]) -> dict[str, tuple[float, float]]:
    """英文維基條目名稱 → (經度, 緯度)，Wikidata 的 P625"""
    path = CACHE_DIR / "wikidata" / f"michelin-{OLDID}.json"
    if not path.exists():
        values = " ".join(f"<https://en.wikipedia.org/wiki/{urllib.parse.quote(t.replace(' ', '_'), safe='')}>" for t in titles)
        query = f"""SELECT ?article ?coord WHERE {{
  VALUES ?article {{ {values} }}
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  ?item wdt:P625 ?coord .
}}"""
        req = urllib.request.Request(WDQS, data=urllib.parse.urlencode({"query": query}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = r.read()
                break
            except Exception as err:  # noqa: BLE001
                print(f"    Wikidata：{err}，等 {30 * (attempt + 1)} 秒", flush=True)
                time.sleep(30 * (attempt + 1))
        else:
            raise RuntimeError("Wikidata 一直失敗")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    out = {}
    for b in json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]:
        m = re.search(r"Point\(\s*(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s*\)", b["coord"]["value"], re.I)
        if m:
            title = urllib.parse.unquote(b["article"]["value"].rsplit("/wiki/", 1)[1]).replace("_", " ")
            out.setdefault(title, (float(m.group(1)), float(m.group(2))))
    return out


def build() -> None:
    wikitext = wikitable.fetch(PAGE, OLDID, "michelin-3-star")
    sections = list(re.finditer(r"^===\s*(.+?)\s*===\s*$", wikitext, re.M))
    restaurants = []
    for k, m in enumerate(sections):
        name = m.group(1)
        end = sections[k + 1].start() if k + 1 < len(sections) else len(wikitext)
        iso = SECTION_ISO.get(name) or from_name(name)
        if not iso:
            raise ValueError(f"米其林的章節對不到國家：{name}")
        for table in wikitable.tables(wikitext[m.end():end]):
            for row in wikitable.rows(table):
                if len(row) < 4:
                    continue
                place = wikitable.text(row[2])
                where = next((v for key, v in PLACE_ISO.items() if key in place), iso)
                year = re.match(r"\s*(\d{4})", wikitable.text(row[3]))
                restaurants.append({"name": wikitable.text(row[0]), "chef": wikitable.text(row[1]).replace("\n", "、"),
                                    "place": place, "iso3": where, "y": int(year.group(1)) if year else None,
                                    "links": wikitable.links(row[0]), "place_links": wikitable.links(row[2])})
    titles = sorted({t for r in restaurants for t in r["links"] + r["place_links"]})
    coords = _coords(titles)
    rows = []
    for r in restaurants:
        c = next((coords[t] for t in r["links"] if t in coords), None)
        exact = 1 if c else 0
        c = c or next((coords[t] for t in r["place_links"] if t in coords), None)
        rows.append({"lon": round(c[0], 4) if c else None, "lat": round(c[1], 4) if c else None, "pt": 1 if c else 0, "e": exact,
                     "iso3": r["iso3"], "n": r["name"], "chef": r["chef"], "p": r["place"], "y": r["y"]})
    rows.sort(key=lambda x: (x["iso3"], x["n"]))
    write_json(OUT / "michelin.json", points_file(
        [r for r in rows if r["pt"]], ["lon", "lat", "e", "iso3", "n", "chef", "p", "y"], {"lon": 0.0001, "lat": 0.0001, "e": 1, "y": 1},
        strings=("iso3",)))
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["iso3"]] = counts.get(r["iso3"], 0) + 1
    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items() if YEAR in s}
    write_json(OUT / "michelin-3.json", indicator_file("michelin-3", "家", [YEAR], {c: [n] for c, n in sorted(counts.items())},
                                                       license="CC BY-SA 4.0"))
    per = {c: [round(n / pop[c] * 10000, 2)] for c, n in sorted(counts.items()) if c in pop}  # 人口是千人：每千萬人
    write_json(OUT / "michelin-3-per-10m.json", indicator_file("michelin-3-per-10m", "家／千萬人", [YEAR], per, license="CC BY-SA 4.0"))
    top = sorted(((n, c) for c, n in counts.items()), reverse=True)
    print(f"  米其林三星：{len(rows)} 家、{len(counts)} 國或地區；{top}；有點 {sum(r['pt'] for r in rows)}（餐廳本身 {sum(r['e'] for r in rows)}）")
    print(f"  每千萬人 {sorted(((v[0], c) for c, v in per.items()), reverse=True)[:10]}；台灣 {per.get('TWN')}、{[r['n'] for r in rows if r['iso3'] == 'TWN']}")
