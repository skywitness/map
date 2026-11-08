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

import re
import subprocess
import time

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
}


def _pdf_text(url: str, name: str) -> str:
    path = download(url, "who-tcm", f"{name}.pdf")
    txt = path.with_suffix(".txt")
    if not txt.exists() or txt.stat().st_mtime < path.stat().st_mtime:
        subprocess.run(["pdftotext", "-layout", str(path), str(txt)], check=True)
    return txt.read_text(encoding="utf-8")


def report_2019() -> str:
    return _pdf_text(REPORT_2019, "report-2019")


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
