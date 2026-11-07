"""太空的擴充：各國的太空機構，成立年份與總部（2026-11-07，製作手冊第二十七批 603，候選 1329；步驟 space-agencies，
輸出 topics/space/）。

- 名單：Wikidata「太空機構」類（Q17505024，CC0）與英文維基「List of government space agencies」（固定版本 1382533503，
  太空主題已經引用；CC BY-SA 4.0，只用機構與成立年份這些事實）的聯集。手冊的陷阱：Wikidata 的類收錄不一致（德國的 DLR、
  比利時、秘魯都不在類裡，荷蘭沒有 P17），所以拿英文維基的列表當核對清單，表裡的機構連結經 enwiki 的 sitelink 對到 QID。
- 人工核過（EXCLUDE）：國際與區域組織（歐洲太空總署、歐盟太空計畫署、非洲太空局、拉美與加勒比海太空局、泛阿拉伯、
  聯合國外太空事務辦公室）、地方機構（加泰隆尼亞、美國各州、印度喀拉拉）、不是主管機關的（中國運載火箭技術研究院、
  中國空間技術研究院、中國載人航天工程辦公室、以色列國防部太空處、美國的 Space Test Program、亞塞拜然的衛星公司
  Azercosmos 等）。
- 成立年份＝這一國最早的國家太空機構（含前身，例如日本 1969 年的宇宙開發事業團、印度 1962 年的 INCOSPAR）：表裡的機構用
  「Founded」欄的所有年份（沒寫才用 P571），只在 Wikidata 類裡的機構用 P571，取最小值。蘇聯的太空計畫（1955）照太空主題的慣例算在俄羅斯。
- 時間軸：1955–2026，每年有機構的國家才有值（值是成立年份）。總部是現在這個機構的 P159（總部所在地）的座標。
"""
from __future__ import annotations

import html
import json
import re
import urllib.parse

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_points
from sources import qlever_wikidata as wd
from sources.countries import from_name, to_iso3

OUT = OUT_DIR / "topics" / "space"
WP_URL = "https://en.wikipedia.org/wiki/List_of_government_space_agencies?oldid=1382533503"
CLASS = "Q17505024"
FIRST, LAST = 1955, 2026
EXCLUDE = {
    "Q42262", "Q55610347", "Q117032291", "Q113378947", "Q7129490", "Q699152",  # 國際與區域組織
    "Q100937065", "Q111020770",  # 地方、研究所
    "Q5099556", "Q5099557", "Q5099768", "Q4269669", "Q30527379", "Q7572525", "Q12836929", "Q3442298",  # 不是主管機關或重複
}
SKIP_LINKS = {"California", "Kerala", "Consultative_Committee_for_Space_Data_Systems", "Committee_on_Space_Research",
              "New_Mexico_Spaceport_Authority", "Oklahoma_Space_Industry_Development_Authority", "Virginia_Spaceport_Authority",
              "Space_Florida"}
COUNTRY_FIX = {"Soviet Union †": "RUS"}
# 表的機構欄第一個連結不一定是機構（突尼西亞的是「法語」、捷克的是交通部），挑名稱像機構的連結
AGENCY_WORDS = re.compile(r"Space|Agency|Cent(er|re)|Institut|Research|Commission|Organi[sz]ation|Office|Administration|Cosmos|NASA|ISRO|CNES|Remote")
# 人工核對：玻利維亞那一列連到委內瑞拉的 ABAE；摩洛哥、巴拉圭、突尼西亞的名稱欄把好幾種語言黏在一起
CURRENT_FIX = {"BOL": "Q4090805"}
NAME_FIX = {"MAR": "Royal Centre for Remote Sensing", "PRY": "Paraguayan Space Agency", "TUN": "National Remote Sensing Center of Tunisia"}


