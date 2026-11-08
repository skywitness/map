"""環球的電影與串流、台灣的票房（2026-11-08，製作手冊第二十八批 685，候選 1534、1535、1536、1540；1539 新加坡樂園業沒做；
擴充「環球影城」；步驟 universal-film，輸出 topics/universal/）。

- **環球一年發幾部片**（1534）：Wikidata（經 QLever）裡 P272 製作或 P750 發行是 Universal Pictures（Q168383）的作品，依 P577
  最早的上映年算。**這是「跟環球有關的片」不是「環球拍的片」**（只在某些地區發行的也算），而且 Wikidata 偏英語片與近年。
- **拍攝地**（1535）：同一批作品的 P915，用迪士尼 678 的 `places_layer()`（地點分六種、國家依座標、虛構與跨國的只進清單）。
- **Peacock**（1536）：英文維基「Peacock (streaming service)」revid 1383883074 的上線表（解析器 `sources/rollout.py`，跟 Disney+
  共用）。**只有美國是 Peacock 自己的訂閱服務**，其他國家是環球的內容放在 Sky、SkyShowtime、HBO Max、Universal+、JioHotstar
  這些別家的平台上；「Sub-Saharan Africa」（Showmax）是區域，不上色、只寫在說明。手冊寫的 42 國是舊的數；這個版本的表 59 個國家
  或地區加 1 個區域，跟 infobox 的 area_served 不一致時以表為準。
- **台灣的票房**（1540）：國家電影及視聽文化中心「全國電影票房統計數據」（data.gov.tw 94224，政府資料開放授權條款第 1 版），
  跟「台灣人看哪一國的電影」共用同一個下載（`.cache/tfai/since2016.json`）。發行單位是環球台灣分公司的兩個登記名稱合併算。
  **這是發行商口徑**：環球台灣分公司發行的片，不是「環球電影在台灣的票房」。
- 候選 1539（新加坡 SingStat 的 SSIC 93）沒做：SingStat Table Builder 自己的使用條款讀不到（手冊寫待確認），兩個「Million
  Dollars」指標也還分不出哪個是營業收入。
"""
from __future__ import annotations

import json
from collections import Counter

from common import OUT_DIR, download, indicator_file, points_file, write_json
from sources import qlever_wikidata as wd
from sources import rollout
from sources.wikipedia_html import page, tables
from topics.disney_plus import places_layer

OUT = OUT_DIR / "topics" / "universal"
PICTURES = "Q168383"
PEACOCK = ("Peacock (streaming service)", 1383883074)
YEARS = list(range(2020, 2027))
TW_ISSUERS = {"美商美國環球影片股份有限公司台灣分公司", "美商美國環球影片股份公司台灣分公司"}
TFAI = "https://boxofficetw.tfai.org.tw/OpenData/statistic/since2016"


def films_by_year() -> None:
    rows = wd.cached("universal-films-years", """SELECT ?y (COUNT(?film) AS ?n) WHERE {
  { SELECT ?film (MIN(YEAR(?d)) AS ?y) WHERE { { ?film wdt:P272 wd:%s } UNION { ?film wdt:P750 wd:%s } ?film wdt:P577 ?d } GROUP BY ?film }
} GROUP BY ?y ORDER BY ?y""" % (PICTURES, PICTURES))
    total = wd.cached("universal-films-total", """SELECT (COUNT(DISTINCT ?film) AS ?n) WHERE { { ?film wdt:P272 wd:%s } UNION { ?film wdt:P750 wd:%s } }"""
                      % (PICTURES, PICTURES))
    by_year = {int(float(r["y"]["value"])): int(r["n"]["value"]) for r in rows if "y" in r}
    decades = []
    for d in range(1910, 2030, 10):
        counts = [by_year.get(y, 0) for y in range(d, d + 10)]
        if sum(counts):
            # 清單的列放在 Universal City（片廠）
            decades.append({"lon": -118.3533, "lat": 34.1371, "d": d, "n": sum(counts), "years": ",".join(map(str, counts))})
    write_json(OUT / "films-decades.json", points_file(decades, ["lon", "lat", "d", "n", "years"], {"lon": 0.0001, "lat": 0.0001, "d": 1, "n": 1}))
    n_total = int(total[0]["n"]["value"])
    print(f"  環球的片：Wikidata {n_total} 部，有上映年 {sum(by_year.values())} 部（{min(by_year)}–{max(by_year)}）；"
          f"各十年 {[(r['d'], r['n']) for r in decades]}")


