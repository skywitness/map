"""國家小檔案：貨幣怎麼寫（2026-11-05，製作手冊第二十二批 392；步驟 profiles-currency，輸出 topics/profiles/）。

Unicode CLDR 49（Unicode License v3，GitHub 上 common/main 的 XML，跟旅行實用的日期寫法同一批檔）：
- 金額的寫法：那一國人口比例最高、CLDR 有自己日期寫法的官方語言（跟 `topics/travel.py` 的日期寫法同一套規則）的
  `numbers/currencyFormats/currencyFormatLength/currencyFormat[@type='standard']/pattern`，分五類：符號在前沒空格
  （¤#,##0.00，台灣）、符號在前有空格、符號在後有空格、符號在後沒空格、印度式分組（¤#,##,##0.00）。
  阿拉伯語、希伯來語的格式夾著 RLM、LRM、ALM（方向控制字元），分類與例子都先拿掉；不換行空格算空格。
- 符號「當地人怎麼寫」：用同一個語言檔的 currencies/currency/symbol（沒有就用 alt="narrow"，再沒有就寫代碼）；
  新台幣在 zh_Hant 是「$」（跟美元同形，要寫 NT$ 得自己加）。繁體中文的貨幣名稱用 zh_Hant 的 displayName。
- 每個國家的貨幣代碼讀 `profiles/<ISO3>.json` 的 `cur`（`profiles` 步驟用 Wikidata 產生；Wikidata 的 SPARQL 端點
  robots.txt 不允許，這裡不重跑），多貨幣的國家（巴拿馬、辛巴威…）每一種都列，例子用第一種。
"""
from __future__ import annotations

import json
import re

from common import OUT_DIR, indicator_file, write_json
from sources import cldr
from topics.travel import CLDR_REGION, number_example

OUT = OUT_DIR / "topics" / "profiles"
YEAR = 2026
BIDI = re.compile("[‎‏؜]")
# 類別（src/topics/profiles.ts 的 CURRENCY_FORMAT）
BEFORE_TIGHT, BEFORE_SPACE, AFTER_SPACE, AFTER_TIGHT, INDIAN = 1, 2, 3, 4, 5


def classify(pattern: str) -> int:
    p = BIDI.sub("", pattern.split(";")[0])
    number = re.search(r"[#0][#0,.]*", p)
    sign = p.index("¤")
    if "#,##,##0" in p:
        return INDIAN
    if sign < number.start():
        return BEFORE_SPACE if p[sign + 1:number.start()].strip("   ") == "" and sign + 1 < number.start() else BEFORE_TIGHT
    return AFTER_SPACE if number.end() < sign else AFTER_TIGHT


def example(pattern: str, symbol: str, decimal: str, group: str, numbers: str, digits: int = 2) -> str:
    """1234567.89 照那個語言的寫法；小數位數照貨幣（日圓 0 位、科威特第納爾 3 位，CLDR 的 currencyData）"""
    p = BIDI.sub("", pattern.split(";")[0])
    number = re.search(r"[#0][#0,.]*", p)
    amount = number_example(number.group(0), decimal, group, numbers)
    whole, _, frac = amount.rpartition(decimal)
    amount = whole if digits == 0 else whole + decimal + (frac + "0" * digits)[:digits]
    return (p[:number.start()] + amount + p[number.end():]).replace("¤", BIDI.sub("", symbol)).strip()


def _digits() -> dict[str, int]:
    data = cldr._cached("supplemental/supplementalData.xml").find("currencyData/fractions")
    return {el.get("iso4217"): int(el.get("digits")) for el in data.findall("info")}


def _currency_pattern(chain: list[str], system: str) -> str | None:
    def find(root):
        for length in root.findall(f"numbers/currencyFormats[@numberSystem='{system}']/currencyFormatLength"):
            if length.get("type") is not None:
                continue
            for fmt in length.findall("currencyFormat"):
                if fmt.get("type") == "standard":
                    for p in fmt.findall("pattern"):
                        if p.get("alt") is None:
                            return p.text
        return None
    found = cldr._inherited(chain, find)
    return found[0] if found else None


