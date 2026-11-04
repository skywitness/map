"""文化：電影院、文化工作者、遺產保存的公共支出（2026-11-04，製作手冊第二十一批 371、374、375）。

UNESCO 統計研究所（UIS）的公開 API（https://api.uis.unesco.org/api/public/data/indicators?indicator=…，免登入免金鑰；
UIS 資料是 CC BY-SA 4.0，資料檔同樣授權，見 DESIGN.md 第 8 節第 115 點）：
- 371 220174「Total number of indoor cinemas」：室內電影院家數，1995–2017（之後 UIS 沒有再收）；每十萬人用 UN WPP。
- 374 CE.RA.CULOCC1.1.OV.ILOSTAT.1：文化職業的就業人數占總就業的比例（UIS 依 ILOSTAT 的職業分類算），2010–2016。
- 375 HEXPCSTPPPCAP.HER.PU：每人花在文化與自然遺產保存的公共支出（購買力平價美元，固定價格），2017–2024。
年份很零散，資料檔設 latestWithin。台灣都不在 UIS 裡：文化工作者、遺產支出沒有；電影院用文化部的數字：
- 文化統計網「電影院概況」Excel（2008–2024 年的家數、廳數、每十萬人銀幕數）與「電影片映演業統計」PDF（2026 年 5 月，
  2014–2025 年，暫時性資料）。stat.moc.gov.tw 從 cloud 回 403，本機 session 下載，放在 map-plan 的 `data/moc/`
  （README 有核對）；重跑前把 `moc-cinemas-2008-2024.xlsx`、`moc-film-exhibition-2026-05.pdf` 複製到 `pipeline/.cache/moc/`。
  2025 年用 PDF，重疊的 2014–2024 年兩邊要一樣。只用逐年的家數（事實數字），註明文化部。
- 2016 年 7 月起改算實際營業的家數（電影法刪除映演業許可制），2015 年以前是許可證家數，2015→2016 年的 125→109 是定義改了。
- 時間軸因此延到 2025 年；其他國家照 latestWithin 顯示 10 年內最近的 UIS 值（多半是 2015–2017 年）並標出資料年份。

372 一年出版幾本書：WIPO《The Global Publishing Industry in 2022》（CC BY 4.0，2023 年出版，是最新的一版）表 3「Number of books
deposited at recognized repositories, 2022」，82 個國家或地區的國家圖書館（法定送存機構）收到的書，分紙本、數位、其他。
沒有 CSV，用 pypdf 抽第 18、19 頁的表。台灣不在表裡，用國家圖書館 ISBN 中心的「臺灣出版新書預告書訊」（政府資料開放平臺
資料集 6730，政府資料開放授權條款第 1 版）逐月 CSV 補：一年申請的 ISBN 裡資料類型是圖書、電子書的筆數（有聲書、地圖、
點字不算），是 ISBN 申請數不是送存件數，網站只留 2024 年 1 月以後的檔，所以台灣是 2024、2025 年；資料檔設 latestWithin，
2024、2025 年的地圖上其他國家是 2022 年的值。
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import time

import openpyxl
from pypdf import PdfReader

from common import CACHE_DIR, OUT_DIR, download, indicator_file, to_series, write_json
from sources import wpp
from sources.countries import from_name, to_iso3

OUT = OUT_DIR / "topics" / "culture"
URL = "https://api.uis.unesco.org/api/public/data/indicators?indicator={}"
WIPO_PDF = "https://www.wipo.int/edocs/pubdocs/en/wipo-pub-1064-2023-2-en-the-global-publishing-industry-in-2022.pdf"
WIPO_YEAR = 2022
MOC_XLSX = CACHE_DIR / "moc" / "moc-cinemas-2008-2024.xlsx"
MOC_XLSX_SHA256 = "baccd1aaf9648ff725288cef371da6710cc88cdc38edc8610b19c0fcb979d71a"
MOC_PDF = CACHE_DIR / "moc" / "moc-film-exhibition-2026-05.pdf"
MOC_PDF_SHA256 = "bae9a519951cd828aec400ba58d464f3eee82984e4347258752147b1ccd535f0"
ISBN_CSV = "https://isbn.ncl.edu.tw/NEW_ISBNNet/opendata/{}{:02d}_isbn.csv"
ISBN_YEARS = (2024, 2025)  # ISBN 中心的網站只留 2024 年 1 月以後的逐月檔（2023 年 12 月以前 HTTP 404）
ISBN_DIGITAL = ("數位平台電子書", "電子出版品")  # 資料類型的開頭；「數位平台電子書 (EPS)」也算
ISBN_PRINT = ("圖書",)
NUM = r"([\d,]+|\.\.)"
ROW = re.compile(rf"^\s*(\S.*?)\s{{2,}}{NUM}\s+{NUM}\s+{NUM}\s+{NUM}\s*$")


def _uis(code: str) -> dict[str, dict[int, float]]:
    data = json.loads(download(URL.format(code), "uis", f"{code}.json").read_text(encoding="utf-8"))
    out: dict[str, dict[int, float]] = {}
    for r in data["records"]:
        iso3 = to_iso3(r["geoUnit"])
        if iso3 and r["value"] is not None:
            out.setdefault(iso3, {})[int(r["year"])] = float(r["value"])
    return out


def _local(path, sha256: str) -> None:
    if not path.exists():
        raise RuntimeError(f"沒有 {path}：請把 map-plan 的 data/moc/{path.name} 複製到這裡")
    if hashlib.sha256(path.read_bytes()).hexdigest() != sha256:
        raise RuntimeError(f"{path} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改")


def _taiwan_cinemas() -> dict[int, tuple[int, int]]:
    """文化部的電影院家數與廳數：{年: (家數, 廳數)}，2008–2024 年用 Excel，2025 年用 PDF"""
    _local(MOC_XLSX, MOC_XLSX_SHA256)
    _local(MOC_PDF, MOC_PDF_SHA256)
    ws = openpyxl.load_workbook(MOC_XLSX, read_only=True, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    if rows[0][:3] != ("年度", "電影院家數(家)", "電影院廳數(廳)"):
        raise RuntimeError(f"文化部電影院概況的表頭改了：{rows[0]}")
    out = {int(r[0]): (int(r[1]), int(r[2])) for r in rows[1:] if r and r[0]}
    pdf = {}
    for line in PdfReader(MOC_PDF).pages[0].extract_text().splitlines():
        m = re.fullmatch(r"\s*(20\d\d) (\d+) (\d+)\s*", line)
        if m:
            pdf[int(m.group(1))] = (int(m.group(2)), int(m.group(3)))
    diff = {y: (out[y], v) for y, v in pdf.items() if y in out and out[y] != v}
    if diff or max(pdf) <= max(out):
        raise RuntimeError(f"文化部電影映演業統計 PDF 跟 Excel 對不上或沒有新的年份：{diff}，PDF 到 {max(pdf)}")
    out.update({y: v for y, v in pdf.items() if y not in out})
    if sorted(out) != list(range(2008, max(out) + 1)):
        raise RuntimeError(f"文化部電影院的年份有缺：{sorted(out)}")
    return out


def build() -> None:
    cinemas = _uis("220174")
    taiwan = _taiwan_cinemas()
    cinemas["TWN"] = {y: float(n) for y, (n, _) in taiwan.items()}
    years = sorted({y for s in cinemas.values() for y in s})
    pop = wpp.demographic(["TPopulation1July"], last_year=max(years))["TPopulation1July"]
    per100k = {c: {y: v / pop[c][y] * 100 for y, v in s.items() if pop.get(c, {}).get(y)} for c, s in cinemas.items()}
    last = max(taiwan)
    tw_hint = (f"文化部統計：{last} 年 {taiwan[last][0]} 家、{taiwan[last][1]} 廳（{last} 年是暫時性的數字）；"
               "2016 年 7 月起算實際營業的家數，2015 年以前是許可證家數")
    tw_hint_en = (f"Ministry of Culture: {taiwan[last][0]} cinemas with {taiwan[last][1]} screens in {last} (provisional); "
                  "operating cinemas from July 2016, licensed cinemas before")
    for key, unit, series, digits in (("cinemas", "家", cinemas, 0), ("cinemas-per-100k", "家／十萬人", per100k, 2)):
        write_json(OUT / f"{key}.json", indicator_file(
            key, unit, years, {c: to_series(s, years, digits) for c, s in sorted(series.items()) if s},
            latestWithin=10, hints={"TWN": tw_hint}, hintsEn={"TWN": tw_hint_en},
            license="CC BY-SA 4.0"))
    print(f"  電影院：台灣 { {y: taiwan[y] for y in (2008, 2015, 2016, 2024, last)} }，每十萬人 {round(per100k['TWN'][last], 2)}（{last}）")
    jobs = _uis("CE.RA.CULOCC1.1.OV.ILOSTAT.1")
    jy = sorted({y for s in jobs.values() for y in s})
    no_tw = {"TWN": "台灣不在 UNESCO 的資料裡"}
    no_tw_en = {"TWN": "Taiwan is not in the UNESCO data"}
    write_json(OUT / "culture-jobs.json", indicator_file("culture-jobs", "%", jy, {c: to_series(s, jy, 2) for c, s in sorted(jobs.items())},
                                                         latestWithin=7, noValue=no_tw, noValueEn=no_tw_en, license="CC BY-SA 4.0"))
    heritage = _uis("HEXPCSTPPPCAP.HER.PU")
    hy = sorted({y for s in heritage.values() for y in s})
    write_json(OUT / "heritage-spending.json", indicator_file(
        "heritage-spending", "購買力平價美元／人", hy, {c: to_series(s, hy, 2) for c, s in sorted(heritage.items())},
        latestWithin=8, noValue=no_tw, noValueEn=no_tw_en, license="CC BY-SA 4.0"))
    _books()
    write_json(OUT / "manifest.json", {"topic": "culture", "source": "UNESCO Institute for Statistics (CC BY-SA 4.0); WIPO (CC BY 4.0); 國家圖書館 ISBN 中心"})
    def last(d):
        return sorted(((round(s[max(s)], 2), c, max(s)) for c, s in d.items() if s), reverse=True)
    print(f"  電影院：{len(cinemas)} 國，{years[0]}–{years[-1]}；每十萬人 {last(per100k)[:8]}…{last(per100k)[-4:]}")
    print(f"  家數 {last(cinemas)[:6]}；美國 {cinemas.get('USA', {}).get(max(cinemas.get('USA', {0: 0})))}")
    print(f"  文化工作者：{len(jobs)} 國，{jy[0]}–{jy[-1]}；{last(jobs)[:6]}…{last(jobs)[-4:]}")
    print(f"  遺產支出：{len(heritage)} 國，{hy[0]}–{hy[-1]}；{last(heritage)[:6]}…{last(heritage)[-4:]}")


def _wipo_deposits() -> dict[str, tuple[int, int | None, int | None]]:
    """WIPO 表 3：ISO3 → (總數, 紙本, 數位)；「..」（沒有回報，含只收紙本的 (a)）是 None"""
    from pypdf import PdfReader

    path = download(WIPO_PDF, "wipo", "publishing-2022.pdf")
    out: dict[str, tuple[int, int | None, int | None]] = {}
    started = False
    for page in PdfReader(path).pages:
        text = page.extract_text(extraction_mode="layout")
        if "Number of books deposited at recognized repositories" in text:
            started = True
        elif not started:
            continue
        for line in text.splitlines():
            m = ROW.match(line)
            if not m:
                continue
            name = re.sub(r"\s*\([a-d](, [a-d])*\)$", "", m.group(1)).strip()
            iso3 = from_name(name)
            if not iso3:
                raise ValueError(f"WIPO 表 3 的國名對不到：{name}")
            total, pr, dig = (None if v == ".." else int(v.replace(",", "")) for v in m.group(2, 3, 4))
            out[iso3] = (total, pr, dig)
        if started and "Source: WIPO Statistics Database" in text:
            break
    if len(out) != 82 or out["DEU"][0] != 401197 or out["USA"][2] != 242828:
        raise ValueError(f"WIPO 表 3 抽到 {len(out)} 列（應該 82），德國 {out.get('DEU')}、美國 {out.get('USA')}")
    return out


def _taiwan_isbn() -> dict[int, tuple[int, int]]:
    """年 → (紙本圖書, 電子書) 的 ISBN 筆數"""
    out = {}
    for y in ISBN_YEARS:
        printed = digital = 0
        for m in range(1, 13):
            name = f"{y}{m:02d}_isbn.csv"
            if not (CACHE_DIR / "isbn" / name).exists():
                time.sleep(3)
            path = download(ISBN_CSV.format(y, m), "isbn", name)
            with open(path, encoding="utf-8-sig", newline="") as f:
                for r in csv.DictReader(f):
                    kind = r["資料類型"]
                    if kind in ISBN_PRINT:
                        printed += 1
                    elif kind.startswith(ISBN_DIGITAL):
                        digital += 1
        out[y] = (printed, digital)
    return out


def _books() -> None:
    """372：一年送存幾本書（每百萬人、件數、數位占比）"""
    wipo = _wipo_deposits()
    tw = _taiwan_isbn()
    years = [WIPO_YEAR, *ISBN_YEARS]
    pop = wpp.demographic(["TPopulation1July"], last_year=max(years))["TPopulation1July"]
    total = {c: {WIPO_YEAR: v[0]} for c, v in wipo.items()}
    total["TWN"] = {y: p + d for y, (p, d) in tw.items()}
    per_m = {c: {y: v / pop[c][y] * 1000 for y, v in s.items()} for c, s in total.items() if c in pop}  # 人口是千人
    digital = {c: {WIPO_YEAR: v[2] / v[0] * 100} for c, v in wipo.items() if v[2] is not None and v[0]}
    digital["TWN"] = {y: d / (p + d) * 100 for y, (p, d) in tw.items()}
    hints = {c: f"紙本 {v[1]:,}、數位 {v[2]:,} 件" if v[2] is not None else f"紙本 {v[1]:,} 件，數位沒有回報"
             for c, v in wipo.items() if v[1] is not None}
    hints_en = {c: f"Print {v[1]:,}, digital {v[2]:,}" if v[2] is not None else f"Print {v[1]:,}; digital not reported"
                for c, v in wipo.items() if v[1] is not None}
    p25, d25 = tw[ISBN_YEARS[-1]]
    hints["TWN"] = (f"台灣是國家圖書館 ISBN 中心一年登記的新書 ISBN 數（{ISBN_YEARS[-1]} 年紙本 {p25:,}、電子書 {d25:,}），"
                    "不是送存件數；電子書的 PDF、EPUB 各有一個 ISBN")
    hints_en["TWN"] = (f"For Taiwan: new-book ISBNs registered with the National Central Library ({ISBN_YEARS[-1]}: print {p25:,}, "
                       f"e-books {d25:,}), not deposits; PDF and EPUB editions each have their own ISBN")
    no_digital = {c: "這個國家的送存機構只收紙本，或沒有回報數位的件數" for c, v in wipo.items() if v[2] is None}
    no_digital_en = {c: "The deposit library collects print only or did not report digital deposits" for c in no_digital}
    common_kw = dict(latestWithin=3, hints=hints, hintsEn=hints_en, license="CC BY 4.0")
    write_json(OUT / "books-per-million.json", indicator_file(
        "books-per-million", "件／百萬人", years, {c: to_series(s, years, 0) for c, s in sorted(per_m.items())}, **common_kw))
    write_json(OUT / "books-deposited.json", indicator_file(
        "books-deposited", "件", years, {c: to_series(s, years, 0) for c, s in sorted(total.items())}, **common_kw))
    write_json(OUT / "books-digital-share.json", indicator_file(
        "books-digital-share", "%", years, {c: to_series(s, years, 1) for c, s in sorted(digital.items())},
        noValue=no_digital, noValueEn=no_digital_en, **common_kw))
    top = sorted(((round(s[WIPO_YEAR]), c) for c, s in per_m.items() if WIPO_YEAR in s), reverse=True)
    print(f"  書（WIPO 表 3）：{len(wipo)} 國；每百萬人 {top[:8]}…{top[-4:]}")
    print(f"  台灣 ISBN：{tw}；每百萬人 {[round(v) for v in per_m['TWN'].values()]}；數位占比 "
          f"{sorted(((round(s[WIPO_YEAR]), c) for c, s in digital.items() if WIPO_YEAR in s), reverse=True)[:6]}")
