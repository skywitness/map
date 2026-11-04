"""藥品支出與取得：藥品專利池（MPP）的授權涵蓋哪些國家（2026-11-04，製作手冊第二十批 334）。

MPP 跟原廠簽自願授權，讓學名藥廠在指定的國家生產、銷售。使用者 2026-11-04 決定當事實自行整理（MPP 網站找不到任何
著作權或使用條款）。資料：MPP 的 sitemap（licences-sitemap.xml）列的 49 個英文授權頁（licence-post/<slug>，法文版不用），
每頁 HTML 裡的「Country List」（逗號分隔的國名，一頁可能有好幾份，合起來算）。國名本身有逗號的（「Congo, democratic Republic
of the」「Tanzania, United Republic of」「Moldova, Republic of」「Korea, Republic of」「Taiwan, Province of China」「Bonaire,
Sint Eustatius and Saba」「Saint Helena, Ascension and Tristan da Cunha」）先把後半接回去；MPP 把台灣寫成「Taiwan, Province of
China」，這裡就是台灣。
- 涵蓋 200 個以上地區的是全球授權（多半是 COVID-19 的 C-TAP 技術授權），其他是限定地區的授權；地圖畫每國被幾份限定地區的授權涵蓋，
  全球授權的份數寫在滑過的說明。沒有國家清單的頁（研究工具等）不算。
- 「涵蓋」不等於買得到。台灣不在任何限定地區的授權裡；高端疫苗的 MVC-COV1901 是 MPP 的授權（授權人是台灣的公司）。
"""
from __future__ import annotations

import html
import re
import unicodedata
from collections import Counter

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "medicines"
SITEMAP = "https://medicinespatentpool.org/licences-sitemap.xml"
YEAR = 2026
GLOBAL_MIN = 200
SECOND_HALF = {"democratic Republic of the", "Republic of", "United Republic of", "Province of China", "Sint Eustatius and Saba",
               "Ascension and Tristan da Cunha"}
NAMES = {
    "Congo, democratic Republic of the": "COD", "Congo": "COG", "Tanzania, United Republic of": "TZA",
    "Moldova, Republic of": "MDA", "Korea, Republic of": "KOR", "Korea (Democratic People's Republic of)": "PRK",
    "Taiwan, Province of China": "TWN", "Bonaire, Sint Eustatius and Saba": "BES",
    "Saint Helena, Ascension and Tristan da Cunha": "SHN", "Lao People's Democratic Republic (the)": "LAO",
    "Bolivia (Plurinational State of)": "BOL", "Gambia (the)": "GMB", "Micronesia (Federated States of)": "FSM",
    "Iran (Islamic Republic of)": "IRN", "Venezuela (Bolivarian Republic of)": "VEN", "Virgin Islands (British)": "VGB",
    "Virgin Islands (U.S.)": "VIR", "West Bank and Gaza": "PSE", "Svalbard and Jan Mayen Islands": "SJM",
    "Wallis and Futuna Islands": "WLF", "Curaçao": "CUW", "Kosovo": "XKX",
}


def _countries(page: str) -> set[str]:
    out: set[str] = set()
    for block in re.findall(r'<h4 class="[^"]*">Country List</h4>(.*?)</div>', page, re.S):
        text = unicodedata.normalize("NFC", " ".join(html.unescape(re.sub(r"<[^>]+>", " ", block)).split()))
        tokens: list[str] = []
        for t in (t.strip() for t in text.split(",")):
            if not t:
                continue
            if t in SECOND_HALF and tokens:
                tokens[-1] = f"{tokens[-1]}, {t}"
            else:
                tokens.append(t)
        for t in tokens:
            iso3 = NAMES.get(t) or from_name(t)
            if not iso3:
                raise RuntimeError(f"MPP 的國名對不到：{t!r}")
            out.add(iso3)
    return out


def build() -> None:
    sitemap = download(SITEMAP, "mpp", "sitemap.xml").read_text(encoding="utf-8")
    urls = [u for u in re.findall(r"<loc>([^<]+)</loc>", sitemap) if "/licence-post/" in u and "/fr/" not in u]
    territorial: Counter = Counter()
    global_count: Counter = Counter()
    n_territorial = n_global = 0
    covered = set()
    for url in urls:
        slug = url.rstrip("/").rsplit("/", 1)[-1]
        page = download(url, "mpp", f"pages/{slug}.html").read_text(encoding="utf-8")
        countries = _countries(page)
        if not countries:
            continue
        covered |= countries
        if len(countries) >= GLOBAL_MIN:
            n_global += 1
            global_count.update(countries)
        else:
            n_territorial += 1
            territorial.update(countries)
    values = {c: territorial.get(c, 0) for c in covered}
    hints = {c: f"另有 {global_count[c]} 份全球授權（多半是 COVID-19 的技術授權）也涵蓋" for c in covered if global_count[c]}
    hints_en = {c: f"Also covered by {global_count[c]} global licences (mostly COVID-19 technologies)" for c in covered if global_count[c]}
    if "TWN" in hints:
        hints["TWN"] += "；高端疫苗的 MVC-COV1901 也是 MPP 的全球授權，授權人是台灣的高端疫苗公司（2023 年）"
        hints_en["TWN"] += "; Medigen’s MVC-COV1901 vaccine is itself an MPP global licence, with the Taiwanese company as licensor (2023)"
    write_json(OUT / "mpp-licences.json", indicator_file(
        "mpp-licences", "份", [YEAR], {c: [v] for c, v in sorted(values.items())}, hints=hints, hintsEn=hints_en))
    nonzero = sorted(((v, c) for c, v in values.items() if v), reverse=True)
    print(f"  MPP：{len(urls)} 頁，限定地區授權 {n_territorial} 份、全球授權 {n_global} 份；{len(covered)} 個地區，{len(nonzero)} 個有限定地區授權")
    print(f"  最多 {nonzero[:8]}；最少 {nonzero[-8:]}；台灣 {values.get('TWN')}、{hints.get('TWN')}")
