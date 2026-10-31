"""太空的擴充（2026-10-31，製作手冊第十批 171）：政府的太空研發預算、各國月球以外的探測任務。輸出到太空主題的資料夾。

- 太空研發預算：OECD「Government budget allocations for R&D」（DSD_RDS_GOV@DF_GBARD_NABS07）的 SEO = NABS03
  「Exploration and exploitation of space」，百萬美元購買力平價（當期），1981–2026，43 個經濟體（含台灣，沒有中國、
  印度）。OECD 資料條款（DESIGN.md 第 8 節第 12 點）。使用者決定只畫 OECD 的國家，中國、印度的機構預算（英文維基
  「List of government space agencies」的 Budgets 表，revid 1382533503，CC BY-SA 4.0）寫附註。
- 深空探測：英文維基「List of Solar System probes」（revid 1382377257，CC BY-SA 4.0），依目的地分節的表。
  - 一個任務出現在好幾節（重力助推、順路飛掠）時只算主要目的地（使用者決定）：著陸、撞擊、大氣探測、取樣返回 >
    軌道器 > 飛掠 > 順路飛掠小行星；備註寫重力助推的飛掠不算；同等級的取最早到的那一個（航海家 2 號算木星、新視野號算
    冥王星）。
  - 「Probes leaving the Solar System」「Other probes to leave Earth orbit」（拉格朗日點的望遠鏡等）不算目的地；月球的
    任務在別的條目，不收。
  - 結果依列的底色（條目開頭的 Colour key）：#EFE7B8 成功（含部分成功）、#F2F2F2 失敗、#CCFFD9 進行中；成功、失敗
    分開算（使用者決定），進行中的只算進總數。
  - 國家：Organization 欄的國旗；蘇聯算俄羅斯、西德算德國（跟太空主題同規則），合作任務每個國家各算一次，只有機構
    （ESA）的不算進任何國家，數量寫附註。
  - 年份：任務在表裡最早的日期（飛掠、入軌、著陸或發射失敗的日期），還沒到的（途中的任務）算 2026 年。

輸出（public/data/topics/space/）：space-budget.json、probes.json、probes-success.json、probes-failed.json。
"""
from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict

from common import OUT_DIR, download, indicator_file, write_json, write_manifest_part
from sources import wikitable as W

OUT = OUT_DIR / "topics" / "space"
GBARD = "https://sdmx.oecd.org/public/rest/data/OECD.STI.STP,DSD_RDS_GOV@DF_GBARD_NABS07,1.0/all?format=csvfilewithlabels"
PROBES = "https://en.wikipedia.org/w/index.php?title=List_of_Solar_System_probes&action=raw&oldid=1382377257"
REVISION = 1382377257
FIRST_YEAR, LAST_YEAR = 1959, 2026

# 節的標題 → 目的地代碼（前端 src/topics/space.ts 的 DESTINATIONS）；None 是不算目的地的節
SECTIONS = {
    "Solar probes": "sun", "Mercury probes": "mercury", "Venus probes": "venus", "Mars probes": "mars",
    "Phobos probes": "mars", "Ceres probes": "asteroid", "Asteroid probes": "asteroid", "Jupiter probes": "jupiter",
    "Ganymede probes": "jupiter", "Saturn probes": "saturn", "Titan probes": "saturn", "Uranus probes": "uranus",
    "Neptune probes": "neptune", "Pluto probes": "pluto", "Comet probes": "comet", "Kuiper belt probes": "kuiper",
    "Probes leaving the Solar System": None, "Other probes to leave Earth orbit": None,
}
DEST_ORDER = ["sun", "mercury", "venus", "mars", "asteroid", "jupiter", "saturn", "uranus", "neptune", "pluto", "comet", "kuiper"]
FLAGS = {"USA": "USA", "USSR": "RUS", "SOV": "RUS", "Soviet Union": "RUS", "RUS": "RUS", "Russia": "RUS", "JPN": "JPN",
         "Japan": "JPN", "PRC": "CHN", "CHN": "CHN", "China": "CHN", "IND": "IND", "India": "IND", "UAE": "ARE",
         "United Arab Emirates": "ARE", "FRG": "DEU", "GER": "DEU", "Germany": "DEU", "West Germany": "DEU", "ITA": "ITA",
         "Italy": "ITA", "FRA": "FRA", "France": "FRA", "UK": "GBR", "GBR": "GBR", "United Kingdom": "GBR", "KOR": "KOR",
         "South Korea": "KOR", "ISR": "ISR", "CAN": "CAN", "Canada": "CAN", "AUS": "AUS", "Australia": "AUS",
         "NLD": "NLD", "Netherlands": "NLD", "ESP": "ESP", "Spain": "ESP", "SWE": "SWE", "Sweden": "SWE",
         "CHE": "CHE", "SUI": "CHE", "Switzerland": "CHE", "BEL": "BEL", "AUT": "AUT", "MEX": "MEX", "BRA": "BRA"}
