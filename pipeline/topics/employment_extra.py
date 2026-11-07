"""就業、失業與退休：尼特族、年金所得替代率、工作貧窮（2026-11-07，製作手冊第二十五批 453，合併候選 1096–1098；
步驟 employment-extra，輸出 topics/employment/）。

- 尼特族（neet/<total|female|male>.json）：ILOSTAT DF_EIP_2EET_SEX_RT（SDG 8.6.1，15–24 歲既沒就業、也沒在受教育或
  訓練的比例，ILO 模型估計 2025 年 11 月版），2005–2027 年，2025 年起是推估；有台灣。
- 年金所得替代率（replacement-rate/<average|half|double>.json）：OECD Pensions at a Glance 的 DF_PRR，淨替代率
  NPRR100、NPRR50、NPRR200（領平均薪資、一半、兩倍的人），只算強制性制度（OPTIONALITY=M）、男性（SEX=M，OECD 的基準
  情境；女性只差在部分國家的退休年齡），只有 2024 年一年（兩年出一次的制度模擬）。台灣不在 OECD 的資料裡。
- 工作貧窮（working-poverty.json）：ILOSTAT DF_SDG_0111_SEX_AGE_RT（SDG 1.1.1，就業者裡生活在每天 2.15 美元〔2017 年
  PPP〕極端貧窮線以下的比例），15 歲以上、男女合計，2000–2025 年，ILO 模型估計；台灣不在資料裡。
- 候選 1130（非正式就業）：這個主題 2026-10 已經有「非正式就業比例」（EMP_NIFL_SEX_RT，同一個 SDG 8.3.1 的 13 屆
  ICLS 定義、147 國），不重做。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import ilostat, oecd

OUT = OUT_DIR / "topics" / "employment"
NEET = "EIP_2EET_SEX_RT_A"
NEET_FIRST, NEET_PROJECTION = 2005, 2025
SEXES = {"total": "SEX_T", "female": "SEX_F", "male": "SEX_M"}
PRR_FLOW = "OECD.ELS.SPD,DSD_PAG@DF_PRR,1.0"
PRR = {"average": "NPRR100", "half": "NPRR50", "double": "NPRR200"}
POVERTY = "SDG_0111_SEX_AGE_RT_A"
POVERTY_FIRST = 2000


def build() -> None:
    sexes = ilostat.fetch_sexes(NEET)
    for key, sex in SEXES.items():
        countries, world = sexes[sex]
        last = max(y for s in countries.values() for y in s)
        years = list(range(NEET_FIRST, last + 1))
        values = {c: to_series(s, years, 1) for c, s in sorted(countries.items())}
        write_json(OUT / "neet" / f"{key}.json", indicator_file("neet", "%", years, values, projectionFrom=NEET_PROJECTION,
                                                                aggregates={"WLD": to_series(world, years, 1)}, license="CC BY 4.0"),
                   quiet=True)
    c, w = sexes["SEX_T"]
    top = sorted(((round(s[2025], 1), k) for k, s in c.items() if 2025 in s), reverse=True)
    print(f"  尼特族 2025：{len(top)} 國，世界 {round(w.get(2025, 0), 1)}；最高 {top[:6]}；最低 {top[-7:]}；台灣 {round(c['TWN'][2025], 2)}")

    no = {"TWN": "台灣不在 OECD 的年金資料裡"}
    no_en = {"TWN": "Taiwan is not in the OECD pension data"}
    for key, measure in PRR.items():
        s, _ = oecd.series(PRR_FLOW, MEASURE=measure, SEX="M", OPTIONALITY="M")
        values = {k: to_series(v, [2024], 1) for k, v in sorted(s.items())}
        write_json(OUT / "replacement-rate" / f"{key}.json", indicator_file("replacement-rate", "%", [2024], values, noValue=no,
                                                                            noValueEn=no_en, license="CC BY 4.0"), quiet=True)
        top = sorted(((round(v[2024], 1), k) for k, v in s.items() if 2024 in v), reverse=True)
        print(f"  年金替代率 {key}：{len(top)} 國；最高 {top[:8]}；最低 {top[-8:]}")

    countries, world = ilostat.fetch(POVERTY, classif="AGE_YTHADULT_YGE15")
    last = max(y for s in countries.values() for y in s)
    years = list(range(POVERTY_FIRST, last + 1))
    values = {c: to_series(s, years, 2) for c, s in sorted(countries.items())}
    no = {"TWN": "台灣不在 ILO 的工作貧窮資料裡"}
    no_en = {"TWN": "Taiwan is not in the ILO working poverty data"}
    write_json(OUT / "working-poverty.json", indicator_file("working-poverty", "%", years, values, noValue=no, noValueEn=no_en,
                                                            aggregates={"WLD": to_series(world, years, 2)}, license="CC BY 4.0"))
    top = sorted(((round(s[last], 2), k) for k, s in countries.items() if last in s), reverse=True)
    print(f"  工作貧窮 {last}：{len(top)} 國，世界 {world.get(last)}；最高 {top[:6]}")
