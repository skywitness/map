"""法律：未成年人用社群平台的年齡限制（2026-11-08，製作手冊第二十七批 660，候選 1446；步驟 minor-social-media，輸出 topics/laws/）。

使用者 2026-11-08 決定只做候選 1446（各國管制的類別圖），1445（中國廣電總局的備案數）不做。
- 資料：英文維基百科「Online age verification laws by country」固定版本 1383775966（/wiki/<條目>?oldid=，robots.txt 允許），
  逐國段落讀過後人工分類，寫在下面的 TABLE（每國一句說明）。維基百科是 CC BY-SA 4.0，這個資料檔同樣授權。
- 只收條目裡有段落的國家；條目沒寫的國家（含台灣）不上色。美國聯邦沒有法律，州法另寫在說明。
- 類別：1 法律禁止某年齡以下開帳號、已實施；2 某年齡以下要父母同意、已實施；3 已立法、還沒生效；4 政府已宣布或國會審議中；
  5 研議或提案；6 不禁帳號、限制使用時段與時數；7 政府不採用年齡禁令，或法律被宣告違憲。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources.wikipedia_html import page

OUT = OUT_DIR / "topics" / "laws"
TITLE, REVID = "Online age verification laws by country", 1383775966
YEAR = 2026

# ISO3: (類別, 中文說明, 英文說明)
TABLE: dict[str, tuple[int, str, str]] = {
    "AUS": (1, "16 歲以下禁止，2025 年 12 月 10 日實施", "Under-16 ban in force since 10 December 2025"),
    "IDN": (1, "16 歲以下禁止，2026 年 3 月 28 日實施", "Under-16 ban in force since 28 March 2026"),
    "MYS": (1, "16 歲以下禁止（用戶超過 800 萬的平台），2026 年 6 月 1 日實施", "Under-16 ban (platforms with over 8 million users) in force since 1 June 2026"),
    "TUR": (1, "15 歲以下禁止，2026 年 11 月 1 日實施（既有帳號到 2027 年 3 月）", "Under-15 ban in force since 1 November 2026 (existing accounts from March 2027)"),
    "BRA": (2, "16 歲以下要跟父母的帳號綁定、父母同意，2026 年 3 月 17 日實施", "Under-16s need parental consent and linked accounts, in force since 17 March 2026"),
    "GBR": (3, "16 歲以下禁止，2026 年 6 月通過，2027 年 3 月實施", "Under-16 ban passed June 2026, effective March 2027"),
    "GRC": (3, "15 歲以下禁止，2026 年 10 月通過，2027 年 1 月 1 日實施", "Under-15 ban passed October 2026, effective 1 January 2027"),
    "GAB": (3, "16 歲以下要父母同意，2026 年 4 月公布行政命令", "Under-16s need parental consent, ordinance published April 2026"),
    "DNK": (4, "15 歲以下禁止（13、14 歲可經父母同意），政府 2025 年 11 月達成協議", "Under-15 ban (13–14 with parental consent) agreed by the government in November 2025"),
    "PRT": (4, "13 歲以下禁止、13–15 歲要父母同意，國會 2026 年 2 月初審通過", "Under-13 ban and parental consent for 13–15 approved by parliament in February 2026, final vote pending"),
    "ARE": (4, "15 歲以下禁止，2026 年 6 月宣布，預計 2027 年年中實施", "Under-15 ban announced June 2026, expected by mid-2027"),
    "NZL": (4, "16 歲以下禁止，2026 年 8 月宣布並送國會", "Under-16 ban announced and bill introduced August 2026"),
    "NOR": (4, "15 歲最低年齡，2025 年送出法案徵詢意見", "Minimum age of 15, bill put out for consultation in 2025"),
    "CYP": (4, "最低年齡 15 歲，總統 2026 年宣布", "Minimum age of 15 announced by the president in 2026"),
    "ESP": (4, "16 歲以下禁止，政府 2026 年 2 月宣布", "Under-16 ban announced by the government in February 2026"),
    "CAN": (4, "16 歲以下禁止的 C-34 法案，2026 年 6 月送國會", "Bill C-34 for an under-16 ban introduced June 2026"),
    "PHL": (4, "參眾兩院 2026 年 10 月各自通過版本不同的法案（18 歲以下或 12 歲以下）", "Senate and House passed differing bills in October 2026 (under 18 or 12 and under)"),
    "PNG": (4, "14 歲以上才能用，2025 年 10 月的政策", "Users must be 14 or older under an October 2025 policy"),
    "AUT": (5, "研議 14 歲以下禁止", "Considering an under-14 ban"),
    "BEL": (5, "法蘭德斯政府研議 13 歲以下禁止", "Flemish government considering an under-13 ban"),
    "BIH": (5, "議會決議限制 15 歲以下使用", "Resolution to limit use under 15"),
    "BGR": (5, "政黨提案 16 歲以下禁止", "Party proposal for an under-16 ban"),
    "FIN": (5, "總理支持 15 歲以下禁止", "Prime minister supports an under-15 ban"),
    "DEU": (5, "聯邦參議院要求 14 歲以下禁止", "Upper house calls for an under-14 ban"),
    "NLD": (5, "政府研議 15 歲以下禁止", "Government considering an under-15 ban"),
    "POL": (5, "教育部提案 15 歲以下禁止", "Education ministry proposes an under-15 ban"),
    "ROU": (5, "國會有 15、16 歲的提案", "Parliamentary proposals for limits at 15 or 16"),
    "SVN": (5, "研擬 15 歲以下禁止", "Drafting an under-15 ban"),
    "SWE": (5, "政府委員會建議 15 歲（現在 13 歲以下要父母同意）", "Government commission suggests 15 (currently parental consent under 13)"),
    "CRI": (5, "法案：14 歲以下禁止、14–17 歲要父母同意", "Bill: under-14 ban and parental consent for 14–17"),
    "TTO": (5, "總理宣布要禁止 12 歲以下", "Prime minister announced an under-12 ban"),
    "ECU": (5, "法案：15 歲以下禁止", "Bill for an under-15 ban"),
    "FJI": (5, "成立專案小組研究", "Task force studying age limits"),
    "BHR": (5, "法案：15 歲以下禁止", "Draft law for an under-15 ban"),
    "IND": (5, "議員提案 16 歲以下禁止；部分邦研議", "Private bill for an under-16 ban; some states considering"),
    "KAZ": (5, "研議 16 歲以下禁止", "Considering an under-16 ban"),
    "LBN": (5, "法案：14 歲以下禁止", "Draft law for an under-14 ban"),
    "MNG": (5, "研擬 16 歲以下禁止", "Drafting an under-16 ban"),
    "PAK": (5, "16 歲以下禁止的法案 2025 年撤回，仍研議 13、14 歲", "Under-16 bill withdrawn in 2025; 13 or 14 still under consideration"),
    "KOR": (5, "國會有 14 歲以下禁止、16 歲以下要父母同意等七個法案", "Seven bills, including an under-14 ban and parental consent under 16"),
    "TJK": (5, "議員提案 14 歲以下禁止", "Lawmaker proposal for an under-14 ban"),
    "VNM": (5, "草案：16 歲以下的帳號由父母登記管理", "Draft: parents register and manage accounts for under-16s"),
    "THA": (5, "研議過，沒有提案", "Considered, but no bill introduced"),
    "EGY": (5, "國會表示要立法，還沒提出", "Parliament intends to legislate; no bill yet"),
    "NGA": (5, "公開諮詢，還沒定年齡", "Public consultation; no age set"),
    "RWA": (5, "研擬 16 歲以下禁止", "Drafting an under-16 ban"),
    "ZWE": (5, "研議 18 歲以下禁止", "Considering an under-18 ban"),
    "USA": (5, "聯邦沒有法律、有數個法案；佛羅里達等州已實施（佛州 14 歲以下禁止）", "No federal law, several bills; some states in force (Florida bans under-14s)"),
    "CHN": (6, "不禁帳號：未成年模式限制時段與每天時數（2024 年起）", "No account ban: Minor Mode limits hours and daily time (since 2024)"),
    "FRA": (7, "15 歲以下禁止的法律 2026 年 8 月被憲法委員會宣告違憲", "Under-15 ban struck down by the Constitutional Council in August 2026"),
    "ITA": (7, "總理表示不會立法禁止", "Prime minister says no ban will be introduced"),
    "EST": (7, "司法與數位部長不支持年齡驗證", "Justice and digital minister opposes age verification"),
    "HRV": (7, "部長否決 15 歲以下要父母同意的提案", "Minister rejected a proposal for parental consent under 15"),
    "HKG": (7, "政府表示沒有立法禁止的計畫", "Government has no plans for a legal ban"),
    "JPN": (7, "總務省顧問會議認為澳洲式的統一年齡法「不理想」", "Advisory panel called an Australian-style unified age law undesirable"),
    "KEN": (7, "國會否決禁用 TikTok，改加強年齡驗證", "Parliament ruled out a TikTok ban in favour of age checks"),
}


def build() -> None:
    page(TITLE, REVID)  # 確認版本、留快取
    values = {c: [k] for c, (k, _, _) in sorted(TABLE.items())}
    hints = {c: zh for c, (_, zh, _) in TABLE.items()}
    hints_en = {c: en for c, (_, _, en) in TABLE.items()}
    write_json(OUT / "minor-social-media.json", indicator_file(
        "minor-social-media", "類別", [YEAR], values, hints=hints, hintsEn=hints_en, license="CC BY-SA 4.0（英文維基百科）",
        noValue={"TWN": "維基的這份清單沒有台灣"}, noValueEn={"TWN": "Taiwan is not in the Wikipedia list"}))
    from collections import Counter
    print(f"  未成年人用社群平台的限制：{len(values)} 國；類別 {sorted(Counter(k for k, _, _ in TABLE.values()).items())}")
