"""研發投入最多的公司的擴充：大藥廠的總部（2026-11-03，製作手冊第十九批 302；輸出到 topics/rd-companies/）。

**資料**：英文維基百科「List of largest biomedical companies by revenue」的固定版本（`REVID`，2026-10-03）：
營收 100 億美元以上、上市的製藥、生技與醫材公司，34 家，2016–2025 年的營收（十億美元，各公司年報或新聞稿的數字）。
總部的座標用 Wikidata：條目名稱 → Wikidata 項目（維基百科 API 的 pageprops，會跟著轉址）→ 總部（P159）的座標（P625）。
**授權**：維基百科 CC BY-SA 4.0（資料檔 pharma-hq.json 用同樣授權，DESIGN.md 第 8 節第 12 點）；Wikidata CC0。
**不畫 Wikidata 全部的製藥公司**（手冊：987 家、很不完整），只補這 34 家的座標。
"""
from __future__ import annotations

import re
import urllib.parse

from common import OUT_DIR, download, points_file, write_json, write_manifest_part
from sources.wikidata_profiles import _rows, _sparql

OUT = OUT_DIR / "topics" / "rd-companies"
REVID = 1378116944
RAW = f"https://en.wikipedia.org/w/index.php?oldid={REVID}&action=raw"
YEARS = list(range(2025, 2015, -1))  # 表的欄位順序：2025 … 2016
# 表的國旗代碼（IOC）→ ISO；阿斯特捷利康寫英國與瑞典，總部在英國
FLAGS = {"USA": "USA", "CHN": "CHN", "SUI": "CHE", "GBR": "GBR", "GER": "DEU", "DEN": "DNK", "JPN": "JPN",
         "ISR": "ISR", "FRA": "FRA", "SWE": "SWE", "IRL": "IRL", "IND": "IND", "BEL": "BEL", "NED": "NLD"}
EXPECTED = 34


def _table() -> list[dict]:
    text = download(RAW, "wikipedia", f"biomedical-companies-{REVID}.txt").read_text(encoding="utf-8")
    start = text.index('{|class="wikitable sortable"')
    table = text[start:text.index("\n|}", start)]
    table = re.sub(r"<ref[^>]*/>", "", table)
    table = re.sub(r"<ref[^>]*>.*?</ref>", "", table, flags=re.S)
    out = []
    for row in table.split("\n|-")[1:]:
        cells = [c.strip() for c in re.split(r"\n\||\|\|", "\n" + row.strip())[1:]]
        link = re.search(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", cells[2])
        flags = re.findall(r"\{\{flaglist\|([^}|]+)", cells[3])
        values: dict[int, float] = {}
        for year, cell in zip(YEARS, cells[5:5 + len(YEARS)]):
            m = re.search(r"([\d]+(?:\.\d+)?)", re.sub(r"\{\{(?:yes|no|Yes|No)\|", "", cell))
            if m and not re.fullmatch(r"\s*(?:[-–—]|\{\{n/?a\}\})?\s*", cell):
                values[year] = float(m.group(1))
        if not link or not flags or not values:
            raise RuntimeError(f"維基表的一列讀不懂：{cells[:5]}")
        out.append({"title": link.group(1), "name": link.group(2) or link.group(1), "country": FLAGS[flags[0]],
                    "rank": int(re.sub(r"\D", "", cells[0])), "revenue": values})
    if len(out) != EXPECTED:
        raise RuntimeError(f"維基表有 {len(out)} 家，不是 {EXPECTED} 家，版本可能不對")
    return out


# 維基表的連結是轉址的條目 → 實際的條目名稱（固定版本，2026-11-03 對過）。國藥的連結是母公司中國醫藥集團，
# 營收是香港上市的國藥控股（1099），用國藥控股；大塚控股沒有英文條目，用大塚製藥（總部同在東京）。
TITLES = {
    "China National Pharmaceutical Group": "Sinopharm Group", "Hoffmann-La Roche": "Roche",
    "Eli Lilly & Co": "Eli Lilly and Company", "GlaxoSmithKline": "GSK plc",
    "Takeda Pharmaceutical": "Takeda Pharmaceutical Company", "GE Healthcare": "GE HealthCare",
    "Otsuka Holdings": "Otsuka Pharmaceutical",
}

# Wikidata 的公司項目沒有總部（P159）的：依公司官網寫的總部城市（Wikidata 的城市項目）
MANUAL_HQ = {"Shanghai Pharmaceuticals": "Q8686", "Jointown Pharmaceutical Group": "Q11746", "Kenvue": "Q1000642"}


def _iri(title: str) -> str:
    return "<https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"), safe="()_,'-.:") + ">"


