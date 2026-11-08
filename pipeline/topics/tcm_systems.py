"""傳統醫學的制度（新主題，2026-11-08，製作手冊第二十九批 691，候選 1552、1544；步驟 tcm-systems，輸出 topics/tcm-systems/）。

- **向 WHO 回報過幾次**（1552）：2024 年報告 Annex 1，194 個會員國 × 四次調查（2001、2012、2016–18 的更新調查、2023）；
  回報次數 0–4 與每一次有沒有回報（時間軸，2016–18 的更新調查畫在 2018 年）。這張圖量的是「有沒有回報」，不是「有沒有制度」。
- **國家級政策與法規**（1544）：2019 年報告的區域表 5.1–5.6 只有各區的國數，逐國的值要等順序 704 從 141 個國家的段落抽出來；
  這一步只印出六區的數字（說明用），並跑分區對帳（sources/who_tcm.py）。
- 台灣不是 WHO 會員國，不在調查裡：noValue 寫台灣自己的中醫藥制度（中醫藥發展法，全國法規資料庫 pcode L0000097）。
- 授權：兩份報告 CC BY-NC-SA 3.0 IGO，資料檔照同一授權。
- **逐國的制度**（順序 704，2026-11-08）：2019 年報告第 5 章 149 個會員國＋3 個英國海外領地的段落，逐國抽出每一項
  「有／正在訂／沒有／報告沒寫明」，手工整理成 data/who-tcm/countries-2019.csv（逐列附頁碼與原文引文；
  sources/who_tcm.py 的 curated() 檢查引文、分區與全球對帳，不過就報錯）。圖層：六項制度的分數（0–6，704）、
  各項制度（子項目，695、696、705）、保險給付（696）。
- **點名哪些醫學體系、有沒有寫到中醫**（697）：在國家段落裡找體系的名稱（正則，每次重跑），不是抽取。
- **國家醫療服務輸送計畫**（705 候選 1557）：2019 年報告 §1.8 點名的 13 國（61 個回答的會員國裡），從原文解析。
- 台灣：WHO 的報告沒有台灣；各項制度依台灣自己的法規補上（不是 WHO 的資料，提示裡寫明）。
"""
from __future__ import annotations

import re
from collections import Counter

from common import OUT_DIR, indicator_file, points_file, write_json, write_points
from sources import who_tcm

OUT = OUT_DIR / "topics" / "tcm-systems"
WAVE_YEARS = [2001, 2012, 2018, 2023]
WAVE_LABELS = ["2001", "2012", "2016–18", "2023"]
LICENSE = "CC BY-NC-SA 3.0 IGO"
TW = "台灣不是 WHO 會員國，不在這份調查裡。台灣有《中醫藥發展法》（2019 年 12 月 31 日公布）、衛福部中醫藥司，中醫門診由全民健保給付"
TW_EN = ("Taiwan is not a WHO Member State and is not in the survey. Taiwan has a Chinese Medicine Development Act "
         "(promulgated 31 December 2019) and a Department of Chinese Medicine and Pharmacy in its health ministry, and "
         "National Health Insurance covers Chinese medicine outpatient care")


# ---- 704：逐國的制度 ----
# 六項的分數（手冊 704）：國家級政策、法律或法規、國家級主管機關、草藥納入藥品管理、藥典收草藥、保險給付
SCORE = ["policy", "law", "office", "herbal_reg", "pharmacopoeia", "insurance"]
# 各項制度的子項目（src/topics/tcm-systems.ts 的 ITEMS 同順序）
ITEMS = ["policy", "law", "office", "institute", "herbal_reg", "registration", "pharmacopoeia", "gmp", "surveillance", "neml",
         "provider_reg", "education"]
