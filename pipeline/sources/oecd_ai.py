"""OECD.AI 的 OpenRouter 資料：各國每月透過 OpenRouter 呼叫 AI 模型的 token 量。

- 來源：https://oecd.ai/en/data?selectedArea=ai-model-usage（方法說明 https://oecd.ai/en/openrouter-data）
- 網站沒有下載檔，這裡呼叫網頁圖表本身使用的 GraphQL API；它不是公開文件化的 API，格式可能改變。
- 轉載授權未明示（OECD 的條款提醒資料可能屬於第三方，這裡是 OpenRouter）。
- 國家是「請求發出的地點」，伺服器集中的地方（新加坡、德國等）會偏高。
- token 單位是百萬。
"""
from __future__ import annotations

import json
import urllib.request

import common

API = "https://observatory.oecdai.org/graphql/v1"
CHART_ID = "33494"  # 網頁上「AI model usage through OpenRouter by country of request」圖表
QUERY = "{ o2__openrouter { tokens_and_costs { month request_country total_tokens } } }"


def tokens_by_country_month() -> list[dict]:
    """[{month: 202605, request_country: 'TWN', total_tokens: 百萬 tokens}, …]，含 'ALL'（全球）。"""
    target = common.CACHE_DIR / "oecd-ai" / "openrouter_tokens.json"
    if not target.exists() or common.REFRESH:
        print(f"  下載 {API}（OpenRouter tokens）")
        request = urllib.request.Request(
            API,
            data=json.dumps({"query": QUERY}).encode(),
            headers={"Content-Type": "application/json", "O2-Chart": CHART_ID, "User-Agent": common.USER_AGENT},
        )
        with urllib.request.urlopen(request, timeout=300) as resp:
            payload = json.load(resp)
        if "errors" in payload:
            raise RuntimeError(f"OECD.AI API 回傳錯誤：{payload['errors'][:2]}")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(payload), encoding="utf-8")
    payload = json.loads(target.read_text(encoding="utf-8"))
    return payload["data"]["o2__openrouter"]["tokens_and_costs"]
