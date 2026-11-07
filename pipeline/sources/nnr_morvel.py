"""NNR-MORVEL56：56 塊板塊在無淨旋轉（no-net-rotation）參考框架下的角速度（2026-11-07，製作手冊 542 的候選 1225，使用者選這個來源）。

Argus, D. F., Gordon, R. G. & DeMets, C. (2011), Geologically current motion of 56 plates relative to the no-net-rotation
reference frame, Geochem. Geophys. Geosyst., 12, Q11001, doi:10.1029/2011GC003751，Table 1「NNR-MORVEL56 Plate Angular
Velocities」：歐拉極的緯度、經度（度）與角速度（度／百萬年）。25 塊 MORVEL 板塊（小寫代碼）＋ 31 塊 Bird 2003 的板塊（大寫）。
數值是論文表格裡的事實；2026-11-07 用 PyPI 套件 platemotion 0.1.7（MIT）附的 NNR_MRV56.csv 輸入，再跟論文 PDF 的 Table 1
逐列核對過，56 列都一樣。
"""

# 代碼 → (英文名, 歐拉極緯度, 經度, 角速度 °/Ma)
POLES: dict[str, tuple[str, float, float, float]] = {
    "am": ("Amur", 63.17, -122.82, 0.297),
    "an": ("Antarctica", 65.42, -118.11, 0.25),
    "ar": ("Arabia", 48.88, -8.49, 0.559),
    "au": ("Australia", 33.86, 37.94, 0.632),
    "cp": ("Capricorn", 44.44, 23.09, 0.608),
    "ca": ("Caribbean", 35.2, -92.62, 0.286),
    "co": ("Cocos", 26.93, -124.31, 1.198),
    "eu": ("Eurasia", 48.85, -106.5, 0.223),
    "in": ("India", 50.37, -3.29, 0.544),
    "jf": ("Juan de Fuca", -38.31, 60.04, 0.951),
    "lw": ("Lwandle", 51.89, -69.52, 0.286),
    "mq": ("Macquarie", 49.19, 11.05, 1.144),
    "nz": ("Nazca", 46.23, -101.06, 0.696),
    "na": ("North America", -4.85, -80.64, 0.209),
    "nb": ("Nubia", 47.68, -68.44, 0.292),
    "pa": ("Pacific", -63.58, 114.7, 0.651),
    "ps": ("Philippine Sea", -46.02, -31.36, 0.91),
    "ri": ("Rivera", 20.25, -107.29, 4.536),
    "sw": ("Sandwich", -29.94, -36.87, 1.362),
    "sc": ("Scotia", 22.52, -106.15, 0.146),
    "sm": ("Somalia", 49.95, -84.52, 0.339),
    "sa": ("South America", -22.62, -112.83, 0.109),
    "su": ("Sunda", 50.06, -95.02, 0.337),
    "sr": ("Sur", -32.5, -111.32, 0.107),
    "yz": ("Yangtze", 63.03, -116.62, 0.334),
    "AS": ("Aegean Sea", 19.43, 122.87, 0.124),
    "AP": ("Altiplano", -6.58, -83.98, 0.488),
    "AT": ("Anatolia", 40.11, 26.66, 1.21),
    "BR": ("Balmoral Reef", -63.74, 142.06, 0.49),
    "BS": ("Banda Sea", -1.49, 121.64, 2.475),
    "BH": ("Birds Head", -40.0, 100.5, 0.799),
    "BU": ("Burma", -6.13, -78.1, 2.229),
    "CL": ("Caroline", -72.78, 72.05, 0.607),
    "CR": ("Conway Reef", -20.4, 170.53, 3.923),
    "EA": ("Easter", 24.97, 67.53, 11.334),
    "FT": ("Futuna", -16.33, 178.07, 5.101),
    "GP": ("Galapagos", 2.53, 81.18, 5.487),
    "JZ": ("Juan Fernandez", 34.25, 70.74, 22.368),
    "KE": ("Kermadec", 39.99, 6.46, 2.347),
    "MN": ("Manus", -3.67, 150.27, 51.569),
    "MO": ("Maoke", 14.25, 92.67, 0.774),
    "MA": ("Mariana", 11.05, 137.84, 1.306),
    "MS": ("Molucca Sea", 2.15, -56.09, 3.566),
    "NH": ("New Hebrides", 0.57, -6.6, 2.469),
    "NI": ("Niuafo'ou", -3.29, -174.49, 3.314),
    "ND": ("North Andes", 17.73, -122.68, 0.116),
    "NB": ("North Bismarck", -45.04, 127.64, 0.856),
    "OK": ("Okhotsk", 30.3, -92.28, 0.229),
    "ON": ("Okinawa", 36.12, 137.92, 2.539),
    "PM": ("Panama", 31.35, -113.9, 0.317),
    "SL": ("Shetland", 50.71, -143.47, 0.268),
    "SS": ("Solomon Sea", -2.87, 130.62, 1.703),
    "SB": ("South Bismarck", 6.88, -31.89, 8.111),
    "TI": ("Timor", -4.44, 113.5, 1.864),
    "TO": ("Tonga", 25.87, 4.48, 8.942),
    "WL": ("Woodlark", 0.1, 128.52, 1.744),
}

# PB2002 的板塊代碼 → NNR-MORVEL56 的代碼（PB2002 的非洲在 MORVEL 是努比亞板塊，索馬利亞、揚子的代碼不同）
PB2002 = {
    "AF": "nb", "SO": "sm", "YA": "yz",
    **{c: c.lower() for c in ("AM", "AN", "AR", "AU", "CA", "CO", "EU", "IN", "JF", "NA", "NZ", "PA", "PS", "RI", "SA", "SC", "SU", "SW")},
}
