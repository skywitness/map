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
  indicators: ['tcm', 'alternative', 'main-kind', 'by-kind', 'share-of-care', 'per-million'],
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
  indicators: ['tcm', 'alternative', 'main-kind', 'by-kind', 'share-of-care', 'per-million'],
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

// 傳統醫學的大學、醫院與博物館（Wikidata，依名稱找；第二十九批 708，pipeline/topics/alt_medicine_landmarks.py）
const LANDMARK_KINDS: Text[] = [
  { zh: '大學與學院', en: 'Universities and colleges' },
  { zh: '醫院', en: 'Hospitals' },
  { zh: '博物館', en: 'Museums' },
];
const LANDMARK_SYSTEMS: Text[] = [
  { zh: '中醫', en: 'Chinese medicine' },
  { zh: '阿育吠陀', en: 'Ayurveda' },
  { zh: '順勢療法', en: 'Homeopathy' },
  { zh: '尤納尼', en: 'Unani' },
  { zh: '悉達', en: 'Siddha' },
  { zh: '韓醫或東洋醫學', en: 'Korean or Oriental medicine' },
  { zh: '其他傳統醫學', en: 'Other traditional medicine' },
];
const landmarkName = (p: PointRecord) => String((getLang() === 'zh' ? p.name : p.nameEn) ?? '');
const landmarkLine = (p: PointRecord) =>
  [tr(LANDMARK_KINDS[Number(p.kind) - 1] ?? OTHER), tr(LANDMARK_SYSTEMS[Number(p.sys) - 1] ?? OTHER)].join(' · ');
