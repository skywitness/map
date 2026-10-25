"""澳洲統計局（ABS）《Prisoners in Australia, 2025》：澳洲的在監人數，只用在治安與司法主題的監禁人口率。

- 資料表 1（Tables 1–14）的 Table 2「Prisoners, Selected characteristics, 2016–2025」的「Total」：
  每年 6 月 30 日成人矯正機構（各州與領地的監獄）裡的人，含已判決與未判決（羈押候審），2016–2025 年。
- 不含少年拘留機構、移民拘留中心、警察局的拘留室。ABS 公布的監禁率是每 10 萬名成年人（18 歲以上），
  這裡改用 WPP 的總人口當分母，所以比 ABS 的數字低（2025 年 ABS 216.4）。
- 2017 年以前含定期拘禁（periodic detention）。

授權：ABS 網站與資料是 CC BY 4.0（© Commonwealth of Australia）。
"""
from __future__ import annotations

import openpyxl

from common import download

URL = (
    "https://www.abs.gov.au/statistics/people/crime-and-justice/prisoners-australia/2025/"
    "1.%20Prisoner%20characteristics%2C%20Australia%20%28Tables%201%E2%80%9314%29.xlsx"
)
PAGE = "https://www.abs.gov.au/statistics/people/crime-and-justice/prisoners-australia/2025"


def prisoners() -> dict[int, float]:
    """{年: 6 月 30 日的在監人數}"""
    path = download(URL, "abs", "prisoners-australia-2025-tables-1-14.xlsx")
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = [[c for c in row] for row in wb["Table 2"].iter_rows(values_only=True)]
    # 表頭有一列的最後兩欄是「no.」「Imprisonment rate (e)」，總數是「no.」那一欄
    head = next(i for i, r in enumerate(rows) if any(str(c).strip() == "no." for c in r if c is not None))
    col = next(j for j, c in enumerate(rows[head]) if c is not None and str(c).strip() == "no.")
    if not any(c is not None and str(c).startswith("Total") for c in rows[head - 1]):
        raise RuntimeError("ABS Table 2 的表頭變了")
    out: dict[int, float] = {}
    for r in rows[head + 1:]:
        label = str(r[0]).strip() if r[0] is not None else ""
        if label.startswith("%"):
            break  # 後面是「% change」的區塊
        if label.isdigit() and r[col] is not None:
            out[int(label)] = float(r[col])
    if not out:
        raise RuntimeError("ABS Table 2 沒有讀到任何一年")
    return out
