"""醫療用大麻的合法性（2026-11-03，製作手冊第十九批 299；法律與制度主題）。

依英文維基百科「Legality of cannabis」固定版本（`OLDID`，CC BY-SA 4.0）的國家表「Medical」欄自行整理，所以這張表與輸出的
資料檔（`medical-cannabis.json`）依 CC BY-SA 4.0 分享。讀的是那個版本的網頁（HTML），不是 action=raw（維基百科對這個
IP 的 API 與 raw 回 429 限流，網頁可以讀）。

四類（手冊：「只准特定藥品」要另成一類，不要跟「合法」混在一起）：
1 合法：醫療用大麻合法（可能要處方或執照）。
2 有條件或各地不同：只限特定病人、特別許可、試辦計畫、依州而定，或法律上可以但沒有供應的制度。
3 只准特定藥品或 CBD：只准 Sativex、Epidiolex 這類核准的藥品，或只准 CBD、低 THC 的產品。
4 非法。
（從寬到嚴，跟博弈的合法性同一個方向：越寬越深。）
欄位只寫「Illegal」「Legal」「CBD only」的直接分類；其他文字逐國寫在 `SPECIAL`（類別與中英文附註），沒寫到的新文字會報錯。
台灣：條目寫 Illegal，但食藥署 2024 年核准大麻二酚口服液 Epidyolex（衛部罕藥輸字第000094號），依許可證改成「只准特定藥品」。
"""
from __future__ import annotations

from html.parser import HTMLParser

from common import download
from sources.countries import from_name

OLDID = 1378590397  # 2026-10 的版本
URL = f"https://en.wikipedia.org/w/index.php?title=Legality_of_cannabis&oldid={OLDID}"
LEGAL, CONDITIONAL, PRODUCTS, ILLEGAL = 1, 2, 3, 4
SIMPLE = {"Illegal": ILLEGAL, "Legal": LEGAL, "legal": LEGAL, "Legal for all uses.": LEGAL, "Legal under license.": LEGAL,
          "CBD only": PRODUCTS}
NAMES = {"People's Republic of China (PRC)": "CHN", "Eswatini (Swaziland)": "SWZ", "Greenland (Kalaallit Nunaat)": "GRL",
         "Korea, North (DPRK)": "PRK", "Korea, South": "KOR", "Macau, SAR of China": "MAC", "Channel Islands": None}
# 欄位是其他文字的國家：iso3 → (類別, 中文附註, 英文附註)
SPECIAL: dict[str, tuple[int, str, str]] = {
    "AUS": (LEGAL, "聯邦與各州都合法，適用的病症各州不同", "Legal federally and in all states; qualifying conditions vary by state"),
    "AUT": (PRODUCTS, "只准 dronabinol、Sativex、nabilone 這類大麻藥品", "Only cannabis medicines such as dronabinol, Sativex and nabilone"),
    "BEL": (PRODUCTS, "只准 Sativex", "Sativex only"),
    "BRA": (CONDITIONAL, "只限末期病人或其他治療都無效的病人", "Only for terminally ill patients or those who have exhausted other treatments"),
    "CZE": (LEGAL, "憑處方合法；不用處方可以買 THC 1% 以下的產品", "Legal with a prescription; products up to 1% THC sold without one"),
    "EST": (CONDITIONAL, "要有特別許可", "With a special permit"),
    "FRA": (CONDITIONAL, "3,000 名病人參加的兩年試辦計畫", "A two-year trial programme with 3,000 patients"),
    "GEO": (CONDITIONAL, "法律上可以，但實際上沒有供應醫療大麻的制度", "Technically legal, but there is no system for dispensing it"),
    "GHA": (PRODUCTS, "只准 THC 0.3% 以下", "Only below 0.3% THC"),
    "IND": (PRODUCTS, "只准 CBD 油（THC 0.3% 以下）", "CBD oil only (below 0.3% THC)"),
    "IRL": (CONDITIONAL, "2019 年 6 月起的 5 年試辦計畫", "A five-year pilot programme from June 2019"),
    "PRK": (CONDITIONAL, "憑處方可以，但不確定有沒有供應的制度", "Legal on prescription, but no confirmed system for dispensing it"),
    "KOR": (PRODUCTS, "只准 Epidiolex、Marinol、Sativex（食品醫藥品安全處的政策）",
            "Only Epidiolex, Marinol and Sativex (Ministry of Food and Drug Safety policy)"),
    "MEX": (CONDITIONAL, "法律上可以，但沒有供應醫療大麻的制度", "Legal, but there is no system for dispensing it"),
    "PHL": (CONDITIONAL, "原則違法，可以向食品藥物管理局申請特別許可", "Illegal, but a special permit may be granted"),
    "ROU": (PRODUCTS, "只准 THC 0.2% 以下的大麻藥品", "Only cannabis-derived medicines below 0.2% THC"),
    "ZAF": (CONDITIONAL, "法律上可以，但沒有供應醫療大麻的制度", "Legal, but there is no system for dispensing medical cannabis"),
    "LKA": (LEGAL, "依殖民時期法律的修正與阿育吠陀法（傳統醫學）", "Under amendments to colonial law and the Ayurveda Act (traditional medicine)"),
    "SWE": (CONDITIONAL, "病人取得許可才可以，條件有限", "Only for patients who obtain a licence, under limited circumstances"),
    "TUR": (PRODUCTS, "只准 THC 0.3% 以下的大麻藥品（2025 年起）", "Only cannabis-derived medicines below 0.3% THC (since 2025)"),
    "GBR": (CONDITIONAL, "只有專科醫師可以開大麻藥品", "Cannabis medicines may be prescribed only by a specialist"),
    "USA": (CONDITIONAL, "依州而定：41 州、4 個屬地與華盛頓特區合法，聯邦列第三級管制",
            "Varies by state: legal in 41 states, 4 territories and DC; Schedule III federally"),
}
# 條目跟官方資料不符的：iso3 → (類別, 中文附註, 英文附註)
OVERRIDES: dict[str, tuple[int, str, str]] = {
    "TWN": (PRODUCTS,
            "大麻是第二級毒品（毒品危害防制條例）；條目寫 Illegal，但食藥署 2024 年 1 月核准大麻二酚口服液 Epidyolex"
            "（衛部罕藥輸字第000094號），用於 Dravet 症候群與結節性硬化症的癲癇輔助治療，所以歸「只准特定藥品」",
            "Cannabis is a Schedule 2 narcotic; Wikipedia says illegal, but in January 2024 the Taiwan FDA licensed the "
            "cannabidiol oral solution Epidyolex (licence 000094) as add-on treatment for seizures in Dravet syndrome and "
            "tuberous sclerosis complex, so it is classed as specific medicines only"),
}


