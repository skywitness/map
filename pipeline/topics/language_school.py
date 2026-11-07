"""語言：學校裡學哪些外語（2026-11-06，製作手冊第二十四批 422；步驟 language-school，輸出 topics/language/）。

- Eurostat `educ_uoe_lang01`「Pupils by education level and modern foreign language studied」（PC：學那一種外語的學生
  占那一個教育階段的比例，2012–2024）與 `educ_uoe_lang03`「Average number of foreign languages studied per pupil」
  （2012–2025）。CC BY 4.0；英國、科索沃由 sources/eurostat.py 統一排除（非商業）。只有歐洲 40 國左右，台灣沒有。
- 預設看國中（ISCED 2，ED2）：高中混了普通科與技職，技職學外語的比例低很多。比例是各語言分開算，一個學生學兩種
  會各算一次，加起來會超過 100%。
- 2026-11-07：學中文、學日語的高中生人數（ED3，NR）做成比例圓（school-learners-{chinese,japanese}.json）。
- 「英語以外最多人學的外語」：芬蘭的瑞典語、比利時的法語與荷蘭語是本國語言，Eurostat 也算進去，照資料；
  愛爾蘭的英語是本國語言，不算外語，所以愛爾蘭最多人學的是法語。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "language"
# Eurostat 的語言代碼 → (類別代碼, 中文, 英文)；類別代碼跟 src/topics/language-school.ts 的 SCHOOL_LANGUAGES 一樣
LANGS = {
    "FRE": (1, "法語", "French"), "GER": (2, "德語", "German"), "SPA": (3, "西班牙語", "Spanish"),
    "RUS": (4, "俄語", "Russian"), "ITA": (5, "義大利語", "Italian"), "SWE": (6, "瑞典語", "Swedish"),
    "DAN": (7, "丹麥語", "Danish"), "DUT": (8, "荷蘭語", "Dutch"),
}
OTHER = 9  # 其他語言
NAMES = {**{k: (zh, en) for k, (_, zh, en) in LANGS.items()}, "ENG": ("英語", "English"), "POR": ("葡萄牙語", "Portuguese"),
         "CHI": ("中文", "Chinese"), "JPN": ("日語", "Japanese"), "ARA": ("阿拉伯語", "Arabic"), "GRE": ("希臘語", "Greek"),
         "FIN": ("芬蘭語", "Finnish"), "POL": ("波蘭語", "Polish"), "CZE": ("捷克語", "Czech"), "HUN": ("匈牙利語", "Hungarian"),
         "GLE": ("愛爾蘭語", "Irish"), "EST": ("愛沙尼亞語", "Estonian"), "LAV": ("拉脫維亞語", "Latvian"),
         "LIT": ("立陶宛語", "Lithuanian"), "BUL": ("保加利亞語", "Bulgarian"), "HRV": ("克羅埃西亞語", "Croatian"),
         "RUM": ("羅馬尼亞語", "Romanian"), "SLO": ("斯洛伐克語", "Slovak"), "SLV": ("斯洛維尼亞語", "Slovenian"),
         "MLT": ("馬爾他語", "Maltese")}
LEVEL = "ED2"


def build() -> None:
    by_lang = {code: eurostat.series("educ_uoe_lang01", unit="PC", language=code, isced11=LEVEL) for code in NAMES}
    years = sorted({y for s in by_lang.values() for d in s.values() for y in d})

    # 愛爾蘭的英語是本國語言，Eurostat 記 0，不畫（noValue 寫原因）
    english = {k: [round(d[y], 1) if y in d else None for y in years] for k, d in sorted(by_lang["ENG"].items()) if k != "IRL"}
    write_json(OUT / "school-english.json", indicator_file(
        "school-english", "%", years, english, license="CC BY 4.0",
        noValue={"IRL": "英語是本國語言，不算外語"}, noValueEn={"IRL": "English is a national language, not a foreign one"}))

    countries = sorted({k for s in by_lang.values() for k in s})
    top: dict[str, list[int | None]] = {}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    for c in countries:
        series: list[int | None] = []
        for y in years:
            shares = [(s[c][y], code) for code, s in by_lang.items() if code != "ENG" and c in s and s[c].get(y)]
            if not shares:
                series.append(None)
                continue
            v, code = max(shares)
            series.append(LANGS[code][0] if code in LANGS else OTHER)
        top[c] = series
        latest = max((y for y in years if any(c in s and s[c].get(y) for s in by_lang.values())), default=None)
        if latest:
            ranked = sorted(((s[c][latest], code) for code, s in by_lang.items() if c in s and s[c].get(latest)), reverse=True)[:4]
            hints[c] = f"{latest} 年國中生：" + "、".join(f"{NAMES[code][0]} {v:.1f}%" for v, code in ranked)
            hints_en[c] = f"Lower-secondary pupils, {latest}: " + ", ".join(f"{NAMES[code][1]} {v:.1f}%" for v, code in ranked)
    write_json(OUT / "school-top-language.json", indicator_file("school-top-language", "類別", years, top,
                                                               hints=hints, hintsEn=hints_en, license="CC BY 4.0"))

    per_pupil = eurostat.series("educ_uoe_lang03", unit="NR", isced11="ED3")
    years3 = sorted({y for d in per_pupil.values() for y in d})
    write_json(OUT / "school-languages-per-pupil.json", indicator_file(
        "school-languages-per-pupil", "種", years3,
        {k: [round(d[y], 1) if y in d else None for y in years3] for k, d in sorted(per_pupil.items())}, license="CC BY 4.0"))

    # 學中文、學日語的高中生人數（2026-11-07 補，手冊 422 的比例圓）：比例都不到 2%，畫人數比較看得出差別
    for code, item in (("CHI", "chinese"), ("JPN", "japanese")):
        nr = eurostat.series("educ_uoe_lang01", unit="NR", language=code, isced11="ED3")
        ys = sorted({y for d in nr.values() for y in d})
        pc = eurostat.series("educ_uoe_lang01", unit="PC", language=code, isced11="ED3")
        lh = {k: f"{y} 年高中生 {int(v):,} 人學{NAMES[code][0]}" + (f"（{pc[k][y]:.1f}%）" if pc.get(k, {}).get(y) else "")
                 for k, d in nr.items() if d for y, v in [max(d.items())]}
        lh_en = {k: f"{int(v):,} upper-secondary pupils learning {NAMES[code][1]} in {y}" + (f" ({pc[k][y]:.1f}%)" if pc.get(k, {}).get(y) else "")
                    for k, d in nr.items() if d for y, v in [max(d.items())]}
        write_json(OUT / f"school-learners-{item}.json", indicator_file(
            "school-learners", "人", ys, {k: [int(d[y]) if y in d else None for y in ys] for k, d in sorted(nr.items())},
            hints=lh, hintsEn=lh_en, license="CC BY 4.0"))
        last_nr = {k: max(d.items()) for k, d in nr.items() if d}
        print(f"  學{NAMES[code][0]}的高中生：{sorted(((int(v[1]), k, v[0]) for k, v in last_nr.items()), reverse=True)[:10]}")

    last = years[-1]
    print(f"  學英語（{LEVEL}，{last}）：{sorted(((v[-1], k) for k, v in english.items() if v[-1] is not None), reverse=True)}")
    print(f"  英語以外最多（{last}）：{Counter(v[-1] for v in top.values())}；{ {k: v[-1] for k, v in top.items()} }")
    print(f"  每人幾種（ED3，{years3[-1]}）：{sorted(((d.get(years3[-1]), k) for k, d in per_pupil.items() if d.get(years3[-1])), reverse=True)[:10]}")
    for c in ("FRA", "ITA", "DEU", "IRL", "FIN", "EST", "POL", "ROU", "DNK", "ISL"):
        print(f"    {c}：{hints.get(c)}")
