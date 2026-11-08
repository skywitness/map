"""景點地圖的擴充：歐洲文化之都（1985–2031）、歐洲遺產標章（2026-11-08，製作手冊第二十七批 648，候選 1419、1421；
步驟 euro-culture，輸出 topics/attractions/）。

- 歐洲文化之都：英文維基「European Capital of Culture」固定版本 revid 1381273561 的 wikitable（手冊寫的 Special:Export
  被 robots.txt 禁止，改讀 /wiki/?oldid=）。年份取前四碼（「2020 – April 2021」是 2020、「2023¹」的註腳拿掉），
  一列兩個城市（Nova Gorica／Gorizia）拆成兩點；「TBA」還沒決定的不收。國家照現在的國界（1988 年的西柏林算德國）。
  點依年份累計出現，國家的值是辦過幾次（比例圓，跟世界博覽會同一種畫法）。
- 歐洲遺產標章：同一個條目沒有表格，revid 1350786905 的「Selected sites」依國家分節的清單，逐行剖析；
  名單沒有獲得年份（只有芬蘭寫了），所以不做時間軸，國家不上色、只畫點與清單。跨國的站點（Colonies of Benevolence、
  Werkbund Estates）在每一國各算一處。
- 座標與中文名稱：Wikidata（CC0，經 QLever：sources/enwiki_coords.py）。維基百科的文字是 CC BY-SA 4.0，只引用年份、城市、國家。
"""
from __future__ import annotations

import html as H
import re
from collections import Counter, defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import enwiki_coords, wikipedia_html
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "attractions"
ECOC = ("European Capital of Culture", 1381273561)
EHL = ("European Heritage Label", 1350786905)
COUNTRY_FIX = {"West Germany": "DEU", "Republic of Ireland": "IRL", "Czech Republic": "CZE", "Turkey": "TUR",
               "North Macedonia": "MKD", "United Kingdom": "GBR"}


def _iso(name: str) -> str | None:
    return COUNTRY_FIX.get(name) or from_name(name)


def capitals() -> None:
    text = wikipedia_html.page(*ECOC)
    rows = []
    for r in wikipedia_html.tables(text)[0][1:]:
        if len(r) < 3 or not r[1][1]:
            continue  # 空列、還沒決定的（TBA）
        y = re.match(r"(\d{4})", r[0][0])
        if not y:
            continue
        cities, countries = r[1][1], r[2][1]
        if cities[0].startswith("Future enlargement"):
            continue
        for i, page in enumerate(cities):
            country = countries[min(i, len(countries) - 1)]
            rows.append({"y": int(y.group(1)), "page": page, "iso3": _iso(country), "country": country,
                         "label": re.sub(r"\d+$", "", r[1][0]).split("/")[0].strip() if len(cities) == 1 else page})
    found = enwiki_coords.coords([r["page"] for r in rows], "ecoc")
    out, missing = [], []
    for r in rows:
        c = found.get(r["page"])
        if not c or not r["iso3"]:
            missing.append((r["y"], r["page"], r["country"]))
            continue
        out.append({"lon": round(c["lon"], 4), "lat": round(c["lat"], 4), "y": r["y"], "iso3": r["iso3"], "en": r["page"].split(",")[0].split(" (")[0],
                    "zh": c["zh"]})
    out.sort(key=lambda o: (o["y"], o["en"]))
    write_points(OUT / "capitals-of-culture.json", points_file(out, ["lon", "lat", "y", "iso3", "en", "zh"], {"lon": 0.0001, "lat": 0.0001, "y": 1},
                                                               strings=("iso3",)), ("en", "zh"))
    years = list(range(min(o["y"] for o in out), max(o["y"] for o in out) + 1))
    counts: dict[str, list[int]] = defaultdict(lambda: [0] * len(years))
    for o in out:
        for i, y in enumerate(years):
            if o["y"] <= y:
                counts[o["iso3"]][i] += 1
    write_json(OUT / "capitals-of-culture-count.json", indicator_file("capitals-of-culture-count", "次", years,
                                                                       {c: [v or None for v in s] for c, s in sorted(counts.items())},
                                                                       license="CC BY-SA 4.0"))
    upto = Counter(o["iso3"] for o in out if o["y"] <= 2026)
    print(f"  歐洲文化之都：{len(out)} 個城市（{years[0]}–{years[-1]}；2026 年以前 {sum(upto.values())}），對不到 {missing}")
    print(f"    到 2026 年：{upto.most_common(10)}；{len(upto)} 國；2000 年 {sum(1 for o in out if o['y'] == 2000)} 城")


def heritage_label() -> None:
    text = wikipedia_html.page(*EHL)
    body = text[text.index('id="Selected_sites"'):text.index('id="The_logo"')]  # 目錄裡也有同樣的字，用標題的 id
    rows, country = [], None
    for m in re.finditer(r"<h3[^>]*>(.*?)</h3>|<li[^>]*>(.*?)</li>", body, re.S):
        if m.group(1) is not None:
            country = H.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
            continue
        raw = m.group(2)
        label = H.unescape(re.sub(r"<sup.*?</sup>", "", re.sub(r"<(?!sup|/sup)[^>]+>", "", raw), flags=re.S)).strip()
        label = re.sub(r"\[\d+\]", "", label).strip()
        link = re.search(r'href="https://en\.wikipedia\.org/wiki/([^"#?]+)"', raw)
        page = H.unescape(link.group(1)).replace("_", " ") if link else None
        if page:
            from urllib.parse import unquote
            page = unquote(page)
        y = re.search(r"\((\d{4})\)", label)
        rows.append({"country": country, "iso3": _iso(country or ""), "label": label, "page": page, "y": int(y.group(1)) if y else None})
    found = enwiki_coords.coords([r["page"] for r in rows if r["page"]], "ehl")
    out, missing = [], []
    for r in rows:
        c = found.get(r["page"] or "")
        if not c or not r["iso3"]:
            missing.append((r["country"], r["label"][:40]))
            continue
        # 連結常是站點本身，有時是所在的城市（「Werkbund Estates in Europe - Werkbundsiedlung Vienna」連到 Vienna）：
        # 條目名稱是清單文字的開頭時才用 Wikidata 的中文名稱，否則只寫英文（座標仍用連結，是那座城市）
        first = re.split(r",| – | - ", r["label"])[0].strip().lower()
        title = r["page"].split(" (")[0].lower()
        own = first.startswith(title) and len(title) >= 0.65 * len(first)
        out.append({"lon": round(c["lon"], 4), "lat": round(c["lat"], 4), "iso3": r["iso3"], "en": r["label"], "zh": c["zh"] if own else None})
    write_points(OUT / "heritage-label.json", points_file(out, ["lon", "lat", "iso3", "en", "zh"], {"lon": 0.0001, "lat": 0.0001},
                                                          strings=("iso3",)), ("en", "zh"))
    n = Counter(r["iso3"] for r in rows if r["iso3"])
    write_json(OUT / "heritage-label-count.json", indicator_file(
        "heritage-label-count", "處", [2026], {}, license="CC BY-SA 4.0",
        hints={c: f"英文維基的名單上有 {v} 處" for c, v in n.items()},
        hintsEn={c: f"{v} {'site' if v == 1 else 'sites'} on English Wikipedia’s list" for c, v in n.items()}))
    print(f"  歐洲遺產標章：名單 {len(rows)} 處、{len(n)} 國；畫出 {len(out)}；對不到 {len(missing)}：{missing}")
    print(f"    各國：{n.most_common()}")


def build() -> None:
    capitals()
    heritage_label()
