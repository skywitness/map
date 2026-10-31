"""叫車服務的擴充：無人計程車（第十批順序 179，2026-10-31，製作手冊第一百二十七節）。

使用者 2026-10-30 決定：只收車上沒有安全員、對一般乘客收費的；以實際開始的日期為準，寫法中性（暫停營運也記）。
沒有依城市的現成表格，手工整理成 SERVICES（公司公布的服務城市與開始日期是事實，照連鎖品牌店數的做法）。出處：
- 英文維基「Robotaxi」（revid 1382922653）、「Waymo」（1382926112，服務區的表：狀態、開始日期）、「Apollo Go」（1351784932，
  服務區的表）、「Tesla Robotaxi」（1381652528）、「Zoox」（1382135242，服務區的表），CC BY-SA 4.0，只引用事實；
- 沒有表格的小馬智行、文遠知行與部分日期用公司公告與新聞（SOURCES 的網址，2026-10-31 讀）。
判斷：
- Waymo 用維基表格的開始日期（「Full commercial service」與「Waitlist service」都算：候補名單是逐步開放，也收費），
  舊金山例外：表格寫的 2024-06-25 是取消候補名單的日期，加州公用事業委員會 2023 年 8 月准許無人車收費，那時就開始。
- Tesla 只算沒有車內安全監督員的城市（灣區有監督員，不算）；Zoox 舊金山是免費的邀請制，不算，拉斯維加斯 2026-08-10 起收費。
- 只有安全員、只限員工或受邀者、免費試營運的都不算：Avride（達拉斯，駕駛座有監督員）、Motional（拉斯維加斯，有安全員）、
  文遠知行利雅德（有安全員）。小馬智行在上海浦東、杜拜、薩格勒布的無人收費營運查不到開始日期，沒有放。
- 結束：Cruise 舊金山 2023 年 10 月被加州吊銷許可（之後收掉無人計程車業務），end 是停止的那一年。

輸出（public/data/topics/ride-hailing/）：
- robotaxi.json：點，每個城市每家公司一點（同一城市的幾家公司依公司排成一小圈，免得疊在一起），欄位 y 開始年、mo 開始月、
  end 停止那一年的下一年（前端的 endField：這一年起不畫）、co 公司代碼、note 附註。
- robotaxi-cities.json：各國有無人計程車營運的城市數，2020–2026 年（每年年底，同一城市幾家公司算一個）。
"""
from __future__ import annotations

import math
from collections import defaultdict

from common import OUT_DIR, indicator_file, points_file, write_json, write_manifest_part

OUT = OUT_DIR / "topics" / "ride-hailing"
YEARS = list(range(2020, 2027))

# 公司代碼（前端的 COMPANIES 依這個上色）
COMPANIES = {"waymo": 1, "tesla": 2, "zoox": 3, "cruise": 4, "apollo": 5, "pony": 6, "weride": 7}

# 城市：(國家, 中文, 英文, 經度, 緯度)
CITIES = {
    "phoenix": ("USA", "鳳凰城", "Phoenix", -112.07, 33.45),
    "sf": ("USA", "舊金山灣區", "San Francisco Bay Area", -122.42, 37.77),
    "la": ("USA", "洛杉磯", "Los Angeles", -118.24, 34.05),
    "austin": ("USA", "奧斯汀", "Austin", -97.74, 30.27),
    "atlanta": ("USA", "亞特蘭大", "Atlanta", -84.39, 33.75),
    "miami": ("USA", "邁阿密", "Miami", -80.19, 25.76),
    "orlando": ("USA", "奧蘭多", "Orlando", -81.38, 28.54),
    "nashville": ("USA", "納許維爾", "Nashville", -86.78, 36.16),
    "dallas": ("USA", "達拉斯", "Dallas", -96.80, 32.78),
    "houston": ("USA", "休士頓", "Houston", -95.37, 29.76),
    "denver": ("USA", "丹佛", "Denver", -104.99, 39.74),
    "vegas": ("USA", "拉斯維加斯", "Las Vegas", -115.14, 36.17),
    "sandiego": ("USA", "聖地牙哥", "San Diego", -117.16, 32.72),
    "tampa": ("USA", "坦帕", "Tampa", -82.46, 27.95),
    "sanantonio": ("USA", "聖安東尼奧", "San Antonio", -98.49, 29.42),
    "wuhan": ("CHN", "武漢", "Wuhan", 114.31, 30.59),
    "chongqing": ("CHN", "重慶", "Chongqing", 106.55, 29.56),
    "shenzhen": ("CHN", "深圳", "Shenzhen", 114.06, 22.54),
    "beijing": ("CHN", "北京（亦莊）", "Beijing (Yizhuang)", 116.51, 39.79),
    "guangzhou": ("CHN", "廣州", "Guangzhou", 113.26, 23.13),
    "abudhabi": ("ARE", "阿布達比", "Abu Dhabi", 54.60, 24.49),
    "dubai": ("ARE", "杜拜", "Dubai", 55.27, 25.20),
}

