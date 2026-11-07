"""運動：運動業的就業與政府的運動支出（2026-11-06，製作手冊第二十四批 425；步驟 sports-economy，輸出 topics/sports/）。

- Eurostat `sprt_emp_sex`（Employment in sport by sex）：運動業就業占總就業（PC_EMP，男女合計），2011–2025，歐洲 35 國。
  運動就業是「運動業的所有人加上其他行業裡運動職業的人」（NACE × ISCO 交叉），跟台灣運動部的「運動產業」定義不同。
- Eurostat `gov_10a_exp`：一般政府（S13）COFOG 08.1「Recreational and sporting services」的支出合計（TE）占 GDP，
  1995–2025。08.1 含公園、游泳池這類休閒服務，不是純運動，標題寫「運動與休閒服務」。
- 台灣：運動部「中央與地方政府機關體育運動經費相關國民所得毛額、國內生產毛額、中央政府總預算比例」（data.gov.tw
  104905，政府資料開放授權條款第 1 版；運動部網站從 cloud 403，但 ws.sports.gov.tw 的檔案直連可以，那個主機沒有
  robots.txt），「占GDP比例(%)」，民國 90–111 年。是中央與地方的體育運動組織預算，比 COFOG 08.1 窄，tooltip 寫明。
- 2026-11-07：tooltip 加運動就業的年齡（`sprt_emp_age`）與教育程度（`sprt_emp_edu`）組成，用千人算占比；有些國家的小格子
  因為樣本小被隱藏，加起來可能不到 100%。
- CC BY 4.0（Eurostat）；英國、科索沃由 sources/eurostat.py 統一排除。
"""
from __future__ import annotations

import csv
import io

from common import OUT_DIR, download, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "sports"
TW_URL = "https://ws.sports.gov.tw/FS01/FilePath/1/relfile/164/10299/56342898-4cc3-4c78-86ac-0f392899c077.csv"


def _taiwan() -> dict[int, float]:
    raw = download(TW_URL, "sports-tw", "104905.csv").read_bytes().decode("utf-8-sig")
    out = {}
    for r in csv.DictReader(io.StringIO(raw)):
        v = (r.get("占GDP比例(%)") or "").strip().rstrip("%")
        if r["年度"].strip().isdigit() and v:
            out[int(r["年度"]) + 1911] = float(v)
    if not out:
        raise RuntimeError("運動部 104905 的欄位變了（找不到「占GDP比例(%)」）")
    return out


def build() -> None:
    emp = eurostat.series("sprt_emp_sex", unit="PC_EMP", sex="T")
    years = sorted({y for s in emp.values() for y in s})
    # 2026-11-07 補：運動就業的年齡、教育程度組成（sprt_emp_age、sprt_emp_edu 的千人，算占運動就業的比例），寫在 tooltip
    ages = {a: eurostat.series("sprt_emp_age", unit="THS_PER", age=a) for a in ("TOTAL", "Y15-29", "Y30-64", "Y_GE65")}
    edus = {e: eurostat.series("sprt_emp_edu", unit="THS_PER", isced11=e) for e in ("TOTAL", "ED0-2", "ED3_4", "ED5-8")}
    hints, hints_en = {}, {}
    for c, tot in ages["TOTAL"].items():
        y = max(tot)
        share = lambda d, k: round(d[k].get(c, {}).get(y, 0) / tot[y] * 100) if tot[y] else None  # noqa: E731
        a = [share(ages, k) for k in ("Y15-29", "Y30-64", "Y_GE65")]
        etot = edus["TOTAL"].get(c, {}).get(y)
        e = [round(edus[k].get(c, {}).get(y, 0) / etot * 100) if etot else None for k in ("ED5-8", "ED3_4", "ED0-2")]
        hints[c] = (f"{y} 年運動就業 {tot[y]:,.1f} 千人：15–29 歲 {a[0]}%、30–64 歲 {a[1]}%、65 歲以上 {a[2]}%"
                    + (f"；大專以上 {e[0]}%、高中職 {e[1]}%、國中以下 {e[2]}%" if etot else ""))
        hints_en[c] = (f"{tot[y]:,.1f} thousand in sport employment in {y}: aged 15–29 {a[0]}%, 30–64 {a[1]}%, 65+ {a[2]}%"
                       + (f"; tertiary education {e[0]}%, upper secondary {e[1]}%, lower secondary or less {e[2]}%" if etot else ""))
    write_json(OUT / "sport-employment.json", indicator_file(
        "sport-employment", "%", years, {k: [s.get(y) for y in years] for k, s in sorted(emp.items())}, license="CC BY 4.0",
        hints=dict(sorted(hints.items())), hintsEn=dict(sorted(hints_en.items()))))
    for c in ("DEU", "FRA", "SWE", "ITA", "ESP"):
        print(f"    {c}：{hints.get(c)}")

    gov = eurostat.series("gov_10a_exp", unit="PC_GDP", sector="S13", cofog99="GF0801", na_item="TE")
    tw = _taiwan()
    gov["TWN"] = tw
    years = sorted({y for s in gov.values() for y in s})
    hints = {"TWN": "台灣是運動部的中央與地方「體育運動組織預算」占 GDP，只算體育，比歐洲的「運動與休閒服務」（含公園等）窄"}
    hints_en = {"TWN": "Taiwan: central and local sports-organisation budgets as a share of GDP (Sports Administration), "
                       "narrower than Europe’s recreational and sporting services, which include parks"}
    write_json(OUT / "sport-gov-spending.json", indicator_file(
        "sport-gov-spending", "%", years, {k: [s.get(y) for y in years] for k, s in sorted(gov.items())},
        hints=hints, hintsEn=hints_en))

    last_emp = {k: (max(s), s[max(s)]) for k, s in emp.items() if s}
    print(f"  運動業就業：{len(emp)} 國；最新 {sorted(((v, y, k) for k, (y, v) in last_emp.items()), reverse=True)[:8]}；"
          f"最低 {sorted(((v, y, k) for k, (y, v) in last_emp.items()))[:5]}")
    g24 = sorted(((s.get(2024), k) for k, s in gov.items() if s.get(2024) is not None), reverse=True)
    print(f"  政府運動與休閒支出 2024：{len(g24)} 國 {g24[:10]}；最低 {g24[-5:]}；台灣 {sorted(tw.items())[-3:]}")
