"""最大面額的鈔票（2026-11-05，使用者把已排除的候選 681 改成要做，跟第二十二批 397 一起決定；步驟 banknote-largest，
輸出 topics/banknotes/）。

- 各國用哪些貨幣：英文維基「List of circulating currencies」固定版本（LIST_REVID）的表（國家 → 貨幣條目）。
- 面額：每一種貨幣條目資訊框的「Banknotes」那一段（Freq. used、Rarely used）列的面額，「Discontinued」等字之後的
  （已停發）不算，取最大的數字；資訊框沒有列面額的（日圓、英鎊、瑞士法郎…），改讀條目「Banknotes」那一節第一張表的
  面額欄。讀
  `/wiki/<條目>` 現在的版本（每篇間隔 2 秒，快取在 .cache/wikipedia/<條目>-current.html），頁面裡的版本號記在輸出檔。
  紀念鈔、已停發的不一定分得出來（資訊框多半只列現在發行的），說明寫明。英文維基 CC BY-SA 4.0，輸出檔依同樣授權分享。
- 換成美元：世界銀行 WDI 的官方匯率 PA.NUS.FCRF（每美元兌多少本國貨幣，年平均，CC BY 4.0）最近一年（2023 年以後才用，
  太舊的可能是改制前的舊貨幣）；台灣用中央銀行
  的新台幣對美元年平均匯率。共用貨幣（歐元、非洲法郎、東加勒比元…）用發行國（或歐元區）的匯率。惡性通膨的國家
  官方匯率跟市場差很多，美元值只當參考。
- 一國有好幾種法定貨幣（巴拿馬、辛巴威…）用表上的第一種。
"""
from __future__ import annotations

import html as H
import re
import time
import urllib.parse

import pycountry

from common import CACHE_DIR, OUT_DIR, download, indicator_file, write_json
from sources import cbc_fx, worldbank, wikipedia_html

OUT = OUT_DIR / "topics" / "banknotes"
LIST_TITLE = "List of circulating currencies"
LIST_REVID = 1383733421
YEAR = 2026
STATES = {
    "Bolivia": "BOL", "Brunei": "BRN", "Cape Verde": "CPV", "Congo, Democratic Republic of the": "COD",
    "Congo, Republic of the": "COG", "East Timor": "TLS", "Iran": "IRN", "Ivory Coast": "CIV", "Laos": "LAO",
    "Micronesia": "FSM", "Moldova": "MDA", "North Korea": "PRK", "South Korea": "KOR", "Russia": "RUS", "Syria": "SYR",
    "Tanzania": "TZA", "Turkey": "TUR", "Vatican City": "VAT", "Venezuela": "VEN", "Vietnam": "VNM", "Palestine": "PSE",
    "Taiwan": "TWN", "Kosovo": "XKX", "Northern Cyprus": "_CYN", "Somaliland": "_SOL", "Sahrawi Republic": "ESH",
    "The Bahamas": "BHS", "Bahamas, The": "BHS", "The Gambia": "GMB", "Gambia, The": "GMB", "Czech Republic": "CZE",
    "São Tomé and Príncipe": "STP", "Eswatini": "SWZ", "Netherlands": "NLD", "Curaçao": "CUW", "Sint Maarten": "SXM",
    "Saint Helena, Ascension and Tristan da Cunha": "SHN", "Pitcairn Islands": "PCN", "Falkland Islands": "FLK",
    "Cook Islands": "COK", "Niue": "NIU", "Macau": "MAC", "Hong Kong": "HKG", "Faroe Islands": "FRO",
    "British Virgin Islands": "VGB", "United States Virgin Islands": "VIR", "Wallis and Futuna": "WLF",
}


def _iso3(name: str) -> str | None:
    name = re.sub(r"\[.*?\]|\(.*?\)", "", name).strip()
    if name in STATES:
        return STATES[name]
    try:
        return pycountry.countries.lookup(name).alpha_3
    except LookupError:
        return None


