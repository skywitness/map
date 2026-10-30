"""一夫多妻（多偶婚）的法律地位：各國的法律承不承認多偶婚。自行整理的表。

依據英文維基百科「Legality of polygamy」（revid 1378459627，2026-10-04，CC BY-SA 4.0；原條目名「Legal status of
polygamy」已轉址），所以這張表與輸出的資料檔（`polygamy.json`）依 CC BY-SA 4.0 分享。條目頂端標示
{{morefootnotes}}（出處不足），是條目整理的狀態，不是逐國查證的法律。

分類照條目的四份清單（條目的地圖圖例是「合法、只限穆斯林、違法但實際不處罰、違法且處罰」，跟清單不一致，用清單）：
1 承認：法律承認多偶婚（大多數是伊斯蘭法的一夫多妻，有的要經過法院或原配同意）。
2 只承認穆斯林的多偶婚：有專門適用於穆斯林的婚姻法，其他人不行。
3 只依習慣法承認：依傳統習慣法締結的婚姻可以多偶，民法的婚姻不行。
4 不承認：法律只承認一夫一妻，重婚無效或是犯罪（處不處罰各國不同）。
條目同時列在兩份清單的國家（奈及利亞在「承認」與「習慣法」、印度在「穆斯林」與「習慣法」），依條目對它的說明
歸一類，附註寫另一種；條目寫「European Union: illegal in all 27 states」的展開成 27 個會員國。
條目沒列的國家沒有值。
"""
from __future__ import annotations

YEAR = 2026
RECOGNIZED, MUSLIMS_ONLY, CUSTOMARY, NOT_RECOGNIZED = 1, 2, 3, 4

