"""各品牌自己公布的店數（年報、10-K、法說會簡報、官網的店數頁），用來檢查 OpenStreetMap 標了多少（涵蓋率）。

這些是引用的事實（店數、日期、出處），一國一個數字，不是轉載誰的資料庫；地圖上的數值一律是 OSM 的計數，
官方店數只寫在附註與側欄的對照表。2026-10-26 查。

- 能找到公司自己的文件就用文件（primary）；只找到報紙引述公司宣布的數字時，出處寫那家報紙（news）。
- iso3 是元組：公司只公布合計的（7-Eleven, Inc. 的美國＋加拿大、Costco 的美國含波多黎各），OSM 也加總同樣的國家。
"""
from __future__ import annotations

from typing import NamedTuple


class Official(NamedTuple):
    brand: str
    iso3: tuple[str, ...]
    count: int
    #  資料日期（YYYY-MM-DD 或 YYYY-MM）
    asof: str
    #  口徑（中文、英文）；空字串表示就是一般的門市數
    scope: str
    scope_en: str
    source: str
    source_en: str
    url: str
    #  公司只寫約略的數字：'about'（日本肯德基「約 1,335 店」）、'over'（中國麥當勞「超過 7,100 家」）
    qualifier: str = ""


PCSC = ("統一超商 2026 年上半年法說會簡報", "President Chain Store, 1H 2026 investor presentation",
        "https://mopsov.twse.com.tw/nas/STR/291220260916M001.pdf")
FM_TW = ("全家便利商店 2026 年 9 月法說會簡報", "Taiwan FamilyMart, September 2026 investor presentation",
         "https://mopsov.twse.com.tw/nas/STR/590320260916M001.pdf")
SEVEN_I = ("Seven & i Holdings Corporate Outline 2026（各國授權商的店數）", "Seven & i Holdings, Corporate Outline 2026 (licensee store counts)",
           "https://www.7andi.com/en/ir/file/library/co/pdf/2026_all_a_en.pdf")
COSTCO = ("Costco 2026 年 9 月營收新聞稿", "Costco, September 2026 sales results release",
          "https://s201.q4cdn.com/287523651/files/doc_news/Costco-Wholesale-Corporation-Reports-September-Sales-Results-2026.pdf")
SBUX_10K = ("Starbucks FY2025 10-K", "Starbucks FY2025 Form 10-K",
            "https://www.sec.gov/Archives/edgar/data/829224/000082922425000114/sbux-20250928.htm")
LAWSON = ("Lawson 店舗數", "Lawson, store counts", "https://www.lawson.co.jp/company/corporate/data/sales/")


def _o(brand, iso3, count, asof, source, scope=("", ""), qualifier="") -> Official:
    if isinstance(iso3, str):
        iso3 = (iso3,)
    return Official(brand, iso3, count, asof, scope[0], scope[1], source[0], source[1], source[2], qualifier)


