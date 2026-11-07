"""網路自由度：審查、斷網與因言論被抓（新主題，2026-11-07，製作手冊第二十七批 590，候選 1311；步驟 internet-freedom，
輸出 topics/internet-freedom/）。

- Freedom House《Freedom on the Net》2026 年版（評的是 2025 年 6 月到 2026 年 5 月）。授權：只准非商業、要註明出處
  （https://freedomhouse.org/about-us/content-permissions：「Use of Freedom House content for noncommercial purposes is
  permitted, but the work must be acknowledged with a citation or other clear reference」）。
- 手冊寫資料檔的直連待確認：報告頁與出版品檔案頁都沒有 Freedom on the Net 的 xlsx（只有「資料申請」表單，不用），
  所以讀網站的「Countries and Territories」分數頁（https://freedomhouse.org/country/scores，robots.txt 允許）的
  2026 年總分與三個面向（A 接取障礙 0–25、B 內容限制 0–35、C 使用者權利侵害 0–40，分越高越自由），
  再讀每一國的國家頁（/country/<slug>/freedom-net/2026）的 21 題分數，每支間隔 3 秒。
- **只有最新一年**：歷年的分數要逐國逐年讀國家頁（72 國 × 15 年），沒有做；側欄沒有歷年線。
- 只評了 72 國，多半是「有問題才被選進來」的國家，沒被評的不等於自由（手冊的陷阱，說明寫明）。
"""
from __future__ import annotations

import html
import re
import time

from common import CACHE_DIR, OUT_DIR, download, indicator_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "internet-freedom"
BASE = "https://freedomhouse.org"
YEAR = 2026
DELAY = 3.0
NAMES = {"Kyrgyzstan": "KGZ", "Russia": "RUS", "Iran": "IRN", "Vietnam": "VNM", "Venezuela": "VEN", "Syria": "SYR",
         "South Korea": "KOR", "Turkey": "TUR", "Türkiye": "TUR", "Taiwan": "TWN", "The Gambia": "GMB", "Gambia": "GMB",
         "Bosnia and Herzegovina": "BIH", "United States": "USA", "United Kingdom": "GBR", "Myanmar": "MMR"}


def _cell(row: str, code: str) -> str | None:
    m = re.search(rf'data-code="{code}">.*?<span class="score">([^<]*)</span>', row, re.S)
    return m.group(1).strip() if m else None


def _scores() -> dict[str, dict]:
    path = download(f"{BASE}/country/scores", "freedomhouse", "scores.html")
    s = path.read_text(encoding="utf-8")
    out = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", s, re.S):
        m = re.search(r'href="/country/([^"]+)/freedom-net/(\d{4})"', row)
        name = re.search(r'data-code="country_name"><a [^>]*>([^<]+)</a>', row)
        if not m or not name or int(m.group(2)) != YEAR:
            continue
        country = html.unescape(name.group(1)).strip()
        iso3 = NAMES.get(country) or from_name(country)
        if not iso3:
            print(f"    對不到國家：{country}")
            continue
        status = re.search(r'data-code="fotn".*?status-([a-z-]+)', row, re.S)
        out[iso3] = {"slug": m.group(1), "name": country, "total": int(_cell(row, "fotn")),
                     "a": int(_cell(row, "fotn-ota")), "b": int(_cell(row, "fotn-loc")), "c": int(_cell(row, "fotn-vour")),
                     "status": status.group(1) if status else ""}
    return out


def _questions(slug: str) -> list[tuple[str, int, int, str]]:
    """[(代碼, 分數, 滿分, 題目)]"""
    name = f"{slug}-{YEAR}.html"
    cached = (CACHE_DIR / "freedomhouse" / name).exists()
    path = download(f"{BASE}/country/{slug}/freedom-net/{YEAR}", "freedomhouse", name)
    if not cached:
        time.sleep(DELAY)
    text = html.unescape(re.sub(r"<[^>]+>", "\n", path.read_text(encoding="utf-8")))
    lines = [x.strip() for x in text.split("\n") if x.strip()]
    out, seen = [], set()
    for i, x in enumerate(lines):
        if re.fullmatch(r"[ABC]\d", x) and x not in seen:
            j = next(k for k in range(i + 1, i + 6) if re.fullmatch(r"0-\d+ pts", lines[k]))
            top = int(re.search(r"0-(\d+)", lines[j]).group(1))
            score = float(lines[j + 2])
            out.append((x, round(score), top, lines[j + 1]))
            seen.add(x)
    return out


def build() -> None:
    scores = _scores()
    questions = {c: _questions(v["slug"]) for c, v in scores.items()}
    lic = "Freedom House 內容使用規定（非商業使用、註明出處）"
    no_tw = {}
    for key, name in (("total", "fotn"), ("a", "fotn-access"), ("b", "fotn-content"), ("c", "fotn-rights")):
        write_json(OUT / f"{name}.json", indicator_file(
            name, "分", [YEAR], {c: [v[key]] for c, v in sorted(scores.items())}, license=lic, **no_tw))
    texts = next(iter(questions.values()))
    write_json(OUT / "questions.json", {
        "year": YEAR, "codes": [q[0] for q in texts], "max": [q[2] for q in texts], "text": [q[3] for q in texts],
        "countries": {c: [q[1] for q in qs] for c, qs in sorted(questions.items())},
        "status": {c: v["status"] for c, v in sorted(scores.items())}, "license": lic})
    v = sorted(((s["total"], c) for c, s in scores.items()), reverse=True)
    print(f"  {len(scores)} 國：最高 {v[:8]}；最低 {v[-8:]}")
    print(f"  台灣 {scores.get('TWN')}；美國 {scores.get('USA', {}).get('total')}、日本 {scores.get('JPN', {}).get('total')}、中國 {scores.get('CHN', {}).get('total')}")
    bad = [c for c, qs in questions.items() if len(qs) != 21 or sum(q[1] for q in qs) != scores[c]["total"]]
    print(f"  21 題加總對不上總分的：{bad}")