AGENCIES = {"EUR", "ESA", "Europe", "EU", "European Union", "European Space Agency"}
SUCCESS, FAILED, ONGOING = 1, 2, 3
OUTCOME_BY_COLOR = {"EFE7B8": SUCCESS, "F2F2F2": FAILED, "CCFFD9": ONGOING}
MONTHS = {m: i for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July", "August", "September",
                                      "October", "November", "December"], 1)}


# ── 太空研發預算 ─────────────────────────────────────────────

def space_budget() -> None:
    path = download(GBARD, "oecd", "gbard-nabs07.csv")
    data: dict[str, dict[int, float]] = defaultdict(dict)
    differs: set[str] = set()
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            if (r["SEO"], r["MEASURE"], r["UNIT_MEASURE"], r["PRICE_BASE"], r["FUNDMODE"]) != ("NABS03", "C", "USD_PPP", "V", "_T"):
                continue
            if not r["OBS_VALUE"]:
                continue
            data[r["REF_AREA"]][int(r["TIME_PERIOD"])] = round(float(r["OBS_VALUE"]), 1)
            if r["OBS_STATUS"] == "D" or r.get("OBS_STATUS_2") == "D":
                differs.add(r["REF_AREA"])
    years = sorted({y for s in data.values() for y in s})
    notes = {
        "CHN": "OECD 沒有中國。英文維基的機構預算表：國家航天局（CNSA）2023 年 181.5 億美元（市場匯率，跟地圖的購買力平價不能直接比）",
        "IND": "OECD 沒有印度。英文維基的機構預算表：印度太空研究組織（ISRO）2022 年 18.31 億美元（市場匯率，跟地圖的購買力平價不能直接比）",
        "JPN": "OECD 標「定義不同」（Definition differs）",
    }
    notes_en = {
        "CHN": "China is not in the OECD data. English Wikipedia's table of agency budgets: CNSA, US$18.15 billion in 2023 (market exchange rates, not comparable with the PPP figures on the map)",
        "IND": "India is not in the OECD data. English Wikipedia's table of agency budgets: ISRO, US$1.831 billion in 2022 (market exchange rates, not comparable with the PPP figures on the map)",
        "JPN": "Flagged by the OECD as “definition differs”",
    }
    write_json(OUT / "space-budget.json", indicator_file(
        "space-budget", "百萬美元（購買力平價）", years,
        {c: [s.get(y) for y in years] for c, s in sorted(data.items())},
        notes=notes, notesEn=notes_en,
        noValue={"CHN": "OECD 沒有中國（見附註）", "IND": "OECD 沒有印度（見附註）"},
        noValueEn={"CHN": "Not in the OECD data (see note)", "IND": "Not in the OECD data (see note)"}))
    top = sorted(((c, s[max(s)], max(s)) for c, s in data.items()), key=lambda x: -x[1])[:6]
    print(f"  太空研發預算：{len(data)} 個經濟體，{years[0]}–{years[-1]}；" + "、".join(f"{c} {v:,.0f}（{y}）" for c, v, y in top)
          + f"；台灣 {sorted(data['TWN'].items())[-1]}；定義不同 {sorted(differs)}")


# ── 深空探測 ─────────────────────────────────────────────────

