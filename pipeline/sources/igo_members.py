"""16 個國際組織歷年的成員、申請／加入中、夥伴／觀察員與暫停參與（手工整理）。

沒有一份開放資料同時有這些組織的成員與加入日期，所以依各組織官網的成員名單整理成這張表（2026-10-23 查閱，
網址見各組織的 SOURCES）。官網擋自動抓取或沒有列日期的（OECD、東協、OPEC、阿拉伯國家聯盟），
依官方文件與新聞稿整理，再跟英文維基百科的成員國條目交叉比對。成員與日期是事實，表是自己整理的。

每一段是 (狀態, 開始, 結束, 種類)：
- 狀態：MEMBER 成員、SUSPENDED 暫停參與（仍是成員，被組織暫停）、CANDIDATE 申請或加入中、PARTNER 夥伴或觀察員。
- 日期是 'YYYY-MM-DD'，不知道日的寫 'YYYY-MM'，只知道年的寫 'YYYY'；結束 None = 至今。結束日不含（那天起就不是了）。
- 種類：同一個狀態再細分（申請、候選國、受邀、已簽署待生效…；觀察員、對話夥伴、和平夥伴關係…），
  側欄顯示用，文字在 src/topics/organizations.ts 的 KINDS。

規則（DESIGN.md 第 8 節「國際組織」）：
- 地圖用今天的國家：一個國家獨立或加入以前算非成員，即使那塊土地當時屬於某個成員國
  （1971 年以前的孟加拉、2011 年以前的南蘇丹）；分裂、合併、改名由今天的國家承接（德國 1990 年以前是西德、
  葉門 1990 年以前是北葉門、坦尚尼亞是坦干伊加）。
- 前身組織：歐盟從 1958 年的歐洲經濟共同體算起（2009 年里斯本條約明定歐盟取代並承接歐洲共同體）；
  非洲聯盟從 1963 年的非洲團結組織算起；WTO 從 1995 年算起，不畫 GATT（1948–1994）；
  OECD 從 1961 年算起，不畫前身歐洲經濟合作組織（OEEC）；上海合作組織從 2001 年算起，不畫上海五國（1996）；
  大英國協從 1949 年倫敦宣言算起；G7 含 1998–2014 年的 G8（俄羅斯）。
- 組織自己暫停會員（非洲聯盟、阿拉伯國家聯盟、大英國協）算「暫停參與」；OPEC 會員自己「暫停會籍」
  （印尼、厄瓜多）是實際上退出，算非成員。
"""
from __future__ import annotations

MEMBER, SUSPENDED, CANDIDATE, PARTNER = "m", "s", "c", "p"
Period = tuple[str, str, "str | None", "str | None"]

ACCESSED = "2026-10-23"


def M(start: str, end: str | None = None, kind: str | None = None) -> Period:
    return (MEMBER, start, end, kind)


def S(start: str, end: str | None = None, kind: str | None = None) -> Period:
    return (SUSPENDED, start, end, kind)


def C(start: str, end: str | None = None, kind: str | None = "applied") -> Period:
    return (CANDIDATE, start, end, kind)


def P(start: str, end: str | None = None, kind: str | None = None) -> Period:
    return (PARTNER, start, end, kind)


def _table(*rows: tuple[str, list[Period] | Period]) -> dict[str, list[Period]]:
    """(以空白分隔的 ISO 代碼, 一段或好幾段) → {代碼: [段…]}；同一個代碼可以出現好幾次"""
    out: dict[str, list[Period]] = {}
    for ids, periods in rows:
        if isinstance(periods, tuple):
            periods = [periods]
        for iso3 in ids.split():
            out.setdefault(iso3, []).extend(periods)
    return out


# ── 組織：資料的第一年、官方來源（網址, 查閱日期） ───────────────────
ORDER = [
    "eu", "nato", "asean", "oecd", "g7", "g20", "brics", "cptpp", "rcep",
    "au", "opec", "commonwealth", "arab-league", "sco", "wto", "apec",
]

FIRST_YEAR = {
    "eu": 1958, "nato": 1949, "asean": 1967, "oecd": 1961, "g7": 1975, "g20": 1999, "brics": 2009,
    "cptpp": 2018, "rcep": 2020, "au": 1963, "opec": 1960, "commonwealth": 1949, "arab-league": 1945,
    "sco": 2001, "wto": 1995, "apec": 1989,
}

# 查閱日期都是 ACCESSED；註明「無法自動讀取」的網頁是用瀏覽器以外的方式（新聞稿、官方文件）確認的
SOURCES: dict[str, list[str]] = {
    "eu": [
        "https://european-union.europa.eu/principles-countries-history/eu-countries_en",
        "https://enlargement.ec.europa.eu/enlargement-policy/candidate-countries-and-potential-candidates_en",
    ],
    "nato": [
        "https://www.nato.int/cps/en/natohq/topics_52044.htm",  # 成員與加入年份（2024-03 更新）
        "https://www.nato.int/cps/en/natohq/topics_82584.htm",  # 和平夥伴關係的簽署日期
        "https://www.nato.int/cps/en/natohq/topics_84336.htm",  # 夥伴（2025-05 更新：俄羅斯、白俄羅斯暫停）
        "https://www.nato.int/cps/en/natohq/topics_52927.htm",  # 地中海對話
        "https://www.nato.int/cps/en/natohq/topics_52956.htm",  # 伊斯坦堡合作倡議
        "https://www.nato.int/cps/en/natohq/topics_49188.htm",  # 全球夥伴
        "https://www.nato.int/cps/en/natohq/topics_49119.htm",  # 白俄羅斯（2021-11 暫停實際合作）
    ],
    "asean": [
        "https://asean.org/wp-content/uploads/2026/05/ASEAN-External-Relations-Coordinatorship-as-of-May-2026.pdf",
        "https://asean.org/forging-a-new-era-timor-leste-admitted-into-asean/",
    ],
    "oecd": [
        "https://www.oecd.org/en/about/members-partners.html",  # 擋自動讀取；38 國、8 個候選國依 C/MIN(2026)2
        "https://one.oecd.org/document/C/MIN(2026)2/en/pdf",
    ],
    "g7": ["http://www.g7.utoronto.ca/what_is_g8.html"],  # G7 沒有常設網站，用多倫多大學 G7 研究組
    "g20": ["https://g20.org/about-g20/"],
    "brics": ["https://www.brics2026.gov.in/"],
    "cptpp": [
        "https://www.mfat.govt.nz/en/trade/free-trade-agreements/free-trade-agreements-in-force/cptpp/cptpp-accession",
        "https://www.gov.uk/government/publications/cptpp-joint-ministerial-statement-from-the-10th-commission-meeting-26-june-2026",
    ],
    "rcep": [
        "https://www.meti.gov.sg/trade-international-economic-relations/agreements/free-trade-agreements-fta/rcep/",
        "https://www.info.gov.hk/gia/general/202609/21/P2026092100784.htm",  # 2026-09-21 成立加入工作小組
    ],
    "au": [
        "https://au.int/en/member_states/countryprofiles2",
        "https://www.peaceau.org/en/article/communique-of-the-1325th-meeting-of-the-psc-held-on-22-january-2026-on-consideration-of-the-political-transition-in-the-republic-of-guinea",
    ],
    "opec": ["https://www.opec.org/opec_web/en/about_us/25.htm"],  # 擋自動讀取
    "commonwealth": ["https://thecommonwealth.org/our-member-countries"],
    "arab-league": ["http://www.lasportal.org/"],  # 連不上；日期依英文維基百科「Member states of the Arab League」
    "sco": ["https://eng.sectsco.org/20170109/192193.html"],
    "wto": [
        "https://www.wto.org/english/thewto_e/whatis_e/tif_e/org6_e.htm",
        "https://www.wto.org/english/thewto_e/acc_e/completeacc_e.htm",
        "https://www.wto.org/english/thewto_e/acc_e/status_e.htm",
    ],
    "apec": ["https://apec.org/who-we-are/our-members"],
}

# ── 地圖上的地方 ──────────────────────────────────────────
# 不是主權國家的地區（海外領地、自治地區、主權國家另外畫出的部分、爭議地區）：只在表裡有它的組織上色。
# - 自己有參加的：香港、澳門（WTO、APEC、RCEP）、庫拉索（WTO）、撒拉威阿拉伯民主共和國（非洲聯盟，畫在西撒哈拉）。
# - 歐盟的格陵蘭（1973–1985 年隨丹麥在歐洲共同體內）與法羅群島（從未加入），看得出跟丹麥不同。
# 其他的不畫：格陵蘭隨丹麥參加北約、法屬圭亞那是歐盟的一部分，但另外塗色的話，圖例的數字（地圖上的國家／地區數）
# 就跟成員數對不上（歐盟會變成 34 個、北約 41 個）。法國海外省等歐盟最外圍地區寫在附註與 tooltip。
DEPENDENCIES = {
    "ABW", "AIA", "ALA", "ASM", "ATA", "ATF", "BES", "BLM", "BMU", "BVT", "CCK", "CUW", "CXR", "CYM", "ESH", "FLK",
    "FRO", "GGY", "GIB", "GLP", "GRL", "GUF", "GUM", "HKG", "HMD", "IMN", "IOT", "JEY", "MAC", "MAF", "MNP", "MSR",
    "MTQ", "MYT", "NCL", "NFK", "PCN", "PRI", "PYF", "REU", "SGS", "SHN", "SJM", "SPM", "SXM", "TCA", "TKL", "UMI",
    "VGB", "VIR", "WLF", "_CYN", "_IOT", "_SIA", "_SOL",
}
# 主權國家本身的一部分（不是屬地）：側欄寫「隨〇〇參加」
PART_OF = {
    "GRL": "DNK", "FRO": "DNK", "ALA": "FIN", "SJM": "NOR",
    "GUF": "FRA", "GLP": "FRA", "MTQ": "FRA", "REU": "FRA", "MYT": "FRA",
}
# 「參加幾個組織」只算主權國家，加上自己是成員的香港、澳門、撒拉威
COUNT_OWN = {"HKG", "MAC", "ESH"}

