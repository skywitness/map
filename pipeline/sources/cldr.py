"""Unicode CLDR：各國的語言使用人口比例、官方地位，以及語言名稱（Unicode License v3）。

supplementalData.xml 的 territoryInfo：每個國家一個 <territory>（含人口），
底下每種語言一個 <languagePopulation>：populationPercent 是「會說這種語言的人口比例」，
包含第二語言，所以一國的比例加總常超過 100%；officialStatus 是 official、de_facto_official、official_regional。
"""
from __future__ import annotations

import re
import urllib.error
import xml.etree.ElementTree as ET

from common import download
from sources.countries import from_alpha2

VERSION = "release-49"
BASE = f"https://raw.githubusercontent.com/unicode-org/cldr/{VERSION}/common"

def _file(path: str) -> ET.Element:
    name = path.replace("/", "-")
    return ET.parse(download(f"{BASE}/{path}", "cldr", f"{VERSION}-{name}")).getroot()


def territories() -> dict[str, dict]:
    """ISO3 → {"population": 人口, "languages": [(語言代碼, 比例 %, 官方地位或 None), …]}。

    語言代碼照 CLDR 原樣（可能帶文字，例如 zh_Hant、sr_Latn）。南極洲等沒有 ISO 國家代碼的區域略過。
    """
    out = {}
    for t in _file("supplemental/supplementalData.xml").find("territoryInfo").findall("territory"):
        iso3 = from_alpha2(t.get("type"))
        if not iso3:
            continue
        languages = [
            (lp.get("type"), float(lp.get("populationPercent")), lp.get("officialStatus"))
            for lp in t.findall("languagePopulation")
            if lp.get("type") != "und"
        ]
        out[iso3] = {"population": int(float(t.get("population"))), "languages": languages}
    return out


def names() -> dict[str, tuple[str | None, str]]:
    """語言代碼 → (繁體中文名稱, 英文名稱)。zh_Hant 沒有的回傳 None（不退回簡體的 zh.xml）。"""
    def read(locale: str) -> dict[str, str]:
        out = {}
        for el in _file(f"main/{locale}.xml").iter("language"):
            if el.get("alt") is None and el.text and el.text.strip() != "↑↑↑":
                out[el.get("type")] = el.text.strip()
        return out

    en, zh = read("en"), read("zh_Hant")
    return {code: (zh.get(code), name) for code, name in en.items()}


def iso639_3() -> dict[str, str]:
    """CLDR 語言代碼 → ISO 639-3 個別語言代碼，用來對 Glottolog。

    兩個字母的代碼（en）換成三個字母（eng）；巨集語言（ar、zh、ms、fa、sw…）換成 CLDR 指定的代表語言
    （arb 標準阿拉伯語、cmn 華語、zsm 標準馬來語…），因為 Glottolog 只收個別語言。
    """
    aliases = _file("supplemental/supplementalMetadata.xml").find("metadata/alias")
    overlong, macro = {}, {}
    for el in aliases.findall("languageAlias"):
        source, target, reason = el.get("type"), el.get("replacement"), el.get("reason")
        if reason == "overlong" and len(source) == 3 and len(target) == 2:
            overlong[target] = source
        elif reason == "macrolanguage" and len(source) == 3:
            macro[target] = source
    return {**overlong, **macro}


# ── 生活格式（旅行實用主題）：supplementalData.xml 依地區給的值、main/<語言>.xml 依語言給的值 ──

_CACHE: dict[str, ET.Element | None] = {}


def _cached(path: str) -> ET.Element | None:
    """同一個檔只解析一次；main/ 底下沒有這個語言檔（404）時回傳 None。"""
    if path not in _CACHE:
        try:
            _CACHE[path] = _file(path)
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
            _CACHE[path] = None
    return _CACHE[path]


def _by_territory(elements: list[ET.Element], attr: str = "territories") -> dict[str, list[ET.Element]]:
    """地區代碼 → 列出它的元素（照檔案順序）；territories 是空白分隔的地區代碼，001 是預設值。"""
    out: dict[str, list[ET.Element]] = {}
    for el in elements:
        for code in el.get(attr, "").split():
            out.setdefault(code, []).append(el)
    return out


def week_data() -> dict[str, dict[str, str]]:
    """地區（alpha-2 與 001）→ {"first": 一週的第一天, "weekendStart", "weekendEnd"}（sun、mon…）。

    有 alt 屬性的（英國 alt="variant" 的星期日）是替代說法，不用。
    """
    week = _cached("supplemental/supplementalData.xml").find("weekData")
    out: dict[str, dict[str, str]] = {}
    for tag, key in (("firstDay", "first"), ("weekendStart", "weekendStart"), ("weekendEnd", "weekendEnd")):
        for code, els in _by_territory([e for e in week.findall(tag) if e.get("alt") is None]).items():
            out.setdefault(code, {})[key] = els[-1].get("day")
    return out


