"""Starlink 開通的國家（2026-10-31，製作手冊第十批 170）：維基共享資源的服務狀態地圖，依顏色對 ISO 代碼。

- 地圖：維基共享資源「Starlink availability map by country.svg」2026-10-08 06:33 的版本（CC BY-SA 4.0，作者 savemaxim
  等）。每個國家是 id 為兩個小寫字母（ISO 3166-1）的 g 或 path，顏色寫在 style 的 fill；沒寫 fill 的照 CSS 的
  .landxx 是 #e0e0e0。說明頁的圖例：#0ea817 Approved and activated、#0d00f2 Activated（英文維基「Starlink」的圖例寫
  Active without approval）、#eade15 Approved and pending activation、#e0e0e0 Unknown（條目的圖例寫 Not covered）。
  灰色兩邊寫法不同，所以寫成「地圖沒有標（沒有服務或狀態不明）」。
- 附註：英文維基「Starlink」（revid 1382130179）的「Internet availability and regulatory approval」一節（CC BY-SA 4.0）：
  台灣 2022 年因外資持股的規定談判破局、印度 2026 年 6 月凍結最後核准、南非、越南、烏干達、斯里蘭卡、伊朗。
- 輸出的檔含維基共享資源的內容，照 CC BY-SA 4.0。

輸出 public/data/topics/starlink/status.json（一年 2026）。
"""
from __future__ import annotations

import re

import pycountry

from common import OUT_DIR, download, indicator_file, now_iso, write_json

OUT = OUT_DIR / "topics" / "starlink"
SVG = "https://upload.wikimedia.org/wikipedia/commons/4/4e/Starlink_availability_map_by_country.svg"
YEAR = 2026

# 顏色 → 狀態代碼（前端 src/topics/starlink.ts 的 STATUS）；沒有上色的是 0
COLORS = {"#0ea817": 1, "#0d00f2": 2, "#eade15": 3, "#e0e0e0": 0}
# SVG 自己的代碼（不是 ISO 3166-1）
SPECIAL = {"xk": "XKX"}

NOTES = {
    "TWN": ("沒有服務。英文維基（2026-10 版）引彭博 2023 年 7 月的報導：2022 年 SpaceX 跟台灣談，堅持台灣子公司要 100% 持股，"
            "跟台灣電信業者要由本國資本控制的規定不合，談判破局。",
            "No service. English Wikipedia (October 2026 revision), citing Bloomberg in July 2023: talks in 2022 fell through "
            "when SpaceX insisted on 100% ownership of a Taiwanese subsidiary, which conflicts with Taiwan's rule that internet "
            "service providers be majority-controlled locally."),
    "IND": ("2025 年拿到統一執照與 GMPCS 授權，但 2026 年 6 月內政部的安全單位以伊朗戰爭中有人未經授權使用 Starlink 為由，"
            "凍結開始商業營運的最後核准。",
            "Starlink obtained a Unified License and GMPCS authorization in 2025, but in June 2026 security agencies under the "
            "Ministry of Home Affairs froze final approval for commercial operation, citing unauthorised use of Starlink "
            "terminals in the Iran conflict."),
    "ZAF": ("沒有核准；2025 年 6 月發現 2022 年起就有人用漫遊方案在南非使用，之後 Starlink 停掉這些用戶。",
            "Not licensed; in June 2025 it emerged that people had been using roaming plans in South Africa since 2022, after "
            "which Starlink suspended them."),
    "IRN": ("沒有核准；伊朗斷網時有團體捐贈終端，讓民眾繞過網路封鎖（地圖標為「開通但沒有核准」）。",
            "Not licensed; groups have donated terminals so that Iranians can get around internet blackouts (marked on the map "
            "as active without approval)."),
    "VNM": ("2026 年 2 月科技部發給固定與行動衛星網路的執照。", "Licensed for fixed and mobile satellite networks by the Ministry of "
            "Science and Technology in February 2026."),
    "UGA": ("2026-05-15 烏干達通訊委員會簽了營運執照。", "The Uganda Communications Commission signed an operating licence on "
            "15 May 2026."),
    "LKA": ("2024 年 8 月拿到執照，2025-07-02 正式開通。", "Licensed in August 2024; service launched on 2 July 2025."),
}


def build() -> None:
    svg = download(SVG, "commons", "starlink-availability-2026-10-08.svg").read_text(encoding="utf-8")
    status: dict[str, int] = {}
    for _tag, attrs in re.findall(r"<(g|path)\b([^>]*)>", svg):
        m = re.search(r'\bid="([a-z]{2})"', attrs)
        if not m or m.group(1) in status:
            continue
        code = m.group(1)
        fill = re.search(r"fill:\s*(#[0-9a-fA-F]{6})", attrs)
        color = fill.group(1).lower() if fill else "#e0e0e0"
        if color not in COLORS:
            raise RuntimeError(f"Starlink 地圖：{code} 的顏色 {color} 不在圖例裡")
        iso3 = SPECIAL.get(code)
        if not iso3:
            country = pycountry.countries.get(alpha_2=code.upper())
            if not country:
                continue  # SVG 自己的代碼（xa、xc、xn、xo、xp、xs 等爭議地區或小島），地圖上沒有對應
            iso3 = country.alpha_3
        status[iso3] = COLORS[color]
    if status.get("TWN") != 0:
        raise RuntimeError("Starlink 地圖：台灣不是灰色，地圖可能改版了，要重看附註")
    by = {k: sum(1 for v in status.values() if v == k) for k in sorted(set(status.values()))}
    print(f"  Starlink：{len(status)} 個國家與地區（開通 {by.get(1, 0)}、開通但沒有核准 {by.get(2, 0)}、"
          f"等待開通 {by.get(3, 0)}、地圖沒有標 {by.get(0, 0)}）")
    write_json(OUT / "status.json", {
        **indicator_file("status", "", [YEAR], {c: [v] for c, v in sorted(status.items())},
                         notes={c: n[0] for c, n in NOTES.items()}, notesEn={c: n[1] for c, n in NOTES.items()},
                         hints={"TWN": "沒有服務（2022 年談判破局）"}, hintsEn={"TWN": "No service (talks broke down in 2022)"}),
        "license": "CC BY-SA 4.0",
        "attribution": "“Starlink availability map by country.svg” (version of 8 October 2026), Wikimedia Commons, "
                       "https://commons.wikimedia.org/wiki/File:Starlink_availability_map_by_country.svg",
    })
    write_json(OUT / "manifest.json", {"topic": "starlink", "generatedAt": now_iso()})
