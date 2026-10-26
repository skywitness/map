"""Wikidata（CC0）：摩天大樓主題用的建築清單。

1. SPARQL 一次查出「有一個高度（P2048，換算成公尺的 psn 值）150 m 以上」的項目與它們的 P31（是什麼），
   約 3 千個項目（含山、瀑布、橋、電視塔…），是不是建築在 topics/skyscrapers.py 依 P31 判斷。
2. 候選的建築用 wbgetentities（每 50 個一批）取完整的陳述（高度與限定詞、樓層數、座標、國家、所在行政區、
   完工／啟用／拆除日期、使用狀態、P31）與名稱（中文依 zh-tw、zh-hant、zh-hk，都沒有時用 languagefallback 轉成的 zh-tw，
   同 sources/nobel.py 的 _pick_zh；英文用 en，沒有時用 mul）。
3. 所在的城市：建築的 P131（所在行政區）往上最多 4 層，每一層的 P31 與上一層用 SPARQL 查（admin()），
   這些類別是不是「城市」的子類別也用 SPARQL 查（city_classes()），名稱用 wbgetentities（topics/skyscrapers.py 決定用哪一層）。
4. 國家的 ISO 代碼（P17 → P298，iso3_of()）：跟座標判斷的國家核對、沒有座標的用它。

- 查詢服務（WDQS）共 7 次（候選、行政區 4 層、城市類別、國家代碼），每次幾秒，失敗時等一下再試（wikidata_profiles._sparql）；
  其他都是一般的 API。結果都存在 .cache/wikidata/skyscrapers-*.json，要更新加 --refresh。
  User-Agent 寫專案網址（common.USER_AGENT），不帶個人資料；不用帳號、不用金鑰。
- 只取結構化的事實（數字、日期、座標、名稱），不取維基百科條目的文字（CC BY-SA）。
"""
from __future__ import annotations

import hashlib
import json
import urllib.parse
from datetime import datetime, timezone

import common
from common import CACHE_DIR
from sources import nobel
from sources.wikidata_profiles import _sparql

API = "https://www.wikidata.org/w/api.php"
BATCH = 50
E = "http://www.wikidata.org/entity/"

CANDIDATES_QUERY = """
SELECT ?item ?cls WHERE {
  ?item p:P2048/psn:P2048/wikibase:quantityAmount ?h .
  FILTER(?h >= 150)
  ?item wdt:P31 ?cls .
}
"""


def candidates() -> dict[str, set[str]]:
    """{QID: {P31 的 QID…}}：有一個高度陳述（含已棄用的，之後再排除）換算後 150 m 以上的項目"""
    path = _sparql(CANDIDATES_QUERY, "skyscrapers-candidates.json")
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)["results"]["bindings"]
    out: dict[str, set[str]] = {}
    for r in rows:
        out.setdefault(r["item"]["value"][len(E):], set()).add(r["cls"]["value"][len(E):])
    return out


def fetched_date() -> str:
    path = CACHE_DIR / "wikidata" / "skyscrapers-candidates.json"
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).strftime("%Y-%m-%d")


def entities(qids: list[str], prefix: str, props: str = "claims|labels") -> dict[str, dict]:
    """{QID: wbgetentities 的項目（claims、labels）}。依 QID 排序後每 50 個一批，快取檔名是這批 QID 的雜湊。"""
    ids = sorted(set(qids), key=lambda q: int(q[1:]))
    out: dict[str, dict] = {}
    for start in range(0, len(ids), BATCH):
        batch = ids[start:start + BATCH]
        params = {
            "action": "wbgetentities",
            "ids": "|".join(batch),
            "props": props,
            "languages": "|".join((*nobel.ZH_ORDER, "en", "mul")),
            "languagefallback": "1",
            "format": "json",
        }
        digest = hashlib.sha1(",".join(batch).encode()).hexdigest()[:12]
        path = common.download(f"{API}?{urllib.parse.urlencode(params)}", "wikidata", f"{prefix}-{digest}.json")
        with open(path, encoding="utf-8") as f:
            found = json.load(f)["entities"]
        for qid in batch:
            entity = found.get(qid)
            if entity and "missing" not in entity:
                # 被合併的項目會轉到新的 QID（redirects），用原本的 QID 當鍵
                out[qid] = entity
    return out


