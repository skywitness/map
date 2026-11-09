"""中醫的研究：臨床試驗（2026-11-09，製作手冊第二十九批 690、701、709 的試驗部分；候選 1603–1612；步驟 tcm-trials，輸出 topics/tcm-research/）。

- 資料：ClinicalTrials.gov 的搜尋結果匯出（CSV、全部欄位）。clinicaltrials.gov 的 robots.txt 不准程式抓 /api/ 與 /search?，
  所以由使用者用瀏覽器下載（2026-11-09），本機 session 放在 map-plan 的 data/clinicaltrials/；重跑前複製到 .cache/clinicaltrials/。
  - tcm-interventions.csv：「Intervention / treatment」查 acupuncture OR electroacupuncture OR moxibustion OR acupressure OR
    auriculotherapy OR cupping OR tuina OR qigong OR "tai chi" OR "chinese herbal" OR "traditional chinese medicine"，4,531 件。
  - other-systems.csv：ayurveda、homeopathy、naturopathy、unani、siddha、kampo、sowa rigpa、tibetan medicine、korean medicine、jamu，317 件。
  - 分母（每千件）：順序 294 的 ClinicalTrials.gov 各國試驗總數（.cache/clinicaltrials/location-country.json，不重抓）。
- 國家：Locations 欄每個地點的最後一段（「|」分開）；一件多國在每一國各算一次。沒有地點的不算進各國。
- 療法子項目：Interventions 欄與題目的關鍵詞（匯出檔沒有介入措施的說明，所以子項目加起來少於全部：ClinicalTrials.gov 的搜尋
  也比對說明文字，有些試驗只在說明裡提到這些療法）。
- 年份：Start Date（沒有就用 First Posted）；1994–2026，之後的（填成未來的預計日期）不算進逐年。
- 受試者：只算介入型、而且所有地點都在同一國的試驗（多國試驗的人數分不到國家；觀察型研究常是整個世代，會把一國拉高）。
- 授權：ClinicalTrials.gov 的條款要求註明來源是 ClinicalTrials.gov、寫處理日期、說明改動、保持最新；處理日期用下載日期
  （匯出檔沒有 dataTimestamp；檔裡最新的 Last Update Posted 是 2026-11-06）。自由文字欄位（摘要、Other IDs）有登記者的
  email，一律不讀、不輸出。療效一律不談。
"""
from __future__ import annotations

import csv
import json
import re
import shutil
from collections import Counter, defaultdict

from common import CACHE_DIR, OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import countries

OUT = OUT_DIR / "topics" / "tcm-research"
SRC = OUT_DIR.parent.parent.parent / "map-plan" / "data" / "clinicaltrials"
CACHE = CACHE_DIR / "clinicaltrials"
FILES = ("tcm-interventions.csv", "other-systems.csv")
EXPECTED = {"tcm-interventions.csv": 4531, "other-systems.csv": 317}
DOWNLOADED = "2026-11-09"
YEARS = (1994, 2026)
MIN_TRIALS = 200  # 每千件：這一國全部試驗至少 200 件
MIN_SYSTEM = 5  # 以哪一系為主：兩邊合計至少 5 件
NAMES = {"Turkey (Türkiye)": "TUR", "South Korea": "KOR", "Taiwan": "TWN", "Hong Kong": "HKG", "Macau": "MAC", "Russia": "RUS",
         "Iran": "IRN", "Vietnam": "VNM", "Czechia": "CZE", "Korea, Republic of": "KOR"}
# 療法子項目（src/topics/tcm-research.ts 的 THERAPIES 同 id）
THERAPIES = {
    "acupuncture": r"acupunct|auricul|ear (seed|point|acu)",
    "acupressure": r"acupress",
    "taichi-qigong": r"tai[ -]?chi|tai[ -]?ji|qi[ -]?gong|baduanjin|ba duan jin|yijinjing",
    "herbal": r"chinese herb|herbal|decoction|granule|traditional chinese medicine|\btcm\b",
    "cupping": r"cupping",
    "moxibustion": r"moxibust",
}


def _rows(name: str) -> list[dict]:
    target = CACHE / name
    if not target.exists():
        if not (SRC / name).exists():
            raise RuntimeError(f"沒有 {target}：請把 map-plan 的 data/clinicaltrials/{name} 複製到這裡")
        CACHE.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SRC / name, target)
    csv.field_size_limit(10**9)
    with target.open(encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))  # 欄位裡有換行，一定要用 CSV 解析
    if len(rows) != EXPECTED[name]:
        raise RuntimeError(f"{name} 有 {len(rows)} 筆，應該是 {EXPECTED[name]} 筆")
    return rows