const LANDMARKS: PointsOverlayDef = {
  kind: 'points',
  id: 'landmarks',
  file: 'landmarks.json',
  label: { zh: '傳統醫學的大學、醫院與博物館', en: 'Traditional medicine universities, hospitals and museums' },
  indicators: ['landmarks'],
  radius: 3.5,
  color: {
    field: 'kind',
    title: { zh: '類型', en: 'Type' },
    thresholds: [1.5, 2.5],
    classes: LANDMARK_KINDS.map((label, i) => ({ color: C[i], label })),
  },
  sortField: 'kind',
  tooltip: (p, { countryName }) => ({
    title: landmarkName(p),
    detail: [landmarkLine(p), typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
  }),
};
const LANDMARK_LIST: ListPanelDef = {
  label: { zh: '傳統醫學的大學、醫院與博物館', en: 'Traditional medicine universities, hospitals and museums' },
  tabLabel: { zh: '地標', en: 'Landmarks' },
  indicators: ['landmarks'],
  file: 'landmarks.json',
  countryField: 'iso3',
  empty: { zh: 'Wikidata 上這裡沒有名稱看得出是傳統醫學的大學、醫院或博物館', en: 'No traditional medicine university, hospital or museum identifiable by name in Wikidata here' },
  rows: (points) =>
    [...points]
      .sort((a, b) => Number(a.kind) - Number(b.kind) || landmarkName(a).localeCompare(landmarkName(b)))
      .map((p, i): ListRow => ({
        key: `lm-${i}`,
        title: landmarkName(p),
        titleProper: getLang() !== 'zh',
        properNoun: getLang() === 'zh' && p.nameEn !== p.name ? String(p.nameEn ?? '') : undefined,
        lines: [landmarkLine(p)],
        group: tr(LANDMARK_KINDS[Number(p.kind) - 1] ?? OTHER),
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 13 },
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
      name: { zh: 'Wikidata（傳統醫學的大學、醫院與博物館，經 QLever 依名稱查詢）', en: 'Wikidata (traditional medicine universities, hospitals and museums, by name via QLever)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
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
  overlays: [PLACES, HERBALISTS, LANDMARKS],
  listPanel: [PLACE_LIST, HERBALIST_LIST, LANDMARK_LIST],
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
      id: 'by-kind',
      label: { zh: '各種療法的據點（OSM）', en: 'Places by therapy (OSM)' },
      description: {
        zh: 'OpenStreetMap 上專科寫了這一種的據點，子項目切換：針灸 2,949 處、82 個國家或地區（美國 807、德國 711、加拿大 266、日本 212、英國 169；台灣只有 2 處，台灣的針灸多在中醫診所裡，標成中醫）；整脊 9,049 處（美國 5,692、加拿大 851、英國 476、德國 446、澳洲 358）；整骨 4,207 處（法國 1,755、德國 1,066、英國 253；整骨在美國是正規醫師的學位，在歐洲是手法治療，同一個標籤意思不同）；順勢療法 957 處（印度 309、德國 295）；自然療法 1,184 處（德國 716、法國 119）；阿育吠陀 369 處（印度 254、德國 37、斯里蘭卡 14）。Unani、Siddha、藏醫、漢方在 OSM 幾乎沒有標，做不成圖層。',
        en: 'OpenStreetMap places whose speciality is the selected therapy; sub-items switch between them. Acupuncture: 2,949 in 82 countries and territories (the US 807, Germany 711, Canada 266, Japan 212, the UK 169; Taiwan has only 2, since acupuncture there is mostly done in Chinese medicine clinics tagged as Chinese medicine). Chiropractic: 9,049 (the US 5,692, Canada 851, the UK 476, Germany 446, Australia 358). Osteopathy: 4,207 (France 1,755, Germany 1,066, the UK 253; in the US osteopathy is a medical degree, in Europe a manual therapy, so the same tag means different things). Homeopathy: 957 (India 309, Germany 295). Naturopathy: 1,184 (Germany 716, France 119). Ayurveda: 369 (India 254, Germany 37, Sri Lanka 14). Unani, Siddha, Tibetan medicine and Kampo are hardly tagged in OSM and cannot be mapped.',
      },
      unit: { zh: '處', en: 'places' },
      file: 'kinds/{item}.json',
      dimension: {
        label: { zh: '療法', en: 'Therapy' },
        options: ALT_KINDS.slice(1).map((c) => ({ id: ['acupuncture', 'chiropractic', 'osteopathy', 'homeopathy', 'naturopathy', 'ayurveda'][c.value - 2], label: c.label })),
        defaultOption: 'acupuncture',
      },
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      timeless: true,
      integer: true,
      format: countText,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'share-of-care',
      label: { zh: '占診所與藥局的比例', en: 'Share of clinics and pharmacies' },
      description: {
        zh: '傳統與替代醫學的據點 ÷（OpenStreetMap 的診所＋藥局）× 100，只算診所加藥局至少 300 處的 135 個國家或地區。分子分母由同一群志工畫，比只看處數少受 OSM 完整度影響。德國 27.9% 最高，新加坡 20.2、瑞士 18.9、加拿大 18.5、美國 18.2、奧地利 18.1、丹麥 16.4、南韓 16.2、紐西蘭 15.1、法國 14.4、澳洲 13.1、台灣 13.1；中國 2.7、義大利 1.5、日本 1.4、巴西 0.6、俄羅斯 0.3。台灣、南韓的中醫診所標成診所加專科，算在分子裡；只看 healthcare=alternative 會低估很多。',
        en: 'Traditional and alternative medicine places divided by OpenStreetMap clinics plus pharmacies × 100, for the 135 countries and territories with at least 300 clinics and pharmacies. Numerator and denominator are mapped by the same volunteers, so this is less affected by how complete OSM is than raw counts. Germany is highest at 27.9%, followed by Singapore (20.2), Switzerland (18.9), Canada (18.5), the US (18.2), Austria (18.1), Denmark (16.4), South Korea (16.2), New Zealand (15.1), France (14.4), Australia (13.1) and Taiwan (13.1); China 2.7, Italy 1.5, Japan 1.4, Brazil 0.6 and Russia 0.3. Chinese medicine clinics in Taiwan and South Korea, tagged as clinics with a speciality, count in the numerator; using healthcare=alternative alone would greatly understate them.',
      },
      unit: '%',
      file: 'share-of-care.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 5, 10, 15, 20] } },
      timeless: true,
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'per-million',
      label: { zh: '每百萬人的據點', en: 'Places per million people' },
      description: {
        zh: '傳統與替代醫學的據點 ÷ 2024 年人口，只替 OpenStreetMap 覆蓋良好、至少 10 處的 45 國上色（覆蓋度的判斷同「外食與喝一杯」等 OSM 主題）。德國每百萬人 65.5 處最多，法國 47.1、加拿大 45.9、瑞士 44.4、奧地利 38.0、紐西蘭 34.9、澳洲 27.9、台灣 26.3、愛爾蘭 25.7、美國 23.6；南韓 16.3、日本 3.6。台灣官方的中醫醫療機構是每百萬人約 183 家，跟 OSM 的數字口徑不同，不要並列。',
        en: 'Traditional and alternative medicine places divided by 2024 population, coloured only for the 45 countries where OpenStreetMap coverage is good and there are at least 10 places (coverage is judged as in other OSM topics such as Eating out). Germany has the most per million people (65.5), followed by France (47.1), Canada (45.9), Switzerland (44.4), Austria (38.0), New Zealand (34.9), Australia (27.9), Taiwan (26.3), Ireland (25.7) and the US (23.6); South Korea 16.3 and Japan 3.6. Taiwan’s official Chinese medicine institutions come to about 183 per million people, a different measure that should not be compared with the OSM figure.',
      },
      unit: { zh: '處／百萬人', en: 'per million people' },
      file: 'per-million.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 40] } },
      timeless: true,
      format: (v) => tr({ zh: `每百萬人 ${fixed(v, 1)} 處`, en: `${fixed(v, 1)} per million` }),
      formatTick: (v) => `${v}`,
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
    {
      id: 'landmarks',
      label: { zh: '傳統醫學的大學、醫院與博物館', en: 'Traditional medicine universities, hospitals and museums' },
      description: {
        zh: 'Wikidata 上名稱看得出是傳統醫學的大學與學院、醫院與博物館，共 245 處。大學與學院 127 所：印度 100 所（多半是阿育吠陀、順勢療法、悉達、尤納尼的學院），中國 18 所中醫藥大學；醫院 114 家：中國 73 家中醫院、印度 28 家；博物館 4 座：廣東、雲南、騰衝的中醫藥博物館，與南韓大邱藥令市的韓醫藥博物館。點的顏色是類型，清單另寫體系。這是靠名稱找的，不是靠分類（Wikidata 很少標「專科是傳統醫學」）：名稱裡沒有中醫、阿育吠陀這些字的就找不到，例如台灣的中國醫藥大學與各醫院的中醫部，所以台灣這裡是 0；名稱剛好有「台中醫院」這種字的已經排除，但仍可能有誤判。只當地標，不做各國的比較；台灣的中醫醫院與診所家數見「台灣的中醫」主題。',
        en: 'Universities and colleges, hospitals and museums in Wikidata whose names identify them as traditional medicine institutions: 245 in all. 127 universities and colleges: 100 in India (mostly Ayurveda, homeopathy, Siddha and Unani colleges) and 18 universities of Chinese medicine in China; 114 hospitals: 73 Chinese medicine hospitals in China and 28 in India; 4 museums: the Chinese medicine museums of Guangdong, Yunnan and Tengchong and the Korean medicine museum at Yangnyeongsi in Daegu, South Korea. Points are coloured by type and the list gives the system. These were found by name, not by classification (Wikidata rarely records traditional medicine as a health specialty), so institutions whose names lack words such as Chinese medicine or Ayurveda are missed, including Taiwan’s China Medical University and hospital Chinese medicine departments, which is why Taiwan shows none; names that merely contain a place name such as Taichung have been excluded, but misclassifications are still possible. These are landmarks only, not a comparison between countries; Taiwan’s official counts of Chinese medicine hospitals and clinics are in the Chinese medicine in Taiwan topic.',
      },
      unit: { zh: '處', en: 'places' },
      file: 'landmark-count.json',
      layer: { kind: 'none' },
      timeless: true,
      integer: true,
      unranked: true,
      format: countText,
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