# ── 歐盟（1958 年歐洲經濟共同體 → 1993 年歐洲聯盟） ──────────────
EU = _table(
    ("BEL FRA DEU ITA LUX NLD", M("1958-01-01")),
    ("DNK IRL", [C("1961-08-10", "1963-01-29"), C("1967-05-11", "1973-01-01"), M("1973-01-01")]),
    ("GBR", [C("1961-08-10", "1963-01-29"), C("1967-05-11", "1973-01-01"), M("1973-01-01", "2020-01-31")]),
    ("NOR", [C("1962-04-30", "1963-01-29"), C("1967-07-24", "1972-09-25"), C("1992-11-25", "1994-11-28")]),
    ("GRC", [C("1975-06-12", "1981-01-01"), M("1981-01-01")]),
    ("PRT", [C("1977-03-28", "1986-01-01"), M("1986-01-01")]),
    ("ESP", [C("1977-07-28", "1986-01-01"), M("1986-01-01")]),
    ("TUR", [C("1987-04-14", "1999-12-11"), C("1999-12-11", None, "candidate")]),
    ("AUT", [C("1989-07-17", "1995-01-01"), M("1995-01-01")]),
    ("SWE", [C("1991-07-01", "1995-01-01"), M("1995-01-01")]),
    ("FIN", [C("1992-03-18", "1995-01-01"), M("1995-01-01")]),
    ("CHE", C("1992-05-26", "1992-12-06")),
    ("CYP", [C("1990-07-03", "2004-05-01"), M("2004-05-01")]),
    ("MLT", [C("1990-07-16", "1996-11"), C("1998-09-10", "2004-05-01"), M("2004-05-01")]),
    ("HUN", [C("1994-03-31", "2004-05-01"), M("2004-05-01")]),
    ("POL", [C("1994-04-05", "2004-05-01"), M("2004-05-01")]),
    ("SVK", [C("1995-06-27", "2004-05-01"), M("2004-05-01")]),
    ("LVA", [C("1995-10-13", "2004-05-01"), M("2004-05-01")]),
    ("EST", [C("1995-11-24", "2004-05-01"), M("2004-05-01")]),
    ("LTU", [C("1995-12-08", "2004-05-01"), M("2004-05-01")]),
    ("CZE", [C("1996-01-17", "2004-05-01"), M("2004-05-01")]),
    ("SVN", [C("1996-06-10", "2004-05-01"), M("2004-05-01")]),
    ("ROU", [C("1995-06-22", "2007-01-01"), M("2007-01-01")]),
    ("BGR", [C("1995-12-14", "2007-01-01"), M("2007-01-01")]),
    ("HRV", [C("2003-02-21", "2004-06-18"), C("2004-06-18", "2013-07-01", "candidate"), M("2013-07-01")]),
    ("MKD", [C("2004-03-22", "2005-12-17"), C("2005-12-17", None, "candidate")]),
    ("MNE", [C("2008-12-15", "2010-12-17"), C("2010-12-17", None, "candidate")]),
    ("ALB", [C("2009-04-28", "2014-06-27"), C("2014-06-27", None, "candidate")]),
    ("ISL", [C("2009-07-16", "2010-06-17"), C("2010-06-17", "2015-03-12", "candidate")]),
    ("SRB", [C("2009-12-22", "2012-03-01"), C("2012-03-01", None, "candidate")]),
    ("BIH", [C("2016-02-15", "2022-12-15"), C("2022-12-15", None, "candidate")]),
    ("UKR", [C("2022-02-28", "2022-06-23"), C("2022-06-23", None, "candidate")]),
    ("MDA", [C("2022-03-03", "2022-06-23"), C("2022-06-23", None, "candidate")]),
    ("GEO", [C("2022-03-03", "2023-12-14"), C("2023-12-14", None, "candidate")]),
    ("XKX", C("2022-12-15", None, "potential")),
    # 丹麥王國的一部分，但不在歐盟內（格陵蘭 1985 年退出，法羅群島從未加入）
    ("GRL", M("1973-01-01", "1985-02-01")),
    ("FRO", []),
)

# ── 北大西洋公約組織 ─────────────────────────────────────
NATO = _table(
    ("BEL CAN DNK FRA ISL ITA LUX NLD NOR PRT GBR USA", M("1949-08-24")),
    ("GRC TUR", [C("1951-10-22", "1952-02-18", "invited"), M("1952-02-18")]),
    ("DEU", [C("1954-10-23", "1955-05-06", "invited"), M("1955-05-06")]),
    ("ESP", [C("1981-12-10", "1982-05-30", "invited"), M("1982-05-30")]),
    ("CZE", [P("1994-03-10", "1997-07-08", "pfp"), C("1997-07-08", "1999-03-12", "invited"), M("1999-03-12")]),
    ("HUN", [P("1994-02-08", "1997-07-08", "pfp"), C("1997-07-08", "1999-03-12", "invited"), M("1999-03-12")]),
    ("POL", [P("1994-02-02", "1997-07-08", "pfp"), C("1997-07-08", "1999-03-12", "invited"), M("1999-03-12")]),
    ("BGR", [P("1994-02-14", "1999-04-24", "pfp"), C("1999-04-24", "2004-03-29", "map"), M("2004-03-29")]),
    ("EST", [P("1994-02-03", "1999-04-24", "pfp"), C("1999-04-24", "2004-03-29", "map"), M("2004-03-29")]),
    ("LVA", [P("1994-02-14", "1999-04-24", "pfp"), C("1999-04-24", "2004-03-29", "map"), M("2004-03-29")]),
    ("LTU", [P("1994-01-27", "1999-04-24", "pfp"), C("1999-04-24", "2004-03-29", "map"), M("2004-03-29")]),
    ("ROU", [P("1994-01-26", "1999-04-24", "pfp"), C("1999-04-24", "2004-03-29", "map"), M("2004-03-29")]),
    ("SVK", [P("1994-02-09", "1999-04-24", "pfp"), C("1999-04-24", "2004-03-29", "map"), M("2004-03-29")]),
    ("SVN", [P("1994-03-30", "1999-04-24", "pfp"), C("1999-04-24", "2004-03-29", "map"), M("2004-03-29")]),
    ("ALB", [P("1994-02-23", "1999-04-24", "pfp"), C("1999-04-24", "2009-04-01", "map"), M("2009-04-01")]),
    ("MKD", [P("1995-11-15", "1999-04-24", "pfp"), C("1999-04-24", "2020-03-27", "map"), M("2020-03-27")]),
    ("HRV", [P("2000-05-25", "2002-05-14", "pfp"), C("2002-05-14", "2009-04-01", "map"), M("2009-04-01")]),
    ("MNE", [P("2006-12-14", "2009-12-04", "pfp"), C("2009-12-04", "2017-06-05", "map"), M("2017-06-05")]),
    ("BIH", [P("2006-12-14", "2010-04-22", "pfp"), C("2010-04-22", None, "map")]),
    ("GEO", [P("1994-03-23", "2008-04-03", "pfp"), C("2008-04-03", None, "aspirant")]),
    ("UKR", [
        P("1994-02-08", "2008-04-03", "pfp"), C("2008-04-03", "2010-07-01", "aspirant"), P("2010-07-01", "2014-12-23", "pfp"),
        C("2014-12-23", "2022-09-30", "aspirant"), C("2022-09-30", None, "applied"),
    ]),
    ("FIN", [P("1994-05-09", "2022-05-18", "pfp"), C("2022-05-18", "2023-04-04"), M("2023-04-04")]),
    ("SWE", [P("1994-05-09", "2022-05-18", "pfp"), C("2022-05-18", "2024-03-07"), M("2024-03-07")]),
    # 和平夥伴關係（PfP）
    ("MDA", P("1994-03-16", None, "pfp")),
    ("AZE", P("1994-05-04", None, "pfp")),
    ("TKM", P("1994-05-10", None, "pfp")),
    ("KAZ", P("1994-05-27", None, "pfp")),
    ("KGZ", P("1994-06-01", None, "pfp")),
    ("RUS", P("1994-06-22", "2014-04-01", "pfp")),
    ("UZB", P("1994-07-13", None, "pfp")),
    ("ARM", P("1994-10-05", None, "pfp")),
    ("BLR", P("1995-01-11", "2021-11-19", "pfp")),
    ("AUT", P("1995-02-10", None, "pfp")),
    ("MLT", [P("1995-04-26", "1996-10", "pfp"), P("2008-04-03", None, "pfp")]),
    ("CHE", P("1996-12-11", None, "pfp")),
    ("IRL", P("1999-12-01", None, "pfp")),
    ("TJK", P("2002-02-20", None, "pfp")),
    ("SRB", P("2006-12-14", None, "pfp")),
    # 地中海對話、伊斯坦堡合作倡議
    ("EGY ISR MRT MAR TUN", P("1995-02", None, "md")),
    ("JOR", P("1995-11", None, "md")),
    ("DZA", P("2000-03", None, "md")),
    ("BHR KWT QAT", P("2005", None, "ici")),
    ("ARE", P("2005-06", None, "ici")),
    # 全球夥伴：年份用 2011 年新夥伴政策（柏林），實際合作更早
    ("AUS JPN KOR NZL MNG PAK IRQ", P("2011-04", None, "global")),
    ("AFG", P("2011-04", "2021-08-15", "global")),
    ("COL", P("2017-05-18", None, "global")),
)

