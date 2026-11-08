"""研究資料放在哪裡：re3data 登錄的研究資料典藏庫（2026-11-08，製作手冊第二十七批 597 的候選 1324；擴充「全世界的研究機構在哪裡」；
步驟 research-repos，輸出 topics/research-orgs/）。

- re3data.org 的索引資料（CC0；https://www.re3data.org/terms 原文「The index information is published by CC-0」）。沒有批次檔，
  OAI-PMH 的網址有問號、robots.txt 不准，所以用 API v1 逐筆抓（`sources/re3data.py`，一次一支、間隔 2 秒，快取在 `.cache/re3data/`）。
- 國家：營運機構的 institutionCountry（ISO 3166-1 alpha-3）。**一個典藏庫可能有好幾個營運機構、好幾國**：每一國各算一次（「這一國
  參與營運的典藏庫」），所以各國加起來比總數多；EEC（歐洲）、AAA（國際）這類不是國家的代碼不算進任何一國，只寫在說明。
- 子項目：DFG 的四個大學科（人文社會、生命科學、自然科學、工程），一個典藏庫可以有好幾個；類型（disciplinary 學科型、
  institutional 機構型、other 其他）寫在清單。
- 成立年（startDate）很多筆是空的，不做時間軸，只寫在清單。
- 手冊的陷阱：re3data 是德國主辦的註冊表，歐洲收錄最完整，量的是「有登錄的」不是全部。
"""
from __future__ import annotations

from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json
from sources import re3data
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "research-orgs"
YEAR = 2026
SUBJECTS = {"1": "humanities", "2": "life", "3": "natural", "4": "engineering"}  # 前端 research-orgs.ts 的 REPO_SUBJECTS
TYPES = ["disciplinary", "institutional", "other", "multidisciplinary", "governmental", "project-related"]  # 前端的 REPO_TYPES（代碼位元：1、2、4、8、16、32）


def build() -> None:
    recs = re3data.records()
    if len(recs) < 3000:
        raise RuntimeError(f"re3data 只有 {len(recs)} 筆在快取，先跑 sources/re3data.py 的 fetch_all()")
    from topics.reads import label_points

    labels = label_points()
    rows, non_country = [], Counter()
    for r in recs:
        isos = sorted({c for c in (to_iso3(x) for x in r["countries"]) if c})
        for x in r["countries"]:
            if not to_iso3(x):
                non_country[x] += 1
        subj = sorted({SUBJECTS[s.split()[0]] for s in r["subjects"] if s.split()[0] in SUBJECTS})
        types = sum(1 << TYPES.index(t) for t in set(r["type"]) if t in TYPES) or None
        first = next((c for c in isos if c in labels), None)
        lon, lat = labels[first] if first else (0.0, 0.0)
        rows.append({"lon": lon, "lat": lat, "id": r["id"], "name": r["name"], "iso3": ",".join(isos) or None,
                     "subj": ",".join(subj) or None, "types": types, "y": r["start"]})
    rows.sort(key=lambda r: (r["iso3"] or "~", r["name"].lower()))
    fields = ["lon", "lat", "id", "name", "iso3", "subj", "types", "y"]
    write_json(OUT / "repos.json", points_file(rows, fields, {"lon": 0.01, "lat": 0.01, "types": 1, "y": 1},
                                               strings=("iso3", "subj")))
    for key in ["all", *SUBJECTS.values()]:
        counts = Counter(c for r in rows if r["iso3"] and (key == "all" or key in (r["subj"] or "").split(","))
                         for c in r["iso3"].split(","))
        write_json(OUT / "repos" / f"{key}.json", indicator_file(
            f"repos-{key}", "個", [YEAR], {c: [n] for c, n in sorted(counts.items())},
            license="re3data.org（索引資料 CC0）"))
    counts = Counter(c for r in rows if r["iso3"] for c in r["iso3"].split(","))
    print(f"  re3data：{len(rows)} 個典藏庫，有國家的 {sum(1 for r in rows if r['iso3'])}；{len(counts)} 國，前十 {counts.most_common(10)}；"
          f"台灣 {counts.get('TWN')}；不是國家的代碼 {dict(non_country)}；有成立年 {sum(1 for r in rows if r['y'])}；"
          f"學科 {Counter(s for r in rows for s in (r['subj'] or '').split(',') if s)}；"
          f"類型 {Counter(t for r in recs for t in r['type'])}")
