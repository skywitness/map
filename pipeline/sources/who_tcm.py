"""WHO 的兩份傳統醫學報告（CC BY-NC-SA 3.0 IGO；製作手冊第二十九批 691、695–697、704、705 共用）。

- 《WHO global report on traditional and complementary medicine 2019》（ISBN 978-92-4-151543-6）：第 5 章的六張區域表 5.1–5.6
  （2005 與 2018 年有某項制度的會員國數），與 141 個國家的段落。
- 《WHO global report on traditional, complementary and integrative medicine 2024》：Annex 1「WHO Member States that responded
  to the surveys by Region」，194 個會員國 × 四次調查（2001、2012、2016–18、2023）有沒有回報。
- 下載：iris.who.int 的 `/server/api/core/bitstreams/<uuid>/content`（robots.txt 明文 Allow，Crawl-delay 10 秒，兩檔之間等 11 秒），
  快取在 .cache/who-tcm/；文字用 `pdftotext -layout`。
- **分區對帳**（手冊 691 的硬規則）：六張區域表相加要等於 2019 年報告正文的全球數（政策 98、法規 109、辦公室 107、
  專家委員會 93、草藥管理 124），不對就報錯、不出資料檔。
- 授權：兩份報告都是 CC BY-NC-SA 3.0 IGO（非商業、同授權分享、要引用）；衍生的資料檔照同一授權。這不是 WHO 資料集的條款
  （那個只准 public health purposes、改作要書面同意），不要混用。
"""
from __future__ import annotations

import csv
import re
import subprocess
import time
from pathlib import Path

from common import download
from sources import countries

REPORT_2019 = "https://iris.who.int/server/api/core/bitstreams/a5de1ce2-b5c1-4c5d-b529-339bc5c47e24/content"
REPORT_2024 = "https://iris.who.int/server/api/core/bitstreams/f67507c0-30a3-41c0-b497-2fa9034b197d/content"
WAVES = ["2001", "2012", "2016-18", "2023"]
# 2019 年報告正文的全球數（第 134、458、682、1075 行一帶；專家委員會在 Fig. 1 的說明）
GLOBAL_2018 = {"National policy on T&CM": 98, "Laws or regulations on T&CM": 109, "National office for T&CM": 107,
               "Expert committee on T&CM": 93, "Regulation of herbal medicines": 124}
REGIONS = {"5.1": "AFR", "5.2": "AMR", "5.3": "EMR", "5.4": "EUR", "5.5": "SEAR", "5.6": "WPR"}
# Annex 1 的國名 → ISO3（countries.from_name 對不到或會對錯的）
NAMES = {
    "the Islamic Republic of the Gambia": "GMB", "Gambia": "GMB", "Côte d’Ivoire": "CIV", "Côte d'Ivoire": "CIV",
    "Democratic Republic of the Congo": "COD", "Congo": "COG", "United Republic of Tanzania": "TZA", "Cabo Verde": "CPV",
    "Bolivia (Plurinational State of)": "BOL", "Venezuela (Bolivarian Republic of)": "VEN", "Iran (Islamic Republic of)": "IRN",
    "Republic of Korea": "KOR", "Democratic People’s Republic of Korea": "PRK", "Democratic People's Republic of Korea": "PRK",
    "Lao People’s Democratic Republic": "LAO", "Lao People's Democratic Republic": "LAO", "Micronesia (Federated States of)": "FSM",
    "Republic of Moldova": "MDA", "Russian Federation": "RUS", "Syrian Arab Republic": "SYR", "Türkiye": "TUR", "Turkey": "TUR",
    "United Kingdom of Great Britain and Northern Ireland": "GBR", "United States of America": "USA", "Viet Nam": "VNM",
    "Netherlands (Kingdom of the)": "NLD", "Netherlands": "NLD", "North Macedonia": "MKD", "Czechia": "CZE", "Eswatini": "SWZ",
    "Timor-Leste": "TLS", "Brunei Darussalam": "BRN", "Saint Kitts and Nevis": "KNA", "Saint Lucia": "LCA",
    "Saint Vincent and the Grenadines": "VCT", "São Tomé and Principe": "STP", "Sao Tome and Principe": "STP",
    "Andora": "AND",  # 2019 年報告第 5 章的拼字
}