W = "https://en.wikipedia.org/w/index.php?title=Waymo&oldid=1382926112"
SOURCES = {
    "waymo": W,
    "robotaxi": "https://en.wikipedia.org/w/index.php?title=Robotaxi&oldid=1382922653",
    "apollo": "https://en.wikipedia.org/w/index.php?title=Apollo_Go&oldid=1351784932",
    "tesla": "https://en.wikipedia.org/w/index.php?title=Tesla_Robotaxi&oldid=1381652528",
    "zoox": "https://en.wikipedia.org/w/index.php?title=Zoox&oldid=1382135242",
    "beijing": "https://english.beijing.gov.cn/latest/news/202309/t20230921_3263499.html",
    "pony-gz": "https://cnevpost.com/2023/05/29/pony-ai-launches-robotaxi-service-no-safety-officer-shenzhen/",
    "pony-sz": "https://www.prnewswire.com/news-releases/ponyai-granted-shenzhens-first-citywide-permit-for-fully-driverless-commercial-robotaxi-operations-302600723.html",
    "weride": "https://ir.weride.ai/news-releases/news-release-details/weride-and-geely-farizon-deliver-2000-purpose-built-robotaxi-0",
    "weride-ad": "https://www.cnbc.com/2025/11/26/uber-robotaxi-uae-driverless.html",
    "weride-dxb": "https://ir.weride.ai/news-releases/news-release-details/weride-and-uber-launch-fully-driverless-robotaxi-fare-charging",
    "apollo-dxb": "https://www.prnewswire.com/news-releases/baidus-apollo-go-commences-fully-driverless-commercial-ride-hailing-in-dubai-partners-with-dubai-taxi-company-302731365.html",
}

# (城市, 公司, 開始年, 開始月, 結束年或 None, 出處, 中文附註, 英文附註)
SERVICES = [
    ("phoenix", "waymo", 2020, 10, None, "waymo", "2018 年 12 月起有安全員的收費服務，2020 年 10 月起開放一般乘客搭無人的車",
     "Paid rides with safety drivers from December 2018; driverless rides open to the public from October 2020"),
    ("sf", "waymo", 2023, 8, None, "robotaxi", "2023 年 8 月加州公用事業委員會准許無人車收費；2024 年 6 月取消候補名單",
     "Fares for driverless rides approved in August 2023; waitlist removed in June 2024"),
    ("la", "waymo", 2024, 11, None, "waymo", None, None),
    ("austin", "waymo", 2025, 3, None, "waymo", "用 Uber 叫車", "Booked through Uber"),
    ("atlanta", "waymo", 2025, 6, None, "waymo", "用 Uber 叫車", "Booked through Uber"),
    ("miami", "waymo", 2026, 4, None, "waymo", None, None),
    ("orlando", "waymo", 2026, 4, None, "waymo", None, None),
    ("nashville", "waymo", 2026, 6, None, "waymo", "也可以用 Lyft 叫車", "Also bookable through Lyft"),
    ("dallas", "waymo", 2026, 8, None, "waymo", None, None),
    ("houston", "waymo", 2026, 8, None, "waymo", None, None),
    ("denver", "waymo", 2026, 9, None, "waymo", "候補名單逐步開放", "Waitlist service"),
    ("vegas", "waymo", 2026, 9, None, "waymo", "候補名單逐步開放", "Waitlist service"),
    ("sandiego", "waymo", 2026, 10, None, "waymo", None, None),
    ("tampa", "waymo", 2026, 10, None, "waymo", None, None),
    ("sanantonio", "waymo", 2026, 10, None, "waymo", None, None),
    ("austin", "tesla", 2026, 1, None, "tesla", "2025 年 6 月起有車內安全監督員，2026 年 1 月起逐步加入沒有監督員的車",
     "Safety monitors on board from June 2025; unsupervised cars added gradually from January 2026"),
    ("dallas", "tesla", 2026, 4, None, "tesla", None, None),
    ("houston", "tesla", 2026, 4, None, "tesla", None, None),
    ("miami", "tesla", 2026, 7, None, "tesla", None, None),
    ("orlando", "tesla", 2026, 7, None, "tesla", None, None),
    ("tampa", "tesla", 2026, 7, None, "tesla", None, None),
    ("vegas", "zoox", 2026, 8, None, "zoox", "2025 年 9 月起免費試乘，2026 年 8 月 10 日起收費", "Free rides from September 2025; fares from 10 August 2026"),
    ("sf", "cruise", 2022, 6, 2024, "robotaxi", "2023 年 10 月行人被拖行的事故後，加州吊銷許可，停止營運",
     "Stopped after California revoked its permit following an October 2023 crash in which a pedestrian was dragged"),
    ("wuhan", "apollo", 2022, 8, None, "apollo", "中國第一批無安全員的商業營運許可（武漢、重慶）", "China’s first permits for commercial rides without safety drivers (Wuhan and Chongqing)"),
    ("chongqing", "apollo", 2022, 8, None, "apollo", None, None),
    ("shenzhen", "apollo", 2023, 6, None, "apollo", None, None),
    ("beijing", "apollo", 2023, 9, None, "beijing", "北京准許亦莊的無人車收費", "Beijing allowed fares for driverless rides in Yizhuang"),
    ("dubai", "apollo", 2026, 3, None, "apollo-dxb", "2026 年 3 月飛彈攻擊後曾短暫暫停", "Briefly suspended in March 2026 after missile strikes"),
    ("guangzhou", "pony", 2023, 4, None, "pony-gz", "廣州第一張無安全員、可以收費的許可（南沙）", "Guangzhou’s first permit for fare-charging rides without safety drivers (Nansha)"),
    ("beijing", "pony", 2023, 9, None, "beijing", "北京准許亦莊的無人車收費", "Beijing allowed fares for driverless rides in Yizhuang"),
    ("shenzhen", "pony", 2025, 10, None, "pony-sz", "2023 年 5 月起南山區已有無安全員的服務，開始收費的日期查不到，用 2025 年 10 月全市的商業營運許可",
     "Rides without safety officers in Nanshan from May 2023; the date fares began could not be found, so the October 2025 citywide commercial permit is used"),
    ("beijing", "weride", 2025, 2, None, "weride", "公司公告寫 2024 年 10 月推出後約 4 個月開始無人的商業營運", "The company says driverless commercial service began about four months after its October 2024 launch"),
    ("guangzhou", "weride", 2025, 8, None, "weride", None, None),
    ("abudhabi", "weride", 2025, 11, None, "weride-ad", "用 Uber 叫車（亞斯島）", "Booked through Uber (Yas Island)"),
    ("dubai", "weride", 2026, 3, None, "weride-dxb", "用 Uber 叫車；2026 年 3 月飛彈攻擊後曾短暫暫停", "Booked through Uber; briefly suspended in March 2026 after missile strikes"),
]