ITEM_ZH = {"policy": "國家級政策", "law": "法律或法規", "office": "國家級主管機關", "institute": "國家級研究機構",
           "herbal_reg": "草藥納入藥品管理", "registration": "草藥要註冊", "pharmacopoeia": "用收了草藥的藥典",
           "gmp": "草藥的製造規範", "surveillance": "上市後監視包含草藥", "neml": "基本藥物清單收草藥",
           "provider_reg": "從業人員受法規管", "education": "正式的傳統醫學教育", "insurance": "保險給付"}
ITEM_EN = {"policy": "National policy", "law": "Laws or regulations", "office": "National office", "institute": "National research institute",
           "herbal_reg": "Herbal medicines regulated", "registration": "Herbal medicines registered", "pharmacopoeia": "Pharmacopoeia with herbal medicines",
           "gmp": "Manufacturing requirements", "surveillance": "Post-market surveillance incl. herbal", "neml": "Herbal medicines on the NEML",
           "provider_reg": "Providers regulated", "education": "Formal T&CM education", "insurance": "Insurance coverage"}
CODE = {"yes": 1, "developing": 2, "no": 3, "unknown": 4}  # src/topics/tcm-systems.ts 的 STATUS
VALUE_ZH = {"yes": "有", "developing": "正在訂", "no": "沒有", "unknown": "報告沒寫明"}
VALUE_EN = {"yes": "yes", "developing": "in preparation", "no": "no", "unknown": "not stated"}
# 保險給付：1 公營保險有給付（或公私都有）、2 只有私人保險給付、3 有給付但報告沒寫是誰、4 沒有給付、5 報告沒寫明
INSURER_CODE = {"public": 1, "both": 1, "private": 2, "": 3}
NO_BLOCK = "WHO 2019 年報告第 5 章沒有這一國的段落（沒回覆第二次調查與 2016–18 年的更新調查）"
NO_BLOCK_EN = "No country summary in chapter 5 of the WHO 2019 report (did not answer the second survey or the 2016–18 update)"
TERRITORY = "英國海外領地，不是 WHO 會員國；2019 年報告 5.7 節的條列"
TERRITORY_EN = "A UK Overseas Territory, not a WHO Member State; from section 5.7 of the 2019 report"
# 台灣：依台灣自己的法規（不是 WHO 的資料）
TW_FACTS = {
    "policy": ("中醫藥發展法（2019 年 12 月 31 日公布）規定主管機關要擬訂中醫藥發展計畫", "Chinese Medicine Development Act (31 Dec 2019) requires a Chinese medicine development plan"),
    "law": ("中醫藥發展法；中醫師的資格依醫師法", "Chinese Medicine Development Act; Chinese medicine physicians qualify under the Physicians Act"),
    "office": ("衛生福利部中醫藥司", "Department of Chinese Medicine and Pharmacy, Ministry of Health and Welfare"),
    "institute": ("衛生福利部國家中醫藥研究所", "National Research Institute of Chinese Medicine, Ministry of Health and Welfare"),
    "herbal_reg": ("中藥依藥事法管理", "Chinese herbal medicines are regulated under the Pharmaceutical Affairs Act"),
    "registration": ("中藥藥品要查驗登記、領許可證", "Chinese medicinal products need registration and a licence"),
    "pharmacopoeia": ("臺灣中藥典第四版（2022 年 6 月 1 日生效）", "Taiwan Herbal Pharmacopeia, 4th edition (in force 1 June 2022)"),
    "gmp": ("中藥製藥工廠要符合藥品優良製造規範", "Chinese medicine manufacturers must follow good manufacturing practice"),
    "surveillance": ("中醫藥司的中藥不良反應通報", "Adverse reaction reporting for Chinese medicines, Department of Chinese Medicine and Pharmacy"),
    "provider_reg": ("中醫師要考試及格、領證才能執業（醫師法）", "Chinese medicine physicians must pass an exam and be licensed (Physicians Act)"),
    "education": ("大學的中醫學系（學士）與學士後中醫學系", "University Chinese medicine degrees, including post-baccalaureate programmes"),
    "insurance": ("全民健康保險給付中醫門診", "National Health Insurance covers Chinese medicine outpatient care"),
}
TW_NOTE = "台灣不是 WHO 會員國，這一格依台灣自己的法規補上："
TW_NOTE_EN = "Taiwan is not a WHO Member State; filled in from Taiwan's own rules: "
# 697：段落裡點名的體系（正則）。古典亞洲體系與歐美的替代療法分開（手冊：不要照 WHO 的清單順序）
ASIAN = {"中醫": r"chinese medicine", "針灸": r"acupunct", "阿育吠陀": r"ayurved", "尤納尼": r"\bunani\b", "悉達": r"\bsiddha\b",
         "漢方": r"\bkampo\b", "韓醫": r"korean medicine|traditional korean", "高麗醫學": r"\bkoryo\b", "藏醫": r"sowa.rigpa|tibetan medicine",
         "泰國傳統醫學": r"thai traditional|traditional thai"}
