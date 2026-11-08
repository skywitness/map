"""樂園的四種所有權關係（2026-11-08，製作手冊第二十八批 684，候選 1531；迪士尼與環球影城兩個主題共用）。

手冊：「環球影城」與「迪士尼」底下都有四種關係，畫成一樣的點會騙人，分類兩個主題共用：
1 全資：母公司直接擁有與經營
2 全資子公司：另一個法人經營，母公司持有全部（日本環球影城的 USJ 合同会社；巴黎的 Euro Disney，2017 年起迪士尼持有全部）
3 合資、母公司是小股東：北京環球（首寰 70%、NBCUniversal 30%）、香港迪士尼（港府 52%、迪士尼 48%）、上海迪士尼（申迪 57%、迪士尼 43%）
4 只授權、不持股：新加坡環球（雲頂）、東京迪士尼（東方樂園）、阿布達比迪士尼（Miral，已宣布）

出處（英文維基固定版本，只引用持股比例這類事實）：環球是 Universal Destinations & Experiences revid 1382726905（新加坡）、
Universal Beijing Resort revid 1381734293 的 infobox owner（70%／30%）、Universal Studios Japan revid 1384197462 的 infobox
owner 與 operator（NBCUniversal；USJ LLC）；迪士尼是 Disney Experiences revid 1382282208（東京、巴黎、香港 48%／52%、
上海 43%／57%、阿布達比）。
"""
from __future__ import annotations

OWN_TYPES = ["whole", "subsidiary", "minority", "license"]  # 前端 park-ownership.ts 的 OWNERSHIP（代碼是索引 + 1）

# 度假區代碼 → (所有權, 母公司的持股 %, 說明)
DISNEY = {
    "wdw": (1, 100, None),
    "dlr": (1, 100, None),
    "dlp": (2, 100, "由 Euro Disney 經營；迪士尼 2017 年買下全部股份"),
    "tdr": (4, 0, "東方樂園公司（Oriental Land）擁有與經營，迪士尼授權"),
    "hkdr": (3, 48, "香港國際主題樂園公司：港府 52%、迪士尼 48%"),
    "shdr": (3, 43, "上海國際主題樂園公司：申迪集團 57%、迪士尼 43%"),
    "adr": (4, 0, "Miral 擁有與經營，迪士尼授權（已宣布）"),
}
UNIVERSAL = {
    "hollywood": (1, 100, None),
    "orlando": (1, 100, None),
    "frisco": (1, 100, None),
    "uk": (1, 100, None),
    "japan": (2, 100, "USJ 合同会社經營，NBCUniversal（Comcast）持有全部"),
    "beijing": (3, 30, "首寰文化旅遊投資 70%、NBCUniversal（Comcast）30%"),
    "singapore": (4, 0, "雲頂（Genting）擁有與經營，環球授權"),
}
