"""熊貓外交：中國贈送或租借大熊貓到哪些國家的哪些動物園（手工整理，2026-10-29）。

**出處**（英文維基百科，CC BY-SA 4.0，固定版本；這份表是衍生資料，依 CC BY-SA 4.0 分享）：
- PD：「Panda diplomacy」revid 1379504972（2026-10-10）的 History 各節
- LGP：「List of giant pandas」revid 1382419942（2026-10-28）的「In zoos」與存活、已死亡的表
- TT：「Tuan Tuan and Yuan Yuan」revid 1382543516（台灣那一筆）

每一列是一次到某個動物園（同一個動物園先贈送、後來又租借的分成兩列）：
(動物園的英文維基條目〔重新導向的寫導向後的名稱；沒有寫是哪個動物園的是 None〕, 國家 ISO3, 開始的年份, 結束的年份〔還在是 None；
條目沒寫的也是 None，tooltip 寫「條目沒寫」〕, 種類, 熊貓的名字, 中文說明, 英文說明, 出處)。

種類：1 中華民國贈送（1941）、2 中華人民共和國贈送（1957–1983）、3 短期出借（1984–1988，幾個月）、
4 長期租借（1984 年以後，通常 10 年一約，名義是合作研究）、5 台灣（只寫事實，不寫政治定性：使用者 2026-10-29 決定）。
開始的年份條目沒寫、只知道某一年已經在的（例如那一年在那裡出生了幼仔），寫那一年並在說明寫「最晚」。
香港（2007）、澳門的熊貓是中國境內，不算。條目沒有任何年份的（孟菲斯動物園、神戶王子動物園、卡達的豪爾家庭公園）不收。
"""
from __future__ import annotations

GIFT_ROC, GIFT, SHORT, LOAN, TAIWAN = 1, 2, 3, 4, 5

