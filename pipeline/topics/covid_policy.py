"""疫情期間的防疫管制（OxCGRT）（2026-11-04，製作手冊第二十批 313）。

- 資料：牛津大學 Blavatnik 政府學院的 Oxford COVID-19 Government Response Tracker（https://github.com/OxCGRT/covid-policy-dataset ，
  `data/OxCGRT_compact_national_v1.csv`，43.8 MB，CC BY 4.0，要引用 Hale 等 2021《Nature Human Behaviour》），
  2020-01-01 到 2022-12-31 每天一列、185 個國家或地區，已是最終版不再更新。compact 檔只有 NAT_TOTAL（全國），
  手冊說的 NAT_GOV 與次國家層級不在這個檔裡。
- 減量：每 7 天取一天（2020-01-01、01-08…2022-12-28，157 天），那一天的措施；8 個管制指標（C1–C8）、口罩（H6）與
  嚴格程度指數。年份欄位存「2000-01-01 起的第幾天」（前端的 timeAxis 換回日期），資料檔另寫 coverage（2020–2022），
  給主題頁的結構化資料用。
- 分級與 Flag：每個指標是分級（例如關校 0 沒有措施、1 建議、2 部分學制、3 全部學制），Flag 1 是全國、0 是只在部分地區。
  輸出的代碼：沒有措施 0；第 k 級全國 2k、只在部分地區 2k−1（前端畫成同一級的顏色加斜線）；國際旅行（C8）沒有 Flag，代碼就是分級。
  分級是空的（還沒有資料）當成無資料。
"""
from __future__ import annotations

import csv
from datetime import date, timedelta

from common import OUT_DIR, download, indicator_file, now_iso, write_json

OUT = OUT_DIR / "topics" / "covid-policy"
URL = "https://raw.githubusercontent.com/OxCGRT/covid-policy-dataset/main/data/OxCGRT_compact_national_v1.csv"
START, END, STEP = date(2020, 1, 1), date(2022, 12, 31), 7
EPOCH = date(2000, 1, 1)

# 指標 id → (欄位, Flag 欄位或 None)
POLICIES = {
    "school": ("C1M_School closing", "C1M_Flag"),
    "workplace": ("C2M_Workplace closing", "C2M_Flag"),
    "events": ("C3M_Cancel public events", "C3M_Flag"),
    "gatherings": ("C4M_Restrictions on gatherings", "C4M_Flag"),
    "transport": ("C5M_Close public transport", "C5M_Flag"),
    "stay-home": ("C6M_Stay at home requirements", "C6M_Flag"),
    "internal": ("C7M_Restrictions on internal movement", "C7M_Flag"),
    "travel": ("C8EV_International travel controls", None),
    "masks": ("H6M_Facial Coverings", "H6M_Flag"),
}
ISO3 = {"RKS": "XKX"}


def day_index(d: date) -> int:
    return (d - EPOCH).days


def build() -> None:
    days = []
    d = START
    while d <= END:
        days.append(d)
        d += timedelta(days=STEP)
    wanted = {x.strftime("%Y%m%d"): i for i, x in enumerate(days)}
    years = [day_index(x) for x in days]
    series: dict[str, dict[str, list]] = {k: {} for k in [*POLICIES, "stringency"]}
    flags_missing = 0
    with open(download(URL, "oxcgrt", "compact.csv"), encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["Jurisdiction"] != "NAT_TOTAL":
                raise RuntimeError(f"OxCGRT compact 檔出現 {r['Jurisdiction']}")
            i = wanted.get(r["Date"])
            if i is None:
                continue
            iso3 = ISO3.get(r["CountryCode"], r["CountryCode"])
            for key, (col, flag_col) in POLICIES.items():
                v = r[col]
                if v == "":
                    continue
                level = int(float(v))
                if flag_col is None or level == 0:
                    code = level
                else:
                    flag = r[flag_col]
                    if flag == "":
                        flags_missing += 1
                        flag = "1"
                    code = 2 * level - (0 if flag.startswith("1") else 1)
                series[key].setdefault(iso3, [None] * len(days))[i] = code
            s = r["StringencyIndex_Average"]
            if s != "":
                series["stringency"].setdefault(iso3, [None] * len(days))[i] = round(float(s), 1)
    OUT.mkdir(parents=True, exist_ok=True)
    for key, values in series.items():
        unit = "0–100" if key == "stringency" else "級"
        write_json(OUT / f"{key}.json", indicator_file(key, unit, years, dict(sorted(values.items())), coverage=[START.year, END.year]))
    write_json(OUT / "manifest.json", {
        "topic": "covid-policy", "generatedAt": now_iso(),
        "source": "Oxford COVID-19 Government Response Tracker, Blavatnik School of Government, University of Oxford "
                  "(OxCGRT_compact_national_v1.csv; Hale et al. 2021, Nature Human Behaviour)",
        "license": "CC BY 4.0",
    })
    s = series["stringency"]
    peak = {c: max((v for v in vs if v is not None), default=None) for c, vs in s.items()}
    tw = s.get("TWN", [])
    print(f"  防疫管制：{len(s)} 國、{len(days)} 天（{days[0]}–{days[-1]}）；有分級沒有 Flag 的 {flags_missing} 筆當成全國")
    print(f"  2020-04-15 嚴格程度最高 {sorted(((vs[15] or 0, c) for c, vs in s.items()), reverse=True)[:6]}；台灣最高 {peak.get('TWN')}，2021-06-02 {tw[74] if tw else None}")
