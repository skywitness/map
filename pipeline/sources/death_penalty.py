"""死刑：各國每年年底的狀態（全面廢除、只廢除普通犯罪、事實上廢除、保留）。自行整理的表。

依據英文維基百科的條目整理（CC BY-SA 4.0，2026-10-28 查），所以這張表與輸出的資料檔（`death-penalty.json`）依 CC BY-SA 4.0 分享：
- Capital punishment by country（revid 1382474148）各洲的表：狀態、最後一次執行、廢除的年份與附註
- 個別條目：Capital punishment in Myanmar（1381748260）、…in the Gambia（1337972156）、…in Chad（1315222782）、
  …in the Gaza Strip（1381377233）、…in Hong Kong（1224642605）、…in Macau（1370211679）、…in Taiwan（1379973876）、
  …in the Philippines（1378820095）
台灣最後一次執行的日期用法務部 2025-01-16 的新聞稿「法務部依法執行死刑 落實依法行政 彰顯司法正義」核對
（https://www.moj.gov.tw/2204/2795/2796/231525/post，政府資料開放授權條款第 1 版）。

分類（每年年底的狀態）：
1 保留：法律上有死刑，而且過去 10 年內執行過。
2 事實上廢除：法律上還有死刑（普通犯罪也適用），但已經 10 年以上沒有執行（那一年與之前 9 年都沒有執行）。
  依各國最後一次執行的年份自己判斷，不用國際特赦組織的名單（不能轉載）；
  只知道最後一次執行的國家，之前的年份當成有在執行，中間另有 10 年以上空檔的，只算進下面 GAPS 列出的。
3 只廢除普通犯罪：普通犯罪沒有死刑，戰時、軍法等例外仍保留。
4 全面廢除：所有犯罪都沒有死刑。

國家的變動照網站其他歷史主題的慣例，畫在今天的國界上：獨立以前用那個地方當時適用的法律與執行紀錄
（各國條目寫的「獨立以前最後一次執行」，例如蘇聯、南斯拉夫、捷克斯洛伐克、殖民地時期）；
德國 1949–1990 年是西德（基本法第 102 條 1949 年全面廢除；東德 1981 年最後一次執行、1987 年廢除，寫在附註）。
"""
from __future__ import annotations

FIRST_YEAR = 1950
LAST_YEAR = 2026

RETAIN, DE_FACTO, ORDINARY, ABOLISHED = 1, 2, 3, 4
DE_FACTO_YEARS = 10