OFFSET = 0.14  # 同一城市的幾家公司排成的小圈的半徑（度）


def build() -> None:
    by_city: dict[str, list[tuple]] = defaultdict(list)
    for s in SERVICES:
        by_city[s[0]].append(s)
    rows = []
    for city, services in by_city.items():
        iso3, zh, en, lon, lat = CITIES[city]
        n = len(services)
        for k, (_, co, y, mo, end, src, note, note_en) in enumerate(sorted(services, key=lambda s: COMPANIES[s[1]])):
            dx = dy = 0.0
            if n > 1:
                a = 2 * math.pi * k / n + math.pi / 2
                dx, dy = OFFSET * math.cos(a) / math.cos(math.radians(lat)), OFFSET * math.sin(a)
            rows.append({"lon": lon + dx, "lat": lat + dy, "iso3": iso3, "zh": zh, "en": en, "co": COMPANIES[co], "y": y, "mo": mo,
                         "end": end, "src": SOURCES[src], "note": note, "noteEn": note_en})
    rows.sort(key=lambda r: (r["y"], r["mo"]))
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "robotaxi.json", points_file(
        rows, ["lon", "lat", "iso3", "zh", "en", "co", "y", "mo", "end", "src", "note", "noteEn"],
        {"lon": 0.001, "lat": 0.001, "co": 1, "y": 1, "mo": 1, "end": 1}, (), ("iso3", "src"),
    ))
    values: dict[str, list[int | None]] = {}
    for iso3 in sorted({CITIES[c][0] for c in by_city}):
        series = []
        for year in YEARS:
            cities = {s[0] for s in SERVICES if CITIES[s[0]][0] == iso3 and s[2] <= year and (s[4] is None or s[4] > year)}
            series.append(len(cities) or None)
        values[iso3] = series
    write_json(OUT / "robotaxi-cities.json", indicator_file(
        "robotaxi-cities", "cities", YEARS, values,
        noValue={"TWN": "台灣沒有無人計程車的商業營運"}, noValueEn={"TWN": "No commercial robotaxi service in Taiwan"},
    ))
    write_manifest_part(OUT, "ride-hailing", "robotaxi", {
        "license": "facts compiled from Wikipedia (CC BY-SA 4.0) and company announcements",
        "sources": sorted(set(SOURCES.values())),
    })
    print(f"  {len(rows)} 個點、{len(by_city)} 個城市；2026 年各國城市數 {[(c, v[-1]) for c, v in values.items()]}")