# ── 東南亞國家協會 ────────────────────────────────────────
ASEAN = _table(
    ("IDN MYS PHL SGP THA", M("1967-08-08")),
    ("BRN", M("1984-01-07")),
    ("VNM", M("1995-07-28")),
    ("LAO MMR", M("1997-07-23")),
    ("KHM", [C("1997-05-31", "1999-04-30", "invited"), M("1999-04-30")]),
    ("TLS", [C("2011-03-04", "2022-11-11"), C("2022-11-11", "2025-10-26", "inprinciple"), M("2025-10-26")]),
    ("PNG", P("1976", None, "observer")),
    # 對話夥伴（歐盟也是，不在地圖上）
    ("AUS", P("1974", None, "dialogue")),
    ("NZL", P("1975", None, "dialogue")),
    ("CAN JPN USA", P("1977", None, "dialogue")),
    ("KOR", [P("1989", "1991", "sectoral"), P("1991", None, "dialogue")]),
    ("CHN RUS", [P("1991", "1996", "consultative"), P("1996", None, "dialogue")]),
    ("IND", [P("1993", "1996", "sectoral"), P("1996", None, "dialogue")]),
    ("GBR", P("2021-08-05", None, "dialogue")),
    ("TUR", [P("2017-08-05", "2026-07", "sectoral"), P("2026-07", None, "dialogue")]),
    # 部門對話夥伴；巴西、丹麥是查得到的最早年份（東協 2024-09 的巴西關係概況、2026-05 的名單）
    ("PAK", P("1993", None, "sectoral")),
    ("NOR", P("2015", None, "sectoral")),
    ("CHE", P("2016", None, "sectoral")),
    ("MAR ZAF ARE", P("2023-09-04", None, "sectoral")),
    ("BRA", P("2024", None, "sectoral")),
    ("DNK", P("2026", None, "sectoral")),
    ("DEU QAT", P("2026-07", None, "sectoral")),
)

# ── 經濟合作暨發展組織（公約 1961-09-30 生效；日期是各國存放批准書的日期） ─────
OECD = _table(
    ("CAN", M("1961-04-10")),
    ("USA", M("1961-04-12")),
    ("GBR", M("1961-05-02")),
    ("DNK", M("1961-05-30")),
    ("ISL", M("1961-06-05")),
    ("NOR", M("1961-07-04")),
    ("TUR", M("1961-08-02")),
    ("ESP", M("1961-08-03")),
    ("PRT", M("1961-08-04")),
    ("FRA", M("1961-08-07")),
    ("IRL", M("1961-08-17")),
    ("BEL", M("1961-09-13")),
    ("DEU GRC", M("1961-09-27")),
    ("SWE CHE", M("1961-09-28")),
    ("AUT", M("1961-09-29")),
    ("NLD", M("1961-11-13")),
    ("LUX", M("1961-12-07")),
    ("ITA", M("1962-03-29")),
    ("JPN", M("1964-04-28")),
    ("FIN", M("1969-01-28")),
    ("AUS", M("1971-06-07")),
    ("NZL", M("1973-05-29")),
    ("MEX", M("1994-05-18")),
    ("CZE", M("1995-12-21")),
    ("HUN", M("1996-05-07")),
    ("POL", M("1996-11-22")),
    ("KOR", M("1996-12-12")),
    ("SVK", M("2000-12-14")),
    ("CHL", [C("2007-05-16", "2010-05-07", "accession"), M("2010-05-07")]),
    ("SVN", [C("2007-05-16", "2010-07-21", "accession"), M("2010-07-21")]),
    ("ISR", [C("2007-05-16", "2010-09-07", "accession"), M("2010-09-07")]),
    ("EST", [C("2007-05-16", "2010-12-09", "accession"), M("2010-12-09")]),
    ("RUS", C("2007-05-16", "2014-03-13", "accession")),
    ("LVA", [C("2013-05-30", "2016-07-01", "accession"), M("2016-07-01")]),
    ("COL", [C("2013-05-30", "2020-04-28", "accession"), M("2020-04-28")]),
    ("LTU", [C("2015-04-09", "2018-07-05", "accession"), M("2018-07-05")]),
    ("CRI", [C("2015-04-09", "2021-05-25", "accession"), M("2021-05-25")]),
    ("ARG BGR HRV PER ROU", C("2022-01-25", None, "accession")),
    ("BRA", [P("2007-05-16", "2022-01-25", "key"), C("2022-01-25", None, "accession")]),
    ("IDN", [P("2007-05-16", "2024-02-20", "key"), C("2024-02-20", None, "accession")]),
    ("THA", C("2024-06", None, "accession")),
    ("CHN IND ZAF", P("2007-05-16", None, "key")),
)

# ── 七大工業國集團（1998–2014 年含俄羅斯為 G8） ──────────────────
G7 = _table(
    ("FRA DEU ITA JPN GBR USA", M("1975-11-15")),
    ("CAN", M("1976-06-27")),
    ("RUS", M("1998-05-15", "2014-03-24", "g8")),
)

# ── 二十國集團 ───────────────────────────────────────────
G20 = _table(
    ("ARG AUS BRA CAN CHN FRA DEU IND IDN ITA JPN KOR MEX RUS SAU ZAF TUR GBR USA", M("1999-09-25")),
    ("ESP", P("2008-11-15", None, "guest")),
)

# ── 金磚國家 ─────────────────────────────────────────────
BRICS = _table(
    ("BRA RUS IND CHN", M("2009-06-16")),
    ("ZAF", M("2010-12-24")),
    ("EGY ETH IRN ARE", [C("2023-08-24", "2024-01-01", "invited"), M("2024-01-01")]),
    ("SAU", C("2023-08-24", None, "invited")),
    ("ARG", C("2023-08-24", "2023-12-29", "invited")),
    ("IDN", [C("2024-10-24", "2025-01-06"), M("2025-01-06")]),
    ("BLR BOL KAZ CUB MYS THA UGA UZB", P("2025-01-01", None, "partner")),
    ("NGA", P("2025-01-17", None, "partner")),
    ("VNM", P("2025-06-13", None, "partner")),
)

# ── 跨太平洋夥伴全面進步協定（2018-03-08 簽署；存放國紐西蘭） ─────────────
CPTPP = _table(
    ("AUS CAN JPN MEX NZL SGP", [C("2018-03-08", "2018-12-30", "signed"), M("2018-12-30")]),
    ("VNM", [C("2018-03-08", "2019-01-14", "signed"), M("2019-01-14")]),
    ("PER", [C("2018-03-08", "2021-09-19", "signed"), M("2021-09-19")]),
    ("MYS", [C("2018-03-08", "2022-11-29", "signed"), M("2022-11-29")]),
    ("CHL", [C("2018-03-08", "2023-02-21", "signed"), M("2023-02-21")]),
    ("BRN", [C("2018-03-08", "2023-07-12", "signed"), M("2023-07-12")]),
    ("GBR", [C("2021-02-01", "2021-06-02"), C("2021-06-02", "2024-12-15", "accession"), M("2024-12-15")]),
    ("CHN", C("2021-09-16")),
    ("TWN", C("2021-09-22")),
    ("ECU", C("2021-12-17")),
    ("CRI", [C("2022-08-10", "2024-11-28"), C("2024-11-28", None, "accession")]),
    ("URY", [C("2022-12-01", "2025-11-21"), C("2025-11-21", None, "accession")]),
    ("UKR", C("2023-05-05")),
    ("IDN", C("2024-09-25")),
    ("PHL", C("2025-08")),
    ("ARE", C("2025-08-22")),
    ("ARG", C("2026-06-03")),
)

# ── 區域全面經濟夥伴協定（2020-11-15 簽署） ─────────────────────
RCEP = _table(
    ("BRN KHM LAO SGP THA VNM AUS CHN JPN NZL", [C("2020-11-15", "2022-01-01", "signed"), M("2022-01-01")]),
    ("KOR", [C("2020-11-15", "2022-02-01", "signed"), M("2022-02-01")]),
    ("MMR", [C("2020-11-15", "2022-03-04", "signed"), M("2022-03-04")]),
    ("MYS", [C("2020-11-15", "2022-03-18", "signed"), M("2022-03-18")]),
    ("IDN", [C("2020-11-15", "2023-01-02", "signed"), M("2023-01-02")]),
    ("PHL", [C("2020-11-15", "2023-06-02", "signed"), M("2023-06-02")]),
    ("HKG", [C("2022-01", "2026-09-21"), C("2026-09-21", None, "accession")]),
    ("LKA", [C("2023-06", "2026-09-21"), C("2026-09-21", None, "accession")]),
    ("CHL", [C("2024-06", "2026-09-21"), C("2026-09-21", None, "accession")]),
    ("BGD", [C("2024-10-14", "2026-09-21"), C("2026-09-21", None, "accession")]),
)