def _pdf_text(url: str, name: str) -> str:
    path = download(url, "who-tcm", f"{name}.pdf")
    txt = path.with_suffix(".txt")
    if not txt.exists() or txt.stat().st_mtime < path.stat().st_mtime:
        subprocess.run(["pdftotext", "-layout", str(path), str(txt)], check=True)
    return txt.read_text(encoding="utf-8")


def report_2019() -> str:
    return _pdf_text(REPORT_2019, "report-2019")


def report_2019_raw() -> list[tuple[int, str]]:
    """2019 年報告不加 -layout 的文字（照閱讀順序，國家段落用這個），[(印刷頁碼, 一行)]"""
    path = download(REPORT_2019, "who-tcm", "report-2019.pdf")
    txt = path.with_name("report-2019-raw.txt")
    if not txt.exists() or txt.stat().st_mtime < path.stat().st_mtime:
        subprocess.run(["pdftotext", str(path), str(txt)], check=True)
    pages = txt.read_text(encoding="utf-8").split("\f")
    lines = [(pi + 1, ln) for pi, page in enumerate(pages) for ln in page.split("\n")]
    # PDF 頁 → 印刷頁碼：表 5.1 印在第 60 頁（前一頁有單獨一行的「59」）
    pg = next(p for p, ln in lines if ln.startswith("Table 5.1. WHO African Region"))
    if not any(ln.strip() == "59" for p, ln in lines if p == pg - 1):
        raise RuntimeError("2019 年報告的頁碼對不上（表 5.1 應該在第 60 頁），版本可能換了")
    return [(p + 60 - pg, ln) for p, ln in lines]


# 第 5 章三個英國海外領地（5.7 Other territories 的條列，不是會員國，不算進分區對帳）
TERRITORIES = {"Bermuda": "BMU", "Cayman Islands": "CYM", "Turks and Caicos Islands": "TCA"}


