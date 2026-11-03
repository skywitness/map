"""墮胎與安樂死（2026-11-03，法律與制度的第二階段，使用者 2026-11-03 決定做）。

**墮胎**：英文維基「Abortion law」固定版本（`ABORTION_OLDID`）的各國表（CC BY-SA 4.0，資料檔依同樣授權分享）：
每國六個理由（救命、健康、強暴、胎兒異常、社會經濟、依請求）各寫 Permitted、Prohibited、週數或 Varies。
取「全國都准許」的最寬理由分類（1 最寬、越寬越深）：1 可以依請求；2 社會經濟理由；3 健康、強暴或胎兒異常；
4 只為救命；5 全面禁止；6 各地不同（美國、墨西哥：各州差很多，灰色）。更寬的理由「Varies」的（英國、澳洲）照全國都准許
的那一級，附註寫明。表裡的次級行政區（美國各州、澳洲各州、墨西哥各州、奈及利亞各州…）不畫；中國用「Mainland China」。
台灣在表上（社會經濟理由 24 週），附註依優生保健法第 9 條與施行細則第 15 條。

**安樂死**：英文維基「Legality of euthanasia」固定版本（`EUTHANASIA_OLDID`）的「安樂死合法」表（13 個，含生效日期），
加上同一條目寫明協助自殺合法的地方（瑞士、德國、美國部分州）與奧地利的《臨終意願法》（條目沒寫，依法律）：
1 安樂死合法（醫師可以施打致死藥物）；2 已立法、還沒生效；3 只准協助自殺（含部分地區）；4 沒有合法化。
台灣：病人自主權利法（2019 年施行）只准撤除或不施行維生治療；主動安樂死與協助自殺是刑法第 275 條的罪。
"""
from __future__ import annotations

import re

import pycountry

from common import download
from sources.igo_members import DEPENDENCIES
from sources.medical_cannabis import _Tables

ABORTION_OLDID = 1383125224
EUTHANASIA_OLDID = 1378373165
ABORTION_URL = f"https://en.wikipedia.org/w/index.php?title=Abortion_law&oldid={ABORTION_OLDID}"
EUTHANASIA_URL = f"https://en.wikipedia.org/w/index.php?title=Legality_of_euthanasia&oldid={EUTHANASIA_OLDID}"

ON_REQUEST, SOCIAL, HEALTH, LIFE, BANNED, VARIES = 1, 2, 3, 4, 5, 6
GROUNDS = ["life", "health", "rape", "fetal", "social", "request"]
GROUND_ZH = {"health": "健康", "rape": "強暴", "fetal": "胎兒異常"}
GROUND_EN = {"health": "health", "rape": "rape", "fetal": "fetal impairment"}
# 表上的國名 pycountry 對不到的（嚴格比對，不用模糊比對，避免「Mexico State」對到墨西哥）
NAMES = {"Brunei": "BRN", "Cape Verde": "CPV", "Mainland China": "CHN", "Macau": "MAC",
         "Democratic Republic of the Congo": "COD", "East Timor": "TLS", "Ivory Coast": "CIV", "Kosovo": "XKX",
         "Micronesia": "FSM", "Palestine": "PSE", "Russia": "RUS", "São Tomé and Príncipe": "STP", "Turkey": "TUR",
         "Vatican City": "VAT"}
SKIP_ROWS = {"China [subdivisions]"}  # 用 Mainland China；香港、澳門另外有列
FORCE_VARIES = {"USA": ("依州而定", "Varies by state"), "MEX": ("依州而定", "Varies by state")}
TAIWAN_ABORTION = (
    "優生保健法第 9 條：懷孕或生產會影響心理健康或家庭生活時，可以依自願人工流產，妊娠 24 週以內（施行細則第 15 條）；"
    "有配偶的人依這一款要配偶同意。不能單純依請求",
    "Eugenic Health Act, Art. 9: abortion is allowed when pregnancy or childbirth would affect mental health or family life, "
    "within 24 weeks (Enforcement Rules, Art. 15); a married woman needs her spouse's consent on this ground. Not on request alone",
)