# ── 非洲聯盟（1963 年非洲團結組織 → 2002 年非洲聯盟） ────────────────
# 加入日期依非洲聯盟網站；肯亞（網站寫 1963-05-25，1963-12-12 才獨立）、安哥拉（網站寫 1975-02-11，
# 1975-11-11 才獨立；非洲團結組織 1976-02-11 承認）改用實際日期。
AU = _table(
    (
        "DZA BEN BFA BDI CMR CAF TCD COG COD EGY ETH GAB GHA GIN CIV LBR LBY MDG MLI MRT NER NGA RWA SEN SLE SOM "
        "SDN TZA TGO TUN UGA",
        M("1963-05-25"),
    ),
    ("MAR", [M("1963-05-25", "1984-11-12"), M("2017-01-31")]),
    ("KEN", M("1963-12-13")),
    ("MWI", M("1964-07-13")),
    ("ZMB", M("1964-12-16")),
    ("GMB", M("1965-03-09")),
    ("BWA LSO", M("1966-10-31")),
    ("MUS", M("1968-08")),
    ("SWZ", M("1968-09-24")),
    ("GNQ", M("1968-10-12")),
    ("GNB", M("1973-11-19")),
    ("CPV COM MOZ STP", M("1975-07-18")),
    ("AGO", M("1976-02-11")),
    ("SYC", M("1976-06-29")),
    ("DJI", M("1977-06-27")),
    ("ZWE", M("1980-06-18")),
    ("ESH", M("1982-02-22")),
    ("NAM", M("1990-06")),
    ("ERI", M("1993-05-24")),
    ("ZAF", M("1994-06-06")),
    ("SSD", M("2011-07-27")),
    # 暫停參與（違憲更迭政府；和平與安全理事會的決定）
    ("MDG", [S("2002-07-09", "2003-07-10"), S("2009-03-20", "2014-01-27"), S("2025-10-15")]),
    ("CAF", [S("2003-03-17", "2005-06-24"), S("2013-03-25", "2016-04-06")]),
    ("TGO", S("2005-02-25", "2005-05")),
    ("MRT", [S("2005-08-04", "2007-04"), S("2008-08-06", "2009-07")]),
    ("GIN", [S("2008-12-29", "2010-12-09"), S("2021-09-10", "2026-01-22")]),
    ("NER", [S("2010-02-19", "2011-03-16"), S("2023-08-22")]),
    ("CIV", S("2010-12-09", "2011-04-21")),
    ("MLI", [S("2012-03-23", "2012-10-24"), S("2020-08-19", "2020-10-09"), S("2021-06-01")]),
    ("GNB", [S("2012-04-17", "2014-06-17"), S("2025-11-28")]),
    ("EGY", S("2013-07-05", "2014-06-17")),
    ("BFA", [S("2015-09-18", "2015-09-26"), S("2022-01-31")]),
    ("SDN", [S("2019-06-06", "2019-09-06"), S("2021-10-27")]),
    ("GAB", S("2023-08-31", "2025-04-30")),
)

# ── 石油輸出國組織（OPEC 只列年份的寫年份） ──────────────────────
OPEC = _table(
    ("IRN IRQ KWT SAU VEN", M("1960-09-14")),
    ("QAT", M("1961", "2019-01-01")),
    ("IDN", [M("1962", "2009-01-01"), M("2016-01-01", "2016-11-30")]),
    ("LBY", M("1962")),
    ("ARE", M("1967", "2026-05-01")),
    ("DZA", M("1969")),
    ("NGA", M("1971")),
    ("ECU", [M("1973", "1992-12"), M("2007-10", "2020-01-01")]),
    ("GAB", [M("1975", "1995-01"), M("2016-07-01")]),
    ("AGO", M("2007-01-01", "2024-01-01")),
    ("GNQ", [P("2016-12-10", "2017-05-25", "doc"), M("2017-05-25")]),
    ("COG", M("2018-06-22")),
    # OPEC+ 合作宣言（2016-12-10）的非 OPEC 參與國
    ("AZE BHR BRN KAZ MYS MEX OMN RUS SDN SSD", P("2016-12-10", None, "doc")),
)

# ── 大英國協（1949 年倫敦宣言起；舊自治領 1931 年西敏法令） ────────────────
COMMONWEALTH = _table(
    ("GBR CAN AUS NZL", M("1931-12-11")),
    ("ZAF", [M("1931-12-11", "1961-05-31"), M("1994-06-01")]),
    ("IRL", M("1931-12-11", "1949-04-18")),
    ("IND", M("1947-08-15")),
    ("PAK", [M("1947-08-14", "1972-01-30"), M("1989-10-01"), S("1999-10-18", "2004-05-22"), S("2007-11-22", "2008-05-12")]),
    ("LKA", M("1948-02-04")),
    ("GHA", M("1957-03-06")),
    ("MYS", M("1957-08-31")),
    ("NGA", [M("1960-10-01"), S("1995-11-11", "1999-05-29")]),
    ("CYP", M("1961-03-13")),
    ("SLE", M("1961-04-27")),
    ("TZA", M("1961-12-09")),
    ("JAM", M("1962-08-06")),
    ("TTO", M("1962-08-31")),
    ("UGA", M("1962-10-09")),
    ("KEN", M("1963-12-12")),
    ("MWI", M("1964-07-06")),
    ("MLT", M("1964-09-21")),
    ("ZMB", M("1964-10-24")),
    ("GMB", [M("1965-02-18", "2013-10-03"), M("2018-02-08")]),
    ("SGP", M("1965-10-15")),
    ("GUY", M("1966-05-26")),
    ("BWA", M("1966-09-30")),
    ("LSO", M("1966-10-04")),
    ("BRB", M("1966-11-30")),
    ("MUS", M("1968-03-12")),
    ("SWZ", M("1968-09-06")),
    ("NRU", M("1968-11-29")),
    ("TON", M("1970-06-04")),
    ("WSM", M("1970-08-28")),
    ("FJI", [M("1970-10-10", "1987-10-15"), M("1997-10-01"), S("2000-06-06", "2001-12-20"), S("2006-12-08", "2014-09-26")]),
    ("BGD", M("1972-04-18")),
    ("BHS", M("1973-07-10")),
    ("GRD", M("1974-02-07")),
    ("PNG", M("1975-09-16")),
    ("SYC", M("1976-06-29")),
    ("SLB", M("1978-07-07")),
    ("TUV", M("1978-10-01")),
    ("DMA", M("1978-11-03")),
    ("LCA", M("1979-02-22")),
    ("KIR", M("1979-07-12")),
    ("VCT", M("1979-10-27")),
    ("ZWE", [M("1980-04-18", "2003-12-07"), S("2002-03-19", "2003-12-07"), C("2018-05-15")]),
    ("VUT", M("1980-07-30")),
    ("BLZ", M("1981-09-21")),
    ("ATG", M("1981-11-01")),
    ("MDV", [M("1982-07-09", "2016-10-13"), M("2020-02-01")]),
    ("KNA", M("1983-09-19")),
    ("BRN", M("1984-01-01")),
    ("NAM", M("1990-03-21")),
    ("CMR", M("1995-11-01")),
    ("MOZ", M("1995-11-13")),
    ("RWA", M("2009-11-29")),
    ("GAB", [M("2022-06-25"), S("2023-09-18", "2025-07-15", "partial")]),
    ("TGO", M("2022-06-25")),
)

# ── 阿拉伯國家聯盟（官網連不上；日期依英文維基百科的成員國條目） ──────────────
ARAB_LEAGUE = _table(
    ("EGY", [M("1945-03-22"), S("1979-03-26", "1989-05-23")]),
    ("IRQ JOR LBN SAU", M("1945-03-22")),
    ("SYR", [M("1945-03-22"), S("2011-11-16", "2023-05-07")]),
    ("YEM", M("1945-05-05")),
    ("LBY", [M("1953-03-28"), S("2011-02-22", "2011-08-27")]),
    ("SDN", M("1956-01-19")),
    ("MAR TUN", M("1958-10-01")),
    ("KWT", M("1961-07-20")),
    ("DZA", M("1962-08-16")),
    ("BHR QAT", M("1971-09-11")),
    ("OMN", M("1971-09-29")),
    ("ARE", M("1971-12-06")),
    ("MRT", M("1973-11-26")),
    ("SOM", M("1974-02-14")),
    ("PSE", M("1976-09-09")),
    ("DJI", M("1977-09-04")),
    ("COM", M("1993-11-20")),
)