OFFICIAL: list[Official] = [
    # 台灣
    _o("7-eleven", "TWN", 7334, "2026-06-30", PCSC),
    _o("familymart", "TWN", 4504, "2026-06", FM_TW),
    _o("starbucks", "TWN", 600, "2026-05-19",
       ("經濟日報報導統一星巴克宣布門市突破 600 家", "Economic Daily News, reporting Starbucks Taiwan passing 600 stores",
        "https://blog.104.com.tw/taiwans-top-three-coffee-chain-brands-plans-for-2026/"), qualifier="over"),
    _o("mcdonalds", "TWN", 430, "2025-12",
       ("經濟日報報導台灣麥當勞的店數", "Economic Daily News, reporting McDonald's Taiwan store count",
        "https://blog.104.com.tw/store-expansion-plans-of-4-major-fast-food-brands-2026/")),
    _o("kfc", "TWN", 200, "2026-02-03",
       ("工商時報報導肯德基第 200 家門市開幕", "Commercial Times, reporting KFC Taiwan's 200th store opening",
        "https://www.ctee.com.tw/news/20260203701446-430503")),
    _o("ikea", "TWN", 8, "2025-12-31",
       ("DFI Retail Group 2025 年報（台灣的家具門市就是 IKEA）", "DFI Retail Group Annual Report 2025 (its home furnishings outlets in Taiwan are IKEA)",
        "https://links.sgx.com/1.0.0/corporate-announcements/7J5PGFVRV0E9I9UD/878940_DFI_Annual%20Report%202025_locked.pdf")),
    _o("costco", "TWN", 14, "2026-10-07", COSTCO, ("賣場", "warehouses")),
    # 日本
    _o("7-eleven", "JPN", 21956, "2026-09-30",
       ("セブン-イレブン・ジャパン 國內店舗數", "Seven-Eleven Japan, domestic store count", "https://www.sej.co.jp/company/tenpo.html"),
       ("含沖繩", "incl. Okinawa")),
    _o("familymart", "JPN", 16466, "2026-09-30",
       ("ファミリーマート 店舗數", "FamilyMart, store count", "https://www.family.co.jp/company/familymart/store.html")),
    _o("lawson", "JPN", 14697, "2026-02-28", LAWSON, ("含 Natural Lawson、Lawson Store 100", "incl. Natural Lawson and Lawson Store 100")),
    _o("mcdonalds", "JPN", 3047, "2026-09-30",
       ("日本麥當勞控股 月次店舗數", "McDonald's Holdings Japan, monthly sales report", "https://www.mcd-holdings.co.jp/ir/sales_report/")),
    _o("starbucks", "JPN", 2116, "2026-03-31",
       ("スターバックス コーヒー ジャパン 会社概要", "Starbucks Coffee Japan, company profile", "https://www.starbucks.co.jp/company/summary/"),
       ("含 201 家授權門市", "incl. 201 licensed stores")),
    _o("kfc", "JPN", 1335, "2026-03-31",
       ("日本肯德基的公司簡介（Mynavi 徵才頁）", "KFC Japan company profile (Mynavi recruiting page)",
        "https://job.mynavi.jp/27/pc/search/corp208646/outline.html"), qualifier="about"),
    _o("costco", "JPN", 37, "2026-10-07", COSTCO, ("賣場", "warehouses")),
    # 美國
    _o("mcdonalds", "USA", 13706, "2025-12-31",
       ("McDonald's FY2025 10-K", "McDonald's FY2025 Form 10-K",
        "https://www.sec.gov/Archives/edgar/data/63908/000006390826000035/mcd-20251231.htm")),
    _o("starbucks", "USA", 16933, "2026-06-28",
       ("Starbucks 2026 會計年度第三季財報", "Starbucks Q3 FY2026 earnings release",
        "https://www.sec.gov/Archives/edgar/data/0000829224/000082922426000129/sbux-06282026xearningsrele.htm"),
       ("直營＋授權", "company-operated + licensed")),
    _o("kfc", "USA", 3482, "2026-03-31",
       ("Yum! Brands 2026 年第一季店數變動表", "Yum! Brands Q1 2026 unit count",
        "https://s2.q4cdn.com/890585342/files/doc_financials/2026/q1/Q1-2026-Unit-Count-Cause-of-Change-YTD_Dist-Copy.pdf")),
    _o("subway", "USA", 18773, "2025-12",
       ("Restaurant Dive 引述 Subway 2026 年的加盟揭露文件", "Restaurant Dive, citing Subway's 2026 franchise disclosure document",
        "https://finance.yahoo.com/markets/stocks/articles/subway-closed-least-729-stores-105300180.html")),
    _o("costco", ("USA", "PRI"), 647, "2026-10-07", COSTCO, ("賣場，含波多黎各", "warehouses, incl. Puerto Rico")),
    _o("ikea", "USA", 52, "2025-08-31",
       ("IKEA US FY25 Annual Summary", "IKEA US FY25 Annual Summary",
        "https://www.ikea.com/us/en/files/pdf/41/77/4177d8c1/us_annual_summary_fy25.pdf"),
       ("門市，不含 18 個規劃訂購點、42 個取貨點", "stores, excl. 18 plan & order points and 42 pick-up locations")),
    _o("7-eleven", ("USA", "CAN"), 12712, "2025-12-31", SEVEN_I,
       ("7-Eleven, Inc. 的美國＋加拿大合計，不含 7-Eleven Hawaii", "7-Eleven, Inc., U.S. and Canada combined, excl. 7-Eleven Hawaii")),
    # 其他國家
    _o("7-eleven", "THA", 15945, "2025-12-31", SEVEN_I, ("CP ALL", "CP ALL")),
    _o("7-eleven", "KOR", 11040, "2025-12-31", SEVEN_I, ("Korea Seven", "Korea Seven")),
    _o("7-eleven", "PHL", 4491, "2025-12-31", PCSC, ("Philippine Seven", "Philippine Seven")),
    _o("lawson", "CHN", 6977, "2026-02-28", LAWSON),
    _o("starbucks", "CHN", 7991, "2026-03-29",
       ("Starbucks 2026 會計年度第二季財報", "Starbucks Q2 FY2026 earnings release",
        "https://www.sec.gov/Archives/edgar/data/0000829224/000082922426000078/sbux-03292026xearningsrele.htm"),
       ("直營", "company-operated")),
    _o("starbucks", "KOR", 2077, "2025-09-28", SBUX_10K, ("授權", "licensed")),
    _o("starbucks", "CAN", 1447, "2025-09-28", SBUX_10K, ("直營 967＋授權 480", "967 company-operated + 480 licensed")),
    _o("kfc", "CHN", 13789, "2026-06-30",
       ("百勝中國 2026 年第二季財報", "Yum China Q2 2026 earnings release",
        "https://www.sec.gov/Archives/edgar/data/0001673358/000119312526324793/yumc-ex99_1.htm")),
    _o("mcdonalds", "CHN", 7100, "2025-06",
       ("新京報報導麥當勞中國的店數", "Beijing News, reporting McDonald's China store count",
        "https://m.bjnews.com.cn/detail/1754901240168729.html"), qualifier="over"),
    *[
        _o("costco", iso3, n, "2026-10-07", COSTCO, ("賣場", "warehouses"))
        for iso3, n in [("CAN", 115), ("MEX", 43), ("GBR", 29), ("KOR", 20), ("AUS", 15), ("CHN", 7),
                        ("ESP", 5), ("FRA", 3), ("SWE", 2), ("ISL", 1), ("NZL", 1)]
    ],
]