def peacock() -> None:
    from topics.reads import label_points

    labels = label_points()
    table = tables(page(*PEACOCK))[0]
    header = [c[0].strip() for c in table[0]]
    regions, rows = [], []
    for r in table[1:]:
        cells = {h: r[i][0].strip() for i, h in enumerate(header) if i < len(r)}
        try:
            iso = rollout.territory(r[1][0], list(r[1][1] or []))
        except ValueError:
            regions.append((cells["Country/territory"], cells["Release partner(s)"], rollout.parse_date(r[0][0])))
            continue
        d = rollout.parse_date(r[0][0])
        for c in iso:
            lon, lat = labels[c]
            rows.append({"lon": lon, "lat": lat, "iso3": c, "d": int(d.replace("-", "")),
                         "partners": cells["Release partner(s)"], "own": 1 if c == "USA" else 2})
    rows.sort(key=lambda r: (r["d"], r["iso3"]))
    write_json(OUT / "peacock-list.json", points_file(rows, ["lon", "lat", "iso3", "d", "partners", "own"],
                                                      {"lon": 0.01, "lat": 0.01, "d": 1, "own": 1}, strings=("partners",)))
    values, hints, hints_en, no_value, no_value_en = {}, {}, {}, {}, {}
    for r in rows:
        y = r["d"] // 10000
        values[r["iso3"]] = [r["own"] if yy >= y else None for yy in YEARS]
        ds = str(r["d"])
        hints[r["iso3"]] = f"{ds[:4]} 年 {int(ds[4:6])} 月 {int(ds[6:])} 日起，" + (
            "Peacock 自己的訂閱服務" if r["own"] == 1 else f"環球的內容放在 {r['partners']}")
        hints_en[r["iso3"]] = f"From {ds[:4]}-{ds[4:6]}-{ds[6:]}: " + (
            "Peacock’s own subscription service" if r["own"] == 1 else f"Universal content on {r['partners']}")
        if y > YEARS[0]:
            no_value[r["iso3"]] = f"{ds[:4]} 年才開始"
            no_value_en[r["iso3"]] = f"Only from {ds[:4]}"
    write_json(OUT / "peacock.json", indicator_file(
        "peacock", "", YEARS, values, hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en,
        license="英文維基百科「Peacock (streaming service)」revid 1383883074（CC BY-SA 4.0）"))
    print(f"  Peacock：{len(rows)} 個國家或地區（自己的訂閱服務 {sum(r['own'] == 1 for r in rows)}），區域 {regions}；"
          f"台灣 {hints.get('TWN')}")


def taiwan_box_office() -> None:
    films = json.loads(download(TFAI, "tfai", "since2016.json").read_text(encoding="utf-8"))["List"]
    total = sum(float(f.get("TotalAmounts") or 0) for f in films)
    mine = [f for f in films if (f.get("Issue") or "").strip() in TW_ISSUERS]
    amount = sum(float(f.get("TotalAmounts") or 0) for f in mine)
    tickets = sum(int(float(f.get("TotalTickets") or 0)) for f in mine)
    from topics.reads import label_points

    lon, lat = label_points()["TWN"]
    rows = [{"lon": lon, "lat": lat, "name": f["Name"].strip(), "date": int(f["ReleaseDate"][:10].replace("-", "")),
             "amount": round(float(f.get("TotalAmounts") or 0)), "tickets": int(float(f.get("TotalTickets") or 0))}
            for f in mine]
    rows.sort(key=lambda r: -r["amount"])
    write_json(OUT / "tw-films.json", points_file(rows, ["lon", "lat", "name", "date", "amount", "tickets"],
                                                  {"lon": 0.01, "lat": 0.01, "date": 1, "amount": 1, "tickets": 1}))
    share = amount / total * 100
    write_json(OUT / "tw-box-office.json", indicator_file(
        "tw-box-office", "元", [2026], {"TWN": [round(amount)]},
        hints={"TWN": f"{len(mine)} 部片、{tickets:,} 張票，占 2016 年以來全台票房的 {share:.1f}%（發行商口徑）"},
        hintsEn={"TWN": f"{len(mine)} films, {tickets:,} tickets, {share:.1f}% of Taiwan’s box office since 2016 (by distributor)"},
        license="國家電影及視聽文化中心 全國電影票房統計數據（政府資料開放授權條款第 1 版）"))
    print(f"  台灣：環球台灣分公司發行 {len(mine)} 部、{amount:,.0f} 元、{tickets:,} 張，占 {total:,.0f} 元的 {share:.2f}%；"
          f"前五 {[(r['name'], r['amount']) for r in rows[:5]]}")


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    films_by_year()
    places_layer("P915", "filming", "filming", "拍攝地", "filmed", studios=[PICTURES], out_dir=OUT, prefix="universal",
                 lib_zh="環球影業", lib_en="Universal Pictures’ catalogue")
    peacock()
    taiwan_box_office()
