"""最古老的大學（新主題，地理的「景點」，第十批順序 185，2026-10-31，製作手冊第一百三十三節）。

使用者 2026-10-30 決定：獨立成主題；「大學」照歐洲中世紀大學的定義（英文維基列表的標準），伊斯蘭世界的古老學府
（愛資哈爾、卡拉維因）照列表寫的成為大學的年份，原本的年份另外寫明；台灣是國立臺灣大學（1928 年臺北帝國大學）。
左邊的清單依成立年份。

資料：英文維基「List of oldest universities in continuous operation」（revid 1380111933，CC BY-SA 4.0，只引用校名、年份、
所在地這些事實）：「Founded as universities before 1500」表與「Oldest universities by country or region after 1500 still in
operation」依洲分的表。列表的標準：「the date at which the educational institute is generally recognised as having become a
university by academic historians」。座標用 Wikidata（CC0，依條目對到項目；條目沒有座標的用表上的城市）。

輸出（public/data/topics/oldest-universities/）：universities.json（點：校名、年份、年份的原文、國家、是不是那一國最古老的）、
oldest.json（各國最古老的大學的成立年份，時間軸每 10 年一格：那一年還沒有大學的國家沒有值）。
"""
from __future__ import annotations

import re
import urllib.parse

from common import OUT_DIR, download, indicator_file, now_iso, points_file, write_json
from sources import wikitable as W
from topics.attractions_extra import _country, with_redirects

OUT = OUT_DIR / "topics" / "oldest-universities"
TITLE, REV = "List_of_oldest_universities_in_continuous_operation", 1380111933
LAST_YEAR = 2026


def _page() -> str:
    url = f"https://en.wikipedia.org/w/index.php?title={TITLE}&action=raw&oldid={REV}"
    return download(url, "wikipedia", f"oldest-universities-{REV}.txt").read_text(encoding="utf-8")


def _flag_country(cell: str) -> str | None:
    m = re.search(r"\{\{(?:flagcountry|flagicon|flag)\|([^}|]+)", cell)
    return _country("{{flag|" + m.group(1).strip() + "}}") if m else None


def _links(cell: str) -> list[str]:
    cell = re.sub(r"\[\[File:[^\]]*\]\]", "", cell)
    return [l.split("|")[0].strip() for l in re.findall(r"\[\[([^\]]+)\]\]", cell)]


def _year_text(cell: str) -> str:
    """年份那一格的原文：{{circa|1088}} 寫成 c. 1088、換行換成空格"""
    cell = re.sub(r"\{\{(?:circa|c\.)\|([^}|]+)[^}]*\}\}", r"c. \1", W.strip_refs(cell))
    cell = re.sub(r"<br\s*/?>", " ", cell)
    return re.sub(r"\s+", " ", W.text(cell)).strip()


def rows() -> list[dict]:
    text = _page()
    out = []
    before = text[text.index("== Founded as universities before 1500 =="):text.index("== Oldest universities by country")]
    for table in W.tables(before):
        for row in W.rows(table):
            if len(row) < 4:
                continue
            year_text = _year_text(row[0])
            y = re.search(r"\b(1[0-5]\d\d)\b", year_text)
            uni = _links(row[1])
            if not y or not uni:
                continue
            current = row[3]
            city = [l for l in _links(current)]
            out.append({"title": uni[0], "name": W.text(row[1]).strip(), "y": int(y.group(1)), "yt": year_text,
                        "iso3": _flag_country(current), "city": city[0] if city else None, "early": 1})
    after = text[text.index("== Oldest universities by country"):text.index("== See also ==")]
    for table in W.tables(after):
        for row in W.rows(table):
            if not row:
                continue
            # 年份那一格：第一個以四位數開頭的格子（前面是現在的國家、原本的政權、校名）
            idx = next((i for i, c in enumerate(row) if re.match(r"\s*\d{4}", W.strip_refs(c)) and i >= 1), None)
            if idx is None or idx < 1:
                continue
            uni = _links(row[idx - 1])
            if not uni:
                continue
            year_text = _year_text(row[idx])
            city = _links(row[0])
            out.append({"title": uni[0], "name": W.text(row[idx - 1]).strip(), "y": int(re.match(r"\s*(\d{4})", W.strip_refs(row[idx])).group(1)),
                        "yt": year_text, "iso3": _flag_country(row[0]), "city": city[-1] if city else None, "early": 0})
    return out


