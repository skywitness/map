"""人均收入主題：IMF World Economic Outlook 為主（含台灣與未來推估），IMF 沒涵蓋的國家用世界銀行補。"""
from __future__ import annotations

from common import OUT_DIR, indicator_file, now_iso, to_series, write_json
from sources import imf, worldbank

FIRST_YEAR = 1980

# 輸出檔名 -> (IMF 代碼, IMF 單位換算倍數, World Bank 代碼, 單位, 小數位數)
INDICATORS = {
    "gdp-per-capita": ("NGDPDPC", 1, "NY.GDP.PCAP.CD", "美元", 0),
    "gdp-per-capita-ppp": ("PPPPC", 1, "NY.GDP.PCAP.PP.CD", "國際元", 0),
    "gdp": ("NGDPD", 1e9, "NY.GDP.MKTP.CD", "美元", 0),  # IMF 的 GDP 單位是十億美元
    "gdp-growth": ("NGDP_RPCH", 1, "NY.GDP.MKTP.KD.ZG", "%", 2),
}
WB_NOTE = "IMF 未涵蓋，改用世界銀行資料（沒有推估值）"


def build() -> None:
    release, projection_from = imf.weo_release()
    out = OUT_DIR / "topics" / "income"
    filled: set[str] = set()

    for key, (imf_code, imf_scale, wb_code, unit, digits) in INDICATORS.items():
        imf_data, imf_world = imf.fetch(imf_code)
        wb_data, wb_world = worldbank.fetch(wb_code, FIRST_YEAR)
        last_year = max(y for series in imf_data.values() for y in series)
        years = list(range(FIRST_YEAR, last_year + 1))

        def scaled(series: dict[int, float], factor: float) -> list:
            return to_series({y: v * factor for y, v in series.items()}, years, digits)

        values = {iso3: scaled(s, imf_scale) for iso3, s in imf_data.items()}
        notes: dict[str, str] = {}
        for iso3, series in wb_data.items():
            if iso3 not in values:
                values[iso3] = scaled(series, 1)
                notes[iso3] = WB_NOTE
                filled.add(iso3)
        world = scaled(imf_world, imf_scale) if imf_world else scaled(wb_world, 1)

        write_json(
            out / f"{key}.json",
            indicator_file(
                key, unit, years, values,
                projectionFrom=projection_from,
                aggregates={"WLD": world},
                notes=notes,
            ),
        )

    write_json(
        out / "manifest.json",
        {
            "topic": "income",
            "generatedAt": now_iso(),
            "source": f"IMF World Economic Outlook ({release}); World Bank WDI",
            "projectionFrom": projection_from,
            "filledFromWorldBank": sorted(filled),
        },
    )
    print(f"  WEO {release}，{len(filled)} 個國家用世界銀行補：{', '.join(sorted(filled))}")
