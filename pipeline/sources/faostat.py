"""FAOSTAT 批次下載檔（https://bulks-faostat.fao.org/production/），直接從 zip 串流讀取。

貿易檔解壓後約 2.4 GB，所以不解壓、不整個讀進記憶體。
- 國家：用 M49 欄位對應 ISO（M49 的國家代碼與 ISO 數字代碼相同）。
- 排除：區域合計（Area Code ≥ 5000、M49 含「.」）與「China」(351)，
  後者是大陸＋港＋澳＋台的合計，留著會重複計算。台灣是 M49 158。
- World（5000）回傳成 'WLD'。

詳細貿易矩陣（TM，雙邊貿易）解壓後約 8.5 GB、約 4,700 萬列，用 matrix_rows() 讀。
糧食安全指標（FS）的年份是「2000-2002」這種三年區間、數值可能是「<2.5」，用 suite_rows() 讀原始字串。
"""
from __future__ import annotations

import csv
import io
import zipfile
from collections.abc import Iterator
from typing import NamedTuple

from common import download
from sources.countries import from_numeric

BASE = "https://bulks-faostat.fao.org/production/"
DATASETS = {
    "QCL": "Production_Crops_Livestock_E_All_Data_(Normalized).zip",
    "TCL": "Trade_CropsLivestock_E_All_Data_(Normalized).zip",
    "QV": "Value_of_Production_E_All_Data_(Normalized).zip",
    "TM": "Trade_DetailedTradeMatrix_E_All_Data_(Normalized).zip",
    "FBS": "FoodBalanceSheets_E_All_Data_(Normalized).zip",  # 糧食平衡表，2010 年起的新方法
    "FBSH": "FoodBalanceSheetsHistoric_E_All_Data_(Normalized).zip",  # 舊方法，1961–2013
    "FS": "Food_Security_Data_E_All_Data_(Normalized).zip",  # 糧食安全指標（營養不足盛行率等）
}
# 舊版糧食平衡表的 CSV 不是 UTF-8（Côte d'Ivoire 的 ô 是單一位元組 0xF4）
ENCODINGS = {"FBSH": "latin-1"}
WORLD_AREA = 5000
CHINA_AGGREGATE = 351


class Row(NamedTuple):
    area: str  # ISO alpha-3 或 'WLD'
    item: int
    item_name: str
    element: int
    year: int
    value: float


def _area(area_code: str, m49: str, cache: dict[str, str | None]) -> str | None:
    """FAOSTAT 的地區 → ISO alpha-3；World 是 'WLD'，區域合計、「China」(351)、已解體的國家是 None。"""
    code = int(area_code)
    if code == WORLD_AREA:
        return "WLD"
    if code > WORLD_AREA or code == CHINA_AGGREGATE:
        return None
    if m49 not in cache:
        cache[m49] = None if "." in m49 else from_numeric(m49)
    return cache[m49]


def _csv(dataset: str) -> Iterator[list[str]]:
    """批次下載檔的主資料表，逐列回傳（第一列是欄名）。"""
    path = download(BASE + DATASETS[dataset], "faostat", DATASETS[dataset])
    with zipfile.ZipFile(path) as z:
        member = next(n for n in z.namelist() if n.endswith("(Normalized).csv"))
        with z.open(member) as raw:
            yield from csv.reader(io.TextIOWrapper(raw, encoding=ENCODINGS.get(dataset, "utf-8"), newline=""))


def rows(dataset: str, elements: set[int], items: set[int] | None = None) -> Iterator[Row]:
    """逐列讀取，只回傳指定的 element（與 item），值為空的列略過。"""
    m49_cache: dict[str, str | None] = {}
    reader = _csv(dataset)
    col = {name: i for i, name in enumerate(next(reader))}
    i_area, i_m49 = col["Area Code"], col["Area Code (M49)"]
    i_item, i_name, i_elem = col["Item Code"], col["Item"], col["Element Code"]
    i_year, i_value = col["Year"], col["Value"]
    for r in reader:
        element = int(r[i_elem])
        if element not in elements or not r[i_value]:
            continue
        item = int(r[i_item])
        if items is not None and item not in items:
            continue
        area = _area(r[i_area], r[i_m49], m49_cache)
        if area is None:
            continue  # 區域合計或已解體的國家（蘇聯、南斯拉夫等）
        yield Row(area, item, r[i_name], element, int(r[i_year]), float(r[i_value]))


