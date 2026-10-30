"""博弈的合法性：各國賭博合法的程度（類別）。依英文維基百科「Gambling age」（revid 1379514800，2026-10-10，CC BY-SA 4.0）
的各洲表格自行整理，所以這張表與輸出的資料檔（`gambling.json`）依 CC BY-SA 4.0 分享。

條目主要是最低年齡，「Age」欄寫「Illegal for all ages」「Illegal for all ages (casinos)<br>18 (lotteries)」這類文字，
依它分類（使用者 2026-10-30 決定四類）：
1 賭場合法：有合法的賭場（可能只准外國人進去、或只在某些地方），附註寫限制。
2 只准彩券等特許：賭場違法，只准彩券、賽馬、運動彩券等政府經營或特許的項目。
3 全部禁止：「Illegal for all ages」，沒有例外（非營利的賓果、摸彩不算）。
4 各地不同：依州（省）的法律，有的地方合法、有的禁止（美國、密克羅尼西亞聯邦、印度）。
年齡欄只寫數字的算 1（條目沒有分賭場、彩券）。表格的國名用旗幟模板或第一個連結，對到 ISO 代碼；美國各州、加拿大各省
的摺疊表不收。條目跟法律明顯不符、或要補充的國家寫在 OVERRIDES（附註寫依據）。
"""
from __future__ import annotations

import re

from common import download
from sources.countries import from_name, to_iso3

URL = "https://en.wikipedia.org/w/index.php?title=Gambling_age&action=raw&oldid=1379514800"
CASINOS, LICENSED, BANNED, VARIES = 1, 2, 3, 4
NAMES = {
    "UK": "GBR", "UAE": "ARE", "Brunei Darussalam": "BRN", "Cote d'Ivoire": "CIV", "Guinea Bissau": "GNB",
    "Federated States of Micronesia": "FSM", "Northern Cyprus": None, "Akrotiri and Dhekelia": None, "Antarctica": None,
    "Curacao": "CUW", "KUW": "KWT", "ZAM": "ZMB", "Macau": "MAC", "Kosovo": "XKX", "Vatican City": "VAT",
    "Czech Republic": "CZE", "Russia": "RUS", "South Korea": "KOR", "Laos": "LAO", "Vietnam": "VNM", "Iran": "IRN",
    "Syria": "SYR", "Bolivia": "BOL", "Venezuela": "VEN", "Tanzania": "TZA", "Moldova": "MDA", "Turkey": "TUR",
}
# 條目跟法律不符或要補充的：iso3 → (類別, 中文附註, 英文附註)
OVERRIDES: dict[str, tuple[int, str, str]] = {
    "TWN": (LICENSED,
            "賭場違法（刑法第 266 條賭博罪）；公益彩券合法，不得賣給未滿 18 歲的人（公益彩券發行條例第 9 條；條目寫 20 歲，跟法條不符）。"
            "離島可以經地方公投設觀光賭場（離島建設條例第 10-2 條），但條文要求的專法沒有制定，至今沒有賭場",
            "Casinos are illegal (gambling is an offence under Article 266 of the Criminal Code); the public welfare lottery is "
            "legal but may not be sold to anyone under 18 (Article 9 of the Public Welfare Lottery Issue Act; Wikipedia's 20 "
            "does not match the law). Outlying islands may allow casinos after a local referendum (Article 10-2 of the Offshore "
            "Islands Development Act), but the separate law it requires has never been passed, so there are no casinos"),
    "HKG": (LICENSED,
            "條目寫香港有准許賭場的法律架構，但《賭博條例》只准賽馬、足球博彩與六合彩（香港賽馬會經營），沒有賭場",
            "Wikipedia says Hong Kong's laws allow casinos, but the Gambling Ordinance permits only horse racing, football "
            "betting and the Mark Six lottery (run by the Hong Kong Jockey Club); there are no casinos"),
    "JPN": (CASINOS,
            "賽馬、競輪等公營賽事與彩券 20 歲、柏青哥 18 歲；2018 年的《綜合度假區整備法》准許設賭場，但還沒有開幕的",
            "Public races and lotteries from 20 and pachinko from 18; the 2018 Integrated Resort Act allows casinos, but none has opened yet"),
    "IND": (VARIES,
            "1867 年的《公共賭博法》讓大多數地方禁止賭博，各邦另有規定（果阿、錫金准許賭場，多數邦有彩券）",
            "The Public Gambling Act 1867 bans gambling in most of the country, with state laws on top (Goa and Sikkim allow casinos, and many states run lotteries)"),
    "MYS": (CASINOS, "21 歲；穆斯林全面禁止。雲頂是唯一的賭場", "21; banned for Muslims. Resorts World Genting is the only casino"),
    "USA": (VARIES, "依州而定：多數州有賭場或彩券，猶他州全面禁止", "Varies by state: most states have casinos or lotteries, while Utah bans all gambling"),
    "MAC": (CASINOS, "21 歲（彩券、運動彩券、賽事 18 歲）", "21 (18 for lotteries, sports betting and racing)"),
}


