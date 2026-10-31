"""電池儲能電站（2026-10-31，製作手冊第十批 165 的 718；使用者決定用英文維基的清單加 Wikidata，說明寫明不完整）。

- 英文維基「List of energy storage power plants」（CC BY-SA 4.0，revid 1372757055，2026-09-02）的「Largest energy storage
  plants」表（100 MW 或 100 MWh 以上、運轉中）裡類型是 Battery 的列：名稱、MWh、MW、國家、地點、年份。表沒有座標：
  名稱有連結的用那個條目在 Wikidata 的座標；沒有的用「地點」欄第一個連結（縣、城市）的座標，標成約略的位置。
- Wikidata（CC0）：P31 是電池儲能系統（Q810924）的項目（645 筆，2026-10-31 查），有座標（P625）的才畫。
  只收 P31 只有這一類的：同時是太陽能電廠（Q1003207）或一般電廠（Q159719）的混合案場，裝置容量（P2109）是整座電廠的，
  不是電池的。名稱跟維基的列相同的併成一筆（用維基的數字與年份）。
- 兩邊都偏重美國、英國、澳洲；中國（電池儲能最多的國家）幾乎沒有，說明要寫。
- 資料檔含維基的數字，所以整個檔照 CC BY-SA 4.0（`license` 欄位）。
- 查詢服務（WDQS）每個 IP 每分鐘 1 次，兩次查詢之間等 62 秒；回應存在 .cache/wikidata/。
"""
from __future__ import annotations

import re
import time
from pathlib import Path

from common import download
from sources.wikidata_profiles import _rows, _sparql

REVID = 1372757055
WIKI_URL = f"https://en.wikipedia.org/w/index.php?oldid={REVID}&action=raw"
WIKI_PAGE = "https://en.wikipedia.org/wiki/List_of_energy_storage_power_plants"
BESS = "Q810924"
E = "http://www.wikidata.org/entity/"
MW_UNIT = E + "Q6982035"
MWH_UNIT = E + "Q6009164"  # megawatt hour

ITEMS_QUERY = f"""SELECT ?s ?sLabel ?coord ?iso ?powerAmt ?powerUnit ?energyAmt ?energyUnit ?open ?inception ?state ?en WHERE {{
  ?s wdt:P31/wdt:P279* wd:{BESS} .
  OPTIONAL {{ ?s wdt:P625 ?coord }}
  OPTIONAL {{ ?s wdt:P17/wdt:P298 ?iso }}
  OPTIONAL {{ ?s p:P2109/psv:P2109 [ wikibase:quantityAmount ?powerAmt ; wikibase:quantityUnit ?powerUnit ] }}
  OPTIONAL {{ ?s p:P4140/psv:P4140 [ wikibase:quantityAmount ?energyAmt ; wikibase:quantityUnit ?energyUnit ] }}
  OPTIONAL {{ ?s wdt:P1619 ?open }} OPTIONAL {{ ?s wdt:P571 ?inception }} OPTIONAL {{ ?s wdt:P5817 ?state }}
  OPTIONAL {{ ?en schema:about ?s ; schema:isPartOf <https://en.wikipedia.org/> }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,mul". }}
}}"""
P31_QUERY = f"""SELECT ?s (GROUP_CONCAT(DISTINCT ?c; separator=" ") AS ?p31) WHERE {{
  ?s wdt:P31/wdt:P279* wd:{BESS} . ?s wdt:P31 ?c . }} GROUP BY ?s"""


def _plain(cell: str) -> str:
    cell = re.sub(r"<ref[^>]*/>|<ref.*?</ref>", "", cell, flags=re.S)
    cell = re.sub(r"\{\{Interlanguage link\|([^|}]+)[^}]*\}\}", r"\1", cell, flags=re.I)
    cell = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", cell)
    cell = re.sub(r"\{\{[^}]*\}\}", "", cell).replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", cell).strip()


def _links(cell: str) -> list[str]:
    return [m.split("#")[0].strip() for m in re.findall(r"\[\[([^|\]]+)", cell)]


def _number(cell: str) -> float | None:
    m = re.search(r"\d[\d,]*(?:\.\d+)?", _plain(cell))
    return float(m.group(0).replace(",", "")) if m else None


def wiki_rows() -> list[dict]:
    """維基清單裡運轉中、類型是電池的列"""
    text = download(WIKI_URL, "wikipedia", f"energy-storage-{REVID}.wiki").read_text(encoding="utf-8")
    start = text.index("== Largest energy storage plants ==")
    end = text.index("===Under construction===", start)
    out = []
    for block in text[start:end].split("\n|-")[1:]:
        cells = [c for c in re.split(r"\n\||\|\|", "\n" + block.strip()) if c.strip()]
        if len(cells) < 8 or cells[0].lstrip().startswith("!") or "battery" not in _plain(cells[1]).lower():
            continue
        name_cell, _type, mwh, mw, _hrs, country, location, year = (c.strip() for c in cells[:8])
        y = re.search(r"\b(19|20)\d{2}\b", _plain(year))
        out.append({
            "name": _plain(name_cell), "nameLinks": _links(name_cell), "mwh": _number(mwh), "mw": _number(mw),
            "country": _plain(country), "locationLinks": _links(location) + _links(country),
            "year": int(y.group(0)) if y else None,
        })
    return out