WESTERN = {"順勢療法": r"hom(o)?eopath", "自然療法": r"naturopath", "整脊": r"chiropract", "整骨": r"osteopath", "人智醫學": r"anthroposoph"}
SYSTEM_EN = {"中醫": "Chinese medicine", "針灸": "acupuncture", "阿育吠陀": "Ayurveda", "尤納尼": "Unani", "悉達": "Siddha", "漢方": "Kampo",
             "韓醫": "Korean medicine", "高麗醫學": "Koryo medicine", "藏醫": "Sowa Rigpa", "泰國傳統醫學": "Thai traditional medicine",
             "順勢療法": "homeopathy", "自然療法": "naturopathy", "整脊": "chiropractic", "整骨": "osteopathy", "人智醫學": "anthroposophic medicine"}
LOCAL_NAMES = ("漢方", "韓醫", "高麗醫學")


def _mentions(text: str) -> list[str]:
    flat = re.sub(r"-\n", "", text).replace("\n", " ")
    return [k for k, rx in {**ASIAN, **WESTERN}.items() if re.search(rx, flat, re.I)]


def _country_points() -> dict[str, tuple[float, float]]:
    from topics.tcm_herbs import _country_points as pts
    return pts()


def _delivery_plan() -> list[str]:
    """2019 年報告 §1.8：61 個回答的會員國裡回答有國家醫療服務輸送整合計畫的 13 國"""
    flat = re.sub(r"\s+", " ", "\n".join(ln for _, ln in who_tcm.report_2019_raw()))
    m = re.search(r"Of the 61 respondent Member States, 13 replied in the affirmative; these were (.+?)\. Many other", flat)
    if not m:
        raise RuntimeError("2019 年報告 §1.8 找不到 13 國的名單")
    names = [n.strip() for n in re.split(r", (?:and )?| and ", m.group(1))]
    codes = [who_tcm.iso3(n) for n in names]
    if len(codes) != 13:
        raise RuntimeError(f"§1.8 的名單不是 13 國：{names}")
    return codes


