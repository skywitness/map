"""Unicode CLDR：各國的語言使用人口比例、官方地位，以及語言名稱（Unicode License v3）。

supplementalData.xml 的 territoryInfo：每個國家一個 <territory>（含人口），
底下每種語言一個 <languagePopulation>：populationPercent 是「會說這種語言的人口比例」，
包含第二語言，所以一國的比例加總常超過 100%；officialStatus 是 official、de_facto_official、official_regional。
"""
from __future__ import annotations

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
