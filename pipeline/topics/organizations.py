"""國際組織：16 個組織（歐盟、北約、東協、OECD、G7、G20、金磚國家、CPTPP、RCEP、非洲聯盟、OPEC、大英國協、
阿拉伯國家聯盟、上海合作組織、WTO、APEC）裡每個國家的身分，與參加了幾個組織。

- membership/<組織>.json：類別圖，每年 12 月 31 日的狀態（今年是資料產生當天的狀態），
  代碼 1 成員、2 申請或加入中、3 夥伴或觀察員、4 暫停參與、0 非成員（跟 src/topics/organizations.ts 的 STATUS 一致）。
  年份從組織成立（或前身）的那一年到今年；附註（notes／notesEn）寫參加時用的名稱（中華台北、中國香港…）。
- count.json：16 個組織裡是成員（含暫停參與）的有幾個，1945 年到今年。
- details.json：側欄用，每個國家在每個組織的每一段（狀態、開始、結束、種類）、參加時用的名稱、附註與各組織的資料來源。

資料是 sources/igo_members.py 手工整理的表；CHECK_COUNTS（地圖上的成員數）對不上會報錯。
"""
from __future__ import annotations

import json
import re
from datetime import date

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import igo_members as igo

OUT = OUT_DIR / "topics" / "organizations"

CODES = {igo.MEMBER: 1, igo.CANDIDATE: 2, igo.PARTNER: 3, igo.SUSPENDED: 4}
NON_MEMBER = 0
# 同時有好幾段時取哪一個：暫停參與（一定在成員期間內）> 成員 > 申請或加入中 > 夥伴或觀察員
PRECEDENCE = (igo.SUSPENDED, igo.MEMBER, igo.CANDIDATE, igo.PARTNER)
COUNT_FIRST_YEAR = 1945
DATE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")


def _full(d: str) -> str:
    """只有年或年月的日期補成那一年（月）的第一天：'1989' → '1989-01-01'、'1989-11' → '1989-11-01'"""
    return d + "-01-01" if len(d) == 4 else d + "-01" if len(d) == 7 else d


def status(periods: list[igo.Period], at: str) -> str | None:
    """那一天的狀態；結束日不含（那天起就不是了）"""
    active = {p[0] for p in periods if _full(p[1]) <= at and (p[2] is None or _full(p[2]) > at)}
    return next((s for s in PRECEDENCE if s in active), None)


def _validate(ids: set[str]) -> None:
    for org, table in igo.TABLES.items():
        for iso3, periods in table.items():
            if iso3 not in ids:
                raise RuntimeError(f"{org}：{iso3} 不在 countries.json 裡")
            members = [p for p in periods if p[0] == igo.MEMBER]
            for st, start, end, _kind in periods:
                if not DATE.match(start) or (end is not None and not DATE.match(end)):
                    raise RuntimeError(f"{org} {iso3}：日期格式不對 {start}–{end}")
                if end is not None and _full(end) <= _full(start):
                    raise RuntimeError(f"{org} {iso3}：結束 {end} 早於開始 {start}")
                # 暫停參與要在成員期間內（大英國協的辛巴威 2002 年暫停、2003 年退出：結束日相同也算）
                if st == igo.SUSPENDED and not any(
                    _full(m[1]) <= _full(start) and (m[2] is None or (end is not None and _full(m[2]) >= _full(end)))
                    for m in members
                ):
                    raise RuntimeError(f"{org} {iso3}：暫停參與 {start}–{end} 不在成員期間內")
            ordered = sorted(members, key=lambda p: _full(p[1]))
            for a, b in zip(ordered, ordered[1:]):
                if a[2] is None or _full(a[2]) > _full(b[1]):
                    raise RuntimeError(f"{org} {iso3}：成員期間重疊 {a} {b}")
    for org in igo.TABLES:
        if org not in igo.ORDER or org not in igo.FIRST_YEAR or org not in igo.SOURCES:
            raise RuntimeError(f"{org}：ORDER、FIRST_YEAR、SOURCES 要一起改")


def periods_for(org: str, iso3: str) -> list[igo.Period]:
    """這個地方在這個組織的每一段"""
    return igo.TABLES[org].get(iso3, [])


