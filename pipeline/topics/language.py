"""語言主題：各國會說哪些語言、比例多少、是不是官方語言，以及各國有多少種語言。

- 使用比例、官方地位：Unicode CLDR 的 territoryInfo（`sources/cldr.py`）。比例是「會說這種語言的人口比例」，
  包含第二語言，所以一國的比例加總常超過 100%。CLDR 只列出有一定人數的語言，沒列出的國家當成無資料。
- 語言數：Glottolog 收錄、分布在這個國家、還沒消失的語言（`sources/glottolog.py`）。
- 台灣：比例改用 109 年人口及住宅普查（6 歲以上本國籍常住人口，主要或次要使用語言），見 TAIWAN_CENSUS。

CLDR 與 Glottolog 都是目前的快照，沒有歷年資料，指標檔只有一年（YEAR）。
"""
from __future__ import annotations

import re
from collections import Counter

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import cldr, glottolog
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "language"
YEAR = 2026  # CLDR 49 與 Glottolog 5.3 都是 2026 年的版本

# 子項目選單上的語言（跟 src/topics/language.ts 的 dimension 一致）。
# 同一種語言的不同文字（zh、zh_Hant）合併；阿拉伯語含各地口語（埃及、黎凡特、馬格里布…），馬來語含印尼語
ITEMS = [
    "en", "zh", "es", "fr", "ar", "ru", "pt", "de",
    "hi", "bn", "ur", "ja", "ko", "ms", "vi", "th", "tr", "fa", "ta", "fil", "nan", "hak", "yue",
    "sw", "ha", "am", "yo",
    "it", "nl", "pl",
]
MALAY = {"ms", "id"}
ARABIC_NODE = "arab1395"  # Glottolog 的 Arabic 分支
NOT_ARABIC = {"mt"}  # 馬爾他語在 Glottolog 的 Arabic 分支裡，但一般不算阿拉伯語

# 官方地位的類別代碼（跟 src/topics/language.ts 的 STATUS 一致）；沒有官方地位的是 4
STATUS_CODE = {"official": 1, "de_facto_official": 2, "official_regional": 3, None: 4}
STATUS_RANK = {"official": 3, "de_facto_official": 2, "official_regional": 1, None: 0}

# 109 年人口及住宅普查，表 4-1「6 歲以上本國籍常住人口之使用語言情形」：主要使用＋次要使用（%）
# 行政院主計總處《109 年人口及住宅普查總報告》貳、普查結果提要分析
TAIWAN_CENSUS = {
    "zh": (66.4, 30.4),   # 國語
    "nan": (31.7, 54.3),  # 閩南語
    "hak": (1.5, 4.0),    # 客語
    "fox": (0.2, 0.9),    # 原住民族語（16 族合計；ISO 639-5 的 fox 是「台灣南島語」）
}
# 國家語言發展法（2019）：各固有族群的語言與台灣手語都是國家語言。CLDR 把華語、台語、客語標成官方，原住民族語同樣標成官方
TAIWAN_STATUS = "official"

# 名稱：CLDR 沒有的，或台灣習慣的叫法不同
NAMES = {
    "zh": ("華語（中文）", "Chinese (Mandarin)"),
    "nan": ("台語（閩南語）", "Taiwanese Hokkien (Min Nan)"),
    "hak": ("客語", "Hakka"),
    "fox": ("原住民族語（16 族合計）", "Formosan languages (16 combined)"),
}


def _zh_name(name: str | None) -> str | None:
    """CLDR 的繁中名稱多半是「英文」「阿拉伯文（埃及）」這種書面語的叫法，講的是會說的人，改成「英語」"""
    if not name or name == "中文":
        return name
    return re.sub(r"文(?=$|（)", "語", name)


def _base(code: str) -> str:
    """去掉文字標記：zh_Hant → zh、sr_Latn → sr"""
    return code.split("_")[0]


def _merge(languages: list[tuple[str, float, str | None]], key) -> dict[str, tuple[float, str | None]]:
    """依 key 合併：比例取最大（同一批人用不同文字或方言，不能相加），官方地位取最強的。"""
    out: dict[str, tuple[float, str | None]] = {}
    for code, percent, status in languages:
        k = key(code)
        old_percent, old_status = out.get(k, (0.0, None))
        out[k] = (max(old_percent, percent), status if STATUS_RANK[status] > STATUS_RANK[old_status] else old_status)
    return out


def _code36(code: str) -> int:
    """語言代碼的 36 進位數（en → 527），當類別圖的數值；前端用 v.toString(36) 換回來，不必共用對照表"""
    return int(code, 36)


def _from_code36(value: int) -> str:
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while value:
        value, r = divmod(value, 36)
        out = digits[r] + out
    return out


