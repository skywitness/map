"""醫學影像與放射治療設備：台數與檢查次數（2026-11-04，製作手冊第二十批 315，合併候選 812、814）。

- 設備：OECD Health Statistics `DSD_HEALTH_REAC_HOSP@DF_MED_TECH,1.1`，每百萬人的台數（10P6HB），醫療院所合計（`_T`）；
  CT、MRI、PET、伽瑪攝影機（含 SPECT）、放射治療設備、乳房攝影儀。CT、MRI 的 0 是沒有回報（冰島的 CT），不畫；哥倫比亞的 MRI 台數明顯低報（每百萬人 0.2 台），台數與每台的次數都不畫；
  PET 的 0 是真的沒有（賽普勒斯、愛沙尼亞、冰島、盧森堡…小國），照畫。
- 檢查：OECD `DSD_HEALTH_PROC@DF_DIAG_EXAM,1.2`，每千人的檢查次數（EXM_10P3PS）與每台一年的檢查次數（EXM_SCN），
  醫療院所合計；CT、MRI、PET。0 是沒有回報，不畫；每台超過 40,000 次的是機器數低報（哥倫比亞 2018 年 MRI 75,817），不畫。
- 授權：OECD 資料條款（同長照、加護病床）。WHO 的醫療設備（GHO DEVICES08–22）只在 GHO，使用者 2026-11-04 決定不用。
- 台灣：OECD 沒有。衛福部《醫療機構現況及醫院醫療服務量統計年報》表 14「歷年醫療設備數」與表 15「歷年特定醫療儀器使用人次」
  （年底台數、全年人次，2004 年起；政府資料開放授權條款），只算醫院（不含診所與醫事放射所），除以 WPP 的年中人口。
  放射治療 = 高能遠距＋近接式，伽瑪攝影機用單光子斷層掃描儀（SPECT）；乳房攝影儀表上沒有。
"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import mohw, oecd, wpp

OUT = OUT_DIR / "topics" / "medical-imaging"
DEVICES = "OECD.ELS.HD,DSD_HEALTH_REAC_HOSP@DF_MED_TECH,1.1"
EXAMS = "OECD.ELS.HD,DSD_HEALTH_PROC@DF_DIAG_EXAM,1.2"
FIRST = 2000
WITHIN = 5
MAX_PER_SCANNER = 40_000
# 機器數明顯低報的（哥倫比亞的 MRI 每百萬人 0.2 台，每千人卻做 24 次檢查、每台 2 萬到 7 萬次）：台數與每台的次數都不畫
EXCLUDE = {("mri", "COL")}

# 子項目 → OECD 的代碼、台灣表 14／15 的欄位（None：台灣沒有）
TECH = {
    "ct": ("CT_SCAN", ["ct"]),
    "mri": ("MRI", ["mri"]),
    "pet": ("PET_SCAN", ["pet"]),
    "gamma": ("GAMMA", ["spect"]),
    "rt": ("RT", ["teletherapy", "brachytherapy"]),
    "mamm": ("MAMM", None),
}
EXAM_TECH = ["ct", "mri", "pet"]


def _span(series: dict[str, dict[int, float]]) -> list[int]:
    last = max(y for s in series.values() for y in s)
    return list(range(FIRST, last + 1))


def _write(name: str, unit: str, series: dict[str, dict[int, float]], digits: int, notes: dict, notes_en: dict) -> None:
    years = _span(series)
    values = {c: to_series(s, years, digits) for c, s in sorted(series.items()) if any(FIRST <= y for y in s)}
    write_json(OUT / f"{name}.json", indicator_file(name, unit, years, values, latestWithin=WITHIN, notes=notes, notesEn=notes_en))


def build() -> None:
    tw = mohw.medical_devices()
    last_tw = max(tw["devices"]["ct"])
    pop = wpp.demographic(["TPopulation1July"], last_year=last_tw)["TPopulation1July"]["TWN"]  # 千人
    OUT.mkdir(parents=True, exist_ok=True)
    summary = {}
    hosp_ct, _ = oecd.series(DEVICES, MEDICAL_TECH="CT_SCAN", UNIT_MEASURE="10P6HB", HEALTH_CARE_PROVIDER="HP1")
    for item, (code, tw_cols) in TECH.items():
        s, _ = oecd.series(DEVICES, MEDICAL_TECH=code, UNIT_MEASURE="10P6HB", HEALTH_CARE_PROVIDER="_T")
        if item in ("ct", "mri"):
            s = {c: {y: v for y, v in v_.items() if v > 0} for c, v_ in s.items()}
        s = {c: v for c, v in s.items() if (item, c) not in EXCLUDE}
        notes, notes_en = {}, {}
        if tw_cols:
            counts = {y: sum(tw["devices"][k].get(y, 0) for k in tw_cols) for y in tw["devices"][tw_cols[0]]}
            s["TWN"] = {y: n / pop[y] * 1000 for y, n in counts.items() if pop.get(y) and y >= FIRST}
            hosp = ", ".join(f"{n} {hosp_ct[c][max(hosp_ct[c])]:.1f}" for c, n in (("KOR", "南韓"), ("DEU", "德國"), ("FRA", "法國")) if c in hosp_ct)
            hosp_en = ", ".join(f"{n} {hosp_ct[c][max(hosp_ct[c])]:.1f}" for c, n in (("KOR", "South Korea"), ("DEU", "Germany"), ("FRA", "France")) if c in hosp_ct)
            notes["TWN"] = (f"OECD 沒有台灣；這是衛福部的醫院醫療設備統計（年底台數，只算醫院，不含診所與醫事放射所，所以偏低），除以年中人口。"
                            f"{last_tw} 年 {counts[last_tw]:,.0f} 台。"
                            + (f"OECD 國家只算醫院的 CT（每百萬人）：{hosp}。" if item == "ct" else "")
                            + ("放射治療是高能遠距加近接式放射治療設備。" if item == "rt" else "")
                            + ("台灣用單光子斷層掃描儀（SPECT）。" if item == "gamma" else ""))
            notes_en["TWN"] = (f"Taiwan is not in OECD data; this is the Ministry of Health and Welfare's count of equipment in hospitals (end of year; "
                               f"hospitals only, excluding clinics and imaging centres, so it is too low), divided by mid-year population. "
                               f"{last_tw}: {counts[last_tw]:,.0f} units."
                               + (f" Hospital-only CT in OECD countries (per million): {hosp_en}." if item == "ct" else "")
                               + (" Radiotherapy is teletherapy plus brachytherapy equipment." if item == "rt" else "")
                               + (" Taiwan's figure is SPECT scanners." if item == "gamma" else ""))
        _write(f"devices-{item}", "每百萬人", s, 1, notes, notes_en)
        summary[f"devices-{item}"] = s
    for item in EXAM_TECH:
        code = TECH[item][0]
        per1000, _ = oecd.series(EXAMS, HEALTH_FACILITY=code, UNIT_MEASURE="EXM_10P3PS", PROVIDER="_T")
        per_scanner, _ = oecd.series(EXAMS, HEALTH_FACILITY=code, UNIT_MEASURE="EXM_SCN", PROVIDER="_T")
        per1000 = {c: {y: v for y, v in s.items() if v > 0} for c, s in per1000.items()}
        dropped = sorted((c, y, round(v)) for c, s in per_scanner.items() for y, v in s.items() if v > MAX_PER_SCANNER)
        per_scanner = {c: {y: v for y, v in s.items() if 0 < v <= MAX_PER_SCANNER} for c, s in per_scanner.items() if (item, c) not in EXCLUDE}
        uses = tw["uses"][item]
        devices = tw["devices"][item]
        per1000["TWN"] = {y: n / pop[y] for y, n in uses.items() if pop.get(y) and y >= FIRST}
        per_scanner["TWN"] = {y: n / devices[y] for y, n in uses.items() if devices.get(y) and y >= FIRST}
        note = (f"OECD 沒有台灣；這是衛福部的醫院特定醫療儀器使用人次（只算醫院），{last_tw} 年 {uses[last_tw]:,.0f} 人次、"
                f"年底 {devices[last_tw]:,.0f} 台。")
        note_en = (f"Taiwan is not in OECD data; this is the Ministry of Health and Welfare's count of uses in hospitals (hospitals only): "
                   f"{uses[last_tw]:,.0f} in {last_tw}, with {devices[last_tw]:,.0f} units at year end.")
        _write(f"exams-{item}", "每千人", per1000, 1, {"TWN": note}, {"TWN": note_en})
        _write(f"per-scanner-{item}", "次", per_scanner, 0, {"TWN": note}, {"TWN": note_en})
        summary[f"exams-{item}"] = per1000
        summary[f"per-scanner-{item}"] = per_scanner
        if dropped:
            print(f"  {item} 每台超過 {MAX_PER_SCANNER:,} 次不畫：{dropped}")
    write_json(OUT / "manifest.json", {
        "topic": "medical-imaging", "generatedAt": now_iso(),
        "source": "OECD Health Statistics (DF_MED_TECH, DF_DIAG_EXAM); Ministry of Health and Welfare (Taiwan) tables 14 and 15; UN WPP 2024",
        "license": "OECD Terms and Conditions; Taiwan Open Government Data License 1.0",
    })
    for name, s in summary.items():
        latest = sorted(((v[max(v)], c, max(v)) for c, v in s.items() if v), reverse=True)
        tw_v = s.get("TWN", {})
        print(f"  {name}：{len(s)} 國；最高 {[(c, round(v, 1), y) for v, c, y in latest[:4]]}；最低 {[(c, round(v, 1), y) for v, c, y in latest[-3:]]}；"
              f"台灣 {round(tw_v[max(tw_v)], 1) if tw_v else None}")
