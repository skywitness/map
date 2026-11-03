"""娛樂用大麻與迷幻蘑菇的持有（2026-11-03，法律與制度的「大麻」階段，使用者 2026-11-03 決定做）。

依英文維基百科兩個條目的固定版本（CC BY-SA 4.0）自行整理，所以這張表與輸出的資料檔（`cannabis.json`、`psilocybin.json`）
依 CC BY-SA 4.0 分享。跟醫療用大麻（`sources/medical_cannabis.py`）一樣讀那個版本的網頁（HTML）：
- 「Legality of cannabis」（oldid 1378590397）國家表的 Recreational 欄。
- 「Legal status of psilocybin mushrooms」（oldid 1383481040）的 Possession 欄（只收表上的 63 個國家或地區）。

類別（1 最寬、越寬越深，跟博弈、醫療用大麻同方向；「各地不同」是灰色，不在順序上）：
- 大麻：1 合法、可以合法取得（販售或會員俱樂部）；2 可以持有、自種，不准販賣；3 除罪化（持有少量不是刑事罪，含荷蘭咖啡店的容許）；
  4 違法，但常不取締或有例外（宗教、節慶、罰款代替起訴）；5 違法；6 各地不同（美國、澳洲）。
- 迷幻蘑菇：1 合法；2 除罪化；3 違法，但常不取締；4 違法；5 各地不同或不明確（美國、菲律賓）。
欄位只寫「Illegal」這類固定文字的直接分類；其他文字逐國寫在 `CANNABIS`、`PSILOCYBIN`（類別與中英文附註），
沒寫到的新文字會報錯。
"""
from __future__ import annotations

from common import download
from sources.countries import from_name
from sources.medical_cannabis import NAMES, OLDID as CANNABIS_OLDID, _Tables

PSILOCYBIN_OLDID = 1383481040
CANNABIS_URL = f"https://en.wikipedia.org/w/index.php?title=Legality_of_cannabis&oldid={CANNABIS_OLDID}"
PSILOCYBIN_URL = f"https://en.wikipedia.org/w/index.php?title=Legal_status_of_psilocybin_mushrooms&oldid={PSILOCYBIN_OLDID}"

# ── 娛樂用大麻 ─────────────────────────────────────────────
C_LEGAL, C_POSSESS, C_DECRIM, C_TOLERATED, C_ILLEGAL, C_VARIES = 1, 2, 3, 4, 5, 6
CANNABIS_SIMPLE = {"Illegal": C_ILLEGAL, "Legal": C_LEGAL, "Decriminalized": C_DECRIM,
                   "Illegal but often unenforced": C_TOLERATED}
