/**
 * 國家搜尋：比對繁中名稱、英文名稱、常用別名與 ISO 代碼，支援部分比對與英文拼錯一兩個字母。
 * 不管介面是哪種語言，兩種語言的名稱都能搜尋。
 *
 * i18n-ignore-file：這裡的中文是搜尋用的別名與簡繁對照，不會顯示在介面上。
 */
import { LOCALES, type Lang } from '../i18n/lang';
import { enName, zhName, type CountryTable } from './countries';

/**
 * 常用別名：中文俗稱、對岸譯名、英文縮寫與舊名。
 * 簡體字會先轉成繁體再比對（見 SIMPLIFIED），所以這裡只寫繁體。
 */
const ALIASES: Record<string, string[]> = {
  TWN: ['臺灣', '中華民國', 'ROC', 'Formosa', 'Republic of China'],
  CHN: ['中國大陸', '大陸', '中華人民共和國', '內地', 'PRC', 'Mainland China'],
  HKG: ['香港', 'HK'],
  MAC: ['澳門', 'Macau'],
  KOR: ['韓國', '大韓民國', 'Korea', 'ROK', 'Republic of Korea'],
  PRK: ['朝鮮', '北朝鮮', 'DPRK'],
  USA: ['美利堅', 'America', 'United States of America'],
  GBR: ['UK', 'Britain', 'Great Britain', 'England', '英格蘭', '大英', '聯合王國'],
  JPN: ['Nippon', 'Nihon'],
  DEU: ['Deutschland'],
  NLD: ['Holland', '尼德蘭'],
  RUS: ['俄國'],
  ARE: ['阿聯', '阿聯酋', '阿拉伯聯合酋長國', 'UAE', 'Emirates', '杜拜'],
  SAU: ['沙烏地', '沙特', '沙特阿拉伯', 'KSA'],
  NZL: ['新西蘭', 'NZ'],
  ITA: ['意大利'],
  AUS: ['澳大利亞'],
  IDN: ['印度尼西亞'],
  MYS: ['大馬'],
  MMR: ['Burma'],
  LAO: ['老撾'],
  THA: ['Siam', '暹羅'],
  TUR: ['Turkey'],
  CZE: ['Czech Republic', '捷克共和國'],
  CIV: ['Ivory Coast', '科特迪瓦'],
  COD: ['剛果民主共和國', '民主剛果', 'DRC', 'DR Congo'],
  COG: ['剛果共和國'],
  SWZ: ['Swaziland', '史瓦濟蘭'],
  MKD: ['Macedonia', '馬其頓'],
  CPV: ['佛得角'],
  TLS: ['East Timor'],
  VAT: ['Holy See', '教廷'],
  PSE: ['巴勒斯坦', 'Palestine'],
  IRN: ['Persia', '波斯'],
  LKA: ['Ceylon', '錫蘭'],
  VNM: ['Viet Nam'],
  CHE: ['Swiss'],
  GRC: ['Hellas'],
  BIH: ['波赫', '波黑', 'Bosnia'],
  ZAF: ['RSA'],
  // 對岸譯名
  KEN: ['肯尼亞'],
  TZA: ['坦桑尼亞'],
  NGA: ['尼日利亞'],
  GEO: ['格魯吉亞'],
  KAZ: ['哈薩克斯坦'],
  UZB: ['烏茲別克斯坦'],
  KGZ: ['吉爾吉斯斯坦'],
  TJK: ['塔吉克斯坦'],
  TKM: ['土庫曼斯坦'],
  HRV: ['克羅地亞'],
  SVN: ['斯洛文尼亞'],
  MNE: ['黑山'],
  YEM: ['也門'],
  QAT: ['卡塔爾'],
  CYP: ['塞浦路斯'],
  AZE: ['阿塞拜疆'],
  ETH: ['埃塞俄比亞'],
  SOM: ['索馬里'],
  ZMB: ['贊比亞'],
  ZWE: ['津巴布韋'],
  MOZ: ['莫桑比克'],
  GHA: ['加納'],
  TCD: ['乍得'],
  MLI: ['馬里'],
  NER: ['尼日爾'],
  MRT: ['毛里塔尼亞'],
  SLE: ['塞拉利昂'],
  LBR: ['利比里亞'],
  GMB: ['岡比亞'],
  GAB: ['加蓬'],
  RWA: ['盧旺達'],
  BDI: ['布隆迪'],
  BWA: ['博茨瓦納'],
  DJI: ['吉布提'],
  ERI: ['厄立特里亞'],
  TUN: ['突尼斯'],
  CRI: ['哥斯達黎加'],
  GTM: ['危地馬拉'],
  HND: ['洪都拉斯'],
  BLZ: ['伯利茲'],
  GUY: ['圭亞那'],
  SUR: ['蘇里南'],
  MDV: ['馬爾代夫'],
  MUS: ['毛里求斯'],
  SYC: ['塞舌爾'],
  BRN: ['文萊'],
  PNG: ['巴布亞新幾內亞'],
  SLB: ['所羅門群島'],
  VUT: ['瓦努阿圖'],
  TON: ['湯加'],
  TUV: ['圖瓦盧'],
  MLT: ['馬耳他'],
  LIE: ['列支敦士登'],
  SMR: ['聖馬力諾'],
  BRB: ['巴巴多斯'],
  TTO: ['特立尼達和多巴哥'],
  BGD: ['孟加拉國'],
};

