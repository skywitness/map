"""核子事故（新主題，2026-10-30，製作手冊第六批 101）：手工整理的事件表。

依英文維基百科三篇的固定版本（CC BY-SA 4.0，整理後的表依同一授權分享）：
- 「Nuclear and radiation accidents and incidents」revid 1382200054（2026-10-27）的「List of major nuclear plant accidents
  and incidents」表（WIKI_PLANT）
- 「List of nuclear and radiation accidents by death toll」revid 1378930439（2026-10-07）（WIKI_DEATHS）
- 「List of civilian nuclear accidents」revid 1353556789（2026-05-10）的各年代表（WIKI_CIVIL）

**收哪些**（使用者 2026-10-30 決定不收軍事事故）：
- 三篇裡有 INES 等級、或有人死亡的民用核電廠、反應爐、核燃料與核廢料設施、輻射源與放射治療事故。
- 電廠事故表裡只有停機損失、沒有人死亡也沒有 INES 等級的（美國的 Browns Ferry、Pilgrim、Peach Bottom、Nine Mile Point、
  Calvert Cliffs、Millstone、Crystal River，德國 Hamm-Uentrop、俄羅斯 Sosnovy Bor）不收。
- 不收（軍事）：核潛艇 K-431、K-27、K-19，美國陸軍的 SL-1，第五福龍丸（核試爆的落塵），Louis Slotin、Harry Daghlian
  （曼哈頓計畫的核彈芯臨界實驗）。基什特姆（馬亞克）、溫斯喬是核武計畫的生產設施，三篇都列為核事故、手冊的例子也有，照收。
- 民用核事故表 1966–1967 年冬天那一筆 INES 5（地點不明）不收。

**死亡人數**：使用者決定列各方估計的範圍與出處。`deaths` 是畫圓用的數字（各方估計的上限，沒有人死亡是 0，不知道是 None），
`deaths_zh`、`deaths_en` 是範圍與出處的文字。座標：`wiki` 是英文維基條目（設施或事件），pipeline 查它在 Wikidata 的座標；
`coord` 是沒有條目的手工座標（城市的位置）。
"""
from __future__ import annotations

from dataclasses import dataclass

WIKI_PLANT = "Nuclear and radiation accidents and incidents（revid 1382200054）"
WIKI_DEATHS = "List of nuclear and radiation accidents by death toll（revid 1378930439）"
WIKI_CIVIL = "List of civilian nuclear accidents（revid 1353556789）"

# 種類：1 核電廠與發電用的反應爐、2 研究與實驗用的反應爐、臨界事故、3 核燃料與核廢料設施、4 輻射源與放射治療
POWER, RESEARCH, FUEL, SOURCE = 1, 2, 3, 4


@dataclass
class Accident:
    date: str  # 「1986-04-26」「1984-03」「1980」
    ines: int | None
    kind: int
    deaths: int | None
    en: str
    zh: str
    wiki: str | None  # 查座標用的英文維基條目
    what_zh: str
    what_en: str
    deaths_zh: str
    deaths_en: str
    coord: tuple[float, float] | None = None  # (經度, 緯度)


NONE_ZH, NONE_EN = "沒有人死亡", "No deaths"