DECRIM = "持有少量除罪化"
CANNABIS: dict[str, tuple[int, str, str]] = {
    "URY": (C_LEGAL, "合法，非居民不能買；可以自種 6 株，會員俱樂部最多 45 人",
            "Legal, but non-residents may not buy; up to six plants; cannabis clubs of up to 45 members"),
    "DEU": (C_LEGAL, "2024 年 4 月 1 日起可以持有、使用、自種，7 月 1 日起可以透過非營利的大麻俱樂部取得",
            "Possession, use and home growing legal since 1 April 2024; non-profit cannabis clubs since 1 July 2024"),
    "MLT": (C_LEGAL, "可以持有、使用、自種，透過非營利的大麻俱樂部取得",
            "Possession, use and home growing legal; supply through non-profit cannabis clubs"),
    "LUX": (C_POSSESS, "在家可以種 4 株自用；在外面持有 3 克以下除罪化（罰款）；不准販賣",
            "Up to four plants at home for personal use; up to 3 g outside the home decriminalised (fine); sale prohibited"),
    "ZAF": (C_POSSESS, "在私人場所可以持有、種、使用，不准販賣", "Possession, cultivation and use in private legal, but not sale"),
    "GEO": (C_POSSESS, "2018 年憲法法院判決個人使用合法，但不准販賣；2025 年起法律只對初犯除罪化（乾燥 5 克、新鮮 10 克以下）",
            "Personal use legal under a 2018 Constitutional Court ruling, but not sale; since 2025 the law decriminalises only "
            "first offences (up to 5 g dried or 10 g fresh)"),
    "MEX": (C_POSSESS, "有許可就可以持有、使用、種，不准販賣", "Possession, use and cultivation legal with a permit, but not sale"),
    "CZE": (C_POSSESS, "21 歲以上可以在公共場所持有 25 克、私人場所 100 克以下，自種 3 株",
            "From age 21, up to 25 g in public and 100 g in private, and three plants for personal use"),
    "NLD": (C_DECRIM, "持證的咖啡店可以賣、可以在店裡用（容許，不是合法）；持有 5 克以下除罪化",
            "Sale and use tolerated in licensed coffeeshops (tolerated rather than legal); up to 5 g decriminalised"),
    "ESP": (C_DECRIM, "除罪化：私人場所可以持有、使用、種，包括大麻社團；公共場所會被罰款",
            "Decriminalised: possession, use and cultivation allowed in private, including cannabis social clubs; fines in public"),
    "ITA": (C_DECRIM, "持有除罪化；在家少量種植自用合法", "Possession decriminalised; small-scale home growing for personal use legal"),
    "AUT": (C_DECRIM, "2016 年 1 月起個人持有除罪化", "Possession for personal use decriminalised since January 2016"),
    "CHE": (C_DECRIM, "除罪化；THC 1% 以下的大麻合法", "Decriminalised; below 1% THC legal"),
    "CHL": (C_DECRIM, "持有與種植除罪化", "Possession and cultivation decriminalised"),
    "ATG": (C_DECRIM, "除罪化；拉斯塔法里教徒可以種、用", "Decriminalised; Rastafari may grow and use it"),
    "JAM": (C_DECRIM, "持有 56.5 克以下或種 5 株除罪化；拉斯塔法里教徒合法", "Decriminalised up to 56.5 g or five plants; legal for Rastafari"),
    "BEL": (C_DECRIM, "持有 3 克以下或種 1 株除罪化", "Decriminalised up to 3 g or one plant"),
    "BLZ": (C_DECRIM, "持有 10 克以下除罪化", "Decriminalised up to 10 g"),
    "BMU": (C_DECRIM, "持有 7 克以下除罪化", "Decriminalised up to 7 g"),
    "BRA": (C_DECRIM, "持有 40 克以下或種 6 株自用除罪化", "Decriminalised up to 40 g or six plants for personal use"),
    "COL": (C_DECRIM, "持有 22 克以下或種 20 株自用除罪化", "Decriminalised up to 22 g or 20 plants for personal use"),
    "DMA": (C_DECRIM, "持有 28 克以下除罪化", "Decriminalised up to 28 g"),
    "PRY": (C_DECRIM, "持有 10 克以下除罪化", "Decriminalised up to 10 g"),
    "PER": (C_DECRIM, "持有 8 克以下除罪化", "Decriminalised up to 8 g"),
    "PRT": (C_DECRIM, "持有 25 克以下的大麻或 5 克以下的大麻脂除罪化", "Decriminalised up to 25 g of herb or 5 g of hashish"),
    "KNA": (C_DECRIM, "持有 56 克以下除罪化", "Decriminalised up to 56 g"),
    "LCA": (C_DECRIM, "持有 30 克以下除罪化", "Decriminalised up to 30 g"),
    "VCT": (C_DECRIM, "持有 56 克以下除罪化", "Decriminalised up to 56 g"),
    "TTO": (C_DECRIM, "持有 30 克以下、每個成人種 4 株除罪化", "Decriminalised up to 30 g and four plants per adult"),
    "FIN": (C_TOLERATED, "違法，但有時不取締", "Illegal but sometimes not enforced"),
    "FRA": (C_TOLERATED, "違法，但通常以當場罰款代替起訴", "Illegal, but on-the-spot fines are usually issued instead of prosecution"),
    "GBR": (C_TOLERATED, "違法，單純持有可能只是警告或當場罰款，不起訴",
            "Illegal, but simple possession may get a warning or on-the-spot fine instead of prosecution"),
    "IND": (C_TOLERATED, "違法，但傳統的 bhang（大麻飲品）例外", "Illegal, with an exception for bhang"),
    "NPL": (C_TOLERATED, "違法，但濕婆節（Maha Shivaratri）期間准許", "Illegal, but allowed during Maha Shivaratri"),
    "BRB": (C_TOLERATED, "違法，但登記的拉斯塔法里教徒可以作宗教用途", "Illegal, except spiritual use by registered Rastafarians"),
    "IRN": (C_TOLERATED, "違法，但不嚴格取締", "Illegal, but not strictly enforced"),
    "PRK": (C_TOLERATED, "違法，但據脫北者說普遍不取締", "Illegal, but widely unenforced according to defectors"),
    "LSO": (C_TOLERATED, "違法，但容許", "Illegal but tolerated"),
    "PAK": (C_TOLERATED, "違法，但常不取締（尤其部分部落地區）", "Illegal, but often unenforced (particularly in some tribal regions)"),
    "POL": (C_TOLERATED, "違法，少量可能不取締；THC 0.3% 以下合法", "Illegal, but small amounts may not be prosecuted; below 0.3% THC legal"),
    "SYR": (C_TOLERATED, "違法，內戰開始後普遍不取締", "Illegal, widely unenforced since the civil war began"),
    "THA": (C_TOLERATED, "違法，但常不取締：2022 年開放 20 歲以上娛樂使用，2025 年沒有處方、THC 0.2% 以上的產品又列為違法",
            "Illegal but often unenforced: recreational use was legalised in 2022 for those 20 and over, and unprescribed "
            "products over 0.2% THC were recriminalised in 2025"),
    "USA": (C_VARIES, "依州而定：24 州、3 個屬地與華盛頓特區合法，另 7 州除罪化；聯邦法律仍列第一級管制、違法",
            "Varies by state: legal in 24 states, 3 territories and DC, decriminalised in 7 more; illegal federally (Schedule I)"),
    "AUS": (C_VARIES, "依州而定：首都特區可以個人使用（不准販賣），北領地與南澳除罪化，其他州違法",
            "Varies by state: legal for personal use in the ACT (not sale), decriminalised in the Northern Territory and "
            "South Australia, illegal elsewhere"),
    "TWN": (C_ILLEGAL, "大麻是第二級毒品（毒品危害防制條例），施用、持有都有刑責",
            "Cannabis is a Schedule 2 narcotic under the Narcotics Hazard Prevention Act; use and possession are criminal offences"),
}