def _rows_with_color(table: str) -> list[tuple[str | None, list[str]]]:
    """跟 wikitable.rows 一樣展開 rowspan、colspan，另外回傳每一列的底色"""
    body = W.strip_refs(table)
    out: list[tuple[str | None, list[str]]] = []
    pending: dict[int, tuple[str, int]] = {}
    parts = re.split(r"^(\|-.*)$", body, flags=re.M)
    for head, block in zip(parts[1::2], parts[2::2]):
        raw: list[str] = []
        header = True
        for line in block.split("\n"):
            if line.startswith("|}"):
                break
            if line.startswith(("|", "!")):
                is_head = line.startswith("!")
                header = header and is_head
                raw.extend(W._split_top(line[1:], "!!" if is_head else "||"))
            elif raw and line.strip():
                raw[-1] += "\n" + line
        if not raw or header:
            continue
        row: list[str] = []
        col = 0
        cells = [W._cell(c) for c in raw]
        k = 0
        while k < len(cells) or col in pending:
            if col in pending:
                content, left = pending[col]
                row.append(content)
                if left > 1:
                    pending[col] = (content, left - 1)
                else:
                    del pending[col]
                col += 1
                continue
            content, rs, cs = cells[k]
            k += 1
            for _ in range(cs):
                row.append(content)
                if rs > 1:
                    pending[col] = (content, rs - 1)
                col += 1
        color = re.search(r"background:\s*#([0-9A-Fa-f]{6})", head)
        out.append((color.group(1).upper() if color else None, row))
    return out


def _year(text: str) -> int | None:
    ys = [int(y) for y in re.findall(r"(?<!\d)(19[5-9]\d|20\d\d)(?!\d)", text)]
    return min(ys) if ys else None


def _rank(kind: str, notes: str) -> int:
    k = kind.lower()
    if "gravity assist" in (k + " " + notes.lower()):
        return 0
    if any(w in k for w in ("lander", "rover", "impact", "penetrator", "atmospheric", "balloon", "sample", "probe")):
        return 3
    if "orbit" in k:
        return 2
    return 1