# iso3 → (最後一次執行的年, 獨立的年, 廢除普通犯罪的年, 全面廢除的年)
# 最後一次執行是 None 時，「獨立的年」以後沒有執行過；獨立以前最後一次執行的年寫在 BEFORE_INDEPENDENCE
TABLE: dict[str, tuple[int | None, int | None, int | None, int | None]] = {
    # 非洲
    "DZA": (1993, None, None, None), "AGO": (1977, None, None, 1992), "BEN": (1987, None, None, 2012),
    "BWA": (2021, None, None, None), "BFA": (1988, None, 2018, None), "BDI": (2000, None, None, 2009),
    "CMR": (1997, None, None, None), "CPV": (None, 1975, None, 1981), "CAF": (1981, None, None, 2022),
    "TCD": (2015, None, None, 2020), "COM": (1997, None, None, None), "COG": (1982, None, None, 2015),
    "COD": (2003, None, None, None), "DJI": (None, 1977, None, 1995), "EGY": (2024, None, None, None),
    "GNQ": (2014, None, 2022, None), "ERI": (1989, None, None, None), "SWZ": (1983, None, None, None),
    "ETH": (2007, None, None, None), "GAB": (1985, None, None, 2010), "GMB": (2012, None, None, None),
    "GHA": (1993, None, 2023, None), "GIN": (2001, None, 2016, 2017), "GNB": (1986, None, None, 1993),
    "CIV": (None, 1960, None, 2000), "KEN": (1987, None, None, None), "LSO": (1995, None, None, None),
    "LBR": (2000, None, None, None), "LBY": (2010, None, None, None), "MDG": (None, 1960, None, 2014),
    "MWI": (1992, None, None, None), "MLI": (1980, None, None, None), "MRT": (1987, None, None, None),
    "MUS": (1987, None, None, 1995), "MAR": (1993, None, None, None), "MOZ": (1986, None, None, 1990),
    "NAM": (None, 1990, None, 1990), "NER": (1976, None, None, None), "NGA": (2016, None, None, None),
    "RWA": (1998, None, None, 2007), "STP": (None, 1975, None, 1990), "SEN": (1967, None, None, 2004),
    "SYC": (None, 1976, None, 1993), "SLE": (1998, None, None, 2021), "SOM": (2024, None, None, None),
    "ZAF": (1989, None, None, 1995), "SSD": (2025, None, None, None), "SDN": (2025, None, None, None),
    "TZA": (1994, None, None, None), "TGO": (1978, None, None, 2009), "TUN": (1990, None, None, None),
    "UGA": (2005, None, None, None), "ZMB": (1997, None, 2022, 2023), "ZWE": (2005, None, 2024, None),
    # 美洲
    "ATG": (1991, None, None, None), "ARG": (1956, None, 1984, 2009), "BHS": (2000, None, None, None),
    "BRB": (1984, None, None, None), "BLZ": (1985, None, None, None), "BOL": (1973, None, 1997, 2009),
    "BRA": (1876, None, 1978, None), "CAN": (1962, None, 1976, 1999), "CHL": (1985, None, 2001, None),
    "COL": (1907, None, None, 1910), "CRI": (1859, None, None, 1877), "CUB": (2003, None, None, None),
    "DMA": (1986, None, None, None), "DOM": (1966, None, None, 1966), "ECU": (1884, None, None, 1906),
    "SLV": (1973, None, 1983, None), "GRD": (1978, None, None, None), "GTM": (2000, None, 2017, None),
    "GUY": (1997, None, None, None), "HTI": (1972, None, None, 1987), "HND": (1940, None, None, 1956),
    "JAM": (1988, None, None, None), "MEX": (1961, None, None, 2005), "NIC": (1930, None, None, 1979),
    "PAN": (1903, None, None, 1918), "PRY": (1917, None, None, 1992), "PER": (1979, None, 1979, None),
    "KNA": (2008, None, None, None), "LCA": (1995, None, None, None), "VCT": (1995, None, None, None),
    "SUR": (1982, None, None, 2015), "TTO": (1999, None, None, None), "USA": (2026, None, None, None),
    "URY": (1902, None, None, 1907), "VEN": (None, 1830, None, 1863),
    # 亞洲
    "AFG": (2021, None, None, None), "ARM": (None, 1991, None, 1998), "AZE": (1993, None, None, 1998),
    "BHR": (2019, None, None, None), "BGD": (2025, None, None, None), "BTN": (1974, None, None, 2004),
    "BRN": (None, 1984, None, None), "MMR": (2024, None, None, None), "KHM": (1989, None, None, 1989),
    "CHN": (2026, None, None, None), "CYP": (1962, None, None, 2002), "TLS": (None, 2002, None, 2002),
    "GEO": (1995, None, None, 2006), "IND": (2020, None, None, None), "IDN": (2016, None, None, None),
    "IRN": (2026, None, None, None), "IRQ": (2026, None, None, None), "ISR": (1962, None, 1954, None),
    "JPN": (2026, None, None, None), "JOR": (2026, None, None, None), "KAZ": (2003, None, None, 2021),
    "KWT": (2025, None, None, None), "KGZ": (None, 1991, None, 2007), "LAO": (1989, None, None, None),
    "LBN": (2004, None, None, 2026), "MYS": (2017, None, None, None), "MDV": (None, 1965, None, None),
    "MNG": (2008, None, None, 2012), "NPL": (1979, None, None, 1997), "PRK": (2025, None, None, None),
    "OMN": (2024, None, None, None), "PAK": (2019, None, None, None), "PSE": (2022, None, None, None),
    "PHL": (2000, None, None, 2006), "QAT": (2020, None, None, None), "SAU": (2025, None, None, None),
    "SGP": (2025, None, None, None), "KOR": (1997, None, None, None), "LKA": (1976, None, None, None),
    "SYR": (2024, None, None, None), "TWN": (2025, None, None, None), "TJK": (2004, None, None, None),
    "THA": (2018, None, None, None), "TUR": (1984, None, None, 2004), "TKM": (1997, None, None, 1999),
    "ARE": (2025, None, None, None), "UZB": (2005, None, None, 2008), "VNM": (2024, None, None, None),
    "YEM": (2025, None, None, None),
    # 歐洲
    "ALB": (1995, None, None, 2007), "AND": (1943, None, None, 1990), "AUT": (1950, None, None, 1968),
    "BLR": (2024, None, None, None), "BEL": (1950, None, None, 1996), "BIH": (None, 1991, None, 1998),
    "BGR": (1989, None, None, 1998), "HRV": (None, 1991, None, 1991), "CZE": (None, 1993, None, 1990),
    "DNK": (1950, None, 1951, 1978), "EST": (1991, None, None, 1998), "FIN": (1944, None, 1949, 1972),
    "FRA": (1977, None, None, 1981), "DEU": (1981, None, None, 1949), "GRC": (1972, None, None, 2004),
    "HUN": (1988, None, None, 1990), "ISL": (None, 1944, None, 1928), "IRL": (1954, None, None, 1990),
    "ITA": (1947, None, 1948, 1994), "XKX": (None, 2008, None, 2008), "LVA": (1996, None, 1999, 2012),
    "LIE": (1785, None, None, 1989), "LTU": (1995, None, None, 1998), "LUX": (1949, None, None, 1979),
    "MLT": (None, 1964, 1971, 2000), "MDA": (None, 1991, None, 2005), "MCO": (1847, None, None, 1962),
    "MNE": (None, 2006, None, 1995), "NLD": (1952, None, 1870, 1982), "MKD": (None, 1991, None, 1991),
    "NOR": (1948, None, 1902, 1979), "POL": (1988, None, None, 1998), "PRT": (1917, None, 1867, 1976),
    "ROU": (1989, None, None, 1990), "RUS": (1996, None, None, None), "SMR": (1468, None, None, 1865),
    "SRB": (None, 2006, None, 1995), "SVK": (None, 1993, None, 1990), "SVN": (None, 1991, None, 1991),
    "ESP": (1975, None, 1978, 1995), "SWE": (1910, None, 1921, 1973), "CHE": (1944, None, 1938, 1992),
    "UKR": (1997, None, None, 2000), "GBR": (1964, None, 1969, 1998), "VAT": (1870, None, None, 1969),
    # 大洋洲
    "AUS": (1967, None, None, 1985), "FJI": (None, 1970, 1979, 2015), "KIR": (None, 1979, None, 1979),
    "MHL": (None, 1986, None, 1986), "FSM": (None, 1986, None, 1986), "NRU": (None, 1968, None, 2016),
    "NZL": (1957, None, 1961, 1989), "PLW": (None, 1994, None, 1994), "PNG": (None, 1975, None, 2022),
    "WSM": (None, 1962, None, 2004), "SLB": (None, 1978, None, 1978), "TON": (1982, None, None, None),
    "TUV": (None, 1978, None, 1978), "VUT": (None, 1980, None, 1980),
    # 有自己刑法的屬地（條目各自的表或附註）
    "HKG": (1966, None, None, 1993),
    "MAC": (None, None, 1867, 1976),  # 葡萄牙的刑法；19 世紀以後沒有執行
    "COK": (None, None, None, 2007),  # 紐西蘭的自由聯合國，從來沒有執行過
    "NIU": (None, None, None, 1966),
}
# 獨立以前最後一次執行的年（條目寫的「None since independence (…, before independence)」）
BEFORE_INDEPENDENCE = {
    "CPV": 1835, "MDG": 1958, "NAM": 1988, "ARM": 1991, "BRN": 1957, "MDV": 1953, "BIH": 1977, "HRV": 1987,
    "CZE": 1989, "ISL": 1830, "XKX": 1987, "MLT": 1943, "MNE": 1981, "MKD": 1988, "SRB": 1992, "SVK": 1989,
    "SVN": 1959, "FJI": 1964, "PNG": 1957, "WSM": 1952,
}
# 中間有 10 年以上沒有執行、之後又恢復的空檔：iso3 → [(空檔前最後一次, 恢復的那一年)]
GAPS: dict[str, list[tuple[int, int]]] = {
    "GMB": [(1965, 1981), (1981, 2012)],  # 1965 年獨立到 1981 年 Mustapha Danso 之間沒有執行（獨立以前的不清楚，從獨立起算）
    "MMR": [(1988, 2022)],
    "TCD": [(2003, 2015)],
}
# 法律不只一次改變的國家：iso3 → [(從哪一年年底起, 法律狀態)]，取代 TABLE 的廢除年份
# 法律狀態：'retain' 保留、'ordinary' 只廢除普通犯罪、'abolished' 全面廢除
PERIODS: dict[str, list[tuple[int, str]]] = {
    # 1922 年刑法全面廢除，軍法保留；軍政府 1970–1973、1976–1984 年恢復
    "ARG": [(1950, "ordinary"), (1970, "retain"), (1973, "ordinary"), (1976, "retain"), (1984, "ordinary"), (2009, "abolished")],
    # 共和國 1889 年起普通犯罪沒有死刑；1969–1978 年恢復於「內戰」性質的恐怖、顛覆行為
    "BRA": [(1950, "ordinary"), (1969, "retain"), (1978, "ordinary")],
    "GMB": [(1950, "retain"), (1993, "abolished"), (1995, "retain")],
    # 1946 年廢除普通犯罪，1985–1990 年對謀殺與恐怖行為恢復
    "NPL": [(1950, "ordinary"), (1985, "retain"), (1990, "ordinary"), (1997, "abolished")],
    "PHL": [(1950, "retain"), (1987, "abolished"), (1993, "retain"), (2006, "abolished")],
    "PNG": [(1950, "retain"), (1970, "abolished"), (1991, "retain"), (2022, "abolished")],
    # 2014 年的新刑法 2017 年公布施行，反恐法保留到 2020 年
    "TCD": [(1950, "retain"), (2017, "ordinary"), (2020, "abolished")],
    # 2026 年立法對恐怖攻擊致死恢復死刑（強制判處）
    "ISR": [(1950, "retain"), (1954, "ordinary"), (2026, "retain")],
    # 1945–1950 年溯及占領時期罪行的法律 1951 年廢止，之後只剩戰爭罪
    "DNK": [(1950, "retain"), (1951, "ordinary"), (1978, "abolished")],
}
# 跟隨另一個國家（屬地、獨立以前的地區）：iso3 → (國家, 到哪一年為止；None 是一直)
FOLLOWS: dict[str, tuple[str, int | None]] = {
    "XKX": ("SRB", 2007),  # 2008 年宣布獨立以前算塞爾維亞
    "SSD": ("SDN", 2010),
    "GRL": ("DNK", None), "FRO": ("DNK", None), "ALA": ("FIN", None), "SJM": ("NOR", None),
    "GUF": ("FRA", None), "GLP": ("FRA", None), "MTQ": ("FRA", None), "REU": ("FRA", None), "MYT": ("FRA", None),
    "BLM": ("FRA", None), "MAF": ("FRA", None), "SPM": ("FRA", None), "NCL": ("FRA", None), "PYF": ("FRA", None),
    "WLF": ("FRA", None),
    "NFK": ("AUS", None), "CXR": ("AUS", None), "CCK": ("AUS", None), "_IOT": ("AUS", None),
}
# 附註：iso3 → (中文, 英文)
EXTRA_NOTES: dict[str, tuple[str, str]] = {
    "TWN": ("最後一次執行在 2025 年 1 月 16 日（法務部新聞稿）；憲法法庭 2024 年 9 月的 113 年憲判字第 8 號判決認定死刑合憲，但限於犯罪情節最嚴重的案件",
            "The last execution was on 16 January 2025 (Ministry of Justice press release); in September 2024 the Constitutional "
            "Court held the death penalty constitutional, but only for the most serious crimes"),
    "DEU": ("1949–1990 年是西德：基本法第 102 條 1949 年全面廢除；東德 1981 年最後一次執行、1987 年廢除",
            "1949–1990 is West Germany, where Article 102 of the Basic Law abolished it in 1949; East Germany carried out its "
            "last execution in 1981 and abolished it in 1987"),
    "USA": ("聯邦與 27 州有死刑，其他州已廢除", "Federal law and 27 states have the death penalty; the other states have abolished it"),
    "CHN": ("香港 1993 年、澳門 1976 年廢除，地圖上分開畫", "Abolished in Hong Kong in 1993 and Macau in 1976, shown separately on the map"),
    "HKG": ("英國殖民政府 1993 年的《刑事罪行（修訂）條例》廢除", "Abolished by the Crimes (Amendment) Ordinance 1993 under British rule"),
    "MAC": ("葡萄牙殖民政府 1976 年廢除，1995 年的《澳門刑法典》重申；19 世紀以後沒有執行",
            "Abolished in 1976 under Portuguese rule and restated in the 1995 Penal Code of Macau; no executions since the 19th century"),
    "COK": ("紐西蘭的自由聯合國，從來沒有執行過", "A state in free association with New Zealand; there has never been an execution"),
    "NIU": ("紐西蘭的自由聯合國，從來沒有執行過", "A state in free association with New Zealand; there has never been an execution"),
    "GBR": ("1969 年英國本島廢除謀殺罪的死刑（北愛爾蘭 1973 年），1998 年廢除叛國罪等其餘的罪；英國屬地最後一次執行是 1977 年的百慕達",
            "Abolished for murder in Great Britain in 1969 (Northern Ireland 1973) and for the remaining offences such as treason "
            "in 1998; the last execution in a British territory was in Bermuda in 1977"),
    "IRL": ("1964 年廢除大部分謀殺罪的死刑，1990 年全面廢除；1954 年以後判處的死刑都減刑",
            "Abolished for most murders in 1964 and for all offences in 1990; every death sentence after 1954 was commuted"),
    "ISR": ("1954 年廢除普通犯罪的死刑，只剩叛國與危害人類罪；2026 年立法對恐怖攻擊致死恢復強制死刑。建國以後只執行過兩次（1948、1962 年）",
            "Abolished for ordinary crimes in 1954, keeping it for treason and crimes against humanity; a 2026 law reintroduced a "
            "mandatory death sentence for deadly terrorism. Only two executions since 1948 (1948 and 1962)"),
    "PSE": ("巴勒斯坦自治政府最後一次執行在 2005 年；加薩的哈瑪斯政府 2022 年 9 月仍有執行",
            "The Palestinian Authority's last execution was in 2005; the Hamas government in Gaza carried out executions as recently as September 2022"),
    "MMR": ("1988 年到 2022 年 7 月之間沒有執行，之後軍政府恢復執行", "No executions between 1988 and July 2022, when the military government resumed them"),
    "GMB": ("1993 年廢除，1995 年軍政府恢復；1981 年以後到 2012 年 8 月之間沒有執行；2018 年起暫停執行",
            "Abolished in 1993 and reinstated by the military government in 1995; no executions between 1981 and August 2012; "
            "a moratorium since 2018"),
    "TCD": ("2003 年到 2015 年之間沒有執行；2014 年的新刑法 2017 年施行，廢除普通犯罪的死刑，反恐法保留到 2020 年",
            "No executions between 2003 and 2015; the 2014 penal code, in force from 2017, abolished it for ordinary crimes, "
            "and the anti-terrorism law kept it until 2020"),
    "PHL": ("1987 年憲法廢除，1993 年恢復，1999–2000 年有執行，2006 年再廢除；1987 年以前最後一次執行的年份不清楚",
            "Abolished by the 1987 Constitution, reinstated in 1993 with executions in 1999–2000, and abolished again in 2006; "
            "the year of the last execution before 1987 is not clear"),
    "PNG": ("1970 年廢除，1991 年恢復但沒有執行，2022 年再廢除", "Abolished in 1970, reinstated in 1991 without executions, and abolished again in 2022"),
    "NPL": ("1946 年廢除普通犯罪的死刑，1985–1990 年對謀殺與恐怖行為恢復", "Abolished for ordinary crimes in 1946, reinstated for murder and terrorism in 1985–1990"),
    "ARG": ("1922 年的刑法全面廢除，軍政府 1970–1973、1976–1984 年恢復；軍法 2009 年廢除",
            "Abolished by the 1922 Penal Code but reinstated by military governments in 1970–1973 and 1976–1984; abolished in military law in 2009"),
    "BRA": ("共和國 1889 年起普通犯罪沒有死刑，1969–1978 年對恐怖、顛覆行為恢復；現在只保留宣戰後的軍事犯罪",
            "No death penalty for ordinary crimes since the 1889 republic, except in 1969–1978 for terrorism and subversion; "
            "it remains only for military crimes in a declared war"),
    "DNK": ("普通犯罪最後一次執行在 1892 年；1945–1950 年溯及占領時期罪行的法律 1951 年廢止",
            "The last execution for an ordinary crime was in 1892; a retroactive law for crimes of the German occupation (1945–1950) was repealed in 1951"),
    "MEX": ("最後一次執行：普通犯罪 1957 年、軍法 1961 年", "The last executions were in 1957 (civilian) and 1961 (military)"),
    "CAN": ("1976 年廢除謀殺、叛國等罪的死刑，1999 年廢除軍法的死刑", "Abolished for murder, treason and piracy in 1976 and for military offences in 1999"),
    "AUS": ("各州陸續廢除，最後是 1985 年的新南威爾斯", "Abolished state by state, the last being New South Wales in 1985"),
    "RUS": ("1996 年 8 月以後沒有執行，1999 年起暫停執行", "No executions since August 1996, with a moratorium since 1999"),
    "KOR": ("1998 年 2 月起非正式暫停執行", "An unofficial moratorium since February 1998"),
    "MDV": ("獨立以前最後一次執行在 1953 年；2014 年取消暫停執行，但沒有執行", "The last execution, in 1953, was before independence; a moratorium was lifted in 2014, but there have been no executions"),
    "LBN": ("2026 年 8 月國會廢除", "Abolished by parliament in August 2026"),
    "CHE": ("1938 年公投廢除（1942 年刑法施行），戰時軍法 1992 年廢除", "Abolished by a 1938 referendum (in force with the 1942 Criminal Code), and in wartime military law in 1992"),
    "SVN": ("1989 年斯洛維尼亞共和國的憲法廢除（當時還屬於南斯拉夫）", "Abolished in 1989 by the constitution of the Slovenian republic, then part of Yugoslavia"),
    "XKX": ("2008 年宣布獨立以前算塞爾維亞", "Counted as Serbia before the 2008 declaration of independence"),
}

