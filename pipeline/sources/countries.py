"""把各資料來源的國家代碼統一成 ISO alpha-3。"""
from __future__ import annotations

import pycountry

# 各機構自訂、或非 ISO 的代碼
ALIASES = {
    "UVK": "XKX",  # IMF：科索沃
    "KOS": "XKX",
    "WBG": "PSE",  # IMF：約旦河西岸與加薩
}

ISO3 = {c.alpha_3 for c in pycountry.countries} | {"XKX"}


def to_iso3(code: str | None) -> str | None:
    """回傳 ISO alpha-3；區域合計、無法辨識的代碼回傳 None。"""
    if not code:
        return None
    code = ALIASES.get(code.strip().upper(), code.strip().upper())
    return code if code in ISO3 else None


def from_numeric(m49: str | int | None) -> str | None:
    """UN M49 / ISO 數字代碼 → alpha-3（M49 的國家代碼與 ISO 數字代碼相同）。"""
    if m49 is None or str(m49).strip().lstrip("'") == "":
        return None
    country = pycountry.countries.get(numeric=str(int(str(m49).strip().lstrip("'"))).zfill(3))
    return country.alpha_3 if country else None


# 各資料來源常見、但 pycountry 查不到或會查錯的英文國名
NAME_ALIASES = {
    "United States of America": "USA", "United States": "USA", "US": "USA",
    "United Kingdom": "GBR", "UK": "GBR",
    "South Korea": "KOR", "Korea": "KOR", "North Korea": "PRK",
    "Russia": "RUS", "Taiwan": "TWN", "Hong Kong": "HKG", "Macau": "MAC", "Macao": "MAC",
    "Vietnam": "VNM", "Iran": "IRN", "Syria": "SYR", "Laos": "LAO", "Brunei": "BRN",
    "Turkey": "TUR", "Türkiye": "TUR", "Czech Republic": "CZE", "Czechia": "CZE",
    "Congo (DRC)": "COD", "DR Congo": "COD", "Democratic Republic of the Congo": "COD", "Congo": "COG",
    "Cote D'Ivoire": "CIV", "Côte d'Ivoire": "CIV", "Ivory Coast": "CIV",
    "Bolivia": "BOL", "Venezuela": "VEN", "Tanzania": "TZA", "Moldova": "MDA",
    "Palestine": "PSE", "Palestinian Territories": "PSE", "Kosovo": "XKX",
    "Micronesia": "FSM", "Cape Verde": "CPV", "Cabo Verde": "CPV", "Eswatini": "SWZ", "Swaziland": "SWZ",
    "UAE": "ARE", "Philippines (the)": "PHL", "Netherlands (the)": "NLD", "Bahamas": "BHS", "Gambia": "GMB",
    "North Macedonia": "MKD", "Macedonia": "MKD", "Burma": "MMR", "Myanmar": "MMR", "Timor-Leste": "TLS",
    "Saint Kitts and Nevis": "KNA", "Saint Lucia": "LCA", "Saint Vincent and the Grenadines": "VCT",
    "Sao Tome and Principe": "STP", "Curacao": "CUW", "Curaçao": "CUW", "Reunion": "REU",
}


def from_name(name: str) -> str | None:
    """英文國名 → ISO alpha-3；查不到回傳 None。模糊比對只在名稱夠長時使用，避免誤配。"""
    name = name.strip()
    if not name:
        return None
    if name in NAME_ALIASES:
        return NAME_ALIASES[name]
    try:
        return pycountry.countries.lookup(name).alpha_3
    except LookupError:
        pass
    if len(name) >= 6:
        try:
            matches = pycountry.countries.search_fuzzy(name)
            if len(matches) == 1:
                return matches[0].alpha_3
        except LookupError:
            pass
    return None
