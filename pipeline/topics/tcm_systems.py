"""傳統醫學的制度（新主題，2026-11-08，製作手冊第二十九批 691，候選 1552、1544；步驟 tcm-systems，輸出 topics/tcm-systems/）。

- **向 WHO 回報過幾次**（1552）：2024 年報告 Annex 1，194 個會員國 × 四次調查（2001、2012、2016–18 的更新調查、2023）；
  回報次數 0–4 與每一次有沒有回報（時間軸，2016–18 的更新調查畫在 2018 年）。這張圖量的是「有沒有回報」，不是「有沒有制度」。
- **國家級政策與法規**（1544）：2019 年報告的區域表 5.1–5.6 只有各區的國數，逐國的值要等順序 704 從 141 個國家的段落抽出來；
  這一步只印出六區的數字（說明用），並跑分區對帳（sources/who_tcm.py）。
- 台灣不是 WHO 會員國，不在調查裡：noValue 寫台灣自己的中醫藥制度（中醫藥發展法，全國法規資料庫 pcode L0000097）。
- 授權：兩份報告 CC BY-NC-SA 3.0 IGO，資料檔照同一授權。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import who_tcm

OUT = OUT_DIR / "topics" / "tcm-systems"
WAVE_YEARS = [2001, 2012, 2018, 2023]
WAVE_LABELS = ["2001", "2012", "2016–18", "2023"]
LICENSE = "CC BY-NC-SA 3.0 IGO"
TW = "台灣不是 WHO 會員國，不在這份調查裡。台灣有《中醫藥發展法》（2019 年 12 月 31 日公布）、衛福部中醫藥司，中醫門診由全民健保給付"
TW_EN = ("Taiwan is not a WHO Member State and is not in the survey. Taiwan has a Chinese Medicine Development Act "
         "(promulgated 31 December 2019) and a Department of Chinese Medicine and Pharmacy in its health ministry, and "
         "National Health Insurance covers Chinese medicine outpatient care")


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    annex = who_tcm.annex1()
    regions = who_tcm.regional_tables()
    hints, hints_en = {}, {}
    for c, r in annex.items():
        got = [WAVE_LABELS[i] for i in range(4) if r["waves"][i]]
        hints[c] = ("回報過：" + "、".join(got) + " 年") if got else "四次調查都沒有回報"
        hints_en[c] = ("Responded: " + ", ".join(got)) if got else "Did not respond to any of the four surveys"
    nv, nv_en = {"TWN": TW}, {"TWN": TW_EN}
    write_json(OUT / "reports.json", indicator_file("reports", "次", [2023], {c: [sum(r["waves"])] for c, r in sorted(annex.items())},
                                                    hints=hints, hintsEn=hints_en, noValue=nv, noValueEn=nv_en, license=LICENSE))
    # 每一次調查：1 有回報、2 沒有回報
    write_json(OUT / "responded.json", indicator_file("responded", "類", WAVE_YEARS,
                                                      {c: [1 if w else 2 for w in r["waves"]] for c, r in sorted(annex.items())},
                                                      noValue=nv, noValueEn=nv_en, license=LICENSE))
    totals = [sum(r["waves"][i] for r in annex.values()) for i in range(4)]
    never = sorted(c for c, r in annex.items() if not any(r["waves"]))
    print(f"  Annex 1：{len(annex)} 國；四次調查 {totals}；至少一次 {sum(1 for r in annex.values() if any(r['waves']))} 國；從沒回報 {never}")
    from collections import Counter
    print("    回報次數：" + "、".join(f"{k} 次 {v} 國" for k, v in sorted(Counter(sum(r['waves']) for r in annex.values()).items())))
    by_region = Counter(r["region"] for r in annex.values())
    print("    分區國數：" + "、".join(f"{k} {v}" for k, v in by_region.most_common()))
    for label in ("National policy on T&CM", "Laws or regulations on T&CM", "National office for T&CM", "Expert committee on T&CM",
                  "Regulation of herbal medicines"):
        y05 = sum(rows[label][0] or 0 for rows in regions.values())
        print(f"  2019 年報告 {label}：2005 年 {y05}、2018 年 {sum(rows[label][1] for rows in regions.values())}；"
              + "、".join(f"{reg} {rows[label][1]}" for reg, rows in regions.items()))
