import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, PointsOverlayDef, SourceDef } from './types';

/**
 * 跑道有沒有燈、關閉與廢棄的機場、飛機靠什麼導航（2026-11-07，製作手冊第二十七批 569，候選 1284、1285、1287；
 * pipeline/topics/airport_navaids.py）：擴充「機場與旅客」。資料都是 OurAirports（公有領域）。
 */

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** 導航台的種類（pipeline/topics/airport_navaids.py 的 NAVAID_TYPES，代碼要一致） */
const NAVAID_TYPES: { code: string; label: Text }[] = [
  { code: 'NDB', label: { zh: 'NDB（無指向性信標）', en: 'NDB (non-directional beacon)' } },
  { code: 'NDB-DME', label: { zh: 'NDB 加測距儀', en: 'NDB with DME' } },
  { code: 'VOR', label: { zh: 'VOR（特高頻全向信標）', en: 'VOR (VHF omnidirectional range)' } },
  { code: 'VOR-DME', label: { zh: 'VOR 加測距儀', en: 'VOR with DME' } },
  { code: 'VORTAC', label: { zh: 'VORTAC（VOR 與軍用 TACAN 合設）', en: 'VORTAC (VOR with military TACAN)' } },
  { code: 'TACAN', label: { zh: 'TACAN（軍用戰術導航）', en: 'TACAN (military tactical air navigation)' } },
  { code: 'DME', label: { zh: 'DME（測距儀）', en: 'DME (distance measuring equipment)' } },
];

const SOURCE_NOTE: Text = {
  zh: '資料是 OurAirports 2026 年 11 月 7 日的檔（公有領域，社群維護），不是各國的官方名錄。',
  en: 'Data are OurAirports files as of 7 November 2026 (public domain, community-maintained), not official national registers.',
};

const NAVAIDS: PointsOverlayDef = {
  kind: 'points',
  id: 'navaids',
  file: 'navaids.json',
  label: { zh: '導航台（OurAirports）', en: 'Navigation aids (OurAirports)' },
  indicators: ['navaids'],
  radius: 2.6,
  color: {
    field: 't',
    title: { zh: '種類', en: 'Type' },
    thresholds: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5],
    classes: NAVAID_TYPES.map((t, i) => ({ label: t.label, color: MAP_TOKENS.categorical[i] })),
  },
  tooltip: (p, { countryName }) => {
    const type = NAVAID_TYPES[Number(p.t) - 1];
    const f = typeof p.f === 'number' ? p.f : null;
    const freq = f === null ? null : f >= 100 && Number(p.t) > 2 ? `${fixed(f, 2)} MHz` : `${fixed(f, 0)} kHz`;
    return {
      title: [str(p.name), str(p.id)].filter(Boolean).join(' · '),
      properNoun: str(p.name) ?? undefined,
      detail: [type ? tr(type.label) : null, freq].filter(Boolean).join(' · '),
      extra: typeof p.iso3 === 'string' ? [countryName(p.iso3)] : [],
    };
  },
};

const CLOSED: PointsOverlayDef = {
  kind: 'points',
  id: 'closed-airports',
  file: 'closed-airports.json',
  label: { zh: '已關閉的機場（OurAirports）', en: 'Closed airports (OurAirports)' },
  indicators: ['closed-airports'],
  radius: 2.4,
  color: MAP_TOKENS.hues.violet,
  heatmap: { maxZoom: 3, label: { zh: '縮小時畫成密度，放大看一座座機場', en: 'Shown as density when zoomed out; zoom in for individual airports' } },
  tooltip: (p, { countryName }) => ({
    title: str(p.name) ?? tr({ zh: '（沒有名稱）', en: '(unnamed)' }),
    properNoun: str(p.name) ?? undefined,
    detail: typeof p.iso3 === 'string' ? countryName(p.iso3) : undefined,
  }),
};