PLACEMENTS: list[tuple[str | None, str, int, int | None, int, str, str, str, str]] = [
    ("Bronx Zoo", "USA", 1941, None, GIFT_ROC, "Pan-dee, Pan-dah",
     "抗戰時中華民國（宋美齡）贈送給美國，感謝援助；12 月 30 日送到布朗克斯動物園", "Given by the Republic of China (Madame Chiang) to thank the US for its wartime aid; received by the Bronx Zoo on 30 December 1941", "PD"),
    (None, "RUS", 1957, None, GIFT, "",
     "蘇聯收到中華人民共和國的第一批熊貓「親善大使」，1959 年又送一次（條目沒寫哪個動物園，畫在莫斯科）", "The Soviet Union received the first panda “goodwill ambassadors”, and more in 1959 (the zoo is not named; shown at Moscow)", "PD"),
    ("Korea Central Zoo", "PRK", 1965, None, GIFT, "",
     "毛澤東贈送，到 1980 年又送了四次", "A gift from Mao Zedong; four more followed by 1980", "PD, LGP"),
    ("National Zoological Park (United States)", "USA", 1972, 1999, GIFT, "Ling-Ling, Hsing-Hsing",
     "尼克森訪問中國後贈送（美國回贈兩頭麝牛）；Ling-Ling 1992 年、Hsing-Hsing 1999 年死亡", "Given after Nixon’s visit (the US gave two musk oxen in return); Ling-Ling died in 1992 and Hsing-Hsing in 1999", "PD, LGP"),
    (None, "JPN", 1972, None, GIFT, "",
     "中日建交後贈送；日本從 1972 年起一直有熊貓，直到 2026 年 1 月（條目沒寫哪個動物園，畫在東京）", "Given after China and Japan normalised relations; Japan then hosted pandas continuously until January 2026 (the zoo is not named; shown at Tokyo)", "PD"),
    (None, "FRA", 1973, None, GIFT, "",
     "建交後贈送（條目沒寫哪個動物園，畫在巴黎）", "Given after diplomatic ties were established (the zoo is not named; shown at Paris)", "PD"),
    ("London Zoo", "GBR", 1974, None, GIFT, "Chia-Chia, Ching-Ching",
     "英國首相希思訪問中國時要的，幾週後送到倫敦動物園", "Requested by Prime Minister Edward Heath during his 1974 visit; they arrived at London Zoo a few weeks later", "PD"),
    ("Chapultepec Zoo", "MEX", 1975, None, GIFT, "Pe Pe, Ying Ying",
     "9 月 10 日贈送；這裡是中國以外第一個繁殖成功的動物園，墨西哥至今擁有這裡出生的熊貓", "Given on 10 September 1975; the first zoo outside China to breed pandas, and Mexico still owns the pandas born there", "PD, LGP"),
    ("Zoo Aquarium de Madrid", "ESP", 1978, None, GIFT, "Shao Shao, Chang Chang",
     "1982 年在這裡出生了 Chulin，歐洲第一隻在動物園出生的熊貓", "Chulin, the first giant panda born in Europe, was born here in 1982", "PD, LGP"),
    ("Berlin Zoo", "DEU", 1980, 2012, GIFT, "Bao Bao",
     "贈送給西德；Bao Bao 2012 年死亡（條目只寫西德 1980 年收到，柏林動物園曾有 Bao Bao）", "Given to West Germany; Bao Bao died in 2012 (the article says West Germany received pandas in 1980, and Berlin Zoo was home to Bao Bao)", "PD, LGP"),
    ("Los Angeles Zoo", "USA", 1984, 1984, SHORT, "",
     "洛杉磯奧運期間短期出借，每隻每月 5 萬美元；從這一年起中國改成租借、不再贈送", "Lent short-term for the Los Angeles Olympics at $50,000 a month per panda; from this year China leased pandas instead of giving them", "PD"),
    ("San Francisco Zoo", "USA", 1984, 1985, SHORT, "", "1984、1985 年短期出借", "Lent short-term in 1984–85", "PD"),
    ("Toronto Zoo", "CAN", 1985, 1985, SHORT, "", "1984、1985 年短期出借", "Lent short-term in 1984–85", "PD"),
    ("Bronx Zoo", "USA", 1987, 1988, SHORT, "", "短期出借一隻公的、一隻正值生育年齡的母的，引起保育團體批評", "A non-breeding male and a breeding-age female on short-term loan, which alarmed conservationists", "PD"),
    ("Busch Gardens Tampa Bay", "USA", 1987, 1988, SHORT, "", "1987、1988 年短期出借", "Lent short-term in 1987–88", "PD"),
    ("Toledo Zoo & Aquarium", "USA", 1988, 1988, SHORT, "", "100 天的短期出借，世界自然基金會等提告；這一年中國結束短期出借", "A 100-day loan challenged in court by WWF and others; China ended short-term loans that year", "PD"),
    ("Calgary Zoo", "CAN", 1988, 1988, SHORT, "", "卡加利冬季奧運期間短期出借", "Lent short-term for the 1988 Calgary Winter Olympics", "PD"),
    ("San Diego Zoo", "USA", 1999, 2019, LOAN, "Bai Yun",
     "長期租借（最晚 1999 年：Hua Mei 在這裡出生），2019 年送回中國", "Long-term loan (by 1999 at the latest, when Hua Mei was born here); returned to China in 2019", "PD, LGP"),
    ("Chiang Mai Zoo", "THA", 2003, 2023, LOAN, "Chuang Chuang, Lin Hui",
     "2009 年生了 Lin Bing；Chuang Chuang 2019 年、Lin Hui 2023 年死亡", "Lin Bing was born in 2009; Chuang Chuang died in 2019 and Lin Hui in 2023", "PD, LGP"),
    ("National Zoological Park (United States)", "USA", 2005, 2023, LOAN, "Mei Xiang, Tian Tian",
     "長期租借（最晚 2005 年：Tai Shan 在這裡出生），2023 年 11 月送回中國", "Long-term loan (by 2005 at the latest, when Tai Shan was born here); returned to China in November 2023", "PD, LGP"),
    ("Adventure World (Japan)", "JPN", 2006, 2025, LOAN, "Ei Mei, Mei Mei, Rau Hin",
     "最晚 2006 年（那年 12 月在這裡生了雙胞胎）；2025 年全部送回", "By 2006 at the latest (twins were born here that December); all had left by 2025", "LGP"),
    ("Zoo Atlanta", "USA", 2006, 2024, LOAN, "Lun Lun, Yang Yang",
     "長期租借（最晚 2006 年：Mei Lan 在這裡出生），2024 年送回中國", "Long-term loan (by 2006 at the latest, when Mei Lan was born here); returned to China in 2024", "PD, LGP"),
    ("Schönbrunn Zoo", "AUT", 2007, None, LOAN, "Yang Yang, Long Hui",
     "最晚 2007 年（Fu Long 在這裡出生，25 年來歐洲第一隻）", "By 2007 at the latest (Fu Long, the first born in Europe in 25 years, was born here)", "LGP"),
    ("Zoo Aquarium de Madrid", "ESP", 2007, None, LOAN, "Bing Xing, Hua Zuiba", "2007 年起；2010 年生了雙胞胎", "From 2007; twins were born in 2010", "LGP"),
    ("Ueno Zoo", "JPN", 2008, 2026, LOAN, "Ri Ri, Shin Shin",
     "胡錦濤 2008 年訪日時宣布租借；Ri Ri、Shin Shin 2024 年 9 月送回，在這裡出生的雙胞胎 2026 年 1 月送回（中日外交危機）", "Announced during Hu Jintao’s 2008 visit to Japan; Ri Ri and Shin Shin returned in September 2024 and their twins born here in January 2026, amid a China–Japan diplomatic crisis", "PD, LGP"),
    ("Taipei Zoo", "TWN", 2008, None, TAIWAN, "團團 Tuan Tuan, 圓圓 Yuan Yuan",
     "2008 年 12 月 23 日從中國送到臺北市立動物園；之後生了圓仔（2013 年）、圓寶（2020 年）；團團 2022 年死亡", "Arrived from China at Taipei Zoo on 23 December 2008; Yuan Zai was born in 2013 and Yuan Bao in 2020; Tuan Tuan died in 2022", "PD, TT"),
    ("Adelaide Zoo", "AUS", 2009, 2024, LOAN, "Wang Wang, Fu Ni",
     "2009 年 11 月 28 日到，2024 年 11 月送回", "Arrived on 28 November 2009 and returned in November 2024", "LGP"),
    ("Edinburgh Zoo", "GBR", 2011, 2023, LOAN, "Tian Tian, Yang Guang",
     "10 年一約，延長兩年後 2023 年 12 月送回；英國從此沒有熊貓", "A 10-year lease extended by two years; returned in December 2023, leaving the UK without pandas", "PD, LGP"),
    ("River Wonders", "SGP", 2012, None, LOAN, "Kai Kai, Jia Jia", "2021 年生了 Le Le", "Le Le was born in 2021", "LGP"),
    ("ZooParc de Beauval", "FRA", 2012, None, LOAN, "Huan Huan, Yuan Zi", "2012 年 1 月 15 日起", "From 15 January 2012", "LGP"),
    ("Pairi Daiza", "BEL", 2014, None, LOAN, "Hao Hao, Xing Hui", "2014 年 2 月起", "From February 2014", "LGP"),
    ("National Zoo of Malaysia", "MYS", 2014, None, LOAN, "Fu Wa, Feng Yi",
     "紀念建交 40 年，因馬航 MH370 延到 5 月 21 日才到", "Marking 40 years of ties; delayed by the MH370 disaster until 21 May 2014", "PD, LGP"),
    ("Taman Safari", "IDN", 2017, None, LOAN, "Hu Chun, Cai Tao", "紀念建交 60 年，2017 年 9 月 28 日到", "Marking 60 years of ties; arrived on 28 September 2017", "PD, LGP"),
    ("Berlin Zoo", "DEU", 2017, None, LOAN, "Jiao Qing, Meng Meng", "繁殖租借；2019、2024 年各生了一對雙胞胎", "A breeding loan; twins were born in 2019 and 2024", "LGP"),
    ("Ouwehands Dierenpark", "NLD", 2017, None, LOAN, "Xing Ya, Wu Wen", "2017 年 4 月起", "From April 2017", "LGP"),
    ("Ähtäri Zoo", "FIN", 2018, 2024, LOAN, "Lumi, Pyry",
     "芬蘭表態支持一個中國政策後同意照顧；每年 150 萬歐元的開銷沒有政府補助，2024 年 11 月提早送回", "Agreed after Finland endorsed the one-China policy; returned early in November 2024 because of the €1.5 million yearly cost", "PD, LGP"),
    ("Copenhagen Zoo", "DNK", 2019, None, LOAN, "Mao Sun, Xing Er", "2019 年 4 月起", "From April 2019", "PD, LGP"),
    ("Moscow Zoo", "RUS", 2019, None, LOAN, "Ding Ding, Ru Yi",
     "普丁訪問北京後送到，租借 15 年；2023 年生了 Katyusha", "Sent after Putin’s visit to Beijing on a 15-year lease; Katyusha was born in 2023", "PD, LGP"),
    ("Everland", "KOR", 2020, None, LOAN, "Le Bao, Ai Bao", "最晚 2020 年（福寶在這裡出生，南韓第一隻）", "By 2020 at the latest (Fu Bao, the first panda born in South Korea, was born here)", "LGP"),
    ("San Diego Zoo", "USA", 2024, None, LOAN, "Yun Chuan, Xin Bao", "2024 年 6 月底到，睽違將近五年", "Arrived in late June 2024, nearly five years after the last pair left", "PD"),
    ("National Zoological Park (United States)", "USA", 2024, None, LOAN, "Bao Li, Qing Bao", "2024 年 10 月 15 日到", "Arrived on 15 October 2024", "PD"),
    ("Adelaide Zoo", "AUS", 2024, None, LOAN, "Xing Qiu, Yi Lan", "2024 年 12 月到，南半球僅有的熊貓", "Arrived in December 2024; the only giant pandas in the southern hemisphere", "LGP"),
    ("Zoo Atlanta", "USA", 2026, None, LOAN, "Ping Ping, Fu Shuang",
     "10 年合作協議，習近平訪美時確認，2026 年 9 月 27 日到", "A 10-year partnership confirmed during Xi Jinping’s visit to the US; arrived on 27 September 2026", "PD, LGP"),
]

# 中國這一端：中華民國那一次從重慶交接；之後的從四川成都（大熊貓的家鄉，各國的熊貓多半來自四川的繁殖基地）畫弧線
ORIGIN_ROC = (106.55, 29.56)
ORIGIN = (104.07, 30.67)