# 只用 EXTRA_NOTES 的附註（自動產生的句子會誤導）
OWN_NOTES_ONLY = {"DEU", "TWN"}


def _law(iso3: str, year: int, ordinary: int | None, abolished: int | None) -> str:
    if iso3 in PERIODS:
        state = "retain"
        for start, s in PERIODS[iso3]:
            if start <= year:
                state = s
        return state
    if abolished is not None and abolished <= year:
        return "abolished"
    if ordinary is not None and ordinary <= year:
        return "ordinary"
    return "retain"


def _last_execution(iso3: str, year: int) -> int | None:
    """那一年年底以前最後一次執行的年；None 是從來沒有執行過（或沒有紀錄）。"""
    last, indep, _, _ = TABLE[iso3]
    if last is None:
        if indep is None:
            return None
        before = BEFORE_INDEPENDENCE.get(iso3)
        if before is not None:
            return min(before, year)
        # 獨立以前最後一次執行的年不清楚：獨立以前當成有在執行（殖民地、聯邦時期），獨立以後從獨立那年起算
        return year if year < indep else indep
    if year >= last:
        return last
    for a, b in GAPS.get(iso3, []):
        if a <= year < b:
            return a
    return year


def _category(iso3: str, year: int) -> int:
    _, indep, ordinary, abolished = TABLE[iso3]
    law = _law(iso3, year, ordinary, abolished)
    if law == "abolished":
        return ABOLISHED
    if law == "ordinary":
        return ORDINARY
    last = _last_execution(iso3, year)
    if last is None or year - last >= DE_FACTO_YEARS:
        return DE_FACTO
    return RETAIN


