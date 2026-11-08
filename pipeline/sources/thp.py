"""臺灣中藥典第四版（英文版，Taiwan Herbal Pharmacopeia 4th Edition；製作手冊第二十九批 692、702、703 共用）。

- 衛福部 2021-09 公告、2022-06-01 生效；英文版 PDF `www.mohw.gov.tw/dl-81227-…`（688 頁，2022-11 製作）。衛福部的
  〈政府網站資料開放宣告〉：全球資訊網上的資料採政府資料開放授權條款第 1 版。這裡只用「哪些品項、基原是哪些物種」這種事實。
  手冊研究時用的是 2021 年 4 月的草案（`dl-68422`，標題「臺灣中藥典第四版草案公開徵求意見」），正式版以英文版為準。
- 每一篇的開頭：拉丁藥名（全大寫）、中文名、拼音、英文名，接著一段基原說明（「Chinese angelica root is the dried root of
  Angelica sinensis (Oliv.) Diels (Fam. Umbelliferae).」）。用 `pdftotext`（不加 -layout，照閱讀順序）抽文字，
  基原說明裡「屬名 種小名」的字串再拿去對 Kew WCVP（sources/wcvp.py），對不上的不算（「Chinese angelica」這種英文字也會被濾掉）。
"""
from __future__ import annotations

import re
import subprocess

from common import download

URL = "https://www.mohw.gov.tw/dl-81227-a4342f00-f6fe-4347-8a17-058b7d6d0d89.html"
CJK = re.compile(r"[一-鿿]")
LATIN_HEAD = re.compile(r"^[A-Z][A-Z .,()'’\-]+$")
BINOMIAL = re.compile(r"\b([A-Z][a-z]+) (×\s?)?([a-z][a-z\-]{2,})\b")


def text() -> str:
    path = download(URL, "twp", "thp4-en.pdf")
    txt = path.with_name("thp4-en-raw.txt")
    if not txt.exists() or txt.stat().st_mtime < path.stat().st_mtime:
        subprocess.run(["pdftotext", str(path), str(txt)], check=True, capture_output=True)
    return txt.read_text(encoding="utf-8")


def monographs() -> list[dict]:
    """[{latin（拉丁藥名）, zh（中文名）, en（英文名）, definition（基原說明）, candidates（屬名 種小名）}]"""
    lines = text().split("\n")
    out = []
    i = 0
    while i < len(lines) - 4:
        head, zh = lines[i].strip(), lines[i + 1].strip()
        if LATIN_HEAD.match(head) and len(head) > 4 and CJK.search(zh) and len(zh) <= 12 and not CJK.search(head):
            en = lines[i + 3].strip()
            j = i + 4
            para = []
            while j < len(lines) and lines[j].strip():
                para.append(lines[j].strip())
                j += 1
            definition = re.sub(r"\s+", " ", " ".join(para))
            if "(Fam." in definition:
                # 只看基原那幾句：到最後一個「(Fam. 科名)」為止（後面是「It contains…」的含量規定，或易混淆品的說明）
                end = definition.rindex("(Fam.")
                definition = definition[: definition.index(")", end) + 1]
                cands = []
                authors: dict[str, list[str]] = {}
                for m in BINOMIAL.finditer(definition):
                    name = f"{m.group(1)} {m.group(3)}"
                    if name not in cands:
                        cands.append(name)
                    authors.setdefault(name, []).append(definition[m.end(): m.end() + 60])  # 學名後面的命名人（挑同名異物用）
                out.append({"latin": head, "zh": zh, "en": en, "definition": definition, "candidates": cands, "authors": authors})
            i = j
            continue
        i += 1
    return out
