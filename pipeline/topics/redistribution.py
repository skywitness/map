"""重分配與貧窮（新主題，2026-11-07，製作手冊第二十五批 449，合併候選 1089–1091；步驟 redistribution，
輸出 topics/redistribution/）。

- OECD Income Distribution Database（IDD，OECD.WISE.INE 的 DSD_WISE_IDD@DF_IDD，sources/oecd.py；只下載要的三個
  measure，整個資料流 44 MB）：市場所得吉尼 INC_MRKT_GINI、可支配所得吉尼 INC_DISP_GINI、可支配所得的相對貧窮率
  PR_INC_DISP（中位數 50% 線 PL_50）。只用 DEFINITION=D_CUR；同一年有 2012 年新定義（METH2012）與舊定義（METH2011）
  時用新的。45 國，1974–2025 年，各國調查年份差很多（中國大陸、印度只到 2011 年），前端用 10 年內最近一次
  （latestWithin），標實際年份。
  - gini/<market|disposable>.json、redistribution.json（市場所得吉尼 − 可支配所得吉尼，兩個都有的年份）。
  - poverty/<all|children|working-age|elderly>.json（AGE=_T、Y_LT18、Y18T65、Y_GT65）。
- OECD TaxBEN（OECD.ELS.JAI，模型家庭，不是實際受領者的平均）：
  - benefit-adequacy.json：DF_IA 的 GMINISJF，沒工作、申請最低生活保障的單身（S_C0）一年的淨所得占全國可支配所得
    中位數的 %，**不含住宅補貼（HOUSE_BENEFIT=NO）**（手冊列的數字是這一版）。
  - hours-out-of-poverty.json：DF_HOURSPOV 的 GMIWHEPJF，領最低工資（MINW）的單親帶兩個小孩（S_C2）一週要工作
    幾小時才脫離貧窮線，不含住宅補貼、不含暫時性的就業獎勵（TEMP_INTOWORK_BENEFIT=NO）。
- 台灣：OECD 沒有台灣。主計總處家庭收支調查的「政府移轉收支對所得分配的影響」表找不到開放的資料表代碼（手冊寫
  留給製作時處理，2026-11-07 也沒找到），台灣留空，說明寫明。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import oecd
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "redistribution"
IDD_FLOW = "OECD.WISE.INE,DSD_WISE_IDD@DF_IDD,1.0"
IDD_KEY = ".A.INC_MRKT_GINI+INC_DISP_GINI+PR_INC_DISP......"
IA_FLOW = "OECD.ELS.JAI,DSD_TAXBEN_IA@DF_IA,1.0"
HOURS_FLOW = "OECD.ELS.JAI,DSD_TAXBEN_HOURSPOV@DF_HOURSPOV,1.0"
FIRST = 1985
WITHIN = 10
AGES = {"all": "_T", "children": "Y_LT18", "working-age": "Y18T65", "elderly": "Y_GT65"}
NO_TW = {"TWN": "OECD 的資料沒有台灣"}
NO_TW_EN = {"TWN": "Taiwan is not in the OECD data"}


def _idd() -> dict[tuple[str, str, str], dict[str, dict[int, float]]]:
    """{(measure, age, poverty_line): {iso3: {年: 值}}}，新定義優先"""
    raw: dict[tuple, dict[str, dict[int, dict[str, float]]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    for r in oecd.rows(IDD_FLOW, IDD_KEY):
        if r["DEFINITION"] != "D_CUR" or not r["OBS_VALUE"] or not (iso3 := to_iso3(r["REF_AREA"])):
            continue
        raw[(r["MEASURE"], r["AGE"], r["POVERTY_LINE"])][iso3][int(r["TIME_PERIOD"][:4])][r["METHODOLOGY"]] = float(r["OBS_VALUE"])
    return {k: {c: {y: m.get("METH2012", m.get("METH2011")) for y, m in s.items()} for c, s in by.items()} for k, by in raw.items()}


def _write(path, indicator: str, unit: str, series: dict[str, dict[int, float]], digits: int, **extra) -> list[int]:
    last = max(y for s in series.values() for y in s)
    years = list(range(FIRST, last + 1))
    values = {c: to_series(s, years, digits) for c, s in sorted(series.items())}
    write_json(path, indicator_file(indicator, unit, years, values, latestWithin=WITHIN, noValue=NO_TW, noValueEn=NO_TW_EN,
                                    **extra), quiet=True)
    return years


def _latest(series: dict[str, dict[int, float]], last: int) -> list[tuple[float, str, int]]:
    out = []
    for c, s in series.items():
        ys = [y for y in s if last - WITHIN < y <= last]
        if ys:
            y = max(ys)
            out.append((round(s[y], 3), c, y))
    return sorted(out, reverse=True)


def build() -> None:
    idd = _idd()
    market = idd[("INC_MRKT_GINI", "_T", "_Z")]
    disp = idd[("INC_DISP_GINI", "_T", "_Z")]
    for key, s in (("market", market), ("disposable", disp)):
        _write(OUT / "gini" / f"{key}.json", "gini", "", s, 3, license="CC BY 4.0")
    red = {c: {y: market[c][y] - v for y, v in s.items() if y in market.get(c, {})} for c, s in disp.items()}
    red = {c: s for c, s in red.items() if s}
    years = _write(OUT / "redistribution.json", "redistribution", "", red, 3, license="CC BY 4.0")
    top = _latest(red, years[-1])
    print(f"  重分配（吉尼下降）{len(top)} 國：最多 {top[:6]}；最少 {top[-6:]}")
    for c in ("FIN", "BEL", "FRA", "KOR", "USA", "IND", "MEX", "CHN"):
        print(f"    {c}：市場 {_latest({c: market[c]}, years[-1])} 可支配 {_latest({c: disp[c]}, years[-1])}")
    for key, age in AGES.items():
        s = idd[("PR_INC_DISP", age, "PL_50")]
        y = _write(OUT / "poverty" / f"{key}.json", "poverty", "%", s, 1, license="CC BY 4.0")
        top = _latest(s, y[-1])
        print(f"  相對貧窮率 {key}：{len(top)} 國；最高 {top[:7]}；最低 {top[-6:]}")

    ia, _ = oecd.series(IA_FLOW, UNIT_MEASURE="PT_INC_DISP_HH_MEDIAN", HOUSEHOLD_TYPE="S_C0", HOUSE_BENEFIT="NO")
    years = _write(OUT / "benefit-adequacy.json", "benefit-adequacy", "%", ia, 0, license="CC BY 4.0")
    top = _latest(ia, years[-1])
    print(f"  低收入給付占中位數所得 {len(top)} 國：最高 {top[:8]}；最低 {top[-8:]}")
    hours, _ = oecd.series(HOURS_FLOW, INCOME_CURR="MINW", HOUSEHOLD_TYPE="S_C2", HOUSE_BENEFIT="NO", TEMP_INTOWORK_BENEFIT="NO")
    years = _write(OUT / "hours-out-of-poverty.json", "hours-out-of-poverty", "小時/週", hours, 0, license="CC BY 4.0")
    top = _latest(hours, years[-1])
    print(f"  脫貧要工作幾小時 {len(top)} 國：最多 {top[:8]}；最少 {top[-10:]}")
    write_json(OUT / "manifest.json", {"topic": "redistribution", "generatedAt": now_iso(),
                                       "sources": ["OECD Income Distribution Database", "OECD TaxBEN (DF_IA, DF_HOURSPOV)"]})