# ── 上海合作組織（2001-06-15 成立；前身是 1996 年的上海五國） ─────────────
SCO = _table(
    ("CHN KAZ KGZ RUS TJK UZB", M("2001-06-15")),
    ("IND PAK", [P("2005-07-05", "2015-07-10", "observer"), C("2015-07-10", "2017-06-09", "accession"), M("2017-06-09")]),
    ("IRN", [P("2005-07-05", "2021-09-17", "observer"), C("2021-09-17", "2023-07-04", "accession"), M("2023-07-04")]),
    ("BLR", [
        P("2009-06-16", "2015-07-10", "dialogue"), P("2015-07-10", "2022-09-16", "observer"),
        C("2022-09-16", "2024-07-04", "accession"), M("2024-07-04"),
    ]),
    ("MNG", P("2004-06-17", None, "observer")),
    ("AFG", P("2012-06-07", None, "observer")),
    ("LKA", P("2009-06-16", None, "dialogue")),
    ("TUR", P("2012-06-07", None, "dialogue")),
    ("ARM AZE KHM NPL", P("2015-07-10", None, "dialogue")),
    ("EGY QAT SAU", P("2021-09-17", None, "dialogue")),
    ("BHR KWT MDV MMR ARE", P("2022-09-16", None, "dialogue")),
    ("LAO", P("2024-07-04", None, "dialogue")),
)

# ── 世界貿易組織（1995-01-01 成立；歐盟本身也是會員，不在地圖上） ──────────────
# 加入前的「加入中」從申請日算起（WTO 各國加入頁面；1995 年以前申請的在地圖上從 1995 年開始）。
_WTO_1995 = (
    "ATG ARG AUS AUT BHR BGD BRB BEL BLZ BRA BRN CAN CHL CRI CIV CZE DNK DMA SWZ FIN FRA GAB DEU GHA GRC GUY HND HKG "
    "HUN ISL IND IDN IRL ITA JPN KEN KOR KWT LUX MAC MYS MLT MUS MEX MAR MMR NAM NLD NZL NGA NOR PAK PRY PER PHL PRT "
    "ROU LCA VCT SEN SGP SVK ZAF ESP LKA SUR SWE TZA THA UGA GBR USA URY VEN ZMB"
)
WTO = _table(
    (_WTO_1995, M("1995-01-01")),
    ("TTO", M("1995-03-01")),
    ("ZWE", M("1995-03-05")),
    ("DOM JAM", M("1995-03-09")),
    ("TUR", M("1995-03-26")),
    ("TUN", M("1995-03-29")),
    ("CUB", M("1995-04-20")),
    ("ISR", M("1995-04-21")),
    ("COL", M("1995-04-30")),
    ("SLV", M("1995-05-07")),
    ("BWA CAF DJI GNB LSO MWI MDV MLI MRT TGO", M("1995-05-31")),
    ("BFA", M("1995-06-03")),
    ("EGY", M("1995-06-30")),
    ("POL CHE", M("1995-07-01")),
    ("GTM", M("1995-07-21")),
    ("BDI SLE", M("1995-07-23")),
    ("CYP SVN", M("1995-07-30")),
    ("MOZ", M("1995-08-26")),
    ("LIE", M("1995-09-01")),
    ("NIC", M("1995-09-03")),
    ("BOL", M("1995-09-12")),
    ("GIN", M("1995-10-25")),
    ("MDG", M("1995-11-17")),
    ("CMR", M("1995-12-13")),
    ("QAT", M("1996-01-13")),
    ("FJI", M("1996-01-14")),
    ("HTI", M("1996-01-30")),
    ("KNA", M("1996-02-21")),
    ("BEN GRD", M("1996-02-22")),
    ("ARE", M("1996-04-10")),
    ("RWA", M("1996-05-22")),
    ("PNG", M("1996-06-09")),
    ("SLB", M("1996-07-26")),
    ("TCD", M("1996-10-19")),
    ("GMB", M("1996-10-23")),
    ("AGO", M("1996-11-23")),
    ("NER", M("1996-12-13")),
    ("COD", M("1997-01-01")),
    ("COG", M("1997-03-27")),
    # 加入（申請日 → 成為會員）
    ("ECU", [C("1992-09", "1996-01-21", "accession"), M("1996-01-21")]),
    ("BGR", [C("1986-09", "1996-12-01", "accession"), M("1996-12-01")]),
    ("MNG", [C("1991-07", "1997-01-29", "accession"), M("1997-01-29")]),
    ("PAN", [C("1991-08", "1997-09-06", "accession"), M("1997-09-06")]),
    ("KGZ", [C("1996-02", "1998-12-20", "accession"), M("1998-12-20")]),
    ("LVA", [C("1993-11", "1999-02-10", "accession"), M("1999-02-10")]),
    ("EST", [C("1994-03", "1999-11-13", "accession"), M("1999-11-13")]),
    ("JOR", [C("1994-01", "2000-04-11", "accession"), M("2000-04-11")]),
    ("GEO", [C("1996-07", "2000-06-14", "accession"), M("2000-06-14")]),
    ("ALB", [C("1992-11", "2000-09-08", "accession"), M("2000-09-08")]),
    ("OMN", [C("1996-04", "2000-11-09", "accession"), M("2000-11-09")]),
    ("HRV", [C("1993-09", "2000-11-30", "accession"), M("2000-11-30")]),
    ("LTU", [C("1994-01", "2001-05-31", "accession"), M("2001-05-31")]),
    ("MDA", [C("1993-11", "2001-07-26", "accession"), M("2001-07-26")]),
    ("CHN", [C("1986-07-10", "2001-12-11", "accession"), M("2001-12-11")]),
    ("TWN", [C("1990-01-01", "2002-01-01", "accession"), M("2002-01-01")]),
    ("ARM", [C("1993-11", "2003-02-05", "accession"), M("2003-02-05")]),
    ("MKD", [C("1994-12", "2003-04-04", "accession"), M("2003-04-04")]),
    ("NPL", [C("1989-05", "2004-04-23", "accession"), M("2004-04-23")]),
    ("KHM", [C("1994-12", "2004-10-13", "accession"), M("2004-10-13")]),
    ("SAU", [C("1993-06", "2005-12-11", "accession"), M("2005-12-11")]),
    ("VNM", [C("1995-01", "2007-01-11", "accession"), M("2007-01-11")]),
    ("TON", [C("1995-06", "2007-07-27", "accession"), M("2007-07-27")]),
    ("UKR", [C("1993-11", "2008-05-16", "accession"), M("2008-05-16")]),
    ("CPV", [C("1999-11", "2008-07-23", "accession"), M("2008-07-23")]),
    ("MNE", [C("2005-02", "2012-04-29", "accession"), M("2012-04-29")]),
    ("WSM", [C("1998-04-15", "2012-05-10", "accession"), M("2012-05-10")]),
    ("RUS", [C("1993-06", "2012-08-22", "accession"), M("2012-08-22")]),
    ("VUT", [C("1995-07", "2012-08-24", "accession"), M("2012-08-24")]),
    ("LAO", [C("1997-07", "2013-02-02", "accession"), M("2013-02-02")]),
    ("TJK", [C("2001-05", "2013-03-02", "accession"), M("2013-03-02")]),
    ("YEM", [C("2000-04", "2014-06-26", "accession"), M("2014-06-26")]),
    ("SYC", [C("1995-05", "2015-04-26", "accession"), M("2015-04-26")]),
    ("KAZ", [C("1996-01-29", "2015-11-30", "accession"), M("2015-11-30")]),
    ("LBR", [C("2007-06", "2016-07-14", "accession"), M("2016-07-14")]),
    ("AFG", [C("2004-11", "2016-07-29", "accession"), M("2016-07-29")]),
    ("COM", [C("2007-02", "2024-08-21", "accession"), M("2024-08-21")]),
    ("TLS", [C("2016-11", "2024-08-30", "accession"), M("2024-08-30")]),
    # 觀察員：除了教廷，都在申請加入（WTO 加入進度表，2024-08 更新；日期是申請日）
    ("SDN", C("1994-11", None, "accession")),
    ("UZB", C("1994-12", None, "accession")),
    ("DZA", C("1987-06", None, "accession")),
    ("BLR", C("1993-09", None, "accession")),
    ("IRN", C("1996-09", None, "accession")),
    ("AZE", C("1997-06", None, "accession")),
    ("AND", C("1997-07", None, "accession")),
    ("LBN", C("1999-02", None, "accession")),
    ("BIH", C("1999-05", None, "accession")),
    ("BTN", C("1999-09", None, "accession")),
    ("BHS", C("2001-05", None, "accession")),
    ("SYR", C("2001-10", None, "accession")),
    ("LBY", C("2001-12", None, "accession")),
    ("ETH", C("2003-01", None, "accession")),
    ("IRQ", C("2004-09", None, "accession")),
    ("SRB", C("2004-12", None, "accession")),
    ("STP", C("2005-02", None, "accession")),
    ("GNQ", C("2007-02", None, "accession")),
    ("SOM", C("2015-12", None, "accession")),
    ("SSD", C("2017-12", None, "accession")),
    ("CUW", C("2019-10", None, "accession")),
    ("TKM", C("2021-11", None, "accession")),
    ("VAT", P("1997-07", None, "observer")),
)

# ── 亞太經濟合作（依 APEC 網站的加入日期，取會議第一天） ───────────────────
APEC = _table(
    ("AUS BRN CAN IDN JPN KOR MYS NZL PHL SGP THA USA", M("1989-11-06")),
    ("CHN HKG TWN", M("1991-11-12")),
    ("MEX PNG", M("1993-11-17")),
    ("CHL", M("1994-11-11")),
    ("PER RUS VNM", M("1998-11-14")),
)

