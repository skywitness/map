"""英文維基百科「Blood type distribution by country」的第一個表（CC BY-SA 4.0）：各國 ABO 與 Rh 血型 8 種的比例。

- 用 `action=raw` 讀固定版本（`REVISION`）的 wikitext，版本寫死，資料才不會隨條目改動而變；要更新就換版本號。
- 表格一列一國：國家（`{{flag|…}}`，後面可能接出處的 <ref>）、人口（不用）、O+、A+、B+、AB+、O−、A−、B−、AB−。
- 第二個表（各民族的 ABO 分布，出處 bloodbook.com）不用。
- 126 國裡只有一部分那一列附了出處（<ref>），台灣沒有；有出處的取第一個 <ref> 的標題與網址給側欄。
- 各國的數字來源不同（捐血人、醫院、研究樣本，年代也不同），不是同一套調查；8 種加起來不一定是 100%。
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from common import download

PAGE = "Blood type distribution by country"
REVISION = 1378379911  # 2026-10-04
PAGE_URL = f"https://en.wikipedia.org/w/index.php?oldid={REVISION}"
RAW_URL = f"https://en.wikipedia.org/w/index.php?title=Blood_type_distribution_by_country&oldid={REVISION}&action=raw"
TYPES = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"]


@dataclass
class Row:
    name: str  # 表格裡的國名（{{flag|…}} 的參數）
    values: list[float | None]  # TYPES 的順序，百分比；表裡寫 n/a、「<1.0%」的是 None
    raw: list[str]  # 原本的寫法（給附註用）
    ref_title: str | None  # 出處的標題（沒有出處是 None）
    ref_url: str | None
    failed_verification: bool  # 維基百科標了 {{Failed verification}}（出處未能核實）


def _ref_info(ref: str) -> tuple[str | None, str | None]:
    """一個 <ref> 的內容 → (標題, 網址)：cite 模板的 title=、url=，或 [網址 標題] 的寫法"""
    title = re.search(r"\|\s*title\s*=\s*([^|}]+)", ref)
    url = re.search(r"\|\s*url\s*=\s*([^|}\s]+)", ref)
    if not url:
        bare = re.search(r"\[(https?://\S+)\s*([^\]]*)\]", ref) or re.search(r"(https?://[^\s|}\]<]+)", ref)
        if bare:
            url = bare
            if not title and bare.lastindex and bare.lastindex >= 2 and bare.group(2).strip():
                return bare.group(2).strip(), bare.group(1)
    t = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", title.group(1)).strip() if title else None
    t = re.sub(r"''+", "", t) if t else t
    u = url.group(1).strip() if url else None
    if u is None:
        # 期刊論文常常只有 doi、pmc 或 pmid
        for key, prefix in (("doi", "https://doi.org/"), ("pmc", "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC"),
                            ("pmid", "https://pubmed.ncbi.nlm.nih.gov/")):
            m = re.search(rf"\|\s*{key}\s*=\s*([^|}}\s]+)", ref)
            if m:
                u = prefix + m.group(1).strip()
                break
    if t is None and u is None:
        # 只寫了書名或期刊的 cite 模板：用 journal= 或整段去掉語法的文字
        journal = re.search(r"\|\s*(?:journal|website|work)\s*=\s*([^|}]+)", ref)
        t = journal.group(1).strip() if journal else None
    return t, u


def _number(cell: str) -> float | None:
    s = cell.strip()
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*%?", s)
    return float(m.group(1)) if m else None


def table() -> list[Row]:
    path = download(RAW_URL, "wikipedia", f"blood-types-{REVISION}.txt")
    text = path.read_text(encoding="utf-8")
    # 有名字的 <ref name=…>…</ref>：同一個出處後面可以只寫 <ref name=… />
    named: dict[str, str] = {}
    for m in re.finditer(r'<ref\s+name\s*=\s*"?([^">/]+?)"?\s*>(.*?)</ref>', text, flags=re.S):
        named.setdefault(m.group(1).strip(), m.group(2))
    start = text.index("==ABO and Rh distribution by country==")
    end = text.index("\n|}", start)
    body = text[start:end]
    out: list[Row] = []
    for block in body.split("\n|-"):
        if "{{flag|" not in block or "sortbottom" in block:
            continue
        head = block[block.index("{{flag|"):]
        name = re.match(r"\{\{flag\|([^}|]+)", head).group(1).strip()
        # 國名那一格到下一個以「|」開頭的行為止（<ref> 可能跨好幾行）
        cut = re.search(r"\n\|(?!-)", head)
        header, cells_text = head[: cut.start()], head[cut.end():]
        refs = re.findall(r"<ref(?:\s[^>]*)?>(.*?)</ref>|<ref\s+name\s*=\s*\"?([^\">/]+?)\"?\s*/>", header, flags=re.S)
        ref_title = ref_url = None
        has_ref = False
        for content, ref_name in refs:
            has_ref = True
            content = content or named.get(ref_name.strip(), "")
            ref_title, ref_url = _ref_info(content)
            break
        cells = re.split(r"\|\|", cells_text.replace("\n", " "))
        raw: list[str] = []
        for c in cells:
            c = re.sub(r"<ref.*?(?:</ref>|/>)", "", c, flags=re.S)
            if "style=" in c:
                c = c.split("|")[-1]
            raw.append(c.strip())
        if len(raw) != 1 + len(TYPES):
            raise RuntimeError(f"維基的血型表 {name} 那一列有 {len(raw)} 格，應該是 {1 + len(TYPES)} 格")
        raw = raw[1:]
        out.append(Row(
            name=name,
            values=[_number(c) for c in raw],
            raw=raw,
            ref_title=ref_title if has_ref else None,
            ref_url=ref_url if has_ref else None,
            failed_verification="Failed verification" in header,
        ))
        if has_ref and not (ref_title or ref_url):
            raise RuntimeError(f"維基的血型表 {name} 的出處讀不到標題與網址")
    return out


def has_source(row: Row) -> bool:
    return row.ref_title is not None or row.ref_url is not None
