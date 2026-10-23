"""外交部領事事務局（BOCA）：國人的簽證待遇，以及各國由哪個駐外館處負責（政府資料開放授權條款）。

- 「中華民國國民可以免簽證、落地簽證及電子簽證前往之國家與地區」（data.gov.tw 30749）：
  開放資料本身是 RSS（https://www.boca.gov.tw/rss-37-1.xml），名單在 RSS 附的 PDF 裡，每次更新檔名都會變，
  所以先讀 RSS 找 PDF 的網址。PDF 是 Word 匯出的表格：一、免簽證；二、落地簽證；三、電子簽證，
  每一節依地區分表，左欄國名（中文＋英文），右欄可停留天數與說明。用 pdfreader.py 讀出文字與表格框線。
- 「各國暨各地區旅遊及消費者保護資訊」的國家清單（https://www.boca.gov.tw/sp-foof-countrylp-03-1.html）：
  領務局有資料的國家與地區，每一項寫著負責的館處；沒有館處的國家寫「（兼轄館處：駐…）」。
  名單裡有、但不在上面三種簽證便利的國家，就是要事先向該國申請簽證。

領務局網站的「政府網站資料開放宣告」採政府資料開放授權條款第 1 版；data.gov.tw 30749 的授權也是第 1 版。
中國大陸、香港由陸委會主管（台胞證、網上預辦入境登記），兩份資料都沒有；澳門在免簽證名單裡（30 天，請洽陸委會）。
"""
from __future__ import annotations

import html
import re
from dataclasses import dataclass, field
from email.utils import parsedate_to_datetime

from common import download
from sources import pdfreader
from sources.countries import from_name

RSS_URL = "https://www.boca.gov.tw/rss-37-1.xml"
RSS_TITLE = "免簽證、落地簽證及電子簽證"
COUNTRY_LIST_URL = "https://www.boca.gov.tw/sp-foof-countrylp-03-1.html"

# 簽證待遇的代碼（越前面越方便）；跟 src/topics/diplomacy.ts 的 VISA 一致
VISA_FREE = 1
VISA_FREE_ETA = 2  # 免簽證，但要事先上網申請旅行授權（美國 ESTA、加拿大 eTA、英國 ETA…）
ON_ARRIVAL = 3
E_VISA = 4
VISA_REQUIRED = 5
SECTION_KEYWORDS = [("免簽證方式", VISA_FREE), ("落地簽證方式", ON_ARRIVAL), ("電子簽證方式", E_VISA)]
# 免簽證但要事先上網申請旅行授權：說明裡寫了 ESTA、eTA、ETA 或「旅行授權」「電子旅行」
NEEDS_AUTHORISATION = re.compile(r"ESTA|eTA|ETA|旅行授權|電子旅行")

