import { getLang, tr, type Text } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, TopicDefinition } from './types';

/**
 * 核子事故（pipeline/topics/nuclear_accidents.py）：民用核電廠、反應爐、核燃料設施與輻射源的事故，事件表手工整理自
 * 英文維基百科三篇的固定版本（pipeline/sources/nuclear_accidents.py）。使用者 2026-10-30 決定：死亡人數列各方估計的範圍與出處，
 * 不收軍事事故（核潛艇等）。
 */

export const KINDS: { value: number; label: Text }[] = [
  { value: 1, label: { zh: '核電廠', en: 'Nuclear power plant' } },
  { value: 2, label: { zh: '研究反應爐、臨界事故', en: 'Research reactor or criticality' } },
  { value: 3, label: { zh: '核燃料與核廢料設施', en: 'Fuel or waste facility' } },
  { value: 4, label: { zh: '輻射源、放射治療', en: 'Radiation source or radiotherapy' } },
];
export const kindLabel = (k: unknown) => tr(KINDS.find((x) => x.value === k)?.label ?? '');

/** INES 等級：0 是沒有評級（多半是 1990 年 INES 開始以前、或輻射源事故），1–3 是「事件」，4–7 是「事故」 */
const INES_COLORS: ColorClasses = {
  field: 'i',
  title: { zh: '國際核事件分級（INES）', en: 'International Nuclear Event Scale (INES)' },
  thresholds: [1, 4, 5, 6, 7],
  classes: [
    { color: MAP_TOKENS.inkMuted, label: { zh: '沒有評級', en: 'Not rated' } },
    { color: MAP_TOKENS.sequential[2], label: { zh: '1–3 級（事件）', en: 'Levels 1–3 (incidents)' } },
    { color: MAP_TOKENS.sequential[3], label: { zh: '4 級（局部影響的事故）', en: 'Level 4 (local consequences)' } },
    { color: MAP_TOKENS.sequential[4], label: { zh: '5 級（較廣影響的事故）', en: 'Level 5 (wider consequences)' } },
    { color: MAP_TOKENS.sequential[5], label: { zh: '6 級（嚴重事故）', en: 'Level 6 (serious accident)' } },
    { color: MAP_TOKENS.sequential[6], label: { zh: '7 級（重大事故）', en: 'Level 7 (major accident)' } },
  ],
};

const locale = () => (getLang() === 'zh' ? 'zh-TW' : 'en-US');
const n0 = (v: number) => Math.round(v).toLocaleString(locale());

export function accidentName(p: PointRecord): string {
  if (getLang() === 'zh' && typeof p.zh === 'string') return p.zh;
  return String(p.en ?? '');
}

/** 「1986 年 4 月 26 日」；只有年、月的照寫 */
export function accidentDate(p: PointRecord): string {
  const y = p.y as number;
  const m = typeof p.m === 'number' ? p.m : null;
  const d = typeof p.dd === 'number' ? p.dd : null;
  const month = m ? new Date(Date.UTC(2000, m - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }) : '';
  return tr({
    zh: `${y} 年${m ? ` ${m} 月` : ''}${d ? ` ${d} 日` : ''}`,
    en: !m ? String(y) : d ? `${d} ${month} ${y}` : `${month} ${y}`,
  });
}

export function inesLabel(p: PointRecord): string {
  return typeof p.i === 'number' && p.i > 0 ? `INES ${p.i}` : tr({ zh: '沒有 INES 評級', en: 'No INES rating' });
}

export const what = (p: PointRecord) => String((getLang() === 'zh' ? p.wz : p.we) ?? '');
export const deathsText = (p: PointRecord) => String((getLang() === 'zh' ? p.dz : p.de) ?? '');