EU = ["AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "IRL", "ITA",
      "LVA", "LTU", "LUX", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE"]

STATUS: dict[int, list[str]] = {
    RECOGNIZED: [
        # 非洲（條目的索馬利蘭併入索馬利亞）
        "DZA", "CMR", "TCD", "CAF", "COM", "COG", "DJI", "EGY", "SWZ", "GAB", "GMB", "GIN", "GNB", "LBY", "KEN",
        "MLI", "MRT", "MAR", "STP", "SEN", "SOM", "SSD", "ZAF", "SDN", "TGO", "TZA", "UGA", "ZMB",
        # 亞洲
        "AFG", "BHR", "BGD", "BTN", "BRN", "IDN", "IRN", "IRQ", "JOR", "KWT", "MDV", "OMN", "QAT", "PSE", "SAU",
        "SYR", "ARE", "YEM",
        # 大洋洲
        "SLB",
    ],
    MUSLIMS_ONLY: ["MYS", "PHL", "LKA", "LBN", "PAK", "SGP", "IND"],
    CUSTOMARY: ["BWA", "LSO", "LBR", "MWI", "NAM", "NER", "NGA", "SLE", "ZWE"],
    NOT_RECOGNIZED: [
        # 非洲
        "AGO", "BEN", "BFA", "BDI", "CPV", "COD", "CIV", "ERI", "GNQ", "GHA", "ETH", "MDG", "MUS", "MYT", "MOZ",
        "RWA", "SYC", "TUN",
        # 美洲
        "ATG", "ARG", "BHS", "BRB", "BLZ", "BOL", "BRA", "CAN", "CHL", "COL", "CRI", "CUB", "DMA", "DOM", "ECU",
        "SLV", "GRD", "GTM", "GUY", "HTI", "HND", "JAM", "MEX", "NIC", "PAN", "PRY", "PER", "KNA", "LCA", "VCT",
        "SUR", "TTO", "USA", "URY", "VEN",
        # 亞洲
        "NPL", "CHN", "HKG", "ISR", "JPN", "KAZ", "KGZ", "MNG", "MMR", "PRK", "KOR", "TWN", "TJK", "TUR", "TKM",
        "UZB", "VNM", "KHM", "LAO", "RUS", "THA", "TLS",
        # 歐洲
        "ALB", "ARM", "AND", "AZE", "BLR", "BIH", *EU, "GEO", "ISL", "XKX", "LIE", "MDA", "MCO", "MNE", "MKD",
        "NOR", "SMR", "SRB", "CHE", "UKR", "GBR", "VAT",
        # 大洋洲
        "AUS", "FJI", "KIR", "MHL", "FSM", "NRU", "NZL", "PLW", "PNG", "WSM", "TON", "TUV", "VUT",
    ],
}

# 附註（條目的說明；台灣依全國法規資料庫）：iso3 → (中文, 英文)
NOTES: dict[str, tuple[str, str]] = {
    "TWN": ("民法第 985 條：有配偶者，不得重複結婚；重婚依刑法第 237 條處罰",
            "Civil Code Article 985 prohibits a married person from marrying again; bigamy is punishable under Article 237 of the Criminal Code"),
    "NGA": ("條目同時列在「承認」與「只依習慣法承認」：習慣法的婚姻可以多偶，北部實施伊斯蘭法的各州也承認；依法登記的婚姻不行",
            "Listed under both “recognized” and “customary law only”: customary marriages may be polygamous, and the northern Sharia states also recognize it; statutory marriages may not"),
    "IND": ("穆斯林依穆斯林屬人法可以多偶；條目另寫果阿依當地的習慣法",
            "Muslims may take more than one wife under Muslim personal law; the article also notes customary law in Goa"),
    "ZAF": ("依習慣法締結的婚姻承認多偶，最高法院也承認依伊斯蘭法締結的婚姻",
            "Polygamy is recognized for customary marriages, and the Supreme Court has held Muslim marriages valid"),
    "PHL": ("只有穆斯林，而且限於能平等對待每位妻子的「例外情形」",
            "Muslims only, and only in “exceptional cases” where a man can treat his wives equally"),
    "IRQ": ("伊拉克庫德斯坦地區除外", "Except in Iraqi Kurdistan"),
    "SYR": ("敘利亞庫德斯坦（東北部）除外", "Except in Syrian Kurdistan (the northeast)"),
    "SOM": ("含索馬利蘭", "Including Somaliland"),
    "KEN": ("2014 年的婚姻法起承認", "Recognized under legislation passed in 2014"),
    "KAZ": ("不承認多偶婚，但 1998 年起不處罰", "Polygamous marriages are not recognized, but the practice has not been a crime since 1998"),
    "RUS": ("不承認多偶婚（家庭法典），但重婚不處罰", "Polygamous marriages are not recognized (Family Code), but bigamy is not a crime"),
    "HKG": ("1971 年起廢除；之前依習慣法締結的婚姻在某些情形仍承認",
            "Abolished in 1971; earlier customary unions are still recognized in some situations"),
    "MYT": ("法屬馬約特：2009 年公投後適用法國法律，之前已締結的多偶婚仍有效",
            "French Mayotte: French law has applied since the 2009 referendum; pre-existing polygamous marriages remain valid"),
    "GBR": ("在國外依法締結的多偶婚可以領部分福利（逐步取消中）；在英國再婚是重婚罪",
            "Foreign polygamous marriages grant some welfare benefits (being phased out); marrying again in the UK is bigamy"),
    "NZL": ("不能在國內締結，但承認在允許多偶的國家依法締結的婚姻",
            "Polygamous marriages cannot be performed in New Zealand but are recognized if lawfully contracted abroad"),
    "CHE": ("在國外締結的多偶婚依個案承認或不承認", "Polygamous marriages contracted abroad may be accepted or rejected case by case"),
    "AUS": ("不能在國內締結；部分原住民社群仍有多偶關係",
            "Polygamous marriages cannot be performed in Australia; polygamous relationships persist in some Indigenous communities"),
}


def status(countries: list[str]) -> tuple[dict[str, int], dict[str, tuple[str, str]]]:
    """({iso3: 類別}, {iso3: (中文附註, 英文附註)})；只收地圖上有的國家"""
    known = set(countries)
    out: dict[str, int] = {}
    for value, codes in STATUS.items():
        for iso3 in codes:
            if iso3 in out:
                raise RuntimeError(f"{iso3} 同時在兩類")
            if iso3 in known:
                out[iso3] = value
    missing = [c for codes in STATUS.values() for c in codes if c not in known]
    if missing:
        print(f"  一夫多妻：地圖上沒有 {missing}")
    return out, {c: n for c, n in NOTES.items() if c in out}
