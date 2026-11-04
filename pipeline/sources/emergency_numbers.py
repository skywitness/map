"""各國的緊急電話號碼（2026-11-04，製作手冊第二十批 304；旅行實用主題的指標）。

依英文維基百科「List of emergency telephone numbers」固定版本（`OLDID`，2026-10-16，CC BY-SA 4.0）的各洲表格自行整理，
資料檔依 CC BY-SA 4.0 分享；跟醫療用大麻一樣讀那個版本的網頁（HTML，Wikipedia 的 API 從 cloud 常回 429）。
- 表格一國一列：國家、警察、救護、消防、其他號碼或附註。三個號碼常合併成一格（colspan 2 或 3，例如 112 三者共用），
  所以照 colspan 展開成三欄。
- 號碼取每格第一個號碼（「112/116」取 112、「911 or 999」取 911；「Mobile phones – 112」這類附註不算）。
- 只收地圖上有的國家與屬地；南極各站、阿森松島（地圖上併在聖赫勒拿）、阿布哈茲這類地圖上沒有的不畫。
"""
from __future__ import annotations

import re

from common import download
from sources.countries import from_name
from sources.medical_cannabis import _Tables

OLDID = 1380606668
URL = f"https://en.wikipedia.org/w/index.php?title=List_of_emergency_telephone_numbers&oldid={OLDID}"
SERVICES = ("police", "ambulance", "fire")
# 表格的國名 → ISO3（from_name 查不到或會查錯的）；None 是地圖上沒有、不畫的
NAMES: dict[str, str | None] = {
    "Republic of China (Taiwan)": "TWN", "Taiwan": "TWN", "People's Republic of China": "CHN", "China": "CHN",
    "Ascension Island": None, "Tristan da Cunha": None, "Antarctica": None, "Abkhazia": None, "South Ossetia": None,
    "Akrotiri and Dhekelia": None, "Clipperton Island": None, "Transnistria": None, "Artsakh": None,
    "Northern Cyprus": "_CYN", "Somaliland": "_SOL", "Kosovo": "XKX", "Sahrawi Arab Democratic Republic": "ESH",
    "Western Sahara": "ESH", "Åland Islands": "ALA", "Åland": "ALA", "Turkey": "TUR", "Türkiye": "TUR",
    "Saint Martin": "MAF", "Sint Maarten": "SXM", "Caribbean Netherlands": "BES", "Bonaire": "BES",
    "Republic of the Congo": "COG", "Democratic Republic of the Congo": "COD", "Congo": "COG",
    "Ivory Coast": "CIV", "East Timor": "TLS", "Micronesia": "FSM", "Federated States of Micronesia": "FSM",
    "Palestine": "PSE", "State of Palestine": "PSE", "Vatican City": "VAT", "Macau": "MAC", "Macao": "MAC",
    "Hong Kong": "HKG", "North Korea": "PRK", "South Korea": "KOR", "Laos": "LAO", "Brunei": "BRN",
    "Cape Verde": "CPV", "The Bahamas": "BHS", "Bahamas": "BHS", "The Gambia": "GMB", "Gambia": "GMB",
    "Eswatini": "SWZ", "Swaziland": "SWZ", "Pitcairn Islands": "PCN", "Falkland Islands": "FLK",
    "Saint Helena": "SHN", "United States Virgin Islands": "VIR", "U.S. Virgin Islands": "VIR",
    "British Virgin Islands": "VGB", "Russia": "RUS", "Syria": "SYR", "Iran": "IRN", "Moldova": "MDA",
    "Bolivia": "BOL", "Venezuela": "VEN", "Tanzania": "TZA", "Vietnam": "VNM", "Curaçao": "CUW",
    "Wallis and Futuna": "WLF", "Christmas Island": "_IOT", "Cocos (Keeling) Islands": None,
    "Saint Barthélemy": "BLM", "Saint Pierre and Miquelon": "SPM", "Norfolk Island": "NFK",
    "Republic of Korea": "KOR", "Democratic People's Republic of Korea": "PRK", "Republic of Congo": "COG",
    "Democratic Republic of Congo": "COD",
}


