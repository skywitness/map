"""醫院的表現：急性照護的結果與開刀要等多久（2026-11-04，製作手冊第二十批 317，合併候選 819、817）。

- 急性照護：OECD Health Care Quality Indicators `DSD_HCQO@DF_AC,2.1`（OECD 資料條款）：
  - 住院後 30 天死亡率（每 100 次住院，45 歲以上，年齡與性別標準化，`STATISTICAL_OPERATION=OBS`）：缺血性腦中風 MORTISTI、
    急性心肌梗塞 MORTAMII、出血性腦中風 MORTHSTI。用 unlinked（只算同一次住院裡的死亡，約 40 國）；linked（串檔、含出院後）
    國家少，不混用。
  - 65 歲以上髖骨折在住院 2 天內開刀的比例（IHWTHIPS，每 100 位病人，年齡與性別標準化）。
- 開刀要等多久：OECD `DSD_HEALTH_PROC@DF_WAITING,1.2`：從專科醫師評估到手術的等待天數中位數（WAIT_MEDIAN、WTSP）；
  膝關節置換 CM8154、心臟繞道 CM361、子宮切除 CM683_687_689、經尿道前列腺切除 CM603_606。「還在排隊的人已經等多久」
  （WTPA）與平均值不混用。髖關節置換與白內障手冊排給別的主題，不做。
- 台灣：OECD 沒有，主題的 noValue 寫原因（前端）。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import oecd

OUT = OUT_DIR / "topics" / "hospital-quality"
AC = "OECD.ELS.HD,DSD_HCQO@DF_AC,2.1"
WAITING = "OECD.ELS.HD,DSD_HEALTH_PROC@DF_WAITING,1.2"
FIRST = 2005
WITHIN = 5
MORTALITY = {"ischaemic-stroke": "MORTISTI", "ami": "MORTAMII", "haemorrhagic-stroke": "MORTHSTI"}
WAITS = {"knee": "CM8154", "cabg": "CM361", "hysterectomy": "CM683_687_689", "prostatectomy": "CM603_606"}


def _write(name: str, unit: str, series: dict[str, dict[int, float]], digits: int) -> None:
    series = {c: {y: v for y, v in s.items() if y >= FIRST} for c, s in series.items()}
    series = {c: s for c, s in series.items() if s}
    last = max(y for s in series.values() for y in s)
    years = list(range(FIRST, last + 1))
    write_json(OUT / f"{name}.json", indicator_file(
        name, unit, years, {c: to_series(s, years, digits) for c, s in sorted(series.items())}, latestWithin=WITHIN))
    latest = sorted(((s[max(s)], c, max(s)) for c, s in series.items()), reverse=True)
    print(f"  {name}：{len(series)} 國；最高 {[(c, round(v, 1), y) for v, c, y in latest[:5]]}；最低 {[(c, round(v, 1), y) for v, c, y in latest[-4:]]}")


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for item, code in MORTALITY.items():
        s, _ = oecd.series(AC, MEASURE=code, SEX="_T", STATISTICAL_OPERATION="OBS", METHODOLOGY="AGE_SEX_STANDARD")
        _write(f"mortality-{item}", "每 100 次住院", s, 1)
    hip, _ = oecd.series(AC, MEASURE="IHWTHIPS", SEX="_T", STATISTICAL_OPERATION="OBS", METHODOLOGY="AGE_SEX_STANDARD")
    _write("hip-fracture", "%", hip, 1)
    for item, code in WAITS.items():
        s, _ = oecd.series(WAITING, MEASURE="WAIT_MEDIAN", MEDICAL_PROCEDURE=code, WAITING_TIME="WTSP", UNIT_MEASURE="D")
        _write(f"waiting-{item}", "天", s, 0)
    write_json(OUT / "manifest.json", {
        "topic": "hospital-quality", "generatedAt": now_iso(),
        "source": "OECD Health Care Quality Indicators (DF_AC) and Health Statistics waiting times (DF_WAITING)",
        "license": "OECD Terms and Conditions",
    })
