"""Wikidata（CC0）：國旗主題用的各國國旗陳述與國旗項目。

兩個 SPARQL 查詢（國家項目的範圍跟國家小檔案一樣，sources/wikidata_profiles.py 的 ITEMS：有 ISO 3166-1 alpha-3 的項目，
加上沒有 ISO 代碼的北賽普勒斯、索馬利蘭）：
- statements：國家項目的國旗圖檔（P41，Commons 上的檔名）與國旗項目（P163），含等級與起訖時間（P580、P582）、角色（P3831）。
  不排除已結束、已棄用的陳述：topics/flags.py 要看歷代的國旗才分得出「這一面旗從哪一年起」。
- items：國旗項目本身的成立時間（P571）、描繪的內容（P180）、顏色（P462）、長寬比（P2061）、暱稱（P1449）。

名稱（國旗項目、長寬比項目、P180 的項目）用 wikidata_profiles.labels()：中文依 zh-tw、zh-hant、zh-hk，都沒有時用
languagefallback 轉成的 zh-tw；英文用 en。查詢加 `hint:Query hint:optimizer "None"`（先找國家項目），每個幾秒。
回應存在 .cache/wikidata/flags-*.json，要更新加 --refresh；資料日期是快取檔的修改時間。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from common import CACHE_DIR
from sources import wikidata_profiles as wp

STATEMENTS_QUERY = """
SELECT ?iso ?c ?prop ?st ?v ?rank ?P580 ?P582 ?P3831 WHERE {
  hint:Query hint:optimizer "None" .
  %s
  { ?c p:P41 ?st . ?st ps:P41 ?v . BIND("P41" AS ?prop) }
  UNION { ?c p:P163 ?st . ?st ps:P163 ?v . BIND("P163" AS ?prop) }
  ?st wikibase:rank ?rank .
  OPTIONAL { ?st pq:P580 ?P580 } OPTIONAL { ?st pq:P582 ?P582 } OPTIONAL { ?st pq:P3831 ?P3831 }
}
""" % wp.ITEMS

ITEMS_QUERY = """
SELECT ?flag ?prop ?v ?rank WHERE {
  hint:Query hint:optimizer "None" .
  %s
  ?c p:P163 ?fst . ?fst ps:P163 ?flag .
  { ?flag p:P571 ?st . ?st ps:P571 ?v . BIND("P571" AS ?prop) }
  UNION { ?flag p:P180 ?st . ?st ps:P180 ?v . BIND("P180" AS ?prop) }
  UNION { ?flag p:P462 ?st . ?st ps:P462 ?v . BIND("P462" AS ?prop) }
  UNION { ?flag p:P2061 ?st . ?st ps:P2061 ?v . BIND("P2061" AS ?prop) }
  UNION { ?flag p:P1449 ?st . ?st ps:P1449 ?v . BIND("P1449" AS ?prop) }
  ?st wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
}
""" % wp.ITEMS


@dataclass
class FlagStatement:
    prop: str  # "P41"（圖檔名，已解碼）或 "P163"（國旗項目的 QID）
    value: str
    rank: str  # "PreferredRank" / "NormalRank" / "DeprecatedRank"
    start: str = ""  # P580 的日期（YYYY-MM-DD）；沒有是空字串
    end: str = ""  # P582 的日期
    roles: list[str] = field(default_factory=list)  # P3831


def _file_name(uri: str) -> str:
    """http://commons.wikimedia.org/wiki/Special:FilePath/Flag%20of%20X.svg → Flag of X.svg"""
    from urllib.parse import unquote

    return unquote(uri.rsplit("/", 1)[-1])


def statements() -> tuple[dict[str, list[FlagStatement]], dict[str, str]]:
    """({Wikidata 的 ISO3: [FlagStatement…]}, {ISO3: 項目 QID})。

    同一個 ISO3 有好幾個項目時（巴勒斯坦國 Q219060 與巴勒斯坦領土 Q407199）取 QID 數字最小的，跟國家小檔案一樣。
    """
    items: dict[str, set[str]] = {}
    raw: dict[tuple[str, str], dict[str, FlagStatement]] = {}
    for r in wp._rows(wp._sparql(STATEMENTS_QUERY, "flags-statements.json")):
        iso3 = r["iso"]["value"]
        qid = wp._entity(r["c"]["value"])
        items.setdefault(iso3, set()).add(qid)
        st_id = r["st"]["value"].rsplit("/", 1)[-1]
        by_st = raw.setdefault((iso3, qid), {})
        st = by_st.get(st_id)
        if st is None:
            prop = r["prop"]["value"]
            value = _file_name(r["v"]["value"]) if prop == "P41" else wp._entity(r["v"]["value"])
            st = FlagStatement(prop, value, r["rank"]["value"].rsplit("#", 1)[-1])
            by_st[st_id] = st
        if "P580" in r:
            st.start = st.start or wp._date(r["P580"]["value"])
        if "P582" in r:
            st.end = st.end or wp._date(r["P582"]["value"])
        if "P3831" in r:
            role = wp._entity(r["P3831"]["value"])
            if role not in st.roles:
                st.roles.append(role)
    qids = {iso3: sorted(found, key=lambda q: int(q[1:]))[0] for iso3, found in items.items()}
    return {iso3: list(raw[(iso3, qid)].values()) for iso3, qid in qids.items()}, qids


def items() -> dict[str, dict[str, list[str]]]:
    """{國旗項目 QID: {屬性: [值…]}}。P571 是時間（ISO 8601），P1449 是「文字@語言」，其他是 QID。"""
    out: dict[str, dict[str, list[str]]] = {}
    for r in wp._rows(wp._sparql(ITEMS_QUERY, "flags-items.json")):
        flag = wp._entity(r["flag"]["value"])
        v = r["v"]
        value = wp._entity(v["value"])
        if "xml:lang" in v:
            value = f'{v["value"]}@{v["xml:lang"]}'
        values = out.setdefault(flag, {}).setdefault(r["prop"]["value"], [])
        if value not in values:
            values.append(value)
    return out


def labels(qids: list[str]) -> dict[str, tuple[str | None, str | None]]:
    """{QID: (中文名稱或 None, 英文名稱或 None)}（wikidata_profiles.labels()，快取共用）"""
    return wp.labels(qids)


def fetched_date() -> str:
    """查詢結果的日期（快取檔的修改時間，UTC）"""
    path = CACHE_DIR / "wikidata" / "flags-statements.json"
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).strftime("%Y-%m-%d")