def probes() -> None:
    raw = download(PROBES, "wikipedia", f"list-of-solar-system-probes-{REVISION}.txt").read_text(encoding="utf-8")
    # 依節切開：每一節（含子節）的表
    entries: dict[str, list[dict]] = defaultdict(list)  # 任務的鍵 → 在各節的紀錄
    names: dict[str, str] = {}
    section = None
    for m in re.finditer(r"(^(=+)\s*(.*?)\s*\2\s*$)|(^\{\|[^\n]*wikitable.*?^\|\})", raw, flags=re.M | re.S):
        if m.group(1):
            title = W.text(m.group(3))
            level = len(m.group(2))
            if level == 2 or title in SECTIONS:
                section = title if title in SECTIONS else (None if level == 2 else section)
            continue
        if section is None or SECTIONS.get(section) is None:
            continue
        dest = SECTIONS[section]
        current = None
        for color, row in _rows_with_color(m.group(4)):
            org_i = next((i for i, c in enumerate(row) if re.search(r"\{\{\s*flag(?:icon|country)?\s*\|", c, re.I)), None)
            if org_i is None or org_i == 0 or len(row) < org_i + 4:
                continue
            sc = row[org_i - 1]
            link = (W.links(sc) or [W.text(sc)])[0]
            key = link.strip()
            flags = re.findall(r"\{\{\s*flag(?:icon|country)?\s*\|\s*([^|}]+)", row[org_i], flags=re.I)
            date, kind, status = W.text(row[org_i + 1]), W.text(row[org_i + 2]), W.text(row[org_i + 3])
            notes = W.text(row[org_i + 4]) if len(row) > org_i + 4 else ""
            outcome = OUTCOME_BY_COLOR.get(color or "") or (FAILED if "fail" in status.lower() else
                                                            ONGOING if "progress" in status.lower() or "en route" in status.lower() else SUCCESS)
            current = {"dest": dest, "flags": [f.strip() for f in flags], "year": _year(date), "rank": _rank(kind, notes),
                       "outcome": outcome, "org": W.text(row[org_i])}
            entries[key].append(current)
            names.setdefault(key, W.text(sc))
    missions = []
    unknown_flags: Counter = Counter()
    agency_only = 0
    for key, recs in entries.items():
        years = [r["year"] for r in recs if r["year"]]
        first = min(years) if years else None
        # 主要目的地：等級最高的，同等級取最早的；順路飛掠小行星（新視野號、伽利略號）比其他目的地的飛掠低一級
        others = any(r["dest"] != "asteroid" and r["rank"] >= 1 for r in recs)
        main = sorted(recs, key=lambda r: (-(r["rank"] - (0.5 if others and r["dest"] == "asteroid" and r["rank"] == 1 else 0)),
                                           r["year"] or 9999, DEST_ORDER.index(r["dest"])))[0]
        isos: list[str] = []
        flags = {f for r in recs for f in r["flags"]}
        for f in flags:
            if f in AGENCIES:
                continue
            iso = FLAGS.get(f)
            if not iso:
                unknown_flags[f] += 1
                continue
            if iso not in isos:
                isos.append(iso)
        if not isos:
            agency_only += 1
        year = min(first or LAST_YEAR, LAST_YEAR)
        missions.append({"name": names[key], "dest": main["dest"], "outcome": main["outcome"], "year": year, "iso3": isos,
                         "org": main["org"]})
    if unknown_flags:
        raise RuntimeError(f"深空探測：對不到國家的國旗代碼 {dict(unknown_flags)}，加進 FLAGS 或 AGENCIES")

    years = list(range(FIRST_YEAR, LAST_YEAR + 1))
    series = {k: defaultdict(lambda: [0] * len(years)) for k in ("probes", "probes-success", "probes-failed")}
    for ms in missions:
        for iso in ms["iso3"]:
            for i, y in enumerate(years):
                if ms["year"] <= y:
                    series["probes"][iso][i] += 1
                    if ms["outcome"] == SUCCESS:
                        series["probes-success"][iso][i] += 1
                    elif ms["outcome"] == FAILED:
                        series["probes-failed"][iso][i] += 1
    esa = sum(1 for ms in missions if not ms["iso3"])
    note = (f"只有歐洲太空總署（ESA）的任務 {esa} 個不算進任何國家", f"{esa} missions by the European Space Agency alone are not "
            "assigned to any country")
    world_all = [sum(1 for ms in missions if ms["year"] <= y) for y in years]
    for name, data in series.items():
        world = world_all if name == "probes" else [
            sum(1 for ms in missions if ms["year"] <= y and ms["outcome"] == (SUCCESS if name == "probes-success" else FAILED))
            for y in years]
        write_json(OUT / f"{name}.json", indicator_file(
            name, "個", years, {c: v for c, v in sorted(data.items())}, aggregates={"WLD": world},
            notes={"WLD": note[0]}, notesEn={"WLD": note[1]}), quiet=True)
    write_manifest_part(OUT, "space", "probes", {"revision": REVISION, "agencyOnly": esa})
    by_c = Counter(iso for ms in missions for iso in ms["iso3"])
    print(f"  深空探測：{len(missions)} 個任務（成功 {sum(1 for m in missions if m['outcome'] == SUCCESS)}、失敗 "
          f"{sum(1 for m in missions if m['outcome'] == FAILED)}、進行中 {sum(1 for m in missions if m['outcome'] == ONGOING)}），"
          f"只有 ESA 的 {esa}；" + "、".join(f"{c} {n}" for c, n in by_c.most_common(8)))
    print("    主要目的地：" + "、".join(f"{d} {n}" for d, n in Counter(m["dest"] for m in missions).most_common()))
    for probe in ("Voyager 2", "New Horizons", "Cassini–Huygens", "Galileo (spacecraft)", "Rosetta (spacecraft)", "Dawn (spacecraft)",
                  "MESSENGER", "Parker Solar Probe", "Tianwen-1", "Hope (spacecraft)"):
        ms = next((m for m in missions if m["name"] == names.get(probe, "")), None)
        if ms:
            print(f"    {probe} → {ms['dest']}（{ms['year']}，{ms['outcome']}）")


def build() -> None:
    space_budget()
    probes()
