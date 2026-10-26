"""Wikidata（CC0）：國家小檔案用的各國基本資料。

SPARQL 查所有有 ISO 3166-1 alpha-3（P298）的項目（加上沒有 ISO 代碼的北賽普勒斯、索馬利蘭）的這些陳述，
不含已棄用、已結束（P582 早於今天）的：
- codes：ISO 3166-1 的 alpha-2（P297）與數字代碼（P299）、國際電話區號（P474）、網域（P78）、國歌（P85）、
  政體（P122）、貨幣（P38）、所屬國家（P17）、是什麼（P31）
- heads：國家元首（P35）與職稱（P1906）、政府首長（P6）與職稱（P1313）
- capitals：首都（P36），含適用的部分（P518：行政、立法、司法、法理上、實際上）、角色（P3831）、陳述的性質（P5102）、
  爭議（P1310）
- inception：成立時間（P571），含精確度（年、月、日）
- holders：職稱（P1906、P1313）的現任者，從人那一邊查「擔任職務」（P39）。國家那一邊的 P35、P6 常常沒更新
  （2026-10 泰國、薩摩亞、蘇丹的總理還是前任），人那一邊的 P39 通常比較新，topics/profiles.py 兩邊比對。
- values：首都的座標（P625）、貨幣的 ISO 4217 代碼（P498）
名稱另外用 wbgetentities 查：中文依 zh-tw、zh-hant、zh-hk，都沒有時用 languagefallback 轉成的 zh-tw（伺服器端的繁簡轉換，
跟 sources/nobel.py 的 zh_labels() 同一個挑法，再用 nobel.S2T 補轉漏網的簡體字）；英文用 en，沒有時用 mul。每 50 個 QID 一批。

- 查詢服務的逾時是 60 秒。一次查全部屬性會逾時，所以分組；查詢加 `hint:Query hint:optimizer "None"`，依寫的順序
  （先找有 ISO 代碼的項目）執行，每組 2–3 秒。失敗時等一下再試（最多 4 次）。
- User-Agent 寫專案網址（common.USER_AGENT），不帶個人資料；不用帳號、不用金鑰。
- 回應存在 .cache/wikidata/profiles-*.json，要更新加 --refresh；資料日期用快取檔的修改時間
  （側欄寫「資料取自 Wikidata，YYYY-MM-DD」）。
"""
from __future__ import annotations

import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import common
from common import CACHE_DIR, USER_AGENT
from sources import nobel

ENDPOINT = "https://query.wikidata.org/sparql"
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}")
API = "https://www.wikidata.org/w/api.php"
BATCH = 50

# 沒有 ISO 代碼、地圖上自訂代碼的區域（build_geo.py 的 NO_ID_OVERRIDES）
EXTRA_ITEMS = {"_CYN": "Q23681", "_SOL": "Q34754"}

# 要查的屬性，分成幾個查詢（一次全部查會逾時）：每組的屬性與要一起取回的限定詞
GROUPS = {
    "codes": (["P297", "P299", "P474", "P78", "P85", "P122", "P38", "P17", "P31"], ["P580", "P518", "P3831"]),
    "heads": (["P35", "P6", "P1906", "P1313"], ["P580", "P3831", "P518"]),
    "capitals": (["P36"], ["P580", "P518", "P3831", "P642", "P5102", "P1310"]),
}

ITEMS = """
  { ?c wdt:P298 ?iso . } UNION { VALUES (?c ?iso) { %s } }
""" % " ".join(f'(wd:{q} "{iso}")' for iso, q in EXTRA_ITEMS.items())

STATEMENTS_QUERY = """
SELECT ?iso ?c ?prop ?st ?v ?rank %s WHERE {
  hint:Query hint:optimizer "None" .
  %s
  { %s }
  ?st wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  FILTER NOT EXISTS { ?st pq:P582 ?ended . FILTER(?ended <= NOW()) }
  %s
}
"""

INCEPTION_QUERY = """
SELECT ?iso ?c ?st ?t ?prec ?rank WHERE {
  hint:Query hint:optimizer "None" .
  %s
  ?c p:P571 ?st .
  ?st psv:P571 ?node .
  ?node wikibase:timeValue ?t ; wikibase:timePrecision ?prec .
  ?st wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
}
""" % ITEMS

