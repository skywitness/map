"""台灣人看哪一國的電影：全國電影票房的出品國（2026-11-04，製作手冊第二十一批 347）。

- 資料：國家電影及視聽文化中心「全國電影票房統計數據」（政府資料開放平臺 94224，政府資料開放授權條款第 1 版），
  https://boxofficetw.tfai.org.tw/OpenData/statistic/since2016 ，2016-01-01 起上映的每一部片的出品國、上映日、
  戲院數、總票數與總金額（每 7 天更新；只收上映滿 7 天的片，所以最近的年份偏低）。
- 只有上映日，沒有賣票的日期：年份是「上映年」，一部片的票全部算在上映那一年。Tickets 與 TotalTickets 在這支端點
  完全相同，不能相加，用 TotalTickets。
- 出品國是中文字串，合製片寫好幾國（「法國/德國」「美、英、日」），只算第一個；「中華民國」「台灣」是國片，「大陸」
  「中國大陸」是中國，「南斯拉夫」算塞爾維亞，「西德」算德國。對不到的名稱報錯。出品國空白的不算。
- 2016 年以前上映的（1939–2015 年，修復重映的老片）不算。
- 左邊的清單列出票數最多的片（點了框住出品國）。
"""
from __future__ import annotations

import json
import re
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, now_iso, points_file, to_series, write_json
from topics.diplomacy_lists import country_boxes

OUT = OUT_DIR / "topics" / "box-office-tw"
URL = "https://boxofficetw.tfai.org.tw/OpenData/statistic/since2016"
FIRST = 2016
LIST_MIN_TICKETS = 10_000  # 清單只列一萬張以上的片（全部 7 千多部太長）
NAMES = {
    'Australia': 'AUS', 'France': 'FRA', 'Germany': 'DEU', '不丹': 'BTN', '中國': 'CHN', '中國大陸': 'CHN', '中華民國': 'TWN',
    '丹麥': 'DNK', '亞美尼亞': 'ARM', '以色列': 'ISR', '伊拉克': 'IRQ', '伊朗': 'IRN', '俄羅斯': 'RUS', '保加利亞': 'BGR',
    '克羅埃西亞': 'HRV', '冰島': 'ISL', '加拿大': 'CAN', '匈牙利': 'HUN', '北馬其頓': 'MKD', '南斯拉夫': 'SRB', '南韓': 'KOR',
    '印尼': 'IDN', '印度': 'IND', '古巴': 'CUB', '台灣': 'TWN', '哥倫比亞': 'COL', '哥斯大黎加': 'CRI', '喬治亞': 'GEO',
    '土耳其': 'TUR', '埃及': 'EGY', '塞爾維亞': 'SRB', '墨西哥': 'MEX', '多明尼加共和國': 'DOM', '大陸': 'CHN', '奧地利': 'AUT',
    '委內瑞拉': 'VEN', '尼泊爾': 'NPL', '巴勒斯坦': 'PSE', '巴基斯坦': 'PAK', '巴拉圭': 'PRY', '巴拿馬': 'PAN', '巴西': 'BRA',
    '希臘': 'GRC', '德': 'DEU', '德國': 'DEU', '愛沙尼亞': 'EST', '愛爾蘭': 'IRL', '拉脫維亞': 'LVA', '挪威': 'NOR', '捷克': 'CZE',
    '摩洛哥': 'MAR', '斯洛伐克': 'SVK', '斯洛維尼亞': 'SVN', '斯里蘭卡': 'LKA', '新加坡': 'SGP', '日': 'JPN', '日本': 'JPN',
    '智利': 'CHL', '柬埔寨': 'KHM', '比利時': 'BEL', '法': 'FRA', '法國': 'FRA', '波蘭': 'POL', '泰國': 'THA', '澳大利亞': 'AUS',
    '澳洲': 'AUS', '澳門': 'MAC', '烏克蘭': 'UKR', '玻利維亞': 'BOL', '瑞典': 'SWE', '瑞士': 'CHE', '瓜地馬拉': 'GTM',
    '白俄羅斯': 'BLR', '盧森堡': 'LUX', '秘魯': 'PER', '突尼西亞': 'TUN', '立陶宛': 'LTU', '紐西蘭': 'NZL', '羅馬尼亞': 'ROU',
    '美': 'USA', '美國': 'USA', '義': 'ITA', '義大利': 'ITA', '芬蘭': 'FIN', '英': 'GBR', '英國': 'GBR', '英屬維京群島': 'VGB',
    '荷蘭': 'NLD', '菲律賓': 'PHL', '葉門': 'YEM', '葡萄牙': 'PRT', '蒙古': 'MNG', '蘇丹': 'SDN', '西': 'ESP', '西德': 'DEU',
    '西班牙': 'ESP', '賽普勒斯': 'CYP', '越南': 'VNM', '阿富汗': 'AFG', '阿拉伯聯合大公國': 'ARE', '阿根廷': 'ARG',
    '阿爾及利亞': 'DZA', '韓國': 'KOR', '香港': 'HKG', '馬來西亞': 'MYS', '馬其頓': 'MKD', '黎巴嫩': 'LBN',
}


