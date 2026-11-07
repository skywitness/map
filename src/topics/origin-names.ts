import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 原產地名稱：受保護的地理標示（新主題，2026-11-07，製作手冊第二十四批 430；pipeline/topics/origin_names.py）。
 * 歐盟 eAmbrosia 登記簿的各國件數（使用者用瀏覽器匯出的 Excel），台灣用智慧財產局的產地標章（證明標章、團體商標），
 * 國內的依商標權人畫在鄉鎮上。兩邊的制度不同，件數不能直接比。
 */

/** 台灣產地標章的商品種類（pipeline 的 PRODUCTS） */
const PRODUCTS: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '米', en: 'Rice' }, color: MAP_TOKENS.categorical[4] },
  { value: 2, label: { zh: '茶', en: 'Tea' }, color: MAP_TOKENS.categorical[3] },
  { value: 3, label: { zh: '水果', en: 'Fruit' }, color: MAP_TOKENS.categorical[5] },
  { value: 4, label: { zh: '咖啡', en: 'Coffee' }, color: '#7a4a2a' },
  { value: 5, label: { zh: '酒', en: 'Alcohol' }, color: MAP_TOKENS.categorical[6] },
  { value: 6, label: { zh: '畜產品、水產品及加工品', en: 'Livestock and seafood' }, color: MAP_TOKENS.categorical[0] },
  { value: 7, label: { zh: '其他農產品及加工品', en: 'Other farm products' }, color: MAP_TOKENS.categorical[2] },
  { value: 8, label: { zh: '工藝品及其他', en: 'Crafts and other' }, color: MAP_TOKENS.categorical[1] },
];
const productLabel = (p: PointRecord) => tr(PRODUCTS.find((k) => k.value === p.k)?.label ?? PRODUCTS[6].label);
const markKind = (p: PointRecord) => tr(p.c === 1 ? { zh: '證明標章', en: 'certification mark' } : { zh: '團體商標', en: 'collective mark' });
const since = (p: PointRecord) => (typeof p.y === 'number' ? tr({ zh: `${p.y} 年起`, en: `since ${p.y}` }) : null);
const join = (parts: (string | null)[]) => parts.filter(Boolean).join(tr({ zh: '・', en: ' · ' }));
const title = (p: PointRecord) =>
  tr({ zh: `${String(p.p ?? '')}的${productLabel(p)}`, en: `${productLabel(p)}, ${String(p.p ?? '')}` });

const MARKS: PointsOverlayDef = {
  kind: 'points',
  id: 'taiwan-marks',
  file: 'taiwan-marks.json',
  label: { zh: '台灣的產地標章（依商標權人所在地）', en: 'Taiwan origin marks (by holder’s location)' },
  radius: 5,
  color: { field: 'k', title: { zh: '商品', en: 'Product' }, thresholds: PRODUCTS.slice(1).map((p) => p.value), classes: PRODUCTS },
  tooltip: (p) => ({
    title: title(p),
    detail: join([markKind(p), since(p)]),
    extra: [String(p.h ?? '')],
  }),
};

const MARK_LIST: ListPanelDef = {
  label: { zh: '台灣的產地標章', en: 'Taiwan origin marks' },
  file: 'taiwan-marks.json',
  rows: (points) => {
    const collator = new Intl.Collator(getLang() === 'zh' ? 'zh-Hant-TW' : 'en');
    return [...points]
      .sort((a, b) => Number(a.k) - Number(b.k) || collator.compare(String(a.p), String(b.p)) || Number(a.y) - Number(b.y))
      .map((p, i): ListRow => ({
        key: `m${i}`,
        title: title(p),
        lines: [join([markKind(p), since(p), tr({ zh: `註冊號 ${String(p.no ?? '')}`, en: `Reg. no. ${String(p.no ?? '')}` })]), String(p.h ?? '')],
        group: productLabel(p),
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 10 },
        ...(typeof p.u === 'string' && p.u ? { link: { href: p.u, label: tr({ zh: '智慧財產局的標章資料', en: 'TIPO record' }) } } : {}),
      }));
  },
};

