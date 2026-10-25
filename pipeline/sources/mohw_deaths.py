"""衛生福利部死因統計資料集（政府資料開放授權條款）：「國際疾病分類標準之詳細分類」。

https://dep.mohw.gov.tw/DOS/np-6602-113.html 的 zip，裡面的 xlsx 有每年、男女、每個 ICD-10 碼
（3 或 4 碼，不含小數點，例如 A09、C349）、24 個年齡組的死亡數。2008 年起是 ICD-10，2007 年以前是
ICD-9（另一張工作表，這裡不用）。新年度的資料會換下載網址，到上面的頁面找「死因統計(國際疾病分類標準之詳細分類).zip」。

為了跟 WHO Global Health Estimates（GHE）比較，把 ICD-10 碼歸到 GHE 的死因分類
（WHO 的 GHE 方法說明附表的 ICD-10 對照）。GHE 會把「症狀、徵候與不明原因」（R 碼）等無法歸類的死亡
依比例分配到各類，這裡把它們排除在分母之外，效果相同。
"""
from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass

import openpyxl

from common import download

URL = "https://www.mohw.gov.tw/dl-83421-2c205514-b970-45c5-9f0c-295569c9c6d5.html"
SHEET = "2008以後"

# xlsx 的年齡欄位（從第 5 欄開始），對應 WPP 的五歲年齡組；未滿 1 歲與 1–4 歲合併成 0-4
AGE_COLUMNS = [
    "0-4", "0-4", "0-4", "0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44",
    "45-49", "50-54", "55-59", "60-64", "65-69", "70-74", "75-79", "80-84", "85-89", "90-94", "95-99", "100+",
]

# GHE 的第二層死因代碼與 ICD-10 範圍，由上往下第一個符合的就是它的分類（例外寫在前面）
GHE_ICD10 = [
    (1260, "E10.2 E11.2 E12.2 E13.2 E14.2"),  # 糖尿病引起的慢性腎病，GHE 算在腎臟病
    (820, "G72.1 Q86.0 X41 X42 X44 X45"),  # 酒精與藥物使用（含意外中毒）
    (20, "A00-B99 G00-G04 G14 N70-N73 P37.3 P37.4"),  # 感染與寄生蟲疾病
    (380, "H65-H66 J00-J22 P23 U04 U07"),  # 呼吸道感染（含 COVID-19）
    (420, "O00-O99"),  # 孕產期
    (490, "P00-P96"),  # 新生兒
    (540, "D50-D53 D64.9 E00-E02 E40-E64"),  # 營養缺乏
    (610, "C00-C97"),  # 惡性腫瘤
    (790, "D00-D48"),  # 其他腫瘤
    (800, "E10-E14"),  # 糖尿病
    (810, "D55-D89 E03-E07 E15-E34 E65-E88"),  # 內分泌、血液、免疫
    (940, "F01-F03 G06-G98"),  # 神經系統（含失智症）
    (820, "F04-F99"),  # 精神疾病
    (1020, "H00-H61 H68-H93"),  # 感覺器官
    (1100, "I00-I99"),  # 心血管
    (1170, "J30-J98"),  # 慢性呼吸道
    (1470, "K00-K14"),  # 口腔
    (1210, "K20-K92"),  # 消化系統
    (1260, "N00-N64 N75-N98"),  # 泌尿生殖
    (1330, "L00-L98"),  # 皮膚
    (1340, "M00-M99"),  # 肌肉骨骼
    (1400, "Q00-Q99"),  # 先天異常
    (1505, "R95"),  # 嬰兒猝死症候群
    (1600, "X60-Y09 Y35-Y36 Y87.0 Y87.1"),  # 蓄意傷害（自殺、他殺、戰爭）
    (1520, "V01-X59 Y40-Y86 Y88 Y89"),  # 事故傷害
    (1500, "Y10-Y34 Y87.2"),  # 意圖不明的傷害：只算進傷害大類
]
# 第二層 → 第一大類（GHE 的 10 傳染病等、600 非傳染病、1510 傷害）
LEVEL1 = {20: 10, 380: 10, 420: 10, 490: 10, 540: 10, 1520: 1510, 1600: 1510, 1500: 1510}
NONCOMMUNICABLE = 600

