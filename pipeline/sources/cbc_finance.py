"""中央銀行 金融統計（https://cpx.cbc.gov.tw/，政府資料開放授權條款）：台灣的存款餘額。

EF03Y01「重要金融指標（續）」的「貨幣機構存款」，年資料、期底（年底）餘額，新台幣億元，1987 年起。
貨幣機構是本國銀行、外國及大陸地區銀行在台分行、信用合作社、農會與漁會信用部、中華郵政，
跟 IMF FAS 的「商業銀行＋信用合作社＋其他收受存款機構」大致相同。欄位：
- 企業及個人存款：活期性存款、定期及定期儲蓄存款、外匯存款
- 郵政儲金、外國人新台幣存款、附買回交易餘額及貨幣市場共同基金、政府存款

FAS 只算國內家庭與非金融企業的存款，所以取「企業及個人」三項加郵政儲金，不含政府存款、外國人的存款、
附買回與貨幣市場基金。「企業及個人」也含保險公司等非貨幣金融機構，這部分分不出來。
JSON 格式同國際收支（`sources/cbc.py`）：欄名在 data.structure.Table1（項目）與 Table2（期底餘額、年增率），
每列第一格是年，之後依「項目 × 量測」的順序排列。
"""
from __future__ import annotations

import json

from common import download

URL = "https://cpx.cbc.gov.tw/API/DataAPI/Get?FileName=EF03Y01"
PRIVATE = [
    "貨幣機構存款-企業及個人存款-活期性存款",
    "貨幣機構存款-企業及個人存款-定期及定期儲蓄存款",
    "貨幣機構存款-企業及個人存款-外匯存款",
    "貨幣機構存款-郵政儲金",
]
TOTAL = "貨幣機構存款-合計"


def deposits() -> tuple[dict[int, float], dict[int, float]]:
    """(企業及個人存款加郵政儲金, 貨幣機構存款合計)，{西元年: 年底餘額（新台幣元）}。"""
    path = download(URL, "cbc", "EF03Y01.json")
    with open(path, encoding="utf-8-sig") as f:
        data = json.load(f)["data"]
    items = [c["data"] for c in data["structure"]["Table1"]]
    measures = [c["data"] for c in data["structure"]["Table2"]]
    missing = [c for c in PRIVATE + [TOTAL] if c not in items]
    if missing or "期底餘額" not in measures:
        raise RuntimeError(f"中央銀行 EF03Y01 的欄位變了：{missing or measures}")

    def column(item: str) -> int:
        return 1 + items.index(item) * len(measures) + measures.index("期底餘額")

    private: dict[int, float] = {}
    total: dict[int, float] = {}
    for row in data["dataSets"]:
        try:
            year = int(row[0])
            private[year] = sum(float(row[column(c)]) for c in PRIVATE) * 1e8
            total[year] = float(row[column(TOTAL)]) * 1e8
        except ValueError:  # 「-」：無數值
            continue
    return private, total
