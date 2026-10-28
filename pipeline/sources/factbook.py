"""CIA World Factbook：原油、天然氣的探明蘊藏量（2021 年估計）。

- CIA 的官網在 2026 年 2 月撤掉 Factbook（原本的著作權頁現在轉到告別文
  https://www.cia.gov/stories/story/spotlighting-the-world-factbook-as-we-bid-a-fond-farewell/ ），不會再更新。
  這裡用 GitHub 上每週同步的鏡像 factbook/factbook.json，固定在停刊後最後一次的 commit（2026-09-11），
  從 raw.githubusercontent.com 逐檔下載（不必登入）。資料已經凍結，只下載有蘊藏量的 100 個檔（FILES，
  2026-10-28 從整個版本庫找出來的：255 個國家與地區裡原油、天然氣各 99 個有值，加上世界合計 world/xx）。
- 授權：Factbook 是美國政府的出版品，公有領域；鏡像的 README 寫「offers free country profiles in the public domain
  (that is, no copyright(s), no rights reserved, no license)」，LICENSE.md 是 CC0 1.0。
- 檔名是 FIPS 10-4 代碼（`ng` 是尼日、`ni` 才是奈及利亞，`ch` 是中國），不是 ISO；改用每個檔的
  「Internet country code」（國碼頂級網域，大多就是 ISO alpha-2；`.uk` 是 GB，法國列了海外省，取 `.fr`）。
- 數字是文字，單位會變（「258.6 billion barrels (2021 est.)」「2.38 million barrels」「9.423 trillion cubic meters」），
  依單位換算；只有 99 個國家與地區有值，沒有欄位不等於 0。
"""
from __future__ import annotations

import json
import re

from common import download
from sources.countries import from_alpha2

COMMIT = "144d6977b2b01ac1cbd220de754c0a005616760b"  # 2026-09-11
RAW = f"https://raw.githubusercontent.com/factbook/factbook.json/{COMMIT}"
REPO = "https://github.com/factbook/factbook.json"
TLD_FIX = {"uk": "GB"}
MULTIPLIER = {"": 1.0, "thousand": 1e3, "million": 1e6, "billion": 1e9, "trillion": 1e12}
# 區域資料夾 → FIPS 代碼
FILES = {
    "africa": "ag ao bn cd cf cg cm eg ek et gb gh iv ly mo mr mz ng ni od rw sf so su ts tz ug wa",
    "australia-oceania": "as nz",
    "central-america-n-caribbean": "bb bh cu gt td",
    "central-asia": "aj gg kg kz rs ti tx uz",
    "east-n-southeast-asia": "bm bx ch id ja ks my pp rp th tw vm",
    "europe": "al au bo bu da ei ez fr gm gr hr hu it lh lo nl no pl ri ro sp uk up",
    "middle-east": "ae ba ir is iz jo ku mu qa sa sy tu ym",
    "north-america": "ca mx us",
    "south-america": "ar bl br ci co ec ns pe ve",
    "south-asia": "af bg in pk",
    "world": "xx",
}
_NUMBER = re.compile(r"^([\d,.]+)\s*(thousand|million|billion|trillion)?\s*(barrels|cubic meters)\s*\((\d{4}) est\.\)")


def _parse(text: str, unit: str) -> tuple[float, int]:
    """「258.6 billion barrels (2021 est.)」→ (258.6e9, 2021)；單位不對或解析不了就報錯。"""
    m = _NUMBER.match(text.strip())
    if not m or m.group(3) != unit:
        raise ValueError(f"Factbook 的數字解析不了：{text!r}")
    return float(m.group(1).replace(",", "")) * MULTIPLIER[m.group(2) or ""], int(m.group(4))


def reserves() -> dict[str, dict[str, tuple[float, int]]]:
    """回傳 {'oil': {iso3: (桶, 年)}, 'gas': {iso3: (立方公尺, 年)}}，世界合計的 key 是 'WLD'。"""
    out: dict[str, dict[str, tuple[float, int]]] = {"oil": {}, "gas": {}}
    for region, codes in FILES.items():
        for code in codes.split():
            path = download(f"{RAW}/{region}/{code}.json", "factbook", f"{region}-{code}.json")
            with open(path, encoding="utf-8") as f:
                d = json.load(f)
            energy = d.get("Energy", {})
            oil = energy.get("Petroleum", {}).get("crude oil estimated reserves", {}).get("text")
            gas = energy.get("Natural gas", {}).get("proven reserves", {}).get("text")
            if not oil and not gas:
                raise ValueError(f"Factbook 的 {region}/{code} 沒有蘊藏量")
            if region == "world":
                iso = "WLD"
            else:
                tld_text = d.get("Communications", {}).get("Internet country code", {}).get("text", "")
                tlds = re.findall(r"\.([a-z]{2})\b", tld_text)
                tld = "fr" if "fr" in tlds else (tlds[0] if len(tlds) == 1 else None)
                iso = from_alpha2(TLD_FIX.get(tld, (tld or "").upper())) if tld else None
                if not iso:
                    raise ValueError(f"Factbook 的 {region}/{code} 對不到 ISO 代碼（{tld_text!r}）")
            if oil:
                out["oil"][iso] = _parse(oil, "barrels")
            if gas:
                out["gas"][iso] = _parse(gas, "cubic meters")
    return out