def _build_countries() -> None:
    data = who_tcm.curated()
    blocks = {b["iso3"]: b for b in who_tcm.country_blocks()}
    annex = who_tcm.annex1()
    lic = LICENSE + "（WHO 2019 年報告第 5 章；台灣依台灣的法規）"
    no_block = {c: NO_BLOCK for c in annex if c not in data}
    no_block_en = {c: NO_BLOCK_EN for c in annex if c not in data}

    def hint_for(c: str, f: str) -> tuple[str, str]:
        v, page, _q = data[c]["fields"][f]
        pre = TERRITORY + "。" if data[c]["region"] == "territory" else ""
        pre_en = TERRITORY_EN + ". " if data[c]["region"] == "territory" else ""
        if v == "unknown":
            return pre + "報告的段落沒有寫明", pre_en + "Not stated in the country summary"
        return pre + f"{VALUE_ZH[v]}（WHO 2019 年報告第 {page} 頁）", pre_en + f"{VALUE_EN[v].capitalize()} (WHO 2019 report, p. {page})"

    # 六項的分數
    score, hints, hints_en = {}, {}, {}
    for c, d in data.items():
        score[c] = sum(1 for f in SCORE if d["fields"][f][0] == "yes")
        hints[c] = "、".join(f"{ITEM_ZH[f]}{VALUE_ZH[d['fields'][f][0]]}" for f in SCORE)
        hints_en[c] = "; ".join(f"{ITEM_EN[f]}: {VALUE_EN[d['fields'][f][0]]}" for f in SCORE)
        if d["region"] == "territory":
            hints[c] = TERRITORY + "。" + hints[c]
            hints_en[c] = TERRITORY_EN + ". " + hints_en[c]
    score["TWN"] = len(SCORE)
    hints["TWN"] = TW_NOTE + "；".join(TW_FACTS[f][0] for f in SCORE)
    hints_en["TWN"] = TW_NOTE_EN + "; ".join(TW_FACTS[f][1] for f in SCORE)
    write_json(OUT / "score.json", indicator_file("score", "項", [2018], {c: [v] for c, v in sorted(score.items())}, hints=hints,
                                                  hintsEn=hints_en, noValue=no_block, noValueEn=no_block_en, license=lic))
    # 各項制度
    (OUT / "items").mkdir(exist_ok=True)
    for f in ITEMS:
        vals, h, he = {}, {}, {}
        for c, d in data.items():
            vals[c] = [CODE[d["fields"][f][0]]]
            h[c], he[c] = hint_for(c, f)
        nv, nv_en = dict(no_block), dict(no_block_en)
        if f in TW_FACTS:
            vals["TWN"] = [CODE["yes"]]
            h["TWN"], he["TWN"] = TW_NOTE + TW_FACTS[f][0], TW_NOTE_EN + TW_FACTS[f][1]
        else:
            nv["TWN"] = "台灣不是 WHO 會員國；台灣沒有對應 WHO 基本藥物清單的國家清單"
            nv_en["TWN"] = "Taiwan is not a WHO Member State and has no national list equivalent to the WHO essential medicines list"
        write_json(OUT / "items" / f"{f.replace('_', '-')}.json", indicator_file("items", "類別", [2018], vals, hints=h, hintsEn=he,
                                                                                noValue=nv, noValueEn=nv_en, license=lic), quiet=True)
    # 保險給付
    ins, h, he = {}, {}, {}
    for c, d in data.items():
        v, page, _q = d["fields"]["insurance"]
        who = d["extra"].get("insurer", "")
        ins[c] = [INSURER_CODE.get(who, 3) if v == "yes" else 4 if v == "no" else 5]
        items = d["extra"].get("insurance_items", "")
        h[c], he[c] = hint_for(c, "insurance")
        if items and v == "yes":
            he[c] += f": {items}"
    ins["TWN"] = [1]
    h["TWN"], he["TWN"] = TW_NOTE + TW_FACTS["insurance"][0], TW_NOTE_EN + TW_FACTS["insurance"][1]
    write_json(OUT / "insurance.json", indicator_file("insurance", "類別", [2018], ins, hints=h, hintsEn=he, noValue=no_block,
                                                      noValueEn=no_block_en, license=lic))
    # 697：點名的體系、有沒有寫到中醫
    systems, cm, h, he, h2, he2 = {}, {}, {}, {}, {}, {}
    named: dict[str, list[str]] = {}
    for c in data:
        m = _mentions(blocks[c]["text"])
        named[c] = m
        a, w = any(k in ASIAN for k in m), any(k in WESTERN for k in m)
        systems[c] = [1 if a and w else 2 if a else 3 if w else 4]
        h[c] = ("點名：" + "、".join(m)) if m else "段落裡沒有點名這些體系（只寫到傳統醫學、草藥或原住民傳統醫學）"
        he[c] = ("Named: " + ", ".join(SYSTEM_EN[k] for k in m)) if m else "None of these systems is named (only traditional, herbal or indigenous medicine)"
        local = [k for k in m if k in LOCAL_NAMES]
        cm[c] = [1 if "中醫" in m else 2 if local else 3]
        h2[c] = "段落寫到 Chinese medicine" if "中醫" in m else (f"段落寫的是{'、'.join(local)}，沒有 Chinese medicine" if local else "段落沒有寫到中醫")
        he2[c] = ("Mentions Chinese medicine" if "中醫" in m else
                  (f"Uses {', '.join(SYSTEM_EN[k] for k in local)}, not “Chinese medicine”" if local else "No mention of Chinese medicine"))
    systems["TWN"], cm["TWN"] = [2], [4]
    h["TWN"] = TW_NOTE + "中醫（含針灸），中醫藥發展法"
    he["TWN"] = TW_NOTE_EN + "Chinese medicine (including acupuncture), Chinese Medicine Development Act"
    h2["TWN"], he2["TWN"] = TW_NOTE + "中醫藥發展法、醫師法的中醫師、全民健保給付中醫", TW_NOTE_EN + "Chinese Medicine Development Act, licensed Chinese medicine physicians and National Health Insurance coverage"
    write_json(OUT / "systems.json", indicator_file("systems", "類別", [2018], systems, hints=h, hintsEn=he, noValue=no_block,
                                                    noValueEn=no_block_en, license=lic))
    write_json(OUT / "chinese-medicine.json", indicator_file("chinese-medicine", "類別", [2018], cm, hints=h2, hintsEn=he2, noValue=no_block,
                                                             noValueEn=no_block_en, license=lic))
    # 705 候選 1557：國家醫療服務輸送計畫
    plan = _delivery_plan()
    write_json(OUT / "delivery-plan.json", indicator_file(
        "delivery-plan", "類別", [2018], {c: [1] for c in plan},
        hints={c: "2016–18 年的更新調查回答有（WHO 2019 年報告 §1.8）" for c in plan},
        hintsEn={c: "Answered yes in the 2016–18 update survey (WHO 2019 report, section 1.8)" for c in plan},
        noValue={"TWN": "台灣不是 WHO 會員國，不在調查裡；中醫藥發展法第二章是中醫藥發展計畫"},
        noValueEn={"TWN": "Taiwan is not a WHO Member State and is not in the survey; chapter 2 of its Chinese Medicine Development Act covers a Chinese medicine development plan"},
        license=LICENSE))
    # 左邊的清單：選到的國家每一項制度（不寫「報告沒寫明」的）與原文引文
    pts = _country_points()
    rows = []
    for c, d in data.items():
        if c not in pts:
            continue
        for k, f in enumerate(ITEMS + ["insurance"]):
            v, page, quote = d["fields"][f]
            if v == "unknown":
                continue
            rows.append({"lon": pts[c][0], "lat": pts[c][1], "iso3": c, "k": k, "v": CODE[v], "page": page, "quote": quote})
        if named[c]:
            rows.append({"lon": pts[c][0], "lat": pts[c][1], "iso3": c, "k": 99, "v": 0, "page": None, "quote": "、".join(named[c])})
    for k, f in enumerate(ITEMS + ["insurance"]):
        if f in TW_FACTS and "TWN" in pts:
            rows.append({"lon": pts["TWN"][0], "lat": pts["TWN"][1], "iso3": "TWN", "k": k, "v": 1, "page": None, "quote": TW_FACTS[f][0]})
    rows.sort(key=lambda r: (r["iso3"], r["k"]))
    write_points(OUT / "facts.json", points_file(rows, ["lon", "lat", "iso3", "k", "v", "page", "quote"], {"lon": 0.001, "lat": 0.001, "k": 1,
                                                                                                       "v": 1, "page": 1}, strings=("iso3",)), ("quote",))
    # 印出來給說明用
    mem = {c: d for c, d in data.items() if d["region"] != "territory"}
    print(f"  第 5 章：{len(mem)} 個會員國＋{len(data) - len(mem)} 個屬地的段落；沒有段落的會員國 {len(no_block)}")
    print("    六項分數：" + "、".join(f"{k} 分 {v} 國" for k, v in sorted(Counter(score[c] for c in mem).items())))
    top = sorted(mem, key=lambda c: -score[c])
    print("    6 分：" + "、".join(c for c in top if score[c] == 6) + "；5 分：" + "、".join(c for c in top if score[c] == 5))
    for f in ITEMS + ["insurance"]:
        cnt = Counter(mem[c]["fields"][f][0] for c in mem)
        print(f"    {ITEM_ZH[f]}：有 {cnt['yes']}、正在訂 {cnt['developing']}、沒有 {cnt['no']}、沒寫明 {cnt['unknown']}")
    ic = Counter(ins[c][0] for c in mem)
    print(f"    保險：公營 {ic[1]}、只有私人 {ic[2]}、沒寫是誰 {ic[3]}、沒有 {ic[4]}、沒寫明 {ic[5]}")
    sc = Counter(systems[c][0] for c in mem)
    print(f"    體系：兩類都有 {sc[1]}、只有亞洲 {sc[2]}、只有歐美 {sc[3]}、都沒有 {sc[4]}")
    mc = Counter(k for c in mem for k in named[c])
    print("    點名國數：" + "、".join(f"{k} {v}" for k, v in mc.most_common()))
    cc = Counter(cm[c][0] for c in mem)
    print(f"    中醫：寫到 {cc[1]}、只寫當地名稱 {cc[2]}、沒寫到 {cc[3]}；當地名稱：" + "、".join(c for c in mem if cm[c][0] == 2))
    print(f"    國家醫療服務輸送計畫（§1.8）：{plan}")


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    _build_countries()
    annex = who_tcm.annex1()
    regions = who_tcm.regional_tables()
    hints, hints_en = {}, {}
    for c, r in annex.items():
        got = [WAVE_LABELS[i] for i in range(4) if r["waves"][i]]
        hints[c] = ("回報過：" + "、".join(got) + " 年") if got else "四次調查都沒有回報"
        hints_en[c] = ("Responded: " + ", ".join(got)) if got else "Did not respond to any of the four surveys"
    nv, nv_en = {"TWN": TW}, {"TWN": TW_EN}
    write_json(OUT / "reports.json", indicator_file("reports", "次", [2023], {c: [sum(r["waves"])] for c, r in sorted(annex.items())},
                                                    hints=hints, hintsEn=hints_en, noValue=nv, noValueEn=nv_en, license=LICENSE))
    # 每一次調查：1 有回報、2 沒有回報
    write_json(OUT / "responded.json", indicator_file("responded", "類", WAVE_YEARS,
                                                      {c: [1 if w else 2 for w in r["waves"]] for c, r in sorted(annex.items())},
                                                      noValue=nv, noValueEn=nv_en, license=LICENSE))
    totals = [sum(r["waves"][i] for r in annex.values()) for i in range(4)]
    never = sorted(c for c, r in annex.items() if not any(r["waves"]))
    print(f"  Annex 1：{len(annex)} 國；四次調查 {totals}；至少一次 {sum(1 for r in annex.values() if any(r['waves']))} 國；從沒回報 {never}")
    from collections import Counter
    print("    回報次數：" + "、".join(f"{k} 次 {v} 國" for k, v in sorted(Counter(sum(r['waves']) for r in annex.values()).items())))
    by_region = Counter(r["region"] for r in annex.values())
    print("    分區國數：" + "、".join(f"{k} {v}" for k, v in by_region.most_common()))
    for label in ("National policy on T&CM", "Laws or regulations on T&CM", "National office for T&CM", "Expert committee on T&CM",
                  "Regulation of herbal medicines"):
        y05 = sum(rows[label][0] or 0 for rows in regions.values())
        print(f"  2019 年報告 {label}：2005 年 {y05}、2018 年 {sum(rows[label][1] for rows in regions.values())}；"
              + "、".join(f"{reg} {rows[label][1]}" for reg, rows in regions.items()))
