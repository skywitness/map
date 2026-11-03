"""國健署「新生兒先天性代謝異常疾病篩檢歷年成果表」（2026-11-03，製作手冊第十九批 288、289 的台灣數字）。

**檔案**：https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=4083&pid=401 的附件（ODS，更新至 113 年）。hpa.gov.tw 的
robots.txt 禁止程式抓附件（`Disallow: /Pages/ashx/GetFile.ashx`），使用者 2026-11-03 用瀏覽器下載，本機 session 放在
skywitness/map-plan 的 `data/hpa/newborn-screening-1984-2024.ods`（README 寫了版面與檢查）；重跑前複製到
pipeline/.cache/hpa/。**pipeline 不從 hpa.gov.tw 下載。**
**授權**：國健署網站的政府網站資料開放宣告：網站刊載的資料採政府資料開放授權條款第 1 版，要註明出處。
**版面**（工作表「3家篩檢中心成果」）：第 1 列標題、第 2–3 列兩層表頭（第 3 列是 21 種疾病）、第 4–44 列是民國 73–113 年、
第 45 列總計。欄：A 年、B 年出生數、C 篩檢人數、D 篩檢率、E–Y 21 種疾病的異常個案數、Z 總異常個案數。
- 94 年 J–O、107 年 P–Y 是合併的文字格（「95年7月1日起全面篩檢」「108年10月1日起全面篩檢」），不是數字。
- 還沒開始篩的年份是空格。
- 篩檢率用 C ÷ B 重算（D 欄有幾年是手打的、113 年沒有乘 100）；103 年的出生數是用篩檢人數 ÷ 99.8% 倒推的（表上的公式）。
- G6PD 缺乏症 73–75 年是 0、76 年才有 413 例，表上沒有說明，從 76 年（1987）開始用。
"""
from __future__ import annotations

import zipfile
import xml.etree.ElementTree as ET

from common import CACHE_DIR

ODS = CACHE_DIR / "hpa" / "newborn-screening-1984-2024.ods"
SHA256 = "01b9ce3881dcb3aa89c0c7a8f786536acf4ed4c318c6f99fc07acaf3f4586dcc"
NS = {
    "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
}
# 21 種疾病（E–Y 欄的順序）：表上的名稱、論文 30 種的代碼（newborn_screening.DISEASES；對不到的寫 None）、英文
DISEASES: list[tuple[str, str | None, str]] = [
    ("葡萄糖-六-磷酸鹽去氫酶缺乏症", "G6PD", "G6PD deficiency"),
    ("先天性甲狀腺低能症", "CH", "Congenital hypothyroidism"),
    ("苯酮尿症", "PKU", "Phenylketonuria"),
    ("高胱胺酸尿症", "HCY", "Homocystinuria"),
    ("半乳糖血症", "GAL", "Galactosaemia"),
    ("先天性腎上腺增生症", "CAH", "Congenital adrenal hyperplasia"),
    ("楓糖漿尿症", "MSUD", "Maple syrup urine disease"),
    ("中鏈醯輔酶Α去氫酶缺乏症", "MCAD", "MCAD deficiency"),
    ("戊二酸血症第一型", "GA-I", "Glutaric acidaemia type I"),
    ("異戊酸血症", "IVA", "Isovaleric acidaemia"),
    ("甲基丙二酸血症", "MMA", "Methylmalonic acidaemia"),
    ("瓜胺酸血症第I型", "CIT", "Citrullinaemia type I"),
    ("瓜胺酸血症第II型", "CIT", "Citrullinaemia type II"),
    ("三羥基三甲基戊二酸尿症", "HMG", "HMG-CoA lyase deficiency"),
    ("全羧化酶合成酶缺乏", "MCD", "Holocarboxylase synthetase deficiency"),
    ("丙酸血症", "PA", "Propionic acidaemia"),
    ("原發性肉鹼缺乏症", "CUD", "Carnitine uptake defect"),
    ("肉鹼棕櫚醯基轉移酶缺乏症第I型", "CPT", "CPT I deficiency"),
    ("肉鹼棕櫚醯基轉移酶缺乏症第II型", "CPT", "CPT II deficiency"),
    ("極長鏈醯輔酶A去氫酶缺乏症", "VLCAD", "VLCAD deficiency"),
    ("早發型戊二酸血症第II型", None, "Glutaric acidaemia type II (early onset)"),
]
G6PD_FROM = 1987  # 73–75 年是 0，表上沒有說明


def _cell_value(cell: ET.Element) -> float | str | None:
    kind = cell.get(f"{{{NS['office']}}}value-type")
    if kind in ("float", "percentage"):
        return float(cell.get(f"{{{NS['office']}}}value"))
    text = "".join("".join(p.itertext()) for p in cell.findall("text:p", NS)).strip()
    return text or None


def _rows() -> list[list[float | str | None]]:
    if not ODS.exists():
        raise RuntimeError(f"沒有 {ODS}：請把 map-plan 的 data/hpa/newborn-screening-1984-2024.ods 複製到這裡")
    import hashlib
    if hashlib.sha256(ODS.read_bytes()).hexdigest() != SHA256:
        raise RuntimeError(f"{ODS} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改 SHA256")
    with zipfile.ZipFile(ODS) as z:
        root = ET.fromstring(z.read("content.xml"))
    sheet = root.find(".//table:table", NS)
    rows: list[list[float | str | None]] = []
    for tr in sheet.iter(f"{{{NS['table']}}}table-row"):
        row: list[float | str | None] = []
        for cell in tr:
            if cell.tag not in (f"{{{NS['table']}}}table-cell", f"{{{NS['table']}}}covered-table-cell"):
                continue
            repeat = int(cell.get(f"{{{NS['table']}}}number-columns-repeated", "1"))
            row.extend([_cell_value(cell)] * min(repeat, 40))
        for _ in range(min(int(tr.get(f"{{{NS['table']}}}number-rows-repeated", "1")), 2)):
            rows.append(row)
    return rows


def results() -> dict:
    """{years: [西元年…], births, screened: [人], rate: [%], cases: {疾病序號: [例 或 None]}, total: [例], diseases}"""
    rows = _rows()
    head = [str(c or "") for c in rows[2]]
    names = head[4:25]
    if [n.replace(" ", "") for n in names] != [d[0] for d in DISEASES]:
        raise RuntimeError(f"成果表第 3 列的疾病名稱跟預期不同：{names}")
    data = [r for r in rows[3:44]]
    years = [int(r[0]) + 1911 for r in data]
    if years != list(range(1984, 2025)):
        raise RuntimeError(f"成果表的年份不是民國 73–113 年：{years[0]}–{years[-1]}")
    out = {"years": years, "births": [], "screened": [], "rate": [], "cases": {i: [] for i in range(21)}, "total": []}
    for r, y in zip(data, years):
        births, screened = float(r[1]), float(r[2])
        out["births"].append(births)
        out["screened"].append(screened)
        out["rate"].append(screened / births * 100)
        values = []
        for i in range(21):
            v = r[4 + i]
            v = v if isinstance(v, float) else None  # 空格（還沒開始篩）與兩格合併的文字註記
            if i == 0 and y < G6PD_FROM:
                v = None
            out["cases"][i].append(v)
            values.append(v or 0)
        total = float(r[25])
        if abs(sum(values) - total) > 0.5 and y >= G6PD_FROM:
            raise RuntimeError(f"{y} 年的總異常個案數 {total} 不等於各疾病加總 {sum(values)}")
        out["total"].append(total)
    out["diseases"] = DISEASES
    return out
