"""最古老的公司（新主題，經濟類，2026-10-29，製作手冊第五批 63）：1700 年以前成立、還在營業的公司。

使用者 2026-10-29 決定：以英文維基百科「List of oldest companies」為主（CC BY-SA 4.0，資料檔也用 CC BY-SA 4.0，
固定 revid，sources/wiki_oldest_companies.py），Wikidata 補座標；台灣的 19 世紀老店（郭元益、玉珍齋）放附註。

- 國家：表格的所在地的最後一段（大多只寫國名）。
- 座標：表格連到的公司條目在 Wikidata 的座標（P625），沒有的用總部（P159）或所在行政區（P131）的座標；
  都沒有的不畫點，國家的家數照算。
- 時間軸是成立年份（578–1699）：拖到某一年看那一年以前成立、到現在還在營業的公司（累積）。
"""
from __future__ import annotations

import json
import re
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, indicator_file, points_file, write_json, write_manifest_part
from geoindex import countries_at
from sources import wiki_oldest_companies as wiki
from sources.countries import from_name
from sources.wikidata_attractions import _sparql

OUT = OUT_DIR / "topics" / "companies"  # 企業與品牌（2026-10-30 最古老的公司、品牌的發源地合併）
LICENSE = "CC BY-SA 4.0"
LAST_YEAR = 1699
BATCH = 150
QUERY = """SELECT ?title ?item ?coord ?hq ?admin ?zhtw ?zhhant ?zh WHERE {{
  VALUES ?title {{ {titles} }}
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
  OPTIONAL {{ ?item wdt:P625 ?coord }}
  OPTIONAL {{ ?item wdt:P159/wdt:P625 ?hq }}
  OPTIONAL {{ ?item wdt:P131/wdt:P625 ?admin }}
  OPTIONAL {{ ?item rdfs:label ?zhtw FILTER(LANG(?zhtw) = "zh-tw") }}
  OPTIONAL {{ ?item rdfs:label ?zhhant FILTER(LANG(?zhhant) = "zh-hant") }}
  OPTIONAL {{ ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh") }}
}}"""
TAIWAN_NOTE = ("台灣沒有 1700 年以前成立、還在營業的公司（表裡沒有）。台灣還在營業的老店有 1867 年的郭元益、"
               "1877 年的玉珍齋（成立年份依 Wikidata）。")
TAIWAN_NOTE_EN = ("Taiwan has no company founded before 1700 that is still in business (none in the list). Its old shops "
                  "still trading include Kuo Yuan Ye, founded in 1867, and Yu Jen Jai, founded in 1877 (founding years from Wikidata).")


def _point(v: str | None) -> tuple[float, float] | None:
    if not v or not v.startswith("Point("):
        return None
    lon, lat = v[6:-1].split()
    return float(lon), float(lat)


def wikidata(titles: list[str]) -> dict[str, dict]:
    """英文維基條目 → {"coord": (lon, lat), "how": "own|hq|admin", "zh": 名稱}"""
    path = CACHE_DIR / "wikidata" / "oldest-companies.json"
    if not path.exists():
        rows: list[dict] = []
        for i in range(0, len(titles), BATCH):
            batch = titles[i : i + BATCH]
            values = " ".join(json.dumps(t, ensure_ascii=False) + "@en" for t in batch)
            rows.extend(_sparql(QUERY.format(titles=values)))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(rows), encoding="utf-8")
    out: dict[str, dict] = {}
    for r in json.loads(path.read_text(encoding="utf-8")):
        v = lambda k: r[k]["value"] if k in r else None  # noqa: E731
        d = out.setdefault(v("title"), {})
        for key in ("coord", "hq", "admin"):
            if key not in d and (p := _point(v(key))):
                d[key] = p
        for k in ("zhtw", "zhhant", "zh"):
            if v(k) and k not in d:
                d[k] = v(k)
    return out


def build() -> None:
    from opencc import OpenCC

    s2tw, s2twp = OpenCC("s2tw"), OpenCC("s2twp")

    def zh_name(d: dict, en: str) -> str | None:
        """中文標籤（繁體），跟英文名一樣或中英夾雜的（「千年之湯 古Man」）不用"""
        zh = d.get("zhtw") or d.get("zhhant")
        zh = s2tw.convert(zh) if zh else (s2twp.convert(d["zh"]) if d.get("zh") else None)
        return zh if zh and zh != en and not re.search(r"[A-Za-z]", zh) else None

    companies = wiki.companies()
    found = wikidata(sorted({c.title for c in companies if c.title}))
    years = list(range(min(c.year for c in companies), LAST_YEAR + 1))
    founded: dict[str, list[int]] = defaultdict(lambda: [0] * len(years))
    rows, unknown, how = [], [], defaultdict(int)
    listing = []
    for c in companies:
        iso3 = from_name(c.country)
        if not iso3:
            unknown.append(c.country)
            continue
        founded[iso3][c.year - years[0]] += 1
        d = found.get(c.title or "", {})
        listing.append([c.year, c.name, zh_name(d, c.name), c.field, iso3])
        coord = d.get("coord") or d.get("hq") or d.get("admin")
        how["own" if d.get("coord") else "hq" if d.get("hq") else "admin" if d.get("admin") else "none"] += 1
        if not coord:
            continue
        rows.append({"lon": round(coord[0], 3), "lat": round(coord[1], 3), "y": c.year, "iso3": iso3,
                     "en": c.name, "zh": zh_name(d, c.name), "f": c.field})
    if unknown:
        raise RuntimeError(f"國名對不到 ISO3：{sorted(set(unknown))}")
    # 座標所在的國家跟表格的國家不同的（Wikidata 的座標錯、或總部在國外），不畫點
    moved = [r for r, at in zip(rows, countries_at([r["lon"] for r in rows], [r["lat"] for r in rows])) if at and at != r["iso3"]]
    rows = [r for r in rows if r not in moved]
    rows.sort(key=lambda r: (r["y"], r["en"]))
    cumulative = {}
    for iso3, per_year in founded.items():
        total, series = 0, []
        for n in per_year:
            total += n
            series.append(total)
        cumulative[iso3] = series
    world = [sum(s[i] for s in cumulative.values()) for i in range(len(years))]
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "companies.json", indicator_file(
        "companies", "家", years, dict(sorted(cumulative.items())), aggregates={"WLD": world}, license=LICENSE,
        notes={"TWN": TAIWAN_NOTE}, notesEn={"TWN": TAIWAN_NOTE_EN}))
    write_json(OUT / "points.json", points_file(rows, ["lon", "lat", "y", "iso3", "en", "zh", "f"],
                                                {"lon": 0.001, "lat": 0.001, "y": 1}, delta=("y",), strings=("iso3", "f")))
    # 側欄：每家公司（含沒有座標的）[成立年份, 英文名, 中文名, 產業, 國家]
    write_json(OUT / "list.json", {"fields": ["year", "en", "zh", "field", "iso3"], "rows": listing})
    write_manifest_part(OUT, "companies", "oldest-companies", {
        "license": LICENSE, "sources": [f"{wiki.PAGE_URL} (CC BY-SA 4.0)", "Wikidata (CC0)"]})
    top = sorted(((s[-1], k) for k, s in cumulative.items()), reverse=True)
    print(f"  {len(companies)} 家（{years[0]}–{LAST_YEAR}），{len(cumulative)} 國：{top[:10]}")
    print(f"  座標：{dict(how)}；畫點 {len(rows)} 家；座標在別國的不畫 {len(moved)} 家："
          f"{[(r['en'], r['iso3']) for r in moved[:8]]}")


if __name__ == "__main__":
    build()