def _clean(text: str) -> str:
    text = re.sub(r"<ref[^>]*/>", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    return text


def _country(cell: str) -> str | None:
    m = re.search(r"\{\{\s*[Ff]lag\s*(?:icon|deco|country)?\s*\|\s*([^}|]+)", cell)
    name = m.group(1).strip() if m else None
    link = re.search(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]", cell)
    code3 = re.fullmatch(r"\s*\{\{([A-Z]{3})\}\}\s*", cell)
    for candidate in (name, link.group(1).strip() if link else None, code3.group(1) if code3 else None):
        if not candidate:
            continue
        if candidate in NAMES:
            return NAMES[candidate]
        iso = to_iso3(candidate) or from_name(candidate)
        if iso:
            return iso
    return None


def classify(age: str, notes: str) -> int | None:
    a, n = age.lower(), notes.lower()
    if "varies by state" in a or "dependent on state" in a:
        return VARIES
    if a.startswith("not applicable"):
        return None
    if "illegal for all ages" in a:
        if "(casinos" in a or re.search(r"lotter|\(bets?\)|racing", a) or re.search(r"except for (the )?(government )?lotter|except for lotteries", n):
            return LICENSED
        return BANNED
    if re.search(r"\d", a):
        return CASINOS
    return None


def status() -> tuple[dict[str, int], dict[str, tuple[str, str]], dict[str, str]]:
    """({iso3: 類別}, {iso3: (中文附註, 英文附註)}, {iso3: 條目的年齡欄原文})"""
    text = _clean(download(URL, "wikipedia", "gambling-age-1379514800.wiki").read_text(encoding="utf-8"))
    # 美國各州、加拿大各省的摺疊表（巢狀在國家那一列裡）先拿掉
    text = re.sub(r"\{\| class=\"wikitable sortable mw-collapsible.*?\n\|\}", "", text, flags=re.S)
    out: dict[str, int] = {}
    raw: dict[str, str] = {}
    for block in re.split(r"\n\|-", text):
        cells = [c.strip() for c in re.split(r"\n\|(?![-}])", "\n" + block.split("\n|}")[0]) if c.strip()]
        # 有一列的分隔寫成「|- This law is often not enforced」（古巴的上一列），國名在第二格
        start = next((i for i in (0, 1) if i < len(cells) - 1 and _country(cells[i])), None)
        if start is None:
            continue
        iso3, cells = _country(cells[start]), cells[start:]
        if iso3 in out:
            continue
        age = re.sub(r"<br\s*/?>", " ", cells[1])
        age = re.sub(r"data-sort-value=\"[^\"]*\"\s*\|", "", age).strip()
        value = classify(age, cells[2] if len(cells) > 2 else "")
        if value:
            out[iso3] = value
            raw[iso3] = age
    notes = {}
    for iso3, (value, zh, en) in OVERRIDES.items():
        out[iso3] = value
        notes[iso3] = (zh, en)
    if len(out) < 150 or "TWN" not in out:
        raise RuntimeError(f"Gambling age 只讀到 {len(out)} 國，格式可能變了")
    return out, notes, raw