def measurement_data() -> dict[str, dict[str, str]]:
    """地區 → {"system": metric／US／UK, "temperature": 溫度另外用的制度（有的話）, "paper": A4／US-Letter}。

    measurementSystem 有 category="temperature" 的是「只有溫度」的例外（賴比瑞亞整體是美制、溫度用攝氏；
    巴哈馬、貝里斯、開曼群島、波多黎各、帛琉整體是公制、溫度用華氏），沒有 category 的才是整體的制度。
    """
    m = _cached("supplemental/supplementalData.xml").find("measurementData")
    out: dict[str, dict[str, str]] = {}
    for el in m.findall("measurementSystem"):
        key = "temperature" if el.get("category") == "temperature" else "system"
        for code in el.get("territories").split():
            out.setdefault(code, {})[key] = el.get("type")
    for el in m.findall("paperSize"):
        for code in el.get("territories").split():
            out.setdefault(code, {})["paper"] = el.get("type")
    return out


def time_data() -> dict[str, tuple[str, str]]:
    """地區或「語言_地區」→ (preferred, allowed)：preferred 的 h 是 12 小時制、H 是 24 小時制。"""
    t = _cached("supplemental/supplementalData.xml").find("timeData")
    return {code: (els[-1].get("preferred"), els[-1].get("allowed")) for code, els in _by_territory(t.findall("hours"), "regions").items()}


def calendar_preference() -> dict[str, list[str]]:
    """地區 → 慣用的曆法（依常用的程度排列，例如台灣 ["gregorian", "roc", "chinese"]）。"""
    c = _cached("supplemental/supplementalData.xml").find("calendarPreferenceData")
    return {code: els[-1].get("ordering").split() for code, els in _by_territory(c.findall("calendarPreference")).items()}


def _parents() -> dict[str, str]:
    """parentLocales（沒有 component 屬性的那組）：語言檔 → 明定的上一層（en_IN → en_001、zh_Hant → root）。"""
    out = {}
    for group in _cached("supplemental/supplementalData.xml").findall("parentLocales"):
        if group.get("component"):
            continue
        for el in group.findall("parentLocale"):
            for loc in el.get("locales").split():
                out[loc] = el.get("parent")
    return out


def locale_chain(locale: str) -> list[str]:
    """CLDR 的繼承鏈：自己 → parentLocales 明定的上一層，或去掉最後一段 → … → root；只列出有檔案的。"""
    parents = _parents()
    chain, loc = [], locale
    while loc:
        if _cached(f"main/{loc}.xml") is not None:
            chain.append(loc)
        if loc == "root":
            break
        loc = parents.get(loc) or ("_".join(loc.split("_")[:-1]) or "root")
    return chain


def _inherited(chain: list[str], find) -> tuple[str, bool] | None:
    """依繼承鏈找第一個有值的：(值, 是否由這個語言自己決定)。

    "↑↑↑" 是「照上一層」：CLDR 看過、確定跟上一層一樣，也算這個語言自己決定的。root 以外的語言檔都沒有寫，
    只能用 root 的預設值時，第二個值是 False（CLDR 收錄得很少的語言，不能當成當地的寫法）。
    值可能只有空白（瑞典語的千分位是不換行空格），不能 strip 掉再判斷。
    """
    own = False
    for loc in chain:
        v = find(_cached(f"main/{loc}.xml"))
        if v is not None and v != "" and loc != "root":
            own = True
        if v is not None and v != "" and v.strip() != "↑↑↑":
            return v, own
    return None


def locale_formats(locale: str) -> dict | None:
    """語言（例如 fr_CH）的西曆短日期格式與數字符號：
    {"locale": 找到的最具體的語言檔, "date", "numbers", "decimal", "group", "pattern", "ownDate", "ownNumbers"}。

    數字符號用那個語言預設的數字系統（多數是 latn；部分阿拉伯語、波斯語是 arab、arabext）。
    ownDate、ownNumbers 是這個語言自己有沒有寫（見 _inherited()）：沒有寫的只是 root 的預設值（y-MM-dd、「.」），
    CLDR 收錄得很少的語言會這樣，不能當成當地的寫法。沒有這個語言檔的回傳 None。
    """
    chain = locale_chain(locale)
    if not chain or chain[0] == "root":
        return None

    def short_date(root: ET.Element) -> str | None:
        for dfl in root.findall("dates/calendars/calendar[@type='gregorian']/dateFormats/dateFormatLength[@type='short']"):
            for p in dfl.iter("pattern"):
                if p.get("alt") is None:
                    return p.text
        return None

    numbers = (_inherited(chain, lambda r: r.findtext("numbers/defaultNumberingSystem")) or ("latn", "root"))[0]

    def symbol(name: str, system: str) -> tuple[str, str] | None:
        return _inherited(chain, lambda r: r.findtext(f"numbers/symbols[@numberSystem='{system}']/{name}"))

    def decimal_pattern(system: str) -> tuple[str, str] | None:
        return _inherited(
            chain, lambda r: r.findtext(f"numbers/decimalFormats[@numberSystem='{system}']/decimalFormatLength/decimalFormat/pattern")
        )

    system = numbers if symbol("decimal", numbers) else "latn"
    date = _inherited(chain, short_date)
    decimal, group = symbol("decimal", system), symbol("group", system)
    pattern = decimal_pattern(system) or decimal_pattern("latn")
    return {
        "locale": chain[0],
        # 阿拉伯語的格式夾著 RLM（U+200F）控制方向，顯示時不需要
        "date": re.sub("[\u200e\u200f\u061c]", "", date[0]),
        "numbers": system,
        "decimal": decimal[0],
        "group": group[0],
        "pattern": pattern[0],
        "ownDate": date[1],
        "ownNumbers": decimal[1] or group[1],
    }
