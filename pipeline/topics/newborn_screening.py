"""新生兒篩檢（2026-11-03，製作手冊第十九批 288；醫藥分類的基因組）。

**資料**：Therrell 等 2024〈Current Status of Newborn Bloodspot Screening Worldwide 2024〉《International Journal of
Neonatal Screening》10(2):38（PMC11203842），Europe PMC 的全文 XML（不必登入）。授權：`<permissions>` 寫
「distributed under the terms and conditions of the Creative Commons Attribution (CC BY) license」（CC BY 4.0）。
**表**：美國（Table 4，各州）、加拿大（Table 5，各省）、亞太（6）、歐洲（7）、拉丁美洲與加勒比海（8）、中東與北非（9）、
撒哈拉以南非洲（10）。每張表一個國家（州、省）一列：開始篩檢的年份、篩檢實驗室數、採血時間與各種疾病的篩檢狀態。
**符號**（各表的說明不完全一樣，歸成四級）：
- 3：● 涵蓋一半以上、屬於國家（或行政區）的計畫或法規；加拿大的 †（用尿液篩檢，仍是全部人口）也算。
- 2：🞇 涵蓋不到一半、屬於國家的計畫或法規。
- 1：只在部分地方提供（試辦、跟特定醫院簽約）：亞太的 §、歐洲與拉丁美洲、中東北非、非洲的 †。
- 0：沒有；亞太的 ×（已停止）也算沒有。中東北非的 § 是「有全國的產前篩檢」，不是新生兒篩檢，不算。
**疾病**：五個地區的表共同的 30 種（`DISEASES`，論文的分組：其他、胺基酸、脂肪酸氧化、有機酸）；各表的「Other」
（其他疾病，依附註的編號）不算進疾病數，原文放在側欄。撒哈拉以南非洲的表只有 5 種，其他的當作沒有篩。
**篩檢的疾病數**：狀態 3 的疾病有幾種（台灣 28、新加坡 28、菲律賓 26、日本 19，跟論文的說法一致）。
**美國、加拿大**：各州（省）依出生數加權，篩這種病的州（省）出生數過半就算 3。美國的表把 28 種核心疾病（RUSP 的
Core DBS）併成一欄、次要疾病依類別各一欄，依 Table 1、2 的清單對到這裡的 30 種（`US_CORE`、`US_SECONDARY_FAO`）。
**台灣的歷年成果**（2026-11-03 補）：國健署「新生兒先天性代謝異常疾病篩檢歷年成果表」（`sources/hpa_newborn.py`，政府資料開放授權
條款第 1 版；使用者用瀏覽器下載、本機 session 放在 map-plan 的 data/hpa/）：1984–2024 年的篩檢率與 21 種疾病的異常個案數，
寫成 `taiwan.json` 給側欄，地圖上台灣的附註也寫最近一年。
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET

from common import OUT_DIR, download, indicator_file, now_iso, write_json
from sources import countries, hpa_newborn

OUT = OUT_DIR / "topics" / "newborn-screening"
XML = "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11203842/fullTextXML"
YEAR = 2024  # 論文的資料時間
FIRST_YEAR = 1960

# 30 種疾病：代碼、中文、英文、分組
DISEASES: list[tuple[str, str, str, str]] = [
    ("CH", "先天性甲狀腺低能症", "Congenital hypothyroidism", "misc"),
    ("CAH", "先天性腎上腺增生症", "Congenital adrenal hyperplasia", "misc"),
    ("GAL", "半乳糖血症", "Galactosaemia", "misc"),
    ("BIO", "生物素酶缺乏症", "Biotinidase deficiency", "misc"),
    ("HGB", "血紅素疾病（鐮刀型貧血等）", "Haemoglobin disorders (sickle cell and others)", "misc"),
    ("G6PD", "葡萄糖-6-磷酸去氫酶缺乏症（蠶豆症）", "G6PD deficiency", "misc"),
    ("SCID", "嚴重複合型免疫缺乏症", "Severe combined immunodeficiency", "misc"),
    ("SMA", "脊髓性肌肉萎縮症", "Spinal muscular atrophy", "misc"),
    ("CF", "囊性纖維化", "Cystic fibrosis", "misc"),
    ("PKU", "苯酮尿症", "Phenylketonuria", "aa"),
    ("MSUD", "楓糖尿症", "Maple syrup urine disease", "aa"),
    ("TYR-I", "第一型酪胺酸血症", "Tyrosinaemia type I", "aa"),
    ("ASA", "精胺基琥珀酸尿症", "Argininosuccinic aciduria", "aa"),
    ("CIT", "瓜胺酸血症", "Citrullinaemia", "aa"),
    ("HCY", "高胱胺酸尿症", "Homocystinuria", "aa"),
    ("CUD", "原發性肉鹼缺乏症", "Carnitine uptake defect", "fao"),
    ("CACT", "肉鹼-醯基肉鹼轉位酶缺乏症", "Carnitine-acylcarnitine translocase deficiency", "fao"),
    ("MCAD", "中鏈醯基輔酶 A 去氫酶缺乏症", "MCAD deficiency", "fao"),
    ("LCHAD", "長鏈 3-羥基醯基輔酶 A 去氫酶缺乏症（含三功能蛋白缺乏）", "LCHAD / trifunctional protein deficiency", "fao"),
    ("VLCAD", "極長鏈醯基輔酶 A 去氫酶缺乏症", "VLCAD deficiency", "fao"),
    ("SCAD", "短鏈醯基輔酶 A 去氫酶缺乏症", "SCAD deficiency", "fao"),
    ("CPT", "肉鹼棕櫚醯基轉移酶缺乏症（第一、二型）", "CPT I / CPT II deficiency", "fao"),
    ("IVA", "異戊酸血症", "Isovaleric acidaemia", "oa"),
    ("MMA", "甲基丙二酸血症", "Methylmalonic acidaemia", "oa"),
    ("PA", "丙酸血症", "Propionic acidaemia", "oa"),
    ("GA-I", "第一型戊二酸血症", "Glutaric acidaemia type I", "oa"),
    ("MCD", "多發性羧化酶缺乏症", "Multiple carboxylase deficiency", "oa"),
    ("BKT", "β-酮硫解酶缺乏症", "Beta-ketothiolase deficiency", "oa"),
    ("HMG", "3-羥基-3-甲基戊二酸尿症", "HMG-CoA lyase deficiency", "oa"),
    ("3-MCC", "3-甲基巴豆醯基輔酶 A 羧化酶缺乏症", "3-MCC deficiency", "oa"),
]
CODES = [d[0] for d in DISEASES]

# 美國：Core DBS 那一欄（Table 1 的核心疾病）對到的 30 種裡的疾病；次要的脂肪酸氧化疾病（Table 2）對到的
US_CORE = ["CH", "CAH", "GAL", "BIO", "HGB", "CF", "PKU", "MSUD", "TYR-I", "ASA", "CIT", "HCY", "CUD", "MCAD", "LCHAD",
           "VLCAD", "IVA", "MMA", "PA", "GA-I", "MCD", "BKT", "HMG", "3-MCC"]
US_SECONDARY_FAO = ["SCAD", "CPT", "CACT"]

# 表裡的國名 → ISO3（countries.from_name 查不到或查錯的）
NAMES = {
    "Korea (North)": "PRK", "Korea (South)": "KOR", "Lao, PDR": "LAO", "Hong Kong SAR, China": "HKG",
    "Macau SAR, China": "MAC", "Việt Nam": "VNM", "Brunei Darussalam": "BRN", "Türkiye": "TUR", "Kosovo": "XKX",
    "Russian Federation": "RUS", "Moldova, Republic of": "MDA", "Bosnia & Herzegovina": "BIH",
    "Bosnia and Herzegovina": "BIH", "Czech Republic": "CZE", "Slovak Republic": "SVK", "United Kingdom": "GBR",
    "Netherlands": "NLD", "Syrian Arab Republic": "SYR", "Iran": "IRN", "Iran (Islamic Republic of)": "IRN",
    "Palestine": "PSE", "State of Palestine": "PSE", "UAE": "ARE", "United Arab Emirates": "ARE",
    "Congo, Democratic Republic of": "COD", "Democratic Republic of Congo": "COD", "Congo, Republic of": "COG",
    "Republic of Congo": "COG", "Côte d’Ivoire": "CIV", "Cote d’Ivoire": "CIV", "Eswatini": "SWZ", "Tanzania": "TZA",
    "Cabo Verde": "CPV", "Gambia": "GMB", "The Gambia": "GMB", "Bolivia": "BOL", "Venezuela": "VEN",
    "Dominican Republic": "DOM", "Saint Kitts & Nevis": "KNA", "St. Kitts and Nevis": "KNA", "St. Lucia": "LCA",
    "St. Vincent and the Grenadines": "VCT", "Trinidad & Tobago": "TTO", "Antigua & Barbuda": "ATG",
    "Sao Tome & Principe": "STP", "São Tomé and Príncipe": "STP", "Micronesia": "FSM", "Turks & Caicos": "TCA",
    "Bosnia-Herzegovina": "BIH", "Sint Maarten": "SXM", "Egypt, Arab Republic": "EGY",
    "Congo, Democratic Republic": "COD", "Congo, Republic": "COG",
}


def _text(el: ET.Element) -> str:
    return " ".join("".join(el.itertext()).split())


def _rows(root: ET.Element, table: str) -> list[list[str]]:
    tw = next(t for t in root.iter("table-wrap") if t.get("id") == f"IJNS-10-00038-{table}")
    return [[_text(c) for c in tr if c.tag in ("td", "th")] for tr in tw.iter("tr")]


def _code(header: str) -> str | None:
    """表頭 → 疾病代碼（「d CH」「G6PDD」「CPT- I/CPT -II」「d MMA (MUT)/(CBL)」…）"""
    h = re.sub(r"^d\s+", "", header).strip()
    h = {"G6PDD": "G6PD", "LCHAD/TFP": "LCHAD", "MMA (MUT)/(CBL)": "MMA", "CPT- I/CPT -II": "CPT"}.get(h, h)
    return h if h in CODES else None


def _level(cell: str, table: str) -> int:
    if "●" in cell:
        return 3
    if "🞇" in cell:
        return 2
    if table == "t005" and "†" in cell:  # 加拿大：用尿液篩檢，全部人口
        return 3
    if "†" in cell or (table == "t006" and "§" in cell):
        return 1
    return 0


def _year(cell: str) -> int | None:
    m = re.search(r"(19[5-9]\d|20[0-2]\d)", cell)
    return int(m.group(1)) if m else None


def _iso3(name: str) -> str | None:
    name = re.sub(r"\s*\[.*?\]|\s*\(.*?\)$", "", name).strip()
    return NAMES.get(name) or countries.from_name(name)


def regional(root: ET.Element) -> dict[str, dict]:
    """五個地區的表：{ISO3: {s: [30 個等級], y: 開始年份, l: 實驗室數, t: 採血時間, o: Other 的編號, r: 地區}}"""
    out: dict[str, dict] = {}
    for table, region in (("t006", "ap"), ("t007", "eu"), ("t008", "latam"), ("t009", "mena"), ("t010", "ssa")):
        rows = _rows(root, table)
        hi = next(i for i, r in enumerate(rows) if r and r[0].startswith("Country"))
        head = rows[hi]
        cols = {i: _code(h) for i, h in enumerate(head) if _code(h)}
        year_col = next((i for i, h in enumerate(head) if "Date Screening" in h), None)
        lab_col = next((i for i, h in enumerate(head) if "Laboratories" in h), None)
        time_col = next((i for i, h in enumerate(head) if "Collection" in h), None)
        other_col = next((i for i, h in enumerate(head) if h.startswith("Other")), None)
        for row in rows[hi + 1:]:
            if len(row) < len(head) - 2 or not row[0] or row[0].startswith(("Total", "SSA Total", "Global Total", "Latin America", "Caribbean")):
                continue
            iso3 = _iso3(row[0])
            if not iso3:
                print(f"  {table} 對不到國家：{row[0]}")
                continue
            if any("No Information" in c or "No information" in c for c in row):
                out[iso3] = {"s": None, "y": None, "r": region}
                continue
            levels = {code: _level(row[i], table) for i, code in cols.items() if i < len(row)}
            out[iso3] = {
                "s": [levels.get(code, 0) for code in CODES],
                "y": _year(row[year_col]) if year_col is not None and year_col < len(row) else None,
                "l": row[lab_col] if lab_col is not None and lab_col < len(row) else "",
                "t": row[time_col] if time_col is not None and time_col < len(row) else "",
                "o": row[other_col] if other_col is not None and other_col < len(row) else "",
                "r": region,
            }
    return out


def _weighted(rows: list[list[str]], head: list[str], births_col: int, cols: dict[str, list[int]], table: str) -> list[int]:
    """各州（省）依出生數加權：篩這種病（3）的出生數過半算 3，有任何州（省）篩但不過半算 2"""
    total, done = 0.0, {code: 0.0 for code in CODES}
    for row in rows:
        try:
            births = float(row[births_col].replace(",", ""))
        except (ValueError, IndexError):
            continue
        total += births
        for code, idx in cols.items():
            if any(_level(row[i], table) == 3 for i in idx if i < len(row)):
                done[code] += births
    return [3 if done[c] > total / 2 else 2 if done[c] > 0 else 0 for c in CODES]


def north_america(root: ET.Element) -> dict[str, dict]:
    out = {}
    # 美國：州，排除屬地（Total 之後的列）
    rows = _rows(root, "t004")
    head = rows[2]
    states = []
    for row in rows[3:]:
        if row and row[0] == "Total":
            break
        if len(row) > 10:
            states.append(row)
    births = next(i for i, h in enumerate(head) if h.startswith("b Births"))
    col = {h: i for i, h in enumerate(head)}
    core = next(i for h, i in col.items() if "Core RUSP" in h)
    fao = next(i for h, i in col.items() if "Secondary FAO" in h)
    cols = {code: [core] for code in US_CORE} | {code: [fao] for code in US_SECONDARY_FAO}
    cols |= {"SCID": [col["SCID"]], "SMA": [col["SMA"]], "G6PD": [col["G6PD Deficiency"]]}
    years = [_year(r[3]) for r in states if _year(r[3])]
    out["USA"] = {"s": _weighted(states, head, births, cols, "t004"), "y": min(years), "l": "", "t": "", "o": "", "r": "na"}
    # 加拿大：省與領地（Totals 以前）
    rows = _rows(root, "t005")
    head = rows[2]
    provinces = [r for r in rows[3:] if len(r) > 10 and not r[0].startswith("Totals")]
    births = next(i for i, h in enumerate(head) if h.startswith("b Births"))
    cols = {}
    for i, h in enumerate(head):
        code = _code(h) or ("LCHAD" if h == "d TFP" else None)
        if code:
            cols.setdefault(code, []).append(i)
    years = [_year(r[3]) for r in provinces if _year(r[3])]
    out["CAN"] = {"s": _weighted(provinces, head, births, cols, "t005"), "y": min(years), "l": "", "t": "", "o": "", "r": "na"}
    return out


def taiwan() -> tuple[dict, dict[str, tuple[str, str]]]:
    """國健署的歷年成果 → 側欄的 taiwan.json 與地圖上台灣的附註（{指標: (中文, 英文)}）"""
    r = hpa_newborn.results()
    years, screened = r["years"], r["screened"]
    per_k = lambda cases: [None if c is None else round(c / s * 1000, 2) for c, s in zip(cases, screened)]
    diseases = []
    for i, (zh, code, en) in enumerate(r["diseases"]):
        cases = r["cases"][i]
        first = next(y for y, c in zip(years, cases) if c is not None)
        diseases.append({"zh": zh, "en": en, "code": code, "from": 1984 if i == 0 else first,
                         "latest": int(cases[-1]), "total": int(sum(c or 0 for c in cases))})
    out = {
        "years": years,
        "rate": [round(v, 2) for v in r["rate"]],
        "screened": [int(v) for v in screened],
        "g6pd": per_k(r["cases"][0]),
        "ch": per_k(r["cases"][1]),
        "total": [int(v) for v in r["total"]],
        "diseases": diseases,
    }
    y, n, rate = years[-1], int(screened[-1]), r["rate"][-1]
    g6pd, ch, total = int(r["cases"][0][-1]), int(r["cases"][1][-1]), int(r["total"][-1])
    over = next(year for year, v in zip(years, r["rate"]) if v >= 90)
    notes = {
        "diseases": (
            f"國健署的成果表：{y} 年篩檢 {n:,} 人（篩檢率 {rate:.1f}%），異常個案 {total:,} 例，最多的是蠶豆症 {g6pd:,} 例、"
            f"先天性甲狀腺低能症 {ch} 例。國健署的成果表列了 21 種（1984 年 5 種、2006 年 7 月加 6 種、2019 年 10 月加 10 種），"
            "跟論文的 30 種分法不同。側欄有 1984 年以來的歷年成果。",
            f"Health Promotion Administration figures: {n:,} newborns screened in {y} ({rate:.1f}% coverage), with {total:,} abnormal "
            f"cases, mostly G6PD deficiency ({g6pd:,}) and congenital hypothyroidism ({ch}). The administration’s table covers 21 "
            "conditions (5 from 1984, 6 more from July 2006 and 10 more from October 2019), grouped differently "
            "from the paper’s 30. The side panel shows results since 1984.",
        ),
        "start": (
            f"論文寫 1981 年開始；國健署的歷年成果表從 1984 年開始（篩檢率 {r['rate'][0]:.1f}%），{over} 年起超過九成。",
            f"The paper gives 1981; the Health Promotion Administration’s results start in 1984 ({r['rate'][0]:.1f}% coverage) "
            f"and exceed 90% from {over}.",
        ),
        "g6pd": (
            f"國健署的成果表：{y} 年篩出蠶豆症 {g6pd:,} 例，每千名篩檢 {g6pd / n * 1000:.1f} 例，是最常見的異常。",
            f"Health Promotion Administration figures: {g6pd:,} cases of G6PD deficiency in {y}, {g6pd / n * 1000:.1f} per 1,000 "
            "screened, the most common abnormal finding.",
        ),
    }
    return out, notes


def build() -> None:
    root = ET.parse(download(XML, "newborn-screening", "therrell-2024.xml")).getroot()
    tw, tw_notes = taiwan()
    write_json(OUT / "taiwan.json", tw)
    note = lambda key: {"notes": {"TWN": tw_notes[key][0]}, "notesEn": {"TWN": tw_notes[key][1]}}
    data = regional(root) | north_america(root)
    counts = {c: sum(1 for v in d["s"] if v == 3) for c, d in data.items() if d["s"] is not None}
    write_json(OUT / "diseases.json", indicator_file("diseases", "種", [YEAR], {c: [n] for c, n in sorted(counts.items())}, **note("diseases")))
    # 開始年份：每一年畫已經開辦的國家（值是開辦的年份，時間軸播放時一國一國亮起來）
    years = list(range(FIRST_YEAR, YEAR + 1))
    starts = {c: d["y"] for c, d in data.items() if d.get("y")}
    write_json(OUT / "start.json", indicator_file(
        "start", "年", years, {c: [y if t >= y else None for t in years] for c, y in sorted(starts.items())}, **note("start")))
    # 蠶豆症：G6PD 的等級（0–3）
    g = CODES.index("G6PD")
    write_json(OUT / "g6pd.json", indicator_file(
        "g6pd", "", [YEAR], {c: [d["s"][g]] for c, d in sorted(data.items()) if d["s"] is not None}, **note("g6pd")))
    # 側欄：每國 30 種疾病的等級（一個字一種）、開始年份、實驗室數、採血時間、Other 的編號
    write_json(OUT / "panel.json", {
        "diseases": [{"code": c, "zh": zh, "en": en, "group": grp} for c, zh, en, grp in DISEASES],
        "countries": {c: {k: ("".join(map(str, v)) if k == "s" and v is not None else v) for k, v in d.items() if v not in ("", None)}
                      for c, d in sorted(data.items())},
    })
    with_program = [c for c, n in counts.items() if n > 0]
    print(f"  {len(data)} 個國家與地區；至少篩一種（國家計畫、涵蓋過半）的 {len(with_program)} 個；開始年份 {len(starts)} 個")
    print(f"  台灣（國健署）：{tw['years'][0]}–{tw['years'][-1]} 年，{tw['years'][-1]} 年篩檢率 {tw['rate'][-1]}%、蠶豆症每千名 {tw['g6pd'][-1]}、"
          f"先天性甲狀腺低能症每千名 {tw['ch'][-1]}；21 種疾病累計 {sum(d['total'] for d in tw['diseases']):,} 例")
    for c in ("TWN", "SGP", "PHL", "JPN", "CHN", "USA", "CAN", "GBR", "DEU", "IND"):
        d = data.get(c)
        if d:
            print(f"  {c}：{counts.get(c)} 種，{d.get('y')} 年，G6PD {d['s'][g] if d['s'] else None}")

    write_json(OUT / "manifest.json", {
        "topic": "newborn-screening", "generatedAt": now_iso(),
        "source": "Therrell et al. 2024, International Journal of Neonatal Screening 10(2):38 (PMC11203842); "
                  "Health Promotion Administration, Taiwan, newborn screening results 1984–2024",
        "license": "CC BY 4.0; Open Government Data License, Taiwan 1.0",
    })

if __name__ == "__main__":
    build()