def country_blocks() -> list[dict]:
    """2019 年報告第 5 章的國家段落：[{n, name, iso3, region, pages, text}]；149 個會員國依編號＋3 個英國海外領地（n 是 0）。
    每一國從「n. 國名」那一行到下一國之前；區域的開頭（5.x WHO … Region 與區域表）不算進前一國。"""
    lines = report_2019_raw()
    start = next(i for i, (_, ln) in enumerate(lines) if ln.startswith("Table 5.1. WHO African Region"))
    end = next(i for i, (_, ln) in enumerate(lines) if i > start and ln.strip() == "5.7 Other territories")
    head = re.compile(r"^(\d{1,3})\. (\S.{2,60})$")
    region = "AFR"
    heads = []
    for i in range(start, end):
        s = lines[i][1].strip()
        m = re.match(r"^5\.([1-6]) WHO ", s)
        if m:
            region = REGIONS[f"5.{m.group(1)}"]
        m = head.match(s)
        if not m:
            continue
        nxt = " ".join(lines[j][1].strip() for j in range(i + 1, min(i + 3, end)))
        n = int(m.group(1))
        # 國家的標題後面接「National policy on T&CM」或「X did not reply…」；菲律賓段落裡的 1.–10. 是藥品分類的清單
        if "National policy on T&CM" in nxt[:40] or "did not reply" in nxt or "national policy" in nxt.lower()[:90] or "response" in nxt[:120]:
            if heads and n <= 10 and heads[-1]["n"] > 100:
                continue
            heads.append({"n": n, "name": m.group(2).strip(), "region": region, "i": i})
    blocks = []
    for k, h in enumerate(heads):
        j = heads[k + 1]["i"] if k + 1 < len(heads) else end
        body, pages, last = [], [], None
        for p, ln in lines[h["i"]:j]:
            if p != last:
                body.append(f"[p. {p}]")
                last = p
            body.append(ln)
        text = "\n".join(body)
        cut = re.search(r"\n(\[p\. \d+\]\n)?(COUNTRY SUMMARIES\n+)?5\.\d WHO [^\n]*\n", text)
        if cut:
            text = text[: cut.start()]
        pages = sorted({int(x) for x in re.findall(r"\[p\. (\d+)\]", text)})
        blocks.append({"n": h["n"], "name": h["name"], "iso3": iso3(h["name"]), "region": h["region"], "pages": pages, "text": text})
    nums = [b["n"] for b in blocks]
    if nums != list(range(1, 150)) and sorted(nums) != list(range(1, 150)):
        raise RuntimeError(f"2019 年報告第 5 章的國家段落不是 1–149：少了 {sorted(set(range(1, 150)) - set(nums))}")
    # 5.7 的三個屬地：「• 名稱: 內容」（pdftotext 會把開頭的字母拆開，例如「•B\n ermuda:」）
    tail = "\n".join(ln for _, ln in lines[end:end + 60])
    tail = tail[: tail.index("REFERENCES")] if "REFERENCES" in tail else tail
    flat = re.sub(r"•\s*([A-Z])\s*\n[\s\x07]*", r"• \1", tail.replace("\x07", ""))  # 「•B\n\x07 ermuda:」
    page = next(p for p, ln in lines[end:end + 5] if ln.strip())
    for name, code in TERRITORIES.items():
        m = re.search(r"•\s*" + re.escape(name) + r":(.*?)(?=\n\s*•|\n\s*\d{3}\s*\n|$)", flat, re.S)
        if not m:
            raise RuntimeError(f"2019 年報告 5.7 找不到 {name}")
        blocks.append({"n": 0, "name": name, "iso3": code, "region": "territory", "pages": [page], "text": f"[p. {page}]\n{name}:{m.group(1)}"})
    return blocks


def report_2024() -> str:
    text = _pdf_text(REPORT_2024, "report-2024")
    time.sleep(0)  # 兩檔都在快取時不必等；第一次下載由 common.download 依序進行
    return text


def iso3(name: str) -> str:
    name = re.sub(r"\d+$", "", name.strip()).strip()  # 註腳的數字（South Sudan1）
    name = re.sub(r"\s*\(the\)$", "", name)  # 「Bahamas (the)」
    code = NAMES.get(name) or countries.from_name(name)
    if not code:
        raise ValueError(f"WHO 報告的國名對不到代碼：{name!r}")
    return code


