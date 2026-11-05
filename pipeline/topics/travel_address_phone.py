"""旅行實用：地址怎麼寫、電話怎麼打（2026-11-05，使用者把已排除的候選 679、680 改成要做，跟第二十二批 395 一起決定）。

- 679 地址：Google libaddressinput 的地址資料（sources/address_data.py，資料 CC BY 4.0）。
  - 地址順序：fmt 裡縣市（%S）或城市（%C）寫在街道（%A）前面的是「從大寫到小」（台灣、中國、日本、南韓…），
    其他是「從小寫到大」；沒有縣市、城市欄位的看郵遞區號（%Z）在不在街道前面。用當地語言的格式（fmt），不是拉丁字母版（lfmt）。
  - 郵遞區號：zipex 的第一個範例（一般的寫法），有英文字母的歸「含英文字母」，其他依位數（不算連字號與空格）；
    沒有 zip 的是沒有郵遞區號。有郵遞區號規則不等於普遍使用。台灣的範例還是 3 碼與 3+2 碼，中華郵政 2020 年 3 月起
    用 3+3 六碼，台灣照六碼畫，附註寫明。
- 680 電話：Google libphonenumber 的 PhoneNumberMetadata.xml（sources/libphonenumber.py，Apache 2.0）。
  - 國際冠碼：有 preferredInternationalPrefix 就用它（俄羅斯 8~10），internationalPrefix 是單一號碼就用它，
    是正規表示式（好幾家業者各有冠碼，台灣 002、005、006、007、009、019）就歸「好幾個」。
  - 國內長途冠碼：nationalPrefix（0、1、8、沒有）。
  - 手機號碼幾位數：mobile 的 possibleLengths national（不含國碼與國內冠碼），有好幾種長度的歸「不只一種」。
- `topics/travel.py` 的 build() 也會呼叫 `write()`；單獨跑時補進現有的 details.json（同 travel_units）。
"""
from __future__ import annotations

import json
import re

from common import OUT_DIR, indicator_file, write_json
from sources import address_data, libphonenumber

OUT = OUT_DIR / "topics" / "travel"
YEAR = 2026
CLDR_REGION = {"_SOL": "SO", "_IOT": "CX"}
# 類別（src/topics/travel.ts 的 ADDRESS_*、PHONE_*）
BIG_FIRST, SMALL_FIRST = 1, 2
ZIP_CLASSES = {"none": 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, "alpha": 7}
INTL = {"00": 1, "011": 2, "8~10": 3}
INTL_OTHER, INTL_MANY = 4, 5
NATIONAL = {"0": 1, "1": 2, "8": 3}
NATIONAL_NONE, NATIONAL_OTHER = 4, 5
MOBILE_MANY = 99
TAIWAN_NOTE = (
    "中華郵政 2020 年 3 月起用 3+3 六碼郵遞區號，這裡照六碼畫；Google 的地址資料還是 3 碼與 3+2 碼的範例。",
    "Chunghwa Post has used 3+3 six-digit postcodes since March 2020, as shown here; Google’s address data still gives "
    "3- and 3+2-digit examples.",
)


def address_order(fmt: str) -> int:
    pos = {k: fmt.find(k) for k in ("%A", "%C", "%S", "%Z")}
    street = pos["%A"]
    upper = [p for k, p in pos.items() if k in ("%C", "%S") and p >= 0]
    if street < 0:
        return SMALL_FIRST
    if upper:
        return BIG_FIRST if min(upper) < street else SMALL_FIRST
    return BIG_FIRST if 0 <= pos["%Z"] < street else SMALL_FIRST


def zip_class(data: dict) -> tuple[int, str | None]:
    if not data.get("zip"):
        return ZIP_CLASSES["none"], None
    examples = [e.strip() for e in (data.get("zipex") or "").split(",") if e.strip()]
    if not examples:
        return ZIP_CLASSES["none"], None
    first = examples[0]  # 第一個範例是一般的寫法（美國的 95014，不是 ZIP+4 的 22162-1010）
    if re.search(r"[A-Za-z]", first):
        return ZIP_CLASSES["alpha"], first
    digits = len(re.sub(r"\D", "", first))
    return ZIP_CLASSES.get(min(max(digits, 3), 7), ZIP_CLASSES[7]), first


def intl_prefix(t) -> tuple[int, str]:
    preferred = t.get("preferredInternationalPrefix")
    raw = t.get("internationalPrefix") or ""
    text = preferred or (raw if re.fullmatch(r"\d+", raw) else None)
    if text is None:
        return INTL_MANY, raw
    return INTL.get(text, INTL_OTHER), text