def _limit(value: str) -> tuple[str, str]:
    v = value.strip()
    if v in ("Permitted", ""):
        return "", ""
    if v == "No limit":
        return "沒有週數限制", "no gestational limit"
    if v.lower() == "viability":
        return "胎兒可以存活以前", "until viability"
    if v == "Heartbeat":
        return "偵測到胎兒心跳以前", "until a heartbeat is detected"
    if v == "Organ formation":
        return "器官形成以前", "until organ formation"
    m = re.fullmatch(r"(\d+) weeks and (\d+) days", v)
    if m:
        return f"{m.group(1)} 週又 {m.group(2)} 天以內", f"up to {v}"
    m = re.fullmatch(r"(\d+) (weeks|months|days)", v)
    if m:
        unit = {"weeks": "週", "months": "個月", "days": "天"}[m.group(2)]
        return f"{m.group(1)} {unit}以內", f"up to {v}"
    raise RuntimeError(f"Abortion law 有沒見過的期限文字：{value}")


def _allowed(v: str) -> bool:
    return v not in ("Prohibited", "Varies", "Unclear")


def _iso3(name: str) -> str | None:
    if name in NAMES:
        return NAMES[name]
    try:
        return pycountry.countries.lookup(re.sub(r"\s*\[subdivisions\]$", "", name)).alpha_3
    except LookupError:
        return None


def abortion(known: set[str]) -> tuple[dict[str, int], dict[str, tuple[str, str]]]:
    parser = _Tables()
    parser.feed(download(ABORTION_URL, "wikipedia", f"abortion-law-{ABORTION_OLDID}.html").read_text(encoding="utf-8"))
    header = ["Country", "Risk to life", "Risk to health", "Rape", "Fetal impairment", "Economic or social", "On request"]
    table = next(t for t in parser.tables if t and [c[0] for c in t[0]] == header)
    values: dict[str, int] = {}
    notes: dict[str, tuple[str, str]] = {}
    for row in table[1:]:
        name = row[0][0]
        iso3 = None if name in SKIP_ROWS else _iso3(name)
        # 次級行政區對不到國家；美國的「Georgia」這類跟國名一樣的州排在國家後面，先出現的贏
        if not iso3 or iso3 in values or iso3 not in known or len(row) < 7:
            continue
        g = dict(zip(GROUNDS, (c[0] for c in row[1:7])))
        if iso3 in FORCE_VARIES:
            values[iso3], notes[iso3] = VARIES, FORCE_VARIES[iso3]
            continue
        if _allowed(g["request"]):
            category, (zh, en) = ON_REQUEST, _limit(g["request"])
            zh, en = (f"依請求：{zh}" if zh else "可以依請求"), (f"On request, {en}" if en else "On request")
        elif _allowed(g["social"]):
            category, (zh, en) = SOCIAL, _limit(g["social"])
            zh, en = (f"社會經濟理由：{zh}" if zh else "可以依社會經濟理由"), (f"Social or economic grounds, {en}" if en else "Social or economic grounds")
        elif any(_allowed(g[k]) for k in ("health", "rape", "fetal")):
            category = HEALTH
            ok = [k for k in ("health", "rape", "fetal") if _allowed(g[k])]
            zh = "可以的理由：" + "、".join(GROUND_ZH[k] for k in ok)
            en = "Allowed for " + ", ".join(GROUND_EN[k] for k in ok)
        elif _allowed(g["life"]):
            category, zh, en = LIFE, "只有救命時可以", "Only to save the woman's life"
        else:
            category, zh, en = BANNED, "", ""
        wider = [k for k in GROUNDS[GROUNDS.index({1: "request", 2: "social", 3: "health", 4: "life", 5: "life"}[category]) + 1:]
                 if g[k] == "Varies"] if category != ON_REQUEST else []
        if wider:
            zh += "；更寬的理由各地不同"
            en += "; wider grounds vary by region"
        unclear = [k for k in GROUNDS if g[k] == "Unclear"]
        if unclear:
            zh += "；部分理由不明"
            en += "; some grounds unclear"
        values[iso3] = category
        if zh:
            notes[iso3] = (zh, en)
    if "TWN" in values:
        notes["TWN"] = TAIWAN_ABORTION
    return values, notes


