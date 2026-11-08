"""能源與礦業的就業：電力燃氣業與採礦業（新主題，2026-11-08，製作手冊第二十七批 627，候選 1367；步驟 energy-jobs，
輸出 topics/energy-jobs/）。

- ILOSTAT SDMX `DF_EMP_TEMP_SEX_ECO_NB`（就業人數依經濟活動，千人，CC BY 4.0；同 transport_jobs.py 的做法）：
  ECO_ISIC4_D（電力、燃氣、蒸汽及空調供應業）、ECO_ISIC4_B（礦業及土石採取業，含所有採礦，不只化石燃料）、ECO_ISIC4_TOTAL，
  男女合計，年資料，2000 年起；OBS_STATUS 是 U（不可靠）的不收；電力燃氣業占總就業超過 5% 的國家年份（明顯錯誤）不收。
  各國最近一年不同（latestWithin 5）。
  手冊的陷阱：B 大類含金屬、砂石，不能叫「化石燃料就業」；D 大類不含再生能源設備的製造與安裝（在 C、F 大類）。
- 台灣：ILO 只到 2020 年；2017 年起用主計總處 A040103050「就業者－按行業分」（跟 transport_jobs.py 共用快取）的
  「礦業及土石採取業」「電力及燃氣供應業」「總計」，年平均，只收已過完的年份；2016 年以前接 ILO 的值（也是人力資源調查）。
- 指標：兩個行業合計與分開的人數（千人）與占總就業的 %。
"""
from __future__ import annotations

from datetime import date

from common import OUT_DIR, indicator_file, write_json
from sources import dgbas
from topics.transport_jobs import LATEST, _ilo

OUT = OUT_DIR / "topics" / "energy-jobs"
TW = {"electricity": "電力及燃氣供應業", "mining": "礦業及土石採取業"}


def _taiwan() -> dict[str, dict[int, float]]:
    header, data = dgbas._table("A040103050", 106, "0,20", "0,1")
    rows = {y: dict(zip(header, v)) for y, v in data.items() if y < date.today().year}
    out = {k: {y: float(dgbas._num(r[col])) * 1000 for y, r in rows.items()} for k, col in TW.items()}
    out["total"] = {y: float(dgbas._num(r["總計"])) * 1000 for y, r in rows.items()}
    return out


def build() -> None:
    series = {"electricity": _ilo("ECO_ISIC4_D"), "mining": _ilo("ECO_ISIC4_B"), "total": _ilo("ECO_ISIC4_TOTAL")}
    for s in series.values():  # ILO 的科索沃代碼是 KOS，地圖用 XKX
        if "KOS" in s:
            s["XKX"] = s.pop("KOS")
    tw = _taiwan()
    for k, s in series.items():
        s["TWN"] = {**{y: v for y, v in s.get("TWN", {}).items() if y < min(tw[k])}, **tw[k]}
    # 明顯錯誤的值：電力燃氣業占總就業超過 5%（烏茲別克 2020 年 187.5 萬人、前一年 7.9 萬；牙買加 2023、波札那 2010），
    # 這些國家年份三個行業都不用（其他國家最高是白俄羅斯約 4%、諾魯 4.6%）
    bad = {(c, y) for c, x in series["electricity"].items() for y, v in x.items()
           if series["total"].get(c, {}).get(y) and v / series["total"][c][y] > 0.05}
    print(f"  排除：{sorted(bad)}")
    for k in ("electricity", "mining"):
        for c, y in bad:
            series[k].get(c, {}).pop(y, None)
    both = {}
    for c in set(series["electricity"]) & set(series["mining"]):
        v = {y: series["electricity"][c][y] + series["mining"][c][y] for y in set(series["electricity"][c]) & set(series["mining"][c])}
        if v:
            both[c] = v
    groups = {"both": both, "electricity": series["electricity"], "mining": series["mining"]}
    total = series["total"]
    years = sorted({y for s in groups.values() for x in s.values() for y in x})
    note = ({"TWN": "主計總處人力資源調查（就業者按行業分）"}, {"TWN": "DGBAS Manpower Survey (employment by industry)"})
    for k, s in groups.items():
        # 人數存千人（1 位小數）：6 位數以上的整數在指標檔會掉最後一位
        write_json(OUT / "workers" / f"{k}.json", indicator_file(
            f"workers/{k}", "千人", years, {c: [round(x[y] / 1000, 2) if y in x else None for y in years] for c, x in sorted(s.items())},
            hints=note[0], hintsEn=note[1], latestWithin=LATEST, license="CC BY 4.0"))
        share = {c: {y: v / total[c][y] * 100 for y, v in x.items() if total.get(c, {}).get(y)} for c, x in s.items()}
        share = {c: x for c, x in share.items() if x}
        write_json(OUT / "share" / f"{k}.json", indicator_file(
            f"share/{k}", "%", years, {c: [round(x[y], 3) if y in x else None for y in years] for c, x in sorted(share.items())},
            hints=note[0], hintsEn=note[1], latestWithin=LATEST, license="CC BY 4.0"))
        if k == "both":
            y = 2024
            r = sorted(((c, x[y]) for c, x in share.items() if y in x), key=lambda t: -t[1])
            print(f"  合計占比 {y}（{len(r)} 國）：" + "、".join(f"{c} {v:.2f}" for c, v in r[:14]))
            print("    " + "、".join(f"{c} {share[c][y]:.2f}（{series['electricity'][c].get(y, 0) / 1000:,.1f}＋{series['mining'][c].get(y, 0) / 1000:,.1f}）"
                                    for c in ("RUS", "CHL", "AUS", "USA", "DEU", "FRA", "KOR", "JPN", "TWN", "MNG", "ZWE", "IND", "CHN", "IDN")
                                    if y in share.get(c, {})))
            big = sorted(((c, x[y]) for c, x in s.items() if y in x), key=lambda t: -t[1])[:8]
            print("    人數最多：" + "、".join(f"{c} {v / 1000:,.1f}" for c, v in big))