export const nuclearAccidents: TopicDefinition = {
  id: 'nuclear-accidents',
  title: { zh: '核子事故', en: 'Nuclear accidents' },
  shortTitle: { zh: '核子事故', en: 'Nuclear accidents' },
  defaultIndicator: 'map',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '英文維基百科「Nuclear and radiation accidents and incidents」「List of nuclear and radiation accidents by death toll」「List of civilian nuclear accidents」（固定版本，手工整理）',
        en: 'English Wikipedia, “Nuclear and radiation accidents and incidents”, “List of nuclear and radiation accidents by death toll” and “List of civilian nuclear accidents” (fixed revisions, compiled by hand)',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1382200054',
      license: 'CC BY-SA 4.0',
    },
    { name: { zh: 'Wikidata（事故與設施的位置）', en: 'Wikidata (locations of accidents and facilities)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
  ],
  note: {
    zh:
      '事件依英文維基百科三篇條目的固定版本（2026 年 5–10 月）手工整理：核電廠事故表、依死亡人數排列的核子與輻射事故、民用核事故，收有 INES 等級或有人死亡的民用核電廠、反應爐、核燃料與核廢料設施、輻射源與放射治療事故，共 48 起。只有停機損失、沒有傷亡也沒有 INES 等級的電廠事件（美國的幾座電廠）不收；照使用者的決定不收軍事事故：核潛艇（K-19、K-27、K-431）、美國陸軍的 SL-1、核試爆的落塵（第五福龍丸）、曼哈頓計畫的核彈芯實驗。基什特姆（馬亞克）與溫斯喬是核武計畫的生產設施，維基百科列為核事故，照收。' +
      'INES（國際核事件分級）1990 年才開始，之前的事故有的是事後評的，有的沒有評級；1–3 級是「事件」、4–7 級是「事故」。圓的面積是死亡人數，用各方估計的上限（包括長期的癌症推估），死亡人數各方說法差很多：車諾比直接死亡 31 人，長期癌症死亡的推估從 4,000 到 16,000 人以上；福島因輻射死亡 1 人（有爭議），因撤離而死的比這多。滑過看每一起的範圍與出處。位置用 Wikidata 的設施或事件座標，沒有的用城市的位置（寫「位置是大約的」）；國家依今天的國界（車諾比算烏克蘭）。' +
      '台灣：三篇條目與 Wikidata 都沒有台灣的事件；核能安全委員會（前原子能委員會）的核安管制月報把國內核電廠的異常事件依 INES 分級，但沒有開放資料，沒有收。IAEA 的事件通報系統（NEWS）條款讀不到，沒有用。',
    en:
      'Events were compiled by hand from fixed revisions (May–October 2026) of three English Wikipedia articles: the table of nuclear plant accidents, the list of nuclear and radiation accidents by death toll and the list of civilian nuclear accidents. Included are the 48 civilian accidents at power plants, reactors, fuel and waste facilities and with radiation sources or radiotherapy that have an INES rating or caused deaths. Plant events with only outage costs and no rating or casualties (several US plants) are left out, and, as decided, so are military accidents: nuclear submarines (K-19, K-27, K-431), the US Army’s SL-1, test fallout (the Daigo Fukuryū Maru) and the Manhattan Project’s core experiments. Kyshtym (Mayak) and Windscale were weapons-programme production sites but are listed by Wikipedia as nuclear accidents, so they are included. ' +
      'The International Nuclear Event Scale began in 1990; earlier accidents were rated afterwards or not at all. Levels 1–3 are incidents and 4–7 accidents. Circle area is the number of deaths, using the highest estimate (including long-term cancer projections), and estimates vary widely: Chernobyl caused 31 direct deaths, while projections of long-term cancer deaths run from 4,000 to over 16,000; Fukushima caused one radiation death (disputed), with more deaths from the evacuation. Hover for each range and its source. Locations come from Wikidata coordinates of the facility or event, or else the city (marked as approximate); countries follow today’s borders (Chernobyl is in Ukraine). ' +
      'Taiwan: none of the three articles or Wikidata lists an event in Taiwan; the Nuclear Safety Commission’s (formerly the Atomic Energy Council) monthly reports rate abnormal events at domestic plants on the INES, but are not published as open data and are not included. The IAEA’s NEWS event reports were not used because their terms could not be read.',
  },
  noValue: {
    TWN: { zh: '來源沒有台灣的事件', en: 'No event in Taiwan in the sources' },
  },
  panelExtra: () => import('./panels/NuclearAccidentsPanel'),
  overlays: [
    {
      kind: 'points',
      id: 'accidents',
      file: 'points.json',
      label: { zh: '核子與輻射事故', en: 'Nuclear and radiation accidents' },
      // 面積依死亡人數（各方估計的上限）；沒有人死亡的是小點
      radius: { field: 'd', stops: [[0, 3], [1, 3.8], [10, 5.5], [100, 9], [1000, 15], [16000, 30]] },
      color: INES_COLORS,
      sortField: 'i',
      timeField: 'y',
      sizeLegend: {
        title: { zh: '死亡人數（估計的上限）', en: 'Deaths (highest estimate)' },
        values: [10, 200, 16000],
        format: (v) => tr({ zh: `${n0(v)} 人`, en: n0(v) }),
      },
      tooltip: (p, ctx) => {
        const name = accidentName(p);
        const extra = [what(p), tr({ zh: `死亡：${deathsText(p)}`, en: `Deaths: ${deathsText(p)}` })];
        if (p.ap === 1) extra.push(tr({ zh: '位置是大約的（城市）', en: 'Location is approximate (city)' }));
        return {
          title: name,
          detail: [accidentDate(p), inesLabel(p), kindLabel(p.k), typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null]
            .filter(Boolean)
            .join(' · '),
          extra,
          properNoun: getLang() === 'zh' && typeof p.en === 'string' ? p.en : undefined,
        };
      },
    },
  ],
  indicators: [
    {
      id: 'map',
      label: { zh: '核子事故地圖', en: 'Accident map' },
      description: {
        zh: '民用核電廠、反應爐、核燃料設施與輻射源的事故，依發生的年份累積出現：顏色是國際核事件分級（INES，7 級最嚴重），面積是死亡人數（各方估計的上限）。車諾比與福島是 7 級、基什特姆 6 級、三哩島、溫斯喬、戈亞尼亞 5 級。死亡人數各方說法差很多，滑過看範圍與出處；點國家列出它的事故。不收核潛艇等軍事事故。',
        en: 'Accidents at civilian nuclear power plants, reactors and fuel facilities and with radiation sources, appearing in the year they happened: colour is the International Nuclear Event Scale (INES; level 7 is the worst) and area the number of deaths (highest estimate). Chernobyl and Fukushima are level 7, Kyshtym 6, and Three Mile Island, Windscale and Goiânia 5. Death tolls are heavily disputed, so hover for the range and sources; select a country for its list. Military accidents such as those on nuclear submarines are not included.',
      },
      unit: { zh: '起', en: 'accidents' },
      file: 'map.json',
      layer: { kind: 'none' },
      overlayTime: 'cumulative',
      integer: true,
      format: (v) => tr({ zh: `累計 ${n0(v)} 起事故`, en: `${n0(v)} ${Math.round(v) === 1 ? 'accident' : 'accidents'} to date` }),
      missing: { zh: '來源沒有這個國家的事故', en: 'No accident in this country in the sources' },
    },
  ],
};