class _Tables(HTMLParser):
    """wikitable 的每一列：[(儲存格文字, [連結的 title…])…]（不含 <sup> 腳註、<style>）"""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[list[list[tuple[str, list[str]]]]] = []
        self.stack: list[bool] = []
        self.row: list | None = None
        self.cell: list[str] | None = None
        self.links: list[str] = []
        self.skip = 0

    def _active(self) -> bool:
        return bool(self.stack) and self.stack[-1]

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            wiki = "wikitable" in (a.get("class") or "")
            self.stack.append(wiki)
            if wiki:
                self.tables.append([])
            return
        if not self._active():
            return
        if tag in ("sup", "style"):
            self.skip += 1
        elif tag == "tr":
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell, self.links = [], []
        elif tag == "br" and self.cell is not None:
            self.cell.append(" ")
        elif tag == "a" and self.cell is not None and not self.skip:
            self.links.append(a.get("title") or "")

    def handle_endtag(self, tag):
        if tag == "table":
            if self.stack:
                self.stack.pop()
            return
        if not self._active():
            return
        if tag in ("sup", "style"):
            self.skip = max(0, self.skip - 1)
        elif tag in ("td", "th") and self.cell is not None and self.row is not None:
            self.row.append((" ".join("".join(self.cell).split()), self.links))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.tables[-1].append(self.row)
            self.row = None

    def handle_data(self, data):
        if self.cell is not None and not self.skip:
            self.cell.append(data)


def status(known: set[str]) -> tuple[dict[str, int], dict[str, tuple[str, str]]]:
    """({iso3: 類別}, {iso3: (中文附註, 英文附註)})"""
    parser = _Tables()
    parser.feed(download(URL, "wikipedia", f"legality-of-cannabis-{OLDID}.html").read_text(encoding="utf-8"))
    table = next(t for t in parser.tables if t and [c[0] for c in t[0]][:3] == ["Country/Territory", "Recreational", "Medical"])
    values: dict[str, int] = {}
    notes: dict[str, tuple[str, str]] = {}
    unknown = []
    for row in table[1:]:
        if len(row) < 3 or row[0][0] == "Country/Territory":
            continue
        name, links = row[0]
        iso3 = NAMES[name] if name in NAMES else (from_name(name) or (from_name(links[0]) if links else None))
        if iso3 is None or iso3 not in known:
            continue
        medical = row[2][0]
        if iso3 in SPECIAL:
            values[iso3], *note = SPECIAL[iso3]
            notes[iso3] = (note[0], note[1])
        elif medical in SIMPLE:
            values[iso3] = SIMPLE[medical]
        else:
            unknown.append((iso3, medical))
    if unknown:
        raise RuntimeError(f"Legality of cannabis 的 Medical 欄有沒分類的文字，請寫進 SPECIAL：{unknown}")
    for iso3, (value, zh, en) in OVERRIDES.items():
        values[iso3] = value
        notes[iso3] = (zh, en)
    return values, notes
