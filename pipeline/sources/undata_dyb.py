"""UNdata 人口統計資料庫（聯合國統計司 Demographic Yearbook 的資料庫，https://data.un.org/）：各國每年的結婚、離婚對數。

- UNdata 的使用條款（https://data.un.org/Host.aspx?Content=UNdataUse）：資料與中繼資料可以自由複製、轉載，
  要註明 UNdata 是來源。unstats.un.org 上的 Demographic Yearbook 表格（PDF、xls）適用聯合國網站的一般條款
  （只限個人、非商業使用，不得轉載），所以用 UNdata 的版本。
- 表 14「Marriages by urban/rural residence」、表 16「Divorces by urban/rural residence」（DataMartId=POP）。
- 2026 年 10 月 UNdata 改版，舊的下載介面（Handlers/DownloadHandler.ashx、DataHandler.ashx）已經停用（回新網站的首頁），
  但 Data.aspx 的網頁仍然在伺服器端產生第一頁（50 筆）：依國家（countryCode）與全國（areaCode:0）篩選，紀錄依年份由新到舊，
  第一頁就是最近的 50 筆，夠用。國家清單取自網頁上的篩選選項。
- 同一年可能同時有依發生日期與依登記日期的紀錄（Record Type），優先用依發生日期（Demographic Yearbook 的慣例）；
  同一種再取資料來源年份（Source Year）最新的。
- 只收登記完整的國家：UNdata 的網頁沒有登記完整度，所以照 Demographic Yearbook 2023 表 23、表 25 的「Code」欄
  （C 是登記涵蓋 90% 以上，U 是不到 90%，「...」是沒有資訊），只用標 C 的國家（COMPLETE）。DYB 自己也只替標 C 的國家算粗率。
  表本身是 unstats.un.org 的檔案（聯合國網站的一般條款，不轉載），這裡只抄下哪些國家標 C，沒有用它的數字。
  沒有出現在 2023 年版表裡的國家（例如赤道幾內亞，2023 年只登記了 243 對）也不收。
- 附註（每一列後面的數字，文字在連結的 title）寫明只涵蓋部分地區或人口的列不收（PARTIAL，例如英國「只有英格蘭與威爾斯」、
  美國的離婚「不含加州……」），含大量來觀光結婚的非居民的國家另外標出（VISITORS，例如庫克群島、塞席爾）。
"""
from __future__ import annotations

import html
import re
import time

import common
from sources.countries import from_numeric

URL = "https://data.un.org/Data.aspx?d=POP&f=tableCode%3a{table}{extra}"
TABLES = {"marriages": 14, "divorces": 16}
ROW = re.compile(r"<tr>(.*?)</tr>", re.S)
CELL = re.compile(r"<t[dh][^>]*>(.*?)</t[dh]>", re.S)
COUNTRY = re.compile(r'value="countryCode%3a(\d+)" name="([^"]*)"')
COLUMNS = ["Country or Area", "Year", "Area", "Record Type", "Reliability", "Source Year", "Value"]
FOOTNOTE = re.compile(r'title="([^"]*)">\d+</a>')
# Demographic Yearbook 2023 表 23（結婚）、表 25（離婚）的 Code 欄標 C（登記完整）的國家
COMPLETE = {
    "marriages": set(
        "ABW AIA ALA ALB AND ARG ARM ASM AUS AUT AZE BEL BGR BIH BLR BMU BRB BRN CAN CHE CHL COK CPV CRI CUB CUW CYM "
        "CYP CZE DEU DMA DNK DOM EGY ESP EST FIN FRA FRO GBR GEO GLP GRC GRL GTM GUF GUM HKG HRV HUN IMN IRL IRN ISL "
        "ISR ITA JOR JPN KAZ KGZ KOR KWT LCA LIE LKA LTU LUX LVA MAC MCO MDA MEX MKD MLT MNE MNG MSR MTQ MUS MYS MYT "
        "NCL NIU NLD NOR NZL PAN PCN PER POL PRI PRT PSE PYF QAT REU ROU SGP SHN SMR SRB SUR SVK SVN SWE SYC TCA TJK "
        "TUR UKR URY USA UZB VCT VEN VGB VNM".split()
    ),
    "divorces": set(
        "ABW ALA ALB AND ARM ASM AUS AUT AZE BEL BGR BIH BLR BMU BRB BRN CAN CHE CRI CUB CUW CYP CZE DEU DMA DNK DOM "
        "EGY ESP EST FIN FRO GBR GEO GRL GTM GUM HRV HUN IMN IRL IRN ISL ISR ITA JOR JPN KAZ KGZ KOR KWT LIE LTU LUX "
        "LVA MAC MCO MDA MEX MKD MLT MNE MNG MUS MYS NLD NOR NZL PAN PCN PER POL PRI PRT PSE QAT ROU SGP SMR SRB SUR "
        "SVK SVN SWE SYC TCA TJK TUR UKR URY USA UZB VCT VEN VGB VNM".split()
    ),
}
# 只涵蓋部分地區或人口的附註（開頭符合就不收那一列）
PARTIAL = (
    "Data refer to England and Wales only",
    "Excluding data for California", "Excluding data for Georgia",
    "Data refer to metropolitan Lima and Callao",
    "Data refer to the island of Tongatapu only",
    "Data refer to Christian marriages only",
    "Data refer to civil divorces only",
    "Data refer to non-indigenous population",
    "Data are marriages reported to the Registration Office",
    "Data refer to the 12 months preceding the census",
)
# 含觀光結婚的非居民：粗結婚率比居民的高很多
VISITORS = ("A high percentage of marriages are non resident marriages", "Including visitors", "Including tourist marriages",
            "Including non-residents")


