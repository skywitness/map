"""獨立紀念日：哪一天、哪一年、從誰獨立（2026-11-07，製作手冊第二十七批 560，候選 1264；新主題，社會・生活與文化；
步驟 independence，輸出 topics/independence/）。

資料：英文維基百科「List of national independence days」（revid 1383739965，CC BY-SA 4.0，只引用事實；衍生的資料檔同授權）。
手冊寫用 Special:Export，但 robots.txt 不准程式抓 Special: 與 /w/ 的頁面（使用者的規則），這裡抓
https://en.wikipedia.org/wiki/List_of_national_independence_days?oldid=1383739965 的網頁、解析唯一的 wikitable：
國家、紀念的事件、日期、年份、從誰獨立（可能好幾個）、備註（備註是維基的文字，不輸出）。表格的 rowspan 會跨國
（例如「從誰獨立」的格子跨到下一國），所以照欄位追蹤 rowspan 把表攤平（_grid）。

- 一國有好幾列（阿富汗的 1919 年與 1989 年、拉脫維亞的 1918 年宣布與 1990 年恢復…）：地圖用第一列，側欄列全部。
- 從誰獨立分 8 類（RULER_CLASS）：英國、法國、西班牙、葡萄牙、俄羅斯與蘇聯、鄂圖曼帝國、其他歐洲國家、其他；
  第一列有好幾個時用第一個。已經不存在的國家（蘇聯、鄂圖曼帝國、奧匈帝國、南斯拉夫）照原文寫在 tooltip，不換成繼承國。
- 這份是「獨立紀念日」的列表，不是國慶日：法國（7 月 14 日）、中國（10 月 1 日）、日本（2 月 11 日）的國慶日不是從別國獨立，
  不在表上，沒有值。
- 台灣：手冊以為表上沒有台灣，實際上這一版有一列「Taiwan｜Retrocession Day｜25 October｜1945｜Japan」（臺灣光復節，
  日本統治結束）。那是統治結束、不是獨立，照手冊的原則（不把台灣畫成「從誰獨立」、不碰主權論述）地圖留空，
  noValue 寫明光復節與中華民國國慶日（10 月 10 日，紀念 1911 年武昌起義）；側欄照表列出那一列。
"""
from __future__ import annotations

import html
import re
from collections import Counter

from common import CACHE_DIR, OUT_DIR, USER_AGENT, indicator_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "independence"
REVID = 1383739965
URL = f"https://en.wikipedia.org/wiki/List_of_national_independence_days?oldid={REVID}"
MONTHS = {m: i + 1 for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July", "August",
                                          "September", "October", "November", "December"])}
