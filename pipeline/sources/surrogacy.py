"""代理孕母的法規（2026-11-04，製作手冊第二十批 340，法律與制度）。

英文維基「Surrogacy laws by country」固定版本（`OLDID`，CC BY-SA 4.0，資料檔依同樣授權分享）是逐國的散文段落，
沒有表格，這裡逐段讀完自己分類（48 個國家或地區有段落），程式只核對條目裡真的有這些國家的段落、段落裡有判斷依據的關鍵句，
條目改版就報錯：
1 商業代孕合法（有償的也可以）；2 只准無償代孕（只能補償費用）；3 全面禁止（含無償）；4 沒有法律規範；5 各地不同（美國、墨西哥）。
- 「代孕本身合法」跟「親權能不能登記給委託父母」是兩件事，這裡只分前者，後者寫在附註。
- 澳洲：條目寫各州與領地都只准無償、商業代孕是刑事罪，所以是「只准無償」，不是各地不同（手冊原本的例子寫各地不同）。
- 希臘：條目寫「完全合法」、要法院許可，但條目開頭寫歐盟基本權利憲章禁止以人體牟利、商業代孕在歐盟不合法，算只准無償。
- 以色列：條目只寫國家委員會逐案核准；依法可以補償費用、時間、痛苦與收入損失（不只實際費用），算商業代孕合法。
- 泰國：條目寫泰國的已婚異性夫妻可以有商業代孕契約，跟 2015 年《人工生殖兒童保護法》第 24 條禁止商業代孕不符，
  依法條算只准無償，附註寫明。
- 葡萄牙：2016 年的法律只准無償，2018、2019 年兩度被憲法法院判部分違憲、暫停，無法歸類，不畫，寫原因。
- 吉爾吉斯：2024 年的《公民健康保護法》第 57 條，不限婚姻狀態與醫學理由；有償代孕是常態，算商業代孕合法。
- 台灣不在條目裡，依《人工生殖法》第 2 條第 3 款（受術夫妻要「妻能以其子宮孕育生產胎兒」），醫療機構不能為
  代理孕母施行人工生殖，算全面禁止。條目沒寫到的國家不畫。
"""
from __future__ import annotations

import html
import re

from common import download

OLDID = 1382714270
URL = f"https://en.wikipedia.org/w/index.php?title=Surrogacy_laws_by_country&oldid={OLDID}"
COMMERCIAL, ALTRUISTIC, BANNED, UNREGULATED, VARIES = 1, 2, 3, 4, 5

