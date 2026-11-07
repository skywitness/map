"""宗教主題：宗教自由與宗教組織的處境（2026-11-07，製作手冊第二十七批 554，候選 1248、1249；V-Dem v16，CC BY-SA 4.0）。

- 宗教自由（v2clrelig）：個人與團體能不能自由選擇、改變、實踐宗教（含不信教），政府與社會是否干預。
- 宗教組織受不受壓制（v2csrlgrep）：政府如何對待宗教組織，越高越不受壓制（V-Dem 的原始方向）。
- 宗教組織說不說得上話（v2csrlgcon）：決策者制定政策時會不會徵詢主要宗教組織。高分不等於好：伊朗的神權體制分數高，
  政教分離的法國、日本是負的，說明與側欄寫明；地圖用單色漸層，不用紅藍的「好壞」配色。
- 三項都是 V-Dem 測量模型的估計值（區間尺度，約 −4 到 +3，0 大約是所有國家年份的平均），不是 0–1 指數，
  所以單位寫「V-Dem 估計值」、門檻在前端另外定；68% 可信區間（codelow、codehigh）照民主主題的做法輸出。
- 1789 年到最新一年（2025），國家的接續方式跟民主與自由主題一樣（topics/democracy.py 的 country_series）。
  1900 年以前就併入德國、義大利的各邦（巴伐利亞、薩克森、兩西西里、教宗國等 19 個；漢堡只有部分變數）地圖上沒有形狀，不收（PRE_1900）；
  德國、中國、義大利、俄羅斯、台灣的附註補上 1900 年以前的部分。
- 世界值是每年有資料的國家的中位數（aggregates.MEDIAN，跟政府治理主題的 V-Dem 指標一樣），側欄畫虛線。
- 不用 v2xpas_religion（宗教政黨的指數）：v16 的 2025 年是空的。
"""
from __future__ import annotations

from common import OUT_DIR
from sources import vdem
from topics.democracy import NOTES, index_files

OUT = OUT_DIR / "topics" / "religion"
FIRST_YEAR = 1789
UNIT = "V-Dem 估計值"
# 指標 id → V-Dem 變數
INDICES = {
    "religious-freedom": "v2clrelig",
    "religious-repression": "v2csrlgrep",
    "religious-consultation": "v2csrlgcon",
}
# 1900 年以前就併入德國、義大利的政體（V-Dem 代碼 → 名稱）：地圖上沒有形狀，不收
PRE_1900 = {
    "BDN": "巴登", "BRW": "布朗斯維克", "HRG": "漢堡", "BVR": "巴伐利亞", "HDM": "黑森-達姆施塔特", "HKS": "黑森-卡塞爾",
    "HVR": "漢諾威", "MCL": "梅克倫堡-什未林", "NSS": "拿騷", "OLD": "奧登堡", "SAX": "薩克森-威瑪-艾森納赫",
    "SXN": "薩克森", "WRG": "符騰堡",
    "MDN": "摩德納", "PPS": "教宗國", "PRM": "帕爾馬", "SPD": "薩丁尼亞-皮埃蒙特", "TSC": "托斯卡尼", "TWS": "兩西西里",
}
# 1789 年起的附註（取代民主主題從 1900 年起寫的那幾則）
EXTRA_NOTES: dict[str, tuple[str, str]] = {
    "DEU": (
        "1789–1866 年是普魯士，1867–1870 年是北德意志邦聯，1871 年起是德意志帝國；巴伐利亞、薩克森、符騰堡等邦在併入以前"
        "另外評分，地圖上沒有它們的形狀，所以沒有放。" + NOTES["DEU"][0],
        "Prussia in 1789–1866, the North German Confederation in 1867–1870 and the German Empire from 1871; Bavaria, Saxony, "
        "Württemberg and other states are scored separately until they joined and have no shape on today's map, so they are not shown. "
        + NOTES["DEU"][1],
    ),
    "ITA": (
        "1861 年義大利王國成立起才有評分；在那之前的薩丁尼亞-皮埃蒙特、兩西西里、教宗國、托斯卡尼等另外評分，地圖上沒有它們的形狀，所以沒有放。",
        "Scored from the founding of the Kingdom of Italy in 1861; Piedmont-Sardinia, the Two Sicilies, the Papal States, "
        "Tuscany and other earlier states are scored separately and have no shape on today's map, so they are not shown.",
    ),
    "CHN": (
        "1789–1910 年是清朝，1911–1948 年是中華民國（北洋政府、國民政府），1949 年起是中華人民共和國。",
        "Qing China in 1789–1910, the Republic of China (Beiyang and Nationalist governments) in 1911–1948, "
        "and the People's Republic of China from 1949.",
    ),
    "RUS": (
        "1789–1916 年是俄羅斯帝國。" + NOTES["RUS"][0],
        "The Russian Empire in 1789–1916. " + NOTES["RUS"][1],
    ),
    "TWN": (
        NOTES["TWN"][0] + "1900 年以前沒有另外評分。",
        NOTES["TWN"][1] + " Not scored separately before 1900.",
    ),
}


def build() -> None:
    rows = [r for r in vdem.rows() if r["country_text_id"] not in PRE_1900]
    last = max(int(r["year"]) for r in rows)
    years = list(range(FIRST_YEAR, last + 1))
    for key, variable in INDICES.items():
        values = index_files(OUT, key, variable, rows, years, aggregate="MEDIAN", unit=UNIT, extra_notes=EXTRA_NOTES)
        latest = {c: s[-1] for c, s in values.items() if s[-1] is not None}
        top = sorted(latest.items(), key=lambda kv: -kv[1])
        first = {y: sum(1 for s in values.values() if s[i] is not None) for i, y in enumerate(years) if y in (1789, 1850, 1900, 1950)}
        print(f"  {key}（{variable}）：{len(values)} 國，{last} 年 {len(latest)} 國；各年國家數 {first}；"
              f"最高 {top[:4]}；最低 {top[-4:]}")
        twn = values.get("TWN")
        if twn:
            print("    台灣 " + "、".join(f"{y} {twn[years.index(y)]}" for y in (1900, 1930, 1950, 1980, 1987, 1996, 2025)))
