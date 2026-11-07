"""開放取用期刊是誰出版的、作者要不要付錢（新主題，2026-11-07，製作手冊第二十七批 599，候選 1323；步驟 oa-journals，
輸出 topics/oa-journals/）。

- DOAJ（Directory of Open Access Journals）的期刊 CSV（https://doaj.org/csv，robots.txt 允許；期刊層 metadata 是 CC0：
  「The journal-level metadata is available with a CC0 waiver」，https://doaj.org/terms/），23,578 本。
- 國家是「Country of publisher」（出版者的登記地；台灣寫成「Taiwan, Province of China」，這裡改成台灣）。
- 指標：期刊數（比例圓；時間軸是「全部內容改用開放授權的年份」累計，只算現在還在 DOAJ 的期刊）、
  收作者處理費（APC）的比例（至少 10 本期刊的國家才算）。
- 側欄：這一國收不收 APC、最多的學科（LCC 大類）與投稿語言（換成 ISO 639 代碼）。
- 手冊的陷阱：DOAJ 只收通過審查的開放取用期刊，印尼第一是大學辦了很多小型期刊；瑞士多半是登記在瑞士的 MDPI；說明寫明。
"""
from __future__ import annotations

import csv
from collections import Counter, defaultdict

from common import OUT_DIR, download, indicator_file, write_json
import pycountry

from sources.countries import from_name

OUT = OUT_DIR / "topics" / "oa-journals"
FIRST, LAST = 1990, 2026
MIN_JOURNALS = 10
NAMES = {"Taiwan, Province of China": "TWN", "Türkiye": "TUR", "Kosovo": "XKX"}


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
    write_json(OUT / "journals.json", indicator_file("oa-journals", "本", years, dict(sorted(counts.items())), license="CC0"))
    apc = {c: [round(sum(1 for j in js if j["APC"] == "Yes") / len(js) * 100, 2)] for c, js in sorted(by_country.items()) if len(js) >= MIN_JOURNALS}
    write_json(OUT / "apc-share.json", indicator_file("oa-apc-share", "%", [LAST], apc, license="CC0"))
    detail = {}
    for c, js in by_country.items():
        subjects = Counter(s.split(":")[0].strip() for j in js for s in j["Subjects"].split("|") if s.strip())
        langs = Counter(_lang(l) for j in js for l in j["Languages in which the journal accepts manuscripts"].split(",") if l.strip())
        detail[c] = {"n": len(js), "apc": sum(1 for j in js if j["APC"] == "Yes"),
                     "subjects": subjects.most_common(6), "languages": langs.most_common(5)}
    write_json(OUT / "detail.json", {"countries": detail, "license": "CC0"})

    total = {c: len(js) for c, js in by_country.items()}
    print(f"  {sum(total.values()):,} 本、{len(total)} 國：{sorted(((n, c) for c, n in total.items()), reverse=True)[:15]}；台灣 {total.get('TWN')}")
    print(f"  APC：{sorted(((v[0], c) for c, v in apc.items()), reverse=True)[:8]} … {sorted((v[0], c) for c, v in apc.items())[:6]}")
    print(f"  {[(c, apc[c][0]) for c in ('CHE', 'GBR', 'CHN', 'JPN', 'IDN', 'USA', 'TWN', 'BRA') if c in apc]}；全世界 {sum(1 for r in rows if r['APC'] == 'Yes')} 本收費")
    print(f"  1990 年以前或 1990 年 {sum(v[0] for v in counts.values())}、2010 年 {sum(v[2010 - FIRST] for v in counts.values())}；台灣 {detail['TWN']}")
