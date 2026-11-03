"""強制投票（2026-11-03，法律與制度的「之後」階段，使用者 2026-11-03 決定做）。

依英文維基百科「Compulsory voting」固定版本（`OLDID`，CC BY-SA 4.0）的兩張表自行整理，資料檔（`compulsory-voting.json`）
依 CC BY-SA 4.0 分享；跟醫療用大麻一樣讀那個版本的網頁（HTML）。
- 第一張「現在有強制投票」：Enforced? 欄是 Yes 的算「有執行」，No 或空白的算「不執行或執行情況不明」（智利 2022 年恢復，
  條目寫 TBD）。瑞士只有沙夫豪森邦，算「各地不同」。
- 第二張「曾經有、已廢除」（阿爾巴尼亞、奧地利、義大利、荷蘭、委內瑞拉…；美國喬治亞州的 1777 年憲法不算）。
- 不在兩張表上的主權國家算「沒有強制投票」（條目列的是所有有強制投票的地方）；屬地沒有寫的不畫。

類別（1 最嚴、越嚴越深；「各地不同」是灰色）：1 有執行；2 不執行或執行情況不明；3 曾經有、已廢除；4 沒有；5 各地不同。
"""
from __future__ import annotations

from common import download
from sources.countries import from_name
from sources.igo_members import DEPENDENCIES
from sources.medical_cannabis import _Tables

OLDID = 1383198941
URL = f"https://en.wikipedia.org/w/index.php?title=Compulsory_voting&oldid={OLDID}"
ENFORCED, NOT_ENFORCED, REPEALED, NONE, VARIES = 1, 2, 3, 4, 5
NAMES = {"Swiss canton of Schaffhausen": "CHE", "U.S. state of Georgia": None, "North Korea": "PRK", "Turkey": "TUR",
         "Pitcairn Islands": "PCN", "Switzerland": "CHE"}
NOTES: dict[str, tuple[str, str]] = {
    "CHE": ("全國從來沒有強制投票；19 世紀好幾個邦有，1974 年以後只剩沙夫豪森邦",
            "Never compulsory nationally; several cantons once had it, but since 1974 only Schaffhausen"),
    "CHL": ("2012 年取消強制投票，2022 年恢復（條目寫執行情況未定）", "Abolished in 2012 and reintroduced in 2022 (enforcement listed as to be determined)"),
    "BEL": ("1894 年起強制投票，但 2003 年以後幾乎不再起訴", "Compulsory since 1894, but offenders have almost never been prosecuted since 2003"),
    "AUS": ("聯邦選舉 1924 年起強制投票，投票率約 92%", "Compulsory for federal elections since 1924; turnout about 92%"),
    "SGP": ("1959 年起強制投票；沒投票的人會從選舉人名冊除名，要有正當理由或繳 50 新幣才能恢復",
            "Enforced since 1959; non-voters are struck off the electoral roll until they give a valid reason or pay S$50"),
    "PRK": ("17 歲以上都要投票，但每區只有一位執政黨或其聯盟提名的候選人",
            "Everyone over 17 must vote, but there is only one candidate per seat, from the ruling party or its allies"),
    "BRA": ("1932 年起強制投票，海外的巴西人也要投票", "Compulsory since 1932, including for Brazilians abroad"),
    "ITA": ("1945–1993 年強制投票（沒有正式罰則）", "Compulsory from 1945 to 1993 (with only informal sanctions)"),
    "NLD": ("1917–1967 年強制投票", "Compulsory from 1917 to 1967"),
    "AUT": ("全國 1924–1992 年強制投票", "Compulsory nationally from 1924 to 1992"),
    "BGR": ("2016 年國會通過強制投票，隔年被憲法法院宣告無效", "Introduced by parliament in 2016 and annulled by the Constitutional Court the following year"),
    "CYP": ("1960 年起強制投票，2017 年廢除", "Compulsory from 1960, repealed in 2017"),
    "VEN": ("1993 年廢除（之前大多沒有執行）", "Removed in 1993 (largely unenforced before then)"),
    "TWN": ("台灣的選舉與公投都不強制投票", "Voting is not compulsory in Taiwan's elections or referendums"),
}


def status(known: set[str]) -> tuple[dict[str, int], dict[str, tuple[str, str]]]:
    parser = _Tables()
    parser.feed(download(URL, "wikipedia", f"compulsory-voting-{OLDID}.html").read_text(encoding="utf-8"))
    current = next(t for t in parser.tables if t and [c[0] for c in t[0]][:4] == ["Place", "Exempt", "Turnout", "Enforced?"])
    former = next(t for t in parser.tables if t and t[0][0][0] == "Country" and len(t[0]) == 2)
    values: dict[str, int] = {}
    unknown = []

    def iso(name: str) -> str | None:
        if name in NAMES:
            return NAMES[name]
        code = from_name(name)
        if code is None:
            unknown.append(name)
        return code

    for row in current[1:]:
        code = iso(row[0][0])
        if code:
            values[code] = VARIES if row[0][0].startswith("Swiss canton") else ENFORCED if row[3][0] == "Yes" else NOT_ENFORCED
    for row in former[1:]:
        code = iso(row[0][0])
        if code and code not in values:
            values[code] = REPEALED
    if unknown:
        raise RuntimeError(f"Compulsory voting 的國名對不到國家代碼：{unknown}")
    values = {c: v for c, v in values.items() if c in known}
    for code in known - DEPENDENCIES:
        if not code.startswith("_"):
            values.setdefault(code, NONE)
    notes = {c: n for c, n in NOTES.items() if c in values}
    return values, notes
