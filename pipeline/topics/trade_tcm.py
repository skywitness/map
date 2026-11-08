"""貿易的商品流向：中藥材散在的其他章節（第二十九批 693，候選 1588–1591）：植物萃取物、製藥用動物原料、燕窩所在的 HS 0410、
角與鹿茸（topics/trade_goods.py 的 build_tcm，讀一次 BACI HS92）"""
from topics.trade_goods import build_tcm


def build() -> None:
    build_tcm()