# 值的項目本身要用的屬性：首都的座標（P625）、貨幣的 ISO 4217 代碼（P498）
VALUES_QUERY = """
SELECT ?v ?coord ?code WHERE {
  hint:Query hint:optimizer "None" .
  %s
  { ?c p:P36/ps:P36 ?v . ?v wdt:P625 ?coord . }
  UNION
  { ?c p:P38/ps:P38 ?v . ?v wdt:P498 ?code . }
}
""" % ITEMS

HOLDERS_QUERY = """
SELECT ?office ?person ?start ?rank WHERE {
  hint:Query hint:optimizer "None" .
  VALUES ?office { %s }
  ?st ps:P39 ?office . ?person p:P39 ?st . ?st wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?st pq:P580 ?start }
  FILTER NOT EXISTS { ?st pq:P582 ?ended . FILTER(?ended <= NOW()) }
  FILTER NOT EXISTS { ?person wdt:P570 ?died }
}
"""


@dataclass
class Statement:
    value: str  # 項目是 QID，其他是字串（時間是 ISO 8601）
    rank: str  # "PreferredRank" / "NormalRank"
    qualifiers: dict[str, list[str]] = field(default_factory=dict)

    @property
    def start(self) -> str:
        """起始時間（P580）的日期部分；沒有、或是「未知的值」（空白節點）時是空字串"""
        return _date(self.qualifiers.get("P580", [""])[0])


def _date(value: str) -> str:
    return value[:10] if DATE.match(value) else ""


def _entity(uri: str) -> str:
    return uri.rsplit("/", 1)[-1] if uri.startswith("http://www.wikidata.org/entity/") else uri


def _sparql(query: str, filename: str) -> Path:
    target = CACHE_DIR / "wikidata" / filename
    if target.exists() and not common.REFRESH:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    data = b""
    for attempt in range(4):
        try:
            print(f"  查詢 Wikidata（{filename}）")
            request = urllib.request.Request(
                ENDPOINT,
                data=urllib.parse.urlencode({"query": query}).encode(),
                headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"},
            )
            with urllib.request.urlopen(request, timeout=120) as resp:
                data = resp.read()
            break
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == 3:
                raise
            wait = 30 * (attempt + 1)
            print(f"  Wikidata 查詢失敗（{e}），{wait} 秒後再試")
            time.sleep(wait)
    tmp = target.with_suffix(".part")
    tmp.write_bytes(data)
    tmp.replace(target)
    return target


def _rows(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)["results"]["bindings"]


def _statements_query(props: list[str], qualifiers: list[str]) -> str:
    unions = " UNION ".join(f'{{ ?c p:{p} ?st . ?st ps:{p} ?v . BIND("{p}" AS ?prop) }}' for p in props)
    optionals = " ".join(f"OPTIONAL {{ ?st pq:{q} ?{q} }}" for q in qualifiers)
    return STATEMENTS_QUERY % (" ".join(f"?{q}" for q in qualifiers), ITEMS, unions, optionals)


def statements() -> tuple[dict[str, dict[str, dict[str, Statement]]], dict[str, str]]:
    """({ISO3: {屬性: {陳述 id: Statement}}}, {ISO3: 項目 QID})。

    同一個 ISO3 有好幾個項目時（巴勒斯坦國 Q219060 與巴勒斯坦領土 Q407199、南極洲）取 QID 數字最小的，只用那個項目的陳述。
    """
    items: dict[str, set[str]] = {}
    raw: dict[tuple[str, str], dict[str, dict[str, Statement]]] = {}
    for group, (props, qualifiers) in GROUPS.items():
        for r in _rows(_sparql(_statements_query(props, qualifiers), f"profiles-{group}.json")):
            iso3 = r["iso"]["value"]
            qid = _entity(r["c"]["value"])
            items.setdefault(iso3, set()).add(qid)
            by_prop = raw.setdefault((iso3, qid), {})
            st_id = r["st"]["value"].rsplit("/", 1)[-1]
            st = by_prop.setdefault(r["prop"]["value"], {}).get(st_id)
            if st is None:
                st = Statement(_entity(r["v"]["value"]), r["rank"]["value"].rsplit("#", 1)[-1])
                by_prop[r["prop"]["value"]][st_id] = st
            for q in qualifiers:
                if q in r:
                    values = st.qualifiers.setdefault(q, [])
                    qv = _entity(r[q]["value"])
                    if qv not in values:
                        values.append(qv)
    qids = {iso3: sorted(found, key=lambda q: int(q[1:]))[0] for iso3, found in items.items()}
    return {iso3: raw[(iso3, qid)] for iso3, qid in qids.items()}, qids