def _article(title: str) -> tuple[str, int]:
    """貨幣條目現在的版本（HTML、版本號）"""
    fname = f"{title.replace(' ', '_').replace('/', '_')}-current.html"
    cached = (CACHE_DIR / "wikipedia" / fname).exists()
    url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"
    text = download(url, "wikipedia", fname).read_text(encoding="utf-8")
    if not cached:
        time.sleep(2)
    rev = re.search(r'"wgRevisionId":(\d+)', text)
    return text, int(rev.group(1)) if rev else 0


NUM = re.compile(r"(\d{1,3}(?:[,\u00a0 .]\d{3})+|\d+(?:\.\d+)?)\s*(million|thousand|billion)?")
CUT = re.compile(r"(discontinued|withdrawn|no longer|demoneti[sz]ed|not in circulation|commemorative|obsolete|until \d{4})", re.I)


def _numbers(text: str) -> list[float]:
    nums = []
    for m in NUM.finditer(text):
        raw = re.sub(r"[,\u00a0 ]", "", m.group(1))
        raw = raw.replace(".", "") if re.fullmatch(r"\d{1,3}(\.\d{3})+", raw) else raw
        try:
            v = float(raw)
        except ValueError:
            continue
        nums.append(v * {"million": 1e6, "thousand": 1e3, "billion": 1e9}.get(m.group(2) or "", 1))
    return nums


def _plain(fragment: str) -> str:
    text = re.sub(r"<sup.*?</sup>|<style.*?</style>", "", fragment, flags=re.S)
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]+>", " ", text))).strip()


def _infobox(page: str) -> str:
    """資訊框 Banknotes 一段（Freq. used、Rarely used 或 Banknotes 那一格）的文字，已停發的截掉"""
    box = re.search(r'<table[^>]*class="[^"]*infobox[^"]*".*?</table>', page, re.S)
    if not box:
        return ""
    texts, in_notes = [], False
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", box.group(0), re.S):
        cells = [(k, _plain(v)) for k, v in re.findall(r"<(th|td)[^>]*>(.*?)</\1>", row, re.S)]
        if not cells:
            continue
        label = cells[0][1] if cells[0][0] == "th" else ""
        value = " ".join(v for k, v in cells[1:] if k == "td")
        if label == "Banknotes":
            in_notes = True
            if value:
                texts.append(value)
            continue
        if in_notes:
            if re.match(r"^(Freq\.? used|Frequently used|Rarely used|Used)", label, re.I) and value:
                texts.append(f"{label} {value}")
                continue
            break
    return " · ".join(CUT.split(t)[0] for t in texts)


def _section_table(page: str) -> str:
    """資訊框沒有面額時：條目「Banknotes」那一節第一張 wikitable 的面額欄（表頭有 Value 或 Denomination）"""
    m = re.search(r'<h[23][^>]*id="[^"]*[Bb]anknote[^"]*"', page)
    if not m:
        return ""
    rest = page[m.end():]
    nxt = re.search(r"<h2", rest)
    section = rest[: nxt.start()] if nxt else rest
    for table in wikipedia_html.tables(section):
        start = next((i for i, r in enumerate(table) if any(re.search(r"value|denomination", c[0], re.I) for c in r)), None)
        if start is None:
            continue
        col = next(i for i, c in enumerate(table[start]) if re.search(r"value|denomination", c[0], re.I))
        vals = [
            re.sub(r"\d+\s*×\s*\d+\s*mm", "", r[col][0])  # 尺寸（131 × 62 mm）不是面額
            for r in table[start + 1:]
            if len(r) > col and not CUT.search(" ".join(c[0] for c in r))
            and not re.search(r"image|table standards|series|pixel", r[col][0], re.I)
        ]
        if vals:
            return "表：" + ", ".join(v.strip() for v in vals if v.strip())
    return ""


