"""各國的基因定序產出（2026-11-07，製作手冊第二十五批 515，候選 1214；擴充「學術論文」〔科技・研發與創新〕）。

歐洲核苷酸檔案庫（ENA）Portal API 的 read_run 筆數，依樣本的採集國（`country` 欄，INSDC 的國名字彙，可能接「: 地區」）。
EMBL-EBI Terms of Use：別人產生的資料不加額外限制、要署名。www.ebi.ac.uk 的 robots.txt 沒有禁止 /ena/portal/api，
但要求 Crawl-delay 10，所以每支查詢間隔 10 秒（約 300 支、約 50 分鐘；結果快取在 .cache/ena/counts.json，有的不再查）。
- 單字的國名查 `country="<國名>*"`（含「國名: 地區」）；**有空格的國名萬用字元會失效（`"United Kingdom*"` 回 0，2026-11-07 實測），
  只能精確查 `country="<國名>"`**（「國名: 地區」的寫法很少：United Kingdom 362 萬筆、United Kingdom: England 1.3 萬筆，漏掉的不多）。
  國名是別的國名的開頭的（Niger 與 Nigeria、India 與 Indian Ocean、Dominica 與 Dominican Republic、Guinea 與 Guinea-Bissau），
  減掉長的那個（長的那個照同樣的規則查）。
- 很多 run 沒有填 country，各國加起來遠小於全部；country 是採集地，不是定序實驗室所在地。
輸出 public/data/topics/publications/sequencing.json（筆數，只有 2026 年 11 月的累計，沒有時間軸）。
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request

import pycountry

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, write_json

OUT = OUT_DIR / "topics" / "publications"
API = "https://www.ebi.ac.uk/ena/portal/api/count?"
CACHE = CACHE_DIR / "ena" / "counts.json"
YEAR = 2026
# INSDC 國名字彙跟 ISO 不同的（同一國可以有幾個寫法，加總）
EXTRA = {
    "TWN": ["Taiwan"], "USA": ["USA"], "GBR": ["United Kingdom", "UK"], "RUS": ["Russia"], "KOR": ["South Korea"],
    "PRK": ["North Korea"], "VNM": ["Viet Nam", "Vietnam"], "LAO": ["Laos"], "IRN": ["Iran"], "SYR": ["Syria"],
    "CZE": ["Czechia", "Czech Republic"], "TUR": ["Turkey", "Turkiye"], "CIV": ["Cote d'Ivoire"],
    "COD": ["Democratic Republic of the Congo"], "COG": ["Republic of the Congo"], "BOL": ["Bolivia"],
    "VEN": ["Venezuela"], "TZA": ["Tanzania"], "MDA": ["Moldova"], "MKD": ["North Macedonia", "Macedonia"],
    "SWZ": ["Eswatini", "Swaziland"], "BRN": ["Brunei"], "CPV": ["Cabo Verde", "Cape Verde"], "TLS": ["Timor-Leste", "East Timor"],
    "PSE": ["Palestine", "West Bank", "Gaza Strip"], "FSM": ["Micronesia, Federated States of", "Micronesia"],
    "HKG": ["Hong Kong"], "MAC": ["Macau", "Macao"], "XKX": ["Kosovo"], "VAT": ["Holy See"], "SVK": ["Slovakia"],
    "MMR": ["Myanmar"], "KGZ": ["Kyrgyzstan"], "BHS": ["Bahamas"], "GMB": ["Gambia"], "NLD": ["Netherlands"],
}
# 國名是別的國名開頭的，查到的數字要減掉這些
OVERLAP = {"Niger": ["Nigeria"], "India": ["Indian Ocean"], "Dominica": ["Dominican Republic"], "Guinea": ["Guinea-Bissau"],
           "Sudan": [], "Samoa": [], "Ireland": [], "Georgia": []}


def _names() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for c in pycountry.countries:
        names = EXTRA.get(c.alpha_3) or [getattr(c, "common_name", None) or c.name]
        out[c.alpha_3] = list(dict.fromkeys(names))
    out["XKX"] = EXTRA["XKX"]
    return out


def _count(query: str, cache: dict[str, int]) -> int:
    if query not in cache:
        url = API + urllib.parse.urlencode({"result": "read_run", "query": query})
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=120) as r:
            lines = r.read().decode().split()
        cache[query] = int(lines[-1])
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding="utf-8")
        time.sleep(10)  # robots.txt 的 Crawl-delay
    return cache[query]


def _query(name: str) -> str:
    return f'country="{name}"' if " " in name else f'country="{name}*"'


def build() -> None:
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    values: dict[str, float] = {}
    for iso3, names in sorted(_names().items()):
        n = 0
        for name in names:
            n += _count(_query(name), cache)
            for other in OVERLAP.get(name, []):
                n -= _count(_query(other), cache)
        if n > 0:
            values[iso3] = n
    write_json(OUT / "sequencing.json", indicator_file(
        "sequencing", "runs", [YEAR], {k: [v] for k, v in values.items()},
        attribution="European Nucleotide Archive (ENA), EMBL-EBI"))
    top = sorted(values.items(), key=lambda kv: -kv[1])[:10]
    print(f"  ENA：{len(values)} 國有值，合計 {sum(values.values()):,}；{top}；台灣 {values.get('TWN')}")
