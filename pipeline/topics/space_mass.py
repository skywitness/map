"""太空的擴充：送上太空的不是顆數而是公斤、太空垃圾每年再入幾個（2026-11-07，製作手冊第二十七批 604，候選 1330、1331；
步驟 space-mass，輸出 topics/space/）。資料是太空主題既有的 GCAT `satcat.tsv`（CC BY 4.0，sources/gcat.py），只是多兩種彙總。

- **在軌酬載的質量**：每年年底仍在軌道上的酬載（跟 space.py 的在軌酬載同一個判斷：`LDate` 在那年以前、`DDate` 空白
  或在那年以後），`Mass`（發射時的質量，含推進劑，公斤）加總，依擁有國（`State`，蘇聯算俄羅斯，國際組織只算世界）。
  手冊的陷阱：`MassFlag` 是「?」的是估計值，一部分酬載沒有質量；兩個比例寫在說明。
- **每年再入大氣的物體**：所有編目物體（酬載、火箭殘骸、碎片）裡狀態是再入（R、R?）、受控離軌（D）、降落（L、L?）的，
  依 `DDate` 的年份，依擁有國。手冊的數字（2019 年 339、2022 年 2,510）是 `DDate` 有值的全部物體，含對接（DK）、
  進入深空（DSO）等不是再入的狀態，這裡不算，所以略少。今年是到資料更新日為止。
- 側欄：這一國現在在軌最重的 10 顆酬載（名稱、質量、是不是估計）、最近再入的 10 個物體。
"""
from __future__ import annotations

from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import gcat

OUT = OUT_DIR / "topics" / "space"
FIRST_YEAR = 1957
REENTRY = {"R", "R?", "D", "L", "L?"}
TOP = 10


def _mass(v: str) -> float | None:
    try:
        m = float(v)
    except ValueError:
        return None
    return m if m > 0 else None


MONTHS = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def _date_key(d: str) -> tuple[int, int, int]:
    """GCAT 的日期「2024 Mar 28」（只有年或年月的也可以）→ 排序用的 (年, 月, 日)"""
    parts = d.replace("?", "").split()
    y = int(parts[0]) if parts and parts[0].isdigit() else 0
    m = MONTHS.get(parts[1], 0) if len(parts) > 1 else 0
    day = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0
    return (y, m, day)


def build() -> None:
    mapper = gcat.StateMapper(gcat.orgs())
    sat = gcat.satcat()
    lic = {"license": "CC BY 4.0", "attribution": f"McDowell, Jonathan C., General Catalog of Artificial Space Objects, Release {gcat.RELEASE}"}
    pay = []
    for r in sat:
        launched = gcat.year(r["LDate"])
        if not r["Type"].startswith("P") or launched is None:
            continue
        pay.append({"iso3": mapper.iso3(r["State"]), "launched": launched, "gone": gcat.year(r["DDate"]), "mass": _mass(r["Mass"]),
                    "est": r["MassFlag"] == "?", "name": r["Name"], "orbit": r["OpOrbit"], "ldate": r["LDate"][:11]})
    last = max(p["launched"] for p in pay)
    years = list(range(FIRST_YEAR, last + 1))

    def alive(p: dict, y: int) -> bool:
        return p["launched"] <= y and (p["gone"] is None or p["gone"] > y)

    mass: dict[str, list[float]] = defaultdict(lambda: [0.0] * len(years))
    world = [0.0] * len(years)
    for p in pay:
        if not p["mass"]:
            continue
        for i, y in enumerate(years):
            if alive(p, y):
                world[i] += p["mass"]
                if p["iso3"]:
                    mass[p["iso3"]][i] += p["mass"]
    values = {c: [round(v, 1) if v else None for v in s] for c, s in sorted(mass.items())}
    write_json(OUT / "in-orbit-mass.json", indicator_file("in-orbit-mass", "公斤", years, values, world=[round(v, 1) for v in world], **lic))
    now = [p for p in pay if alive(p, last)]
    with_mass = sum(1 for p in now if p["mass"])
    est = sum(1 for p in now if p["mass"] and p["est"])
    print(f"  {last} 年在軌酬載 {len(now):,} 顆，有質量 {with_mass:,}（{with_mass / len(now):.1%}），其中估計值 {est:,}（{est / with_mass:.1%}）；"
          f"總質量 {world[-1]:,.0f} 公斤")
    rank = sorted(((c, s[-1], sum(1 for p in now if p['iso3'] == c)) for c, s in mass.items()), key=lambda x: -x[1])
    print("  在軌質量：" + "、".join(f"{c} {v:,.0f} 公斤（{n:,} 顆）" for c, v, n in rank[:12]))
    tw = next((x for x in rank if x[0] == "TWN"), None)
    print(f"  台灣：{tw}；名次 {[c for c, _, _ in rank].index('TWN') + 1 if tw else None}")

    re_by: dict[str, Counter] = defaultdict(Counter)
    re_world: Counter = Counter()
    recent: dict[str, list] = defaultdict(list)
    for r in sat:
        y = gcat.year(r["DDate"])
        if r["Status"] not in REENTRY or y is None or y < FIRST_YEAR:
            continue
        re_world[y] += 1
        c = mapper.iso3(r["State"])
        if c:
            re_by[c][y] += 1
            recent[c].append((r["DDate"][:11].strip(), r["Name"], r["Type"][:1]))
    ry = list(range(FIRST_YEAR, last + 1))
    write_json(OUT / "reentries.json", indicator_file(
        "reentries", "個", ry, {c: [cnt.get(y) or None for y in ry] for c, cnt in sorted(re_by.items())},
        world=[re_world.get(y, 0) for y in ry], **lic))
    print("  每年再入：" + "、".join(f"{y} {re_world[y]:,}" for y in range(2018, last + 1)))
    print(f"  {last - 1} 年依國家：" + "、".join(f"{c} {n:,}" for c, n in sorted(((c, cnt[last - 1]) for c, cnt in re_by.items()), key=lambda x: -x[1])[:6]))

    detail = {}
    for c in sorted({p["iso3"] for p in now if p["iso3"]} | set(recent)):
        heavy = sorted((p for p in now if p["iso3"] == c and p["mass"]), key=lambda p: -p["mass"])[:TOP]
        rec = sorted(recent.get(c, []), key=lambda x: _date_key(x[0]), reverse=True)[:TOP]
        detail[c] = {"heavy": [[p["name"], round(p["mass"], 1), 1 if p["est"] else 0, p["orbit"]] for p in heavy],
                     "recent": [[d, n, t] for d, n, t in rec]}
    write_json(OUT / "space-mass-detail.json", {"countries": detail})
    print(f"  台灣再入 {len(recent.get('TWN', []))} 個：{detail.get('TWN', {}).get('recent')}")
