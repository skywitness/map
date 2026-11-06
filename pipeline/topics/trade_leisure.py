"""貿易：運動器材（HS 9506）、遊戲機與桌遊（HS 9504）的流向（2026-11-06，製作手冊第二十四批 413；步驟 trade-leisure）。

讀 BACI HS92 版（1995 年起，CEPII，Etalab 2.0）一次；電視遊戲機用 HS17 版（2017 年起，HS92 版的 950410 近年幾乎是 0），寫法跟其他商品一樣（trade_goods.build_some）。
- 運動器材 HS 9506 不含運動服（第 61、62 章）、運動鞋（第 64 章）與自行車（8712），不能說是「運動產業」；
  950691「健身與田徑器材」是跑步機、重訓器材、瑜珈墊都算在裡面的大雜項。
- 遊戲用品 HS 9504：電視遊戲機（HS 2007 起的 950450）、投幣式遊戲機、撲克牌（含寶可夢、
  遊戲王這類集換式卡牌）、桌遊與室內遊戲（撞球桌與用品 950420 也在 9504 裡）。數位下載的遊戲不在貿易統計裡，
  所以這是實體遊戲硬體與桌上遊戲的貿易，不是遊戲產業。荷蘭、新加坡、香港有大量轉口。
"""
from __future__ import annotations

from topics.trade_goods import build_some

GIDS = ["sports-goods", "fitness-equipment", "games", "video-game-consoles", "playing-cards"]


def build() -> None:
    build_some(GIDS)