TABLES: dict[str, dict[str, list[Period]]] = {
    "eu": EU, "nato": NATO, "asean": ASEAN, "oecd": OECD, "g7": G7, "g20": G20, "brics": BRICS, "cptpp": CPTPP,
    "rcep": RCEP, "au": AU, "opec": OPEC, "commonwealth": COMMONWEALTH, "arab-league": ARAB_LEAGUE, "sco": SCO,
    "wto": WTO, "apec": APEC,
}

# ── 參加時用的名稱（側欄顯示）：(org, iso3) → (中文, 英文) ───────────────────
NAMES: dict[tuple[str, str], tuple[str, str]] = {
    ("wto", "TWN"): (
        "臺澎金馬個別關稅領域（簡稱中華台北）",
        "Separate Customs Territory of Taiwan, Penghu, Kinmen and Matsu (Chinese Taipei)",
    ),
    ("apec", "TWN"): ("中華台北", "Chinese Taipei"),
    ("cptpp", "TWN"): ("臺澎金馬個別關稅領域", "Separate Customs Territory of Taiwan, Penghu, Kinmen and Matsu"),
    ("wto", "HKG"): ("中國香港（1997 年以前稱香港）", "Hong Kong, China (Hong Kong before 1997)"),
    ("apec", "HKG"): ("中國香港（1997 年以前稱香港）", "Hong Kong, China (Hong Kong before 1997)"),
    ("rcep", "HKG"): ("中國香港", "Hong Kong, China"),
    ("wto", "MAC"): ("中國澳門（1999 年以前稱澳門）", "Macao, China (Macau before 1999)"),
    ("wto", "CUW"): ("庫拉索", "Curaçao"),
    ("au", "ESH"): ("撒拉威阿拉伯民主共和國", "Sahrawi Arab Democratic Republic"),
    ("wto", "VAT"): ("教廷", "Holy See"),
}