# PDF 與國家清單裡的英文名稱，pycountry 查不到或會查錯的
EN_ALIASES = {
    "Republic of Korea": "KOR", "Korea": "KOR", "North Korea": "PRK", "Macao": "MAC",
    "Federated States of Micronesia": "FSM", "Micronesia": "FSM", "Northern Mariana Islands": "MNP",
    "Commonwealth of the Northern Mariana Islands(CNMI)": "MNP", "Nouvelle Calédonie": "NCL",
    "Polynésie française": "PYF", "Wallis et Futuna": "WLF", "Timor Leste": "TLS", "Lao": "LAO", "Laos": "LAO",
    "Naoero": "NRU", "Union of the Comoros": "COM", "Cote d’Ivoire": "CIV", "Cote d'Ivoire": "CIV",
    "Argentine": "ARG", "U.K.": "GBR", "United Kingdom": "GBR", "Turks & Caicos": "TCA",
    "The Holy See": "VAT", "Holy See": "VAT", "The Netherlands": "NLD", "Netherlands": "NLD",
    "The Commonwealth of Dominica": "DMA", "Dominica": "DMA", "Dominican": "DOM", "Dominican Republic": "DOM",
    "la Guyane": "GUF", "French Guiana": "GUF", "Guadeloupe": "GLP", "Martinique": "MTQ", "Mayotte": "MYT",
    "La Réunion": "REU", "Reunion": "REU", "Saint-Barthélemy": "BLM", "Saint Barthelemy": "BLM",
    "Saint-Martin": "MAF", "St. Maarten": "SXM", "Saint-Pierre et Miquelon": "SPM",
    "Saint Pierre and Miquelon": "SPM", "Bonaire": "BES", "Saba": "BES", "St. Eustatius": "BES",
    "Saint Eustatius": "BES", "St. Kitts and Nevis": "KNA", "Saint Christopher and Nevis": "KNA",
    "St. Lucia": "LCA", "Saint Lucia": "LCA", "St. Vincent and the Grenadines": "VCT",
    "Saint Vincent and the Grenadines": "VCT", "St. Helena": "SHN", "Somaliland": "_SOL", "Kosovo": "XKX",
    "Faroe Islands": "FRO", "Greenland": "GRL", "Czech Republic": "CZE", "The Czech Republic": "CZE",
    "The Slovak Republic": "SVK", "Slovakia": "SVK", "Bosnia": "BIH", "Bosnia and Herzegovina": "BIH",
    "Italia": "ITA", "The Gambia": "GMB", "Kingdom of Eswatini": "SWZ", "Eswatini": "SWZ",
    "Democratic Republic of the Congo": "COD", "Republic of the Congo": "COG", "Cape Verde": "CPV",
    "Falkland Islands (the) [Malvinas]": "FLK", "Falkland Islands": "FLK",
    "The Commonwealth of Puerto Rico": "PRI", "Virgin Islands (British)": "VGB", "British Virgin Islands": "VGB",
    "Virgin Islands (U.S.)": "VIR", "Cayman Islands": "CYM", "Türkiye": "TUR", "Russia": "RUS", "Syria": "SYR",
    "Iran": "IRN", "Vietnam": "VNM", "Brunei": "BRN", "Tanzania": "TZA", "Bolivia": "BOL", "Venezuela": "VEN",
    "Moldova": "MDA", "Curaçao": "CUW", "Curacao": "CUW", "United States of America": "USA",
    "Saudi Arabia": "SAU", "United Arab Emirates": "ARE", "Cook Islands": "COK", "Niue": "NIU",
}
# 國家清單的「聖馬丁（法荷共管）」是法屬與荷屬兩邊
EXTRA_CODES = {"Saint Martin": ["MAF", "SXM"]}


def to_iso3(name: str) -> str | None:
    name = re.sub(r"\s+", " ", name).strip(" -")
    return EN_ALIASES.get(name) or from_name(name)


# ── 免簽證、落地簽證、電子簽證名單（PDF） ─────────────────────────
@dataclass
class VisaEntry:
    iso3: str
    category: int
    name_zh: str
    name_en: str
    stay: str  # 右欄的說明（中文）


def _rss_pdf_url() -> tuple[str, str]:
    """RSS 裡名單 PDF 的網址與更新日期"""
    path = download(RSS_URL, "boca", "rss-37-1.xml")
    xml = path.read_text(encoding="utf-8")
    for item in re.findall(r"<item>(.*?)</item>", xml, re.S):
        if RSS_TITLE in item:
            url = re.search(r'<ex:File name="[^"]*" url="([^"]+)"', item)
            date = re.search(r"<pubDate>([^<]+)</pubDate>", item)
            if url:
                # pubDate 是「Thu, 22 Oct 2026 07:09:00 GMT」，跟 PDF 上的更新日期相同
                return html.unescape(url.group(1)), parsedate_to_datetime(date.group(1)).strftime("%Y-%m-%d") if date else ""
    raise RuntimeError("領務局 RSS 裡找不到免簽證名單的 PDF，格式可能變了")


def _join(parts: list[str]) -> str:
    """把同一格裡的幾行接起來：中文之間不加空白，英文之間加一個空白"""
    out = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if out and re.match(r"[A-Za-z0-9À-ÿ(]", p) and re.search(r"[A-Za-z0-9À-ÿ,.)]$", out):
            out += " "
        out += p
    return out


def _lines(texts: list[pdfreader.Text]) -> list[str]:
    """同一格的文字片段依行（y）分組、行內依 x 排好；片段之間的空隙比字高的 0.12 倍大就補一個空白（Word 左右對齊時，空白常常畫成空隙）"""
    rows: list[list[pdfreader.Text]] = []
    for t in sorted(texts, key=lambda t: (-t.y, t.x)):
        if rows and abs(rows[-1][0].y - t.y) < 2:
            rows[-1].append(t)
        else:
            rows.append([t])
    lines = []
    for row in rows:
        row.sort(key=lambda t: t.x)
        s = ""
        prev = None
        for t in row:
            if prev is not None and t.x - prev.x1 > 0.12 * t.size and not s.endswith(" ") and not t.text.startswith(" "):
                s += " "
            s += t.text
            prev = t
        # 左右對齊的中文行，字與字之間也會有空隙（「波 士 尼 亞」），中文之間不留空白
        s = re.sub(r"\s+", " ", s).strip()
        lines.append(re.sub(rf"(?<=[{CJK}，。、：；（）「」]) (?=[{CJK}，。、：；（）「」])", "", s))
    return lines