# ── 迷幻蘑菇的持有 ──────────────────────────────────────────
P_LEGAL, P_DECRIM, P_TOLERATED, P_ILLEGAL, P_VARIES = 1, 2, 3, 4, 5
PSILOCYBIN_SIMPLE = {"Legal": P_LEGAL, "Illegal": P_ILLEGAL, "Illegal (decriminalized)": P_DECRIM, "Decriminalized": P_DECRIM,
                     "Illegal (unenforced)": P_TOLERATED}
PSILOCYBIN: dict[str, tuple[int, str, str]] = {
    "AUS": (P_ILLEGAL, "違法；2023 年 7 月起授權的精神科醫師可以開 psilocybin 治療難治型憂鬱症",
            "Illegal; since July 2023 authorised psychiatrists may prescribe psilocybin for treatment-resistant depression"),
    "CZE": (P_DECRIM, "違法但除罪化；2026 年 1 月 1 日起醫療用途合法（精神科醫院的輔助治療）",
            "Illegal but decriminalised; medical use legal since 1 January 2026 (assisted therapy in psychiatric hospitals)"),
    "NLD": (P_LEGAL, "2008 年起禁止迷幻蘑菇，但「迷幻松露」（菌核）合法，可以買賣",
            "Magic mushrooms banned since 2008, but “magic truffles” (sclerotia) are legal to buy and sell"),
    "CHL": (P_DECRIM, "違法，但少量容許、除罪化", "Illegal, but tolerated and decriminalised for small amounts"),
    "ESP": (P_DECRIM, "違法，私人場所個人使用除罪化", "Illegal; decriminalised for personal use in a private place"),
    "CHE": (P_DECRIM, "違法，持有除罪化、當場罰款", "Illegal; possession decriminalised and punished with a spot fine"),
    "CAN": (P_TOLERATED, "違法但不取締；可以申請醫療用途的特別許可", "Illegal (unenforced); special access for medical use possible"),
    "MEX": (P_TOLERATED, "違法，原住民文化裡的使用不取締", "Illegal, unenforced in native cultural use"),
    "GRC": (P_ILLEGAL, "違法（依含有的 psilocin 處理）", "Illegal (treated as psilocin)"),
    "ISR": (P_ILLEGAL, "違法，個人使用也違法", "Illegal, including for personal consumption"),
    "POL": (P_ILLEGAL, "含 psilocybin 或 psilocin 的違法", "Illegal when containing psilocybin or psilocin"),
    "SVK": (P_ILLEGAL, "違法（條文不明確）", "Illegal (ambiguous)"),
    "PHL": (P_VARIES, "條目寫合法，但法律不明確", "Listed as legal, but the law is ambiguous"),
    "USA": (P_VARIES, "依州、市而定：科羅拉多州合法，奧勒岡州與西雅圖、舊金山、華盛頓特區等地除罪化，聯邦違法",
            "Varies by state and city: legal in Colorado, decriminalised in Oregon and places such as Seattle, San Francisco "
            "and DC; illegal federally"),
    "TWN": (P_ILLEGAL, "psilocybin（西洛西賓）是第二級毒品（毒品危害防制條例）",
            "Psilocybin is a Schedule 2 narcotic under the Narcotics Hazard Prevention Act"),
}