# 從誰獨立 → 類別（1 英國、2 法國、3 西班牙、4 葡萄牙、5 俄羅斯與蘇聯、6 鄂圖曼帝國、7 其他歐洲國家、8 其他）
RULER_CLASS = {
    "United Kingdom": 1, "Kingdom of Great Britain": 1,
    "France": 2, "Vichy France": 2,
    "Spain": 3, "Spanish Empire": 3, "Portugal": 4, "Portuguese Empire": 4,
    "French First Republic": 2, "Provisional Government of the French Republic": 2, "Russian Republic": 5,
    "Dutch Empire": 7, "German Empire": 7, "Nazi Germany": 7, "Kingdom of Italy": 7, "Socialist Federal Republic of Yugoslavia": 7,
    "Soviet Union": 5, "Russian Soviet Federative Socialist Republic": 5, "Russia": 5, "Russian Empire": 5,
    "Ottoman Empire": 6,
    "Belgium": 7, "Netherlands": 7, "Denmark": 7, "Austria-Hungary": 7, "Austrian Empire": 7, "Germany": 7, "Italy": 7,
    "Yugoslavia": 7, "Serbia": 7, "Holy Roman Empire": 7, "Kalmar Union": 7, "German Confederation": 7, "Sweden": 7,
    "West Germany": 7, "East Germany": 7, "Czechoslovakia": 7, "Serbia and Montenegro": 7,
}
OTHER = 8
RULER_ZH = {
    "United Kingdom": "英國", "Kingdom of Great Britain": "大不列顛王國", "France": "法國", "Vichy France": "維琪法國",
    "Spain": "西班牙", "Portugal": "葡萄牙", "Soviet Union": "蘇聯", "Russian Soviet Federative Socialist Republic": "俄羅斯蘇維埃聯邦社會主義共和國",
    "Russia": "俄羅斯", "Russian Empire": "俄羅斯帝國", "Ottoman Empire": "鄂圖曼帝國", "Belgium": "比利時", "Netherlands": "荷蘭",
    "Denmark": "丹麥", "Austria-Hungary": "奧匈帝國", "Austrian Empire": "奧地利帝國", "Germany": "德國", "Italy": "義大利",
    "Yugoslavia": "南斯拉夫", "Serbia": "塞爾維亞", "Holy Roman Empire": "神聖羅馬帝國", "Kalmar Union": "卡爾馬聯盟",
    "German Confederation": "德意志邦聯", "Sweden": "瑞典", "West Germany": "西德", "East Germany": "東德",
    "Czechoslovakia": "捷克斯洛伐克", "Serbia and Montenegro": "塞爾維亞與蒙特內哥羅", "United States": "美國", "Japan": "日本",
    "Pakistan": "巴基斯坦", "Ethiopia": "衣索比亞", "Malaysia": "馬來西亞", "Sudan": "蘇丹", "South Africa": "南非",
    "Australia": "澳洲", "New Zealand": "紐西蘭", "Israel": "以色列", "Egypt": "埃及", "Empire of Brazil": "巴西帝國",
    "Qing dynasty": "清朝", "American Colonization Society": "美國殖民協會", "British Mandate for Palestine": "英國託管巴勒斯坦",
    "Emirate of Transjordan": "外約旦酋長國", "China": "中國", "Indonesia": "印尼", "Spanish Empire": "西班牙帝國",
    "Portuguese Empire": "葡萄牙帝國", "Dutch Empire": "荷蘭帝國", "German Empire": "德意志帝國", "Nazi Germany": "納粹德國",
    "Kingdom of Italy": "義大利王國", "Socialist Federal Republic of Yugoslavia": "南斯拉夫社會主義聯邦共和國",
    "Empire of Japan": "大日本帝國", "French First Republic": "法蘭西第一共和國", "Russian Republic": "俄羅斯共和國",
    "Provisional Government of the French Republic": "法蘭西共和國臨時政府", "Japanese Occupation of Korea": "日本統治下的朝鮮",
    "Provisional Government of the Republic of Korea": "大韓民國臨時政府", "Kingdom of Serbia": "塞爾維亞王國",
}
# 表上的國名 from_name 對不到的
NAME_FIX = {"Republic of the Congo": "COG", "Democratic Republic of the Congo": "COD", "East Timor": "TLS",
            "Congo, Democratic Republic of the": "COD", "Congo, Republic of the": "COG",
            "Ivory Coast": "CIV", "The Gambia": "GMB", "Gambia": "GMB", "Cape Verde": "CPV", "Eswatini": "SWZ",
            "North Macedonia": "MKD", "São Tomé and Príncipe": "STP", "Federated States of Micronesia": "FSM",
            "Kosovo": "XKX", "Somaliland": "_SOL", "State of Palestine": "PSE", "Palestine": "PSE", "Vatican City": "VAT"}


def _txt(x: str) -> str:
    x = re.sub(r"<sup.*?</sup>", "", x, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", x))).strip()


def _rulers(cell: str) -> list[str]:
    names = [html.unescape(t) for t in re.findall(r'title="([^"]+)"', re.sub(r"<sup.*?</sup>", "", cell, flags=re.S))]
    names = [n for n in names if not n.startswith(("File:", "Flag of"))]
    return names or [n for n in [_txt(cell)] if n]


def _date(text: str) -> tuple[int, int] | None:
    m = re.search(r"(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December)", text)
    if m:
        return MONTHS[m.group(2)], int(m.group(1))
    m = re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})", text)
    return (MONTHS[m.group(1)], int(m.group(2))) if m else None


def _grid(table: str) -> list[list[str]]:
    """wikitable → 每列 6 格（照欄位追蹤 rowspan、colspan；格子內容是原始 HTML）"""
    pending: dict[int, tuple[int, str]] = {}
    grid = []
    for r in re.findall(r"<tr.*?</tr>", table, re.S)[1:]:
        cells = re.findall(r"<t[hd]([^>]*)>(.*?)</t[hd]>", r, re.S)
        row, col = [], 0
        it = iter(cells)
        while col < 6:
            if col in pending:
                left, content = pending[col]
                row.append(content)
                pending[col] = (left - 1, content)
                if left - 1 == 0:
                    del pending[col]
                col += 1
                continue
            try:
                attrs, content = next(it)
            except StopIteration:
                break
            span = re.search(r'rowspan="?(\d+)', attrs)
            cspan = re.search(r'colspan="?(\d+)', attrs)
            for k in range(int(cspan.group(1)) if cspan else 1):
                if span and int(span.group(1)) > 1:
                    pending[col] = (int(span.group(1)) - 1, content)
                row.append(content)
                col += 1
        if len(row) == 6:
            grid.append(row)
    return grid


