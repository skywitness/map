"""Human Fertility Database（HFD，Max Planck Institute for Demographic Research 與 Vienna Institute of Demography），
HFD Lite 的 PARITY.xlsx（CC BY 4.0，不必登入）。

- 工作表「Cohort childlessness」：同一年出生的女性到生育年齡結束時（約 45–50 歲）一直沒有生小孩的比例（%）。
  第 2 列是國名、第 3 列是 HFD 的國家代碼，之後每列是一個出生世代（1935–1981 年生），第一欄是出生年。
- 沒有資料寫 0（不是 0%），當缺值。德國、法國、義大利、韓國、比利時、智利、瑞士、英國的欄全部是 0。
- HFD 自己註明「indicators of cohort parity distribution should be used with caution」。
- 代碼大多是 ISO alpha-3；GBR_NP、DEUTNP、FRATNP 等是全國人口，GBRTENW、DEUTE 等是一部分，不收。
- 引用格式：Human Fertility Database. Max Planck Institute for Demographic Research (Germany) and Vienna Institute of
  Demography (Austria). Available at www.humanfertility.org (data downloaded on [date]).
"""
from __future__ import annotations

import openpyxl

from common import download

URL = "https://www.humanfertility.org/File/GetDocumentFree/Docs/HFDLite/PARITY.xlsx"
SHEET = "Cohort childlessness"
NATIONAL = {"GBR_NP": "GBR", "DEUTNP": "DEU", "FRATNP": "FRA"}


def cohort_childlessness() -> dict[str, dict[int, float]]:
    """{iso3: {出生年: 終身沒有小孩的比例（%）}}"""
    wb = openpyxl.load_workbook(download(URL, "hfd", "PARITY.xlsx"), read_only=True, data_only=True)
    sheet = wb[SHEET]
    sheet.reset_dimensions()  # 檔案記錄的範圍不對，不重設會只讀到第一格
    rows = list(sheet.iter_rows(values_only=True))
    codes = next((r for r in rows if r and r[0] == "COHORT"), None)
    if not codes or "TWN" not in codes:
        raise RuntimeError(f"HFD {SHEET} 的格式變了")
    out: dict[str, dict[int, float]] = {}
    for row in rows:
        if not row or not isinstance(row[0], int):
            continue
        for col, code in enumerate(codes[1:], 1):
            value = row[col] if col < len(row) else None
            code = NATIONAL.get(code, code)
            if isinstance(value, (int, float)) and value > 0 and isinstance(code, str) and len(code) == 3:
                out.setdefault(code, {})[row[0]] = float(value)
    return out
