/**
 * i18n-ignore-file：最長的直飛航線（longest-flights.ts）的航空公司與機場的中文名稱，只在中文介面用，英文介面照維基條目的原文。
 */

/** 航空公司的中文名稱（條目的英文寫法 → 台灣的慣用名稱） */
export const AIRLINES_ZH: Record<string, string> = {
  'Aeroméxico': '墨西哥國際航空',
  'Air Canada': '加拿大航空',
  'Air India': '印度航空',
  'Air New Zealand': '紐西蘭航空',
  'Air Tahiti Nui': '大溪地航空',
  'American Airlines': '美國航空',
  'Cathay Pacific': '國泰航空',
  'China Southern': '中國南方航空',
  'Delta Air Lines': '達美航空',
  'EVA Air': '長榮航空',
  'El Al': '以色列航空',
  'Emirates': '阿聯酋航空',
  'Ethiopian Airlines': '衣索比亞航空',
  'Etihad Airways': '阿提哈德航空',
  'Garuda Indonesia': '印尼航空',
  'Hainan Airlines': '海南航空',
  'Northwest Airlines': '西北航空',
  'Philippine Airlines': '菲律賓航空',
  'Qantas': '澳洲航空',
  'Qatar Airways': '卡達航空',
  'Saudia': '沙烏地阿拉伯航空',
  'Singapore Airlines': '新加坡航空',
  'South African Airways': '南非航空',
  'Thai Airways International': '泰國國際航空',
  'United Airlines': '聯合航空',
};

/** 機場的中文名稱（airports.json 的 zh）；routes.json 只有 IATA，側欄與 tooltip 用這張表 */
export const AIRPORTS_ZH: Record<string, string> = {
  JFK: '紐約甘迺迪', EWR: '紐瓦克', SIN: '新加坡', AKL: '奧克蘭', DOH: '杜哈', PER: '伯斯', LHR: '倫敦希斯洛',
  DFW: '達拉斯沃斯堡', MEL: '墨爾本', CDG: '巴黎戴高樂', DXB: '杜拜', SZX: '深圳', MEX: '墨西哥城',
  LAX: '洛杉磯', IAH: '休士頓洲際', SYD: '雪梨', MNL: '馬尼拉', SFO: '舊金山', JNB: '約翰尼斯堡',
  ATL: '亞特蘭大', JED: '吉達', BNE: '布里斯本', FCO: '羅馬菲烏米奇諾', CPT: '開普敦', HKG: '香港',
  ADL: '阿得雷德', SEA: '西雅圖', PPT: '帕皮提', BKK: '曼谷蘇凡納布', DRW: '達爾文', TLV: '特拉維夫',
  BOM: '孟買', AUH: '阿布達比', HYD: '海德拉巴', ORD: '芝加哥歐海爾', IAD: '華盛頓杜勒斯', PVG: '上海浦東',
  DTW: '底特律', FLL: '勞德岱堡', TPE: '台灣桃園', 'HKG-KT': '香港啟德', DPS: '峇里島登巴薩', MIA: '邁阿密',
  LFW: '洛美', CKG: '重慶', GRU: '聖保羅瓜魯柳斯', MSP: '明尼亞波利斯', YYZ: '多倫多皮爾森', YVR: '溫哥華',
  // 最繁忙的航線與貨運機場（第十批 175，aviation-extra.ts）
  CJU: '濟州', CTS: '札幌新千歲', FUK: '福岡', HAN: '河內', HND: '東京羽田', PEK: '北京首都', SHA: '上海虹橋', CAN: '廣州',
  BOG: '波哥大', CAI: '開羅', KUL: '吉隆坡', ICN: '首爾仁川', CGK: '雅加達', CTU: '成都雙流', GMP: '首爾金浦', SGN: '胡志明市',
  RUH: '利雅德', OKA: '那霸', DEL: '德里', MDE: '麥德林', NRT: '東京成田', KIX: '大阪關西', ANC: '安克拉治', SDF: '路易維爾',
  MEM: '曼非斯',
};
