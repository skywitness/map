"""FAO FishStat：全球漁業與養殖產量（Global production by production source，1950–2024 年，2026 年 3 月版）。

- 整包下載：https://www.fao.org/fishery/static/Data/GlobalProduction_2026.1.0.zip（不必登入，約 6 MB 的 zip，
  主表 Global_production_quantity.csv 約 56 MB、116 萬列），每年 3 月出新版（版本號的年份跟著改）。
- 授權：CC BY 4.0。zip 裡的 ReadMe.txt 與 FIproduction_E.html 寫明 FAO 統計資料庫的資料「are licensed under the
  Creative Commons Attribution-4.0 International licence (CC BY 4.0)」，另加 FAO Statistical Database Terms of Use
  （https://www.fao.org/contact-us/terms/db-terms-of-use/en ：不得用於推銷商業產品、不得暗示 FAO 背書、引用格式）。
  原本以為是 CC BY-NC-SA 3.0 IGO（FAO 出版品的授權），但資料庫本身是 CC BY 4.0（DESIGN.md 第 8 節第 12 點）。
- 引用（FAO 要求的格式）：FAO. 2026. FishStat: Global production by production source 1950-2024. [Accessed on
  26 October 2026]. In: FishStatJ. Available at www.fao.org/fishery/en/statistics/software/fishstatj. Licence: CC-BY-4.0.
- 只算「水生動物」（魚、甲殼類、軟體動物等，物種表的 Yearbook_Group「Aquatic animals」，FAO 年鑑與 SOFIA 報告的口徑）：
  不含藻類、水生哺乳類、鱷魚、珍珠與貝殼、珊瑚、海綿；單位都是活體重量（公噸，MEASURE = Q_tlw，貝類含殼）。
- 國家：COUNTRY.UN_CODE 用代碼表（CL_FI_COUNTRY_GROUPS.csv）的 ISO3_Code 換成 ISO alpha-3。FAO 的「China」（156）
  只有大陸，香港（344）、澳門（446）、「Taiwan Province of China」（158，就是台灣）各自一國，不會重複計算。
  桑吉巴（836，坦尚尼亞的一部分，FAO 分開列）併進坦尚尼亞；已經不存在的國家與「Other NEI」只算進世界合計。
- 捕撈（CAPTURE）算在漁船的船旗國，不論在哪裡捕到：台灣的遠洋漁船在三大洋捕的魚都算台灣。
"""
from __future__ import annotations

import csv
import io
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field

from common import download
from sources.countries import to_iso3

URL = "https://www.fao.org/fishery/static/Data/GlobalProduction_2026.1.0.zip"
INFO_URL = "https://www.fao.org/fishery/en/collection/global_production"
CITATION = (
    "FAO. 2026. FishStat: Global production by production source 1950-2024. [Accessed on 26 October 2026]. "
    "In: FishStatJ. Available at www.fao.org/fishery/en/statistics/software/fishstatj. Licence: CC-BY-4.0."
)
ANIMALS = "Aquatic animals"  # 物種表 Yearbook_Group_En 的開頭
CAPTURE = "CAPTURE"
# 併進別的國家的地區（FAO 代碼 → ISO）
MERGE = {"836": "TZA"}  # 桑吉巴
# 已經不存在、或不是單一國家的（只算進世界合計）；其他對不到 ISO 的代碼會報錯
HISTORICAL = {
    "200",  # 捷克斯洛伐克
    "230",  # 衣索比亞人民民主共和國
    "736",  # 2011 年以前的蘇丹
    "810",  # 蘇聯
    "890",  # 南斯拉夫
    "891",  # 塞爾維亞與蒙特內哥羅
    "530",  # 荷屬安地列斯
    "582",  # 太平洋群島託管地
    "896",  # Other NEI（其他未分國家的）
    "830",  # 海峽群島（FAO 合計根西與澤西）
}