class _SpanTables(_Tables):
    """同 _Tables，另外記每一格的 colspan（self.spans 與 self.tables 一一對應）"""

    def __init__(self) -> None:
        super().__init__()
        self.spans: list[list[list[int]]] = []
        self._row_spans: list[int] | None = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table" and "wikitable" in (a.get("class") or ""):
            self.spans.append([])
        active_before = self._active()
        super().handle_starttag(tag, attrs)
        if not active_before and tag != "table":
            return
        if tag == "tr" and self._active():
            self._row_spans = []
        elif tag in ("td", "th") and self._active() and self._row_spans is not None:
            try:
                self._row_spans.append(int(a.get("colspan") or 1))
            except ValueError:
                self._row_spans.append(1)

    def handle_endtag(self, tag):
        if tag == "tr" and self._active() and self._row_spans is not None and self.row is not None:
            n = len(self.tables[-1])
            super().handle_endtag(tag)
            if len(self.tables[-1]) > n:  # 這一列有收進表格
                self.spans[-1].append(self._row_spans)
            self._row_spans = None
            return
        super().handle_endtag(tag)


def _first_number(text: str) -> str | None:
    """格子裡的第一個號碼（「112/116」→ 112、「10 111」→ 10111、「000」→ 000）；沒有號碼回 None"""
    text = re.split(r"\b(?:Mobile|mobile|from mobile)", text)[0]
    text = re.sub(r"\(\+\d+\)\s*", "", text)  # 托克勞「(+690) 2116」的國碼
    m = re.search(r"\d[\d ]*\d|\d", text)
    if not m:
        return None
    return m.group(0).replace(" ", "")


def numbers(text: str) -> list[str]:
    """格子裡的全部號碼（「999 or 112」→ [999, 112]）"""
    text = re.split(r"\b(?:Mobile|mobile|from mobile)", text)[0]
    text = re.sub(r"\(\+\d+\)\s*", "", text)
    return [m.replace(" ", "") for m in re.findall(r"\d[\d ]*\d|\d", text)]


def table() -> dict[str, dict]:
    """{ISO3: {police, ambulance, fire（號碼字串或 None）, raw: [三格原文], other: 其他號碼原文, name}}"""
    html = download(URL, "wikipedia", f"emergency-numbers-{OLDID}.html").read_text(encoding="utf-8")
    parser = _SpanTables()
    parser.feed(html)
    out: dict[str, dict] = {}
    unknown: list[str] = []
    for rows, spans in zip(parser.tables, parser.spans):
        head = [c[0] for c in rows[0]]
        if head[:4] != ["Country", "Police", "Ambulance", "Fire"]:
            continue
        for row, span in zip(rows[1:], spans[1:]):
            if len(row) != len(span) or not row:
                continue
            name = row[0][0].strip()
            # 依 colspan 展開成 國家、警察、救護、消防、其他
            cols: list[str] = []
            for (text, _links), s in zip(row, span):
                cols.extend([text.strip()] * s)
            if len(cols) < 4:
                continue
            iso3 = NAMES[name] if name in NAMES else from_name(name)
            if iso3 is None:
                if name not in NAMES:
                    unknown.append(name)
                continue
            if iso3 in out:  # 跨洲的國家（土耳其、俄羅斯…）在兩張表各一列，用第一列；國名不同就是對錯了
                if out[iso3]["name"] != name:
                    raise RuntimeError(f"緊急電話：{name} 與 {out[iso3]['name']} 都對到 {iso3}")
                continue
            raw = cols[1:4]
            out[iso3] = {
                "name": name,
                **{svc: _first_number(t) for svc, t in zip(SERVICES, raw)},
                "raw": raw,
                "other": cols[4] if len(cols) > 4 else "",
            }
    if unknown:
        print(f"  緊急電話：國名對不到 ISO3（不畫）：{unknown}")
    return out
