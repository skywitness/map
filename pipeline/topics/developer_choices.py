"""開發者與開源的擴充：程式語言的版圖、開源授權的選擇、開發者在做什麼題目（2026-11-07，製作手冊第二十七批 592，
候選 1313–1315；步驟 developer-choices，輸出 topics/developers/）。

GitHub Innovation Graph（CC0 1.0）的 languages.csv、licenses.csv、topics.csv，跟主題本身一樣每年取第 1 季
（topics.developers.QUARTER）。num_pushers 是「有推送這種語言／授權／標籤的帳號數」，一個人會在好幾類各算一次，
所以這裡的比例都是「人次」的比例，說明寫明。少於 100 人的組合不公布（小地方只看得到大類）。

- 語言的占比：某一語言 ÷ 這一季所有 language_type=programming 的語言人次。手冊要的「第一名是誰」類別圖不做：
  2026 年第 1 季 181 個經濟體有 179 個是 JavaScript、2 個是 Python，畫出來沒有資訊；改成子項目選語言的占比。
- 寬鬆授權的占比：MIT、Apache、BSD、ISC 這類 ÷ 認得出授權的人次（不含 NOASSERTION，那是 GitHub 認不出，不是沒有授權）。
- AI 題目的占比：AI 相關標籤 ÷ 所有標籤（不含 config、github-config 這兩個樣板標籤），標籤的人次至少 2,000 才算。
"""
from __future__ import annotations

from collections import defaultdict

from common import OUT_DIR, indicator_file, write_json
from sources import innovation_graph as ig
from topics.developers import QUARTER

OUT = OUT_DIR / "topics" / "developers"
LANGUAGES = {"python": "Python", "javascript": "JavaScript", "typescript": "TypeScript", "java": "Java", "csharp": "C#",
             "cpp": "C++", "php": "PHP", "go": "Go", "rust": "Rust", "kotlin": "Kotlin", "swift": "Swift", "dart": "Dart"}
PERMISSIVE = {"MIT", "Apache-2.0", "BSD-3-Clause", "BSD-2-Clause", "ISC", "0BSD", "MIT-0", "BSL-1.0", "Zlib", "UPL-1.0",
              "BSD-3-Clause-Clear", "MulanPSL-2.0"}
COPYLEFT = {"GPL-3.0", "GPL-2.0", "AGPL-3.0", "LGPL-3.0", "LGPL-2.1", "MPL-2.0", "EPL-2.0", "EPL-1.0", "EUPL-1.2", "OSL-3.0",
            "CERN-OHL-S-2.0", "CC-BY-SA-4.0"}
PUBLIC = {"CC0-1.0", "Unlicense", "WTFPL"}
UNKNOWN = {"NOASSERTION"}
TEMPLATE_TOPICS = {"config", "github-config"}
AI_TOPICS = {"ai", "artificial-intelligence", "machine-learning", "deep-learning", "llm", "llms", "large-language-models",
             "ai-agent", "ai-agents", "agentic-ai", "agent", "agents", "generative-ai", "genai", "mcp", "mcp-server",
             "model-context-protocol", "claude", "claude-code", "anthropic", "openai", "chatgpt", "gpt", "gpt-4", "rag",
             "langchain", "ollama", "pytorch", "tensorflow", "huggingface", "transformers", "nlp", "computer-vision"}
MIN_TOPIC_COUNT = 2000
# 少於 100 人的類別不公布：總人次太少時只剩幾個大類，比例會被灌高（只有 JavaScript 的地方就是 100%）
MIN_LANGUAGE_COUNT = 10_000
MIN_LICENSE_COUNT = 2000


def _quarterly(name: str, key: str) -> dict[str, dict[int, dict[str, int]]]:
    """{iso3: {年: {類別: 人次}}}，只取每年的第 QUARTER 季"""
    out: dict[str, dict[int, dict[str, int]]] = defaultdict(lambda: defaultdict(dict))
    for r in ig._rows(name):
        if int(r["quarter"]) != QUARTER or r["iso2_code"] in ig.AGGREGATES:
            continue
        c = ig._iso3(r["iso2_code"])
        if c:
            out[c][int(r["year"])][r[key]] = int(r["num_pushers"])
    return out


