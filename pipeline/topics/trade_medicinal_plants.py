"""貿易的商品流向：只更新藥用植物（HS 1211，第二十批 307），不必重讀其他商品（topics/trade_goods.py 的 build_medicinal_plants）"""
from topics.trade_goods import build_medicinal_plants


def build() -> None:
    build_medicinal_plants()
