"""AI 產業鏈全景（https://skywitness.github.io/ai-chain/ ，repo skywitness/ai-chain）的結構化資料（2026-11-13 使用者要求）。

- 同一作者（skywitness）的網站，使用者 2026-11-13 同意 map 照 CC BY 4.0 使用 `src/data/` 底下整理的資料
  （ai-chain repo 還沒有 LICENSE 檔）；其中第三方的部分照原授權，寫在用到的主題裡。
- 讀 GitHub 上固定 commit 的檔（raw.githubusercontent.com，robots.txt 是 404），不連 ai-chain 網站；
  ai-chain 每季更新後，把 COMMIT 換成新的 commit 重跑。
- ai-chain 用 YAML 1.2（npm 的 yaml 套件），`country: NO`（挪威）是字串；PyYAML 照 YAML 1.1 會讀成 False，
  所以這裡的讀法只把 true／false 當布林值。
- 財報（src/content/financials/）約三成數字取自 Stock Analysis 等彙整網站，不用。
"""
from __future__ import annotations

import re

import yaml

from common import download

COMMIT = "97e96c3c1f6296753d7104d04f29eefc0cf4c166"  # 2026-11-13 的 main（資料基準日 2026-10-06；記憶體廠 2026-10-23）
BASE = f"https://raw.githubusercontent.com/skywitness/ai-chain/{COMMIT}/"
SITE = "https://skywitness.github.io/ai-chain/"
LICENSE = "CC BY 4.0（AI 產業鏈全景 skywitness/ai-chain，同一作者）"
AS_OF = "2026-10-06"

# 14 個環節（由下而上，ai-chain 的 docs/SEGMENTS.md）：id、中文、英文、層（1 能源 2 晶片與半導體 3 系統與基礎設施 4 雲端與模型 5 應用）
SEGMENTS = [
    ("energy-power", "能源與電力", "Energy & power", 1),
    ("semi-equipment-materials", "半導體設備與材料", "Semiconductor equipment & materials", 2),
    ("foundry-packaging", "晶圓代工與先進封裝", "Foundry & advanced packaging", 2),
    ("memory-storage", "記憶體與儲存", "Memory & storage", 2),
    ("eda-ip-design", "設計工具與矽智財", "EDA, IP & design services", 2),
    ("ai-accelerators", "AI 晶片與加速器", "AI chips & accelerators", 2),
    ("networking-optics", "網通與光通訊", "Networking & optics", 3),
    ("servers-systems", "伺服器與系統", "Servers & systems", 3),
    ("datacenter-infra", "資料中心", "Data centres", 3),
    ("cloud-neocloud", "雲端與新雲", "Cloud & neoclouds", 4),
    ("foundation-models", "基礎模型", "Foundation models", 4),
    ("devtools-data-mlops", "開發工具與資料", "Developer tools, data & MLOps", 4),
    ("apps-agents", "應用與 Agent", "Applications & agents", 5),
    ("physical-ai", "實體 AI", "Physical AI", 5),
]


class _Loader(yaml.SafeLoader):
    """YAML 1.2 的布林值：只有 true／false（NO、yes、on 是字串）"""


_Loader.yaml_implicit_resolvers = {
    k: [(tag, rx) for tag, rx in v if tag != "tag:yaml.org,2002:bool"] for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()
}
_Loader.add_implicit_resolver("tag:yaml.org,2002:bool", re.compile(r"^(?:true|True|TRUE|false|False|FALSE)$"), list("tTfF"))


def load(path: str):
    """ai-chain repo 裡的一個 YAML 檔（例如 src/data/campuses.yaml）"""
    local = download(BASE + path, "ai-chain", f"{COMMIT[:10]}-{path.replace('/', '__')}")
    return yaml.load(local.read_text(encoding="utf-8"), Loader=_Loader)  # noqa: S506（自訂的 SafeLoader）


def roster() -> list[dict]:
    """710 家公司（每家一個主要環節 segment），依環節順序"""
    out = []
    for seg, *_ in SEGMENTS:
        data = load(f"src/data/roster/{seg}.yaml")
        assert data["segment"] == seg, (seg, data["segment"])
        for c in data["companies"]:
            out.append({**c, "segment": seg})
    ids = [c["id"] for c in out]
    assert len(ids) == len(set(ids)), "公司 id 重複"
    return out
