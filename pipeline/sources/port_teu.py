"""主要貨櫃港自己公布的年貨櫃吞吐量（TEU）：港務局、港口公司或政府的統計，引用事實並註明出處。

- 只用官方來源（港務局、港口公司、政府統計）。Lloyd's List 的 Top 100、Alphaliner 這類有版權的排名沒有用，
  也不照它們的名單或排序；這裡只是在港口的點上寫出該港自己公布的數字，前端不排名。
- 2025 年的數字（2026-10-26 查）；官方還沒公布 2025 年港口數字的寫 2024 年（傑貝阿里：DP World 2025 年只公布集團合計）。
- 找不到官方數字的沒有收：林查班（泰國港務局的網站連不上，交通部開放資料只有月資料、而且只到 2025 年 11 月）、
  胡志明市／蓋梅（只有全國的估計）、蒙德拉（私人公司經營）。
- 台灣四個國際商港用臺灣港務公司的開放資料（sources/tipc.py，政府資料開放平臺 8368）逐月加總，build() 會比對這裡的數字。
- 中國大陸的港口用交通運輸部《2025 年 12 月全國港口貨物、集裝箱吞吐量》，單位是萬 TEU（只精確到 1 萬）。
- wpi 是 World Port Index 的港口編號（點畫在那裡）；scope 是口徑說明（全港包含哪些港區），空字串就是那個港。
"""
from __future__ import annotations

from typing import NamedTuple


class PortTeu(NamedTuple):
    wpi: int
    zh: str
    en: str
    year: int
    teu: int
    publisher: str
    publisher_en: str
    url: str
    #  發布日期（YYYY-MM-DD）；網頁沒有寫的是空字串
    published: str
    scope: str = ""
    scope_en: str = ""
    #  官方只寫到這個精度（例如萬 TEU、0.01 百萬 TEU）
    rounded: bool = False


MOT_CN = (
    "中國交通運輸部《2025 年 12 月全國港口貨物、集裝箱吞吐量》",
    "Ministry of Transport of China, port cargo and container throughput, December 2025",
    "https://xxgk.mot.gov.cn/jigou/zhghs/202601/P020260130498887936897.pdf",
    "2026-01-30",
)
MOT_MY = (
    "馬來西亞交通部海事統計表 3.5（各港貨櫃量，2025 年）",
    "Ministry of Transport Malaysia, maritime statistics table 3.5 (containers handled by port, 2025)",
    "https://www.mot.gov.my/en/Statistik%20Maritim/2025%204%20-%20SUKU%20IV%202025/"
    "JADUAL%203.5%20JUMLAH%20KONTENA%20YANG%20DIKENDALIKAN%20MENGIKUT%20PELABUHAN,%20MALAYSIA,%202025.pdf",
    "",
)
TIPC = (
    "臺灣港務公司（政府資料開放平臺 8368「臺灣地區國際商港貨櫃裝卸量」）",
    "Taiwan International Ports Corporation (data.gov.tw dataset 8368)",
    "https://data.gov.tw/dataset/8368",
    "",
)


def _p(wpi, zh, en, year, teu, source, scope=("", ""), rounded=False) -> PortTeu:
    return PortTeu(wpi, zh, en, year, teu, source[0], source[1], source[2], source[3], scope[0], scope[1], rounded)