def _page() -> str:
    import urllib.request
    path = CACHE_DIR / "wikipedia" / f"independence-days-{REVID}.html"
    if not path.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return path.read_text(encoding="utf-8")


def build() -> None:
    s = _page()
    t = s[s.index('<table class="wikitable'):]
    t = t[:t.index("</table>")]
    out: dict[str, list] = {}
    unmatched = []
    for cells in _grid(t):
        country = _txt(cells[0])
        iso3 = NAME_FIX.get(country) or from_name(country)
        if not iso3:
            unmatched.append(country)
        event, date, year, rulers = _txt(cells[1]), _date(_txt(cells[2])), _txt(cells[3]), _rulers(cells[4])
        y = re.search(r"\d{3,4}", year)
        if iso3:
            out.setdefault(iso3, []).append([event, f"{date[0]:02d}-{date[1]:02d}" if date else None, int(y.group()) if y else None, rulers])

    years, ruler, hints, hints_en = {}, {}, {}, {}
    for c, entries in out.items():
        if c == "TWN":
            continue
        event, md, y, rulers = entries[0]
        if y:
            years[c] = [y]
        ruler[c] = [RULER_CLASS.get(rulers[0], OTHER) if rulers else OTHER]
        from_zh = "、".join(RULER_ZH.get(n, n) for n in rulers)
        date_zh = f"{int(md[:2])} 月 {int(md[3:])} 日" if md else ""
        hints[c] = f"{y} 年{('，' + date_zh) if date_zh else ''}（{event}）" + (f"，從{from_zh}" if from_zh else "")
        hints_en[c] = f"{y}{(', ' + md) if md else ''} ({event})" + (f", from {', '.join(rulers)}" if rulers else "")
    taiwan = ("列表上的台灣是 10 月 25 日的臺灣光復節（1945 年日本統治結束），不是獨立；中華民國國慶日是 10 月 10 日，紀念 1911 年武昌起義，地圖不上色",
              "The list gives Taiwan’s Retrocession Day (25 October, the end of Japanese rule in 1945), which is not independence; the Republic of China’s National Day, 10 October, marks the 1911 Wuchang Uprising. Not coloured on the map")
    lic = "CC BY-SA 4.0"
    write_json(OUT / "year.json", indicator_file("year", "年", [2026], years, hints=hints, hintsEn=hints_en,
                                                 noValue={"TWN": taiwan[0]}, noValueEn={"TWN": taiwan[1]}, license=lic))
    write_json(OUT / "ruler.json", indicator_file("ruler", "category", [2026], ruler, hints=hints, hintsEn=hints_en,
                                                  noValue={"TWN": taiwan[0]}, noValueEn={"TWN": taiwan[1]}, license=lic))
    write_json(OUT / "details.json", {"revid": REVID, "license": lic, "countries": out,
                                      "rulersZh": {n: RULER_ZH[n] for n in sorted({n for e in out.values() for x in e for n in x[3]}) if n in RULER_ZH}})

    print(f"  {len(out)} 國（對不到 {unmatched}）；{sum(len(v) for v in out.values())} 列")
    print(f"  從誰獨立（第一列）：{Counter(v[0] for v in ruler.values()).most_common()}")
    print(f"  其他：{sorted((c, out[c][0][3]) for c, v in ruler.items() if v[0] == OTHER)}")
    ys = sorted((v[0], c) for c, v in years.items())
    print(f"  年份：最早 {ys[:6]}；最晚 {ys[-6:]}；各年代 {sorted(Counter(y // 10 * 10 for y, _ in ys).items())}")
    months = Counter(int(e[0][1][:2]) for e in out.values() if e[0][1])
    print(f"  月份：{sorted(months.items())}")
    for c in ("USA", "IND", "KOR", "PHL", "IDN", "VNM", "MNG", "UKR", "LVA", "AFG", "FIN", "MEX", "BRA", "SGP", "MYS"):
        print(f"    {c}：{out.get(c)}")
