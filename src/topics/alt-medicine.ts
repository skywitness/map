import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';
import { withTerritories } from './osm-territories';

/**
 * 傳統與替代醫學的據點（新主題，2026-11-08，製作手冊第二十九批 688，候選 1563–1567；pipeline/topics/alt_medicine.py）：
 * OpenStreetMap 的 healthcare=alternative 加上 healthcare:speciality 是七類傳統或替代醫學的物件，預設看中醫；
 * 各國以哪一類為主（類別圖）、草藥店（shop=herbalist）與每百家藥局的草藥店。點多（約 3 萬）、各類在地理上分得開，
 * 所以縮小時聚成甜甜圈看各類的比例。台灣的提示對照衛福部統計處的官方家數。
 */
const C = MAP_TOKENS.categorical;
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const osmName = (p: PointRecord) =>
  (getLang() === 'zh' ? (str(p.nz) ?? str(p.n) ?? str(p.ne)) : (str(p.ne) ?? str(p.n))) ?? tr({ zh: '（沒有名稱）', en: '(unnamed)' });
const osmProper = (p: PointRecord) => (getLang() === 'en' && !str(p.ne) && str(p.n) ? String(p.n) : undefined);
/** 清單的排序：有名稱的在前，再依名稱 */
const byName = (a: PointRecord, b: PointRecord) => Number(!str(a.n)) - Number(!str(b.n)) || osmName(a).localeCompare(osmName(b));

/** 種類的代號（資料檔的 k），順序同 alt_medicine.py 的 KINDS；8 是其他或沒寫 */
export const ALT_KINDS: CategoryDef[] = [
  { value: 1, label: { zh: '中醫（含韓醫）', en: 'Chinese medicine (incl. Korean)' } },
  { value: 2, label: { zh: '針灸', en: 'Acupuncture' } },
  { value: 3, label: { zh: '整脊', en: 'Chiropractic' } },
  { value: 4, label: { zh: '整骨', en: 'Osteopathy' } },
  { value: 5, label: { zh: '順勢療法', en: 'Homeopathy' } },
  { value: 6, label: { zh: '自然療法', en: 'Naturopathy' } },
  { value: 7, label: { zh: '阿育吠陀', en: 'Ayurveda' } },
];
const OTHER: Text = { zh: '其他或沒寫種類', en: 'Other or unspecified' };
const kindLabel = (k: unknown) => tr(ALT_KINDS.find((c) => c.value === Number(k))?.label ?? OTHER);
/** 跟「以哪一種為主」的類別圖同色（類別圖依序取 MAP_TOKENS.categorical） */
const KIND_COLORS = [C[0], C[1], C[2], C[3], C[4], C[5], C[6]];

const PLACES: PointsOverlayDef = {
  kind: 'points',
  id: 'places',
  file: 'places.json',
  label: { zh: '傳統與替代醫學的據點（OSM）', en: 'Traditional and alternative medicine (OSM)' },
  indicators: ['tcm', 'alternative', 'main-kind'],
  radius: 2.6,
  color: {
    field: 'k',
    title: { zh: '種類', en: 'Type' },
    thresholds: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5],
    classes: [...ALT_KINDS.map((c, i) => ({ color: KIND_COLORS[i], label: c.label })), { color: MAP_TOKENS.categoricalOther, label: OTHER }],
  },
  sortField: 'k',
  cluster: {
    maxZoom: 4,
    radius: 40,
    size: (total) => Math.min(28, 7 + 1.2 * Math.sqrt(total)),
    format: (total) => fixed(total, 0),
    title: { zh: '這一區的據點 ', en: 'Places in this area: ' },
  },
  tooltip: (p, { countryName }) => ({
    title: osmName(p),
    detail: [kindLabel(p.k), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    properNoun: osmProper(p),
  }),
};

const PLACE_LIST: ListPanelDef = {
  label: { zh: '傳統與替代醫學的據點', en: 'Traditional and alternative medicine places' },
  tabLabel: { zh: '據點', en: 'Places' },
  indicators: ['tcm', 'alternative', 'main-kind'],
  file: 'places.json',
  countryField: 'iso3',
  empty: { zh: 'OpenStreetMap 上這裡沒有標成傳統或替代醫學的據點', en: 'No traditional or alternative medicine places here in OpenStreetMap' },
  rows: (points) =>
    [...points]
      .sort((a, b) => Number(a.k) - Number(b.k) || byName(a, b))
      .map((p, i): ListRow => ({
        key: `am-${i}`,
        title: osmName(p),
        properNoun: osmProper(p),
        lines: [kindLabel(p.k)],
        group: kindLabel(p.k),
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 15 },
      })),
};

