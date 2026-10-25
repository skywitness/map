"""美國司法統計局（Bureau of Justice Statistics）《Correctional Populations in the United States》的統計表：
美國的在監人數（州立與聯邦監獄＋地方看守所），只用在治安與司法主題的監禁人口率。

- 每一版的 zip 裡有 CSV，表 1（`cpus23stt01.csv` 等）是成年矯正系統的各類人數，
  「Incarcerated」的 Total 是監獄（prison，12 月 31 日）加上地方看守所（local jail，6 月最後一個平日），
  扣掉關在看守所的州、聯邦受刑人（重複計算）。看守所關的多半是還沒判決的被告，所以這個總數含審前羈押。
- 不含少年矯正機構、移民拘留（ICE）、軍方監獄、印第安保留區的看守所與海外屬地的監獄。
- 2023 年版有 2013–2023 年、2022 年版有 2012–2022 年、2016 年版有 2006–2016 年（欄位順序不同：看守所在監獄前面），
  同一年有好幾版時用新的（舊年份會修正）。各版的欄位順序都是：矯正人口總數、社區監督合計、緩刑、假釋、在監合計…，
  所以在監合計是每一列第 5 個數字。

授權：BJS 是美國聯邦政府機關，出版品與資料是聯邦政府的職務作品，公有領域（17 U.S.C. § 105）。
"""
from __future__ import annotations

import csv
import io
import re
import zipfile

from common import download

# (網址, 快取檔名, 表 1 的檔名)；新的版本放前面
EDITIONS = [
    ("https://bjs.ojp.gov/document/cpus23st.zip", "cpus23st.zip", "cpus23stt01.csv"),
    ("https://bjs.ojp.gov/document/cpus22st.zip", "cpus22st.zip", "cpus22stt01.csv"),
    ("https://bjs.ojp.gov/content/pub/sheets/cpus16.zip", "cpus16.zip", "cpus16t01.csv"),
]
URL_PAGE = "https://bjs.ojp.gov/library/publications/correctional-populations-united-states-2023-statistical-tables"


def _numbers(cells: list[str]) -> list[float]:
    out = []
    for c in cells:
        c = c.strip().replace(",", "")
        if re.fullmatch(r"\d+(\.\d+)?", c):
            out.append(float(c))
    return out


def incarcerated() -> dict[int, float]:
    """{年: 在監人數（監獄＋地方看守所，扣掉重複）}"""
    out: dict[int, float] = {}
    for url, filename, table in EDITIONS:
        path = download(url, "bjs", filename)
        with zipfile.ZipFile(path) as z:
            name = next((n for n in z.namelist() if n.endswith("/" + table) or n == table), None)
            if not name:
                raise RuntimeError(f"{filename} 裡找不到 {table}：{z.namelist()}")
            text = z.read(name).decode("cp1252", errors="replace")
        rows = list(csv.reader(io.StringIO(text)))
        header = next((r for r in rows if r and r[0].strip() == "Year"), None)
        if not header or not any("Incarcerated" in " ".join(r) for r in rows[:15]):
            raise RuntimeError(f"{table} 的表頭變了")
        found = 0
        for row in rows:
            # 年份可能帶註記：「2022/h」「2023*」；2016 年版的 2016 年分成 1 月 1 日、12 月 31 日兩列，不收
            m = re.fullmatch(r"(\d{4})(/[a-z])?\*?", row[0].strip()) if row else None
            if not m:
                continue
            nums = _numbers(row[1:])
            if len(nums) < 7:
                continue
            year = int(m.group(1))
            found += 1
            out.setdefault(year, nums[4])  # 新的版本先讀，同一年不覆寫
        if not found:
            raise RuntimeError(f"{table} 沒有讀到任何一年")
    return out
