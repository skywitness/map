"""此刻世界的新聞熱點（新主題，國際類，2026-10-29，製作手冊第五批 67）：GDELT 2.0 的事件，瀏覽器每 15 分鐘直接讀。

使用者 2026-10-29 決定：瀏覽器每 15 分鐘讀 GDELT 最新的檔；事件類型的中文分類自己定；滑過事件顯示原始新聞的連結。

GDELT 的國家代碼是 FIPS 10-4（CH 是中國、UK 英國、SF 南非、RS 俄羅斯），這一步只輸出 FIPS → ISO alpha-3 的對照表
（fips.json），用 GeoNames 的 countryInfo.txt（CC BY 4.0）的 fips 欄；GDELT 跟 GeoNames 不同的在 FIPS_FIX 補
（RB 塞爾維亞、GZ 加薩走廊）。事件本身不經過 pipeline。
"""
from __future__ import annotations

from common import OUT_DIR, download, now_iso, write_json

OUT = OUT_DIR / "topics" / "news"
URL = "https://download.geonames.org/export/dump/countryInfo.txt"
# GDELT 用、GeoNames 沒有（或不同）的 FIPS 代碼
FIPS_FIX = {"RB": "SRB", "GZ": "PSE"}


def build() -> None:
    path = download(URL, "geonames", "countryInfo.txt")
    table: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("#") or not line.strip():
            continue
        f = line.split("\t")
        iso3, fips = f[1], f[3]
        if fips and iso3:
            table[fips] = iso3
    for fips, iso3 in FIPS_FIX.items():
        table.setdefault(fips, iso3)
    for fips, iso3 in {"TW": "TWN", "CH": "CHN", "UK": "GBR", "SF": "ZAF", "RS": "RUS", "NI": "NGA", "KV": "XKX"}.items():
        if table.get(fips) != iso3:
            raise RuntimeError(f"FIPS {fips} 對到 {table.get(fips)}，應該是 {iso3}")
    OUT.mkdir(parents=True, exist_ok=True)
    write_json(OUT / "fips.json", {"fips": dict(sorted(table.items())), "license": "CC BY 4.0 (GeoNames)"})
    write_json(OUT / "manifest.json", {"topic": "news", "generatedAt": now_iso(),
                                       "sources": [f"{URL} (GeoNames, CC BY 4.0)"]})
    print(f"  FIPS → ISO：{len(table)} 個")


if __name__ == "__main__":
    build()
