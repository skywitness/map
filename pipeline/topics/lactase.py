"""乳糖不耐：成人能不能消化乳糖（2026-11-03，製作手冊第十九批 290；醫藥分類的基因組）。

**資料**：Itan 等 2010〈A worldwide correlation of lactase persistence phenotype and genotypes〉《BMC Evolutionary
Biology》10:36（PMC2834688）的附件 1（`1471-2148-10-36-S1.XLS`，Europe PMC 的 supplementaryFiles zip，不必登入）：
233 個調查點的洲、國家、族群或地點、經緯度、樣本數、能消化乳糖的比例（lactase persistence，表現型）、
檢測方法（BG 血糖、BH 呼氣氫氣、UG 尿液半乳糖、BIOPSY 小腸切片）與原始文獻。
**授權**：`<permissions>`：「This is an Open Access article distributed under the terms of the Creative Commons
Attribution License (http://creativecommons.org/licenses/by/2.0)」（CC BY 2.0）。Storhaug 等 2017（Lancet
Gastroenterology & Hepatology 的 89 國統合分析）Elsevier 只准文字探勘，不用。
**國家值**：國內各調查點依樣本數加權的平均；附註寫有幾個調查點、共幾人，只有一兩個點的標「樣本少」。
**族群名稱**：照原表的英文（地名、族群名混在一起，233 個不逐一翻譯），畫面上標不翻譯。
"""
from __future__ import annotations

import zipfile
from collections import defaultdict

import xlrd

import geoindex
from common import OUT_DIR, download, indicator_file, now_iso, points_file, write_json
from sources import countries

OUT = OUT_DIR / "topics" / "lactase"
ZIP = "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC2834688/supplementaryFiles"
SHEET = "1471-2148-10-36-S1.XLS"
YEAR = 2010  # 論文發表的年份（調查是 1960–2000 年代）
METHODS = {"BG": 1, "BH": 2, "UG": 3, "BIOPSY": 4}
NAMES = {
    "USA": "USA", "UK": "GBR", "ENGLAND": "GBR", "SCOTLAND": "GBR", "WALES": "GBR", "NORTHERN IRELAND": "GBR",
    "RUSSIA": "RUS", "SOUTH KOREA": "KOR", "KOREA": "KOR", "IRAN": "IRN", "TANZANIA": "TZA", "CONGO": "COD",
    "ZAIRE": "COD", "IVORY COAST": "CIV", "CZECHOSLOVAKIA": "CZE", "YUGOSLAVIA": "SRB", "SUDAN": "SDN",
    "VIETNAM": "VNM", "LAOS": "LAO", "SYRIA": "SYR", "GREENLAND": "GRL", "TAIWAN": "TWN",
}


def rows() -> list[dict]:
    z = zipfile.ZipFile(download(ZIP, "lactase", "itan-2010-supp.zip"))
    sheet = xlrd.open_workbook(file_contents=z.read(SHEET)).sheet_by_index(0)
    head = [str(h).strip().upper() for h in sheet.row_values(0)]
    col = {h.split(" (")[0]: i for i, h in enumerate(head) if h}
    out = []
    for r in range(1, sheet.nrows):
        v = sheet.row_values(r)
        name = str(v[col["COUNTRY"]]).strip()
        if not name:
            continue
        lon, lat = float(v[col["LONGITUDE"]]), float(v[col["LATITUDE"]])
        # 已經不存在的國家（FORMER CZECHOSLOVAKIA）依調查點的座標判斷
        iso3 = NAMES.get(name.upper()) or countries.from_name(name.title()) or geoindex.country_at(lon, lat)
        if not iso3:
            raise RuntimeError(f"對不到國家：{name}")
        method = str(v[col["TESTING METHOD"]]).strip().upper()
        out.append({
            "lon": lon, "lat": lat, "c": iso3,
            "p": str(v[col["POPULATION"]]).strip(), "n": int(float(v[col["N"]])),
            "f": float(v[col["FREQUENCY OF DIGESTORS"]]) * 100, "m": METHODS.get(method, 0),
            "r": str(v[col["REFERENCE"]]).strip(), "k": str(v[col["CONTINENT"]]).strip().title(),
        })
    return out


def build() -> None:
    points = rows()
    write_json(OUT / "surveys.json", points_file(
        sorted(points, key=lambda p: (p["c"], -p["n"])), ["lon", "lat", "c", "p", "n", "f", "m", "r"],
        {"lon": 0.01, "lat": 0.01, "n": 1, "f": 0.1, "m": 1}, strings=("c", "r")))
    by_country: dict[str, list[dict]] = defaultdict(list)
    for p in points:
        by_country[p["c"]].append(p)
    values, notes, notes_en = {}, {}, {}
    for c, ps in by_country.items():
        n = sum(p["n"] for p in ps)
        values[c] = [round(sum(p["f"] * p["n"] for p in ps) / n, 1)]
        few = len(ps) <= 2
        notes[c] = (f"{len(ps)} 個調查點、共 {n:,} 人的加權平均" + ("（樣本少，不一定代表全國）" if few else "")
                    + "；各點見地圖上的點與左側欄。")
        notes_en[c] = (f"Weighted average of {len(ps)} survey{'s' if len(ps) > 1 else ''} with {n:,} people in all"
                       + (" (few samples; may not represent the whole country)" if few else "")
                       + "; see the dots on the map and the list on the left.")
    write_json(OUT / "persistence.json", indicator_file(
        "persistence", "%", [YEAR], dict(sorted(values.items())), notes=notes, notesEn=notes_en))
    print(f"  {len(points)} 個調查點、{len(by_country)} 國，共 {sum(p['n'] for p in points):,} 人")
    for c in ("IRL", "DNK", "GBR", "DEU", "FIN", "KEN", "ESP", "SAU", "IND", "ITA", "TUR", "JPN", "NGA", "CHN", "TWN", "THA"):
        if c in values:
            print(f"  {c}：{values[c][0]}%（{len(by_country[c])} 點）")

    write_json(OUT / "manifest.json", {
        "topic": "lactase", "generatedAt": now_iso(),
        "source": "Itan et al. 2010, BMC Evolutionary Biology 10:36, additional file 1 (PMC2834688)", "license": "CC BY 2.0",
    })

if __name__ == "__main__":
    build()
