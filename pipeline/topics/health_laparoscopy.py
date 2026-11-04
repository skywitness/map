"""各國健康與醫療：微創（腹腔鏡）手術的比例（2026-11-04，製作手冊第二十批 316）。

- OECD Health Statistics `DSD_HEALTH_PROC@DF_SURG_PROC,1.2`（OECD 資料條款）。整份 62.6 MB，用 SDMX key 只抓 6 個手術代碼
  （約 17 MB）。比例自己算：同一國同一年的「腹腔鏡的每十萬人手術數」÷「全部的每十萬人手術數」（`PRC_10P5PS`、
  `MODE_PROVISION=_T`，住院加當日手術）：闌尾切除 CM4701_4711 ÷ CM470_471、膽囊切除 CM5123 ÷ CM5122_5123、
  疝氣修補 CM_LPR ÷ CM530_531。資料集裡的「Percentage of procedures」是住院占全部的比例，不是腹腔鏡的比例，不用。
- 台灣：健保署「診療項目醫令申報量(年)」（data.gov.tw 175960，2016–2025 年全國各支付標準代碼的申報量，政府資料開放
  授權條款第 1 版）。本機 session 從 info.nhi.gov.tw 下載，放在 map-plan 的 `data/nhi/procedure-claims-yearly-2016-2025.csv`
  （README 用支付標準檔核對過代碼）；重跑前複製到 `pipeline/.cache/nhi/`。比例＝腹腔鏡代碼的申報量 ÷（腹腔鏡＋開腹）：
  - 闌尾切除 74004B ÷（74002B＋74004B）；膽囊切除 75215B ÷（75203B＋75215B）。
  - 疝氣用鼠蹊加股疝氣（OECD 的是鼠蹊疝氣，股疝氣一年只有 300 多件）：開腹 75606B、75607C、75613C、75614C、75615C，
    腹腔鏡 75618B、75619C、75623C、75624C、75625C 與不分部位的 75610B（2021 年以前也含少量腹壁疝氣）。
  - 陷阱（說明有寫）：是醫令申報量不是病人數；腹腔鏡疝氣的分部位代碼 2021 年 11 月才上路，2022 年腹腔鏡跳了一階
    （可能是申報方式改變）；機械手臂手術依支付標準比照腹腔鏡代碼申報，很可能算在腹腔鏡；嬰兒鼠蹊疝氣（88029C）與
    論病例計酬的門診疝氣（97220K 等）不分開腹或腹腔鏡，沒有算。
"""
from __future__ import annotations

import csv
import hashlib

from common import CACHE_DIR, OUT_DIR, indicator_file, to_series, write_json
from sources import oecd

OUT = OUT_DIR / "topics" / "health"
FLOW = "OECD.ELS.HD,DSD_HEALTH_PROC@DF_SURG_PROC,1.2"
PAIRS = {
    "hernia": ("CM_LPR", "CM530_531"),
    "appendix": ("CM4701_4711", "CM470_471"),
    "gallbladder": ("CM5123", "CM5122_5123"),
}
KEY = "...CM4701_4711+CM470_471+CM5123+CM5122_5123+CM_LPR+CM530_531" + "." * 14  # 18 個維度，第 4 個是手術
FIRST = 2005
WITHIN = 5
NHI = CACHE_DIR / "nhi" / "procedure-claims-yearly-2016-2025.csv"
NHI_SHA256 = "0b511b4df677457dc3c462b71aef82b54c43c03cf24ea58d7bd09bfe2eda7e29"
# (腹腔鏡的代碼, 開腹的代碼)
TW_CODES = {
    "appendix": (["74004B"], ["74002B"]),
    "gallbladder": (["75215B"], ["75203B"]),
    "hernia": (["75618B", "75619C", "75623C", "75624C", "75625C", "75610B"],
               ["75606B", "75607C", "75613C", "75614C", "75615C"]),
}
TW_LATER = {"75618B", "75619C", "75623C", "75624C", "75625C"}  # 2021 年才出現的分部位腹腔鏡代碼