def build() -> None:
    from geoindex import countries_at

    data = rows()
    # 同一所大學在兩張表都有（1500 年以前成立的，國家表也列了）：留年份早的那一列
    best: dict[str, dict] = {}
    for r in data:
        if r["title"] not in best or r["y"] < best[r["title"]]["y"]:
            best[r["title"]] = r
    data = list(best.values())
    items = with_redirects([r["title"] for r in data] + [r["city"] for r in data if r["city"]])
    key = lambda t: t and t[0].upper() + t[1:]  # noqa: E731
    # 條目的項目沒有座標：用總部所在地（P159）或所在的行政區（P131）的座標
    no_coord = sorted({it["qid"] for it in items.values() if it.get("lon") is None})
    if no_coord:
        from sources.wikidata_profiles import _rows, _sparql

        q = "SELECT ?item (SAMPLE(?c) AS ?coord) WHERE { VALUES ?item { %s } ?item (wdt:P159|wdt:P131) ?loc . ?loc wdt:P625 ?c } GROUP BY ?item"
        found = {}
        for r in _rows(_sparql(q % " ".join(f"wd:{x}" for x in no_coord), "oldest-universities-locations.json")):
            m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["coord"]["value"])
            found[r["item"]["value"].rsplit("/", 1)[1]] = (float(m.group(1)), float(m.group(2)))
        for it in items.values():
            if it.get("lon") is None and it["qid"] in found:
                it["lon"], it["lat"] = found[it["qid"]]
    out, by_city, missing = [], [], []
    for r in data:
        it = items.get(key(r["title"])) or {}
        lon, lat = it.get("lon"), it.get("lat")
        if lon is None and r["city"] and items.get(key(r["city"])) and items[key(r["city"])]["lon"] is not None:
            lon, lat = items[key(r["city"])]["lon"], items[key(r["city"])]["lat"]
            by_city.append(r["name"])
        if lon is None:
            missing.append(r["name"])
            continue
        out.append({"lon": lon, "lat": lat, "en": r["name"], "zh": it.get("zh"), "iso3": r["iso3"], "y": r["y"], "yt": r["yt"], "early": r["early"]})
    no_country = [o for o in out if not o["iso3"]]
    for o, c in zip(no_country, countries_at([o["lon"] for o in no_country], [o["lat"] for o in no_country])):
        o["iso3"] = c
    oldest: dict[str, dict] = {}
    for o in out:
        if o["iso3"] and (o["iso3"] not in oldest or o["y"] < oldest[o["iso3"]]["y"]):
            oldest[o["iso3"]] = o
    for o in out:
        o["first"] = 1 if oldest.get(o["iso3"]) is o else 0
    out.sort(key=lambda o: (o["y"], o["en"]))
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "universities.json", points_file(
        out, ["lon", "lat", "en", "zh", "iso3", "y", "yt", "early", "first"], {"lon": 0.001, "lat": 0.001, "y": 1, "early": 1, "first": 1}, ("y",), ("iso3",)))
    first = min(o["y"] for o in out)
    years = list(range(first - first % 10, LAST_YEAR, 10)) + [LAST_YEAR]
    values = {c: [o["y"] if o["y"] <= y else None for y in years] for c, o in sorted(oldest.items())}
    tw = oldest.get("TWN")
    write_json(OUT / "oldest.json", indicator_file(
        "oldest", "年", years, values,
        notes={"TWN": "國立臺灣大學：1928 年成立的臺北帝國大學，1945 年改制為國立臺灣大學。"},
        notesEn={"TWN": "National Taiwan University: founded in 1928 as Taihoku Imperial University, renamed in 1945."},
    ))
    write_json(OUT / "manifest.json", {
        "topic": "oldest-universities", "generatedAt": now_iso(), "license": "CC BY-SA 4.0 (English Wikipedia facts); CC0 (Wikidata)",
        "sources": [f"https://en.wikipedia.org/w/index.php?title={TITLE}&oldid={REV}", "Wikidata (coordinates)"],
    })
    print(f"  大學：{len(out)} 所（1500 年以前 {sum(o['early'] for o in out)}），{len(oldest)} 國；用城市座標的 {len(by_city)}：{by_city[:6]}；"
          f"對不到的 {missing}；最早 {[(o['en'], o['yt']) for o in out[:4]]}；台灣 {tw and (tw['en'], tw['y'])}")
    print(f"  1500 年以前的國家 {sorted(((sum(1 for o in out if o['early'] and o['iso3'] == c), c) for c in {o['iso3'] for o in out if o['early']}), reverse=True)[:6]}")