const HERBALISTS: PointsOverlayDef = {
  kind: 'points',
  id: 'herbalist-points',
  file: 'herbalist-points.json',
  label: { zh: '草藥店（OSM）', en: 'Herbalists (OSM)' },
  indicators: ['herbalists', 'herbalists-per-pharmacy'],
  radius: 2.6,
  color: C[3],
  tooltip: (p, { countryName }) => ({
    title: osmName(p),
    detail: [tr({ zh: '草藥店', en: 'Herbalist' }), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
    properNoun: osmProper(p),
  }),
};

const HERBALIST_LIST: ListPanelDef = {
  label: { zh: '草藥店', en: 'Herbalists' },
  tabLabel: { zh: '草藥店', en: 'Herbalists' },
  indicators: ['herbalists', 'herbalists-per-pharmacy'],
  file: 'herbalist-points.json',
  countryField: 'iso3',
  empty: { zh: 'OpenStreetMap 上這裡沒有草藥店', en: 'No herbalists here in OpenStreetMap' },
  rows: (points) =>
    [...points]
      .sort(byName)
      .map((p, i): ListRow => ({
        key: `hb-${i}`,
        title: osmName(p),
        properNoun: osmProper(p),
        lines: [],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 16 },
      })),
};

const countText = (v: number) => tr({ zh: `${fixed(v, 0)} 處`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'place' : 'places'}` });

export const altMedicine: TopicDefinition = {
  id: 'alt-medicine',
  title: { zh: '傳統與替代醫學的據點：中醫、針灸、整脊與草藥店', en: 'Traditional and alternative medicine: Chinese medicine, acupuncture, chiropractic and herbalists' },
  shortTitle: { zh: '傳統與替代醫學的據點', en: 'Alternative medicine' },
  defaultIndicator: 'tcm',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: 'OpenStreetMap（healthcare=alternative、healthcare:speciality、shop=herbalist、amenity=pharmacy，經 QLever 查詢）',
        en: 'OpenStreetMap (healthcare=alternative, healthcare:speciality, shop=herbalist and amenity=pharmacy, via QLever)',
      },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL 1.0',
    },
    {
      name: {
        zh: '衛生福利部統計處 表 1.6「醫療院所家數」、表 2.2.2「藥政管理－各縣市藥商家數按鄉鎮市區別分」（台灣的官方對照）',
        en: 'Taiwan Ministry of Health and Welfare, Department of Statistics, tables 1.6 (medical institutions) and 2.2.2 (licensed drug dealers by township), for Taiwan’s official figures',
      },
      url: 'https://dep.mohw.gov.tw/DOS/cp-5301-62356-113.html',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: withTerritories({
    zh: '據點是 OpenStreetMap 上 healthcare=alternative 的物件，加上任何醫療物件的專科（healthcare:speciality）寫了中醫、韓醫、推拿、針灸、整脊、整骨、順勢療法、自然療法或阿育吠陀的：台灣、南韓、中國的中醫診所多半標成診所加專科，不是 alternative。寫了好幾種專科的，依中醫、針灸、整脊、整骨、順勢療法、自然療法、阿育吠陀的順序歸一類；國家依座標判斷。這些數字同時在量 OSM 畫得多完整：台灣的中醫只畫到官方家數的約 14%，中國大陸只有 102 處，所以不能當各國實際有幾家，比較適合看哪一種在哪裡多。標籤是各國志工自己選的：南韓的韓醫多半也標成 traditional_chinese_medicine（算在中醫），日本多用 acupuncture。地圖縮小時點聚成甜甜圈，看各類的比例。',
    en: 'Places are OpenStreetMap objects tagged healthcare=alternative, plus any healthcare object whose speciality (healthcare:speciality) is Chinese or Korean medicine, tuina, acupuncture, chiropractic, osteopathy, homeopathy, naturopathy or ayurveda: Chinese medicine clinics in Taiwan, South Korea and China are mostly tagged as clinics with a speciality rather than as alternative. Places with several specialities are put in one type, in the order Chinese medicine, acupuncture, chiropractic, osteopathy, homeopathy, naturopathy, ayurveda; countries come from the coordinates. The counts also measure how completely OSM is mapped: it has only about 14% of Taiwan’s official Chinese medicine clinics and just 102 places in mainland China, so they are not the real number of places in each country and are better read as which type is common where. Tags are chosen by local volunteers: Korean medicine in South Korea is mostly also tagged traditional_chinese_medicine (counted as Chinese medicine), while Japan mostly uses acupuncture. When zoomed out the dots group into rings showing the mix of types.',
  }),
  overlays: [PLACES, HERBALISTS],
  listPanel: [PLACE_LIST, HERBALIST_LIST],
  indicators: [
    {
      id: 'tcm',
      label: { zh: '中醫的據點（OSM）', en: 'Chinese medicine places (OSM)' },
      description: { zh: 'OpenStreetMap 上專科寫了中醫（含韓醫、推拿）的據點 2,661 處、72 個國家或地區：南韓 809、台灣 587、德國 256、馬來西亞 126、中國 102、英國 90、新加坡 85、法國 77、美國 69、瑞士 65；香港 32、日本 12。台灣的官方數字是 2025 年底中醫醫院 4 家、中醫診所 4,270 家（衛福部統計處），OSM 只畫到約 14%；南韓的多半是韓醫（OSM 的標籤沒有分）。這是 OSM 標籤的數字，不是各國登記的家數。', en: 'OpenStreetMap places with a Chinese medicine speciality (including Korean medicine and tuina): 2,661 in 72 countries and territories, led by South Korea (809), Taiwan (587), Germany (256), Malaysia (126), China (102), the UK (90), Singapore (85), France (77), the US (69) and Switzerland (65); Hong Kong has 32 and Japan 12. Taiwan officially had 4 Chinese medicine hospitals and 4,270 clinics at the end of 2025 (Ministry of Health and Welfare), so OSM has only about 14% of them; most of South Korea’s are Korean medicine, which the tag does not distinguish. These are OSM tag counts, not registered numbers.' },
      unit: { zh: '處', en: 'places' },
      file: 'tcm.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 500] },
      timeless: true,
      integer: true,
      format: countText,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'alternative',
      label: { zh: '傳統與替代醫學的據點（OSM）', en: 'Traditional and alternative medicine places (OSM)' },
      description: { zh: 'OpenStreetMap 上的傳統與替代醫學據點 31,116 處、165 個國家或地區：美國 8,153、德國 5,534、法國 3,137、印度 2,065、加拿大 1,824、英國 1,458、南韓 844、澳洲 746、台灣 610、日本 443。依種類：整脊 9,049 處、整骨 4,207、針灸 2,949、中醫 2,661、自然療法 1,184、順勢療法 957、阿育吠陀 369，另有 9,740 處沒寫種類或寫了其他療法。美國、德國多，也是因為 OSM 在那裡畫得特別完整。', en: 'OpenStreetMap has 31,116 traditional and alternative medicine places in 165 countries and territories, led by the US (8,153), Germany (5,534), France (3,137), India (2,065), Canada (1,824), the UK (1,458), South Korea (844), Australia (746), Taiwan (610) and Japan (443). By type: chiropractic 9,049, osteopathy 4,207, acupuncture 2,949, Chinese medicine 2,661, naturopathy 1,184, homeopathy 957 and ayurveda 369, plus 9,740 with no type or another therapy. The US and Germany lead partly because OSM is especially complete there.' },
      unit: { zh: '處', en: 'places' },
      file: 'alternative.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 5000] },
      timeless: true,
      integer: true,
      format: countText,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'main-kind',
      label: { zh: '以哪一種為主', en: 'Most common type' },
      description: { zh: '七類（中醫、針灸、整脊、整骨、順勢療法、自然療法、阿育吠陀）合計至少 10 處的 55 個國家或地區，哪一類最多：整脊 22 國（美國、加拿大、英國、澳洲、墨西哥等）、整骨 11 國（法國、德國、義大利、西班牙等）、中醫 10 國（南韓、台灣、中國、香港、馬來西亞、新加坡、越南、泰國、菲律賓、瑞士）、針灸 7 國（日本、巴西、丹麥等）、順勢療法 4 國（印度、孟加拉、巴基斯坦、智利）、阿育吠陀 1 國（斯里蘭卡）；沒有一國以自然療法為主。這是用據點（開業的地方）算的。灰色是 OSM 的標籤太少，不是那裡沒有。', en: 'For the 55 countries and territories with at least 10 places in the seven types (Chinese medicine, acupuncture, chiropractic, osteopathy, homeopathy, naturopathy and ayurveda), the most common type: chiropractic in 22 (the US, Canada, the UK, Australia, Mexico and others), osteopathy in 11 (France, Germany, Italy, Spain and others), Chinese medicine in 10 (South Korea, Taiwan, China, Hong Kong, Malaysia, Singapore, Vietnam, Thailand, the Philippines and Switzerland), acupuncture in 7 (Japan, Brazil, Denmark and others), homeopathy in 4 (India, Bangladesh, Pakistan and Chile) and ayurveda in 1 (Sri Lanka); naturopathy leads nowhere. This counts places where practitioners work. Grey means too few OSM tags, not none.' },
      unit: '',
      file: 'main-kind.json',
      layer: { kind: 'categorical', categories: ALT_KINDS },
      timeless: true,
      unranked: true,
      format: (v) => kindLabel(v),
    },
    {
      id: 'herbalists',
      label: { zh: '草藥店（OSM）', en: 'Herbalists (OSM)' },
      description: { zh: 'OpenStreetMap 的草藥店（shop=herbalist）5,667 處、128 個國家或地區：義大利 1,149、西班牙 787、伊朗 478、美國 419、波蘭 336、法國 156、英國 140、匈牙利 120、加拿大 111、土耳其 109、德國 87、台灣 73；中國 63、香港 39、南韓 38、日本 36。歐洲與中東的草藥店（義大利的 erboristeria、西班牙的 herbolario、伊朗的 attari）比東亞多，中藥行只是其中一種。台灣的官方數字是 2025 年底中藥販賣業 9,115 家（衛福部統計處，22 個縣市加總），OSM 不到 1%。', en: 'OpenStreetMap herbalists (shop=herbalist): 5,667 in 128 countries and territories, led by Italy (1,149), Spain (787), Iran (478), the US (419), Poland (336), France (156), the UK (140), Hungary (120), Canada (111), Turkey (109), Germany (87) and Taiwan (73); China has 63, Hong Kong 39, South Korea 38 and Japan 36. Herbalists in Europe and the Middle East (the Italian erboristeria, the Spanish herbolario, the Iranian attari) outnumber those in East Asia; Chinese herbal shops are only one kind. Taiwan officially had 9,115 licensed Chinese herbal medicine dealers at the end of 2025 (Ministry of Health and Welfare, sum of 22 counties and cities), so OSM has under 1%.' },
      unit: { zh: '處', en: 'shops' },
      file: 'herbalists.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      timeless: true,
      integer: true,
      format: (v) => tr({ zh: `${fixed(v, 0)} 處`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'shop' : 'shops'}` }),
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'herbalists-per-pharmacy',
      label: { zh: '每 100 家藥局有幾家草藥店', en: 'Herbalists per 100 pharmacies' },
      description: { zh: '草藥店 ÷ 藥局（amenity=pharmacy）× 100，只算 OSM 上藥局至少 200 家的 126 個國家或地區。兩個標籤由同一群志工畫，比例比絕對數少受 OSM 完整度影響。香港 14.6 最高（草藥店 39 處、藥局 268 家），伊朗 10.8、義大利 6.9、匈牙利 5.3、馬達加斯加 5.2、斯洛維尼亞 5.1、馬來西亞 4.6、西班牙 4.3、阿曼 4.3、台灣 3.2；美國 2.1、中國 1.6、南韓 1.3、德國 0.5、日本 0.2。台灣官方的中藥販賣業與藥局家數口徑不同，不跟這個比例並列。', en: 'Herbalists divided by pharmacies (amenity=pharmacy) × 100, for the 126 countries and territories with at least 200 pharmacies in OSM. Both tags are mapped by the same volunteers, so the ratio is less affected by how complete OSM is than the raw counts. Hong Kong is highest at 14.6 (39 herbalists, 268 pharmacies), followed by Iran (10.8), Italy (6.9), Hungary (5.3), Madagascar (5.2), Slovenia (5.1), Malaysia (4.6), Spain (4.3), Oman (4.3) and Taiwan (3.2); the US has 2.1, China 1.6, South Korea 1.3, Germany 0.5 and Japan 0.2. Taiwan’s official counts of herbal dealers and pharmacies use different definitions and are not compared with this ratio.' },
      unit: { zh: '家／百家藥局', en: 'per 100 pharmacies' },
      file: 'herbalists-per-pharmacy.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 3, 5, 8] } },
      timeless: true,
      format: (v) => tr({ zh: `每百家藥局 ${fixed(v, 1)} 家`, en: `${fixed(v, 1)} per 100 pharmacies` }),
      formatTick: (v) => `${v}`,
    },
  ],
};
