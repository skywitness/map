"""CIA World Factbook 2022-12-29 的版本（factbook/factbook.json 的 commit 61dadec0，公有領域；鏡像的 LICENSE.md 是 CC0 1.0）。

之後的改版把交通一節的「National air transport system」（登記的航空公司家數、民航機隊架數…）與跑道長度的五級分類
（Airports - with paved／unpaved runways）整個刪掉（最新 commit 144d6977 已經沒有），所以製作手冊第二十三批 399（跑道）
與 400（機隊）沿用這一版，跟 topics/rail_gauge.py 補軌距用的是同一個 commit、同一個快取資料夾（.cache/factbook-2022-12-29/）。

FILES 是這一版裡有這幾欄的 238 個檔（2026-11-05 用部分 clone 找出來的；資料已經凍結，不會再變）。逐檔從
raw.githubusercontent.com 下載（codeload 的整包 zip 從這裡回 403）。
"""
from __future__ import annotations

import json
import re
import time

from common import CACHE_DIR, download
from sources.countries import from_alpha2
from sources.factbook import RAW, COMMIT, TLD_FIX

OLD_COMMIT = "61dadec0c9c9a38eb4c9665aa779977c47dd0481"
OLD_RAW = RAW.replace(COMMIT, OLD_COMMIT)
CACHE = "factbook-2022-12-29"
FILES = {
    "africa": "ag ao bc bn by cd cf cg cm cn ct cv dj eg ek er et ga gb gh gv iv ke li lt ly ma mi ml mo mp mr mz ng ni od pu rw se sf sg sh sl so su to tp ts tz ug uv wa wi wz za zi",
    "australia-oceania": "aq as bp ck cq cw fj fm fp gq kr kt nc ne nf nh nr nz ps rm tn tv um wf wq ws",
    "central-america-n-caribbean": "aa ac av bb bf bh cj cs cu do dr es gj gt ha ho jm mh nn nu pm rn rq sc st tb td tk uc vc vi vq",
    "central-asia": "kg kz rs ti tx uz",
    "east-n-southeast-asia": "bm bx cb ch hk id ja kn ks la mc mg my pf pg pp rp sn th tt tw vm",
    "europe": "al au ax be bk bo bu cy da ee ei en ez fi fo fr gi gk gm gr hr hu ic im it je jn kv lg lh lo lu md mj mk mt nl no pl po ri ro si sp sv sw sz uk up",
    "middle-east": "ae aj am ba gg gz ir is iz jo ku le mu qa sa sy tu we ym",
    "north-america": "bd ca gl mx sb us",
    "south-america": "ar bl br ci co ec fk gy ns pa pe uy ve",
    "south-asia": "af bg bt ce in io mv np pk",
}
# 網域對不上的（FIPS → ISO3；None 是不收）：俄羅斯有 .ru 與 .su、聖赫勒拿與荷屬聖馬丁的網域 pycountry 不認得、
# 法屬聖馬丁與聖巴瑟米的網域裡有 .fr，西岸與加薩共用 .ps（取西岸），其他是無人島、主權未定的島礁、英屬基地與歐盟
FIPS_FIX = {
    "rs": "RUS", "sh": "SHN", "nn": "SXM", "rn": "MAF", "tb": "BLM", "we": "PSE",
    "gz": None, "um": None, "wq": None, "pf": None, "pg": None, "ax": None, "ee": None, "jn": None,
}


def iso3(d: dict) -> str | None:
    tld_text = d.get("Communications", {}).get("Internet country code", {}).get("text", "")
    tlds = re.findall(r"\.([a-z]{2})\b", tld_text)
    tld = "fr" if "fr" in tlds else (tlds[0] if len(tlds) == 1 else None)
    return from_alpha2(TLD_FIX.get(tld, (tld or "").upper())) if tld else None


def transportation() -> dict[str, dict]:
    """{ISO3: 這一版「Transportation」一節的原始 dict}；對不到 ISO 代碼或共用代碼的屬地不收"""
    out: dict[str, dict] = {}
    for region, codes in FILES.items():
        for code in codes.split():
            name = f"{region}-{code}.json"
            cached = (CACHE_DIR / CACHE / name).exists()
            path = download(f"{OLD_RAW}/{region}/{code}.json", CACHE, name)
            if not cached:
                time.sleep(0.3)
            with open(path, encoding="utf-8") as f:
                d = json.load(f)
            iso = FIPS_FIX[code] if code in FIPS_FIX else iso3(d)
            if iso and iso not in out:
                out[iso] = d.get("Transportation", {})
    return out


def number(text: str | None) -> tuple[float | None, int | None]:
    """「1,234 (2021)」→ (1234.0, 2021)；年份沒寫是 None"""
    if not text:
        return None, None
    m = re.match(r"\s*([\d,]+(?:\.\d+)?)", text)
    y = re.search(r"\((\d{4})", text)
    return (float(m.group(1).replace(",", "")) if m else None), (int(y.group(1)) if y else None)
