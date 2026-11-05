"""產業結構與工業：企業的機器人使用率（2026-11-05，製作手冊第二十二批 386；步驟 industry-robots，輸出 topics/industry/）。

- Eurostat isoc_eb_p3d「3D printing and robotics by size class of enterprise」（CC BY 4.0）：10 人以上企業（size_emp=GE10，
  不含金融業的 C10-S951_X_K）用工業或服務型機器人的比例（indic_is=E_RBT、unit=PC_ENT），2018、2020、2022 年三期。
  「機器人」含服務型（清掃、倉儲搬運），不是純粹的製造業自動化；產業結構不同的國家不能直接比。
- 側欄：用機器人的理由（unit=PC_ENT_RBT，占用機器人的企業）：人力成本高、招不到人、提升安全、要高精度、擴大產品範圍、政府獎勵。
- Eurostat 的條款：歐盟、EFTA、候選國以外的資料只准非商業使用；這個資料集只有英國（2018 年）在外面，不收。
- 台灣沒有對得上的調查，留白。國際機器人協會（IFR）的機器人密度條款禁止轉載，沒有用。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, to_series, write_json
from sources import eurostat

OUT = OUT_DIR / "topics" / "industry"
DATASET = "isoc_eb_p3d"
BASE = {"freq": "A", "size_emp": "GE10", "nace_r2": "C10-S951_X_K"}
REASONS = ["E_RBTWHCL", "E_RBTWDR", "E_RBTWES", "E_RBTWHP", "E_RBTWER", "E_RBTWTI"]
EXCLUDED = {"GBR"}  # 歐盟、EFTA、候選國以外（Eurostat 只准非商業使用）


def build() -> None:
    use = {c: s for c, s in eurostat.series(DATASET, indic_is="E_RBT", unit="PC_ENT", **BASE).items() if c not in EXCLUDED}
    years = sorted({y for s in use.values() for y in s})
    write_json(OUT / "robot-use.json", indicator_file(
        "robot-use", "%", years, {c: to_series(s, years, 2) for c, s in sorted(use.items())},
    ))
    reasons: dict[str, list] = {}
    for i, code in enumerate(REASONS):
        for c, s in eurostat.series(DATASET, indic_is=code, unit="PC_ENT_RBT", **BASE).items():
            if c in EXCLUDED or max(years) not in s:
                continue
            reasons.setdefault(c, [None] * len(REASONS))[i] = s[max(years)]
    write_json(OUT / "robot-reasons.json", {"year": max(years), "reasons": dict(sorted(reasons.items()))})
    last = {c: s[max(years)] for c, s in use.items() if max(years) in s}
    print(f"  企業的機器人使用率 {years}：{len(use)} 國；{max(years)} 年 {sorted(last.items(), key=lambda kv: -kv[1])[:8]}；"
          f"最低 {sorted(last.items(), key=lambda kv: kv[1])[:4]}；理由 {len(reasons)} 國，丹麥 {reasons.get('DNK')}")