# 備案（Banknotes 那一節的表）抓到的是舊系列、硬幣或不完整的表，人工看過、不畫的貨幣（2026-11-05 的條目版本）
UNRELIABLE = {
    "Belarusian ruble", "Indian rupee", "Kazakhstani tenge", "Tanzanian shilling", "Mauritian rupee", "Albanian lek",
    "Czech koruna", "Danish krone", "Brazilian real", "Caribbean guilder", "Malawian kwacha",
    "Djiboutian franc",  # 資訊框的面額格只剩「40 (」，解析不出來
}
# 資訊框「Rarely used」裡是紀念鈔的（斐濟的 7 元與 2,000 元），只用常用的面額
FREQ_ONLY = {"Fijian dollar"}
MIN_RATE_YEAR = 2023  # 太舊的官方匯率可能是改制前的舊貨幣（土庫曼 2001、敘利亞 2022、委內瑞拉 2017），不用


def banknotes(page: str) -> tuple[str, float | None]:
    """面額的文字與最大的面額（先看資訊框，沒有再看 Banknotes 那一節的表）"""
    text = _infobox(page) or _section_table(page)
    nums = [n for n in _numbers(text) if n >= 1]
    return text, (max(nums) if nums else None)


def build() -> None:
    table = wikipedia_html.tables(wikipedia_html.page(LIST_TITLE, LIST_REVID))[0]
    by_state: dict[str, tuple[str, str]] = {}
    for r in table[1:]:
        if len(r) < 4 or not r[1][1]:
            continue
        iso3 = _iso3(r[0][0])
        code = r[3][0].strip()
        if iso3 and iso3 not in by_state and re.fullmatch(r"[A-Z]{3}", code):
            by_state[iso3] = (r[1][1][0], code)
    articles: dict[str, tuple[str, float | None, int]] = {}
    for title, _ in sorted(set(by_state.values())):
        page, revid = _article(title)
        text, top = banknotes(page)
        if title in UNRELIABLE:
            text, top = "", None
        elif title in FREQ_ONLY:
            text = text.split(" · Rarely used")[0]
            nums = [n for n in _numbers(text) if n >= 1]
            top = max(nums) if nums else None
        articles[title] = (text, top, revid)

    rates, _ = worldbank.fetch("PA.NUS.FCRF", 2015, 2026)
    tw = cbc_fx.ntd_per_usd()
    tw_year = max(tw)
    usd, local, hints, hints_en, detail = {}, {}, {}, {}, {}
    code_country = {"EUR": "EMU", "XOF": "SEN", "XAF": "CMR", "XCD": None, "XPF": None, "ANG": None}
    for iso3, (title, code) in sorted(by_state.items()):
        text, top, revid = articles[title]
        if top is None:
            continue
        local[iso3] = [top]
        if iso3 == "TWN":
            rate, ry = tw[tw_year], tw_year
        else:
            series = rates.get(iso3) or rates.get(code_country.get(code) or "", {})
            ry = max(series) if series else None
            rate = series.get(ry) if ry and ry >= MIN_RATE_YEAR else None
        detail[iso3] = [title, code, text, top, revid, rate, ry]
        if rate:
            usd[iso3] = [top / rate]
            hints[iso3] = f"{top:,.0f} {code}（{title}）"
            hints_en[iso3] = f"{top:,.0f} {code} ({title})"
    missing = sorted(c for c in by_state if c not in usd)
    nv = ("英文維基的貨幣條目沒有列出可靠的現行面額，或沒有官方匯率", "No reliable current denominations in the Wikipedia article, or no official exchange rate")
    write_json(OUT / "largest-usd.json", indicator_file(
        "largest-usd", "美元", [YEAR], usd, hints=hints, hintsEn=hints_en,
        noValue={c: nv[0] for c in missing}, noValueEn={c: nv[1] for c in missing},
    ))
    write_json(OUT / "largest-detail.json", {"listRevid": LIST_REVID, "countries": detail})
    ranked = sorted(usd.items(), key=lambda kv: -kv[1][0])
    print(f"  {len(by_state)} 國、{len(articles)} 種貨幣；有面額 {len(local)}、換得成美元 {len(usd)}")
    print(f"  最大 {[(c, round(v[0])) for c, v in ranked[:10]]}")
    print(f"  最小 {[(c, round(v[0], 2)) for c, v in ranked[-10:]]}")
    print(f"  沒有面額：{sorted(c for c in by_state if c not in local)}")
    print(f"  台灣 {detail.get('TWN')}")