/** 國名常見的簡體字 → 繁體字（逐字對應） */
const SIMPLIFIED = '国湾韩罗亚兰尔乌马纳达维鲁伦东门约叙联苏贝宁冈刚麦几内韦莱岛爱腊奥顿脱兹别库缅挝鲜宾济汤图劳绍卢买赞萨坚华来时泽叶锡纽';
const TRADITIONAL = '國灣韓羅亞蘭爾烏馬納達維魯倫東門約敘聯蘇貝寧岡剛麥幾內韋萊島愛臘奧頓脫茲別庫緬撾鮮賓濟湯圖勞紹盧買贊薩堅華來時澤葉錫紐';
const TO_TRADITIONAL = new Map([...SIMPLIFIED].map((c, i) => [c, TRADITIONAL[i]]));

const CJK = /[㐀-鿿]/;

/** 小寫、去掉重音符號、全形轉半形、簡轉繁、「臺」統一成「台」，標點換成空白 */
export function normalize(text: string): string {
  return [...text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()]
    .map((c) => (c === '臺' ? '台' : (TO_TRADITIONAL.get(c) ?? c)))
    .join('')
    .replace(/[\s.,'’‘&()（）\-‐–—·・_/:;]+/g, ' ')
    .trim();
}

export interface SearchKey {
  /** 去掉空白的版本，用來比對 */
  compact: string;
  /** 每個英文單字在 compact 裡的起點，「korea」才能比對到「south korea」 */
  starts: number[];
  latin: boolean;
  /** 同分時的偏好：繁中名稱 > 英文名稱 > 別名 */
  weight: number;
}

export interface SearchEntry {
  iso3: string;
  iso2: string | null;
  zh: string;
  en: string;
  keys: SearchKey[];
}

export function makeKey(text: string, weight: number): SearchKey | null {
  const words = normalize(text).split(' ').filter(Boolean);
  if (!words.length) return null;
  const starts: number[] = [];
  let offset = 0;
  for (const w of words) {
    starts.push(offset);
    offset += w.length;
  }
  const compact = words.join('');
  return { compact, starts, latin: !CJK.test(compact), weight };
}

export function buildSearchIndex(codes: Iterable<string>, table: CountryTable | null): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const iso3 of new Set(codes)) {
    const iso2 = table?.[iso3]?.iso2 ?? null;
    const zh = zhName(iso3, table);
    const en = enName(iso3, table);
    const texts: [string, number][] = [
      [zh, 3],
      [en, 2],
      [table?.[iso3]?.name ?? '', 2], // 資料表的英文名（例如 Russian Federation、Cabo Verde）
      ...(ALIASES[iso3] ?? []).map((a): [string, number] => [a, 1]),
    ];
    const keys = texts.map(([t, w]) => makeKey(t, w)).filter((k): k is SearchKey => k !== null);
    out.push({ iso3, iso2, zh, en, keys });
  }
  return out;
}