class SuiteRow(NamedTuple):
    area: str  # ISO alpha-3 或 'WLD'
    item: str  # 糧食安全指標的品項代碼有字母（例如 210070F），所以是字串
    year: str  # 單一年份「2023」或三年區間「2021-2023」
    value: str  # 原始字串，可能是「<2.5」


def suite_rows(dataset: str, items: set[str]) -> Iterator[SuiteRow]:
    """糧食安全這類指標資料集：只回傳指定品項，年份與數值保留原始字串，值為空的列略過。"""
    m49_cache: dict[str, str | None] = {}
    reader = _csv(dataset)
    col = {name: i for i, name in enumerate(next(reader))}
    i_area, i_m49, i_item = col["Area Code"], col["Area Code (M49)"], col["Item Code"]
    i_year, i_value = col["Year"], col["Value"]
    for r in reader:
        if r[i_item] not in items or not r[i_value]:
            continue
        area = _area(r[i_area], r[i_m49], m49_cache)
        if area is not None:
            yield SuiteRow(area, r[i_item], r[i_year], r[i_value])


class MatrixRow(NamedTuple):
    reporter: str  # ISO alpha-3
    partner: str | None  # 對應不到國家的夥伴（已解體的國家等）為 None，只計入總額
    item: int
    element: int
    year: int
    value: float


def matrix_items() -> dict[int, tuple[str, str]]:
    """詳細貿易矩陣的品項：{品項代碼: (CPC 代碼, 英文名稱)}。"""
    path = download(BASE + DATASETS["TM"], "faostat", DATASETS["TM"])
    with zipfile.ZipFile(path) as z:
        member = next(n for n in z.namelist() if n.endswith("_ItemCodes.csv"))
        with z.open(member) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8", newline=""))
            next(reader)
            return {int(code): (cpc.lstrip("'"), name) for code, cpc, name in reader}


def matrix_rows(elements: set[int], since: int = 0) -> Iterator[MatrixRow]:
    """詳細貿易矩陣逐列讀取，只回傳指定的 element、since 年以後的列。

    每個欄位都有引號，直接用 '","' 切開，比 csv 模組快好幾倍（品名裡的逗號在引號內，不受影響）。
    夥伴是區域合計（World、各洲，代碼 ≥ 5000）或「China」(351) 的列略過，否則會重複計算。
    """
    path = download(BASE + DATASETS["TM"], "faostat", DATASETS["TM"])
    wanted = {str(e).encode() for e in elements}
    # 先用字串比對篩掉其他 element 的列（約一半），省下切欄位的時間；只有 Element Code 欄會是這種完整的引號值
    tokens = [b'"' + e + b'"' for e in wanted]
    m49_cache: dict[bytes, str | None] = {}

    def iso(code: bytes, m49: bytes) -> str | None:
        if m49 not in m49_cache:
            numeric = int(code)
            m49_cache[m49] = None if numeric >= WORLD_AREA or numeric == CHINA_AGGREGATE else from_numeric(m49.decode())
        return m49_cache[m49]

    with zipfile.ZipFile(path) as z:
        member = next(n for n in z.namelist() if n.endswith("(Normalized).csv"))
        with z.open(member) as raw:
            header = next(raw).decode("utf-8").rstrip("\r\n").split(",")
            assert header[:7] == [
                "Reporter Country Code", "Reporter Country Code (M49)", "Reporter Countries",
                "Partner Country Code", "Partner Country Code (M49)", "Partner Countries", "Item Code",
            ], header
            assert header[9] == "Element Code" and header[12] == "Year" and header[14] == "Value", header
            for line in raw:
                if not any(t in line for t in tokens):
                    continue
                f = line[1:].rstrip(b"\r\n")[:-1].split(b'","')
                if f[9] not in wanted or not f[14] or int(f[12]) < since:
                    continue
                partner_code = int(f[3])
                if partner_code >= WORLD_AREA or partner_code == CHINA_AGGREGATE:
                    continue
                reporter = iso(f[0], f[1])
                if reporter is None:
                    continue
                yield MatrixRow(reporter, iso(f[3], f[4]), int(f[6]), int(f[9]), int(f[12]), float(f[14]))
