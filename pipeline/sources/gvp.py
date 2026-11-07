"""Smithsonian 全球火山計畫（GVP）的 Volcanoes of the World 全新世火山清單。

https://volcano.si.edu/ ，引用格式見 https://volcano.si.edu/gvp_votw.cfm（目前是 v. 5.3.x，
doi:10.5479/si.GVP.VOTW5-2025.5.3）。

- 授權：GVP 的使用條款（https://volcano.si.edu/gvp_termsofuse.cfm）寫明資料庫是美國政府雇員的職務作品，
  屬於 Smithsonian 條款「Intellectual Property Rights in Content」的第 (2) 類（從來不受著作權保護），
  另外 Smithsonian 網站的條款只允許個人、教育與其他非商業用途，要註明出處並連回網站。本站是非商業用途，
  頁尾註明「Global Volcanism Program, Smithsonian Institution」與資料庫的 DOI。
- volcano.si.edu 本身有機器人驗證（程式下載只拿到「Request verification」頁面），所以用 GVP 的 GeoServer WFS
  （webservices.volcano.si.edu，網站「Webservices」頁列的服務），只取需要的欄位，不含地質說明與照片
  （照片的著作權各自不同）。
"""
from __future__ import annotations

import json
from dataclasses import dataclass

from common import download

BASE = (
    "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature"
    "&outputFormat=application/json&typeName=GVP-VOTW:"
)
WFS = (
    BASE + "Smithsonian_VOTW_Holocene_Volcanoes&propertyName=Volcano_Number,Volcano_Name,Primary_Volcano_Type,"
    "Last_Eruption_Year,Country,Elevation,Latitude,Longitude,Evidence_Category,Tectonic_Setting,Major_Rock_Type"
)
# 加了 Tectonic_Setting（2026-10-30，熱點火山）、Major_Rock_Type（2026-11-07，製作手冊 538 的岩性）以後換快取檔名，
# 舊的快取沒有這些欄位
CACHE = "holocene-volcanoes-rock.json"
# 全新世的噴發（2026-11-07，製作手冊 538）：11,089 筆，確認的 9,916 筆
ERUPTIONS = (
    BASE + "Smithsonian_VOTW_Holocene_Eruptions&propertyName=Volcano_Number,Eruption_Number,Activity_Type,"
    "ExplosivityIndexMax,ExplosivityIndexModifier,StartDateYear,StartDateYearModifier,StartDateMonth,StartDateDay,EndDateYear"
)
# 更新世的火山（2026-11-07，製作手冊 538）：全新世以前噴發、現在不算活火山，1,452 座
PLEISTOCENE = (
    BASE + "Smithsonian_VOTW_Pleistocene_Volcanoes&propertyName=Volcano_Number,Volcano_Name,Primary_Volcano_Type,"
    "Country,Latitude,Longitude,Elevation,Geologic_Epoch"
)


@dataclass
class Volcano:
    number: int
    name: str
    type: str  # 英文的主要火山類型，去掉單複數標記：Stratovolcano(es) → Stratovolcano
    last_eruption: int | None  # 最近一次噴發的年份，負數是西元前；不知道的是 None
    country: str  # GVP 的國名，例如 Japan、Chile-Argentina、Undersea Features
    elevation: int | None  # 公尺，海底火山是負數
    lon: float
    lat: float
    evidence: str
    tectonic: str  # 構造環境，例如「Intraplate / Oceanic crust (< 15 km)」；GVP 沒寫的是空字串
    rock: str = ""  # 主要岩性，例如「Andesite / Basaltic Andesite」；沒有資料（含 No Data (checked)）是空字串


def _type(raw: str | None) -> str:
    t = (raw or "").replace("(es)", "").replace("(s)", "").rstrip("?").strip()
    return {"Shield(pyroclastic)": "Pyroclastic shield"}.get(t, t)


def holocene_volcanoes() -> list[Volcano]:
    with open(download(WFS, "gvp", CACHE), encoding="utf-8") as f:
        features = json.load(f)["features"]
    out = []
    for feature in features:
        p = feature["properties"]
        if p.get("Latitude") is None or p.get("Longitude") is None:
            continue
        out.append(Volcano(
            number=p["Volcano_Number"], name=p["Volcano_Name"].strip(), type=_type(p.get("Primary_Volcano_Type")),
            last_eruption=p.get("Last_Eruption_Year"), country=(p.get("Country") or "").strip(),
            elevation=p.get("Elevation"), lon=float(p["Longitude"]), lat=float(p["Latitude"]),
            evidence=p.get("Evidence_Category") or "", tectonic=(p.get("Tectonic_Setting") or "").strip(),
            rock=_rock(p.get("Major_Rock_Type")),
        ))
    return sorted(out, key=lambda v: v.number)


# 主要岩性 → 代碼（點圖層存數字，前端 earthquakes.ts 的 VOLCANO_ROCKS 對中英文名稱）
ROCK_CODES = {
    "Andesite / Basaltic Andesite": 1,
    "Basalt / Picro-Basalt": 2,
    "Dacite": 3,
    "Trachybasalt / Tephrite Basanite": 4,
    "Rhyolite": 5,
    "Trachyte / Trachydacite": 6,
    "Trachyandesite / Basaltic Trachyandesite": 7,
    "Foidite": 8,
    "Phonolite": 9,
    "Phono-tephrite / Tephri-phonolite": 10,
}


def _rock(raw: str | None) -> str:
    t = " ".join((raw or "").split())
    return "" if not t or t.startswith("No Data") else t


@dataclass
class Eruption:
    volcano: int
    number: int
    confirmed: bool  # Activity_Type 是 Confirmed Eruption（另一種是 Uncertain Eruption）
    vei: int | None  # 火山爆發指數 0–8，沒有估的是 None
    year: int | None  # 開始的年份，負數是西元前


def holocene_eruptions() -> list[Eruption]:
    with open(download(ERUPTIONS, "gvp", "holocene-eruptions.json"), encoding="utf-8") as f:
        features = json.load(f)["features"]
    out = []
    for feature in features:
        p = feature["properties"]
        activity = (p.get("Activity_Type") or "").strip()
        if activity not in ("Confirmed Eruption", "Uncertain Eruption"):
            raise ValueError(f"GVP 的噴發類型認不得：{activity}")
        out.append(Eruption(
            volcano=p["Volcano_Number"], number=p["Eruption_Number"], confirmed=activity == "Confirmed Eruption",
            vei=p.get("ExplosivityIndexMax"), year=p.get("StartDateYear"),
        ))
    return out


def pleistocene_volcanoes() -> list[Volcano]:
    """更新世的火山：欄位跟全新世的一樣，但沒有最近一次噴發、證據類型、構造環境與岩性"""
    with open(download(PLEISTOCENE, "gvp", "pleistocene-volcanoes.json"), encoding="utf-8") as f:
        features = json.load(f)["features"]
    out = []
    for feature in features:
        p = feature["properties"]
        if p.get("Latitude") is None or p.get("Longitude") is None:
            continue
        out.append(Volcano(
            number=p["Volcano_Number"], name=p["Volcano_Name"].strip(), type=_type(p.get("Primary_Volcano_Type")),
            last_eruption=None, country=(p.get("Country") or "").strip(), elevation=p.get("Elevation"),
            lon=float(p["Longitude"]), lat=float(p["Latitude"]), evidence="", tectonic="",
        ))
    return sorted(out, key=lambda v: v.number)
