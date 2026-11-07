"""晶片的原料被誰扣住了：關鍵材料的出口管制（新主題，2026-11-07，製作手冊第二十七批 594，候選 1317；
步驟 chip-materials，輸出 topics/chip-materials/）。

- OECD Inventory of export restrictions on industrial raw materials（`OECD.TAD.ADM,DSD_QDD_TAD_EXP_RESTRIC@DF_QDD_TAD_EXP_RESTRIC,3.0`，
  sdmx.oecd.org，OECD 資料條款／CC BY 4.0），2009–2024，82 國。整個檔 488 MB（POLICY_DESCRIPTION 是長文字），
  手冊的陷阱是「485 種商品以廢鋼、熱帶木材為大宗」，所以用 SDMX 的 key 只抓晶片與電子相關的 HS2007 六位碼（約 15 MB）。
- 結構：一項措施 =（國家、HS 碼、措施類型 POLICY_TYPE、變更 POLICY_VARIATION），每年一組十幾列的描述
  （DATI 開始日期、END 結束日期、NOD 文件名稱、LINK 連結、VAL 稅率…）。這裡把「那一年有出現的措施」算一項，
  同一條規定套到好幾個 HS 碼會算好幾項（手冊的陷阱：筆數不等於嚴重程度），說明寫明。
- 指標：管制措施的項數（比例圓）、最嚴的措施類型（類別：出口禁令 > 出口配額 > 許可證 > 出口稅 > 其他）。
  側欄：這一國那一年的措施清單（材料、類型、開始日期）。
- 台灣：不在 82 國裡（灰色加 tooltip）。
"""
from __future__ import annotations

import csv
import re
from collections import defaultdict

from common import OUT_DIR, download, indicator_file, write_json
from sources.countries import to_iso3

OUT = OUT_DIR / "topics" / "chip-materials"
FLOW = "OECD.TAD.ADM,DSD_QDD_TAD_EXP_RESTRIC@DF_QDD_TAD_EXP_RESTRIC,3.0"
MATERIALS = {
    "minor-metals": ["811292", "811299", "282560"],  # 鎵、鍺、銦、鈮、錸、鉿、釩；氧化鍺
    "graphite": ["250410", "250490", "380110"],
    "silicon": ["280461", "280469"],
    "tungsten": ["261100", "810110", "810194"],
    "antimony": ["261710", "282580", "811010"],
    "cobalt": ["260500", "810520", "282200"],
    "rare-earths": ["280530", "284610", "284690"],
}
HS = {code: m for m, codes in MATERIALS.items() for code in codes}
# 最嚴的措施：出口禁令 M4 > 出口配額 M3 > 許可證 M6 > 出口稅（M1 出口稅、M2 附加稅、M5 財政性出口稅）> 其他
SEVERITY = {"M4": 5, "M3": 4, "M6": 3, "M1": 2, "M2": 2, "M5": 2}
NO_TW = ({"TWN": "OECD 的清冊沒有台灣"}, {"TWN": "Taiwan is not in the OECD inventory"})


def _rows() -> list[dict[str, str]]:
    key = "." + "+".join(f"HS07_{c}" for c in HS) + "..."
    url = f"https://sdmx.oecd.org/public/rest/data/{FLOW}/{key}?dimensionAtObservation=AllDimensions&format=csvfilewithlabels"
    path = download(url, "oecd", "exp_restric_chip_materials.csv")
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _date(text: str) -> tuple[int, int, int]:
    """「15/09/2024」→ (2024, 9, 15)；看不懂的排最後"""
    try:
        d, m, y = (int(x) for x in text.strip().split("/"))
        return (y, m, d)
    except ValueError:
        return (9999, 0, 0)


def _areas() -> list[str]:
    """清冊收了哪些國家（82 國）：沒有晶片材料措施的算 0，不是沒有資料"""
    url = f"https://sdmx.oecd.org/public/rest/availableconstraint/{FLOW}/all/all/REF_AREA"
    text = download(url, "oecd", "exp_restric_areas.xml").read_text(encoding="utf-8")
    block = text[text.find('id="REF_AREA"'):]
    return sorted({c for c in re.findall(r"<common:Value>([A-Z]{3})</common:Value>", block) if to_iso3(c)})


def build() -> None:
    areas = _areas()
    measures: dict[str, dict[int, dict[tuple, dict]]] = defaultdict(lambda: defaultdict(dict))
    for r in _rows():
        c = to_iso3(r["REF_AREA"])
        code = r["COMMODITY"].removeprefix("HS07_")
        if not c or code not in HS:
            continue
        key = (code, r["POLICY_TYPE"], r["POLICY_VARIATION"])
        m = measures[c][int(r["TIME_PERIOD"])].setdefault(key, {"material": HS[code], "type": r["POLICY_TYPE"], "label": r["Policy type"]})
        if r["POLICY_DESCRIPTION"] == "DATI":
            m["since"] = r["OBS_VALUE"]
    years = sorted({y for by in measures.values() for y in by})
    for c in areas:
        measures[c]  # 清冊裡沒有晶片材料措施的國家：每年 0 項
    counts = {c: [len(by.get(y, {})) for y in years] for c, by in sorted(measures.items())}
    strict = {c: [max((SEVERITY.get(m["type"], 1) for m in by[y].values()), default=0) if by.get(y) else 0 for y in years]
              for c, by in sorted(measures.items())}
    lic = "OECD 資料條款（CC BY 4.0）"
    write_json(OUT / "measures.json", indicator_file("chip-material-measures", "項", years, counts, noValue=NO_TW[0], noValueEn=NO_TW[1], license=lic))
    write_json(OUT / "strictest.json", indicator_file("chip-material-strictest", "類", years, strict, noValue=NO_TW[0], noValueEn=NO_TW[1], license=lic))
    def grouped(ms: dict) -> list[list]:
        """同一種材料、同一類措施併成一列：[材料, 類型, 幾項, 最早的開始日期]"""
        g: dict[tuple, list] = {}
        for m in ms.values():
            row = g.setdefault((m["material"], m["type"]), [m["material"], m["type"], 0, ""])
            row[2] += 1
            since = m.get("since", "")
            if since and (not row[3] or _date(since) < _date(row[3])):
                row[3] = since
        return sorted(g.values(), key=lambda x: (-SEVERITY.get(x[1], 1), x[0]))

    detail = {c: {str(y): grouped(by[y]) for y in by} for c, by in measures.items() if by}
    write_json(OUT / "detail.json", {"years": years, "materials": list(MATERIALS), "countries": detail, "license": lic})

    last = years[-1]
    v = sorted(((len(by.get(last, {})), c) for c, by in measures.items()), reverse=True)
    print(f"  清冊 {len(areas)} 國、有措施的 {sum(1 for by in measures.values() if by)} 國，{years[0]}–{last}；{last} 年措施最多：{v[:12]}")
    from collections import Counter
    print(f"  {last} 年最嚴的類型：{Counter(s[-1] for s in strict.values())}")
    print(f"  {last} 年有出口禁令的：{[c for c, v in strict.items() if v[-1] == 5]}；配額：{[c for c, v in strict.items() if v[-1] == 4]}")
    for c in ("CHN", "IND", "IDN", "RUS", "COD", "ZWE", "BDI"):
        if c in measures:
            ms = measures[c].get(last, {})
            print(f"  {c} {last}：{len(ms)} 項 {Counter((m['material'], m['type']) for m in ms.values()).most_common(8)}")