# 條目的段落標題 → (國家代碼, 類別, 段落裡要有的關鍵句, 附註中文, 附註英文)
ENTRIES: list[tuple[str, str, int | None, str, str, str]] = [
    ("Australia", "AUS", ALTRUISTIC, "all jurisdictions allow altruistic surrogacy",
     "各州與領地都只准無償代孕，商業代孕是刑事罪；新南威爾斯、昆士蘭與首都特區連到國外找商業代孕也罰",
     "All states and territories allow only altruistic surrogacy and commercial surrogacy is a criminal offence; "
     "New South Wales, Queensland and the ACT also penalise commercial arrangements abroad"),
    ("Belgium", "BEL", UNREGULATED, "not legally regulated",
     "沒有專門的法律，實務上只做無償代孕；生下孩子的人是法律上的母親，委託父母要經法院收養",
     "No specific law; in practice only altruistic surrogacy, the birth mother is the legal mother and intended parents adopt through the courts"),
    ("Brazil", "BRA", ALTRUISTIC, "altruistic surrogacy is allowed", "禁止商業代孕，只准無償代孕",
     "Commercial surrogacy banned, altruistic allowed"),
    ("Canada", "CAN", ALTRUISTIC, "permits only altruistic surrogacy",
     "《人類輔助生殖法》只准無償代孕，只能補償核准的費用，其他報酬違法",
     "The Assisted Human Reproduction Act allows only altruistic surrogacy; only approved expenses may be reimbursed"),
    ("People's Republic of China", "CHN", BANNED, "Surrogacy is forbidden",
     "衛生部的規章禁止醫療人員施行代孕（罰鍰，不是刑事罪）；地下的商業代孕市場仍然存在",
     "Ministry of Health rules forbid medical staff from performing surrogacy (fines, not criminal); an underground commercial market persists"),
    ("Colombia", "COL", UNREGULATED, "no clear rules",
     "沒有明確規範；孩子先登記在代理孕母名下，委託父母要打親子訴訟", "No clear rules; the child is registered to the surrogate and intended parents must go to court"),
    ("Cuba", "CUB", ALTRUISTIC, "Only altruistic surrogacy is allowed", "2022 年 9 月公投通過的新家庭法起，只准無償代孕",
     "Only altruistic surrogacy, under the family code approved by referendum in September 2022"),
    ("Czech Republic", "CZE", UNREGULATED, "not legally regulated", "沒有法律規範，一般認為合法", "Not regulated by law and generally considered legal"),
    ("Finland", "FIN", BANNED, "illegal since 2007", "2007 年起所有代孕都違法（商業代孕更早就違法）",
     "All surrogacy illegal since 2007 (commercial surrogacy earlier)"),
    ("France", "FRA", BANNED, "is void",
     "民法第 16-7 條（1994 年）：所有代孕契約都無效，仲介代孕要受罰", "Civil Code Art. 16-7 (1994): all surrogacy agreements are void and arranging one is punishable"),
    ("Germany", "DEU", BANNED, "are illegal", "商業與無償代孕都違法；生下孩子的人一定是法律上的母親",
     "Both commercial and altruistic surrogacy illegal; the woman who gives birth is always the legal mother"),
    ("Georgia", "GEO", COMMERCIAL, "both altruistic and commercial",
     "商業代孕合法，本國與外國的委託父母都可以；限已婚或同居一年以上的伴侶",
     "Commercial surrogacy legal for domestic and foreign intended parents; for couples married or together for at least a year"),
    ("Greece", "GRC", ALTRUISTIC, "Surrogacy in Greece is fully legal",
     "依 2005 年第 3305 號法律，要先經法院許可，委託父母從受孕起就是法律上的父母；歐盟不准商業代孕",
     "Under Law 3305/2005 a court must approve each arrangement and the intended parents are the legal parents from conception; commercial surrogacy is not allowed in the EU"),
    ("Hong Kong (S.A.R.)", "HKG", ALTRUISTIC, "Commercial surrogacy is criminal",
     "《人類生殖科技條例》（2000 年）：商業代孕是刑事罪，在香港以外安排也算", "Commercial surrogacy is a crime under the Human Reproductive Technology Ordinance 2000, including arrangements outside Hong Kong"),
    ("Iceland", "ISL", BANNED, "are illegal", "商業與無償代孕都違法", "Both commercial and altruistic surrogacy illegal"),
    ("India", "IND", ALTRUISTIC, "Surrogacy (Regulation) Act, 2021",
     "《代孕（規範）法》（2021 年）只准結婚 5 年以上、有醫學理由的印度夫妻無償代孕；2015 年 11 月起禁止外國人的商業代孕",
     "The Surrogacy (Regulation) Act 2021 allows altruistic surrogacy only for Indian couples married for 5 years with a medical need; commercial surrogacy for foreigners banned since November 2015"),
    ("Ireland", "IRL", UNREGULATED, "There is no law in Ireland governing surrogacy",
     "沒有規範代孕的法律（2023 年最高法院也指出）", "No law governs surrogacy (as the Supreme Court noted in 2023)"),
    ("Israel", "ISR", COMMERCIAL, "Embryo Carrying Agreements Law",
     "1996 年《胚胎孕育協議法》：每一份契約都要國家委員會核准；代理孕母可以拿到費用以外的補償（時間、痛苦與收入損失）；2022 年起開放同性伴侶與單身男性",
     "Embryo Carrying Agreements Law 1996: every contract needs approval by a state committee, and surrogates may be compensated beyond expenses (time, suffering, lost earnings); open to same-sex couples and single men since 2022"),
    ("Iran", "IRN", COMMERCIAL, "(both commercial and altruistic) are legal",
     "商業與無償代孕都合法（1999 年最高領袖的教令以後）", "Both commercial and altruistic surrogacy legal (since a 1999 fatwa of the Supreme Leader)"),
    ("Italy", "ITA", BANNED, "surrogacy, is prohibited",
     "2004 年第 40 號法律：代孕可以判 3 個月到 2 年徒刑；2024 年 10 月起在國外代孕也是犯罪（「普遍犯罪」）",
     "Law 40/2004: surrogacy is punishable by 3 months to 2 years in prison; since October 2024 surrogacy abroad is also a crime (a “universal crime”)"),
    ("Japan", "JPN", UNREGULATED, "it remains unregulated", "沒有法律規範；日本學術會議 2008 年建議禁止，還沒立法",
     "Unregulated; the Science Council of Japan proposed a ban in 2008, not enacted"),
    ("Kenya", "KEN", UNREGULATED, "no legal regulations", "沒有法律規範", "No legal regulation"),
    ("Kyrgyzstan", "KGZ", COMMERCIAL, "Article 57",
     "2024 年《公民健康保護法》第 57 條：不論醫學理由或婚姻狀態，每個人都可以用代孕", "Law on the Protection of Citizens’ Health 2024, Art. 57: anyone may use surrogacy regardless of medical need or marital status"),
    ("Mexico", "MEX", VARIES, "unregulated in most states",
     "多數州沒有規範；錫那羅亞、塔巴斯科兩州的民法有規定；2021 年最高法院判代孕不能限本國已婚夫妻",
     "Unregulated in most states; only Sinaloa and Tabasco regulate it in their civil codes; in 2021 the Supreme Court ruled access cannot be limited to married Mexican couples"),
    ("Malaysia", "MYS", BANNED, "prohibited by fatwa", "2008 年國家伊斯蘭宗教事務理事會的教令禁止", "Prohibited by a 2008 fatwa of the National Council for Islamic Religious Affairs"),
    ("The Netherlands", "NLD", ALTRUISTIC, "Altruistic surrogacy is legal", "只准無償代孕，只有一家醫院收，條件很嚴",
     "Only altruistic surrogacy, offered by a single hospital under strict rules"),
    ("New Zealand", "NZL", ALTRUISTIC, "Altruistic surrogacy is legal", "只准無償代孕", "Only altruistic surrogacy"),
    ("Nigeria", "NGA", UNREGULATED, "unregulated", "沒有法律規範，契約可能依一般契約執行；參議院在審人工生殖的法規",
     "Unregulated; contracts may be enforced as simple contracts, and an ART regulation is before the Senate"),
    ("Philippines", "PHL", UNREGULATED, "no legal framework", "沒有法律規範；親子關係的法律讓委託父母很難取得親權",
     "No legal framework; parentage law makes it hard to transfer rights to intended parents"),
    ("Poland", "POL", UNREGULATED, "mostly unregulated", "大多沒有規範；生下孩子的人一定是法律上的母親",
     "Mostly unregulated; the woman who gives birth is always the legal mother"),
    ("Portugal", "PRT", None, "unconstitutional", "", ""),
    ("Russia", "RUS", COMMERCIAL, "even commercial, is legal", "代孕（含商業代孕）合法，要有醫學上的理由",
     "Gestational surrogacy, including commercial, is legal with a medical indication"),
    ("Saudi Arabia", "SAU", BANNED, "do not allow", "宗教當局不准用代理孕母", "Religious authorities do not allow gestational carriers"),
    ("Serbia", "SRB", BANNED, "are illegal", "商業與無償代孕都違法", "Both commercial and altruistic surrogacy illegal"),
    ("Slovakia", "SVK", BANNED, "Since 2025", "2025 年起憲法明文禁止代孕契約", "Surrogacy agreements prohibited by the constitution since 2025"),
    ("South Africa", "ZAF", ALTRUISTIC, "must be altruistic rather than commercial",
     "《兒童法》（2010 年全面施行）：契約要先經高等法院確認，只准無償，只保障住在南非的人",
     "Children’s Act (fully in force 2010): agreements must be validated by the High Court and be altruistic, and only those domiciled in South Africa are protected"),
    ("South Korea", "KOR", UNREGULATED, "mostly unregulated", "大多沒有規範，部分商業代孕的做法已經違法",
     "Mostly unregulated, though some aspects of commercial surrogacy have become illegal"),
    ("Spain", "ESP", BANNED, "surrogacy is not legal", "代孕契約無效，生下孩子的人是法律上的母親", "Surrogacy agreements are void; the birth mother is the legal mother"),
    ("Sweden", "SWE", BANNED, "illegal in Swedish healthcare", "瑞典的醫療體系不能做代孕，此外沒有法律規範",
     "Not allowed in Swedish healthcare; otherwise unregulated"),
    ("Switzerland", "CHE", BANNED, "illegal in Switzerland", "《人工生殖法》第 4 條禁止代孕，第 31 條罰施行或仲介的人",
     "Banned by Art. 4 of the Reproductive Medicine Act, with penalties for clinicians and intermediaries under Art. 31"),
    ("Thailand", "THA", ALTRUISTIC, "commercial surrogacy contract",
     "2015 年 7 月起《人工生殖兒童保護法》第 24 條禁止商業代孕，只准泰國籍已婚夫妻的無償代孕（英文維基寫泰國夫妻可以有商業代孕契約，跟法條不符）",
     "Since July 2015 the Protection of Children Born from ART Act (s. 24) bans commercial surrogacy, allowing altruistic surrogacy for married Thai couples (the Wikipedia article says Thai couples may use commercial contracts, which does not match the Act)"),
    ("Türkiye", "TUR", BANNED, "effectively bans every version of surrogacy",
     "民法第 282 條：生下孩子的人就是母親，代孕契約無效；2014 年起禁止用第三人的生殖細胞",
     "Civil Code Art. 282 makes the birth mother the legal mother and surrogacy contracts are void; third-party gametes banned since 2014"),
    ("Ukraine", "UKR", COMMERCIAL, "absolutely legal",
     "2002 年起代孕（含捐卵、捐精）合法，委託父母一開始就是法律上的父母；是國際代孕的主要目的地",
     "Surrogacy, including with donor eggs or sperm, legal since 2002, with intended parents as legal parents from the start; a major international destination"),
    ("United Kingdom", "GBR", ALTRUISTIC, "Altruistic surrogacy is legal",
     "只准無償代孕，只能付合理的費用（1985 年《代孕安排法》）；孩子出生後委託父母向法院申請親權令", "Only altruistic surrogacy with reasonable expenses (Surrogacy Arrangements Act 1985); intended parents apply for a parental order after birth"),
    ("United States", "USA", VARIES, "varies greatly from state to state",
     "依州而定：加州、伊利諾、阿肯色、馬里蘭、奧勒岡、新罕布夏、華盛頓特區等對代孕友善（含商業代孕），也有州不承認契約或處罰商業代孕",
     "Varies by state: California, Illinois, Arkansas, Maryland, Oregon, New Hampshire and Washington, D.C. are surrogacy-friendly (including commercial), while some states refuse to enforce contracts or penalise commercial surrogacy"),
    ("Vietnam", "VNM", ALTRUISTIC, "humanitarian purposes",
     "2015 年起准許「人道」代孕：只限沒有共同子女、妻子不能生育的已婚夫妻，代理孕母要是親屬、一生只能一次",
     "Humanitarian surrogacy allowed since 2015 for married couples without a common child where the wife cannot give birth; the surrogate must be a relative, once in her life"),
]
PORTUGAL = ("2016 年的法律只准無償代孕，但 2018、2019 年兩度被憲法法院判部分違憲，已經暫停，無法歸類",
            "A 2016 law allowed only altruistic surrogacy, but the Constitutional Court struck down parts of it in 2018 and 2019 "
            "and it has been suspended, so it cannot be classified")
