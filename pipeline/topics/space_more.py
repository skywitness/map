"""太空：入軌發射的失敗率與民間業者的比例（第二十五批 517，候選 1188）、衛星的用途與向聯合國登記（518，候選 1189、1190）。

2026-11-07。資料都是 Jonathan McDowell 的 GCAT（CC BY 4.0，sources/gcat.py；跟太空主題既有的指標同一個來源）：
- 517：`launch/launch.tsv` 的入軌發射（LaunchCode 第一個字 O；第二個字 S 成功、F 失敗，帶數字的部分成功照第二個字算），
  發射業者（Agency 的第一個）所屬國（orgs.tsv 的 StateCode；蘇聯算俄羅斯，跟既有指標一樣；「發射業者所屬國」不等於
  發射場所在國，Rocket Lab 在紐西蘭發射記成紐西蘭）。業者類別是 orgs.tsv 的 Class（A 學術、B 民間企業、C 政府非軍事、D 國防）。
  失敗率：到那一年為止全部的、近 5 年的兩種（次數太少會亂跳：全部與近 5 年都至少 5 次才畫）。民間企業占比：近 5 年。
- 518：`cat/psatcat.tsv`（酬載）的 Category（用斜線串的取第一個；結尾的 ? 與 * 去掉）、UNState（聯合國登記國；方括號是
  「應該登記但沒有」，空白是 GCAT 判斷不需要登記，不算進分母）。擁有國用 satcat.tsv 的 State（同 JCAT 對）。
  UNOOSA 自己的登記簿條款禁止轉載，不用。台灣的酬載都沒有登記（台灣不是聯合國會員，沒有管道）。
輸出 public/data/topics/space/{launch-fail/{all,recent},private-share,payload-use/{類別},un-registered}.json。
"""

from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import gcat

OUT = OUT_DIR / "topics" / "space"
FIRST, LAST = 1957, 2026
WINDOW = 5
# 用途的分組（Category 的第一個值）→ 子項目
USE = {
    "COM": "communications", "IMG": "imaging", "IMG-R": "imaging", "NAV": "navigation", "MET": "weather",
    "SCI": "science", "AST": "science", "PLAN": "science", "EOSCI": "science", "GEOD": "science",
    "SIG": "military", "EW": "military", "WEAPON": "military", "TECH": "technology", "SS": "crewed",
}


def _launches(orgs, mapper):
    out = []
    for r in gcat.launches():
        code = r["LaunchCode"]
        if not code.startswith("O") or len(code) < 2 or code[1] not in "SF":
            continue
        y = gcat.year(r["Launch_Date"])
        agency = r["Agency"].split("/")[0].strip()
        state = mapper.org_state(agency)
        iso3 = mapper.iso3(state) if state else None
        if not (y and iso3):
            continue
        out.append({"y": y, "iso3": iso3, "ok": code[1] == "S", "cls": orgs.get(agency, {}).get("Class", "")[:1]})
    return out


def _launch_files(rows) -> None:
    years = list(range(FIRST, LAST + 1))
    by = defaultdict(lambda: defaultdict(lambda: [0, 0, 0]))  # iso3 → 年 → [次數, 失敗, 民間]
    for r in rows:
        c = by[r["iso3"]][r["y"]]
        c[0] += 1
        c[1] += 0 if r["ok"] else 1
        c[2] += 1 if r["cls"] == "B" else 0
    allr, recent, private = {}, {}, {}
    for iso3, ys in by.items():
        a, rc, pv = [], [], []
        for y in years:
            tot = sum(ys[x][0] for x in ys if x <= y)
            fail = sum(ys[x][1] for x in ys if x <= y)
            a.append(round(fail / tot * 100, 1) if tot >= 5 else None)
            wt = sum(ys[x][0] for x in ys if y - WINDOW < x <= y)
            wf = sum(ys[x][1] for x in ys if y - WINDOW < x <= y)
            wp = sum(ys[x][2] for x in ys if y - WINDOW < x <= y)
            rc.append(round(wf / wt * 100, 1) if wt >= 5 else None)
            pv.append(round(wp / wt * 100, 1) if wt >= 5 else None)
        if any(v is not None for v in a):
            allr[iso3] = a
        if any(v is not None for v in rc):
            recent[iso3] = rc
            private[iso3] = pv
    lic = {"license": "CC BY 4.0", "attribution": f"McDowell, Jonathan C., General Catalog of Artificial Space Objects, Release {gcat.RELEASE}"}
    write_json(OUT / "launch-fail" / "all.json", indicator_file("launch-fail/all", "%", years, allr, **lic))
    write_json(OUT / "launch-fail" / "recent.json", indicator_file("launch-fail/recent", "%", years, recent, **lic))
    write_json(OUT / "private-share.json", indicator_file("private-share", "%", years, private, **lic))
    last = years.index(LAST)
    tot = {k: sum(v[0] for v in ys.values()) for k, ys in by.items()}
    print(f"  入軌發射 {len(rows)} 次；失敗率（全部）{sorted(((v[last], k, tot[k]) for k, v in allr.items() if v[last] is not None), reverse=True)[:8]}")
    print(f"  近 5 年：{[(k, v[last], private[k][last]) for k, v in recent.items() if v[last] is not None]}")
    w = [r for r in rows if r["y"] > LAST - WINDOW]
    print(f"  {LAST - WINDOW + 1}–{LAST} 全世界 {len(w)} 次，民間 {sum(r['cls'] == 'B' for r in w)}，失敗 {sum(not r['ok'] for r in w)}")