def _taiwan() -> dict[str, dict[int, float]]:
    """健保署的醫令申報量：{手術: {年: 腹腔鏡的比例 %}}"""
    if not NHI.exists():
        raise RuntimeError(f"沒有 {NHI}：請把 map-plan 的 data/nhi/procedure-claims-yearly-2016-2025.csv 複製到這裡")
    if hashlib.sha256(NHI.read_bytes()).hexdigest() != NHI_SHA256:
        raise RuntimeError(f"{NHI} 的 SHA-256 跟 map-plan 的 README 不一樣，檔案可能換了版本，先看過再改")
    wanted = {c for lap, open_ in TW_CODES.values() for c in lap + open_}
    counts: dict[tuple[int, str], float] = {}
    with NHI.open(encoding="utf-8-sig", newline="") as f:  # 名稱欄裡夾著換行，要用 CSV 解析器讀
        for r in csv.DictReader(f):
            code = r["診療項目代碼"]
            if code in wanted:
                key = (int(r["費用年"]), code)
                if key in counts:
                    raise RuntimeError(f"健保署申報量：{key} 有兩列")
                counts[key] = float(r["申報量（次）"])
    years = sorted({y for y, _ in counts})
    out = {}
    for item, (lap, open_) in TW_CODES.items():
        out[item] = {}
        for y in years:
            missing = [c for c in lap + open_ if (y, c) not in counts and not (c in TW_LATER and y < 2021)]
            if missing:
                raise RuntimeError(f"健保署申報量：{y} 年沒有 {missing}")
            a = sum(counts.get((y, c), 0) for c in lap)
            b = sum(counts.get((y, c), 0) for c in open_)
            out[item][y] = a / (a + b) * 100
    return out


def build() -> None:
    taiwan = _taiwan()
    for item, (num_code, den_code) in PAIRS.items():
        num, _ = oecd.series(FLOW, KEY, MEDICAL_PROCEDURE=num_code, UNIT_MEASURE="PRC_10P5PS", MODE_PROVISION="_T")
        den, _ = oecd.series(FLOW, KEY, MEDICAL_PROCEDURE=den_code, UNIT_MEASURE="PRC_10P5PS", MODE_PROVISION="_T")
        share = {c: {y: v / den[c][y] * 100 for y, v in s.items() if den.get(c, {}).get(y) and y >= FIRST} for c, s in num.items()}
        share = {c: s for c, s in share.items() if s}
        over = [(c, y, round(v, 1)) for c, s in share.items() for y, v in s.items() if v > 100.5]
        if over:
            raise RuntimeError(f"腹腔鏡的比例超過 100%（分子分母沒對上）：{over}")
        share["TWN"] = taiwan[item]
        last = max(y for s in share.values() for y in s)
        years = list(range(FIRST, last + 1))
        tw_note = ("健保署的醫令申報量（腹腔鏡 ÷ 腹腔鏡加開腹），是申報量不是病人數"
                   + ("；疝氣是鼠蹊加股疝氣，腹腔鏡的分部位代碼 2021 年 11 月才上路，2022 年跳了一階" if item == "hernia" else ""))
        tw_note_en = ("National Health Insurance claims (laparoscopic ÷ laparoscopic plus open), counting claims rather than patients"
                      + ("; inguinal plus femoral hernia, and new site-specific laparoscopic codes from November 2021 cause a jump in 2022" if item == "hernia" else ""))
        write_json(OUT / f"laparoscopic-{item}.json", indicator_file(
            f"laparoscopic-{item}", "%", years, {c: to_series({y: min(v, 100) for y, v in s.items()}, years, 1) for c, s in sorted(share.items())},
            latestWithin=WITHIN, notes={"TWN": tw_note}, notesEn={"TWN": tw_note_en}))
        print(f"  {item} 台灣：{ {y: round(v, 1) for y, v in taiwan[item].items() if y in (2016, 2021, 2022, 2024, 2025)} }")
        latest = sorted(((s[max(s)], c, max(s)) for c, s in share.items()), reverse=True)
        print(f"  {item}：{len(share)} 國；最高 {[(c, round(v, 1), y) for v, c, y in latest[:5]]}；最低 {[(c, round(v, 1), y) for v, c, y in latest[-5:]]}")
