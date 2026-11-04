"""藥品支出與取得：每年核准幾個新藥、孤兒藥（2026-11-04，製作手冊第二十批 330、331）。

- 美國：FDA《Compilation of CDER NME and New Biologic Approvals 1985–2025》（xlsx，公共領域）：每年核准的新分子實體與新生物製劑
  （Approval Year），其中有孤兒藥指定的（Orphan Drug Designation = Yes）。
- 歐盟：EMA 的 medicines 表（xlsx，表頭第 9 列；EMA 條款，可轉載，需註明 EMA）：人用藥、有上市許可日（Marketing authorisation
  date，日/月/年）的，去掉學名藥（Generic）與生物相似藥（Biosimilar），依上市許可年份算；其中 Orphan medicine = Yes 的是孤兒藥。
  EMA 的中央核准在歐盟 27 國與 EEA 的冰島、列支敦斯登、挪威都有效，所以這 30 國畫同一個數字（說明寫）。各國自己核准的
  （國家程序、去中央化程序）不在 EMA 的表裡。
- 歐盟的孤兒藥指定：EMA 的 orphan designations 表（表頭第 9 列），依指定日的年份算（同一個藥可能有好幾筆指定）。
- 美國的孤兒藥指定：FDA「Search Orphan Drug Designations and Approvals」的全部匯出（accessdata.fda.gov 對程式回 Akamai 的
  防濫用頁，使用者用瀏覽器下載，本機 session 放在 map-plan 的 `data/fda-us/oopd-search-results-2026-11-04.xls`；重跑前複製到
  `pipeline/.cache/fda-us/`）。副檔名 .xls，內容其實是 cp1252 的 HTML 表；同一個指定核准過幾次就有幾列，以「Generic Name +
  Date Designated + Orphan Designation」去重（7,934 個指定），依指定日的年份算，後來撤銷的也算（跟歐盟一樣）。公共領域。
- 台灣：食藥署《2025 年報》英文版附錄 Table 5「Statistics of approved medicinal products every year」（PDF 第 134 頁，
  2010–2024 年每年核准的藥品許可證張數，分學名藥、原料藥、新藥、生物藥品、孤兒藥，各分本國製造與輸入）。www.fda.gov.tw 的
  robots.txt 對 ClaudeBot 是 Disallow: /，使用者用瀏覽器下載，本機 session 放在 map-plan 的 `data/fda-tw/`；重跑前複製到
  `pipeline/.cache/fda-tw/`。授權：食藥署網站著作權聲明（以食藥署名義發表的著作，合理範圍內可重製、公開傳輸，註明出處），
  只用表裡的逐年數字。**台灣的「孤兒藥」是新藥以外的另一類**，所以台灣的「新藥」用新藥加孤兒藥（「其中的孤兒藥」才說得通）；
  都是許可證張數，不是新成分數，生物藥品另一類、沒有算進去。
- 日本：PMDA「List of Approved Products（New Drugs）」英文 PDF（2004 年 4 月到 2026 年 2 月，207 頁，網站政策是公共資料利用規約
  PDL 1.0：註明出處、加工要說明；網站不准自動巡迴下載，這裡只抓這一個檔並存快取）。每筆核准是「審查類別 日期 編號 商品名
  （申請公司）核准／部分變更 有效成分 備註」，依會計年度、審查類別排列，所以用每筆自己的日期分年。備註寫「new active
  ingredient(s)」的算新成分（PDF 用成分名底線標新成分，跟備註核對過：底線區塊比備註多的是一筆含兩種新成分或同一行的底線
  分成兩段，只有一筆 Nirsevimab 有備註沒底線），其中有「[Orphan drug]」的算孤兒藥。每頁頁首的「underlined: new active
  ingredient」先去掉。2008 年 7 月以前的頁面是另一種版面、抽不出逐筆日期，所以只用 2009–2025 年（完整的曆年）。
  一筆可能含同成分的好幾個品項；不同公司各自申請的同一成分會各算一筆。
- 「新藥」的定義各國不同（FDA 只算新成分，EMA 去掉學名藥與生物相似藥後還含新劑型、同成分不同商品名），不能直接比大小。
"""
from __future__ import annotations

import datetime as dt
import hashlib
import re
from collections import Counter
from html.parser import HTMLParser