# WHO 的 SDG 3.4.1：30–70 歲死於心血管疾病、癌症、糖尿病、慢性呼吸道疾病的機率
FOUR_NCDS = "I00-I99 C00-C97 E10-E14 J30-J98"
AGES_30_69 = ["30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65-69"]


def _key(code: str) -> tuple[str, float]:
    """'C349' 或 'C34.9' → ('C', 34.9)；三碼的 'A09' → ('A', 9.0)"""
    code = code.replace(".", "")
    return code[0], int(code[1:3]) + (int(code[3]) / 10 if len(code) > 3 and code[3].isdigit() else 0)


def _ranges(spec: str) -> list[tuple[tuple[str, float], tuple[str, float]]]:
    out = []
    for part in spec.split():
        lo, _, hi = part.partition("-")
        hi = hi or lo
        # 三碼的上限含所有細碼（X59 = X59.0–X59.9）
        hi_key = _key(hi)
        out.append((_key(lo), (hi_key[0], hi_key[1] + (0.9 if "." not in hi else 0))))
    return out


_GHE_RANGES = [(cause, _ranges(spec)) for cause, spec in GHE_ICD10]
_FOUR_NCDS = _ranges(FOUR_NCDS)


def _within(code: str, ranges) -> bool:
    k = _key(code)
    return any(lo <= k <= hi for lo, hi in ranges)


def ghe_cause(code: str) -> int | None:
    """ICD-10 碼 → GHE 第二層死因代碼；R 碼（嬰兒猝死除外）、司法相驗中（ZZZ）等回傳 None"""
    if not re.fullmatch(r"[A-Z]\d{2}\w?", code):
        return None
    return next((cause for cause, ranges in _GHE_RANGES if _within(code, ranges)), None)


@dataclass
class TaiwanDeaths:
    """一年的死亡數：by_cause 是 GHE 第二層（另含第一大類的合計），unclassified 是排除在分母外的死亡數。"""

    total: float
    by_cause: dict[int, float]
    unclassified: float
    # 30–69 歲各年齡組死於四大慢性病的人數
    four_ncds_by_age: dict[str, float]


def _rows():
    """死因統計 2008 年起每一列：(年, 性別, ICD-10 碼, 合計, 各年齡組…)"""
    path = download(URL, "mohw", "deaths-icd10.zip")
    with zipfile.ZipFile(path) as z:
        name = next(n for n in z.namelist() if n.endswith(".xlsx"))
        wb = openpyxl.load_workbook(io.BytesIO(z.read(name)), read_only=True, data_only=True)
    rows = wb[SHEET].iter_rows(values_only=True)
    header = next(rows)
    if header[:4] != ("year", "sex", "ICD", "sum_age_groups") or len(header) != 4 + len(AGE_COLUMNS):
        raise RuntimeError(f"死因統計的欄位變了：{header}")
    return rows


def deaths_by_code(prefix: str) -> dict[int, float]:
    """ICD-10 碼以 prefix 開頭的每年死亡數（男女合計），例如 'U07' 是 COVID-19"""
    out: dict[int, float] = {}
    for row in _rows():
        if str(row[2]).strip().replace(".", "").startswith(prefix):
            out[int(row[0])] = out.get(int(row[0]), 0) + float(row[3] or 0)
    return out


def deaths() -> dict[int, TaiwanDeaths]:
    rows = _rows()
    out: dict[int, TaiwanDeaths] = {}
    for row in rows:
        year, code, n = int(row[0]), str(row[2]).strip(), float(row[3] or 0)
        d = out.setdefault(year, TaiwanDeaths(0, {}, 0, {age: 0.0 for age in AGES_30_69}))
        d.total += n
        cause = ghe_cause(code)
        if cause is None:
            d.unclassified += n
            continue
        for level in (cause, LEVEL1.get(cause, NONCOMMUNICABLE)):
            d.by_cause[level] = d.by_cause.get(level, 0) + n
        if _within(code, _FOUR_NCDS):
            for age, cell in zip(AGE_COLUMNS, row[4:]):
                if age in d.four_ncds_by_age and cell:
                    d.four_ncds_by_age[age] += float(cell)
    if not out:
        raise RuntimeError("死因統計讀不到資料")
    return out
