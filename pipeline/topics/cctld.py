"""國家網域（ccTLD）被誰拿去用（2026-11-07，製作手冊第二十五批 507，候選 1179；新主題，科技・網路與連線）。

資料：
- 英文維基「Country code top-level domain」固定版本（revid 1383901539，CC BY-SA 4.0）。en.wikipedia 的 robots.txt
  不准 /w/、/api/、/wiki/Special:，所以讀 /wiki/<條目>?oldid=<版本> 的 HTML（路徑在 /wiki/ 底下、不在禁止清單），解第一個表：
  網域、國家或地區、委派年份、備註、註冊局。只引用事實（分類與年份），不轉載備註文字。
- 註冊限制與「被借用」是從備註文字用關鍵字歸類的（維基的備註不是結構化欄位，會過時；分類規則寫在下面，
  有疑義的寫在 OVERRIDES，理由寫在註解）：
  - restriction：1 只給本國（要本國公民、居民、公司或本地據點）、2 全球開放（寫明不必本地據點、沒有限制）、0 備註沒寫（不畫）
  - borrowed：1 備註寫了被拿去當別的意思用（.tv 電視、.ai 人工智慧、.io 輸入輸出、.ag 德國的 AG 等）
  - delegated：委派年份（「1990+」這類只知道下限的不畫）
- 台灣：TWNIC 的 .tw 與 .台灣 註冊數（數位發展部 data.gov.tw 165202，service.twnic.tw/dnjson.json，政府資料開放授權條款），
  側欄畫歷年合計、列最新一期的二級網域。
IANA 根區資料庫的條款只及於 Protocol Registries，不轉載，只當交叉查核。
輸出 public/data/topics/cctld/{restriction,borrowed,delegated}.json、cctld.json（每國的網域代碼）、tw-domains.json。
"""

from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
from collections import defaultdict

from common import CACHE_DIR, OUT_DIR, USER_AGENT, download, indicator_file, write_json
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "cctld"
REVID = 1383901539
URL = f"https://en.wikipedia.org/wiki/Country_code_top-level_domain?oldid={REVID}"
TWNIC = "https://service.twnic.tw/dnjson.json"
QLEVER = "https://qlever.dev/api/wikidata"
QUERY = """PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?label ?inception WHERE {
  ?item wdt:P31 wd:Q42032 ; wdt:P571 ?inception ; rdfs:label ?label . FILTER(LANG(?label) = "en")
}"""
YEAR = 2026

# ccTLD 跟 ISO 3166-1 alpha-2 不同的
# .ac（亞森欣島）跟 .sh 都屬聖赫勒拿，地圖上只有一塊，用 .sh；.eu、.su 不是國家
SPECIAL = {"uk": "GBR", "gb": None, "ac": None, "eu": None, "su": None}  # .gb 保留未用，英國用 .uk
LOCAL = re.compile(
    r"(must|required|requires|only|restricted|limited)\b.{0,80}\b(citizen|resident|local|presence|company|companies|"
    r"organi[sz]ation|entit|nationals?|domiciled|registered in|business)"
    r"|local (presence|contact|company|entity|address)[^.]{0,30}(required|needed|mandatory)"
    r"|(citizens?|residents?)\b[^.]{0,40}\bonly"
    r"|(trademark|trade name|citizenship|company|presence)[^.]{0,40}\brequired|presence requirements?",
    re.I,
)
OPEN = re.compile(
    r"allowed worldwide|local presence (is )?not required|no (local presence|restrictions?)|open to (all|anyone|everyone|the public)|"
    r"unrestricted|anyone (can|may)|available to (anyone|all|everyone)|without (any )?restriction|citizenship no longer required",
    re.I,
)
BORROWED = re.compile(
    r"unofficially used|also used (by|for|as)|commonly used (by|for|as)|used as an abbreviation|domain hack|"
    r"marketed|popular (with|among|for|as)|used by (many )?(tech|technology|startups)",
    re.I,
)
# 關鍵字分錯的，手動改（2026-11-07 逐一看過分類結果）
OVERRIDES: dict[str, dict[str, int]] = {
    "as": {"restriction": 0},  # 「must」出現在挪威、丹麥公司的說明，不是註冊限制
    "au": {"borrowed": 0},  # 「marketed as .au Direct」是開放二級網域，不是被借用
    "us": {"borrowed": 0},  # 「Formerly commonly used by U.S. State」是本國政府以前用，不是被借用
    "um": {"borrowed": 0},  # 同 .us
    "gl": {"borrowed": 0},  # 加利西亞以前借用，2014 年起改用 .gal
}