def _symbol(chain: list[str], code: str) -> tuple[str | None, str | None]:
    def find(alt: str | None):
        def go(root):
            for el in root.findall(f"numbers/currencies/currency[@type='{code}']/symbol"):
                if el.get("alt") == alt:
                    return el.text
            return None
        return go
    plain, narrow = cldr._inherited(chain, find(None)), cldr._inherited(chain, find("narrow"))
    return (plain[0] if plain else None), (narrow[0] if narrow else None)


def _zh_names() -> dict[str, str]:
    root = cldr._cached("main/zh_Hant.xml")
    out = {}
    for el in root.findall("numbers/currencies/currency"):
        for name in el.findall("displayName"):
            if name.get("count") is None:
                out[el.get("type")] = name.text
    return out


def build() -> None:
    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        countries = json.load(f)
    languages, lang_names = cldr.territories(), cldr.names()
    zh_names = _zh_names()
    digits = _digits()
    official = {"official", "de_facto_official"}
    values: dict[str, list[int]] = {}
    hints, hints_en, detail = {}, {}, {}
    for path in sorted((OUT / "profiles").glob("*.json")):
        iso3 = path.stem
        codes = [c[0] for c in json.loads(path.read_text(encoding="utf-8")).get("cur", []) if c[0]]
        region = CLDR_REGION.get(iso3) or countries.get(iso3, {}).get("iso2")
        info = languages.get(iso3)
        if not codes or not region or not info:
            continue
        ranked = sorted(info["languages"], key=lambda l: -l[1])
        candidates = [l for l in ranked if l[2] in official] or ranked
        for lang, _, _ in candidates:
            f = cldr.locale_formats(f"{lang}_{region}")
            if f and f["ownDate"]:
                break
        else:
            continue
        chain = cldr.locale_chain(f"{lang}_{region}")
        pattern = _currency_pattern(chain, f["numbers"]) or _currency_pattern(chain, "latn")
        if not pattern:
            continue
        symbols = []
        for code in codes:
            plain, narrow = _symbol(chain, code)
            plain, narrow = (BIDI.sub("", x) if x else x for x in (plain, narrow))
            symbols.append([code, plain or narrow or code, narrow, zh_names.get(code)])
        name = lang_names.get(lang) or lang_names.get(lang.split("_")[0])
        zh_lang, en_lang = (name[0], name[1]) if name and name[0] else (lang, lang)
        ex = example(pattern, symbols[0][1], f["decimal"], f["group"], f["numbers"], digits.get(codes[0], digits["DEFAULT"]))
        values[iso3] = [classify(pattern)]
        hints[iso3] = f"依{zh_lang}：{ex}"
        hints_en[iso3] = f"Based on {en_lang}: {ex}"
        detail[iso3] = {"lang": [zh_lang, en_lang], "pattern": BIDI.sub("", pattern), "ex": ex, "sym": symbols}
    write_json(OUT / "currency-format.json", indicator_file(
        "currency-format", "類別", [YEAR], values, hints=hints, hintsEn=hints_en,
    ))
    write_json(OUT / "currency-format-detail.json", detail)
    counts: dict[int, list[str]] = {}
    for iso3, (v,) in values.items():
        counts.setdefault(v, []).append(iso3)
    print(f"  金額的寫法 {len(values)} 國：" + "；".join(f"{v}: {len(c)}" + (f" {c}" if len(c) < 12 else "") for v, c in sorted(counts.items())))
    for iso3 in ("TWN", "FRA", "CHE", "IND", "JPN", "DEU", "USA", "SAU", "ISR", "KHM", "TUR", "NLD"):
        if iso3 in detail:
            d = detail[iso3]
            print(f"  {iso3} {d['lang'][0]} {d['pattern']!r} {d['ex']!r} {d['sym']}")