def build() -> None:
    territories = cldr.territories()
    names = cldr.names()
    to_iso639 = cldr.iso639_3()
    languages = glottolog.languages()
    by_iso = {lang["iso"]: lang for lang in languages if lang["iso"]}

    def item_of(code: str) -> str:
        base = _base(code)
        if base in MALAY:
            return "ms"
        lang = by_iso.get(to_iso639.get(base, base))
        if base not in NOT_ARABIC and lang and ARABIC_NODE in lang["classification"]:
            return "ar"
        return base

    # ── 台灣改用普查 ──
    tw_cldr = _merge(territories["TWN"]["languages"], _base)
    territories["TWN"]["languages"] = [
        (code, round(main + secondary, 1), TAIWAN_STATUS) for code, (main, secondary) in TAIWAN_CENSUS.items()
    ]
    census = {code: f"{main + secondary:.1f}%" for code, (main, secondary) in TAIWAN_CENSUS.items()}
    estimate = {code: f"{tw_cldr[code][0]:g}%" for code in ("zh", "nan", "hak")}
    note_tw = (
        "台灣的比例來自 109 年（2020）人口及住宅普查：6 歲以上本國籍常住人口中，主要或次要使用這種語言的比例"
        f"（國語 {census['zh']}、閩南語 {census['nan']}、客語 {census['hak']}、原住民族語 {census['fox']}）。"
        f"CLDR 的估計是華語 {estimate['zh']}、台語 {estimate['nan']}、客語 {estimate['hak']}。"
    )
    note_tw_en = (
        "Taiwan's shares come from the 2020 Population and Housing Census: the share of resident citizens aged 6 and over "
        f"who use the language as their main or second language (Mandarin {census['zh']}, Taiwanese Hokkien {census['nan']}, "
        f"Hakka {census['hak']}, Formosan languages {census['fox']}). "
        f"CLDR estimates Mandarin at {estimate['zh']}, Taiwanese Hokkien at {estimate['nan']} and Hakka at {estimate['hak']}."
    )
    notes = {"notes": {"TWN": note_tw}, "notesEn": {"TWN": note_tw_en}}

    # ── 每種語言：使用比例、使用人數、官方地位 ──
    per_item = {iso3: _merge(t["languages"], item_of) for iso3, t in territories.items()}
    for item in ITEMS:
        share, speakers, status = {}, {}, {}
        for iso3, merged in per_item.items():
            if item not in merged:
                continue
            percent, st = merged[item]
            share[iso3] = [round(percent, 3)]
            speakers[iso3] = [round(territories[iso3]["population"] * percent / 100)]
            status[iso3] = [STATUS_CODE[st]]
        tw = notes if item in ("zh", "nan", "hak") else {}
        write_json(OUT / "share" / f"{item}.json", indicator_file("share", "%", [YEAR], share, **tw), quiet=True)
        # 世界合計：側欄與排名表的「占全球」（這種語言的使用者有多少比例在這個國家）
        world = {"WLD": [sum(v[0] for v in speakers.values())]}
        write_json(
            OUT / "speakers" / f"{item}.json",
            indicator_file("speakers", "人", [YEAR], speakers, aggregates=world, **tw),
            quiet=True,
        )
        write_json(OUT / "status" / f"{item}.json", indicator_file("status", "", [YEAR], status), quiet=True)
        print(f"  {item}: {len(share)} 國，共 {sum(v[0] for v in speakers.values()) / 1e6:.0f} 百萬人")

    # ── 主要官方語言：官方（含事實上的官方）語言中會說的人最多的；沒有官方語言的取會說的人最多的 ──
    main = {}
    for iso3, merged in per_item.items():
        if not merged:
            continue
        official = {k: v for k, v in merged.items() if v[1] in ("official", "de_facto_official")} or merged
        main[iso3] = [_code36(max(official, key=lambda k: official[k][0]))]
    write_json(OUT / "main.json", indicator_file("main", "", [YEAR], main))
    print("  主要官方語言：", Counter(_from_code36(v[0]) for v in main.values()).most_common(12))

    # ── 語言數（Glottolog）──
    living, endangered = Counter(), Counter()
    for lang in languages:
        if lang["category"] not in glottolog.SPOKEN or lang["aes"] == "extinct":
            continue
        for alpha2 in lang["countries"]:
            living[alpha2] += 1
            endangered[alpha2] += lang["aes"] in glottolog.ENDANGERED
    counts = {}
    for alpha2, n in living.items():
        iso3 = from_alpha2(alpha2)
        if iso3:
            counts[iso3] = (n, endangered[alpha2])
    write_json(OUT / "diversity.json", indicator_file("diversity", "種", [YEAR], {k: [v[0]] for k, v in counts.items()}))
    print(f"  語言數：{len(counts)} 國，台灣 {counts['TWN'][0]} 種（瀕危 {counts['TWN'][1]}）")

    # ── 側欄：每個國家的語言清單（同一語言不同文字合併，阿拉伯語各地口語分開列）──
    countries = {}
    used: set[str] = set()
    for iso3, t in territories.items():
        if not t["languages"]:  # 南極洲等只有「未知語言」的地區
            continue
        merged = _merge(t["languages"], _base)
        langs = sorted(merged.items(), key=lambda kv: -kv[1][0])
        used.update(code for code, _ in langs)
        countries[iso3] = {
            "population": t["population"],
            "languages": [[code, round(p, 3), st] for code, (p, st) in langs],
        }
    for iso3, (n, n_endangered) in counts.items():
        countries.setdefault(iso3, {"languages": []})["glottolog"] = [n, n_endangered]
    english_from_glottolog = {lang["iso"]: lang["name"] for lang in languages if lang["iso"]}
    names_out = {}
    for code in sorted(used | set(ITEMS)):
        zh, en = NAMES.get(code) or names.get(code) or (None, None)
        zh = _zh_name(zh)
        en = en or english_from_glottolog.get(to_iso639.get(code, code)) or code
        names_out[code] = [zh, en]
    write_json(OUT / "languages.json", {"year": YEAR, "names": names_out, "countries": countries, **notes})

    write_json(OUT / "manifest.json", {
        "topic": "language",
        "generatedAt": now_iso(),
        "source": f"Unicode CLDR {cldr.VERSION}; Glottolog {glottolog.VERSION}; 109 年人口及住宅普查",
    })
