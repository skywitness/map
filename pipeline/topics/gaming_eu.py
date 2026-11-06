"""電競：多少人上網玩遊戲、訂閱遊戲服務（2026-11-06，製作手冊第二十四批 424；步驟 gaming-eu，輸出 topics/esports/）。

- Eurostat `isoc_ci_ac_i`（Individuals - internet activities）的 I_IUPDG「上網玩或下載遊戲」，16–74 歲全部人口的比例
  （分母不是上網的人），大約兩年一次；`isoc_ec_ibgs`（Internet purchases - goods or services, 2020 onwards）的
  I_BGAMSS「有付費的遊戲串流訂閱」，2025 年起。CC BY 4.0；英國、科索沃由 sources/eurostat.py 統一排除。
- 只有歐洲約 35 國，台灣沒有可比的全國資料（data.gov.tw 沒有玩遊戲人口比例的資料集）。
- 2021 年以前的 I_IUGM 把遊戲、圖片、影片、音樂混在一起，跟 I_IUPDG 不能接成一條線，不用。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "esports"


def _write(name: str, dataset: str, indic: str) -> None:
    raw = eurostat.series(dataset, indic_is=indic, unit="PC_IND", ind_type="IND_TOTAL")
    years = sorted({y for s in raw.values() for y in s})
    # 電競主題沒有時間軸（timeless），只輸出最新一年
    last = years[-1]
    values = {k: [round(s[last], 1)] for k, s in sorted(raw.items()) if last in s}
    write_json(OUT / f"{name}.json", indicator_file(name, "%", [last], values, license="CC BY 4.0"))
    ranked = sorted(((s[last], k) for k, s in raw.items() if last in s), reverse=True)
    print(f"  {name}：{years[0]}–{last}，{last} 年 {len(ranked)} 國；最高 {[(round(v, 1), k) for v, k in ranked[:8]]}；"
          f"最低 {[(round(v, 1), k) for v, k in ranked[-5:]]}")


def build() -> None:
    _write("gaming-online", "isoc_ci_ac_i", "I_IUPDG")
    _write("gaming-subscriptions", "isoc_ec_ibgs", "I_BGAMSS")