def _country(text: str | None) -> str | None:
    tokens = [t.strip() for t in re.split(r"##|/|、|,|，", text or "") if t.strip()]
    if not tokens:
        return None
    if tokens[0] not in NAMES:
        raise RuntimeError(f"票房的出品國對不到：{tokens[0]!r}（{text!r}）")
    return NAMES[tokens[0]]


def build() -> None:
    films = json.loads(download(URL, "tfai", "since2016.json").read_text(encoding="utf-8"))["List"]
    tickets: dict[str, dict[int, float]] = defaultdict(dict)
    amounts: dict[str, dict[int, float]] = defaultdict(dict)
    counts: dict[str, dict[int, float]] = defaultdict(dict)
    total_t: dict[int, float] = defaultdict(float)
    total_a: dict[int, float] = defaultdict(float)
    listed, skipped_old, no_country = [], 0, 0
    for f in films:
        year = int(f["ReleaseDate"][:4])
        if year < FIRST:
            skipped_old += 1
            continue
        iso3 = _country(f["Country"])
        t, a = float(f["TotalTickets"] or 0), float(f["TotalAmounts"] or 0)
        total_t[year] += t
        total_a[year] += a
        if not iso3:
            no_country += 1
            continue
        tickets[iso3][year] = tickets[iso3].get(year, 0) + t
        amounts[iso3][year] = amounts[iso3].get(year, 0) + a
        counts[iso3][year] = counts[iso3].get(year, 0) + 1
        if t >= LIST_MIN_TICKETS:
            listed.append({"n": " ".join(f["Name"].split()), "iso3": iso3, "c": f["Country"] or "", "d": f["ReleaseDate"][:10],
                           "y": year, "t": int(t), "a": int(a), "th": int(f["TheaterCount"] or 0)})
    years = list(range(FIRST, max(total_t) + 1))
    share = {c: {y: v / total_t[y] * 100 for y, v in s.items()} for c, s in tickets.items()}
    for ind, data, digits, unit in (("tickets", tickets, 0, "張"), ("share", share, 2, "%"), ("amounts", amounts, 0, "元"),
                                    ("film-count", counts, 0, "部")):
        extra = {}
        if ind in ("tickets", "amounts"):  # 全部（含出品國空白的）放 aggregates 的 WLD，tooltip 與排名表的「全部」
            extra["aggregates"] = {"WLD": to_series(dict(total_t if ind == "tickets" else total_a), years, 0)}
        write_json(OUT / f"{ind}.json", indicator_file(
            ind, unit, years, {c: to_series(s, years, digits) for c, s in sorted(data.items())}, **extra))
    boxes = country_boxes()
    rows = []
    for x in sorted(listed, key=lambda x: -x["t"]):
        w, s, e, n = boxes.get(x["iso3"], (0, 0, 0, 0))
        rows.append({**x, "lon": round((w + e) / 2, 2), "lat": round((s + n) / 2, 2),
                     "bw": round(w, 2), "bs": round(s, 2), "be": round(e, 2), "bn": round(n, 2)})
    write_json(OUT / "films.json", points_file(
        rows, ["lon", "lat", "n", "iso3", "c", "d", "y", "t", "a", "th", "bw", "bs", "be", "bn"],
        {"lon": 0.01, "lat": 0.01, "y": 1, "t": 1, "a": 1, "th": 1, "bw": 0.01, "bs": 0.01, "be": 0.01, "bn": 0.01},
        strings=("iso3",)))
    write_json(OUT / "manifest.json", {"topic": "box-office-tw", "generatedAt": now_iso(),
                                       "source": "國家電影及視聽文化中心 全國電影票房統計數據（政府資料開放授權條款）"})
    all_t = sum(total_t.values())
    cum = sorted(((sum(s.values()), c) for c, s in tickets.items()), reverse=True)
    print(f"  票房：{len(films)} 部（2016 年以前上映的 {skipped_old} 部不算、沒有出品國的 {no_country} 部），{years[0]}–{years[-1]}，"
          f"共 {all_t:,.0f} 張；清單 {len(rows)} 部")
    print("  累計：" + "、".join(f"{c} {v / 1e4:,.0f} 萬張（{v / all_t:.1%}）" for v, c in cum[:8]))
    print("  每年總票數：" + "、".join(f"{y} {total_t[y] / 1e4:,.0f} 萬" for y in years))
