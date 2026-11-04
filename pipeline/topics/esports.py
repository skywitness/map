"""電競獎金總額與選手數（2026-11-04，製作手冊第二十一批 348）。

- 資料：Esports Earnings 的國家頁（https://www.esportsearnings.com/countries ，只抓這一頁；robots.txt 一直轉址到自己，
  讀不到規則，所以照手冊只打一頁、不批次抓選手頁）。條款准許個人與商業使用（「You are granted permission to use the
  site's materials for both personal and commercial use」），要保留版權聲明「Copyright © 2012-2026 Esports Earnings.
  All Rights Reserved.」，不能用它的圖片、標誌。每一列：國碼（連結 /countries/xx）、國名、累計獎金（美元）、選手數、
  賺最多的遊戲與占比。累計到抓取那天，沒有年份。
- 站方的資料是網路上公開消息的彙整，不是官方統計；選手國籍以自報為準；累計獎金被 The International（Dota 2）這類超大
  獎金賽事拉偏。每百萬人用聯合國 WPP 2024 的 2026 年推估人口，人口不到 10 萬的不算每百萬人。
- 「Netherlands Antilles」（an）已經不存在，不收。
"""
from __future__ import annotations

import html
import re

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import wpp
from sources.countries import from_alpha2

OUT = OUT_DIR / "topics" / "esports"
URL = "https://www.esportsearnings.com/countries"
YEAR = 2026
MIN_POPULATION = 100  # 千人
# 賺最多獎金的遊戲 → 類別（前端 esports.ts 的 GAMES）
GAMES = {
    "Dota 2": 1,
    "Counter-Strike: Global Offensive": 2, "Counter-Strike 2": 2, "Counter-Strike": 2,
    "Fortnite": 3,
    "PLAYERUNKNOWN'S BATTLEGROUNDS Mobile": 4, "PLAYERUNKNOWN’S BATTLEGROUNDS": 4, "PLAYERUNKNOWN'S BATTLEGROUNDS": 4,
    "League of Legends": 5,
    "Rocket League": 6,
    "Arena of Valor": 7, "Mobile Legends: Bang Bang": 7, "Free Fire": 7, "Pokemon Unite": 7,
}
OTHER = 8


def _money(text: str) -> float:
    return float(text.replace("$", "").replace(",", ""))


def build() -> None:
    page = download(URL, "esports", "countries.html").read_text(encoding="utf-8")
    pop = {c: s[YEAR] for c, s in wpp.demographic(["TPopulation1July"], last_year=YEAR)["TPopulation1July"].items()
           if c != "WLD" and YEAR in s}
    prize, per_m, players, game = {}, {}, {}, {}
    hints, hints_en = {}, {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
        code = re.search(r'href="/countries/([a-z]{2})"', row)
        cells = [" ".join(html.unescape(re.sub(r"<[^>]+>", " ", c)).split()) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]
        if not code or len(cells) < 7:
            continue
        iso3 = from_alpha2(code.group(1).upper())
        if not iso3:
            continue  # Netherlands Antilles
        total, n, top, share = _money(cells[2]), int(cells[3].split()[0].replace(",", "")), cells[4], cells[6]
        prize[iso3], players[iso3] = [total], [n]
        game[iso3] = [GAMES.get(top, OTHER)]
        if iso3 in pop and pop[iso3] >= MIN_POPULATION:
            per_m[iso3] = [round(total / pop[iso3] * 1000, 0)]  # 人口是千人：每百萬人 = 獎金 ÷ 千人 × 1000
        hints[iso3] = f"選手 {n:,} 人；賺最多的遊戲 {top}（{share}）"
        hints_en[iso3] = f"{n:,} players; top game {top} ({share})"
    common = dict(hints=hints, hintsEn=hints_en)
    write_json(OUT / "prize.json", indicator_file("prize", "美元", [YEAR], prize, **common))
    write_json(OUT / "prize-per-million.json", indicator_file("prize-per-million", "美元／百萬人", [YEAR], per_m, **common))
    write_json(OUT / "players.json", indicator_file("players", "人", [YEAR], players, **common))
    write_json(OUT / "top-game.json", indicator_file("top-game", "類別", [YEAR], game, **common))
    write_json(OUT / "manifest.json", {"topic": "esports", "generatedAt": now_iso(),
                                       "source": "Esports Earnings (Copyright © 2012-2026 Esports Earnings. All Rights Reserved.)"})
    top = sorted(((v[0], c) for c, v in prize.items()), reverse=True)
    print(f"  電競：{len(prize)} 國；獎金 {[(c, round(v / 1e6, 1)) for v, c in top[:10]]}；台灣 {prize.get('TWN')} {players.get('TWN')}")
    print(f"  每百萬人 {sorted(((v[0], c) for c, v in per_m.items()), reverse=True)[:8]}；台灣 {per_m.get('TWN')}")
    from collections import Counter
    print(f"  遊戲 {Counter(v[0] for v in game.values()).most_common()}")