TAIWAN = ("人工生殖法第 2 條第 3 款把可以接受人工生殖的受術夫妻限於「妻能以其子宮孕育生產胎兒」，"
          "醫療機構不能為代理孕母施行；代孕專法草案多次送立法院，還沒通過",
          "Assisted Reproduction Act, Art. 2(3): treatment is only for married couples where the wife can carry "
          "the pregnancy, so surrogacy cannot be performed; surrogacy bills have repeatedly gone to the Legislative Yuan without passing")
TAIWAN_LAW_URL = "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=L0070024"


def _sections(page: str) -> dict[str, str]:
    body = page[page.find('id="mw-content-text"'):]
    parts = re.split(r"(<h2[^>]*>.*?</h2>)", body, flags=re.S)
    out: dict[str, str] = {}
    title = None
    for p in parts:
        m = re.match(r"<h2[^>]*>(.*?)</h2>", p, re.S)
        if m:
            title = " ".join(html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).split())
            continue
        if title:
            text = re.sub(r"<sup.*?</sup>|<style.*?</style>", "", p, flags=re.S)
            out[title] = out.get(title, "") + " ".join(html.unescape(re.sub(r"<[^>]+>", " ", text)).split())
    return out


def status(known: set[str]) -> tuple[dict[str, int], dict[str, tuple[str, str]], dict[str, tuple[str, str]]]:
    """回傳 (類別, 附註, 不畫的原因)"""
    page = download(URL, "wikipedia", f"surrogacy-laws-by-country-{OLDID}.html").read_text(encoding="utf-8")
    sections = _sections(page)
    values: dict[str, int] = {}
    notes: dict[str, tuple[str, str]] = {}
    no_value: dict[str, tuple[str, str]] = {}
    for title, iso3, value, phrase, zh, en in ENTRIES:
        if phrase not in sections.get(title, ""):
            raise RuntimeError(f"Surrogacy laws by country 的「{title}」段落找不到「{phrase}」，條目可能改版了")
        if iso3 not in known:
            raise RuntimeError(f"代孕：{iso3} 不在國家清單裡")
        if value is None:
            no_value[iso3] = PORTUGAL
        else:
            values[iso3], notes[iso3] = value, (zh, en)
    values["TWN"], notes["TWN"] = BANNED, TAIWAN
    return values, notes, no_value
