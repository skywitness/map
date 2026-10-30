"""各國的健保制度（健康主題的擴充，2026-10-30，製作手冊第六批 88；輸出到 topics/health/）。

使用者決定（2026-10-30，製作時再問過一次）：英文維基的分類沒辦法對應到 OECD 的四類（維基的 Single-payer 同時包含
英國這種稅收的國家衛生服務與台灣這種單一保險人；Public insurance system 同時包含日本的多個保險人與韓國的單一保險人），
所以分成三個指標、各自標明來源，不硬對應：

1. 基本醫療保障的主要來源（OECD Health System Characteristics Survey 2023 的 Q2，33 國）：文字答案在 CSV 裡是空的，
   用 SDMX-JSON 讀。台灣不在 OECD 裡：《全民健康保險法》第 7 條「本保險以衛生福利部中央健康保險署為保險人」，
   編成單一保險人。OECD 資料條款（已記）。
2. 醫療的主要財源（英文維基百科「Health care systems by country」表的 Financing system 欄，固定 revid 1379352169，
   2026-10-09）：約 100 國有填（其餘 N/A 不畫），用維基自己的分類，每國的附註寫表上的原文與那一列引用的網址。
   CC BY-SA 4.0，資料檔同樣依 CC BY-SA 4.0 分享。
3. 全民健保的開辦年份（英文維基百科「Universal health care」的「Universal health care start date」表，
   固定 revid 1382403456，2026-10-28，44 個國家與地區，表上註明出處是紐約州衛生署）。各國的定義不一
   （有的寫立法年，有的寫全面涵蓋年），說明寫明。CC BY-SA 4.0。
"""
from __future__ import annotations

import json
import re
import urllib.request

import pycountry

from common import CACHE_DIR, OUT_DIR, REFRESH, USER_AGENT, _ssl_context, download, indicator_file, write_json

OUT = OUT_DIR / "topics" / "health"

OECD_URL = (
    "https://sdmx.oecd.org/public/rest/data/OECD.ELS.HD,DSD_HSCS2023@DF_HSCS2023,1.0/.Q2..."
    "?dimensionAtObservation=AllDimensions"
)
OECD_YEAR = 2023
OECD_ANSWERS = {
    "A national health system covering the country as a whole": 1,
    "A single health insurance fund (single-payer model)": 2,
    "Multiple insurance funds or companies": 3,
    "Local health systems that serve distinct geographic regions": 4,
}

SYSTEMS_REVID = 1379352169
SYSTEMS_DATE = 2026
SYSTEMS_URL = f"https://en.wikipedia.org/w/index.php?title=Health_care_systems_by_country&action=raw&oldid={SYSTEMS_REVID}"
START_REVID = 1382403456
START_URL = f"https://en.wikipedia.org/w/index.php?title=Universal_health_care&action=raw&oldid={START_REVID}"

# 維基表的 Financing system → 類別（維基自己的分類，不對應 OECD）
FINANCING = [
    ("single-payer", 1),  # 政府單一支付（稅收的國家衛生服務或單一的公營保險）
    ("multi-payer social insurance", 2),
    ("public-private social insurance", 2),
    ("social insurance", 2),
    ("public insurance", 2),  # 社會保險（公營保險為主）
    ("public-private insurance", 3),  # 公私混合
    ("mixed non-universal", 3),  # 美國：沒有全民保障的公私混合
    ("private health insurance", 4),  # 強制的私人保險為主（荷蘭、瑞士、以色列）
    ("community-based health insurance", 5),
]
NAMES = {"Turkey": "TUR", "Russia": "RUS", "Iran": "IRN", "Syria": "SYR", "North Korea": "PRK", "South Korea": "KOR",
         "Vietnam": "VNM", "Taiwan": "TWN", "Laos": "LAO", "Brunei": "BRN", "East Timor": "TLS", "Palestine": "PSE",
         "Kosovo": "XKX", "Cape Verde": "CPV", "Macau": "MAC", "Bolivia": "BOL", "Venezuela": "VEN", "Moldova": "MDA",
         "Tanzania": "TZA", "Czech Republic": "CZE", "Ivory Coast": "CIV", "Micronesia": "FSM",
         "Democratic Republic of the Congo": "COD", "Republic of the Congo": "COG"}


def _iso3(name: str) -> str | None:
    name = name.strip()
    if name in NAMES:
        return NAMES[name]
    try:
        return pycountry.countries.lookup(name).alpha_3
    except LookupError:
        return None


