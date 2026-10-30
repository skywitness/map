"""叫車服務在哪些國家（新主題，科技與交通類，2026-10-30，製作手冊第六批 106，候選 592）：Uber、Grab、滴滴。

使用者決定只做這三家。在哪些國家營運是事實，手工整理成表（做法同「雲端機房的區域」），出處：
- Uber：https://www.uber.com/global/en/cities/ （「Use Uber in cities around the world」，列出各國）。這一頁從 cloud
  回 HTTP 406（拒絕非瀏覽器的請求），沒有繞過；使用者 2026-10-30 用瀏覽器存成 PDF 交給這個 session，國家照那一份抄
  （74 個國家或地區，頁尾的公司名稱是台灣的「Uber Formosa Co. Ltd.」）。
- Grab：https://www.grab.com/sg/locations/ （2026-10-29、10-30 讀，「Today, Grab is present in eight countries」）。
- 滴滴：https://web.didiglobal.com/ 的「Select your Country」（2026-10-30 讀，14 個國家；巴西是 99），加上中國（總部、主要市場，
  國際版網站不列）。
- 2016 年 Uber 把中國業務賣給滴滴、2018 年把東南亞業務賣給 Grab（英文維基百科「Uber」），所以三家幾乎不重疊；
  只有 Uber 與滴滴在拉丁美洲、日本、澳紐、埃及同時營運。
- 只畫「有營運」，不分合法、受限、禁止（手冊的陷阱）：被禁的國家看起來跟沒有營運一樣，台灣、日本等法規的限制寫在附註。
- 輸出 public/data/topics/ride-hailing/platforms.json（類別圖，一年 2026；hints 列出有哪幾家）。
"""
from __future__ import annotations

import json

from common import OUT_DIR, indicator_file, write_json
from sources.countries import from_name

OUT = OUT_DIR / "topics" / "ride-hailing"
YEAR = 2026

UBER = [
    "Andorra", "United Arab Emirates", "Argentina", "Austria", "Australia", "Barbados", "Bangladesh", "Belgium",
    "Bahrain", "Bolivia", "Brazil", "Canada", "Switzerland", "Chile", "Colombia", "Costa Rica", "Czechia", "Germany",
    "Denmark", "Dominican Republic", "Ecuador", "Estonia", "Egypt", "Spain", "Finland", "France", "United Kingdom",
    "Ghana", "Greece", "Guatemala", "Hong Kong", "Honduras", "Croatia", "Hungary", "Ireland", "India", "Italy",
    "Jamaica", "Jordan", "Japan", "Kenya", "South Korea", "Kuwait", "Lebanon", "Saint Lucia", "Sri Lanka", "Lithuania",
    "Luxembourg", "Malta", "Mexico", "Nigeria", "Netherlands", "Norway", "Nepal", "New Zealand", "Panama", "Peru",
    "Poland", "Portugal", "Paraguay", "Qatar", "Romania", "Saudi Arabia", "Sweden", "Slovenia", "Slovakia",
    "El Salvador", "Turkey", "Taiwan", "Ukraine", "Uganda", "United States", "Uruguay", "South Africa",
]
GRAB = ["Singapore", "Malaysia", "Indonesia", "Philippines", "Thailand", "Vietnam", "Myanmar", "Cambodia"]
DIDI = [
    "China", "Argentina", "Australia", "Brazil", "Chile", "Colombia", "Costa Rica", "Dominican Republic", "Ecuador",
    "Egypt", "Japan", "Mexico", "New Zealand", "Panama", "Peru",
]
NAMES = {"Turkey": "TUR", "Taiwan": "TWN", "South Korea": "KOR", "Hong Kong": "HKG", "Vietnam": "VNM"}
# 代碼（src/topics/ride-hailing.ts 的 PLATFORMS）
CODES = {frozenset(["uber"]): 1, frozenset(["uber", "didi"]): 2, frozenset(["didi"]): 3, frozenset(["grab"]): 4}
LABELS = {"uber": ("Uber", "Uber"), "grab": ("Grab", "Grab"), "didi": ("滴滴（DiDi）", "DiDi")}
NOTES = {
    "TWN": ("Uber 2013 年進入台灣，2017 年 2 月因罰款暫停、4 月改跟租賃車業者合作恢復；2019 年修正汽車運輸業管理規則"
            "（第 103-1 條，俗稱 Uber 條款），只能跟租賃車或計程車業者合作。Grab、滴滴沒有在台灣營運",
            "Uber entered Taiwan in 2013, suspended service in February 2017 over fines and resumed in April through car "
            "rental firms; a 2019 amendment to the transport rules (Article 103-1, the \"Uber clause\") restricts it to "
            "working with rental car or taxi operators. Grab and DiDi do not operate in Taiwan"),
    "CHN": ("Uber 2016 年把中國業務賣給滴滴",
            "Uber sold its China business to DiDi in 2016"),
    "JPN": ("日本禁止一般人用自家車載客，Uber 與滴滴主要是叫計程車",
            "Japan bans ride-sharing in private cars, so Uber and DiDi mainly dispatch licensed taxis"),
    "KOR": ("南韓限制用自家車載客，Uber 主要是叫計程車（2021 年起與 SK 合資的 UT）",
            "South Korea restricts ride-sharing in private cars; Uber mainly dispatches taxis (through UT, its venture "
            "with SK, since 2021)"),
}
SEA_NOTE = ("Uber 2018 年把東南亞業務賣給 Grab", "Uber sold its Southeast Asia business to Grab in 2018")


def _iso(names: list[str]) -> set[str]:
    out = set()
    for name in names:
        iso3 = NAMES.get(name) or from_name(name)
        if not iso3:
            raise RuntimeError(f"叫車服務：對不到國家「{name}」")
        out.add(iso3)
    if len(out) != len(names):
        raise RuntimeError(f"叫車服務：有國家重複（{len(names)} 個名稱、{len(out)} 個代碼）")
    return out


def build() -> None:
    by_company = {"uber": _iso(UBER), "grab": _iso(GRAB), "didi": _iso(DIDI)}
    countries = json.loads((OUT_DIR / "topics" / "profiles" / "government.json").read_text(encoding="utf-8"))["values"]
    values: dict[str, list] = {c: [0] for c in countries}
    hints: dict[str, str] = {}
    hints_en: dict[str, str] = {}
    for iso3 in set().union(*by_company.values()):
        have = [k for k in LABELS if iso3 in by_company[k]]
        code = CODES.get(frozenset(have))
        if code is None:
            raise RuntimeError(f"叫車服務：{iso3} 的組合 {have} 沒有代碼")
        values[iso3] = [code]
        hints[iso3] = "、".join(LABELS[k][0] for k in have)
        hints_en[iso3] = ", ".join(LABELS[k][1] for k in have)
    notes = {k: v[0] for k, v in NOTES.items()}
    notes_en = {k: v[1] for k, v in NOTES.items()}
    for iso3 in by_company["grab"]:
        notes[iso3], notes_en[iso3] = SEA_NOTE
    write_json(OUT / "platforms.json", indicator_file(
        "platforms", "", [YEAR], values, hints=hints, hintsEn=hints_en, notes=notes, notesEn=notes_en))
    counts = {k: len(v) for k, v in by_company.items()}
    both = sorted(by_company["uber"] & by_company["didi"])
    print(f"  叫車服務：{counts}，Uber 與滴滴都有 {len(both)} 國 {both}")