def _payload_files(mapper) -> None:
    owner = {r["JCAT"]: r for r in gcat.satcat()}
    pay = gcat.read("cat/psatcat.tsv", "psatcat.tsv")
    years = list(range(FIRST, LAST + 1))
    use = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))  # iso3 → 年 → 類 → 個
    reg = defaultdict(lambda: defaultdict(lambda: [0, 0]))  # iso3 → 年 → [應登記, 已登記]
    for p in pay:
        s = owner.get(p["JCAT"])
        if not s:
            continue
        y = gcat.year(s["LDate"])
        iso3 = mapper.iso3(s["State"].strip("[]*?")) if s["State"] else None
        if not (y and iso3):
            continue
        cat = p["Category"].split("/")[0].rstrip("?*")
        use[iso3][y][USE.get(cat, "other")] += 1
        un = p.get("UNState", "")
        if un and un != "-":
            reg[iso3][y][0] += 1
            reg[iso3][y][1] += 0 if un.startswith("[") else 1
    lic = {"license": "CC BY 4.0", "attribution": f"McDowell, Jonathan C., General Catalog of Artificial Space Objects, Release {gcat.RELEASE}"}
    items = sorted(set(USE.values()) | {"other"})
    for item in items:
        data = {}
        for iso3, ys in use.items():
            vals = []
            for y in years:
                tot = sum(sum(c.values()) for x, c in ys.items() if x <= y)
                n = sum(c.get(item, 0) for x, c in ys.items() if x <= y)
                vals.append(round(n / tot * 100, 1) if tot >= 5 else None)
            if any(v is not None for v in vals):
                data[iso3] = vals
        write_json(OUT / "payload-use" / f"{item}.json", indicator_file(f"payload-use/{item}", "%", years, data, **lic))
    rate = {}
    for iso3, ys in reg.items():
        vals = []
        for y in years:
            need = sum(v[0] for x, v in ys.items() if x <= y)
            done = sum(v[1] for x, v in ys.items() if x <= y)
            vals.append(round(done / need * 100, 1) if need >= 3 else None)
        if any(v is not None for v in vals):
            rate[iso3] = vals
    write_json(OUT / "un-registered.json", indicator_file("un-registered", "%", years, rate, **lic))
    last = years.index(LAST)
    need = {k: sum(v[0] for v in ys.values()) for k, ys in reg.items()}
    print(f"  酬載 {len(pay)}；登記率 {sorted(((v[last], k, need[k]) for k, v in rate.items() if v[last] is not None), key=lambda t: -t[2])[:14]}")
    print(f"  台灣：用途 {dict(sum((list(c.items()) for c in use['TWN'].values()), []) and {k: sum(c.get(k, 0) for c in use['TWN'].values()) for k in items})}，登記 {rate.get('TWN', [None])[last]}（應登記 {need.get('TWN')}）")


def build() -> None:
    orgs = gcat.orgs()
    mapper = gcat.StateMapper(orgs)
    _launch_files(_launches(orgs, mapper))
    _payload_files(mapper)