# ── 安樂死 ──────────────────────────────────────────────
E_LEGAL, E_PENDING, E_ASSISTED, E_NONE = 1, 2, 3, 4
E_NAMES = {"Jersey": "JEY", "Netherlands": "NLD"}
ASSISTED: dict[str, tuple[str, str]] = {
    "CHE": ("只准協助自殺：刑法第 115 條只處罰出於自私動機的協助自殺；病人要自己服藥，外國人也可以",
            "Assisted suicide only: Art. 115 of the penal code punishes assisting suicide only for selfish motives; the "
            "patient takes the drug, and foreigners are eligible"),
    "DEU": ("只准協助自殺：2020 年 2 月聯邦憲法法院宣告禁止協助自殺服務的條文違憲；主動安樂死違法",
            "Assisted suicide only: in February 2020 the Federal Constitutional Court struck down the ban on assisted-suicide "
            "services; active euthanasia is illegal"),
    "AUT": ("只准協助自殺：《臨終意願法》（Sterbeverfügungsgesetz）2022 年 1 月 1 日生效；英文維基條目沒有寫，依法律",
            "Assisted suicide only: the Dying Will Act (Sterbeverfügungsgesetz) took effect on 1 January 2022 (not in the "
            "Wikipedia article; from the statute)"),
    "USA": ("只准協助自殺，依州而定：科羅拉多、奧勒岡、夏威夷、新墨西哥、華盛頓、佛蒙特、緬因、紐澤西、加州 9 州與華盛頓特區合法，"
            "蒙大拿事實上合法；主動安樂死全國違法",
            "Assisted suicide only, by state: legal in Colorado, Oregon, Hawaii, New Mexico, Washington, Vermont, Maine, New "
            "Jersey, California and DC, and de facto in Montana; active euthanasia is illegal nationwide"),
}
TAIWAN_EUTHANASIA = (
    "沒有合法化：病人自主權利法（2019 年施行）讓末期、不可逆昏迷、永久植物人、極重度失智等病人依預立醫療決定撤除或不施行"
    "維生治療；受囑託殺人與幫助自殺是刑法第 275 條的罪",
    "Not legal: the Patient Right to Autonomy Act (in force since 2019) allows life-sustaining treatment to be withheld or "
    "withdrawn under an advance decision for terminal, irreversibly comatose, permanently vegetative or severely demented "
    "patients; killing on request and assisting suicide are crimes under Art. 275 of the Criminal Code",
)


MONTHS = {m: i for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July", "August", "September",
                                       "October", "November", "December"], 1)}


def _zh_date(text: str) -> str:
    """「1 April 2002」→「2002 年 4 月 1 日」"""
    m = re.fullmatch(r"(\d{1,2}) ([A-Z][a-z]+) (\d{4})", text.strip())
    if not m or m.group(2) not in MONTHS:
        raise RuntimeError(f"Legality of euthanasia 的生效日期讀不懂：{text}")
    return f"{m.group(3)} 年 {MONTHS[m.group(2)]} 月 {int(m.group(1))} 日"


def euthanasia(known: set[str]) -> tuple[dict[str, int], dict[str, tuple[str, str]]]:
    parser = _Tables()
    parser.feed(download(EUTHANASIA_URL, "wikipedia", f"legality-of-euthanasia-{EUTHANASIA_OLDID}.html").read_text(encoding="utf-8"))
    table = next(t for t in parser.tables if t and [c[0] for c in t[0]] == ["Country", "Legalization method", "Date effective"])
    values: dict[str, int] = {}
    notes: dict[str, tuple[str, str]] = {}
    for row in table[1:]:
        name, date = row[0][0], row[2][0]
        iso3 = E_NAMES.get(name) or _iso3(name)
        if not iso3:
            raise RuntimeError(f"Legality of euthanasia 的國名對不到國家代碼：{name}")
        if iso3 == "AUS":
            # 各州與首都特區已經實施，表上這一列是最後的北領地（2026 年 8 月通過，還沒生效）
            values[iso3] = E_LEGAL
            notes[iso3] = ("各州已經實施自願協助死亡；北領地 2026 年 8 月通過，是最後一個立法的地方，還沒生效",
                           "Voluntary assisted dying is in force in all states; the Northern Territory, the last place to "
                           "legislate, passed it in August 2026, not yet in force")
        elif date.strip().upper() == "TBA":
            values[iso3] = E_PENDING
            notes[iso3] = ("已立法，還沒生效", "Passed, not yet in force")
        else:
            values[iso3] = E_LEGAL
            notes[iso3] = (f"{_zh_date(date)}起合法", f"Legal since {date}")
    for iso3, note in ASSISTED.items():
        values[iso3], notes[iso3] = E_ASSISTED, note
    values = {c: v for c, v in values.items() if c in known}
    for code in known - DEPENDENCIES:
        if not code.startswith("_"):
            values.setdefault(code, E_NONE)
    notes["TWN"] = TAIWAN_EUTHANASIA
    return values, {c: n for c, n in notes.items() if c in values}