def build() -> None:
    today = date.today()
    this_year = today.year

    def at(year: int) -> str:
        return f"{year}-12-31" if year < this_year else today.isoformat()

    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        ids = set(json.load(f))
    _validate(ids)
    states = ids - igo.DEPENDENCIES
    # 檢查與「參加幾個組織」用：主權國家，加上自己是成員的香港、澳門、撒拉威
    counted = states | igo.COUNT_OWN

    # ── 檢查 ──
    errors = []
    for org, checks in igo.CHECK_COUNTS.items():
        for year, expected in checks.items():
            if year > this_year:
                continue
            n = sum(status(periods_for(org, iso3), at(year)) in (igo.MEMBER, igo.SUSPENDED) for iso3 in counted)
            if n != expected:
                errors.append(f"{org} {year} 年：算出 {n}，應該是 {expected}")
    for org, checks in igo.CHECK_SUSPENDED.items():
        for year, expected in checks.items():
            n = sum(status(periods_for(org, iso3), at(year)) == igo.SUSPENDED for iso3 in counted)
            if n != expected:
                errors.append(f"{org} {year} 年：暫停參與 {n}，應該是 {expected}")
    if errors:
        raise RuntimeError("成員數對不上，請檢查 sources/igo_members.py：\n  " + "\n  ".join(errors))

    # ── 各組織的類別圖 ──
    summary = {}
    for org in igo.ORDER:
        table = igo.TABLES[org]
        # 主權國家都畫（不在表裡的是非成員）；其他地方只在表裡有它的組織畫（例如歐盟的格陵蘭、WTO 的香港）
        entities = states | (set(table) & igo.DEPENDENCIES)
        years = list(range(igo.FIRST_YEAR[org], this_year + 1))
        values = {}
        for iso3 in sorted(entities):
            periods = periods_for(org, iso3)
            values[iso3] = [CODES.get(status(periods, at(y)), NON_MEMBER) for y in years]
        notes = {iso3: f"以「{zh}」名義參加。" for (o, iso3), (zh, _en) in igo.NAMES.items() if o == org}
        notes_en = {iso3: f"Takes part as “{en}”." for (o, iso3), (_zh, en) in igo.NAMES.items() if o == org}
        extra = {"notes": notes, "notesEn": notes_en} if notes else {}
        write_json(OUT / "membership" / f"{org}.json", indicator_file("membership", "類別", years, values, **extra), quiet=True)
        last = {code: sum(v[-1] == code for iso3, v in values.items() if iso3 in counted) for code in (1, 2, 3, 4)}
        summary[org] = {"members": last[1] + last[4], "suspended": last[4], "candidates": last[2], "partners": last[3]}
        print(
            f"  {org}：{years[0]}–{years[-1]}，今年成員 {last[1] + last[4]}（暫停 {last[4]}）、"
            f"申請或加入中 {last[2]}、夥伴或觀察員 {last[3]}"
        )

    # ── 參加幾個組織 ──
    years = list(range(COUNT_FIRST_YEAR, this_year + 1))
    count = {}
    for iso3 in sorted(counted):
        count[iso3] = [
            sum(
                y >= igo.FIRST_YEAR[org] and status(periods_for(org, iso3), at(y)) in (igo.MEMBER, igo.SUSPENDED)
                for org in igo.ORDER
            )
            for y in years
        ]
    write_json(OUT / "count.json", indicator_file("count", "個", years, count))
    top = sorted(((v[-1], iso3) for iso3, v in count.items() if iso3 in counted), reverse=True)[:5]
    print("  參加最多的：" + "、".join(f"{iso3} {n}" for n, iso3 in top) + f"；台灣 {count['TWN'][-1]}")

    # ── 側欄 ──
    countries: dict[str, dict[str, list]] = {}
    for org in igo.ORDER:
        for iso3 in sorted(ids):
            periods = periods_for(org, iso3)
            if periods:
                countries.setdefault(iso3, {})[org] = [list(p) for p in sorted(periods, key=lambda p: _full(p[1]))]
    names: dict[str, dict[str, list[str]]] = {}
    for (org, iso3), pair in igo.NAMES.items():
        names.setdefault(iso3, {})[org] = list(pair)
    notes_all: dict[str, dict[str, list[str]]] = {}
    for (org, iso3), pair in igo.NOTES.items():
        notes_all.setdefault(iso3, {})[org] = list(pair)
    write_json(OUT / "details.json", {
        "asOf": today.isoformat(),
        "orgs": {org: {"first": igo.FIRST_YEAR[org], "sources": igo.SOURCES[org]} for org in igo.ORDER},
        "accessed": igo.ACCESSED,
        "partOf": igo.PART_OF,
        "countries": countries,
        "names": names,
        "notes": notes_all,
    })

    write_json(OUT / "manifest.json", {
        "topic": "organizations",
        "generatedAt": now_iso(),
        "source": "Member lists on each organisation's website, compiled by hand (pipeline/sources/igo_members.py)",
        "accessed": igo.ACCESSED,
        "years": [COUNT_FIRST_YEAR, this_year],
        "organizations": summary,
    })