# ── 附註（側欄顯示）：(org, iso3) → (中文, 英文) ────────────────────────
WEST_GERMANY = (
    "1990-10-03 兩德統一以前是西德（德意志聯邦共和國），統一後東德的範圍一併加入。",
    "West Germany until reunification on 3 October 1990, when the former East Germany joined as part of Germany.",
)
GLOBAL_NATO = (
    "全球夥伴的年份用北約 2011 年新夥伴政策的時間，實際的合作更早。",
    "The year for partners across the globe is that of NATO's 2011 partnership policy; cooperation began earlier.",
)
NOTES: dict[tuple[str, str], tuple[str, str]] = {
    # 歐盟
    ("eu", "DEU"): WEST_GERMANY,
    ("eu", "GBR"): ("2020-01-31 退出（脫歐），直布羅陀一起退出。", "Left on 31 January 2020 (Brexit), together with Gibraltar."),
    ("eu", "GRL"): (
        "1973 年隨丹麥加入歐洲共同體；1982 年公投後於 1985-02-01 退出，改為海外國家與領地。",
        "Joined the European Communities with Denmark in 1973; left on 1 February 1985 after a 1982 referendum and became an overseas country and territory.",
    ),
    ("eu", "FRO"): ("法羅群島是丹麥王國的一部分，但從未加入歐洲共同體或歐盟。", "Part of the Kingdom of Denmark, but never joined the European Communities or the EU."),
    ("eu", "DNK"): ("法羅群島從未加入，格陵蘭 1985 年退出。", "The Faroe Islands never joined; Greenland left in 1985."),
    ("eu", "CYP"): ("2004 年全島加入，但北部（北賽普勒斯）暫停適用歐盟法。", "The whole island joined in 2004, but EU law is suspended in the north."),
    ("eu", "FRA"): (
        "海外省（法屬圭亞那、瓜地洛普、馬丁尼克、留尼旺、2014 年起的馬約特）與聖馬丁是歐盟的「最外圍地區」，地圖上不另外上色；其他海外領地不在歐盟內。",
        "The overseas departments (French Guiana, Guadeloupe, Martinique, Réunion and, since 2014, Mayotte) and Saint Martin are EU outermost regions, not shaded separately; other overseas territories are outside the EU.",
    ),
    ("eu", "FIN"): ("奧蘭群島隨芬蘭加入（有稅務上的例外）。", "The Åland Islands joined with Finland (with tax exemptions)."),
    ("eu", "TUR"): ("2005 年開始入盟談判，2018 年起實際上停滯。", "Accession talks opened in 2005 and have been at a standstill since 2018."),
    ("eu", "GEO"): ("2024 年 6 月歐洲理事會表示，喬治亞的加入程序實際上已經停止。", "In June 2024 the European Council said Georgia's accession process had de facto come to a halt."),
    ("eu", "ISL"): (
        "2013 年停止談判，2015-03-12 要求不再被視為候選國；2026-08-29 公投否決恢復談判。",
        "Talks stopped in 2013 and Iceland asked on 12 March 2015 not to be regarded as a candidate; a referendum on 29 August 2026 rejected resuming them.",
    ),
    ("eu", "NOR"): ("1972 年、1994 年兩次公投否決加入。", "Membership was rejected in referendums in 1972 and 1994."),
    ("eu", "CHE"): (
        "1992 年 5 月提出申請，同年 12 月歐洲經濟區公投否決後擱置，2016 年正式撤回。",
        "Applied in May 1992; the application was frozen after the European Economic Area referendum failed that December and formally withdrawn in 2016.",
    ),
    ("eu", "MLT"): ("1996 年底到 1998 年 9 月凍結申請。", "The application was frozen from late 1996 to September 1998."),
    ("eu", "XKX"): ("2022-12-15 申請加入；歐盟稱為潛在候選國。", "Applied on 15 December 2022; the EU calls it a potential candidate."),
    # 北約
    ("nato", "DEU"): WEST_GERMANY,
    ("nato", "FRA"): ("1966–2009 年退出北約的整合軍事指揮體系，但仍是成員。", "Withdrew from NATO's integrated military command in 1966–2009 but remained a member."),
    ("nato", "GRC"): ("1974–1980 年退出北約的軍事指揮體系。", "Withdrew from NATO's military command structure in 1974–1980."),
    ("nato", "ISL"): ("創始成員，沒有常備軍隊。", "A founding member with no standing armed forces."),
    ("nato", "RUS"): ("1994 年加入和平夥伴關係；北約 2014 年 4 月起暫停與俄羅斯的實際合作。", "Joined the Partnership for Peace in 1994; NATO suspended practical cooperation with Russia in April 2014."),
    ("nato", "BLR"): ("1995 年加入和平夥伴關係；北約 2021 年 11 月起暫停與白俄羅斯的實際合作。", "Joined the Partnership for Peace in 1995; NATO suspended practical cooperation with Belarus in November 2021."),
    ("nato", "MLT"): ("1996 年 10 月暫停參加和平夥伴關係，2008 年恢復。", "Suspended its Partnership for Peace participation in October 1996 and resumed it in 2008."),
    ("nato", "UKR"): (
        "2008 年布加勒斯特峰會北約表示烏克蘭與喬治亞「將成為成員」；2010–2014 年烏克蘭依法採不結盟政策；2022-09-30 正式申請加入。",
        "At the 2008 Bucharest summit NATO said Ukraine and Georgia \"will become members\"; Ukraine was legally non-aligned in 2010–2014 and formally applied on 30 September 2022.",
    ),
    ("nato", "GEO"): ("2008 年布加勒斯特峰會北約表示喬治亞與烏克蘭「將成為成員」。", "At the 2008 Bucharest summit NATO said Georgia and Ukraine \"will become members\"."),
    ("nato", "BIH"): ("2010 年獲准加入「入盟行動計畫」（MAP）。", "Invited to join the Membership Action Plan (MAP) in 2010."),
    ("nato", "AFG"): ("全球夥伴關係 2021 年起暫停。" + GLOBAL_NATO[0], "The partnership has been suspended since 2021. " + GLOBAL_NATO[1]),
    **{("nato", iso3): GLOBAL_NATO for iso3 in "AUS JPN KOR NZL MNG PAK IRQ".split()},
    ("nato", "FIN"): ("2022-05-18 與瑞典同時申請加入。", "Applied on 18 May 2022, together with Sweden."),
    ("nato", "SWE"): ("2022-05-18 與芬蘭同時申請加入。", "Applied on 18 May 2022, together with Finland."),
    # 東協
    ("asean", "TLS"): (
        "2011-03-04 申請，2022-11-11 原則同意接納並成為觀察員，2025-10-26 成為第 11 個成員。",
        "Applied on 4 March 2011, was admitted in principle and became an observer on 11 November 2022, and became the 11th member on 26 October 2025.",
    ),
    ("asean", "MMR"): ("2021 年政變後，東協峰會只邀請緬甸派非政治層級的代表。", "Since the 2021 coup, ASEAN summits have invited only a non-political representative from Myanmar."),
    ("asean", "PNG"): ("1976 年起是東協的特別觀察員。", "A special observer of ASEAN since 1976."),
    ("asean", "KHM"): ("原定 1997 年 7 月與寮國、緬甸一起加入，因國內政變延到 1999 年。", "Due to join with Laos and Myanmar in July 1997, but admission was postponed to 1999 after a coup."),
    ("asean", "CHN"): ("1991 年起是諮商夥伴，1996 年成為對話夥伴。", "A consultative partner from 1991 and a dialogue partner since 1996."),
    ("asean", "RUS"): ("1991 年起是諮商夥伴，1996 年成為對話夥伴。", "A consultative partner from 1991 and a dialogue partner since 1996."),
    ("asean", "TUR"): ("2017 年成為部門對話夥伴，2026 年 7 月成為對話夥伴。", "A sectoral dialogue partner from 2017 and a dialogue partner since July 2026."),
    ("asean", "BRA"): ("年份是查得到的最早年份（東協 2024 年 9 月的關係概況）。", "Earliest year found (ASEAN's overview of relations, September 2024)."),
    ("asean", "DNK"): ("年份是查得到的最早年份（東協 2026 年 5 月的夥伴名單）。", "Earliest year found (ASEAN's partner list of May 2026)."),
    ("asean", "DEU"): ("2016 年起是發展夥伴（地圖不畫），2026 年 7 月成為部門對話夥伴。", "A development partner from 2016 (not shown) and a sectoral dialogue partner since July 2026."),
    # OECD
    ("oecd", "ITA"): ("1962-03-29 批准公約，是 20 個創始國中最晚的。", "Ratified the Convention on 29 March 1962, the last of the 20 founding countries."),
    ("oecd", "RUS"): ("2007 年開始入會討論，2014 年 3 月暫停，2022 年正式終止。", "Accession talks began in 2007, were postponed in March 2014 and formally ended in 2022."),
    ("oecd", "DEU"): WEST_GERMANY,
    **{("oecd", iso3): ("2007 年起是 OECD 的主要夥伴。", "An OECD Key Partner since 2007.") for iso3 in "CHN IND ZAF".split()},
    ("oecd", "BRA"): ("2007 年起是主要夥伴，2022-01-25 開始入會討論。", "A Key Partner from 2007; accession talks began on 25 January 2022."),
    ("oecd", "IDN"): ("2007 年起是主要夥伴，2024-02-20 開始入會討論。", "A Key Partner from 2007; accession talks began on 20 February 2024."),
    # G7
    ("g7", "RUS"): (
        "1998 年伯明罕峰會起完整參加，成為八大工業國組織（G8）；2014 年 3 月其他七國因克里米亞暫停 G8，恢復 G7。",
        "Took full part from the 1998 Birmingham summit, forming the G8; in March 2014 the other seven suspended the G8 over Crimea and returned to the G7.",
    ),
    ("g7", "DEU"): WEST_GERMANY,
    # G20
    ("g20", "ZAF"): ("2026 年的主辦國美國沒有邀請南非出席；南非仍是成員。", "The 2026 host, the United States, did not invite South Africa; it remains a member."),
    ("g20", "ESP"): ("2008 年起每屆高峰會都受邀出席，是常任受邀國，不是成員。", "Invited to every leaders' summit since 2008 as a permanent guest; not a member."),
    # 金磚國家
    ("brics", "SAU"): (
        "2023 年受邀加入，沙烏地政府沒有正式確認；2026 年新德里峰會以受邀國身分出席。",
        "Invited in 2023 but has not formally confirmed; attended the 2026 New Delhi summit as an invited country.",
    ),
    ("brics", "ARG"): ("2023 年受邀，2023-12-29 婉拒。", "Invited in 2023; declined on 29 December 2023."),
    ("brics", "ZAF"): ("2010 年 12 月受邀加入，金磚四國（BRIC）成為金磚五國。", "Invited in December 2010, turning BRIC into BRICS."),
    # CPTPP
    ("cptpp", "TWN"): (
        "2021-09-22 以「臺澎金馬個別關稅領域」名義申請加入，還沒有成立加入工作小組。",
        "Applied on 22 September 2021 as the Separate Customs Territory of Taiwan, Penghu, Kinmen and Matsu; no accession working group has been set up.",
    ),
    ("cptpp", "CHN"): ("2021-09-16 申請加入，還沒有成立加入工作小組。", "Applied on 16 September 2021; no accession working group has been set up."),
    ("cptpp", "CRI"): (
        "2024-11-28 成立加入工作小組，2026 年 5 月實質完成談判，還要簽署與批准。",
        "An accession working group was set up on 28 November 2024; negotiations were substantially concluded in May 2026, pending signature and ratification.",
    ),
    ("cptpp", "URY"): ("2025-11-21 成立加入工作小組。", "An accession working group was set up on 21 November 2025."),
    ("cptpp", "GBR"): ("2021-02-01 申請，2023-07-16 簽署加入議定書，2024-12-15 生效。", "Applied on 1 February 2021, signed its accession protocol on 16 July 2023, in force from 15 December 2024."),
    # RCEP
    ("rcep", "IND"): ("參加談判，2019 年退出，沒有簽署。", "Took part in the negotiations but withdrew in 2019 and did not sign."),
    ("rcep", "HKG"): ("2022 年 1 月申請加入，2026-09-21 成立加入工作小組。", "Applied in January 2022; an accession working group was set up on 21 September 2026."),
    # 非洲聯盟
    ("au", "MAR"): (
        "1984-11-12 因撒拉威阿拉伯民主共和國獲接納而退出非洲團結組織，2017-01-31 加入非洲聯盟。",
        "Left the Organisation of African Unity on 12 November 1984 over the admission of the Sahrawi Arab Democratic Republic; joined the African Union on 31 January 2017.",
    ),
    ("au", "ESH"): (
        "非洲聯盟的成員名單列有撒拉威阿拉伯民主共和國（1982 年加入非洲團結組織）。西撒哈拉的主權有爭議，摩洛哥控制大部分地區；畫在地圖上西撒哈拉的形狀，不代表對主權的立場。",
        "The African Union lists the Sahrawi Arab Democratic Republic as a member (admitted to the OAU in 1982). Sovereignty over Western Sahara is disputed and most of it is controlled by Morocco; shading the Western Sahara shape on the map takes no position on sovereignty.",
    ),
    ("au", "AGO"): (
        "非洲聯盟網站寫 1975-02-11，但安哥拉 1975-11-11 才獨立；這裡用非洲團結組織承認安哥拉政府的 1976-02-11。",
        "The AU website gives 11 February 1975, but Angola became independent on 11 November 1975; the OAU's recognition on 11 February 1976 is used here.",
    ),
    ("au", "KEN"): ("非洲聯盟網站寫 1963-05-25，但肯亞 1963-12-12 才獨立；這裡用 1963-12-13。", "The AU website gives 25 May 1963, but Kenya became independent on 12 December 1963; 13 December 1963 is used here."),
    ("au", "MDG"): (
        "2002 年非洲聯盟成立時，因大選爭議沒有讓馬達加斯加入席，2003-07-10 恢復；2009–2014 年、2025-10-15 起因政變暫停參與。",
        "Not seated when the African Union was founded in 2002 because of a disputed election, until 10 July 2003; suspended after coups in 2009–2014 and since 15 October 2025.",
    ),
    ("au", "GIN"): (
        "2008–2010 年、2021-09-10 到 2026-01-22 因政變暫停參與。2010 年的恢復日期依和平與安全理事會第 252 次會議（2010-12-09），英文維基百科寫 2011 年 1 月。",
        "Suspended after coups in 2008–2010 and from 10 September 2021 to 22 January 2026. The 2010 reinstatement follows the Peace and Security Council's 252nd meeting (9 December 2010); English Wikipedia gives January 2011.",
    ),
    ("au", "GAB"): ("2023-08-31 政變後暫停參與，2025-04-30 恢復。", "Suspended after the coup of 30 August 2023 and reinstated on 30 April 2025."),
    ("au", "TGO"): ("2005 年 2 月暫停參與，同年 5 月選舉後恢復（只查到月份）。", "Suspended in February 2005 and reinstated after the election that May (month only)."),
    ("au", "ISR"): (
        "2021 年非盟執委會主席接受以色列為觀察員，2023 年 2 月暫停；地圖不畫。",
        "The AU Commission chairperson accredited Israel as an observer in 2021; this was suspended in February 2023 and is not shown.",
    ),
    # OPEC
    ("opec", "IDN"): (
        "2009 年、2016 年 11 月兩度「暫停會籍」（OPEC 的說法），這裡算退出。",
        "Suspended its membership in 2009 and again in November 2016 (OPEC's wording); treated here as leaving.",
    ),
    ("opec", "ECU"): ("1992 年 12 月暫停會籍、2007 年 10 月恢復、2020-01-01 退出。", "Suspended its membership in December 1992, rejoined in October 2007 and left on 1 January 2020."),
    ("opec", "GAB"): ("1995 年 1 月退出，2016-07-01 重新加入。", "Left in January 1995 and rejoined on 1 July 2016."),
    ("opec", "QAT"): ("2019-01-01 退出。", "Left on 1 January 2019."),
    ("opec", "AGO"): ("2024-01-01 退出。", "Left on 1 January 2024."),
    ("opec", "ARE"): (
        "1967 年由阿布達比加入，1974 年起由阿聯承接；2026-04-28 宣布 5 月 1 日起退出 OPEC 與 OPEC+。",
        "Abu Dhabi joined in 1967 and the UAE took over the membership in 1974; on 28 April 2026 it announced it would leave OPEC and OPEC+ from 1 May.",
    ),
    ("opec", "BRA"): ("2025 年加入 OPEC+ 合作憲章（不是合作宣言），地圖不畫。", "Joined the OPEC+ Charter of Cooperation (not the Declaration of Cooperation) in 2025; not shown."),
    # 大英國協
    ("commonwealth", "IRL"): ("1949-04-18 成為共和國時退出。", "Left on becoming a republic on 18 April 1949."),
    ("commonwealth", "IND"): ("1949 年倫敦宣言讓成為共和國的印度留在國協。", "The 1949 London Declaration allowed India to remain a member as a republic."),
    ("commonwealth", "ZAF"): ("1961-05-31 退出，1994-06-01 重新加入。", "Left on 31 May 1961 and rejoined on 1 June 1994."),
    ("commonwealth", "PAK"): (
        "1972-01-30 退出，1989-10-01 重新加入；1999–2004 年、2007–2008 年暫停參與。",
        "Left on 30 January 1972 and rejoined on 1 October 1989; suspended in 1999–2004 and 2007–2008.",
    ),
    ("commonwealth", "FJI"): (
        "1987 年宣布共和後會籍失效，1997 年重新加入；2000–2001 年、2006–2014 年暫停參與。",
        "Membership lapsed after it became a republic in 1987; rejoined in 1997; suspended in 2000–2001 and 2006–2014.",
    ),
    ("commonwealth", "NGA"): ("1995–1999 年暫停參與。", "Suspended in 1995–1999."),
    ("commonwealth", "ZWE"): ("2002 年暫停參與，2003-12-07 退出；2018-05-15 申請重新加入。", "Suspended in 2002, left on 7 December 2003 and applied to rejoin on 15 May 2018."),
    ("commonwealth", "GMB"): ("2013-10-03 退出，2018-02-08 重新加入。", "Left on 3 October 2013 and rejoined on 8 February 2018."),
    ("commonwealth", "MDV"): ("1982–1985 年是特別成員；2016-10-13 退出，2020-02-01 重新加入。", "A special member in 1982–1985; left on 13 October 2016 and rejoined on 1 February 2020."),
    ("commonwealth", "NRU"): ("1968–1999 年、2006–2011 年是特別成員（不出席高峰會）。", "A special member (not attending summits) in 1968–1999 and 2006–2011."),
    ("commonwealth", "TUV"): ("1978–2000 年是特別成員。", "A special member in 1978–2000."),
    ("commonwealth", "VCT"): ("1979–1985 年是特別成員。", "A special member in 1979–1985."),
    ("commonwealth", "GAB"): ("2022 年加入，不是前英國屬地；2023-09-18 部分暫停參與，2025-07-15 解除。", "Joined in 2022 without a British colonial past; partially suspended on 18 September 2023 until 15 July 2025."),
    ("commonwealth", "TGO"): ("2022 年加入，不是前英國屬地。", "Joined in 2022 without a British colonial past."),
    ("commonwealth", "MOZ"): ("1995 年加入，是第一個不是前英國屬地的成員。", "Joined in 1995 as the first member without a British colonial past."),
    ("commonwealth", "RWA"): ("2009 年加入，不是前英國屬地。", "Joined in 2009 without a British colonial past."),
    # 阿拉伯國家聯盟
    ("arab-league", "EGY"): (
        "1979-03-26 因與以色列簽訂和約被暫停，1989-05-23 恢復；聯盟總部 1979–1990 年遷到突尼斯。",
        "Suspended on 26 March 1979 after its peace treaty with Israel and readmitted on 23 May 1989; the League's headquarters moved to Tunis in 1979–1990.",
    ),
    ("arab-league", "SYR"): ("2011-11-16 暫停參與，2023-05-07 恢復。", "Suspended on 16 November 2011 and readmitted on 7 May 2023."),
    ("arab-league", "LBY"): ("2011-02-22 暫停參與，2011-08-27 由全國過渡委員會恢復席位。", "Suspended on 22 February 2011; the seat was restored to the National Transitional Council on 27 August 2011."),
    ("arab-league", "YEM"): ("北葉門 1945 年加入，南葉門 1967 年加入，1990 年統一。", "North Yemen joined in 1945 and South Yemen in 1967; they unified in 1990."),
    ("arab-league", "JOR"): ("創始成員（當時為外約旦）。", "A founding member (then Transjordan)."),
    ("arab-league", "PSE"): ("1976-09-09 以巴勒斯坦解放組織的名義加入。", "Admitted on 9 September 1976, represented by the Palestine Liberation Organization."),
    # 上海合作組織
    **{
        ("sco", iso3): ("1996 年起是上海五國，2001 年與烏茲別克一起成立上海合作組織。", "Part of the Shanghai Five from 1996; founded the SCO with Uzbekistan in 2001.")
        for iso3 in "CHN KAZ KGZ RUS TJK".split()
    },
    ("sco", "AFG"): ("2012 年成為觀察員；2021 年以後沒有參加活動，上合組織的名單仍列為觀察員。", "An observer since 2012; it has not taken part since 2021 but is still listed as an observer."),
    ("sco", "BHR"): ("2022 年撒馬爾罕峰會決定給予對話夥伴地位；上合組織網站的名單寫 15 個對話夥伴，但只列出 14 個，沒有巴林。", "Granted dialogue-partner status at the 2022 Samarkand summit; the SCO website says there are 15 dialogue partners but names only 14, without Bahrain."),
    # WTO
    ("wto", "TWN"): (
        "1990-01-01 以「臺澎金馬個別關稅領域」申請加入 GATT，1992-09-29 取得 GATT 觀察員地位並成立工作小組，2001-11-11 杜哈部長會議通過，2002-01-01 成為 WTO 第 144 個會員。中華民國是 1948 年 GATT 的創始締約方，1950 年退出，1965–1971 年是觀察員。",
        "Applied to the GATT on 1 January 1990 as the Separate Customs Territory of Taiwan, Penghu, Kinmen and Matsu, became a GATT observer with a working party on 29 September 1992, was approved at the Doha ministerial conference on 11 November 2001 and became the WTO's 144th member on 1 January 2002. The Republic of China was a founding GATT contracting party in 1948, withdrew in 1950 and was an observer in 1965–1971.",
    ),
    ("wto", "CHN"): ("1986 年申請恢復 GATT 締約方地位，2001-12-11 加入 WTO。", "Applied to resume its GATT status in 1986 and joined the WTO on 11 December 2001."),
    ("wto", "HKG"): ("1986 年起是 GATT 締約方，1995 年成為 WTO 創始會員。", "A GATT contracting party from 1986 and an original WTO member in 1995."),
    ("wto", "MAC"): ("1991 年起是 GATT 締約方，1995 年成為 WTO 創始會員。", "A GATT contracting party from 1991 and an original WTO member in 1995."),
    ("wto", "VAT"): ("教廷是 WTO 的觀察員，沒有申請加入。", "The Holy See is a WTO observer and has not applied to join."),
    ("wto", "CUW"): ("荷蘭王國的自治國，以自己的名義申請加入（觀察員）。", "A constituent country of the Kingdom of the Netherlands, applying in its own right (observer)."),
    # APEC
    ("apec", "TWN"): ("1991 年與中國、香港同時加入。", "Joined in 1991 together with China and Hong Kong."),
}

