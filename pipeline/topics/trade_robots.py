"""貿易：工業機器人（HS 847950）的流向（2026-11-05，製作手冊第二十二批 386；步驟 trade-robots）。

只讀 BACI HS17 版（2017–2024 年，CEPII，Etalab 2.0），寫法跟其他商品一樣（trade_goods.build_one）。
HS 847950 是「其他未列名的工業機器人」：焊接（8515）、噴塗（8424）、搬運（8428）、晶圓搬運（8486）的機器人
報在各自用途的稅號，所以這是下限不是全部；金額不是台數。
"""
from __future__ import annotations

from topics.trade_goods import build_one


def build() -> None:
    build_one("industrial-robots")
