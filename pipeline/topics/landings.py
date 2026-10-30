"""月球與火星的登陸點（新主題，科技與交通類，2026-10-30）：在地球地圖上畫各國在月球、火星的登陸次數。

使用者決定（2026-10-30，製作手冊第一百零二節）：先在地球地圖上畫各國的登陸次數；月球、火星的底圖不做。

**資料**：英文維基百科「List of landings on extraterrestrial bodies」固定版本 REVISION（CC BY-SA 4.0，衍生的資料檔依同一授權分享）
的「Mars」與「Earth's Moon」兩張表（Mission、Country/Agency、Date of landing/impact、Coordinates、Notes）。一列是一次抵達表面
（軟著陸、撞擊、失敗的著陸都列），列的底色是結果（條目開頭的 Colour key）：
- 沒有底色：著陸失敗、刻意撞擊、或任務還在進行（`kind` 1「撞擊或失敗」）
- #EFE7B8：成功軟著陸並傳回資料（2）
- #DFE771：成功軟著陸並把樣本送回地球（3）
- #C0E0E0：載人登陸並安全返回（4，阿波羅）
**國家**：Country/Agency 欄的國旗模板（{{flagicon|USA}}…）；蘇聯算在繼承國俄羅斯（跟太空主題同規則），好幾面國旗的（合作任務）
每個國家都算一次，只有機構（ESA）的不算進任何國家、寫在附註。**年份**：登陸或撞擊的日期；還沒發生的（預定的任務）不收。

**輸出**（public/data/topics/landings/）：moon.json、moon-soft.json、mars.json、mars-soft.json（各國累計到這一年的
抵達表面次數、成功軟著陸次數，含樣本返回與載人）、list.json（每一次：天體、任務、國家、日期、結果，側欄用）。
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, now_iso, write_json
from sources import wikitable as W

OUT = OUT_DIR / "topics" / "landings"
PAGE = "List of landings on extraterrestrial bodies"
REVISION = 1372275847  # 2026-08-31T02:53:47Z
FIRST_YEAR, LAST_YEAR = 1959, 2026
TODAY = "2026-10-30"  # 表上也列了預定的任務（韓國 KLEP 2032），這天以後的不收
KIND_BY_COLOR = {"EFE7B8": 2, "DFE771": 3, "C0E0E0": 4}
# 國旗模板的代碼 → ISO alpha-3（蘇聯算俄羅斯）
FLAGS = {"USA": "USA", "USSR": "RUS", "Soviet Union": "RUS", "RUS": "RUS", "Russia": "RUS", "JPN": "JPN", "Japan": "JPN",
         "CHN": "CHN", "PRC": "CHN", "China": "CHN", "IND": "IND", "India": "IND", "ISR": "ISR", "Israel": "ISR",
         "KOR": "KOR", "South Korea": "KOR", "UAE": "ARE", "United Arab Emirates": "ARE", "LUX": "LUX", "Luxembourg": "LUX",
         "UK": "GBR", "GBR": "GBR", "United Kingdom": "GBR", "ITA": "ITA", "Italy": "ITA", "MEX": "MEX", "Mexico": "MEX"}
AGENCIES = {"ESA", "Europe", "European Space Agency", "EU"}
MONTHS = {m: i for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July", "August", "September",
                                      "October", "November", "December"], 1)}


def _rows(table: str) -> list[tuple[int, list[str]]]:
    """(結果代碼, 格子)；結果依列的底色"""
    out = []
    body = W.strip_refs(table)
    parts = re.split(r"^(\|-.*)$", body, flags=re.M)
    for head, block in zip(parts[1::2], parts[2::2]):
        cells: list[str] = []
        for line in block.split("\n"):
            if line.startswith("|}"):
                break
            if line.startswith("!"):
                cells = []
                break
            if line.startswith("|"):
                cells.extend(W._split_top(line[1:], "||"))
            elif cells and line.strip():
                cells[-1] += "\n" + line
        # 少於 5 格的是上一列 rowspan 的續列（嫦娥六號的上升段撞擊），同一個任務，不另外算
        if len(cells) < 5:
            continue
        cells = [W._cell(c)[0] for c in cells]
        color = re.search(r"background:\s*#([0-9A-Fa-f]{6})", head)
        out.append((KIND_BY_COLOR.get(color.group(1).upper(), 1) if color else 1, cells))
    return out


def _date(text: str) -> tuple[int, str] | None:
    m = re.search(r"(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})", text)
    if m and m.group(2) in MONTHS:
        return int(m.group(3)), f"{m.group(3)}-{MONTHS[m.group(2)]:02d}-{int(m.group(1)):02d}"
    m = re.search(r"([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})", text)
    if m and m.group(1) in MONTHS:
        return int(m.group(3)), f"{m.group(3)}-{MONTHS[m.group(1)]:02d}-{int(m.group(2)):02d}"
    m = re.search(r"(\d{4})", text)
    return (int(m.group(1)), m.group(1)) if m else None


def _countries(cell: str) -> tuple[list[str], list[str]]:
    flags = re.findall(r"\{\{\s*flag(?:icon|country)?\s*\|\s*([^|}]+)", cell, flags=re.I)
    isos, agencies = [], []
    for f in flags:
        f = f.strip()
        if f in FLAGS:
            isos.append(FLAGS[f])
        elif f in AGENCIES:
            agencies.append(f)
        else:
            raise ValueError(f"沒有對到的國旗：{f}")
    if not flags:
        text = W.text(cell)
        for name, iso3 in FLAGS.items():
            if re.search(rf"\b{re.escape(name)}\b", text):
                isos.append(iso3)
        if not isos and any(a in text for a in AGENCIES):
            agencies.append(text)
    return sorted(set(isos)), agencies


def build() -> None:
    wikitext = W.fetch(PAGE, REVISION, "extraterrestrial-landings")
    heads = {re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", m.group(1)).strip(): m.end()
             for m in re.finditer(r"^=+\s*(.*?)\s*=+\s*$", wikitext, re.M)}
    events = []
    agency_only = Counter()
    for body, title in (("moon", "Earth's Moon"), ("mars", "Mars")):
        table = W.tables(wikitext[heads[title]:])[0]
        for kind, cells in _rows(table):
            mission, who, when = cells[0], cells[1], cells[2]
            isos, agencies = _countries(who)
            d = _date(W.text(when))
            if d is None or d[1] > TODAY:
                print(f"    {body}：{W.text(mission)}（{W.text(when)}）沒有日期或還沒發生，不收")
                continue
            if not isos:
                agency_only[body] += 1
            events.append({"body": body, "mission": W.text(mission).replace("\n", " "), "iso3": isos,
                           "agency": agencies, "year": d[0], "date": d[1], "kind": kind})
    years = list(range(FIRST_YEAR, LAST_YEAR + 1))
    OUT.mkdir(parents=True, exist_ok=True)
    counts = {}
    for body in ("moon", "mars"):
        for soft in (False, True):
            per: dict[str, Counter] = defaultdict(Counter)
            for e in events:
                if e["body"] == body and (not soft or e["kind"] >= 2):
                    for c in e["iso3"]:
                        per[c][e["year"]] += 1
            values = {c: [sum(n for y2, n in cnt.items() if y2 <= y) for y in years] for c, cnt in per.items()}
            name = f"{body}{'-soft' if soft else ''}"
            counts[name] = {c: v[-1] for c, v in values.items()}
            write_json(OUT / f"{name}.json", indicator_file(name, "次", years, values, notes={
                "TWN": "台灣沒有登陸月球或火星的任務。"}, notesEn={"TWN": "Taiwan has had no Moon or Mars landing mission."}))
    write_json(OUT / "list.json", [[e["body"], e["mission"], e["iso3"], e["date"], e["kind"]] for e in events])
    write_json(OUT / "manifest.json", {"topic": "landings", "generatedAt": now_iso(), "revision": REVISION,
                                       "agencyOnly": dict(agency_only)})
    for body in ("moon", "mars"):
        evs = [e for e in events if e["body"] == body]
        print(f"  {body}：{len(evs)} 列，結果 {dict(Counter(e['kind'] for e in evs))}，只有機構的 {agency_only[body]}")
        print(f"    抵達表面：{sorted(counts[body].items(), key=lambda t: -t[1])}")
        print(f"    成功軟著陸：{sorted(counts[body + '-soft'].items(), key=lambda t: -t[1])}")


if __name__ == "__main__":
    build()
