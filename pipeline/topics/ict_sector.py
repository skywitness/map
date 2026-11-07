"""產業結構與工業的擴充：ICT 產業占經濟多大，製造還是服務（2026-11-07，製作手冊第二十七批 596，候選 1319；
步驟 ict-sector，輸出 topics/industry/）。

- Eurostat `isoc_bde15ag`（ICT 部門占總附加價值的 %）與 `isoc_bde15ap`（ICT 部門占就業的 %），2008 年起，CC BY 4.0；
  nace_r2：ICT 全部、C_ICT 製造（電腦、電子、光學產品等）、G-U_ICT 服務（軟體、電信、資訊服務等）。英國照網站的規則不收。
- 手冊的建議：只有歐洲，不開新主題，併進「產業結構與工業」。愛爾蘭的 30.9% 有跨國公司的利潤移轉，說明寫明。
- 台灣：Eurostat 沒有（灰色加 tooltip）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "industry"
ITEMS = {"all": "ICT", "manufacturing": "C_ICT", "services": "G-U_ICT"}
NO_TW = ({"TWN": "Eurostat 只有歐洲國家"}, {"TWN": "Eurostat covers European countries only"})


def build() -> None:
    for name, ds in (("ict-gva", "isoc_bde15ag"), ("ict-employment", "isoc_bde15ap")):
        for item, code in ITEMS.items():
            s = eurostat.series(ds, nace_r2=code)
            years = sorted({y for v in s.values() for y in v})
            write_json(OUT / name / f"{item}.json", indicator_file(
                f"{name}-{item}", "%", years, {c: [round(v[y], 3) if y in v else None for y in years] for c, v in sorted(s.items()) if v},
                latestWithin=2, noValue=NO_TW[0], noValueEn=NO_TW[1], license="CC BY 4.0"))
            top = sorted(((round(v[max(v)], 2), c, max(v)) for c, v in s.items() if v), reverse=True)
            print(f"  {name} {item}：{len(s)} 國 {top[:7]} … {top[-3:]}")
