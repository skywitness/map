"""台灣的外交：打工度假（2026-11-06，製作手冊第二十四批 419；步驟 working-holiday，輸出 topics/taiwan-diplomacy/）。

使用者 2026-11-06 決定只做台灣、併進「台灣的外交」，全球誰跟誰互簽（英文維基百科的分國敘述文）不做。
- 台灣青年可以去的國家：外交部「臺灣青年Fun眼世界－度假打工資訊」RSS（data.gov.tw 7651，youthtaiwan.mofa.gov.tw；
  那個網站沒有 robots.txt，回的是首頁），18 國，每一則寫年齡限制、名額限制、停留期限。
- 計畫開始實施的日期：領事事務局「度假打工（青年交流）」RSS（data.gov.tw 32894，www.boca.gov.tw/rss-388-1.xml；
  robots.txt 只禁 ZoomEye），各國青年來臺的說明寫「依據我國與日本自98年6月1日起實施…」，取第一個「起實施」的日期；
  以色列那一則沒有寫日期。
- 兩份都是政府資料開放授權條款第 1 版。名額是台灣青年去對方國家的名額（互惠不一定對等），澳大利亞是「無限制」，
  加拿大是「約 1,000 名」。
"""
from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET

from common import OUT_DIR, download, indicator_file, write_json

OUT = OUT_DIR / "topics" / "taiwan-diplomacy"
OUTBOUND = "https://youthtaiwan.mofa.gov.tw/WorkingHoliday/OpenData.aspx?SN=DA0CE1C96FB856E8"
INBOUND = "https://www.boca.gov.tw/rss-388-1.xml"
YEAR = 2026
NAMES = {"法國": "FRA", "加拿大": "CAN", "奧地利": "AUT", "荷蘭": "NLD", "愛爾蘭": "IRL", "紐西蘭": "NZL", "韓國": "KOR",
         "澳大利亞": "AUS", "日本": "JPN", "以色列": "ISR", "斯洛伐克": "SVK", "波蘭": "POL", "匈牙利": "HUN", "捷克": "CZE",
         "英國": "GBR", "比利時": "BEL", "德國": "DEU", "盧森堡": "LUX"}
NAMES_EN = {"FRA": "France", "CAN": "Canada", "AUT": "Austria", "NLD": "the Netherlands", "IRL": "Ireland", "NZL": "New Zealand",
            "KOR": "South Korea", "AUS": "Australia", "JPN": "Japan", "ISR": "Israel", "SVK": "Slovakia", "POL": "Poland",
            "HUN": "Hungary", "CZE": "Czechia", "GBR": "the UK", "BEL": "Belgium", "DEU": "Germany", "LUX": "Luxembourg"}
# 名額的類別（src/topics/diplomacy.ts 的 WORKING_HOLIDAY，由多到少）
UNLIMITED, Q1000, Q400, Q100, Q_SMALL = 1, 2, 3, 4, 5


def _text(item) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(item.findtext("description") or ""))).strip()


def _field(text: str, key: str) -> str | None:
    m = re.search(key + r"\s*[:：]\s*(.+?)(?=\s(?:名額限制|停留期限|年齡限制|申請|資料來源|愛爾蘭移民)|。|$)", text)
    return m.group(1).strip() if m else None


def build() -> None:
    out_root = ET.parse(download(OUTBOUND, "working-holiday", "mofa-outbound.xml")).getroot()
    in_root = ET.parse(download(INBOUND, "working-holiday", "boca-inbound.xml")).getroot()

    since: dict[str, tuple[int, int, int]] = {}
    for it in in_root.iter("item"):
        title = it.findtext("title") or ""
        iso3 = next((v for k, v in NAMES.items() if title.startswith(k + "籍")), None)
        m = re.search(r"(\d{2,3})年(\d{1,2})月(\d{1,2})日起(?:正式)?實施", _text(it))
        if iso3 and m:
            since[iso3] = (int(m.group(1)) + 1911, int(m.group(2)), int(m.group(3)))

    kinds, years, hints, hints_en = {}, {}, {}, {}
    for it in out_root.iter("item"):
        title = (it.findtext("title") or "").strip()
        name = re.sub(r"\s*[（(].*$", "", title)
        iso3 = NAMES.get(name)
        if not iso3:
            raise RuntimeError(f"打工度假：認不出國名 {title!r}，要加進 NAMES")
        text = _text(it)
        age, quota, stay = _field(text, "年齡限制"), _field(text, "名額限制"), _field(text, "停留期限")
        if not age or not quota:
            raise RuntimeError(f"打工度假：{title} 的年齡或名額讀不到")
        quota = re.sub(r"資料來源.*$", "", quota).strip(" 。")
        # 「18至30歲(未滿31歲)」「18至35歲(36歲生日前)」：上限是第二個數字
        ages = [int(x) for x in re.findall(r"\d{2}", age)]
        top = ages[1]
        n = re.search(r"([\d,]+)\s*名", quota)
        count = int(n.group(1).replace(",", "")) if n else None
        if "無限制" in quota:
            kind = UNLIMITED
        elif count is None:
            raise RuntimeError(f"打工度假：{title} 的名額 {quota!r} 讀不出數字")
        else:
            kind = Q1000 if count >= 1000 else Q400 if count >= 400 else Q100 if count >= 100 else Q_SMALL
        kinds[iso3] = [kind]
        start = since.get(iso3)
        if start:
            years[iso3] = [start[0]]
        program = re.search(r"[（(](.+?)[）)]", title)
        zh = [f"{program.group(1)}；" if program else "", f"年齡 {age}，名額 {quota}"]
        if stay:
            zh.append(f"，停留 {stay}")
        if start:
            zh.append(f"；{start[0]} 年 {start[1]} 月 {start[2]} 日起實施")
        hints[iso3] = "".join(zh)
        en_quota = "no cap" if kind == UNLIMITED else f"{'about ' if '約' in quota else ''}{count:,} a year"
        hints_en[iso3] = f"Up to age {top}, {en_quota}" + (f"; in effect since {start[0]}-{start[1]:02d}-{start[2]:02d}" if start else "")

    write_json(OUT / "working-holiday.json", indicator_file("working-holiday", "類別", [YEAR], dict(sorted(kinds.items())),
                                                           hints=hints, hintsEn=hints_en))
    write_json(OUT / "working-holiday-since.json", indicator_file("working-holiday-since", "年", [YEAR], dict(sorted(years.items())),
                                                                 hints=hints, hintsEn=hints_en))
    print(f"  {len(kinds)} 國；名額類別 {sorted((v[0], k) for k, v in kinds.items())}")
    print(f"  實施年份 {sorted((v[0], k) for k, v in years.items())}；沒有日期 {sorted(set(kinds) - set(years))}")
    for k in ("JPN", "AUS", "GBR", "CZE", "KOR", "LUX"):
        print(f"    {k}：{hints[k]} | {hints_en[k]}")
