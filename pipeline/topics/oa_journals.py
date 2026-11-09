"""開放取用期刊是誰出版的、作者要不要付錢（新主題，2026-11-07，製作手冊第二十七批 599，候選 1323；步驟 oa-journals，
輸出 topics/oa-journals/）。

- DOAJ（Directory of Open Access Journals）的期刊 CSV（https://doaj.org/csv，robots.txt 允許），23,578 本。
  授權：DOAJ 條款頁寫「The journal-level metadata is available with a CC0 waiver」（https://doaj.org/terms/），但網站頁尾寫
  「Content on this site is licensed under ... CC BY-SA 4.0 ... article metadata waived via CC0」；使用者 2026-11-09 決定
  DOAJ 一律照 CC BY-SA 4.0 處理（比較嚴的那一個，衍生資料檔也標 CC BY-SA 4.0）。
- 傳統醫學的期刊（2026-11-09，製作手冊第二十九批 709 候選 1619）：期刊名稱、另一個名稱或關鍵詞含 TM_TERMS 任一個的期刊，
  依出版者所在國；一般的藥用植物、民族藥理期刊不算。
- 國家是「Country of publisher」（出版者的登記地；台灣寫成「Taiwan, Province of China」，這裡改成台灣）。
- 指標：期刊數（比例圓；時間軸是「全部內容改用開放授權的年份」累計，只算現在還在 DOAJ 的期刊）、
  收作者處理費（APC）的比例（至少 10 本期刊的國家才算）。
- 側欄：這一國收不收 APC、最多的學科（LCC 大類）與投稿語言（換成 ISO 639 代碼）。
- 手冊的陷阱：DOAJ 只收通過審查的開放取用期刊，印尼第一是大學辦了很多小型期刊；瑞士多半是登記在瑞士的 MDPI；說明寫明。
"""
from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict

from common import OUT_DIR, download, indicator_file, points_file, write_json, write_points
import pycountry

from sources.countries import from_name

OUT = OUT_DIR / "topics" / "oa-journals"
FIRST, LAST = 1990, 2026
MIN_JOURNALS = 10
NAMES = {"Taiwan, Province of China": "TWN", "Türkiye": "TUR", "Kosovo": "XKX"}
LICENSE = "CC BY-SA 4.0（DOAJ）"
# 傳統醫學的期刊：比對期刊名稱、另一個名稱與關鍵詞（src/topics/oa-journals.ts 的說明列同樣的詞）
TM_TERMS = {
    "traditional": r"traditional medicine",
    "chinese": r"chinese medicine|chinese materia|\btcm\b",
    "cam": r"complementary (and alternative )?medicine|alternative medicine|integrative medicine",
    "ayurveda": r"ayurved",
    "acupuncture": r"acupunct|moxibust",
    "homeopathy": r"hom(o)?eopath",
    "herbal": r"herbal medicine|phytotherap",
    "unani-siddha": r"\bunani\b|\bsiddha\b",
    "east-asian": r"kampo|korean medicine|oriental medicine",
}


def _lang(name: str) -> str:
    """英文語言名稱 → ISO 639 代碼（前端用 Intl.DisplayNames 顯示成中文或英文）；查不到的留原文"""
    try:
        lang = pycountry.languages.lookup(name.strip())
        return getattr(lang, "alpha_2", None) or lang.alpha_3
    except LookupError:
        return name.strip()