@dataclass
class _Cell:
    page: int
    x0: float
    x1: float
    y0: float
    y1: float
    texts: list = field(default_factory=list)


def _cells(rects: list[pdfreader.Rect]) -> list[_Cell]:
    """依表格框線找出儲存格：同一欄（左右邊界相同）上下兩條橫線之間，兩側要有直線（不同的表格才不會接在一起）"""
    horizontal: dict[tuple[int, int, int], list[float]] = {}
    vertical: list[pdfreader.Rect] = []
    for r in rects:
        w, h = r.x1 - r.x0, r.y1 - r.y0
        if h < 1.5 and w > 20:
            horizontal.setdefault((r.page, round(r.x0), round(r.x1)), []).append((r.y0 + r.y1) / 2)
        elif w < 1.5 and h > 1:
            vertical.append(r)
    cells = []
    for (page, x0, x1), ys in horizontal.items():
        ys = sorted(set(round(y, 1) for y in ys))
        for lo, hi in zip(ys, ys[1:]):
            # 左邊界要有直線涵蓋這一段（容許 1 點的誤差）
            covered = sum(
                min(v.y1, hi) - max(v.y0, lo)
                for v in vertical
                if v.page == page and abs(v.x0 - x0) < 2 and v.y1 > lo and v.y0 < hi
            )
            if covered >= (hi - lo) * 0.8:
                cells.append(_Cell(page, x0, x1, lo, hi))
    return cells


def _overlap(a: _Cell, b: _Cell) -> float:
    return max(0.0, min(a.y1, b.y1) - max(a.y0, b.y0))


# 左欄的一個國家：中文名稱（可能有括號）接英文名稱，例如「北馬里安納群島（塞班、天寧及羅塔等島） Northern Mariana Islands」
CJK = "㐀-鿿"  # 中日韓統一表意文字 U+3400–U+9FFF
ENTRY = re.compile(
    rf"(?P<zh>[{CJK}][^A-Za-zÀ-ÿ]*?)\s*"
    rf"(?P<en>[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’&.,\- ]*?(?:\([A-Za-z.\s]*\))?)\s*(?=[{CJK}（(]|$)"
)


def visa_list() -> tuple[list[VisaEntry], str]:
    """PDF 名單裡的每一個國家／地區（同一國可能出現在好幾節，例如阿曼免簽證 14 天、也可以辦落地簽證）"""
    url, updated = _rss_pdf_url()
    # 網址每次更新都不同（dl-<編號>-<雜湊>.html），用網址的編號當檔名，有新版時才會重新下載
    key = re.search(r"dl-(\d+-[0-9a-f]+)", url)
    path = download(url, "boca", f"visa-{key.group(1) if key else 'list'}.pdf")
    texts, rects = pdfreader.read(path)
    cells = _cells(rects)
    for t in texts:
        if not t.text.strip():
            continue
        for c in cells:
            if c.page == t.page and c.x0 - 1 <= t.x < c.x1 and c.y0 < t.y < c.y1:
                c.texts.append(t)
                break
    in_cells = {id(t) for c in cells for t in c.texts}

    # 左欄：右邊緊鄰另一欄的儲存格
    def partners(c: _Cell) -> list[_Cell]:
        return [d for d in cells if d.page == c.page and abs(d.x0 - c.x1) < 2 and _overlap(c, d) > 0]

    left = [c for c in cells if partners(c)]
    # 依閱讀順序走過標題（不在表格裡的文字）與左欄：遇到「一、…免簽證方式…」就換一節
    events: list[tuple[int, float, str, object]] = []
    for t in texts:
        if id(t) not in in_cells and t.text.strip():
            events.append((t.page, -t.y, "text", t))
    for c in left:
        events.append((c.page, -c.y1, "cell", c))
    events.sort(key=lambda e: (e[0], e[1]))

    entries: list[VisaEntry] = []
    previous: list[VisaEntry] = []  # 上一列的國家：表格跨頁時，下一頁第一列的左欄是空的，右欄接著上一列的說明
    section = None
    heading = ""
    unknown: list[str] = []
    for _page, _y, kind, obj in events:
        if kind == "text":
            heading += obj.text
            for keyword, code in SECTION_KEYWORDS:
                if keyword in heading.replace(" ", ""):
                    section, heading = code, ""
            heading = heading[-40:]
            continue
        heading = ""
        if section is None:
            continue
        cell: _Cell = obj
        name_text = _join(_lines(cell.texts))
        stay_parts = []
        for d in partners(cell):
            # 右欄跨好幾列（合併儲存格）時，每一列都用同一段說明
            if _overlap(cell, d) >= 0.3 * min(cell.y1 - cell.y0, d.y1 - d.y0):
                stay_parts += _lines(d.texts)
        stay = _join(stay_parts)
        if not name_text:
            for e in previous:
                e.stay = _join([e.stay, stay])
            continue
        row: list[VisaEntry] = []
        for m in ENTRY.finditer(name_text):
            en = re.sub(r"\s+", " ", m.group("en")).strip(" ,")
            iso3 = to_iso3(en)
            if not iso3:
                unknown.append(en)
                continue
            category = section
            if section == VISA_FREE and NEEDS_AUTHORISATION.search(stay):
                category = VISA_FREE_ETA
            row.append(VisaEntry(iso3, category, m.group("zh").strip(), en, stay))
            # 美國的說明寫「包括美國本土、夏威夷、阿拉斯加、波多黎克、關島、美屬維京群島及美屬北馬里亞納群島」
            if iso3 == "USA":
                for word, extra in (("波多黎", "PRI"), ("美屬維京", "VIR")):
                    if word in name_text:
                        row.append(VisaEntry(extra, category, "", en, stay))
        entries += row
        previous = row
    if unknown:
        raise RuntimeError(f"領務局免簽證名單有對不到 ISO 代碼的名稱，請加進 boca.EN_ALIASES：{unknown}")
    if not entries:
        raise RuntimeError("領務局免簽證名單讀不到任何國家，PDF 的版面可能變了")
    return entries, updated


