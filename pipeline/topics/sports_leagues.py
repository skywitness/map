"""運動：聯賽、俱樂部與進場人數（2026-11-06，製作手冊第二十四批 426；步驟 sports-leagues，輸出 topics/sports/）。

- Wikidata 經 QLever（CC0）：P31 是 sports league（Q623109）或它的子類別、有國家（P17）的聯賽數，與 sports club
  （Q847017）及子類別的俱樂部數。覆蓋差很多（德國 1 萬多個俱樂部、台灣 55 個），只能說「Wikidata 上有幾個」。
- 進場人數：英文維基百科「List of attendance figures at domestic professional sports leagues」revid 1382037028
  （CC BY-SA 4.0，讀 /wiki/ 條目頁），條目裡「平均進場人數」那張表（League、Sport、Country/ies、Pyramid level…），
  只取第一級的聯賽；國家欄裡每個連結是一個國家（MLB 算美國與加拿大）。各國的值是平均進場最多的那一個聯賽，
  其他聯賽寫在 hints。球季不一樣（2017–2025），條目自己也說有的只算常規賽、有的是售票數。
- 台灣：運動部「中華職棒大聯盟歷年現場觀眾總人次、平均單場人次」（data.gov.tw 11284，政府資料開放授權條款第 1 版，
  ws.sports.gov.tw 檔案直連）最新一年（民國 112 年＝2023；2024、2025 年的新高不在開放資料裡）。
"""
from __future__ import annotations

import csv
import html
import io
import json
import re
import urllib.parse
import urllib.request

from common import CACHE_DIR, OUT_DIR, USER_AGENT, download, indicator_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "sports"
YEAR = 2026
QLEVER = "https://qlever.dev/api/wikidata"
ATTENDANCE = "https://en.wikipedia.org/wiki/List_of_attendance_figures_at_domestic_professional_sports_leagues?oldid=1382037028"
CPBL = "https://ws.sports.gov.tw/FS01/FilePath/1/relfile/164/10270/3fb3e69c-526e-49b1-804f-317a023fda9c.csv"
PLACE = {"England": "GBR", "Scotland": "GBR", "Wales": "GBR", "Northern Ireland": "GBR", "United Kingdom": "GBR"}


def _counts(cls: str, name: str) -> dict[str, int]:
    path = CACHE_DIR / "wikidata-sports" / f"{name}.json"
    if not path.exists():
        query = ("PREFIX wd: <http://www.wikidata.org/entity/> PREFIX wdt: <http://www.wikidata.org/prop/direct/>\n"
                 f"SELECT ?iso (COUNT(DISTINCT ?x) AS ?n) WHERE {{ ?x wdt:P31/wdt:P279* wd:{cls} ; wdt:P17 ?c . "
                 "?c wdt:P298 ?iso } GROUP BY ?iso")
        req = urllib.request.Request(QLEVER, data=urllib.parse.urlencode({"query": query}).encode(),
                                     headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
        with urllib.request.urlopen(req, timeout=600) as r:
            data = r.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    rows = json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]
    return {r["iso"]["value"]: int(r["n"]["value"]) for r in rows}


def _text(cell: str) -> str:
    cell = re.sub(r"<sup.*?</sup>", "", cell, flags=re.S)
    return html.unescape(re.sub(r"<[^>]+>", "", cell)).strip()


def _attendance() -> dict[str, list[tuple[int, str, str, str]]]:
    """{國家: [(平均進場, 聯賽, 運動, 球季)]}，只有第一級"""
    page = download(ATTENDANCE, "wikipedia", "attendance-1382037028.html").read_text(encoding="utf-8")
    out: dict[str, list] = {}
    for table in re.findall(r'<table class="wikitable[^"]*"[^>]*>(.*?)</table>', page, re.S):
        rows = re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S)
        head = [_text(c) for c in re.findall(r"<th[^>]*>(.*?)</th>", rows[0], re.S)]
        if "Country/ies" not in head or "Averageattendance" not in head:
            continue
        ci, li, si, ssn, ai, lv = (head.index(k) for k in ("Country/ies", "League", "Sport", "Season", "Averageattendance", "Pyramidlevel"))
        for r in rows[1:]:
            cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)
            if len(cells) < len(head) or _text(cells[lv]) != "1":
                continue
            # 有排序鍵的格子會留下「12,652"}]]}'>12,652」這種殘渣，取最後一個數字（看得到的那一個）
            nums = re.findall(r"\d[\d,]*", _text(cells[ai]))
            avg = nums[-1].replace(",", "") if nums else ""
            names = [html.unescape(re.sub(r"<[^>]+>", "", a)).strip() for a in re.findall(r"<a [^>]*>(.*?)</a>", cells[ci], re.S)]
            for n in names:
                iso3 = PLACE.get(n) or from_name(n)
                if iso3 and avg:
                    out.setdefault(iso3, []).append((int(avg), _text(cells[li]), _text(cells[si]), _text(cells[ssn])))
        break
    return out


def _cpbl() -> tuple[int, int]:
    raw = download(CPBL, "sports-tw", "11284.csv").read_bytes().decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(raw)))
    head = rows[0]
    yi = next(i for i, h in enumerate(head) if "年" in h)
    ai = next(i for i, h in enumerate(head) if "平均" in h)
    last = max((r for r in rows[1:] if r and r[yi].strip().isdigit()), key=lambda r: int(r[yi]))
    return int(last[yi]) + 1911, int(float(last[ai].replace(",", "")))


def build() -> None:
    for name, cls, zh, en in (("sport-leagues", "Q623109", "個聯賽", "leagues"), ("sport-clubs", "Q847017", "個俱樂部", "clubs")):
        n = _counts(cls, name)
        write_json(OUT / f"{name}.json", indicator_file(name, zh[1:], [YEAR], {k: [v] for k, v in sorted(n.items())}, license="CC0"))
        print(f"  {name}：{len(n)} 國、{sum(n.values()):,}；最多 {sorted(((v, k) for k, v in n.items()), reverse=True)[:8]}；台灣 {n.get('TWN')}")

    att = _attendance()
    year, avg = _cpbl()
    att["TWN"] = [(avg, "中華職棒大聯盟（CPBL）", "Baseball", str(year))]
    values, hints, hints_en = {}, {}, {}
    for iso3, leagues in sorted(att.items()):
        leagues.sort(reverse=True)
        values[iso3] = [leagues[0][0]]
        hints[iso3] = "、".join(f"{lg}（{season}）{a:,}" for a, lg, _, season in leagues[:4])
        hints_en[iso3] = "; ".join(f"{lg} ({season}) {a:,}" for a, lg, _, season in leagues[:4])
    hints["TWN"] = f"中華職棒 {year} 年平均每場 {avg:,} 人（運動部開放資料，只到 {year} 年）"
    hints_en["TWN"] = f"CPBL {year}: {avg:,} per game (Sports Administration open data, up to {year})"
    write_json(OUT / "league-attendance.json", indicator_file("league-attendance", "人", [YEAR], values,
                                                             hints=hints, hintsEn=hints_en))
    print(f"  進場人數：{len(values)} 國；{sorted(((v[0], k) for k, v in values.items()), reverse=True)}")