@dataclass
class Production:
    years: list[int]
    # {iso3: {年: 公噸}}
    capture: dict[str, dict[int, float]] = field(default_factory=lambda: defaultdict(dict))
    aquaculture: dict[str, dict[int, float]] = field(default_factory=lambda: defaultdict(dict))
    # 世界合計（含已經不存在的國家）{年: 公噸}
    world_capture: dict[int, float] = field(default_factory=dict)
    world_aquaculture: dict[int, float] = field(default_factory=dict)
    # 最新一年的物種組（ISSCAAP 的英文名稱）：{('capture'|'aquaculture', iso3): {組: 公噸}}
    groups: dict[tuple[str, str], dict[str, float]] = field(default_factory=lambda: defaultdict(lambda: defaultdict(float)))
    # 最新一年捕撈在哪個 FAO 漁區：{iso3: {漁區代碼: 公噸}}
    areas: dict[str, dict[str, float]] = field(default_factory=lambda: defaultdict(lambda: defaultdict(float)))
    # 最新一年各物種（英文名稱）：{('capture'|'aquaculture', iso3): {物種: 公噸}}
    species: dict[tuple[str, str], dict[str, float]] = field(default_factory=lambda: defaultdict(lambda: defaultdict(float)))
    area_names: dict[str, str] = field(default_factory=dict)


def _rows(z: zipfile.ZipFile, name: str):
    with z.open(name) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig", newline=""))


def production() -> Production:
    path = download(URL, "fishstat", URL.rsplit("/", 1)[1])
    with zipfile.ZipFile(path) as z:
        codes: dict[str, str | None] = {}
        for r in _rows(z, "CL_FI_COUNTRY_GROUPS.csv"):
            code = r["UN_Code"]
            codes[code] = MERGE.get(code) or (None if code in HISTORICAL else to_iso3(r["ISO3_Code"]))
        species = {r["3A_Code"]: r for r in _rows(z, "CL_FI_SPECIES_GROUPS.csv")}
        area_names = {r["Code"]: r["Name_En"] for r in _rows(z, "CL_FI_WATERAREA_GROUPS.csv")}

        capture: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
        aquaculture: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
        world: dict[str, dict[int, float]] = {"capture": defaultdict(float), "aquaculture": defaultdict(float)}
        detail: list[tuple[str, str, int, str, str, str, float]] = []
        unknown: set[str] = set()
        years: set[int] = set()
        for r in _rows(z, "Global_production_quantity.csv"):
            sp = species.get(r["SPECIES.ALPHA_3_CODE"])
            if sp is None:
                raise RuntimeError(f"FishStat 的物種代碼 {r['SPECIES.ALPHA_3_CODE']} 不在物種表裡")
            if r["MEASURE"] != "Q_tlw" or not sp["Yearbook_Group_En"].startswith(ANIMALS):
                continue
            year = int(r["PERIOD"])
            years.add(year)
            value = float(r["VALUE"] or 0)
            source = "capture" if r["PRODUCTION_SOURCE_DET.CODE"] == CAPTURE else "aquaculture"
            world[source][year] += value
            code = r["COUNTRY.UN_CODE"]
            if code not in codes:
                raise RuntimeError(f"FishStat 的國家代碼 {code} 不在代碼表裡")
            iso = codes[code]
            if iso is None:
                if code not in HISTORICAL:
                    unknown.add(code)
                continue
            (capture if source == "capture" else aquaculture)[iso][year] += value
            detail.append((source, iso, year, sp["ISSCAAP_Group_En"], r["AREA.CODE"], sp["Name_En"], value))
        if unknown:
            raise RuntimeError(f"FishStat 有對不到 ISO 的國家代碼：{sorted(unknown)}（加進 HISTORICAL 或 MERGE）")

    last = max(years)
    out = Production(years=list(range(min(years), last + 1)), area_names=area_names)
    # 這個國家這一年有任何一筆（捕撈或養殖）就算有資料，另一種沒有列出的是 0（FAO 只列有產量的物種）
    for iso in set(capture) | set(aquaculture):
        present = set(capture.get(iso, {})) | set(aquaculture.get(iso, {}))
        for y in present:
            out.capture[iso][y] = capture.get(iso, {}).get(y, 0.0)
            out.aquaculture[iso][y] = aquaculture.get(iso, {}).get(y, 0.0)
    out.world_capture = dict(world["capture"])
    out.world_aquaculture = dict(world["aquaculture"])
    for source, iso, year, group, area, name, value in detail:
        if year != last or value <= 0:
            continue
        out.groups[(source, iso)][group] += value
        out.species[(source, iso)][name] += value
        if source == "capture":
            out.areas[iso][area] += value
    return out