ACCIDENTS = [
    Accident("1952-12-12", 5, RESEARCH, 0, "Chalk River NRX accident", "喬克河 NRX 反應爐事故", "Chalk River Laboratories",
             "研究用反應爐部分熔毀", "Partial meltdown of a research reactor", NONE_ZH, NONE_EN),
    Accident("1957-09-29", 6, FUEL, 200, "Kyshtym disaster", "基什特姆核災（馬亞克）", "Kyshtym disaster",
             "核燃料處理廠的高放射性廢液儲槽爆炸，大範圍污染", "An underground tank of high-level radioactive waste exploded at the Mayak plant, contaminating a large area",
             "死亡人數不明：死亡人數表寫短期 200 人以上；電廠事故表寫估計 200 人可能死於癌症（英文維基百科）",
             "Unknown: the death-toll list gives 200+ short-term deaths; the plant accident table estimates 200 possible cancer deaths (English Wikipedia)"),
    Accident("1957-10-10", 5, FUEL, 100, "Windscale fire", "溫斯喬反應爐火災", "Windscale fire",
             "生產鈽的反應爐起火，爐心受損，放射性物質外洩", "Fire in a plutonium-production reactor damaged the core and released radioactivity",
             "沒有直接死亡；英國政府 1988 年估計到 2007 年約 100 人死亡、電廠事故表寫可能多達 240 例癌症，之後的流行病學研究沒有找到癌症增加（英文維基百科）",
             "No direct deaths; a 1988 UK government estimate put deaths by 2007 at about 100 and the plant table cites up to 240 possible cancer cases, but later epidemiological studies found no rise (English Wikipedia)"),
    Accident("1958-05-24", 5, RESEARCH, 0, "Chalk River NRU fuel accident", "喬克河 NRU 燃料事故", "Chalk River Laboratories",
             "研究用反應爐的燃料受損起火", "Damaged fuel caught fire at a research reactor", NONE_ZH, NONE_EN),
    Accident("1958-10-15", 4, RESEARCH, 1, "Vinča criticality accident", "溫查臨界事故", "Vinča Nuclear Institute",
             "重水反應爐實驗時功率失控，人員受到輻射", "Undetected power rise during a heavy-water reactor experiment irradiated the staff",
             "1 人（電廠事故表）", "1 (plant accident table)"),
    Accident("1958-12-30", None, RESEARCH, 1, "Cecil Kelley criticality accident", "塞西爾·凱利臨界事故", "Los Alamos National Laboratory",
             "鈽溶液處理時發生臨界", "Criticality while processing a plutonium solution", "1 人（死亡人數表）", "1 (death-toll list)"),
    Accident("1959-07-26", 4, RESEARCH, 0, "Santa Susana sodium reactor experiment", "聖蘇珊娜鈉冷卻反應爐實驗事故", "Santa Susana Field Laboratory",
             "實驗用反應爐部分熔毀", "Partial meltdown of an experimental reactor", NONE_ZH, NONE_EN),
    Accident("1960-04-03", 4, RESEARCH, 0, "Westinghouse test reactor meltdown", "西屋測試反應爐熔毀", None,
             "測試用反應爐部分熔毀（賓州威斯特摩蘭郡）", "Partial meltdown of a test reactor (Westmoreland County, Pennsylvania)", NONE_ZH, NONE_EN,
             coord=(-79.47, 40.31)),
    Accident("1962", None, SOURCE, 4, "Radiation accident in Mexico City", "墨西哥城輻射事故", None,
             "工業用射線照相裝置的鈷 60 射源遺失，一家人受到照射", "A family was exposed to a cobalt-60 source lost from an industrial radiography device",
             "4 人（死亡人數表）", "4 (death-toll list)", coord=(-99.13, 19.43)),
    Accident("1964-07-24", 2, FUEL, 1, "Wood River Junction criticality accident", "伍德河匯流臨界事故", "Wood River Junction, Rhode Island",
             "回收高濃縮鈾時操作錯誤發生臨界", "Operator error caused a criticality while recovering highly enriched uranium",
             "1 人（死亡人數表）", "1 (death-toll list)"),
    Accident("1966-10-05", 4, POWER, 0, "Fermi 1 partial meltdown", "費米一號機部分熔毀", "Enrico Fermi Nuclear Generating Station",
             "快滋生反應爐部分燃料熔毀", "Some fuel elements melted in a fast breeder reactor", NONE_ZH, NONE_EN),
    Accident("1967-05", 4, POWER, 0, "Chapelcross fuel channel fire", "查佩爾克羅斯核電廠事故", "Chapelcross nuclear power station",
             "燃料元件起火，部分熔毀", "A fuel element fire caused a partial meltdown", NONE_ZH, NONE_EN),
    Accident("1969-01-21", 4, POWER, 0, "Lucens reactor accident", "呂桑反應爐事故", "Lucens reactor",
             "地下實驗電廠失去冷卻、部分熔毀，岩洞受到污染", "Loss of coolant and partial meltdown contaminated the underground cavern", NONE_ZH, NONE_EN),
    Accident("1974", None, SOURCE, 10, "Columbus radiotherapy accident", "哥倫布放射治療事故", None,
             "鈷 60 治療機校正錯誤，病人受到過量照射（1974–1976）", "A miscalibrated cobalt-60 teletherapy unit overdosed patients (1974–1976)",
             "10 人（死亡人數表）", "10 (death-toll list)", coord=(-82.99, 39.96)),
    Accident("1975-12-07", 3, POWER, 0, "Greifswald fire", "格賴夫斯瓦爾德核電廠火災", "Greifswald Nuclear Power Plant",
             "電氣故障引起火災，燒毀控制線路與 5 台冷卻泵", "An electrical fault started a fire that destroyed control lines and five coolant pumps", NONE_ZH, NONE_EN),
    Accident("1976-01-05", 4, POWER, 2, "Bohunice A1 refuelling accident", "博胡尼采 A1 換燃料事故", "Bohunice Nuclear Power Plant",
             "換燃料時燃料棒被冷卻劑噴出", "A fuel rod was ejected into the reactor hall during refuelling", "2 人（電廠事故表）", "2 (plant accident table)"),
    Accident("1977-02-22", 4, POWER, 0, "Bohunice A1 fuel damage", "博胡尼采 A1 燃料損毀", "Bohunice Nuclear Power Plant",
             "燃料受損，反應爐停用", "Fuel damage put the reactor out of service", NONE_ZH, NONE_EN),
    Accident("1979-03-28", 5, POWER, 0, "Three Mile Island accident", "三哩島事故", "Three Mile Island accident",
             "失去冷卻、爐心部分熔毀，少量放射性氣體外洩", "Loss of coolant and partial core meltdown, with a small release of radioactive gases",
             "沒有人死亡（電廠事故表）；是否增加癌症仍有爭議", "No deaths (plant accident table); any cancer effect remains disputed"),
    Accident("1980-03-13", 4, POWER, 0, "Saint-Laurent A2 accident", "聖洛朗核電廠事故", "Saint-Laurent Nuclear Power Plant",
             "功率驟升，爐心部分受損", "A power excursion partly damaged the core", NONE_ZH, NONE_EN),
    Accident("1980", None, SOURCE, 7, "Houston radiotherapy accident", "休士頓放射治療事故", None,
             "核醫治療的釔 90 劑量錯誤", "An error with yttrium-90 in nuclear medicine therapy", "7 人（死亡人數表）", "7 (death-toll list)",
             coord=(-95.37, 29.76)),
    Accident("1982-10-05", None, SOURCE, 5, "Lost radiation source, Baku", "巴庫遺失射源事故", None,
             "遺失的銫 137 射源被放在口袋裡帶著走", "An orphaned caesium-137 source was carried around in a pocket", "5 人（死亡人數表）", "5 (death-toll list)",
             coord=(49.87, 40.41)),
    Accident("1983-09-23", 4, RESEARCH, 1, "RA-2 criticality accident", "RA-2 臨界事故", None,
             "研究用反應爐換裝燃料時發生臨界（布宜諾斯艾利斯的憲法原子能中心）", "Criticality while reconfiguring the fuel of a research reactor (Constituyentes Atomic Center, Buenos Aires)", "1 人（死亡人數表）", "1 (death-toll list)",
             coord=(-58.53, -34.56)),
    Accident("1984-03", None, SOURCE, 8, "Radiation accident in Morocco", "摩洛哥輻射事故", None,
             "焊接射線照相用的銥 192 射源掉出屏蔽容器", "An iridium-192 radiography source fell out of its shielded container",
             "至少 8 人（死亡人數表）", "At least 8 (death-toll list)", coord=(-7.59, 33.57)),
    Accident("1986-04-26", 7, POWER, 16000, "Chernobyl disaster", "車諾比核災", "Chernobyl disaster",
             "反應爐設計缺陷與違規的測試造成功率暴衝、爆炸與火災，大量放射性物質散布到歐洲",
             "A flawed reactor design and unsafe test caused a power surge, explosion and fire that spread radioactivity across Europe",
             "直接死亡 31 人（2 人死於爆炸、29 人死於急性輻射，UNSCEAR 2008）、短期 31–60 人；另有 19 名工作人員 1987–2004 年死亡、可能相關，15 名兒童死於甲狀腺癌（到 2008 年）；長期的癌症死亡各方推估 4,000 到 16,000 人以上，有爭議（英文維基百科兩篇）",
             "31 direct deaths (2 in the explosion, 29 from acute radiation; UNSCEAR 2008), 31–60 short-term; 19 more workers died in 1987–2004, possibly related, and 15 children of thyroid cancer (to 2008); estimates of long-term cancer deaths range from 4,000 to over 16,000 and are disputed (two English Wikipedia articles)"),
    Accident("1986-12-09", None, POWER, 4, "Surry pipe rupture", "薩里核電廠管線破裂", "Surry Nuclear Power Plant",
             "給水管破裂，蒸汽燙死工人", "A feedwater pipe burst and killed workers", "4 人（電廠事故表）", "4 (plant accident table)"),
    Accident("1987-09-13", 5, SOURCE, 4, "Goiânia accident", "戈亞尼亞輻射事故", "Goiânia accident",
             "廢棄醫院的放射治療機被拆開，銫 137 粉末散布，249 人受到大量照射", "An abandoned radiotherapy unit was dismantled and its caesium-137 powder spread; 249 people received large doses",
             "4 人（死亡人數表、電廠事故表）", "4 (death-toll list, plant accident table)"),
    Accident("1989", None, SOURCE, 1, "San Salvador irradiator accident", "聖薩爾瓦多照射廠事故", None,
             "鈷 60 照射廠違反安全規定", "Safety rules broken at a cobalt-60 irradiation facility", "1 人（死亡人數表）", "1 (death-toll list)",
             coord=(-89.19, 13.69)),
    Accident("1989-10-19", 3, POWER, 0, "Vandellòs I fire", "范德略斯一號機火災", "Vandellòs Nuclear Power Plant",
             "火災燒壞冷卻系統，爐心接近熔毀", "A fire damaged the cooling system and brought the core close to meltdown", NONE_ZH, NONE_EN),
    Accident("1990-12", None, SOURCE, 11, "Radiotherapy accident in Zaragoza", "薩拉戈薩放射治療事故", None,
             "直線加速器維修後輸出錯誤，癌症病人受到過量照射", "Cancer patients were overdosed by a faulty linear accelerator",
             "11 人，27 人受傷（死亡人數表）", "11, with 27 injured (death-toll list)", coord=(-0.88, 41.65)),
    Accident("1993-04-06", 4, FUEL, 0, "Tomsk-7 explosion", "托木斯克 7 號爆炸", "Seversk",
             "核燃料再處理廠的槽體爆炸", "A tank exploded at a nuclear fuel reprocessing plant", NONE_ZH, NONE_EN),
    Accident("1994", None, SOURCE, 1, "Tammiku radiation accident", "坦米庫輻射事故", None,
             "棄置的銫 137 射源被撿回家", "A discarded caesium-137 source was taken home", "1 人（死亡人數表）", "1 (death-toll list)",
             coord=(24.75, 59.37)),
    Accident("1996", None, SOURCE, 13, "Radiotherapy accident in Costa Rica", "哥斯大黎加放射治療事故", None,
             "鈷 60 治療機劑量算錯，114 名病人受到過量照射", "114 patients were overdosed by a cobalt-60 therapy unit",
             "13 人（死亡人數表）", "13 (death-toll list)", coord=(-84.08, 9.93)),
    Accident("1997-06", None, RESEARCH, 1, "Sarov criticality accident", "薩羅夫臨界事故", None,
             "違反安全規定發生臨界", "Criticality after safety rules were broken", "1 人（死亡人數表）", "1 (death-toll list)",
             coord=(43.32, 54.93)),
    Accident("1999-09-30", 4, FUEL, 2, "Tokaimura nuclear accident", "東海村臨界事故", "Tokaimura nuclear accidents",
             "核燃料轉換廠的工人用水桶倒入過量的鈾溶液，發生臨界", "Workers poured too much uranium solution into a tank at a fuel plant, causing a criticality",
             "2 人（死亡人數表、電廠事故表）", "2 (death-toll list, plant accident table)"),
    Accident("1999-12-27", 2, POWER, 0, "Blayais flood", "布萊耶核電廠淹水", "Blayais Nuclear Power Plant",
             "暴風雨使電廠淹水，多個安全系統失效", "A storm flooded the plant and disabled several safety systems", NONE_ZH, NONE_EN),
    Accident("2000-02", None, SOURCE, 3, "Samut Prakan radiation accident", "北欖府輻射事故", "Samut Prakan radiation accident",
             "放射治療機的鈷 60 射源被當廢鐵拆開", "A cobalt-60 source from a radiotherapy unit was dismantled as scrap",
             "3 人，10 人受傷（死亡人數表）", "3, with 10 injured (death-toll list)"),
    Accident("2000-05", None, SOURCE, 2, "Meet Halfa radiation accident", "米特哈爾法輻射事故", None,
             "撿到的銥 192 射源放在家裡", "A found iridium-192 source was kept at home", "2 人，5 人受傷（死亡人數表）", "2, with 5 injured (death-toll list)",
             coord=(31.1, 30.4)),
    Accident("2000-08", None, SOURCE, 17, "Panama radiotherapy accident", "巴拿馬放射治療事故", "Instituto Oncológico Nacional",
             "治療計畫的電腦資料輸入方式錯誤，攝護腺癌與子宮頸癌病人受到致命的劑量（2000–2001）", "Prostate and cervical cancer patients received lethal doses after a treatment-planning error (2000–2001)",
             "17 人（死亡人數表）", "17 (death-toll list)", coord=(-79.53, 8.98)),
    Accident("2001-12-02", None, SOURCE, 1, "Lia radiological accident", "利亞輻射事故", "Lia radiological accident",
             "伐木工人撿到蘇聯時代的鍶 90 發電機核心取暖", "Woodcutters used Soviet-era strontium-90 generator cores for warmth",
             "1 人（死亡人數表）", "1 (death-toll list)", coord=(42.05, 42.62)),
    Accident("2002-02-16", 3, POWER, 0, "Davis-Besse reactor head corrosion", "戴維斯—貝西反應爐頂蓋腐蝕", "Davis–Besse Nuclear Power Station",
             "反應爐壓力容器頂蓋嚴重腐蝕，停機 24 個月", "Severe corrosion of the reactor vessel head forced a 24-month outage", NONE_ZH, NONE_EN),
    Accident("2003-04-10", 3, POWER, 0, "Paks fuel damage", "包克什核電廠燃料損毀", "Paks Nuclear Power Plant",
             "清洗燃料棒時燃料破損，放射性氣體外洩", "Fuel rods broke during cleaning, leaking radioactive gases", NONE_ZH, NONE_EN),
    Accident("2004-08-09", 1, POWER, 4, "Mihama steam explosion", "美濱核電廠蒸汽爆炸", "Mihama Nuclear Power Plant",
             "二次側管線破裂噴出蒸汽", "A secondary-circuit pipe burst and released steam", "4 人，7 人受傷（電廠事故表）", "4, with 7 injured (plant accident table)"),
    Accident("2005-04-19", 3, FUEL, 0, "THORP leak", "塞拉菲爾德 THORP 外洩", "Sellafield",
             "核燃料再處理廠的管線破裂，高放射性溶液漏出", "A pipe failure at the THORP reprocessing plant leaked highly radioactive solution", NONE_ZH, NONE_EN),
    Accident("2006-07-25", 2, POWER, 0, "Forsmark electrical fault", "福斯馬克核電廠電氣故障", "Forsmark Nuclear Power Plant",
             "電氣故障使冷卻爐心的安全系統多處失效", "An electrical fault disabled several safety systems needed to cool the reactor", NONE_ZH, NONE_EN),
    Accident("2010-04", None, SOURCE, 1, "Mayapuri radiological accident", "馬亞普里輻射事故", None,
             "大學賣出的鈷 60 照射器流入廢料市場", "A cobalt-60 irradiator sold by a university ended up in a scrap market",
             "1 人，8 人住院（死亡人數表）", "1, with 8 hospitalized (death-toll list)", coord=(77.13, 28.64)),
    Accident("2011-03-11", 7, POWER, 52, "Fukushima nuclear disaster", "福島第一核電廠事故", "Fukushima Daiichi Nuclear Power Plant",
             "地震引起的海嘯淹沒電廠，3 座運轉中的反應爐熔毀，大量放射性物質外洩，周邊居民撤離",
             "The earthquake’s tsunami flooded the plant; three operating reactors melted down and released radioactivity, and nearby residents were evacuated",
             "1 人死於輻射（日本政府的委員會 2018 年認定，有爭議），另有 3 人以上死於工安意外；日本政府說 51 人死於撤離，因撤離而死的病人與長者實際上更多（英文維基百科兩篇）",
             "1 radiation death (attributed by a Japanese government panel in 2018; disputed), plus 3 or more industrial accidents; the Japanese government says 51 died because of the evacuation, and more ill and elderly people died from it (two English Wikipedia articles)"),
    Accident("2011-03-11", 3, POWER, 0, "Fukushima Daini loss of cooling", "福島第二核電廠失去冷卻", "Fukushima Daini Nuclear Power Plant",
             "海嘯使冷卻用的海水系統失效", "The tsunami knocked out the service cooling water", NONE_ZH, NONE_EN),
    Accident("2011-09-12", None, FUEL, 1, "Marcoule furnace explosion", "馬庫勒核設施爆炸", "Marcoule Nuclear Site",
             "熔化金屬廢料的爐子爆炸", "A furnace melting metallic waste exploded", "1 人，4 人受傷（電廠事故表）", "1, with 4 injured (plant accident table)"),
]