PORTS: list[PortTeu] = [
    _p(59970, "上海港", "Shanghai", 2025, 55_060_000, MOT_CN, rounded=True),
    _p(50000, "新加坡港", "Singapore", 2025, 44_660_000,
       ("新加坡海事及港務管理局（MPA）2026-01-13 新聞稿", "Maritime and Port Authority of Singapore, press release of 13 January 2026",
        "https://www.mpa.gov.sg/media-centre/details/singapore-posts-record-port-performance-in-2025-and-develops-"
        "future-readiness-through-industry-collaborations-for-2026", "2026-01-13"),
       ("全港（WPI 的點在吉寶港區）", "whole port (the WPI point is at Keppel)"), rounded=True),
    _p(59940, "寧波舟山港", "Ningbo-Zhoushan", 2025, 43_870_000, MOT_CN,
       ("寧波舟山港全港", "whole port of Ningbo-Zhoushan"), rounded=True),
    _p(57857, "深圳港", "Shenzhen", 2025, 35_410_000, MOT_CN,
       ("深圳港全港（鹽田、蛇口、赤灣、大鏟灣等港區）", "whole port of Shenzhen (Yantian, Shekou, Chiwan, Dachan Bay…)"), rounded=True),
    _p(60140, "青島港", "Qingdao", 2025, 32_890_000, MOT_CN, rounded=True),
    _p(57830, "廣州港", "Guangzhou", 2025, 27_680_000, MOT_CN,
       ("廣州港全港（含南沙港區）", "whole port of Guangzhou (including Nansha)"), rounded=True),
    _p(60390, "釜山港", "Busan", 2025, 24_882_000,
       ("釜山港灣公社（BPA）貨櫃統計", "Busan Port Authority, container statistics",
        "https://www.busanpa.com/index.bpa?menuCd=DOM_000000105005001004", ""), rounded=True),
    _p(60190, "天津港", "Tianjin", 2025, 24_030_000, MOT_CN,
       ("天津港全港", "whole port of Tianjin"), rounded=True),
    _p(48276, "傑貝阿里港", "Jebel Ali", 2024, 15_500_000,
       ("DP World 2025-02-19 新聞稿（2025 年只公布集團合計）", "DP World, press release of 19 February 2025 (2025 figures only as a group total)",
        "https://www.dpworld.com/en/news/releases/uae/dp-world-records-highest-cargo-volumes-at-jebel-ali-port-since-2015",
        "2025-02-19"), rounded=True),
    _p(49930, "巴生港", "Port Klang", 2025, 15_138_772, MOT_MY),
    _p(31140, "鹿特丹港", "Rotterdam", 2025, 14_245_000,
       ("鹿特丹港務局《Throughput Port of Rotterdam 2025》", "Port of Rotterdam, Throughput Port of Rotterdam 2025",
        "https://www.portofrotterdam.com/sites/default/files/2026-02/throughput-port-of-rotterdam-2025.pdf", "2026-02-26"),
       rounded=True),
    _p(51587, "丹戎帕拉帕斯港", "Tanjung Pelepas", 2025, 14_028_375, MOT_MY),
    _p(31250, "安特衛普–布魯日港", "Antwerp-Bruges", 2025, 13_600_000,
       ("安特衛普–布魯日港務局 2025 年度數字", "Port of Antwerp-Bruges, 2025 annual figures",
        "https://newsroom.portofantwerpbruges.com/hubfs/260122_Factsheet_Jaarcijfers_2025_ENG.pdf", "2026-01-27"),
       ("安特衛普與澤布呂赫兩個港區合計", "Antwerp and Zeebrugge combined"), rounded=True),
    _p(57840, "香港港", "Hong Kong", 2025, 12_990_000,
       ("香港政府統計處（政府新聞公報 2026-03-05）", "Census and Statistics Department, Hong Kong (press release of 5 March 2026)",
        "https://www.info.gov.hk/gia/general/202603/05/P2026030500330.htm", "2026-03-05"), rounded=True),
    _p(57870, "廈門港", "Xiamen", 2025, 12_510_000, MOT_CN, rounded=True),
    _p(45753, "丹吉爾地中海港", "Tanger Med", 2025, 11_106_164,
       ("丹吉爾地中海港務局 2025 年營運新聞稿", "Tanger Med Port Authority, 2025 activity press release",
        "https://www.tangermed.ma/wp-content/uploads/press-releases/2026/CP-TMPA-BILAN-DE-LACTIVITE-PORTUAIRE-EN-2025.pdf",
        "2026-02-02")),
    _p(16080, "洛杉磯港", "Los Angeles", 2025, 10_239_318,
       ("洛杉磯港 2025 年貨櫃統計", "Port of Los Angeles, 2025 container statistics",
        "https://www.portoflosangeles.org/business/statistics/container-statistics/historical-teu-statistics-2025", "")),
    _p(16070, "長灘港", "Long Beach", 2025, 9_881_595,
       ("長灘港歷年貨櫃量", "Port of Long Beach, yearly TEUs", "https://polb.com/business/port-statistics/#yearly-teus", "")),
    _p(7640, "紐約–新澤西港", "New York/New Jersey", 2025, 8_897_531,
       ("紐約與新澤西港務局貨運統計", "Port Authority of New York and New Jersey, cargo volumes",
        "https://www.panynj.gov/port/en/our-port/facts-and-figures.html", ""),
       ("紐約與新澤西兩州的港區合計", "all terminals in New York and New Jersey")),
    _p(30780, "漢堡港", "Hamburg", 2025, 8_300_000,
       ("漢堡港務局 2026-02-19 新聞", "Hamburg Port Authority, news of 19 February 2026",
        "https://www.hamburg-port-authority.de/de/aktuelles-presse/default-eaceb1e4bdc2ac8c3e286fcac1c0de2b-4", "2026-02-19"),
       rounded=True),
    _p(49240, "可倫坡港", "Colombo", 2025, 8_291_178,
       ("斯里蘭卡港務局 2026-01-01 新聞", "Sri Lanka Ports Authority, news of 1 January 2026",
        "https://news.slpa.lk/index.php/2026/01/01/port-of-colombo-records-historic-high-of-8-29-million-teus-in-2025/",
        "2026-01-01")),
    _p(48845, "賈瓦哈拉爾·尼赫魯港", "Jawaharlal Nehru Port", 2025, 7_940_000,
       ("賈瓦哈拉爾·尼赫魯港務局（JNPA）新聞稿", "Jawaharlal Nehru Port Authority, press release",
        "https://www.jnport.gov.in/uploads/media_center/1/1308/JNPA_PR_-_CY_Performance_1-5-2025.pdf", ""), rounded=True),
    _p(38480, "瓦倫西亞港", "Valencia", 2025, 5_660_000,
       ("瓦倫西亞港務局 2026-02-09 新聞", "Valenciaport, news of 9 February 2026",
        "https://www.valenciaport.com/en/the-apv-council-assesses-the-economic-results-and-traffic-figures-for-2025/",
        "2026-02-09"), rounded=True),
    _p(61380, "東京港", "Tokyo", 2025, 4_860_000,
       ("東京都港灣局 2026-03-30 新聞稿（速報值）", "Tokyo Metropolitan Government, Bureau of Port and Harbor, press release of 30 March 2026 (preliminary)",
        "https://www.metro.tokyo.lg.jp/information/press/2026/03/2026033033", "2026-03-30"), rounded=True),
    _p(42230, "比雷埃夫斯港", "Piraeus", 2025, 4_641_295,
       ("比雷埃夫斯港務局（PPA）2025 年公司簡報", "Piraeus Port Authority, FY2025 corporate presentation",
        "https://www.olp.gr/images/pdffiles/Corporate_Presentation_PPA_FY25_2025.pdf", ""),
       ("第 1 碼頭與特許經營的第 2、3 碼頭合計", "Piers I, II and III combined")),
    _p(61390, "橫濱港", "Yokohama", 2025, 3_182_607,
       ("橫濱市港灣局 2025 年港灣統計速報", "City of Yokohama, Port and Harbor Bureau, 2025 preliminary port statistics",
        "https://www.city.yokohama.lg.jp/city-info/koho-kocho/press/kowan/2025/0330nensokuhou2025.files/R07nensokuhou.pdf",
        "2026-03-30")),
    # 台灣：臺灣港務公司的開放資料逐月加總（build() 用 sources/tipc.py 重算並比對）
    _p(57920, "高雄港", "Kaohsiung", 2025, 8_885_855, TIPC),
    _p(57890, "基隆港", "Keelung", 2025, 1_603_563, TIPC),
    _p(57955, "臺中港", "Taichung", 2025, 1_590_768, TIPC),
    _p(57935, "臺北港", "Taipei", 2025, 1_463_658, TIPC),
]

# 沒有官方吞吐量、但 World Port Index 的英文名稱不好認的港口：台灣其他港與 WPI 用舊拼音的港口
NAMES: dict[int, tuple[str, str]] = {
    57910: ("花蓮港", "Hualien"),
    57900: ("蘇澳港", "Su-ao"),
    57953: ("麥寮港", "Mailiao"),
    57950: ("澎湖（馬公）港", "Penghu (Magong)"),
}
