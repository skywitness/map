"""航運與港口的商船隊（2026-11-02，新27）：只跑 shipping 步驟的 merchant_fleet（UNCTADstat 的 US.MerchantFleet），輸出
fleet-flag.json 與依船種的 fleet-type/<船種>.json（船旗國船隊的圓餅）。shipping 整個重跑時會一起寫，不必再跑這一步；
這一步不下載港口、交通部航港局等其他來源。"""
from __future__ import annotations

from topics.shipping import merchant_fleet


def build() -> None:
    merchant_fleet()