def _notes(iso3: str) -> tuple[str, str]:
    last, indep, ordinary, abolished = TABLE[iso3]
    zh: list[str] = []
    en: list[str] = []
    if iso3 in OWN_NOTES_ONLY:
        return EXTRA_NOTES[iso3][0] + "。", EXTRA_NOTES[iso3][1] + "."
    if iso3 not in PERIODS:
        if ordinary is not None:
            zh.append(f"{ordinary} 年廢除普通犯罪的死刑")
            en.append(f"abolished for ordinary crimes in {ordinary}")
        if abolished is not None:
            zh.append(f"{abolished} 年全面廢除")
            en.append(f"abolished for all crimes in {abolished}")
    if last is not None:
        zh.append(f"最後一次執行在 {last} 年")
        en.append(f"last execution in {last}")
    elif indep is not None:
        before = BEFORE_INDEPENDENCE.get(iso3)
        if before is not None:
            zh.append(f"{indep} 年獨立以後沒有執行過，獨立以前最後一次在 {before} 年")
            en.append(f"no executions since independence in {indep}; the last before independence was in {before}")
        else:
            zh.append(f"{indep} 年獨立以後沒有執行過；獨立以前最後一次執行的年份不清楚，事實上廢除從獨立那年起算")
            en.append(f"no executions since independence in {indep}; the last execution before independence is not known, "
                      "so the ten years are counted from independence")
    if iso3 in EXTRA_NOTES:
        zh.append(EXTRA_NOTES[iso3][0])
        en.append(EXTRA_NOTES[iso3][1])
    text_en = "; ".join(en)
    return "；".join(zh) + "。", text_en[:1].upper() + text_en[1:] + "."


def status(iso3s: list[str]) -> tuple[dict[str, dict[int, int]], dict[str, tuple[str, str]]]:
    """({iso3: {年: 分類}}, {iso3: (中文附註, 英文附註)})，年份 FIRST_YEAR–LAST_YEAR。"""
    out: dict[str, dict[int, int]] = {}
    notes: dict[str, tuple[str, str]] = {}
    for iso3 in iso3s:
        follow = FOLLOWS.get(iso3)
        if iso3 not in TABLE and follow is None:
            continue
        years: dict[int, int] = {}
        for y in range(FIRST_YEAR, LAST_YEAR + 1):
            if follow and (follow[1] is None or y <= follow[1]):
                years[y] = _category(follow[0], y)
            elif iso3 in TABLE:
                years[y] = _category(iso3, y)
        out[iso3] = years
        if iso3 in TABLE:
            notes[iso3] = _notes(iso3)
        elif follow:
            notes[iso3] = ("跟所屬國家適用同樣的刑法。", "The same criminal law as the sovereign country applies.")
    return out, notes