def _table() -> list[dict]:
    s = download(WP_URL, "wikipedia", "list_of_government_space_agencies_1382533503.html").read_text(encoding="utf-8")
    table = re.findall(r'<table class="wikitable.*?</table>', s, re.S)[0]
    out = []
    for row in table.split("</tr>")[1:]:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if len(cells) < 4:
            continue
        text = lambda c: re.sub(r"\[\d+\]", "", re.sub(r"\s+", " ", html.unescape(re.sub("<[^>]+>", "", c)))).strip()
        links = [urllib.parse.unquote(html.unescape(x)) for x in re.findall(r'href="https://en.wikipedia.org/wiki/([^"#?]+)"', cells[1])]
        links = [x for x in links if AGENCY_WORDS.search(x.replace("_", " "))]
        country = text(cells[0])
        iso = COUNTRY_FIX.get(country) or from_name(country)
        if not iso or (links and links[0] in SKIP_LINKS):
            continue
        years = [int(y) for y in re.findall(r"(1[89]\d\d|20[0-2]\d)", text(cells[3]))]
        out.append({"iso3": iso, "link": links[0] if links else None, "links": links, "name": text(cells[1]), "years": years})
    return out


def build() -> None:
    rows = _table()
    titles = sorted({t for r in rows for t in r["links"]})
    iris = " ".join("<https://en.wikipedia.org/wiki/%s>" % urllib.parse.quote(t, safe="()_,'!:-.") for t in titles)
    links = {urllib.parse.unquote(b["art"]["value"].rsplit("/wiki/", 1)[1]): b["item"]["value"].rsplit("/", 1)[1]
             for b in wd.cached("space-agencies-sitelinks-1382533503", "SELECT ?art ?item WHERE { VALUES ?art { %s } ?art schema:about ?item }" % iris)}
    cls = {b["a"]["value"].rsplit("/", 1)[1] for b in wd.cached("space-agencies-class-v1", f"SELECT ?a WHERE {{ ?a wdt:P31 wd:{CLASS} }}")}
    qids = sorted((cls | {links[t] for t in titles if t in links}) - EXCLUDE)
    info: dict[str, dict] = {}
    for b in wd.cached(f"space-agencies-info-{len(qids)}", """
SELECT ?a ?en ?zh ?zht ?iso ?inc ?dis ?web ?emp ?hqen ?hqzh ?hqc ?c WHERE {
  VALUES ?a { %s }
  OPTIONAL { ?a rdfs:label ?en FILTER(lang(?en)='en') }
  OPTIONAL { ?a rdfs:label ?zh FILTER(lang(?zh)='zh-tw') }
  OPTIONAL { ?a rdfs:label ?zht FILTER(lang(?zht)='zh-hant') }
  OPTIONAL { ?a wdt:P17 ?country . ?country wdt:P298 ?iso }
  OPTIONAL { ?a wdt:P571 ?inc }
  OPTIONAL { ?a wdt:P576 ?dis }
  OPTIONAL { ?a wdt:P856 ?web }
  OPTIONAL { ?a wdt:P1128 ?emp }
  OPTIONAL { ?a wdt:P625 ?c }
  OPTIONAL { ?a wdt:P159 ?hq . OPTIONAL { ?hq rdfs:label ?hqen FILTER(lang(?hqen)='en') }
             OPTIONAL { ?hq rdfs:label ?hqzh FILTER(lang(?hqzh)='zh-tw') } OPTIONAL { ?hq wdt:P625 ?hqc } }
}""" % " ".join(f"wd:{q}" for q in qids)):
        q = b["a"]["value"].rsplit("/", 1)[1]
        d = info.setdefault(q, {"inc": set(), "dis": set()})
        for k in ("en", "zh", "zht", "iso", "web", "emp", "hqen", "hqzh", "hqc", "c"):
            if k in b and k not in d:
                d[k] = b[k]["value"]
        if "inc" in b:
            d["inc"].add(int(b["inc"]["value"][:4]))
        if "dis" in b:
            d["dis"].add(int(b["dis"]["value"][:4]))

    by_country: dict[str, dict] = {}
    since: dict[str, int] = {}  # 現在這個機構的成立年份（表的最後一個年份，沒有才用 P571）

    def add(iso: str, q: str | None, years: list[int], current: bool, name: str | None = None) -> None:
        c = by_country.setdefault(iso, {"years": set(), "current": None, "bodies": [], "name": None})
        c["years"].update(years)
        if name and c["name"] is None:
            c["name"] = name
        if q:
            c["bodies"].append(q)
            if current and c["current"] is None:
                c["current"] = q

    # 英文維基的表：每一列是一個國家機構，第一個連結是現在的機構
    for r in sorted(rows, key=lambda r: -max(r["years"] or [0])):
        q = links.get(r["link"]) if r["link"] else None
        if q in EXCLUDE:
            continue
        # 表有年份就用表的（Wikidata 的 P571 有時是更早的前身，例如 DLR 的 1907 年是航空研究所）
        add(r["iso3"], q, r["years"] or sorted(info.get(q, {}).get("inc", set())), True, r["name"])
        if q and r["years"]:
            since[q] = max(r["years"])
    # Wikidata 類裡、表沒有的機構
    for q in sorted(cls - EXCLUDE, key=lambda q: -max(info.get(q, {}).get("inc") or {0})):
        d = info.get(q, {})
        iso = d.get("iso") and to_iso3(d["iso"])
        if not iso or q in by_country.get(iso, {}).get("bodies", []):
            continue
        add(iso, q, sorted(d.get("inc", set())), not d.get("dis"))
    for iso, c in by_country.items():
        if c["current"] is None:
            c["current"] = c["bodies"][0] if c["bodies"] else None
        if iso in CURRENT_FIX:
            c["current"] = CURRENT_FIX[iso]

    founded = {iso: min(c["years"]) for iso, c in by_country.items() if c["years"]}
    years = list(range(FIRST, LAST + 1))
    values = {iso: [y0 if y >= y0 else None for y in years] for iso, y0 in sorted(founded.items())}
    write_json(OUT / "space-agency.json", indicator_file("space-agency", "年", years, values, license="CC0"))

    points, detail = [], {}
    for iso, c in sorted(by_country.items()):
        q = c["current"]
        d = info.get(q, {})
        name = NAME_FIX.get(iso) or d.get("en") or c["name"] or q
        zh = d.get("zh") or d.get("zht")
        detail[iso] = {**({"q": q} if q else {}), "name": name, **({"zh": zh} if zh else {}), "founded": founded.get(iso),
                       **({"since": cur} if (cur := since.get(q) or max(d.get("inc") or {0}) or None) and cur > (founded.get(iso) or 0) else {}), **({"web": d["web"]} if d.get("web") else {}),
                       **({"emp": int(float(d["emp"]))} if d.get("emp") else {}), "hq": d.get("hqzh") or d.get("hqen")}
        coord = d.get("hqc") or d.get("c")
        if coord:
            lon, lat = map(float, re.search(r"POINT\(([-\d.eE]+) ([-\d.eE]+)\)", coord, re.I).groups())
            points.append({"lon": round(lon, 4), "lat": round(lat, 4), "iso3": iso, "name": name, "zh": zh or "",
                           "y": founded.get(iso) or 0, "hq": detail[iso]["hq"] or ""})
    write_json(OUT / "space-agency-detail.json", {"countries": detail})
    write_points(OUT / "space-agencies.json", points_file(points, ["lon", "lat", "iso3", "name", "zh", "hq", "y"], {"lon": 0.001, "lat": 0.001}), text=("name", "zh", "hq"))
    order = sorted(founded.items(), key=lambda x: x[1])
    print(f"  {len(founded)} 國有國家太空機構，{len(points)} 個總部的點；最早：" + "、".join(f"{c} {y}" for c, y in order[:12]))
    print("  2010 年以後：" + "、".join(f"{c} {y}" for c, y in order if y >= 2010))
    print(f"  台灣：{detail.get('TWN')}")
    nodate = [iso for iso in by_country if iso not in founded]
    if nodate:
        print(f"  沒有成立年份：{nodate}")