def _qids(titles: list[str]) -> dict[str, str]:
    """維基百科條目名稱 → Wikidata QID（WDQS 的 schema:about；維基百科 API 會限流，不用）"""
    actual = {t: TITLES.get(t, t) for t in titles}
    query = f"SELECT ?article ?item WHERE {{ VALUES ?article {{ {' '.join(_iri(a) for a in actual.values())} }} ?article schema:about ?item . }}"
    found = {r["article"]["value"]: r["item"]["value"].rsplit("/", 1)[1]
             for r in _rows(_sparql(query, f"biomedical-sitelinks-{REVID}.json"))}
    return {t: found[_iri(a)[1:-1]] for t, a in actual.items() if _iri(a)[1:-1] in found}


def _coords(query: str, filename: str) -> dict[str, tuple[float, float, str]]:
    out = {}
    for r in _rows(_sparql(query, filename)):
        m = re.fullmatch(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", r["c"]["value"])
        if m:
            out[r["item"]["value"].rsplit("/", 1)[1]] = (float(m.group(1)), float(m.group(2)), r["hqLabel"]["value"])
    return out


def _hq(qids: list[str], cities: list[str]) -> dict[str, tuple[float, float, str]]:
    """QID → (經度, 緯度, 總部名稱)：公司的總部（P159）的座標；cities 是直接當總部的城市項目"""
    companies = f"""SELECT ?item (SAMPLE(?c0) AS ?c) (SAMPLE(?hqLabel0) AS ?hqLabel) WHERE {{
  VALUES ?item {{ {' '.join('wd:' + q for q in sorted(qids))} }}
  ?item wdt:P159 ?hq . ?hq wdt:P625 ?c0 .
  ?hq rdfs:label ?hqLabel0 . FILTER(LANG(?hqLabel0) = "en")
}} GROUP BY ?item"""
    places = f"""SELECT ?item (SAMPLE(?c0) AS ?c) (SAMPLE(?hqLabel0) AS ?hqLabel) WHERE {{
  VALUES ?item {{ {' '.join('wd:' + q for q in sorted(cities))} }}
  ?item wdt:P625 ?c0 ; rdfs:label ?hqLabel0 . FILTER(LANG(?hqLabel0) = "en")
}} GROUP BY ?item"""
    return {**_coords(companies, f"biomedical-hq-{REVID}.json"), **_coords(places, f"biomedical-cities-{REVID}.json")}


def build() -> None:
    companies = _table()
    qids = _qids([c["title"] for c in companies])
    hq = _hq(list(qids.values()), list(MANUAL_HQ.values()))
    rows, missing = [], []
    for c in companies:
        q = MANUAL_HQ.get(c["title"]) or qids.get(c["title"])
        if not q or q not in hq:
            missing.append((c["name"], q))
            continue
        lon, lat, city = hq[q]
        year = max(c["revenue"])
        rows.append({"lon": lon, "lat": lat, "name": c["name"], "iso3": c["country"], "city": city, "rank": c["rank"],
                     "rev": c["revenue"][year], "y": year, "rev16": c["revenue"].get(2016)})
    if missing:
        raise RuntimeError(f"這些公司在 Wikidata 找不到總部座標：{missing}")
    rows.sort(key=lambda r: r["rank"])
    write_json(OUT / "pharma-hq.json", {
        **points_file(rows, ["lon", "lat", "name", "iso3", "city", "rank", "rev", "y", "rev16"],
                      {"lon": 0.0001, "lat": 0.0001, "rank": 1, "rev": 0.01, "y": 1, "rev16": 0.01},
                      strings=("iso3", "city")),
        "license": "CC BY-SA 4.0", "source": f"English Wikipedia, List of largest biomedical companies by revenue (oldid {REVID}); Wikidata",
    })
    write_manifest_part(OUT, "rd-companies", "pharma-companies", {
        "source": f"English Wikipedia, List of largest biomedical companies by revenue (oldid {REVID}); Wikidata (P159, P625)",
        "license": "CC BY-SA 4.0 (pharma-hq.json); CC0",
    })
    by_country: dict[str, int] = {}
    for r in rows:
        by_country[r["iso3"]] = by_country.get(r["iso3"], 0) + 1
    print(f"  大藥廠：{len(rows)} 家；{sorted(by_country.items(), key=lambda kv: -kv[1])}")
    print("  前 5：" + "、".join(f"{r['name']} {r['rev']}（{r['y']}，{r['city']}）" for r in rows[:5]))


if __name__ == "__main__":
    build()