def inception(qids: dict[str, str]) -> dict[str, list[tuple[str, int, str]]]:
    """{ISO3: [(時間 ISO 8601, 精確度（9 年、10 月、11 日）, 等級), …]}，只取 qids 裡的那個項目"""
    out: dict[str, list[tuple[str, int, str]]] = {}
    seen: set[str] = set()
    for r in _rows(_sparql(INCEPTION_QUERY, "profiles-inception.json")):
        iso3 = r["iso"]["value"]
        if qids.get(iso3) != _entity(r["c"]["value"]) or r["st"]["value"] in seen:
            continue
        seen.add(r["st"]["value"])
        out.setdefault(iso3, []).append((r["t"]["value"], int(r["prec"]["value"]), r["rank"]["value"].rsplit("#", 1)[-1]))
    return out


def value_facts() -> tuple[dict[str, tuple[float, float]], dict[str, list[str]]]:
    """({首都 QID: (經度, 緯度)}, {貨幣 QID: [ISO 4217 代碼…]})"""
    coords: dict[str, tuple[float, float]] = {}
    codes: dict[str, list[str]] = {}
    for r in _rows(_sparql(VALUES_QUERY, "profiles-values.json")):
        v = _entity(r["v"]["value"])
        if "coord" in r and v not in coords:
            text = r["coord"]["value"]  # Point(經度 緯度)
            if text.startswith("Point("):
                lon, lat = text[6:-1].split()
                coords[v] = (float(lon), float(lat))
        if "code" in r:
            codes.setdefault(v, [])
            if r["code"]["value"] not in codes[v]:
                codes[v].append(r["code"]["value"])
    return coords, codes


def holders(offices: list[str]) -> dict[str, dict[str, tuple[str, str]]]:
    """{職稱 QID: {人 QID: (起始日期或空字串, 等級)}}：還在任（沒有已過的結束時間）、還在世的。"""
    ids = sorted(set(offices), key=lambda q: int(q[1:]))
    digest = hashlib.sha1(",".join(ids).encode()).hexdigest()[:12]
    query = HOLDERS_QUERY % " ".join(f"wd:{o}" for o in ids)
    out: dict[str, dict[str, tuple[str, str]]] = {}
    for r in _rows(_sparql(query, f"profiles-holders-{digest}.json")):
        office = _entity(r["office"]["value"])
        person = _entity(r["person"]["value"])
        start = _date(r.get("start", {}).get("value", ""))
        rank = r["rank"]["value"].rsplit("#", 1)[-1]
        prev = out.setdefault(office, {}).get(person)
        if prev is None or start > prev[0]:
            out[office][person] = (start, rank)
    return out


def fetched_date() -> str:
    """查詢結果的日期（快取檔的修改時間，UTC），側欄寫「資料取自 Wikidata，YYYY-MM-DD」"""
    path = CACHE_DIR / "wikidata" / "profiles-heads.json"
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).strftime("%Y-%m-%d")


def labels(qids: list[str], zh: bool = True) -> dict[str, tuple[str | None, str | None]]:
    """{QID: (中文名稱或 None, 英文名稱或 None)}。中文的挑法與簡轉繁同 sources/nobel.py 的 zh_labels()；
    zh=False 時只要英文（網域的名稱：中文的是 .中国 這類國際化網域，不用）。"""
    ids = sorted(set(qids), key=lambda q: int(q[1:]))
    out: dict[str, tuple[str | None, str | None]] = {}
    for start in range(0, len(ids), BATCH):
        batch = ids[start:start + BATCH]
        params = {
            "action": "wbgetentities",
            "ids": "|".join(batch),
            "props": "labels",
            "languages": "|".join((*nobel.ZH_ORDER, "en", "mul")),
            "languagefallback": "1",
            "format": "json",
        }
        digest = hashlib.sha1(",".join(batch).encode()).hexdigest()[:12]
        path = common.download(f"{API}?{urllib.parse.urlencode(params)}", "wikidata", f"profiles-labels-{digest}.json")
        with open(path, encoding="utf-8") as f:
            entities = json.load(f)["entities"]
        for qid in batch:
            found = entities.get(qid, {}).get("labels", {})
            zh_name = nobel._pick_zh(found)[0] if zh else None
            en = None
            for lang in ("en", "mul"):
                label = found.get(lang)
                if label and label.get("language") == lang:
                    en = label["value"]
                    break
            out[qid] = (zh_name, en)
    return out