import openpyxl
from pypdf import PdfReader

from common import CACHE_DIR, OUT_DIR, download, indicator_file, write_json

OUT = OUT_DIR / "topics" / "medicines"
FDA_URL = "https://www.fda.gov/media/177921/download?attachment"
EMA_URL = "https://www.ema.europa.eu/en/documents/report/medicines-output-medicines-report_en.xlsx"
EMA_ORPHAN_URL = "https://www.ema.europa.eu/en/documents/report/medicines-output-orphan_designations-report_en.xlsx"
FDA_OOPD = CACHE_DIR / "fda-us" / "oopd-search-results-2026-11-04.xls"
FDA_OOPD_SHA256 = "d80083a7c3cb037700e6e63f17c2ed51d7d70829b46b418444a82b7a601412c6"
PMDA_URL = "https://www.pmda.go.jp/files/000281190.pdf"  # 2004 年 4 月到 2026 年 2 月
PMDA_FIRST = 2009  # 2008 年 7 月以前是另一種版面
TFDA_PDF = CACHE_DIR / "fda-tw" / "tfda-annual-report-2025-en.pdf"
TFDA_SHA256 = "8f6ee6d7accc323aa541c64e2333f01c5031299c910a76cba405c297b7167d79"
FIRST = 1995
LAST = 2025
EU_EEA = ["AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "IRL", "ITA", "LVA",
          "LTU", "LUX", "MLT", "NLD", "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE", "ISL", "LIE", "NOR"]


def _local(path, sha256: str, plan_path: str) -> bytes:
    """本機 session 放在 map-plan 的檔（cloud 不能用程式抓），重跑前複製到 pipeline/.cache/"""
    if not path.exists():
        raise RuntimeError(f"沒有 {path}：請把 map-plan 的 {plan_path} 複製到這裡")
    body = path.read_bytes()
    if hashlib.sha256(body).hexdigest() != sha256:
        raise RuntimeError(f"{path} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改")
    return body


class _Rows(HTMLParser):
    """把 HTML 表的每一列讀成字串的 list"""

    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.rows.append([])
        elif tag in ("td", "th"):
            self._cell = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None and self.rows:
            self.rows[-1].append(" ".join("".join(self._cell).split()))
            self._cell = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


def _us_designations() -> Counter:
    """美國 FDA 的孤兒藥指定數，依指定日的年份"""
    parser = _Rows()
    parser.feed(_local(FDA_OOPD, FDA_OOPD_SHA256, "data/fda-us/oopd-search-results-2026-11-04.xls").decode("cp1252"))
    head, *rows = [r for r in parser.rows if r]
    col = {name: i for i, name in enumerate(head)}
    key_cols = [col["Generic Name"], col["Date Designated"], col["Orphan Designation"]]
    seen = {tuple(r[i] for i in key_cols) for r in rows}
    if len(rows) != 8282 or len(seen) != 7934:
        raise RuntimeError(f"FDA 孤兒藥指定：{len(rows)} 列、{len(seen)} 個指定，跟 README 的 8,282 列、7,934 個不一樣")
    return Counter(int(date[-4:]) for _, date, _ in seen)


def _tfda_table5() -> dict[int, tuple[int, int]]:
    """食藥署年報 Table 5：{年: (新藥許可證張數, 孤兒藥許可證張數)}"""
    _local(TFDA_PDF, TFDA_SHA256, "data/fda-tw/tfda-annual-report-2025-en.pdf")
    page = next(t for t in (pg.extract_text() for pg in PdfReader(TFDA_PDF).pages)
                if "Table 5" in t and "Statistics of approved medicinal products" in t)
    out = {}
    for line in page.splitlines():
        m = re.fullmatch(r"\s*(20\d\d)((?:\s+[\d,]+){16})\s*", line)
        if not m:
            continue
        n = [int(x.replace(",", "")) for x in m.group(2).split()]
        # 學名藥、原料藥、新藥、生物藥品、孤兒藥各三欄（本國、輸入、合計），最後是總計
        sums = [n[i * 3 + 2] for i in range(5)]
        if any(n[i * 3] + n[i * 3 + 1] != n[i * 3 + 2] for i in range(5)) or sum(sums) != n[15]:
            raise RuntimeError(f"食藥署 Table 5 的 {m.group(1)} 年加不起來：{n}")
        out[int(m.group(1))] = (sums[2], sums[4])
    if sorted(out) != list(range(2010, 2025)):
        raise RuntimeError(f"食藥署 Table 5 的年份不對：{sorted(out)}")
    return out