export const aviationNavaids: { sources: SourceDef[]; indicators: IndicatorDef[]; overlays: PointsOverlayDef[] } = {
  sources: [
    {
      name: { zh: 'OurAirports（已關閉的機場 airports.csv、導航台 navaids.csv）', en: 'OurAirports (closed airports in airports.csv, navigation aids in navaids.csv)' },
      url: 'https://ourairports.com/data/',
      license: { zh: '公有領域', en: 'public domain' },
    },
  ],
  overlays: [NAVAIDS, CLOSED],
  indicators: [
    {
      id: 'runway-lit',
      label: { zh: '有燈的跑道比例', en: 'Share of lighted runways' },
      description: {
        zh: `有定期航班的機場的跑道裡，有夜間照明的占幾成（OurAirports 的 lighted 欄，口徑跟跑道總長一樣，不含已關閉與水上跑道；跑道不到 5 條的國家不畫）。沒有燈的跑道天黑以後不能起降，支線機場多的國家比例低。全世界 5,300 條裡 3,868 條有燈（73.0%）；南韓 25 條全部有燈，日本 93.9%、美國 85.0%（1,213 條裡 1,031 條）、法國 83.6%、奈及利亞 78.6%、台灣 76.5%（17 條裡 13 條）、俄羅斯 75.2%、印度 71.8%、德國 67.2%、中國 65.9%（305 條裡 201 條）、英國 61.2%；衣索比亞 55.6%、印尼 46.5%、巴布亞紐幾內亞 42.9%、巴西 40.4%（146 條裡 59 條）。${tr(SOURCE_NOTE, 'zh')}`,
        en: `Of the runways at airports with scheduled flights, the share with lighting (OurAirports’ lighted field, on the same basis as total runway length, excluding closed and water runways; countries with fewer than 5 runways are not shown). Unlit runways cannot be used after dark, so countries with many regional airstrips score low. Worldwide 3,868 of 5,300 runways are lighted (73.0%); all 25 in South Korea are lit, Japan 93.9%, the US 85.0% (1,031 of 1,213), France 83.6%, Nigeria 78.6%, Taiwan 76.5% (13 of 17), Russia 75.2%, India 71.8%, Germany 67.2%, China 65.9% (201 of 305) and the UK 61.2%; Ethiopia 55.6%, Indonesia 46.5%, Papua New Guinea 42.9% and Brazil 40.4% (59 of 146). ${tr(SOURCE_NOTE, 'en')}`,
      },
      unit: '%',
      file: 'runway-lit.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [40, 55, 70, 85, 95] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      timeless: true,
      missing: { zh: '沒有定期航班的機場', en: 'No airports with scheduled flights' },
    },
    {
      id: 'closed-airports',
      label: { zh: '已關閉的機場', en: 'Closed airports' },
      description: {
        zh: `OurAirports 標成已關閉（type = closed）的機場，畫成點：全部 86,322 筆裡有 13,649 座。美國 7,619 座占一半以上（多半來自美國聯邦航空總署的資料匯入），加拿大 889、墨西哥 609、日本 419、英國 385、俄羅斯 335、巴西 328、菲律賓 180、義大利 131、德國 118、烏茲別克 117、保加利亞 114；中國 68、南韓 43、台灣 11。各國收錄得多完整差很多，國家之間不能比，所以國家不上色、只畫點；沒有關閉的日期，也沒有時間軸。${tr(SOURCE_NOTE, 'zh')}`,
        en: `Airports marked closed (type = closed) in OurAirports, drawn as points: 13,649 of its 86,322 records. The US has 7,619, over half (mostly from imported Federal Aviation Administration data), then Canada 889, Mexico 609, Japan 419, the UK 385, Russia 335, Brazil 328, the Philippines 180, Italy 131, Germany 118, Uzbekistan 117 and Bulgaria 114; China 68, South Korea 43 and Taiwan 11. Coverage varies so much between countries that they cannot be compared, so countries are not shaded and only the points are drawn; there are no closing dates, so there is no time axis. ${tr(SOURCE_NOTE, 'en')}`,
      },
      unit: { zh: '座', en: 'airports' },
      file: 'closed-airports-count.json',
      layer: { kind: 'none' },
      format: (v) => tr({ zh: `OurAirports 有 ${fixed(v, 0)} 座已關閉的機場`, en: `${fixed(v, 0)} closed airports in OurAirports` }),
      timeless: true,
      unranked: true,
      rankingBars: false,
      panelChart: false,
    },
    {
      id: 'navaids',
      label: { zh: '導航台', en: 'Navigation aids' },
      description: {
        zh: `地面的無線電導航台（OurAirports 的 navaids.csv），圓是各國的座數，點依種類上色。全世界 231 國 11,008 座：NDB 6,609、VOR 加測距儀 2,601、VORTAC 744、TACAN 442、VOR 308、DME 167、NDB 加測距儀 137。美國 2,804 座最多，加拿大 622、俄羅斯 460、澳洲 374、巴西 323、中國 277、德國 225、日本 219、印尼 216、法國 182、西班牙 180、英國 177；台灣 51 座（NDB 27、TACAN 9、DME 6、VOR 加測距儀 4、VORTAC 4、NDB 加測距儀 1），例如服務松山機場的安埔 NDB 250 kHz 與 VOR 加測距儀 112.5 MHz、馬公 NDB 290 kHz、金門 NDB 加測距儀 345 kHz、清泉崗 TACAN 111.3 MHz；南韓也是 51 座。沒有儀器降落系統（ILS），不能拿來說各國的儀器進場能力；NDB 正在大量除役，這是 2026 年 11 月 7 日的快照；軍用的 TACAN 也在裡面。${tr(SOURCE_NOTE, 'zh')}`,
        en: `Ground-based radio navigation aids (OurAirports navaids.csv); circles show each country’s count and points are coloured by type. Worldwide 11,008 in 231 countries: NDB 6,609, VOR-DME 2,601, VORTAC 744, TACAN 442, VOR 308, DME 167 and NDB-DME 137. The US has the most, 2,804, then Canada 622, Russia 460, Australia 374, Brazil 323, China 277, Germany 225, Japan 219, Indonesia 216, France 182, Spain 180 and the UK 177; Taiwan has 51 (NDB 27, TACAN 9, DME 6, VOR-DME 4, VORTAC 4, NDB-DME 1), such as the Anpu NDB on 250 kHz and VOR-DME on 112.5 MHz serving Songshan, the Magong NDB on 290 kHz, the Kinmen NDB-DME on 345 kHz and the Ching Chuan Kang TACAN on 111.3 MHz; South Korea also has 51. Instrument landing systems (ILS) are not included, so this says nothing about instrument approach capability; NDBs are being decommissioned in large numbers, so this is a snapshot of 7 November 2026; military TACANs are included. ${tr(SOURCE_NOTE, 'en')}`,
      },
      unit: { zh: '座', en: 'navaids' },
      file: 'navaids-count.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 座`, en: fixed(v, 0) }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      timeless: true,
    },
  ],
};