def names(entity: dict) -> tuple[str | None, str | None]:
    """(中文名稱或 None, 英文名稱或 None)"""
    labels = entity.get("labels", {})
    zh = nobel._pick_zh(labels)[0]
    en = None
    for lang in ("en", "mul"):
        label = labels.get(lang)
        if label and label.get("language") == lang:
            en = label["value"]
            break
    return zh, en


ADMIN_QUERY = """
SELECT ?a ?cls ?p WHERE {
  VALUES ?a { %s }
  OPTIONAL { ?a wdt:P31 ?cls }
  OPTIONAL { ?a wdt:P131 ?p }
}
"""


def admin(qids: list[str]) -> dict[str, tuple[set[str], list[str]]]:
    """{行政區 QID: ({P31…}, [P131 的上一層…])}，P131 是 truthy 值（有偏好值時只有偏好值）"""
    ids = sorted(set(qids), key=lambda q: int(q[1:]))
    if not ids:
        return {}
    digest = hashlib.sha1(",".join(ids).encode()).hexdigest()[:12]
    path = _sparql(ADMIN_QUERY % " ".join(f"wd:{q}" for q in ids), f"skyscrapers-admin-{digest}.json")
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)["results"]["bindings"]
    out: dict[str, tuple[set[str], list[str]]] = {q: (set(), []) for q in ids}
    for r in rows:
        a = r["a"]["value"][len(E):]
        if "cls" in r:
            out[a][0].add(r["cls"]["value"][len(E):])
        if "p" in r:
            p = r["p"]["value"][len(E):]
            if p not in out[a][1]:
                out[a][1].append(p)
    return out


ISO_QUERY = """
SELECT ?c ?iso WHERE {
  VALUES ?c { %s }
  ?c wdt:P298 ?iso .
}
"""


def iso3_of(qids: list[str]) -> dict[str, str]:
    """{國家 QID: ISO 3166-1 alpha-3}（沒有座標的建築用 P17 決定國家）"""
    ids = sorted(set(qids), key=lambda q: int(q[1:]))
    if not ids:
        return {}
    digest = hashlib.sha1(",".join(ids).encode()).hexdigest()[:12]
    path = _sparql(ISO_QUERY % " ".join(f"wd:{q}" for q in ids), f"skyscrapers-iso-{digest}.json")
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)["results"]["bindings"]
    return {r["c"]["value"][len(E):]: r["iso"]["value"] for r in rows}


CITY_CLASS_QUERY = """
SELECT ?cls ?city ?district WHERE {
  VALUES ?cls { %s }
  BIND(EXISTS { ?cls wdt:P279* wd:Q515 } AS ?city)
  BIND(EXISTS { ?cls wdt:P279* wd:Q2198484 } AS ?district)
}
"""


def city_classes(classes: list[str]) -> dict[str, tuple[bool, bool]]:
    """{類別 QID: (是不是城市（Q515 的子類別）, 是不是市轄區（Q2198484 municipal district 的子類別）)}"""
    ids = sorted(set(classes), key=lambda q: int(q[1:]))
    digest = hashlib.sha1(",".join(ids).encode()).hexdigest()[:12]
    path = _sparql(CITY_CLASS_QUERY % " ".join(f"wd:{c}" for c in ids), f"skyscrapers-city-classes-{digest}.json")
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)["results"]["bindings"]
    return {r["cls"]["value"][len(E):]: (r["city"]["value"] == "true", r["district"]["value"] == "true") for r in rows}
