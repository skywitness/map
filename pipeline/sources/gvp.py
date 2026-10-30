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

WFS = (
    "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature"
    "&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json"
    "&propertyName=Volcano_Number,Volcano_Name,Primary_Volcano_Type,Last_Eruption_Year,Country,Elevation,"
    "Latitude,Longitude,Evidence_Category,Tectonic_Setting"
)
# 加了 Tectonic_Setting（2026-10-30，熱點火山）以後換一個快取檔名，舊的快取沒有這個欄位
CACHE = "holocene-volcanoes-tectonic.json"


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
        ))
    return sorted(out, key=lambda v: v.number)
