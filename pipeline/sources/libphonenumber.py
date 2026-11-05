"""Google libphonenumber 的 PhoneNumberMetadata.xml（Apache License 2.0，檔頭「Copyright (C) 2009 The Libphonenumber
Authors Licensed under the Apache License, Version 2.0」）：各國的國碼、國際冠碼、國內冠碼與各類號碼的長度。
GitHub raw 固定版本（TAG），不必登入。"""
from __future__ import annotations

import xml.etree.ElementTree as ET

from common import download

TAG = "v9.0.43"
URL = f"https://raw.githubusercontent.com/google/libphonenumber/{TAG}/resources/PhoneNumberMetadata.xml"


def territories() -> dict[str, ET.Element]:
    """alpha-2 → <territory>；001（非地理號碼）不收"""
    root = ET.parse(download(URL, "libphonenumber", f"PhoneNumberMetadata-{TAG}.xml")).getroot()
    return {t.get("id"): t for t in root.iter("territory") if t.get("id") != "001"}
