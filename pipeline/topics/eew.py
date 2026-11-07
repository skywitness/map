"""哪些國家收得到地震預警（2026-11-07，製作手冊第二十七批 541，候選 1223；擴充「地震與火山」；步驟 eew，
輸出 topics/earthquakes/eew.json）。

- 資料：英文維基百科「Earthquake early warning system」（revid 1383802141，2026-11-04；CC BY-SA 4.0，只引用事實不照抄文字），
  讀 /wiki/<條目>?oldid= 的條目頁（robots.txt 不准 Special:Export、/w/）。分級照條目「Deployment」一節的四個小節：
  Nationwide systems、Regional systems、Opt-in systems or reserved、Global crowdsourced systems，每一國的說明是讀過那一段後
  自己寫的摘要（REVIEWED 2026-11-07）。
- 1 全國系統、2 只蓋部分地區的官方系統、3 試辦或要自己裝 App、只給特定設施的系統、4 只有 Google 的 Android 地震警報
  （條目點名的國家；Google 說 2025 年另有 98 國收得到，但沒有名單，不畫）。
- 聶斯特里亞（摩爾多瓦境內不被承認的政權）2025 年有全國系統，但地圖上沒有它的範圍，寫在說明；巴西的 Android 警報 2025 年 2 月
  誤報後停用，不畫。
- 1222 HiQuake（人類引發的地震）：inducedearthquakes.org 整站只有「© 2025 Copyright inducedearthquakes.org」，查不到授權，
  照製作手冊不做。
"""
from __future__ import annotations

from datetime import date
from pathlib import Path

from common import download, indicator_file, write_json
from topics.earthquakes import OUT

REVID = 1383802141
URL = f"https://en.wikipedia.org/wiki/Earthquake_early_warning_system?oldid={REVID}"