def _coord(text: str | None) -> tuple[float, float] | None:
    m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", text or "")
    return (float(m.group(1)), float(m.group(2))) if m else None


def _sitelinks(titles: list[str]) -> dict[str, dict]:
    """英文維基條目名稱 → {item, coord, iso, bess}"""
    values = " ".join(f'"{t}"@en' for t in sorted(set(titles)))
    query = f"""SELECT ?title ?s ?coord ?iso ?bess WHERE {{
  VALUES ?title {{ {values} }}
  ?a schema:name ?title ; schema:isPartOf <https://en.wikipedia.org/> ; schema:about ?s .
  OPTIONAL {{ ?s wdt:P625 ?coord }} OPTIONAL {{ ?s wdt:P17/wdt:P298 ?iso }}
  OPTIONAL {{ ?s wdt:P31/wdt:P279* wd:{BESS} . BIND(1 AS ?bess) }}
}}"""
    out: dict[str, dict] = {}
    for r in _rows(_sparql(query, f"battery-storage-sitelinks-{REVID}.json")):
        v = {k: x["value"] for k, x in r.items()}
        out.setdefault(v["title"], {"item": v["s"], "coord": _coord(v.get("coord")), "iso": v.get("iso"), "bess": "bess" in v})
    return out


def _wait(path: Path) -> None:
    """WDQS 限流：還沒有快取的查詢之間等 62 秒"""
    if not path.exists():
        time.sleep(62)


def stations(country_iso) -> list[dict]:
    """電池儲能電站：{lon, lat, mw, mwh, year, name, iso3, src（1 維基、2 Wikidata）, approx（1 = 位置是地點欄的縣市）}"""
    from common import CACHE_DIR

    rows = wiki_rows()
    items = _rows(_sparql(ITEMS_QUERY, "battery-storage.json"))
    _wait(CACHE_DIR / "wikidata" / "battery-storage-p31.json")
    p31 = {r["s"]["value"]: set(r["p31"]["value"].split()) for r in _rows(_sparql(P31_QUERY, "battery-storage-p31.json"))}
    titles = [t for r in rows for t in r["nameLinks"] + r["locationLinks"]]
    _wait(CACHE_DIR / "wikidata" / f"battery-storage-sitelinks-{REVID}.json")
    links = _sitelinks(titles)

    # Wikidata 的項目（同一項目有好幾列：一個值一列）
    wd: dict[str, dict] = {}
    for r in items:
        v = {k: x["value"] for k, x in r.items()}
        it = wd.setdefault(v["s"], {"name": v.get("sLabel", ""), "coord": _coord(v.get("coord")), "iso": v.get("iso"),
                                     "mw": None, "mwh": None, "year": None})
        if v.get("powerUnit") == MW_UNIT:
            it["mw"] = max(it["mw"] or 0, float(v["powerAmt"]))
        if v.get("energyUnit") == MWH_UNIT:
            it["mwh"] = max(it["mwh"] or 0, float(v["energyAmt"]))
        for key in ("open", "inception"):
            if v.get(key) and not it["year"]:
                it["year"] = int(v[key][:4])

    def norm(name: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", name.lower()).replace("battery energy storage system", "bess").strip()

    by_name = {norm(it["name"]): s for s, it in wd.items()}
    out: list[dict] = []
    used: set[str] = set()
    for r in rows:
        item = None
        for t in r["nameLinks"]:
            if links.get(t, {}).get("bess"):
                item = links[t]["item"]
        item = item or by_name.get(norm(r["name"]))
        coord, approx, iso = None, 0, None
        if item and item in wd and wd[item]["coord"]:
            coord, iso = wd[item]["coord"], wd[item]["iso"]
            used.add(item)
        else:
            for t in r["nameLinks"]:
                if links.get(t, {}).get("coord"):
                    coord, iso = links[t]["coord"], links[t]["iso"]
                    break
            if not coord:
                for t in r["locationLinks"]:
                    if links.get(t, {}).get("coord"):
                        coord, iso, approx = links[t]["coord"], links[t]["iso"], 1
                        break
        iso = iso or country_iso(r["country"])
        if not coord:
            print(f"  電池儲能：維基的「{r['name']}」找不到座標，不畫")
            continue
        out.append({"lon": coord[0], "lat": coord[1], "mw": r["mw"], "mwh": r["mwh"], "year": r["year"], "name": r["name"],
                    "iso3": iso, "src": 1, "approx": approx})
    pure = 0
    for s, it in wd.items():
        if s in used or not it["coord"] or p31.get(s, set()) != {E + BESS}:
            continue
        pure += 1
        out.append({"lon": it["coord"][0], "lat": it["coord"][1], "mw": it["mw"], "mwh": it["mwh"], "year": it["year"],
                    "name": it["name"], "iso3": it["iso"], "src": 2, "approx": 0})
    print(f"  電池儲能：維基 {len(rows)} 列（{sum(1 for o in out if o['src'] == 1)} 列畫得出來），Wikidata 只有電池的項目 {pure} 個")
    return out


WIKI_LICENSE = {
    "license": "CC BY-SA 4.0",
    "attribution": f"Wikipedia contributors, “List of energy storage power plants” (revision {REVID}), {WIKI_PAGE}; Wikidata (CC0)",
}
