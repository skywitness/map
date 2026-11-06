"""地鐵與城市軌道：全國通用的月票或免費大眾運輸（2026-11-06，製作手冊第二十三批 409 的後半；步驟 national-passes，
輸出 topics/transport/national-pass.json）。

使用者 2026-11-06 決定：只收有全國或跨城市方案的國家，逐國查官網，分三類；其他國家灰色寫「沒查到全國方案」，不判定沒有；
台灣的 TPASS 算「區域」那一類。下面每一列的日期、價格都是 2026-11-06 用誠實的 User-Agent 讀官網確認的（讀之前先看過
robots.txt），網址寫在 url。官網連 robots.txt 都回 403 的（馬爾他的 infrastructure.gov.mt 與 transport.gov.mt、德國鐵路
int.bahn.de、瑞士 sbb.ch、西班牙 transportes.gob.es）不繞過，改用同一國其他官方網站；馬爾他的開始日期只在
infrastructure.gov.mt，用的是搜尋引擎引用的那一頁原文（「As from 1st October 2022, all citizens and residents in Malta and
Gozo who hold a personalized Tallinja Card…」），程式讀不到。
沒收的：愛沙尼亞的郡公車免費（各郡情形不同、沒查到官方說明）、南韓的 K-Pass（全國通用但是退款回饋，不是月票），寫在說明。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json

OUT = OUT_DIR / "topics" / "transport"
YEAR = 2026
FREE, NATIONAL, PARTIAL = 1, 2, 3

# (ISO3, 類別, 開始日期, 中文說明, 英文說明, 官方網址)
PASSES = [
    ("LUX", FREE, "2020-03-01", "全國大眾運輸免費（巴士、電車、火車；火車頭等艙除外）",
     "All public transport free nationwide (buses, trams, trains; except first class on trains)",
     "https://gouvernement.lu/fr/actualites/toutes_actualites/communiques/2020/02-fevrier/11-mobilite-gratuite.html"),
    ("MLT", FREE, "2022-10-01", "持記名 tallinja 卡的公民與居民搭公車免費（日間、夜間與特別路線）",
     "Free buses (day, night and special routes) for citizens and residents with a personalised tallinja card",
     "https://www.publictransport.com.mt/en/free-travel"),
    ("DEU", NATIONAL, "2023-05-01", "Deutschlandticket：全國地方與區域交通（不含長途車），上路時每月 49 歐元，2026 年 1 月起 63 歐元",
     "Deutschlandticket: all local and regional transport nationwide (not long-distance), €49 a month at launch, €63 from January 2026",
     "https://www.bundesregierung.de/breg-de/aktuelles/deutschlandticket-2134074"),
    ("AUT", NATIONAL, "2021-10-26", "KlimaTicket Ö：全國所有大眾運輸的年票，2026 年 1,400 歐元",
     "KlimaTicket Ö: annual pass for all public transport nationwide, €1,400 in 2026",
     "https://infothek.bmimi.gv.at/klimaticket-oesterreichweit-ab-26-oktober/"),
    ("CHE", NATIONAL, "1898", "Generalabonnement（GA）：1898 年由一個旅客協會與東北鐵路推出，現在是全國火車、公車與城市交通的年票",
     "Generalabonnement (GA): introduced in 1898 by a travellers’ association and the Nordostbahn, now an annual pass for trains, buses and urban transport nationwide",
     "https://www.allianceswisspass.ch/de/asp/News/Newsmeldung?newsid=613"),
    ("HUN", NATIONAL, "2023-05-01", "országbérlet（全國）與 vármegyebérlet（一個州）：火車、Volánbusz 等城際交通 30 天，州票 9,450 福林、全國加倍，不含市內交通",
     "Országbérlet (national) and vármegyebérlet (one county): 30 days on trains, Volánbusz and other intercity services; county pass HUF 9,450, national pass double; local transit not included",
     "https://www.mavcsoport.hu/mav-csoport/korszakalkoto-valtozas-kozossegi-kozlekedesben-jon-uj-varmegyeberlet-es-orszagberlet"),
    ("ESP", NATIONAL, "2026-01-19", "Abono Único：Renfe 的 Cercanías、Media Distancia 與國營長途巴士 30 天 60 歐元（年輕人 30 歐元），不含市內交通",
     "Abono Único: 30 days on Renfe Cercanías, Media Distancia and state-run coaches for €60 (€30 for young people); local transit not included",
     "https://grupo.renfe.com/es/es/sala-de-prensa/noticias/2026/05/renfe-supera-millon-y-medio-viajes-media-distancia-cercanias-abono-unico"),
    ("PRT", PARTIAL, "2024-10-21", "Passe Ferroviário Verde：葡萄牙國鐵 CP 的火車（Alfa Pendular 等除外）通用月票，只限鐵路",
     "Passe Ferroviário Verde: monthly pass for CP trains (except Alfa Pendular and some others), rail only",
     "https://portugal.gov.pt/gc24/comunicacao/noticias/portugueses-aderem-ao-passe-ferroviario-verde"),
    ("TWN", PARTIAL, "2023-07-01", "TPASS 行政院通勤月票：各生活圈的通勤月票（2023 年首波基北北桃 1,200 元、中彰投苗、南高屏），可搭臺鐵、捷運、公車、客運與公共自行車，不是全國通用",
     "TPASS commuter passes: one per metropolitan region (the first, in 2023, Keelung–Taipei–New Taipei–Taoyuan at NT$1,200, plus Taichung and Kaohsiung regions), valid on TRA, metro, buses, coaches and bike share; not nationwide",
     "https://www.ey.gov.tw/Page/9277F759E41CCD91/4b31602c-75ed-4d58-b677-6e26cae86e97"),
]


def build() -> None:
    values = {iso3: [kind] for iso3, kind, *_ in PASSES}
    hints = {iso3: f"{date[:4]} 年起（{date}）：{zh}" if len(date) > 4 else f"{date} 年起：{zh}" for iso3, _, date, zh, _, _ in PASSES}
    hints_en = {iso3: f"Since {date}: {en}" for iso3, _, date, _, en, _ in PASSES}
    write_json(OUT / "national-pass.json", indicator_file(
        "national-pass", "", [YEAR], dict(sorted(values.items())), hints=hints, hintsEn=hints_en))
    for kind, name in ((FREE, "全國免費"), (NATIONAL, "全國通用"), (PARTIAL, "區域或只限鐵路")):
        print(f"  {name}：{[(iso3, date) for iso3, k, date, *_ in PASSES if k == kind]}")