def _write(name: str, years: list[int], values: dict[str, dict[int, float]]) -> None:
    write_json(OUT / f"{name}.json", indicator_file(
        name, "%", years, {c: [round(s[y], 3) if y in s else None for y in years] for c, s in sorted(values.items()) if s},
        license="CC0 1.0"))


def build() -> None:
    types = ig.language_types()
    langs = _quarterly("languages", "language")
    years = sorted({y for s in langs.values() for y in s})
    for item, name in LANGUAGES.items():
        share = {}
        for c, by_year in langs.items():
            share[c] = {y: v.get(name, 0) / total * 100 for y, v in by_year.items()
                        if (total := sum(n for k, n in v.items() if types.get(k) == "programming")) >= MIN_LANGUAGE_COUNT and name in v}
        _write(f"lang-share/{item}", years, share)
    lic = _quarterly("licenses", "spdx_license")
    unknown = set(k for by in lic.values() for v in by.values() for k in v) - PERMISSIVE - COPYLEFT - PUBLIC - UNKNOWN
    if unknown - {"CC-BY-4.0", "OFL-1.1", "Artistic-2.0"}:
        raise RuntimeError(f"沒有歸類的授權：{unknown}")
    permissive = {c: {y: sum(n for k, n in v.items() if k in PERMISSIVE) / known * 100 for y, v in by_year.items()
                      if (known := sum(n for k, n in v.items() if k not in UNKNOWN)) >= MIN_LICENSE_COUNT}
                  for c, by_year in lic.items()}
    _write("permissive-share", years, permissive)
    topics = _quarterly("topics", "topic")
    # AI 標籤都不到 100 人（不公布）的年份不算 0，當成沒有資料
    ai = {c: {y: ai_n / total * 100 for y, v in by_year.items()
              if (total := sum(n for k, n in v.items() if k not in TEMPLATE_TOPICS)) >= MIN_TOPIC_COUNT
              and (ai_n := sum(n for k, n in v.items() if k in AI_TOPICS)) > 0}
          for c, by_year in topics.items()}
    _write("ai-topics", years, ai)

    last = years[-1]
    for item in ("python", "javascript", "typescript", "java", "rust", "go", "csharp", "php"):
        name = LANGUAGES[item]
        v = sorted(((round(by[last][name] / t * 100, 1), c) for c, by in langs.items() if last in by and name in by[last]
                    and (t := sum(n for k, n in by[last].items() if types.get(k) == "programming")) >= MIN_LANGUAGE_COUNT), reverse=True)
        tw = next((x for x, c in v if c == "TWN"), None)
        print(f"  {name} {last}：{len(v)} 國 {v[:6]} … {v[-3:]} 台灣 {tw} 美國 {next((x for x, c in v if c == 'USA'), None)} 中國 {next((x for x, c in v if c == 'CHN'), None)} 日本 {next((x for x, c in v if c == 'JPN'), None)}")
    v = sorted(((round(s[last], 1), c) for c, s in permissive.items() if last in s), reverse=True)
    print(f"  寬鬆授權 {len(v)} 國：{v[:6]} … {v[-8:]}；台灣 {round(permissive['TWN'][last], 1)} 美國 {round(permissive['USA'][last], 1)} 中國 {round(permissive['CHN'][last], 1)}")
    v = sorted(((round(s[last], 1), c) for c, s in ai.items() if last in s), reverse=True)
    print(f"  AI 題目 {len(v)} 國：{v[:8]} … {v[-5:]}；台灣 {round(ai['TWN'][last], 1)}；2024 台灣 {round(ai['TWN'].get(2024, 0), 1)} 美國 {round(ai['USA'].get(2024, 0), 1)}→{round(ai['USA'][last], 1)}")
    print(f"  標籤的年份：{ {y: sum(1 for s in ai.values() if y in s) for y in years} }")