def _page(table: int, extra: str, name: str) -> str:
    fresh = common.REFRESH or not (common.CACHE_DIR / "undata" / name).exists()
    path = common.download(URL.format(table=table, extra=extra), "undata", name)
    if fresh:
        time.sleep(0.3)  # 第一次下載約 220 頁，每頁之間停一下
    return path.read_text(encoding="utf-8")


def _rows(text: str) -> list[tuple[list[str], list[str]]]:
    """每一列的 (欄位, 附註文字)"""
    table = re.search(r'<div class="DataContainer"><table.*?</table>', text, re.S)
    if not table:
        return []
    rows = [
        ([html.unescape(re.sub(r"<[^>]*>", "", c)).strip() for c in CELL.findall(r)], [html.unescape(t) for t in FOOTNOTE.findall(r)])
        for r in ROW.findall(table.group(0))
    ]
    if not rows or rows[0][0][: len(COLUMNS)] != COLUMNS:
        raise RuntimeError(f"UNdata 的欄位變了：{rows[:1]}")
    return rows[1:]


def counts(kind: str) -> tuple[dict[str, dict[int, float]], set[str]]:
    """({iso3: {年: 對數}}, 含觀光結婚的國家)，kind 是 'marriages' 或 'divorces'。"""
    table = TABLES[kind]
    index = _page(table, "", f"pop-{table}.html")
    countries = sorted(set(COUNTRY.findall(index)), key=lambda c: int(c[0]))
    if len(countries) < 100:
        raise RuntimeError(f"UNdata 表 {table} 只有 {len(countries)} 個國家，網頁格式可能變了")
    out: dict[str, dict[int, float]] = {}
    visitors: set[str] = set()
    for code, _name in countries:
        iso3 = from_numeric(code)
        if not iso3 or iso3 not in COMPLETE[kind]:
            continue
        text = _page(table, f"%3bcountryCode%3a{code}%3bareaCode%3a0", f"pop-{table}-{code}.html")
        best: dict[int, tuple[tuple[int, int], float]] = {}
        for cells, notes in _rows(text):
            _country, year, area, record, _reliability, source_year, value = cells[:7]
            if area != "Total" or not value or any(n.startswith(PARTIAL) for n in notes):
                continue
            if any(n.startswith(VISITORS) for n in notes):
                visitors.add(iso3)
            rank = (0 if "occurrence" in record else 1, -int(source_year))
            y, v = int(year), float(value.replace(",", ""))
            if y not in best or rank < best[y][0]:
                best[y] = (rank, v)
        if best:
            out[iso3] = {y: v for y, (_rank, v) in best.items()}
    return out, visitors