def _iso3(name: str) -> str:
    code = NAMES.get(name) or countries.from_name(name)
    if not code:
        raise ValueError(f"ClinicalTrials.gov 的國名對不到代碼：{name!r}")
    return code


def _countries(row: dict) -> list[str]:
    locs = [x.strip() for x in row["Locations"].split("|") if x.strip()]
    return sorted({_iso3(x.rsplit(",", 1)[-1].strip()) for x in locs})


def _year(row: dict) -> int | None:
    d = row["Start Date"] or row["First Posted"]
    return int(d[:4]) if d[:4].isdigit() else None


def _denominator() -> dict[str, int]:
    from topics import clinical_trials as ct
    stats = json.loads((CACHE / "location-country.json").read_text(encoding="utf-8"))
    out: dict[str, int] = {}
    for v in stats[0]["topValues"]:
        name = v["value"].strip()
        if name in ct.SKIP:
            continue
        code = ct.NAMES.get(name) or countries.from_name(name)
        if code:
            out[code] = out.get(code, 0) + v["studiesCount"]
    return out


def _condition(c: str) -> str | None:
    """病名的簡單正規化：小寫、去掉 chronic／acute 等形容詞以外不改；療法名與 healthy 不算"""
    s = re.sub(r"\s+", " ", c.strip().lower())
    if not s or re.search(r"acupunct|acupress|tai ?chi|qigong|moxibust|cupping|herbal|traditional chinese|^healthy", s):
        return None
    return s


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tcm, other = _rows(FILES[0]), _rows(FILES[1])
    years = list(range(YEARS[0], YEARS[1] + 1))
    # 各國逐年新增的試驗（依療法）→ 累計
    new: dict[str, dict[str, Counter]] = {k: defaultdict(Counter) for k in ["all", *THERAPIES]}
    first: dict[str, int] = {}
    total = Counter()
    for r in tcm:
        y = _year(r)
        cs = _countries(r)
        text = r["Interventions"] + " " + r["Study Title"]
        items = ["all"] + [k for k, rx in THERAPIES.items() if re.search(rx, text, re.I)]
        for c in cs:
            total[c] += 1
            if y and YEARS[0] <= y <= YEARS[1]:
                first[c] = min(first.get(c, 9999), y)
                for k in items:
                    new[k][c][y] += 1
    (OUT / "trials").mkdir(exist_ok=True)
    for k, per in new.items():
        vals = {}
        for c, cnt in per.items():
            run, series = 0, []
            for y in years:
                run += cnt.get(y, 0)
                series.append(run)
            vals[c] = series
        write_json(OUT / "trials" / f"{k}.json", indicator_file("trials", "件", years, dict(sorted(vals.items())),
                                                                license="ClinicalTrials.gov 條款（註明來源與處理日期）"), quiet=True)
    # 每千件（分母：294 的各國全部試驗）
    denom = _denominator()
    per_k, hints, hints_en = {}, {}, {}
    for c, n in total.items():
        d = denom.get(c, 0)
        if d >= MIN_TRIALS:
            per_k[c] = [round(n / d * 1000, 1)]
            hints[c] = f"中醫療法 {n} 件／全部試驗 {d:,} 件"
            hints_en[c] = f"{n} Chinese medicine trials of {d:,} in all"
    write_json(OUT / "per-thousand.json", indicator_file("per-thousand", "‰", [YEARS[1]], dict(sorted(per_k.items())), hints=hints,
                                                         hintsEn=hints_en, license="ClinicalTrials.gov 條款（註明來源與處理日期）"))
    # 以哪一系為主：1 中醫系較多、2 其他體系較多、3 一樣多
    other_n = Counter()
    for r in other:
        for c in _countries(r):
            other_n[c] += 1
    main, mh, mhe = {}, {}, {}
    for c in set(total) | set(other_n):
        a, b = total[c], other_n[c]
        if a + b < MIN_SYSTEM:
            continue
        main[c] = [1 if a > b else 2 if b > a else 3]
        mh[c] = f"中醫系療法 {a} 件、其他傳統醫學體系 {b} 件"
        mhe[c] = f"{a} Chinese medicine trials, {b} other traditional systems"
    write_json(OUT / "main-system.json", indicator_file("main-system", "類別", [YEARS[1]], dict(sorted(main.items())), hints=mh,
                                                        hintsEn=mhe, license="ClinicalTrials.gov 條款（註明來源與處理日期）"))
    # 第一件的年份
    write_json(OUT / "first-year.json", indicator_file("first-year", "年", [YEARS[1]], {c: [y] for c, y in sorted(first.items())},
                                                       license="ClinicalTrials.gov 條款（註明來源與處理日期）"))
    # 受試者：介入型、只有一國的試驗
    enrol = Counter()
    enrol_n = Counter()
    for r in tcm:
        cs = _countries(r)
        if r["Study Type"] != "INTERVENTIONAL" or len(cs) != 1 or not r["Enrollment"].isdigit():
            continue
        enrol[cs[0]] += int(r["Enrollment"])
        enrol_n[cs[0]] += 1
    write_json(OUT / "enrollment.json", indicator_file(
        "enrollment", "人", [YEARS[1]], {c: [v] for c, v in sorted(enrol.items())},
        hints={c: f"{enrol_n[c]} 件介入型試驗（只在這一國）" for c in enrol}, hintsEn={c: f"{enrol_n[c]} single-country interventional trials" for c in enrol},
        license="ClinicalTrials.gov 條款（註明來源與處理日期）"))
    # 左邊的清單：這一國研究最多的病（前 10 名）
    cond: dict[str, Counter] = defaultdict(Counter)
    for r in tcm:
        conds = {x for x in (_condition(c) for c in r["Conditions"].split("|")) if x}
        for c in _countries(r):
            for x in conds:
                cond[c][x] += 1
    from topics.tcm_herbs import _country_points
    pts = _country_points()
    rows = []
    for c, cnt in cond.items():
        if c not in pts:
            continue
        for rank, (name, n) in enumerate(cnt.most_common(10), 1):
            rows.append({"lon": pts[c][0], "lat": pts[c][1], "iso3": c, "rank": rank, "n": n, "cond": name})
    rows.sort(key=lambda r: (r["iso3"], r["rank"]))
    write_points(OUT / "conditions.json", points_file(rows, ["lon", "lat", "iso3", "rank", "n", "cond"], {"lon": 0.001, "lat": 0.001,
                                                                                                         "rank": 1, "n": 1}, strings=("iso3",)), ("cond",))
    # 印出來給說明用
    print(f"  中醫療法的試驗 {len(tcm)} 件、{len(total)} 國；沒有地點 {sum(1 for r in tcm if not _countries(r))}；"
          + "、".join(f"{c} {n}" for c, n in total.most_common(15)))
    for k in THERAPIES:
        tot = Counter({c: sum(v.values()) for c, v in new[k].items()})
        n_all = sum(1 for r in tcm if re.search(THERAPIES[k], r["Interventions"] + " " + r["Study Title"], re.I))
        print(f"    {k}：{n_all} 件、{len(tot)} 國；" + "、".join(f"{c} {n}" for c, n in tot.most_common(8)) + f"；TWN {tot.get('TWN', 0)}")
    top = sorted(per_k.items(), key=lambda kv: -kv[1][0])
    print(f"  每千件：{len(per_k)} 國；" + "、".join(f"{c} {v[0]}" for c, v in top[:14]) + "；…" + "、".join(f"{c} {v[0]}" for c, v in top[-6:]))
    mc = Counter(v[0] for v in main.values())
    print(f"  以哪一系為主：中醫系 {mc[1]}、其他 {mc[2]}、一樣多 {mc[3]}；其他：" + "、".join(c for c, v in main.items() if v[0] == 2)
          + "；一樣多：" + "、".join(c for c, v in main.items() if v[0] == 3) + f"；其他體系 {len(other)} 件、{len(other_n)} 國：" +
          "、".join(f"{c} {n}" for c, n in other_n.most_common(8)))
    print("  第一件的年份：" + "、".join(f"{c} {y}" for c, y in sorted(first.items(), key=lambda kv: kv[1])[:20]))
    glob = Counter(_year(r) for r in tcm)
    print("  逐年（全部）：" + "、".join(f"{y} {glob[y]}" for y in (1997, 1999, 2000, 2005, 2010, 2015, 2020, 2024, 2025, 2026)))
    print("  受試者（介入型、單一國）：" + "、".join(f"{c} {v:,}" for c, v in enrol.most_common(10)) + f"；合計 {sum(enrol.values()):,}")
    print("  期別：" + str(Counter(r["Phases"] or "（空白）" for r in tcm).most_common(8)))
    print("  主辦類別：" + str(Counter(r["Funder Type"] for r in tcm).most_common(7)))
    print("  狀態：" + str(Counter(r["Study Status"] for r in tcm).most_common(7)))
    for c in ("CHN", "USA", "TWN", "KOR", "TUR"):
        print(f"    病 {c}：" + "、".join(f"{k} {v}" for k, v in cond[c].most_common(6)))
    allc = Counter()
    for r in tcm:
        for x in {x for x in (_condition(c) for c in r["Conditions"].split("|")) if x}:
            allc[x] += 1
    print("  全球的病：" + "、".join(f"{k} {v}" for k, v in allc.most_common(15)))