def _table(url: str, filename: str, header: list[str]) -> list:
    parser = _Tables()
    parser.feed(download(url, "wikipedia", filename).read_text(encoding="utf-8"))
    return next(t for t in parser.tables if t and [c[0] for c in t[0]][:len(header)] == header)


def _iso3(cell: tuple[str, list[str]]) -> str | None:
    name, links = cell
    if name in NAMES:
        return NAMES[name]
    return from_name(name) or (from_name(links[0]) if links else None)


def _classify(rows, column: int, simple: dict[str, int], special: dict[str, tuple[int, str, str]], known: set[str], label: str):
    values: dict[str, int] = {}
    notes: dict[str, tuple[str, str]] = {}
    unknown = []
    for row in rows:
        if len(row) <= column or row[0][0] in ("Country/Territory", "Country"):
            continue
        iso3 = _iso3(row[0])
        if iso3 is None or iso3 not in known:
            continue
        text = row[column][0]
        if iso3 in special:
            values[iso3], zh, en = special[iso3]
            notes[iso3] = (zh, en)
        elif text in simple:
            values[iso3] = simple[text]
        else:
            unknown.append((iso3, text[:80]))
    if unknown:
        raise RuntimeError(f"{label} 有沒分類的文字，請寫進表裡：{unknown}")
    return values, notes


def cannabis(known: set[str]) -> tuple[dict[str, int], dict[str, tuple[str, str]]]:
    rows = _table(CANNABIS_URL, f"legality-of-cannabis-{CANNABIS_OLDID}.html", ["Country/Territory", "Recreational", "Medical"])
    return _classify(rows[1:], 1, CANNABIS_SIMPLE, CANNABIS, known, "Legality of cannabis 的 Recreational 欄")


def psilocybin(known: set[str]) -> tuple[dict[str, int], dict[str, tuple[str, str]]]:
    rows = _table(PSILOCYBIN_URL, f"psilocybin-mushrooms-{PSILOCYBIN_OLDID}.html", ["Country", "Possession", "Sale"])
    return _classify(rows[1:], 1, PSILOCYBIN_SIMPLE, PSILOCYBIN, known, "Legal status of psilocybin mushrooms 的 Possession 欄")