const NAMES = { zh: '個', en: 'names' };
const count = (v: number) => tr({ zh: `${fixed(v, 0)} 個`, en: `${fixed(v, 0)} ${v === 1 ? 'name' : 'names'}` });
const EU_SOURCE_NOTE = {
  zh: '歐盟以外的國家（中國、英國、土耳其、泰國…）是經由雙邊協定或直接申請登記在歐盟的名稱，不是那個國家自己保護的全部。',
  en: 'Countries outside the EU (China, the UK, Türkiye, Thailand…) appear through bilateral agreements or direct applications; these are not all the names they protect at home.',
};

function euIndicator(id: string, label: Text, description: Text, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: NAMES,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: count,
    formatTick: (v) => `${v}`,
    integer: true,
    panelChart: false,
    missing: { zh: '沒有在歐盟登記的名稱', en: 'No names in the EU register' },
  };
}

export const originNames: TopicDefinition = {
  id: 'origin-names',
  title: { zh: '原產地名稱：受保護的地理標示', en: 'Protected names of origin' },
  shortTitle: { zh: '原產地名稱', en: 'Names of origin' },
  defaultIndicator: 'eu-gi',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: '歐盟執委會 eAmbrosia 地理標示登記簿（2026 年 11 月 5 日匯出）', en: 'European Commission, eAmbrosia register of geographical indications (exported 5 November 2026)' },
      url: 'https://ec.europa.eu/agriculture/eambrosia/geographical-indications-register/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '經濟部智慧財產局 臺灣產地標章註冊資訊', en: 'Taiwan Intellectual Property Office, registered origin marks' },
      url: 'https://data.gov.tw/dataset/59715',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '歐盟的地理標示是專門的登記制度（受保護的原產地名稱 PDO、受保護的地理標示 PGI，烈酒是 GI），資料是歐盟執委會 eAmbrosia 登記簿 2026 年 11 月 5 日的匯出（© 歐盟，CC BY 4.0；名稱本身是工業財產權，這裡只當事實列出件數），只算已登記的；好幾國共有的名稱每國各算一次。' +
      EU_SOURCE_NOTE.zh +
      '台灣沒有這種專門的登記制度，產地名稱是依商標法註冊成證明標章或團體商標（智慧財產局的產地標章清單，132 件，78 件是國內的、54 件是外國在台灣註冊的），兩種制度不同，件數不能直接比較。台灣的點畫在商標權人（鄉鎮公所、農會、縣市政府）所在的鄉鎮或縣市，不是產區的範圍。',
    en: 'EU geographical indications are a dedicated register (protected designations of origin, PDO, and protected geographical indications, PGI; GI for spirits). The data are the European Commission’s eAmbrosia register as exported on 5 November 2026 (© European Union, CC BY 4.0; the names themselves are industrial property and are only counted here), registered names only; names shared by several countries count once for each. ' +
      EU_SOURCE_NOTE.en +
      ' Taiwan has no such register: names of origin are registered under trademark law as certification or collective marks (the IP Office’s list of origin marks: 132, of which 78 are domestic and 54 foreign names registered in Taiwan), so the counts are not comparable. Taiwan’s dots sit at the township or county of the mark holder (township office, farmers’ association or county government), not the extent of the production area.',
  },
  overlays: [{ ...MARKS, indicators: ['eu-gi', 'eu-gi-food', 'eu-gi-wine', 'eu-gi-spirits', 'taiwan-registered'] }],
  listPanel: MARK_LIST,
  indicators: [
    euIndicator(
      'eu-gi',
      { zh: '歐盟登記的地理標示', en: 'Names in the EU register' },
      {
        zh: '在歐盟 eAmbrosia 登記簿裡已登記的地理標示（食品、葡萄酒、烈酒，2026 年 11 月），共 3,730 個、52 國：義大利 891、法國 776、西班牙 398、希臘 283、葡萄牙 207、德國 179、中國 110、匈牙利 93、英國 82、羅馬尼亞 79。食品 1,814 個、葡萄酒 1,651、烈酒 265；滑過看各類與 PDO、PGI 的個數。台灣沒有在歐盟登記，地圖上的點是台灣自己的產地標章。',
        en: 'Registered geographical indications in the EU’s eAmbrosia register (food, wine and spirits, November 2026): 3,730 in 52 countries. Italy has 891, France 776, Spain 398, Greece 283, Portugal 207, Germany 179, China 110, Hungary 93, the UK 82 and Romania 79. Food accounts for 1,814, wine 1,651 and spirits 265; hover for the breakdown by type and PDO or PGI. Taiwan has none in the EU register; the dots are Taiwan’s own origin marks.',
      },
      [5, 20, 50, 100, 250, 500],
    ),
    euIndicator(
      'eu-gi-food',
      { zh: '食品', en: 'Food' },
      {
        zh: '歐盟登記的農產品與食品地理標示（乳酪、火腿、蔬果、麵包、橄欖油…，含已轉進食品制度的加味酒），共 1,814 個：義大利 333、法國 283、西班牙 230、葡萄牙 152、希臘 121、中國 99、德國 97、英國 71。',
        en: 'Food and agricultural geographical indications in the EU register (cheeses, hams, fruit and vegetables, bread, olive oil…, including aromatised wines now under the food scheme): 1,814. Italy has 333, France 283, Spain 230, Portugal 152, Greece 121, China 99, Germany 97 and the UK 71.',
      },
      [5, 20, 50, 100, 200],
    ),
    euIndicator(
      'eu-gi-wine',
      { zh: '葡萄酒', en: 'Wine' },
      {
        zh: '歐盟登記的葡萄酒地理標示，共 1,651 個：義大利 522、法國 440、西班牙 149、希臘 147、羅馬尼亞 54、保加利亞 54、德國 46、葡萄牙 44。產區的範圍在「菸酒」主題的「葡萄酒法定產區」。',
        en: 'Wine geographical indications in the EU register: 1,651. Italy has 522, France 440, Spain 149, Greece 147, Romania 54, Bulgaria 54, Germany 46 and Portugal 44. The areas are mapped under “Wine PDOs” in the Tobacco and alcohol topic.',
      },
      [5, 20, 50, 100, 300],
    ),
    euIndicator(
      'eu-gi-spirits',
      { zh: '烈酒', en: 'Spirits' },
      {
        zh: '歐盟登記的烈酒地理標示，共 265 個：法國 53、義大利 36、德國 36、西班牙 19、匈牙利 16、希臘 15。',
        en: 'Spirit drink geographical indications in the EU register: 265. France has 53, Italy 36, Germany 36, Spain 19, Hungary 16 and Greece 15.',
      },
      [2, 5, 10, 20, 40],
    ),
    {
      id: 'taiwan-registered',
      label: { zh: '在台灣註冊的產地標章', en: 'Origin marks registered in Taiwan' },
      description: {
        zh: '智慧財產局的產地標章 132 件，依原產地分：台灣 78 件（證明標章 41、團體商標 37；其他農產品及加工品 26、米 15、茶 15、水果 14、咖啡 4、畜產水產品 3、工藝品 1），最早是 2000 年雲林縣古坑鄉農會的咖啡團體商標，2003 年起有池上米的證明標章；外國在台灣註冊的 54 件：日本 24、義大利 10、中國大陸 9、印度、越南、英國、愛爾蘭各 2，斯里蘭卡、美國、南韓各 1。地圖上的點是國內的 78 件，左邊的清單依商品列出，附智慧財產局的標章資料連結。',
        en: 'The Taiwan IP Office lists 132 origin marks. By origin: Taiwan 78 (41 certification and 37 collective marks; other farm products 26, rice 15, tea 15, fruit 14, coffee 4, livestock and seafood 3, crafts 1), the earliest being the Gukeng Farmers’ Association’s coffee mark from 2000, with Chishang rice certified since 2003; 54 foreign names are registered in Taiwan: Japan 24, Italy 10, mainland China 9, India, Vietnam, the UK and Ireland 2 each, and Sri Lanka, the US and South Korea 1 each. The dots are the 78 domestic marks; the list on the left groups them by product and links to the IP Office record.',
      },
      unit: { zh: '件', en: 'marks' },
      file: 'taiwan-registered.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 25] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 件`, en: `${fixed(v, 0)} ${v === 1 ? 'mark' : 'marks'}` }),
      formatTick: (v) => `${v}`,
      integer: true,
      panelChart: false,
      missing: { zh: '沒有在台灣註冊產地標章', en: 'No origin marks registered in Taiwan' },
    },
  ],
};