# ── 檢查用的數字（地圖上的成員數，含暫停參與；不含歐盟、非洲聯盟這類組織成員） ─────
CHECK_COUNTS = {
    "eu": {1958: 6, 1973: 9, 1981: 10, 1986: 12, 1995: 15, 2004: 25, 2007: 27, 2013: 28, 2020: 27, 2026: 27},
    "nato": {1949: 12, 1952: 14, 1955: 15, 1982: 16, 1999: 19, 2004: 26, 2009: 28, 2017: 29, 2020: 30, 2023: 31, 2026: 32},
    "asean": {1967: 5, 1984: 6, 1995: 7, 1997: 9, 1999: 10, 2025: 11},
    "oecd": {1961: 19, 1962: 20, 1964: 21, 1973: 24, 1996: 29, 2000: 30, 2010: 34, 2016: 35, 2018: 36, 2020: 37, 2026: 38},
    "g7": {1975: 6, 1976: 7, 1998: 8, 2014: 7, 2026: 7},
    "g20": {1999: 19, 2026: 19},
    "brics": {2009: 4, 2010: 5, 2024: 9, 2026: 10},
    "cptpp": {2018: 6, 2019: 7, 2021: 8, 2022: 9, 2023: 11, 2024: 12, 2026: 12},
    "rcep": {2022: 13, 2023: 15, 2026: 15},
    "au": {2002: 53, 2011: 54, 2017: 55, 2026: 55},
    "opec": {1960: 5, 2018: 15, 2019: 14, 2020: 13, 2024: 12, 2026: 11},
    "commonwealth": {1949: 8, 2026: 56},
    "arab-league": {1945: 7, 1971: 17, 1977: 21, 1993: 22, 2026: 22},
    "sco": {2001: 6, 2017: 8, 2023: 9, 2026: 10},
    "wto": {2024: 165, 2026: 165},
    "apec": {1989: 12, 1991: 15, 1993: 17, 1994: 18, 1998: 21, 2026: 21},
}
# 今年的暫停參與（側欄、DESIGN.md 用）
CHECK_SUSPENDED = {"au": {2026: 6}, "arab-league": {2022: 1, 2026: 0}, "commonwealth": {2026: 0}}