def national_prefix(t) -> tuple[int, str | None]:
    p = t.get("nationalPrefix")
    if not p:
        return NATIONAL_NONE, None
    return NATIONAL.get(p, NATIONAL_OTHER), p


def mobile_lengths(t) -> list[int]:
    m = t.find("mobile")
    pl = m.find("possibleLengths") if m is not None else None
    if pl is None:
        return []
    out: list[int] = []
    for part in (pl.get("national") or "").split(","):
        if m2 := re.fullmatch(r"\[(\d+)-(\d+)\]", part.strip()):
            out += list(range(int(m2.group(1)), int(m2.group(2)) + 1))
        elif part.strip().isdigit():
            out.append(int(part))
    return sorted(set(out))


def write(map_ids: set[str], countries: dict, details: dict[str, dict]) -> None:
    addr = address_data.countries()
    phones = libphonenumber.territories()
    files = {k: {} for k in ("address-order", "postcode", "phone-intl", "phone-national", "phone-mobile")}
    hints = {k: ({}, {}) for k in files}
    for iso3 in sorted(map_ids | {"TUV", "TKL", "GIB"}):
        region = CLDR_REGION.get(iso3) or countries.get(iso3, {}).get("iso2")
        if not region:
            continue
        d = details.setdefault(iso3, {})
        if region in addr:
            data = {**addr["ZZ"], **addr[region]}
            order = address_order(data["fmt"])
            zc, example = zip_class(data)
            files["address-order"][iso3] = [order]
            if iso3 == "TWN":
                zc, example = ZIP_CLASSES[6], None  # 中華郵政的 3+3 六碼（Google 的範例還是 104、10603），不自己編範例
            files["postcode"][iso3] = [zc]
            if example:
                hints["postcode"][0][iso3] = f"例：{example}"
                hints["postcode"][1][iso3] = f"e.g. {example}"
            d["addr"] = [order, example, zc]  # 地址順序、郵遞區號範例、郵遞區號類別
        if region in phones:
            t = phones[region]
            ic, itext = intl_prefix(t)
            nc, ntext = national_prefix(t)
            lengths = mobile_lengths(t)
            files["phone-intl"][iso3] = [ic]
            files["phone-national"][iso3] = [nc]
            if lengths:
                files["phone-mobile"][iso3] = [lengths[0] if len(lengths) == 1 else MOBILE_MANY]
                if len(lengths) > 1:
                    hints["phone-mobile"][0][iso3] = f"{lengths[0]}–{lengths[-1]} 碼"
                    hints["phone-mobile"][1][iso3] = f"{lengths[0]}–{lengths[-1]} digits"
            hints["phone-intl"][0][iso3] = f"國碼 +{t.get('countryCode')}" + (f"，冠碼 {itext}" if ic != INTL_MANY else "")
            hints["phone-intl"][1][iso3] = f"Country code +{t.get('countryCode')}" + (f", prefix {itext}" if ic != INTL_MANY else "")
            d["phone"] = [t.get("countryCode"), None if ic == INTL_MANY else itext, ntext, lengths]  # 國碼、國際冠碼（好幾個是 null）、國內冠碼、手機長度
    notes = {"postcode": ({"TWN": TAIWAN_NOTE[0]}, {"TWN": TAIWAN_NOTE[1]})}
    for key, values in files.items():
        extra = {}
        if hints[key][0]:
            extra |= {"hints": hints[key][0], "hintsEn": hints[key][1]}
        if key in notes:
            extra |= {"notes": notes[key][0], "notesEn": notes[key][1]}
        write_json(OUT / f"{key}.json", indicator_file(key, "", [YEAR], values, **extra), quiet=True)
        counts: dict[int, list[str]] = {}
        for c, (v,) in values.items():
            counts.setdefault(v, []).append(c)
        print(f"  {key}：{len(values)} 國；" + "；".join(f"{v}: {len(c)}" + (f" {c}" if len(c) < 14 else "") for v, c in sorted(counts.items())))
    print(f"  台灣：地址 {details['TWN'].get('addr')}；電話 {details['TWN'].get('phone')}")


def build() -> None:
    with open(OUT_DIR / "countries.json", encoding="utf-8") as f:
        countries = json.load(f)
    with open(OUT_DIR / "geo" / "countries-50m.json", encoding="utf-8") as f:
        map_ids = {g["id"] for g in json.load(f)["objects"]["countries"]["geometries"]}
    path = OUT / "details.json"
    with open(path, encoding="utf-8") as f:
        details = json.load(f)
    write(map_ids, countries, details)
    write_json(path, details)