def oecd_q2() -> dict[str, int]:
    target = CACHE_DIR / "oecd" / "hscs2023-q2.json"
    if not target.exists() or REFRESH:
        target.parent.mkdir(parents=True, exist_ok=True)
        print(f"  下載 {OECD_URL}")
        request = urllib.request.Request(OECD_URL, headers={
            "User-Agent": USER_AGENT, "Accept": "application/vnd.sdmx.data+json; charset=utf-8; version=2",
        })
        with urllib.request.urlopen(request, context=_ssl_context(OECD_URL)) as resp:
            target.write_bytes(resp.read())
    data = json.loads(target.read_text(encoding="utf-8"))
    areas = data["data"]["structures"][0]["dimensions"]["observation"][0]["values"]
    out: dict[str, int] = {}
    for key, obs in data["data"]["dataSets"][0]["observations"].items():
        area = areas[int(key.split(":")[0])]["id"]
        if obs[0] is None or len(area) != 3:
            continue  # 智利沒有回答；WXOECD 是合計
        if obs[0] not in OECD_ANSWERS:
            raise RuntimeError(f"OECD Q2 有沒看過的答案：{obs[0]}")
        out[area] = OECD_ANSWERS[obs[0]]
    return out


def _strip_refs(text: str) -> str:
    return re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", text, flags=re.S).strip()


def financing() -> dict[str, tuple[int, str, str | None]]:
    """{iso3: (類別, 表上的原文, 那一列引用的第一個網址)}"""
    text = open(download(SYSTEMS_URL, "wikipedia", f"Health_care_systems_by_country-{SYSTEMS_REVID}.wiki"), encoding="utf-8").read()
    table = text[text.index('{| class="wikitable sortable static'):text.index("=== Notes ===")]
    out: dict[str, tuple[int, str, str | None]] = {}
    for row in table.split("\n|-"):
        m = re.search(r"flagg\|[^|]*\|pref=[^|]*\|pref2=[^|]*\|([^}]*)\}\}", row)
        if not m:
            continue
        cell = row.split("||")[-1]
        label = _strip_refs(cell).split("\n")[0].strip().rstrip(".")
        code = next((c for key, c in FINANCING if label.lower().startswith(key)), None)
        iso3 = _iso3(m.group(1))
        if code is None or not iso3:
            continue
        url = re.search(r"url=\s*(https?://[^\s|}]+)", cell)
        out[iso3] = (code, label, url.group(1) if url else None)
    return out


def start_years() -> dict[str, int]:
    text = open(download(START_URL, "wikipedia", f"Universal_health_care-{START_REVID}.wiki"), encoding="utf-8").read()
    start = text.index("Universal health care start date")
    table = text[start:text.index("|}", start)]
    out: dict[str, int] = {}
    for row in table.split("|-")[1:]:
        m = re.search(r"\{\{flagg?\|[^}]*?\|([^|}]+)\}\}", row)
        year = re.search(r"\n\|\s*(\d{4})", row)
        if m and year and (iso3 := _iso3(m.group(1))):
            out[iso3] = int(year.group(1))
    return out


def build() -> None:
    q2 = oecd_q2()
    q2["TWN"] = 2
    note = ("台灣不在 OECD 的調查裡。《全民健康保險法》第 7 條：「本保險以衛生福利部中央健康保險署為保險人」，"
            "全民納保、單一保險人，編成「單一保險人」。")
    note_en = ("Taiwan is not in the OECD survey. Under Article 7 of the National Health Insurance Act the National Health "
               "Insurance Administration is the sole insurer for the whole population, so it is coded as a single insurance fund.")
    write_json(OUT / "health-system.json", indicator_file(
        "health-system", "", [OECD_YEAR], {k: [v] for k, v in sorted(q2.items())}, notes={"TWN": note}, notesEn={"TWN": note_en},
    ))
    print(f"  OECD 基本醫療保障：{len(q2)} 國（含台灣）；{ {c: sum(1 for v in q2.values() if v == c) for c in (1, 2, 3, 4)} }")

    fin = financing()
    notes = {k: f"英文維基百科「Health care systems by country」表：{label}" + (f"（出處 {url}）" if url else "（表上沒有引用）")
             for k, (_, label, url) in fin.items()}
    notes_en = {k: f"English Wikipedia, “Health care systems by country”: {label}" + (f" (source: {url})" if url else " (no citation in the table)")
                for k, (_, label, url) in fin.items()}
    write_json(OUT / "health-financing.json", indicator_file(
        "health-financing", "", [SYSTEMS_DATE], {k: [v[0]] for k, v in sorted(fin.items())}, notes=notes, notesEn=notes_en,
    ))
    print(f"  維基的財源分類：{len(fin)} 國；{ {c: sum(1 for v in fin.values() if v[0] == c) for c in (1, 2, 3, 4, 5)} }；台灣 {fin.get('TWN')}")

    years = start_years()
    write_json(OUT / "uhc-start.json", indicator_file(
        "uhc-start", "年", [SYSTEMS_DATE], {k: [v] for k, v in sorted(years.items())},
    ))
    print(f"  全民健保開辦年份：{len(years)} 個；最早 {sorted((v, k) for k, v in years.items())[:4]}；台灣 {years.get('TWN')}")
