"""住宅與房價主題的平均每戶人數（topics/housing.py 的 build_household_size()），單獨更新用。

內政部不動產資訊平台（pip.moi.gov.tw）2026-10-30 從 cloud 回「Request Rejected」，整個 housing 步驟跑不完；
聯合國家戶資料庫換成 2026 版（製作手冊第八批 150）只動到這一項，所以分出這一步。
"""
from __future__ import annotations

from topics.housing import build_household_size as build  # noqa: F401