# 國家 → (等級, 中文說明, 英文說明)
EEW: dict[str, tuple[int, str, str]] = {
    "JPN": (1, "氣象廳的緊急地震速報，2004 年試辦、2007 年 10 月全面上線，是第一個全國系統", "JMA’s Earthquake Early Warning, tested from 2004 and fully operational from October 2007, the first nationwide system"),
    "TWN": (1, "中央氣象署的強震即時警報，1999 年集集地震後開始研發，全國都收得到（手機的細胞廣播）", "The Central Weather Administration’s system, developed after the 1999 Chi-Chi earthquake; nationwide alerts via cell broadcast"),
    "KOR": (1, "氣象廳的系統，2015 年起全國，是日本、台灣之後的第三個", "The Korea Meteorological Administration’s system, nationwide since 2015, the third after Japan and Taiwan"),
    "ISR": (1, "TRUAA 系統，2022 年正式啟用，接上全國的緊急警報", "TRUAA, made operational in 2022 and linked to the national emergency alert system"),
    "CHN": (1, "2024 年宣布完成涵蓋整個中國大陸的系統（約 1 萬 6,000 個測站）", "In 2024 China announced a system covering all of mainland China (about 16,000 stations)"),
    "MEX": (2, "SASMEX（墨西哥地震警報系統），1993 年墨西哥城第一次對大眾發出預警，蓋到部分地區", "SASMEX (Mexican Seismic Alert System); Mexico City issued the first public warning in 1993; covers parts of the country"),
    "USA": (2, "USGS 的 ShakeAlert，只蓋西岸（加州、奧勒岡、華盛頓）", "USGS ShakeAlert, covering the West Coast only"),
    "CAN": (2, "加拿大地震預警，2024 年 8 月在卑詩省啟用，2025 年 11 月擴大到魁北克與安大略", "Canadian Earthquake Early Warning, launched in British Columbia in August 2024 and extended to Quebec and Ontario in November 2025"),
    "IND": (2, "只有北阿坎德邦（UEEWS，2021 年，用 App 與警報器）", "Uttarakhand only (UEEWS, 2021, via an app and sirens)"),
    "PER": (2, "SASPe，沿海的強震測站網，針對規模 6 以上的隱沒帶地震", "SASPe, a coastal strong-motion network aimed at subduction earthquakes of magnitude 6 or more"),
    "CRI": (3, "中美洲 ATTAC 計畫（瑞士協助，2016 年起），2020–2022 年上線，主要用手機 App 發警報", "Part of Central America’s ATTAC initiative (with Swiss support, from 2016); systems launched in 2020–2022, mainly alerting via mobile apps"),
    "SLV": (3, "中美洲 ATTAC 計畫，主要用手機 App 發警報", "Part of Central America’s ATTAC initiative, mainly alerting via mobile apps"),
    "GTM": (3, "中美洲 ATTAC 計畫，主要用手機 App 發警報", "Part of Central America’s ATTAC initiative, mainly alerting via mobile apps"),
    "NIC": (3, "中美洲 ATTAC 計畫，主要用手機 App 發警報", "Part of Central America’s ATTAC initiative, mainly alerting via mobile apps"),
    "ROU": (3, "針對弗朗恰震源區、只給布加勒斯特的重要設施，還沒接上給大眾的警報", "Focused on the Vrancea zone and only for critical facilities in Bucharest; not yet linked to public alerts"),
    "ITA": (3, "只有羅馬–那不勒斯高鐵（2025 年 6 月起，約 211 公里）", "Only the Rome–Naples high-speed railway (from June 2025, about 211 km)"),
    "IDN": (3, "InaEEWS 2025 年在雅加達、萬丹、西爪哇、楠榜試辦，只給 Android 的測試版 App", "InaEEWS piloted in 2025 in Jakarta, Banten, West Java and Lampung via an Android-only test app"),
    "TUR": (3, "坎迪利天文台的馬爾馬拉地區系統，App 2025 年底還在內部測試；另有 Google 的 Android 警報", "Kandilli Observatory’s Marmara system, whose app was still in internal testing in late 2025; Google’s Android alerts also cover Türkiye"),
    "GRC": (4, "只有 Google 的 Android 地震警報（2021 年 4 月起）", "Google’s Android Earthquake Alerts only (from April 2021)"),
    "NZL": (4, "只有 Google 的 Android 地震警報（2021 年 4 月起）", "Google’s Android Earthquake Alerts only (from April 2021)"),
    "PHL": (4, "只有 Google 的 Android 地震警報（2021 年 6 月起）", "Google’s Android Earthquake Alerts only (from June 2021)"),
    "KAZ": (4, "只有 Google 的 Android 地震警報（2021 年 6 月起）", "Google’s Android Earthquake Alerts only (from June 2021)"),
    "KGZ": (4, "只有 Google 的 Android 地震警報（2021 年 6 月起）", "Google’s Android Earthquake Alerts only (from June 2021)"),
    "TJK": (4, "只有 Google 的 Android 地震警報（2021 年 6 月起）", "Google’s Android Earthquake Alerts only (from June 2021)"),
    "TKM": (4, "只有 Google 的 Android 地震警報（2021 年 6 月起）", "Google’s Android Earthquake Alerts only (from June 2021)"),
    "UZB": (4, "只有 Google 的 Android 地震警報（2021 年 6 月起）", "Google’s Android Earthquake Alerts only (from June 2021)"),
    "VEN": (4, "Google 的 Android 地震警報（2026 年委內瑞拉地震時發給約 1,140 萬名使用者）", "Google’s Android Earthquake Alerts (sent to about 11.4 million users during the 2026 Venezuela earthquakes)"),
}

# 條目裡應該有的小節標題（確認讀到的是同一版、結構沒變）
SECTIONS = ["Nationwide_systems", "Regional_systems", "Opt-in_systems_or_reserved", "Global_crowdsourced_systems", "Transnistria"]


def build() -> None:
    page: Path = download(URL, "wikipedia", f"eew-{REVID}.html")
    text = page.read_text(encoding="utf-8")
    missing = [s for s in SECTIONS if f'id="{s}"' not in text]
    if missing:
        raise SystemExit(f"維基條目的小節對不上：{missing}")
    year = date.today().year
    write_json(OUT / "eew.json", indicator_file(
        "eew", "category", [year], {c: [v[0]] for c, v in sorted(EEW.items())},
        hints={c: v[1] for c, v in EEW.items()}, hintsEn={c: v[2] for c, v in EEW.items()},
        license="CC BY-SA 4.0", attribution=f"Wikipedia contributors, “Earthquake early warning system”, revision {REVID}"))
    by_level: dict[int, list[str]] = {}
    for c, (lv, _z, _e) in EEW.items():
        by_level.setdefault(lv, []).append(c)
    print(f"  地震預警：{ {k: sorted(v) for k, v in sorted(by_level.items())} }")