# ── 國家清單與兼轄館處 ──────────────────────────────────────
@dataclass
class CountryInfo:
    iso3: str
    name_zh: str
    name_en: str
    offices: list[str]  # 在當地的館處（中文名稱）
    covered_by: list[str]  # 沒有館處時，負責的館處（中文名稱）
    page: str  # 領務局網站上這個國家的「簽證及入境須知」


def country_list() -> dict[str, CountryInfo]:
    path = download(COUNTRY_LIST_URL, "boca", "countrylp-03.html")
    page = path.read_text(encoding="utf-8")
    out: dict[str, CountryInfo] = {}
    unknown = []
    for href, label in re.findall(r'<a[^>]+href="(/sp-foof-countrycp[^"]+)"[^>]*>(.*?)</a>', page, re.S):
        label = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", label))).strip()
        # 例如「孟加拉 (Bangladesh) - 孟加拉（兼轄館處：駐印度台北經濟文化中心，駐泰國台北經濟文化辦事處）」
        # 中文名稱本身可能有括號（「庫克群島(自治政府) (Cook Islands)」），英文名稱是空白後面、英文字母開頭的那一組
        m = re.match(r"^(?P<zh>.+?)\s+\((?P<en>[A-Za-z].*)\)\s+-\s+(?P<office>.+)$", label)
        if not m:
            continue
        zh, en = m.group("zh"), m.group("en")
        # 同一國的其他館處寫成「澳大利亞-布里斯本 (Australia-Brisbane)」；英文名稱本身也有連字號（Guinea-Bissau）
        sub = "-" in zh
        if sub:
            zh, en = zh.split("-")[0], en.split("-")[0]
        zh, en = zh.strip(), en.strip()
        codes = EXTRA_CODES.get(en) or [to_iso3(en)]
        if codes == [None]:
            unknown.append(en)
            continue
        office = m.group("office").strip()
        covered = re.search(r"兼轄館處：(.+?)）?$", office)
        for iso3 in codes:
            info = out.setdefault(iso3, CountryInfo(iso3, zh, en, [], [], ""))
            if not info.page or not sub:
                # 「簽證及入境須知」分頁：國家頁的網址加上 -02
                info.page = "https://www.boca.gov.tw" + re.sub(r"-1\.html$", "-02-1.html", href)
            if covered:
                for name in re.split(r"[，,]", covered.group(1)):
                    if name.strip() and name.strip() not in info.covered_by:
                        info.covered_by.append(name.strip())
            elif office not in info.offices:
                info.offices.append(office)
    if unknown:
        raise RuntimeError(f"領務局國家清單有對不到 ISO 代碼的名稱，請加進 boca.EN_ALIASES：{unknown}")
    if len(out) < 150:
        raise RuntimeError(f"領務局國家清單只讀到 {len(out)} 個國家，網頁的格式可能變了")
    return out