def annex1() -> dict[str, dict]:
    """{iso3: {region, name, waves: [四次調查有沒有回報]}}；194 國、每次調查的國數要跟正文一致"""
    text = report_2024()
    start = text.index("WHO MEMBER STATES THAT RESPONDED TO THE SURVEYS")  # 附錄第一頁的標題（之後每頁的頁首是「ANNEX 1 — …」）
    end = text.index("ANNEX 2", start) if "ANNEX 2" in text[start:] else len(text)
    lines = text[start:end].split("\n")
    cols: list[int] = []
    out: dict[str, dict] = {}
    last: dict | None = None
    for line in lines:
        if "(2001)" in line and "(2023)" in line:
            cols = [line.index(f"({w})") + len(w) // 2 + 1 for w in WAVES]
            continue
        m = re.match(r"^\s*(\d{1,3})\s+(AFR|AMR|EMR|EUR|SEAR|WPR)\s+(\S.*?)\s*$", line)
        if m and cols:
            body = line[: cols[0] - 8] if len(line) > cols[0] - 8 else line
            name = re.sub(r"\s{2,}.*$", "", m.group(3)).strip()
            flags = [False] * 4
            for pos in [i for i, ch in enumerate(line) if ch == "Y" and i >= len(body) - 2 and line[max(0, i - 1)] == " " and (i + 1 >= len(line) or line[i + 1] == " ")]:
                k = min(range(4), key=lambda j: abs(cols[j] - pos))
                flags[k] = True
            last = {"no": int(m.group(1)), "region": m.group(2), "name": name, "waves": flags, "col": m.start(3)}
            out[f"{m.group(2)}-{m.group(1)}"] = last
            continue
        indent = len(line) - len(line.lstrip())
        if last and line.strip() and abs(indent - last["col"]) <= 2 and len(line.strip()) < 40 and "Y" not in line.split() \
                and not re.search(r"\d", line):
            last["name"] = (last["name"] + " " + line.strip()).strip()  # 換行的國名（Gambia）
    result = {}
    for r in out.values():
        code = iso3(r["name"])
        if code in result:
            raise ValueError(f"Annex 1 有兩列對到 {code}：{result[code]['name']}、{r['name']}")
        result[code] = r
    totals = [sum(r["waves"][k] for r in result.values()) for k in range(4)]
    if len(result) != 194 or totals != [142, 134, 114, 106]:
        raise RuntimeError(f"Annex 1 解析結果不對：{len(result)} 國、四次調查 {totals}（應該是 194 國、142／134／114／106）")
    if "responses from 106 Member States that completed the" not in re.sub(r"\s+", " ", text):
        raise RuntimeError("2024 年報告正文找不到第三次調查的 106 國，版本可能換了")
    return result


def regional_tables() -> dict[str, dict[str, tuple[int | None, int]]]:
    """2019 年報告的區域表 5.1–5.6：{區域: {項目: (2005 年國數, 2018 年國數)}}；六區相加要等於正文的全球數"""
    text = report_2019()
    out: dict[str, dict[str, tuple[int | None, int]]] = {}
    for num, region in REGIONS.items():
        i = text.index(f"Table {num}. WHO")
        block = text[i: i + 4000]
        rows: dict[str, tuple[int | None, int]] = {}
        pending = ""
        for line in block.split("\n")[1:]:
            if line.strip().startswith("Note:"):
                break
            m = re.match(r"^\s*(\S.*?)?\s{2,}([\d–-]+)\s+(\d+)\s+(\d+)%\s+(\d+)%\s*$", line)
            if m:
                label = ((pending + " " + (m.group(1) or "")).strip() if pending else (m.group(1) or "").strip())
                pending = ""
                y05 = None if m.group(2) in ("–", "-") else int(m.group(2))
                rows[label] = (y05, int(m.group(3)))
            elif rows and line.strip() and not re.search(r"\d", line) and not line.strip()[0].islower():
                pending = (pending + " " + line.strip()).strip()  # 表頭之後、數字在下一列的項目名稱；小寫開頭的是上一列名稱的後半，不要
        out[region] = rows
    for label, expected in GLOBAL_2018.items():
        got = sum(rows[label][1] for rows in out.values())
        if got != expected:
            raise RuntimeError(f"分區對帳不對：{label} 六區相加 {got}，報告的全球數 {expected}；不出資料檔")
    return out


# ---- 順序 704：第 5 章國家段落的逐國抽取（手工整理的資料檔，逐列附出處） ----
CURATED = Path(__file__).resolve().parent.parent / "data" / "who-tcm" / "countries-2019.csv"
REGION_N = {"AFR": 47, "AMR": 35, "EMR": 21, "EUR": 53, "SEAR": 11, "WPR": 27}  # 各區的會員國數（區域表的 N）
TABLE_ROWS = {"policy": "National policy on T&CM", "law": "Laws or regulations on T&CM", "programme": "National programme on T&CM",
              "office": "National office for T&CM", "committee": "Expert committee on T&CM", "institute": "National research institute for T&CM",
              "herbal_reg": "Regulation of herbal medicines", "registration": "Registration of herbal medicines"}
# 2019 年報告正文的全球數（2018 年；沒有區域表的項目）：保險給付 45、從業人員受法規管 78、基本藥物清單收草藥 34。
# 「要不要執照」（報告 70 國）沒有收進資料檔：抽取時把「要登記」也算進去，抽到 75 國，對不上
# 藥典、GMP、上市後監視、教育在報告裡只有 2012 年的數（段落另外寫到 2016–18 的更新），沒有可以對的數，只靠逐列的引文
GLOBAL_TEXT = {"insurance": (45, "45 Member States reported the coverage of T&CM by health insurance"),
               "provider_reg": (78, "78 Member States reported regulation of T&CM providers as at 2018"),
               "neml": (34, "As of 2018, 34 Member States replied in the affirmative to having herbal medicines included in their NEML")}
VALUES = {"yes", "no", "developing", "unknown"}
ITEM_FIELDS = ("pharmacopoeia", "monographs", "gmp", "surveillance", "neml", "provider_reg", "education", "insurance")


def _norm_text(s: str) -> str:
    return "".join(ch for ch in s.lower() if ch.isalnum())


def curated() -> dict[str, dict]:
    """{iso3: {region, block, name, fields: {欄位: (值, 頁碼, 引文)}, extra: {名稱欄位: 文字}}}。
    檢查（不過就報錯、不出資料檔）：每一句引文都要逐字出現在那一國的段落裡、頁碼在段落的頁碼範圍內；
    分區對帳：每一區每一項「有」的國數不超過區域表的國數、「沒有」的國數不超過區域表以外的國數（區域表也算了沒有段落的國家，
    段落本身也不完整，所以只能檢查不矛盾，不會剛好相等）；沒有區域表的保險給付、從業人員法規、執照、基本藥物清單對全球數。"""
    blocks = {b["iso3"]: b for b in country_blocks()}
    flat = re.sub(r"\s+", " ", "\n".join(ln for _, ln in report_2019_raw()))
    tables = regional_tables()
    out: dict[str, dict] = {}
    with CURATED.open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            c = out.setdefault(r["iso3"], {"region": r["region"], "block": int(r["block"]), "name": r["country"], "fields": {}, "extra": {}})
            if r["field"] in TABLE_ROWS or r["field"] in ITEM_FIELDS:
                if r["value"] not in VALUES:
                    raise ValueError(f"{CURATED.name}：{r['iso3']} {r['field']} 的值 {r['value']!r} 不對")
                if r["value"] != "unknown":
                    b = blocks.get(r["iso3"])
                    if not b or _norm_text(r["quote"]) not in _norm_text(b["text"]) or int(r["page"]) not in b["pages"]:
                        raise RuntimeError(f"{CURATED.name}：{r['iso3']} {r['field']} 的引文不在段落裡（或頁碼不對）：{r['quote'][:80]!r}")
                c["fields"][r["field"]] = (r["value"], int(r["page"]) if r["page"] else None, r["quote"])
            else:
                c["extra"][r["field"]] = r["value"]
    members = {k: v for k, v in out.items() if v["region"] in REGION_N}
    if len(members) != 149 or len(out) != 152:
        raise RuntimeError(f"{CURATED.name} 應該有 149 個會員國與 3 個屬地，現在是 {len(members)}／{len(out) - len(members)}")
    for region, n in REGION_N.items():
        for f, label in TABLE_ROWS.items():
            vals = [v["fields"][f][0] for v in members.values() if v["region"] == region]
            yes, no, t = vals.count("yes"), vals.count("no"), tables[region][label][1]
            if yes > t or no > n - t:
                raise RuntimeError(f"分區對帳不對：{region} {label} 段落抽到有 {yes}、沒有 {no}；區域表 {t}／{n}；不出資料檔")
    for f, (t, sentence) in GLOBAL_TEXT.items():
        if sentence not in flat:
            raise RuntimeError(f"2019 年報告找不到「{sentence}」，版本可能換了")
        vals = [v["fields"][f][0] for v in members.values()]
        if vals.count("yes") > t or vals.count("no") > 194 - t:
            raise RuntimeError(f"全球對帳不對：{f} 段落抽到有 {vals.count('yes')}、沒有 {vals.count('no')}；報告的全球數 {t}／194；不出資料檔")
    return out
