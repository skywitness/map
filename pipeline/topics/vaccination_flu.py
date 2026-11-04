"""疫苗與防疫：65 歲以上長者的流感疫苗接種率（2026-11-04，製作手冊第二十批 325）。

OECD Health Statistics `DSD_HEALTH_PROC@DF_IMMUN`（流感 IFLU、`PT_POP_Y_GE65`，60 國含幾個非會員，1980 年起）。
授權：使用者 2026-11-04 決定沿用 2026-10-17 已查證的 OECD 資料條款（DESIGN.md 第 8 節第 12 點）。WHO 的 FLU_ELDERLY 只在
GHO（使用者決定不用）。同一國 OECD 與 WHO 對不上（分母定義不同），只用 OECD。
台灣不在 OECD 的資料裡，用疾管署每年度的「流感疫苗接種計畫成果」PDF（一頁一張表，各類對象的應接種數、接種數、接種率）。
www.cdc.gov.tw 的 /File/ robots.txt 不准程式抓，使用者用瀏覽器下載 109–114 年度，本機 session 放在 map-plan 的
`data/cdc/flu-vaccine-results-<年度>.pdf`（README 有 SHA-256 與數字）；重跑前複製到 `pipeline/.cache/cdc/`。讀「65歲以上長者」
那一列，接種數 ÷ 應接種數要等於表上的接種率。年份用接種季開始的年（109 年度＝2020 年 10 月開打的 2020–21 年季記成 2020），
OECD 各國的年份寫法不一，說明有寫。109–111 年度的列名是「65歲以上長者/機構對象」（含安養等機構的對象），112 年度起
機構對象另列在括號裡，口徑略有不同；113 年度只統計到隔年 6 月底，其他年度到 8、9 月底。
"""
from __future__ import annotations

import hashlib
import re

from pypdf import PdfReader

from common import CACHE_DIR, OUT_DIR, indicator_file, to_series, write_json
from sources import oecd

OUT = OUT_DIR / "topics" / "vaccination"
FLOW = "OECD.ELS.HD,DSD_HEALTH_PROC@DF_IMMUN,"
FIRST = 2000
WITHIN = 3
TW_DIR = CACHE_DIR / "cdc"
TW_SHA256 = {
    109: "bdcd5e6d3045c3efe7e05cfcbde1dfd8112c50f9662659a6eb576288b7c0ef0a",
    110: "eabf207995bd78621bc55a10b72198dd0cf8743d086fecb2356f7f12fea2da40",
    111: "9267a04898cd83aa8dab982de722a7117a71444a589e3aa20c99ac817b095ce4",
    112: "fd39e0ceecbf3fe14a195fa01f75b642eae1e3d5fc8bf21c3e6ab00dbecf754a",
    113: "68442f4c0e68861f9b9657ece9f0775e92e836a3bdff6fce1a4d44c4b9459cba",
    114: "2a0d1a795a73039c00242abc96e6af6d540f8afc9087f6348e1cec05b68aabb9",
}


def _taiwan() -> dict[int, float]:
    """疾管署：65 歲以上長者的流感疫苗接種率，{接種季開始的西元年: %}"""
    out = {}
    for roc, sha in TW_SHA256.items():
        path = TW_DIR / f"flu-vaccine-results-{roc}.pdf"
        if not path.exists():
            raise RuntimeError(f"沒有 {path}：請把 map-plan 的 data/cdc/{path.name} 複製到這裡")
        if hashlib.sha256(path.read_bytes()).hexdigest() != sha:
            raise RuntimeError(f"{path} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改")
        text = PdfReader(path).pages[0].extract_text()
        m = re.search(r"65歲以上長者\S*\s+([\d,]+)\s+([\d,]+)\s+([\d.]+)%", text)
        if not m:
            raise RuntimeError(f"{path.name} 找不到 65 歲以上長者那一列")
        target, done, printed = int(m.group(1).replace(",", "")), int(m.group(2).replace(",", "")), float(m.group(3))
        rate = done / target * 100
        if abs(round(rate, 1) - printed) > 0.05:
            raise RuntimeError(f"{path.name}：{done} ÷ {target} = {rate:.2f}%，跟表上的 {printed}% 不一樣")
        out[roc + 1911] = rate
    return out


def build() -> None:
    s, _ = oecd.series(FLOW, DISEASE="IFLU", UNIT_MEASURE="PT_POP_Y_GE65")
    s = {c: {y: v for y, v in v_.items() if y >= FIRST} for c, v_ in s.items()}
    s = {c: v for c, v in s.items() if v}
    s["TWN"] = _taiwan()
    last = max(y for v in s.values() for y in v)
    years = list(range(FIRST, last + 1))
    write_json(OUT / "flu-elderly.json", indicator_file(
        "flu-elderly", "%", years, {c: to_series(v, years, 1) for c, v in sorted(s.items())},
        latestWithin=WITHIN,
        notes={"TWN": "疾管署「流感疫苗接種計畫成果」的 65 歲以上長者接種率（接種數 ÷ 應接種數）；年份是接種季開始的年，"
                      "例如 2024 年是 2024 年 10 月開打的那一季；2020–2022 年含安養等機構的對象"},
        notesEn={"TWN": "Taiwan CDC influenza vaccination programme results, people aged 65+ (doses given ÷ eligible population); "
                        "the year is when the season starts, e.g. 2024 for the season beginning October 2024; 2020–2022 include residents of care institutions"}))
    print(f"  台灣：{ {y: round(v, 1) for y, v in s['TWN'].items()} }")
    y = 2024
    at = sorted(((v[y], c) for c, v in s.items() if y in v), reverse=True)
    med = sorted(v for v, _ in at)[len(at) // 2]
    print(f"  65 歲以上流感疫苗：{len(s)} 國，{years[0]}–{years[-1]}；{y} 年 {len(at)} 國，中位數 {med}；最高 {at[:6]}；最低 {at[-6:]}")