def _pmda() -> tuple[Counter, Counter]:
    """PMDA：每年核准含新成分的件數與其中的孤兒藥，{年: 件數}"""
    path = download(PMDA_URL, "pmda", "approved-new-drugs-000281190.pdf")
    header = re.compile(r"underlined:\s*new\s*active\s*ingredients?", re.I)
    text = "\n".join(header.sub(" ", pg.extract_text()) for pg in PdfReader(path).pages)
    mon = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?"
    starts = list(re.finditer(rf"\b{mon} ?\d{{1,2}}, ?(\d{{4}})", text))
    new, orphan = Counter(), Counter()
    for i, m in enumerate(starts):
        year = int(m.group(1))
        seg = text[m.start(): starts[i + 1].start() if i + 1 < len(starts) else len(text)]
        if year < PMDA_FIRST or not re.search(r"new\s+active\s+ingredient", seg, re.I):
            continue
        new[year] += 1
        if "[Orphan drug]" in seg:
            orphan[year] += 1
    if not 30 <= new[2024] <= 100:
        raise RuntimeError(f"PMDA 2024 年的新成分 {new[2024]} 件，PDF 的版面可能改了")
    return new, orphan


def _year(cell: object) -> int | None:
    if isinstance(cell, (dt.date, dt.datetime)):
        return cell.year
    m = re.search(r"(\d{4})", str(cell or ""))
    return int(m.group(1)) if m else None


def _sheet(path, header_first: str) -> list[dict]:
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(max_col=60, values_only=True))
    hi = next(i for i, r in enumerate(rows) if r and r[0] and str(r[0]).strip() == header_first)
    head = [str(c).strip() if c else "" for c in rows[hi]]
    return [dict(zip(head, r)) for r in rows[hi + 1:] if r and any(r)]