def build() -> None:
    path = download("https://doaj.org/csv", "doaj", "journals.csv")
    rows = list(csv.DictReader(open(path, encoding="utf-8-sig", newline="")))
    by_country: dict[str, list[dict]] = defaultdict(list)
    unknown = Counter()
    for r in rows:
        name = r["Country of publisher"].strip()
        iso3 = NAMES.get(name) or from_name(name)
        if not iso3:
            unknown[name] += 1
            continue
        by_country[iso3].append(r)
    if unknown:
        print(f"    對不到國家：{unknown.most_common()}")
    years = list(range(FIRST, LAST + 1))
    counts = {}
    for c, js in by_country.items():
        start = Counter()
        for j in js:
            y = j["When did the journal start to publish all content using an open license?"].strip()
            start[max(FIRST, int(y)) if y.isdigit() and int(y) <= LAST else FIRST] += 1
        run, row = 0, []
        for y in years:
            run += start.get(y, 0)
            row.append(run)
        counts[c] = row
    write_json(OUT / "journals.json", indicator_file("oa-journals", "本", years, dict(sorted(counts.items())), license=LICENSE))
    apc = {c: [round(sum(1 for j in js if j["APC"] == "Yes") / len(js) * 100, 2)] for c, js in sorted(by_country.items()) if len(js) >= MIN_JOURNALS}
    write_json(OUT / "apc-share.json", indicator_file("oa-apc-share", "%", [LAST], apc, license=LICENSE))
    detail = {}
    for c, js in by_country.items():
        subjects = Counter(s.split(":")[0].strip() for j in js for s in j["Subjects"].split("|") if s.strip())
        langs = Counter(_lang(l) for j in js for l in j["Languages in which the journal accepts manuscripts"].split(",") if l.strip())
        detail[c] = {"n": len(js), "apc": sum(1 for j in js if j["APC"] == "Yes"),
                     "subjects": subjects.most_common(6), "languages": langs.most_common(5)}
    write_json(OUT / "detail.json", {"countries": detail, "license": LICENSE})

    # 傳統醫學的期刊（1619）
    tm: dict[str, list[dict]] = defaultdict(list)
    for c, js in by_country.items():
        for j in js:
            text = " ".join([j["Journal title"], j["Alternative title"], j["Keywords"]])
            if any(re.search(rx, text, re.I) for rx in TM_TERMS.values()):
                tm[c].append(j)
    write_json(OUT / "tm-journals.json", indicator_file("tm-journals", "本", [LAST], {c: [len(js)] for c, js in sorted(tm.items())},
                                                        license=LICENSE))
    from topics.tcm_herbs import _country_points
    pts = _country_points()
    tm_rows = [{"lon": pts[c][0], "lat": pts[c][1], "iso3": c, "title": j["Journal title"].strip(), "pub": j["Publisher"].strip(),
                "url": j["URL in DOAJ"].strip()} for c, js in tm.items() if c in pts for j in js]
    tm_rows.sort(key=lambda r: (r["iso3"], r["title"]))
    write_points(OUT / "tm-journals-list.json", points_file(tm_rows, ["lon", "lat", "iso3", "title", "pub", "url"], {"lon": 0.001, "lat": 0.001},
                                                            strings=("iso3",)), ("title", "pub", "url"))
    tmc = Counter({c: len(js) for c, js in tm.items()})
    print(f"  傳統醫學的期刊 {sum(tmc.values())} 本、{len(tmc)} 國：" + "、".join(f"{c} {n}" for c, n in tmc.most_common(16))
          + f"；台灣：{[j['Journal title'] for j in tm.get('TWN', [])]}")
    print("    依詞：" + "、".join(f"{k} {sum(1 for js in tm.values() for j in js if re.search(rx, ' '.join([j['Journal title'], j['Alternative title'], j['Keywords']]), re.I))}" for k, rx in TM_TERMS.items()))

    total = {c: len(js) for c, js in by_country.items()}
    print(f"  {sum(total.values()):,} 本、{len(total)} 國：{sorted(((n, c) for c, n in total.items()), reverse=True)[:15]}；台灣 {total.get('TWN')}")
    print(f"  APC：{sorted(((v[0], c) for c, v in apc.items()), reverse=True)[:8]} … {sorted((v[0], c) for c, v in apc.items())[:6]}")
    print(f"  {[(c, apc[c][0]) for c in ('CHE', 'GBR', 'CHN', 'JPN', 'IDN', 'USA', 'TWN', 'BRA') if c in apc]}；全世界 {sum(1 for r in rows if r['APC'] == 'Yes')} 本收費")
    print(f"  1990 年以前或 1990 年 {sum(v[0] for v in counts.values())}、2010 年 {sum(v[2010 - FIRST] for v in counts.values())}；台灣 {detail['TWN']}")