/**
 * query 與 s 的某個開頭片段之間的編輯距離（含相鄰字母對調），超過 max 就提早放棄。
 * 用來容忍英文拼錯：「germny」→ Germany、「jpaan」→ Japan。
 */
function prefixDistance(q: string, s: string, max: number): number {
  const n = Math.min(s.length, q.length + max);
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= q.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = q[i - 1] === s[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && q[i - 1] === s[j - 2] && q[i - 2] === s[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      cur.push(d);
      rowMin = Math.min(rowMin, d);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return Math.min(...prev.slice(1));
}

/** query 的字依序出現在 s 裡（中間可以跳過字），回傳涵蓋的長度；不符合回傳 -1 */
function subsequenceSpan(q: string, s: string): number {
  let first = -1;
  let pos = -1;
  for (const c of q) {
    pos = s.indexOf(c, pos + 1);
    if (pos < 0) return -1;
    if (first < 0) first = pos;
  }
  return pos - first + 1;
}

export function scoreKey(q: string, key: SearchKey): number {
  const { compact, starts, latin } = key;
  const tiebreak = key.weight - compact.length / 100; // 同一級裡，名稱越短越前面
  if (compact === q) return 900 + tiebreak;
  if (compact.startsWith(q)) return 800 + tiebreak;
  if (starts.some((s) => s > 0 && compact.startsWith(q, s))) return 700 + tiebreak;
  const cjk = !latin || CJK.test(q);
  // 一兩個英文字母的中間片段太雜（「us」會比對到 Russia、Cyprus），只比開頭
  if ((cjk || q.length >= 3) && compact.includes(q)) return 500 + tiebreak;
  // 跳字比對：中文「沙阿」→ 沙烏地阿拉伯；英文要從單字開頭算起，否則「usa」會比對到 Russia
  if (cjk ? q.length >= 2 : q.length >= 3) {
    const span = cjk
      ? subsequenceSpan(q, compact)
      : Math.min(...starts.map((s) => (compact[s] === q[0] ? subsequenceSpan(q, compact.slice(s)) : Infinity)));
    if (span > 0 && span <= q.length * (cjk ? 3 : 2)) return 300 - span + tiebreak;
  }
  if (latin && q.length >= 4 && !CJK.test(q)) {
    const max = q.length >= 7 ? 2 : 1;
    let best = max + 1;
    for (const s of starts) best = Math.min(best, prefixDistance(q, compact.slice(s), max));
    if (best <= max) return 200 - best * 50 + tiebreak;
  }
  return 0;
}

export interface SearchHit {
  entry: SearchEntry;
  score: number;
}

export function searchCountries(index: SearchEntry[], query: string, lang: Lang = 'zh', limit = 8): SearchHit[] {
  const q = normalize(query).replace(/ /g, '');
  if (!q) return [];
  const isCode = /^[a-z]{2,3}$/.test(q);
  const hits: SearchHit[] = [];
  for (const entry of index) {
    let score = 0;
    // ISO 代碼只接受完全相符（TW、TWN），否則兩三個字母會比對到一大堆國家
    if (isCode && (q === entry.iso2?.toLowerCase() || q === entry.iso3.toLowerCase())) score = 1000;
    for (const key of entry.keys) score = Math.max(score, scoreKey(q, key));
    if (score > 0) hits.push({ entry, score });
  }
  hits.sort((a, b) => b.score - a.score || a.entry[lang].localeCompare(b.entry[lang], LOCALES[lang]));
  // 已經有名稱相符的結果時，拼錯容忍找到的（「hong」→ Tonga、Hungary）只是雜訊
  const strong = hits.length > 0 && hits[0].score >= 500;
  return (strong ? hits.filter((h) => h.score >= 250) : hits).slice(0, limit);
}