def build() -> None:
    fda = _sheet(download(FDA_URL, "newdrugs", "fda-nme.xlsx"), "Proprietary  Name")
    us_new = Counter(int(r["Approval Year"]) for r in fda if r.get("Approval Year"))
    us_orphan = Counter(int(r["Approval Year"]) for r in fda if r.get("Approval Year") and str(r.get("Orphan Drug Designation", "")).strip() == "Yes")
    ema = _sheet(download(EMA_URL, "newdrugs", "ema-medicines.xlsx"), "Category")
    human = [r for r in ema if r["Category"] == "Human" and r.get("Marketing authorisation date")
             and r.get("Generic") != "Yes" and r.get("Biosimilar") != "Yes"]
    eu_new = Counter(_year(r["Marketing authorisation date"]) for r in human)
    eu_orphan = Counter(_year(r["Marketing authorisation date"]) for r in human if r.get("Orphan medicine") == "Yes")
    orphan = _sheet(download(EMA_ORPHAN_URL, "newdrugs", "ema-orphan.xlsx"), "Medicine name")
    date_col = next(k for k in orphan[0] if "designation" in k.lower() and "date" in k.lower())
    # 「Negative」是被拒絕的申請，不是指定
    eu_designations = Counter(_year(r[date_col]) for r in orphan if r.get(date_col) and r.get("Status") != "Negative")
    years = list(range(FIRST, LAST + 1))
    us_designations = _us_designations()
    tfda = _tfda_table5()
    tw_new = {y: new + orphan for y, (new, orphan) in tfda.items()}
    tw_orphan = {y: orphan for y, (_, orphan) in tfda.items()}
    jp_new, jp_orphan = _pmda()
    eu_note = "歐盟中央核准（EMA），歐盟 27 國與冰島、列支敦斯登、挪威共用同一個數字；各國自己核准的不算"
    eu_note_en = "Central EU authorisation (EMA), shared by the 27 EU countries plus Iceland, Liechtenstein and Norway; national authorisations are not included"
    for name, us, eu, unit in (("new-drugs", us_new, eu_new, "個"), ("orphan-approvals", us_orphan, eu_orphan, "個"),
                               ("orphan-designations", us_designations, eu_designations, "件")):
        values = {}
        if us is not None:
            values["USA"] = [us.get(y, 0) for y in years]
        for c in EU_EEA:
            values[c] = [eu.get(y, 0) for y in years]
        hints = {c: eu_note for c in EU_EEA}
        hints_en = {c: eu_note_en for c in EU_EEA}
        if name == "orphan-designations":
            hints["USA"] = "FDA 孤兒藥指定資料庫，依指定日的年份（後來撤銷的也算）"
            hints_en["USA"] = "FDA orphan designation database, by designation date (including later withdrawals)"
        else:
            hints["USA"] = "FDA 的新分子實體與新生物製劑" + ("，其中有孤兒藥指定的" if name == "orphan-approvals" else "")
            hints_en["USA"] = "FDA new molecular entities and new biologics" + (" with orphan drug designation" if name == "orphan-approvals" else "")
        no_value, no_value_en = {}, {}
        if name == "orphan-designations":
            no_value["JPN"] = "日本的孤兒藥指定沒有整理"
            no_value_en["JPN"] = "Japan’s orphan designations have not been compiled"
        else:
            jp = jp_new if name == "new-drugs" else jp_orphan
            values["JPN"] = [jp.get(y, 0) if y >= PMDA_FIRST else None for y in years]
            hints["JPN"] = ("PMDA 核准的新藥裡含新成分的件數（依備註）" + ("，其中標孤兒藥的" if name == "orphan-approvals" else "")
                            + "；同一成分不同公司申請的各算一件")
            hints_en["JPN"] = ("PMDA approvals of drugs with a new active ingredient (per the notes)"
                               + (" that are orphan drugs" if name == "orphan-approvals" else "")
                               + "; the same ingredient filed by different companies counts separately")
        if name == "orphan-designations":
            no_value["TWN"] = "台灣沒有可以跟美國、歐盟比的孤兒藥指定統計"
            no_value_en["TWN"] = "Taiwan has no orphan designation statistics comparable with the US and EU"
        else:
            tw = tw_new if name == "new-drugs" else tw_orphan
            values["TWN"] = [tw.get(y) for y in years]
            if name == "new-drugs":
                hints["TWN"] = "食藥署核准的新藥加孤兒藥的許可證張數（不是新成分數，含新劑型、新含量；生物藥品另計，沒有算進去）"
                hints_en["TWN"] = "Taiwan FDA licences granted for new drugs plus orphan drugs (licences, not new active ingredients; includes new dosage forms and strengths; biologics are counted separately and not included)"
            else:
                hints["TWN"] = "食藥署核准的孤兒藥許可證張數（大多是輸入的）"
                hints_en["TWN"] = "Taiwan FDA licences granted for orphan drugs (mostly imported)"
        write_json(OUT / f"{name}.json", indicator_file(
            name, unit, years, dict(sorted(values.items())), hints=hints, hintsEn=hints_en, noValue=no_value, noValueEn=no_value_en,
            # 台灣只到 2024 年（年報晚一年），2025 年顯示 2024 年的值
            **({} if name == "orphan-designations" else {"latestWithin": 1})))
    print(f"  美國新藥：{ {y: us_new[y] for y in (2018, 2023, 2024, 2025)} }，孤兒藥 { {y: us_orphan[y] for y in (2023, 2024, 2025)} }")
    print(f"  歐盟新藥（不含學名藥、生物相似藥）：{ {y: eu_new[y] for y in (2009, 2018, 2022, 2025)} }，孤兒藥 { {y: eu_orphan[y] for y in (2023, 2024, 2025)} }")
    print(f"  日本（新成分, 其中孤兒藥）：{ {y: (jp_new[y], jp_orphan[y]) for y in (2009, 2014, 2020, 2024, 2025)} }")
    print(f"  美國孤兒藥指定：{ {y: us_designations[y] for y in (2016, 2022, 2024, 2025)} }；"
          f"台灣（新藥＋孤兒藥, 孤兒藥）：{ {y: (tw_new[y], tw_orphan[y]) for y in (2010, 2016, 2023, 2024)} }")
    print(f"  歐盟孤兒藥指定：{ {y: eu_designations[y] for y in (2015, 2016, 2022, 2025)} }（{date_col}，共 {sum(eu_designations.values())}）")
