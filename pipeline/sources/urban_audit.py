"""Eurostat 城市統計（Urban Audit，urb_ctran 等，CC BY 4.0）與城市的位置（2026-11-04，製作手冊第二十一批 365）。

- 資料：`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/<資料集>?format=JSON&lang=en&indic_ur=<指標>`，
  JSON-stat，維度 freq、indic_ur、cities、time；城市代碼像 DE001C（國家代碼 + 編號 + C），標籤是當地名稱，
  有的寫「(greater city)」（大城市的範圍），同一個代碼不會重複。
- 位置：Eurostat 的城市沒有座標。用 Wikidata（CC0，2026-11-05 起經 QLever，query.wikidata.org 的 robots.txt 不准 /sparql）依名稱查：當地語言與英文的名稱、在這個國家（P17）、
  有座標也有人口（P1082，車站、球隊這類同名的條目沒有）的條目，取人口最多的（城市與同名的行政區位置相近）。一個國家一支查詢，結果快取。
  查不到的回傳 None（呼叫的地方決定怎麼寫）。
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from common import CACHE_DIR, USER_AGENT, download
from sources.countries import from_alpha2

DATA_URL = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{}?format=JSON&lang=en&indic_ur={}"
# 2026-11-05 起改用 QLever：query.wikidata.org 的 robots.txt 不准程式抓 /sparql（之前的快取是 WDQS 查的，照用）
WDQS = "https://qlever.dev/api/wikidata"
EUROSTAT_ISO2 = {"EL": "GR", "UK": "GB"}
# 各國查 Wikidata 名稱用的語言（英文一定加）；保加利亞、希臘的 Eurostat 名稱是拉丁字母轉寫，靠英文名稱
LANGS = {
    "AT": ("de",), "BE": ("nl", "fr", "de"), "BG": (), "CH": ("de", "fr", "it"), "CY": ("el",), "CZ": ("cs",), "DE": ("de",),
    "DK": ("da",), "EE": ("et",), "EL": (), "ES": ("es", "ca", "eu", "gl"), "FI": ("fi", "sv"), "FR": ("fr",), "HR": ("hr",),
    "HU": ("hu",), "IE": ("ga",), "IT": ("it",), "LT": ("lt",), "LU": ("lb", "fr", "de"), "LV": ("lv",), "MT": ("mt",),
    "NL": ("nl",), "NO": ("nb", "nn", "no"), "PL": ("pl",), "PT": ("pt",), "RO": ("ro",), "SE": ("sv",), "SI": ("sl",),
    "SK": ("sk",), "TR": ("tr",), "UK": (),
}
# Eurostat 的寫法跟 Wikidata 的名稱對不上的（2026-11-04 查過）：代碼 → 查 Wikidata 用的名稱
ALIASES = {
    "CY001C": "Nicosia", "DE017C": "Halle (Saale)", "DE021C": "Mülheim an der Ruhr", "DE067C": "Frankenthal",
    "DE098C": "Oldenburg", "DK002C": "Aarhus", "ES008C": "Las Palmas de Gran Canaria", "FR014C": "Cannes",
    "FR076C": "Annemasse", "FR077C": "Saint-Louis", "IT024C": "Reggio Calabria", "IT068C": "Reggio Emilia",
    "MT001C": "Valletta", "NL017C": "Den Haag", "UK025C": "Kingston upon Hull", "UK090C": "St Helens",
}
# 荷蘭的城市在 Wikidata 的國家（P17）常是荷蘭王國（Q29999），它沒有 ISO 代碼
COUNTRY_QID = {"NL": {"Q55", "Q29999"}}
# 同名時優先取歐洲本土與大西洋、地中海的島（法國的 Saint-Louis 不要配到留尼旺的同名城市）；海外省的城市照收
BBOX = (-32.0, 27.0, 45.0, 72.0)
COORD = re.compile(r"Point\(\s*(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s*\)", re.I)


def series(dataset: str, indicator: str) -> tuple[dict[str, str], dict[str, dict[int, float]]]:
    """(城市代碼 → 名稱, 城市代碼 → {年: 值})；只留城市（代碼超過兩個字），國家的彙總不要"""
    path = download(DATA_URL.format(dataset, indicator), "eurostat", f"{dataset}-{indicator}.json")
    d = json.loads(path.read_text(encoding="utf-8"))
    cat = d["dimension"]["cities"]["category"]
    code_at = {v: k for k, v in cat["index"].items()}
    year_at = {v: int(k) for k, v in d["dimension"]["time"]["category"]["index"].items()}
    nt = d["size"][-1]
    out: dict[str, dict[int, float]] = {}
    for k, v in d["value"].items():
        code = code_at[int(k) // nt]
        if len(code) > 2 and v is not None and not code.startswith(("UK", "XK")):  # 英國、科索沃只准非商業（網站的 Eurostat 規則）
            out.setdefault(code, {})[year_at[int(k) % nt]] = float(v)
    return {c: l for c, l in cat["label"].items() if len(c) > 2 and not c.startswith(("UK", "XK"))}, out


def iso3(code: str) -> str | None:
    return from_alpha2(EUROSTAT_ISO2.get(code[:2], code[:2]))


def _names(label: str, code: str = "") -> list[str]:
    base = re.sub(r"\s*\(greater city\)", "", label).strip()
    out = [*([ALIASES[code]] if code in ALIASES else []), base, *(p.strip() for p in base.split("/") if p.strip())]
    return list(dict.fromkeys(out))


def _wdqs(query: str, name: str) -> list[dict]:
    path = CACHE_DIR / "wikidata" / f"urban-audit-{name}.json"
    if not path.exists():
        req = urllib.request.Request(WDQS, data=urllib.parse.urlencode({"query": query}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = r.read()
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                time.sleep(2)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as err:
                print(f"    Wikidata：{err}，等 {30 * (attempt + 1)} 秒", flush=True)
                time.sleep(30 * (attempt + 1))
        else:
            raise RuntimeError(f"Wikidata 一直失敗（{name}）")
    return json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]


def locate(labels: dict[str, str]) -> dict[str, tuple[float, float, str] | None]:
    """城市代碼 → (經度, 緯度, Wikidata QID)；查不到是 None"""
    by_country: dict[str, dict[str, str]] = {}
    for code, label in labels.items():
        by_country.setdefault(code[:2], {})[code] = label
    out: dict[str, tuple[float, float, str] | None] = {}
    for cc, cities in sorted(by_country.items()):
        langs = (*LANGS.get(cc, ()), "en", "mul")
        values = sorted({f'"{n.replace(chr(34), "")}"@{lang}' for code, label in cities.items() for n in _names(label, code) for lang in langs})
        iso2 = EUROSTAT_ISO2.get(cc, cc)
        # 2026-11-05 起查 QLever（不支援 WDQS 的 hint:optimizer）；之前的快取是 WDQS 照寫的順序查的
        rows = _wdqs(f"""PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?name ?item ?coord ?pop ?c ?cc WHERE {{
  VALUES ?name {{ {' '.join(values)} }}
  ?item rdfs:label ?name .
  ?item wdt:P1082 ?pop ; wdt:P625 ?coord ; wdt:P17 ?c . OPTIONAL {{ ?c wdt:P297 ?cc }}
}}""", cc)
        best: dict[str, tuple[float, float, float, str]] = {}  # 名稱 → (人口, 經度, 緯度, QID)
        for r in rows:
            m = COORD.search(r["coord"]["value"])
            country = r["c"]["value"].rsplit("/", 1)[-1]
            if not m or (r.get("cc", {}).get("value") != iso2 and country not in COUNTRY_QID.get(iso2, ())):
                continue
            lon, lat = float(m.group(1)), float(m.group(2))
            pop = float(r["pop"]["value"]) + (1e12 if BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3] else 0)
            key = r["name"]["value"]
            cand = (pop, lon, lat, r["item"]["value"].rsplit("/", 1)[-1])
            if key not in best or cand[0] > best[key][0]:
                best[key] = cand
        for code, label in cities.items():
            hits = [best[n] for n in _names(label, code) if n in best]
            if hits:
                pop, lon, lat, qid = max(hits)
                out[code] = (round(lon, 4), round(lat, 4), qid)
            else:
                out[code] = None
    return out
