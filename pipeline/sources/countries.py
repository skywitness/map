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