def _clean(cell: str) -> str:
    cell = re.sub(r"<style.*?</style>|<sup.*?</sup>", "", cell, flags=re.S)
    return html.unescape(re.sub(r"<[^>]+>", "", cell)).strip()


def _rows() -> list[list[str]]:
    page = download(URL, "wikipedia", f"cctld-{REVID}.html").read_text(encoding="utf-8")
    table = re.findall(r'<table class="wikitable[^"]*".*?</table>', page, re.S)[0]
    out = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S)[1:]:
        cells = [_clean(c) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S)]
        if cells and cells[0].startswith("."):
            out.append(cells)
    return out


def _inception() -> dict[str, int]:
    """Wikidata（CC0）的 ccTLD 啟用日期（P571，多半是 IANA 的委派日）→ {".tw": 1989}；同一個網域有兩個日期取早的"""
    path = CACHE_DIR / "qlever" / "cctld-inception.json"
    if not path.exists():
        req = urllib.request.Request(QLEVER, data=urllib.parse.urlencode({"query": QUERY}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        with urllib.request.urlopen(req, timeout=300) as r:
            body = r.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, int] = {}
    for row in data["results"]["bindings"]:
        label, year = row["label"]["value"].lower(), int(row["inception"]["value"][:4])
        out[label] = min(year, out.get(label, year))
    return out


def classify(notes: str) -> tuple[int, int]:
    restriction = 1 if LOCAL.search(notes) and not OPEN.search(notes) else 2 if OPEN.search(notes) else 0
    return restriction, 1 if BORROWED.search(notes) else 0


def build() -> None:
    restriction: dict[str, float] = {}
    borrowed: dict[str, float] = {}
    delegated: dict[str, float] = {}
    domains: dict[str, str] = {}
    counts = defaultdict(int)
    inception = _inception()
    for cells in _rows():
        tld = cells[0].split()[0].lower()
        code = tld.lstrip(".")
        iso3 = SPECIAL.get(code, from_alpha2(code.upper())) if len(code) == 2 else None
        if not iso3 or iso3 in domains:
            continue
        notes = cells[4] if len(cells) > 4 else ""
        r, b = classify(notes)
        o = OVERRIDES.get(code, {})
        r, b = o.get("restriction", r), o.get("borrowed", b)
        domains[iso3] = tld
        if r:
            restriction[iso3] = r
        borrowed[iso3] = b
        if tld in inception:
            delegated[iso3] = inception[tld]
        counts[("r", r)] += 1
        counts[("b", b)] += 1
    for name, data in (("restriction", restriction), ("borrowed", borrowed), ("delegated", delegated)):
        write_json(OUT / f"{name}.json", indicator_file(name, "category" if name != "delegated" else "year", [YEAR],
                                                         {k: [v] for k, v in sorted(data.items())}, license="CC BY-SA 4.0"))
    write_json(OUT / "cctld.json", {"revid": REVID, "domains": dict(sorted(domains.items()))})
    print(f"  ccTLD：{len(domains)} 國或地區；限制 {counts[('r', 1)]} 只給本國、{counts[('r', 2)]} 全球開放、{counts[('r', 0)]} 沒寫；"
          f"借用 {counts[('b', 1)]}；有委派年份 {len(delegated)}")

    rows = json.loads(download(TWNIC, "twnic", "dnjson.json").read_text(encoding="utf-8-sig"))
    months = sorted({r["統計年月"] for r in rows})
    names = sorted({r["網域名稱"] for r in rows})
    table = {n: [None] * len(months) for n in names}
    index = {m: i for i, m in enumerate(months)}
    for r in rows:
        table[r["網域名稱"]][index[r["統計年月"]]] = r["數量"]
    write_json(OUT / "tw-domains.json", {"months": months, "domains": table})
    last = months[-1]
    print(f"  TWNIC：{len(names)} 個二級網域，{months[0]}–{last}，最新合計 {sum(v[-1] or 0 for v in table.values()):,}")
