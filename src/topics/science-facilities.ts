import { getLang, tr, type Text } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 大型科學設施（2026-10-31，製作手冊第十批 168；pipeline/topics/science_facilities.py）：英文維基三個清單的核融合研究裝置、
 * 同步輻射光源、粒子加速器與對撞機（使用者決定另外加），依年份出現。放科技的「研發與太空」欄。
 */

const FIRST = 1928;
const LAST = 2026;
const YEARS = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);

/** 群組 g：顏色 */
const GROUPS: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '核融合研究裝置', en: 'Fusion experiments' }, color: MAP_TOKENS.categorical[5] },
  { value: 2, label: { zh: '同步輻射光源', en: 'Synchrotron light sources' }, color: MAP_TOKENS.categorical[1] },
  { value: 3, label: { zh: '粒子加速器與對撞機', en: 'Particle accelerators and colliders' }, color: MAP_TOKENS.categorical[0] },
  // 2026-11-07（第二十五批 512，pipeline/topics/science_astro.py）
  { value: 4, label: { zh: '天文設施（望遠鏡、天文台、微中子）', en: 'Astronomy (telescopes, observatories, neutrinos)' }, color: MAP_TOKENS.categorical[7] },
];
/** 細類 t（左邊清單的分組） */
const TYPES: Record<number, Text> = {
  1: { zh: '托卡馬克', en: 'Tokamaks' },
  2: { zh: '仿星器', en: 'Stellarators' },
  3: { zh: '雷射核融合', en: 'Laser fusion' },
  4: { zh: '同步輻射光源與自由電子雷射', en: 'Light sources and FELs' },
  5: { zh: '早期的加速器', en: 'Early accelerators' },
  6: { zh: '固定靶加速器', en: 'Fixed-target accelerators' },
  7: { zh: '對撞機', en: 'Colliders' },
  8: { zh: '大型光學望遠鏡', en: 'Large optical telescopes' },
  9: { zh: '電波望遠鏡', en: 'Radio telescopes' },
  10: { zh: '天文台', en: 'Observatories' },
  11: { zh: '微中子實驗', en: 'Neutrino experiments' },
};
/** 狀態 st（pipeline 的 OPERATING〔1〕、CLOSED、CLOSED_UNKNOWN、PLANNED） */
const CLOSED = 2;
const CLOSED_UNKNOWN = 3;
const PLANNED = 4;

const GROUP_COLORS: ColorClasses = {
  field: 'g',
  title: { zh: '設施', en: 'Facility' },
  thresholds: [1.5, 2.5, 3.5],
  classes: GROUPS.map((g) => ({ color: g.color, label: g.label })),
};

const num = (v: unknown) => (typeof v === 'number' ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const startOf = (p: PointRecord) => num(p.s) ?? LAST;

/** 那一年的狀態：運作中、已關閉，或還沒啟用（null） */
function stateAt(p: PointRecord, year: number): 'on' | 'off' | null {
  const st = p.st;
  if (st === PLANNED) return null;
  if (startOf(p) > year) return null;
  if (st === CLOSED_UNKNOWN) return 'off';
  const end = num(p.e);
  if (st === CLOSED && end !== null && end < year) return 'off';
  return 'on';
}

const facilityName = (p: PointRecord) => (getLang() === 'zh' && str(p.zh)) || str(p.en) || '';

function yearsText(p: PointRecord): string {
  const s = num(p.s);
  const e = num(p.e);
  if (p.st === PLANNED) return s ? tr({ zh: `預定 ${s} 年`, en: `Planned for ${s}` }) : tr({ zh: '興建中或規劃中', en: 'Under construction or planned' });
  if (p.st === CLOSED_UNKNOWN)
    return s ? tr({ zh: `${s} 年啟用，停止年份不明`, en: `From ${s}; end date unknown` }) : tr({ zh: '年份不明，已關閉', en: 'Dates unknown; closed' });
  if (p.st === CLOSED) return s === e ? String(s) : `${s ?? '?'}–${e}`;
  return s ? tr({ zh: `${s} 年起`, en: `Since ${s}` }) : tr({ zh: '運作中（啟用年份不明）', en: 'Operating (start date unknown)' });
}

function lines(p: PointRecord, countryName: (iso3: string) => string): string[] {
  const where = [str(p.iso3) ? countryName(p.iso3 as string) : null, str(p.org)].filter(Boolean).join(' · ');
  return [
    [tr(TYPES[p.t as number] ?? { zh: '', en: '' }), yearsText(p)].filter(Boolean).join(' · '),
    where,
    // 天文設施的 gev 欄放的是望遠鏡的口徑（例如「10.4 m」）
    str(p.gev) ? (p.g === 4 ? tr({ zh: `口徑 ${p.gev}`, en: `Aperture ${p.gev}` }) : tr({ zh: `能量 ${p.gev} GeV`, en: `${p.gev} GeV` })) : '',
  ].filter(Boolean);
}

function tooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  return {
    title: facilityName(p),
    detail: tr(GROUPS.find((g) => g.value === p.g)?.label ?? { zh: '', en: '' }),
    extra: lines(p, ctx.countryName),
    properNoun: getLang() === 'zh' && str(p.zh) ? (str(p.en) ?? undefined) : undefined,
  };
}

const RUNNING: PointsOverlayDef = {
  kind: 'points',
  id: 'running',
  file: 'facilities.json',
  label: { zh: '運作中', en: 'Operating' },
  radius: 5,
  color: GROUP_COLORS,
  // 每一年算一次：已啟用、還沒關閉的才畫
  epochs: { years: YEARS, values: (p, year) => ({ on: stateAt(p, year) === 'on' ? 1 : null }) },
  minValue: { field: 'on', stops: [[0, 0]] },
  tooltip,
};

const CLOSED_LAYER: PointsOverlayDef = {
  kind: 'points',
  id: 'closed',
  file: 'facilities.json',
  label: { zh: '已關閉（灰色；停止年份不明的從啟用那年起畫在這裡）', en: 'Closed (grey; those with an unknown end date are shown here from their start year)' },
  look: 'muted',
  radius: 4,
  color: GROUP_COLORS,
  epochs: { years: YEARS, values: (p, year) => ({ off: stateAt(p, year) === 'off' ? 1 : null }) },
  minValue: { field: 'off', stops: [[0, 0]] },
  tooltip,
};

/** 興建中與規劃中：只在最新一年（yr 欄位都是 2026） */
const PLANNED_LAYER: PointsOverlayDef = {
  kind: 'points',
  id: 'planned',
  file: 'planned.json',
  label: { zh: '興建中、規劃中（空心，只在 2026 年）', en: 'Under construction or planned (hollow, 2026 only)' },
  look: 'hollow',
  radius: 5,
  color: GROUP_COLORS,
  timeField: 'yr',
  tooltip,
};

/**
 * 左邊的清單（第十二批 L18，使用者 2026-10-30 決定依類型分組）：時間軸那一年已經啟用的設施（2026 年加上興建中、規劃中），
 * 依細類分組、組內依啟用年份；已關閉的淡一點。2026-10-31（第十二批 206）：組名改用清單側欄的分組（ListRow.group，
 * 寫類型與數量），跟選取的國家連動
 */
const LIST: ListPanelDef = {
  label: { zh: '設施', en: 'Facilities' },
  file: 'list.json',
  countryField: 'iso3',
  rows: (points, { countryName, year }) => {
    const shown = points.filter((p) => (p.st === PLANNED ? year >= LAST : stateAt(p, year) !== null));
    const sorted = [...shown].sort(
      (a, b) => (a.t as number) - (b.t as number) || startOf(a) - startOf(b) || String(a.en).localeCompare(String(b.en)),
    );
    const size = (t: unknown) => shown.filter((p) => p.t === t).length;
    return sorted.map((p, i): ListRow => {
      const zhName = getLang() === 'zh' && str(p.zh);
      return {
        key: `${p.t}-${p.en}-${i}`,
        title: facilityName(p),
        titleProper: !zhName,
        lines: lines(p, countryName),
        muted: p.st !== PLANNED && stateAt(p, year) === 'off',
        group: tr({ zh: `${tr(TYPES[p.t as number])}（${size(p.t)}）`, en: `${tr(TYPES[p.t as number])} (${size(p.t)})` }),
        target: { lon: p.lon as number, lat: p.lat as number, zoom: 10 },
      };
    });
  },
  empty: { zh: '這一年還沒有清單裡的設施', en: 'No facilities in the lists yet in this year' },
};

const count = (v: number) => tr({ zh: `${v} 個`, en: v === 1 ? '1 facility' : `${v} facilities` });

export const scienceFacilities: TopicDefinition = {
  id: 'science-facilities',
  title: { zh: '大型科學設施（核融合、同步輻射、加速器、望遠鏡）', en: 'Big science facilities: fusion, light sources, accelerators and telescopes' },
  shortTitle: { zh: '大型科學設施', en: 'Big science' },
  defaultIndicator: 'map',
  defaultYear: LAST,
  sources: [
    {
      name: {
        zh: '英文維基百科「List of fusion experiments」（revid 1379837384）、「List of synchrotron radiation facilities」（revid 1352120251）、「List of accelerators in particle physics」（revid 1369387346）',
        en: 'English Wikipedia, “List of fusion experiments” (revision 1379837384), “List of synchrotron radiation facilities” (revision 1352120251) and “List of accelerators in particle physics” (revision 1369387346)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_fusion_experiments&oldid=1379837384',
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科「List of largest optical reflecting telescopes」（revid 1380348596）、「List of radio telescopes」（revid 1371673085）、「List of astronomical observatories」（revid 1377735702）、「List of neutrino experiments」（revid 1379607454）',
        en: 'English Wikipedia, “List of largest optical reflecting telescopes” (revision 1380348596), “List of radio telescopes” (revision 1371673085), “List of astronomical observatories” (revision 1377735702) and “List of neutrino experiments” (revision 1379607454)',
      },
      url: 'https://en.wikipedia.org/wiki/List_of_radio_telescopes?oldid=1371673085',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '英文維基百科「TOP500」（revid 1379703900，超級電腦的國別分布）', en: 'English Wikipedia, “TOP500” (revision 1379703900; supercomputers by country)' },
      url: 'https://en.wikipedia.org/wiki/TOP500?oldid=1379703900',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '英文維基百科「List of quantum processors」（revid 1380988323）', en: 'English Wikipedia, “List of quantum processors” (revision 1380988323)' },
      url: 'https://en.wikipedia.org/wiki/List_of_quantum_processors?oldid=1380988323',
      license: 'CC BY-SA 4.0',
    },
    { name: { zh: 'Wikidata（位置；天文設施另用啟用與關閉年份）', en: 'Wikidata (locations; start and end years for astronomy)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
  ],
  note: {
    zh: '收英文維基三個清單的 381 個設施：核融合的托卡馬克、仿星器、雷射三個表（其他類型是條列、沒有年份，不收），同步輻射光源與自由電子雷射，粒子物理的加速器與對撞機（清單只收「輸出直接用在實驗」的加速器）。取消的與沒有地點的構想（DEMO、EFPP 等）不收。位置用表裡連結的條目在 Wikidata 的座標（裝置本身沒有座標的用所屬機構或城市：381 個設施裡只有 114 個用裝置本身的座標，2026-11-05 查）。同步輻射表的除役欄空白的當作還在運作；已關閉但停止年份不明的，從啟用那年起就畫成灰色。同一個機構的設施疊在同一點，看左邊的清單。2026-11-07 加天文設施（英文維基另外四個清單）：大型光學望遠鏡 49 個、電波望遠鏡 168 個、天文台 516 個（只收有啟用年份、在 Wikidata 有座標的；也在望遠鏡或微中子清單裡的不重複）、微中子實驗 48 個；地點是設施所在地，不是出資國（日本的昴星團望遠鏡畫在夏威夷）。電波望遠鏡清單沒有年份，用 Wikidata 的啟用與關閉年份，沒有的只在 2026 年出現。',
    en: 'The 381 facilities in three English Wikipedia lists: the tokamak, stellarator and laser tables of fusion experiments (other types are bullet lists without dates and are left out), synchrotron light sources and free-electron lasers, and particle physics accelerators and colliders (the list covers only accelerators whose output was used directly in experiments). Cancelled projects and unsited concepts (DEMO, EFPP and others) are left out. Locations are Wikidata coordinates of the articles linked in the tables (the host institution or city where the device itself has none: only 114 of the 381 facilities use the device’s own coordinates, checked 2026-11-05). Light sources with a blank decommissioning column are treated as still operating; closed facilities with an unknown end date are drawn in grey from their start year. Facilities at the same institution share one point; see the list on the left. Astronomy facilities were added on 7 November 2026 from four more English Wikipedia lists: 49 large optical telescopes, 168 radio telescopes, 516 observatories (only those with a founding year and Wikidata coordinates, without duplicating the telescope and neutrino lists) and 48 neutrino experiments; they are placed where they stand, not by funding country (Japan’s Subaru Telescope is in Hawaii). The radio telescope list has no dates, so Wikidata start and end years are used, and those without appear only in 2026.',
  },
  listPanel: LIST,
  overlays: [RUNNING, CLOSED_LAYER, PLANNED_LAYER],
  indicators: [
    {
      id: 'map',
      label: { zh: '設施地圖', en: 'Facility map' },
      description: {
        zh: '世界的核融合研究裝置、同步輻射光源與粒子加速器，依啟用年份出現，顏色是種類，已關閉的變灰。2026 年運作中的約 175 個，美國 44、日本 22、德國與俄羅斯各 17、中國與瑞士（CERN）各 12。最早的是 1928 年亞琛的直線加速器與 1931 年柏克萊的 9 吋迴旋加速器；第一台托卡馬克是 1958 年莫斯科的 T-1。興建中的有 ITER（法國，預定 2034 年）、SPARC 等。台灣有新竹的台灣光源（1993）與台灣光子源（2015），天文設施有鹿林天文台（1999）。天文設施另外算在「天文設施」指標，不算進運作中的設施數。',
        en: 'Fusion experiments, synchrotron light sources and particle accelerators around the world, appearing in the year they started, coloured by type and turning grey once closed. About 175 were operating in 2026: 44 in the US, 22 in Japan, 17 each in Germany and Russia, and 12 each in China and Switzerland (CERN). The earliest are the 1928 linear accelerator in Aachen and Berkeley’s 9-inch cyclotron of 1931; the first tokamak was T-1 in Moscow in 1958. ITER (France, planned for 2034) and SPARC are among those under construction. Taiwan has the Taiwan Light Source (1993) and Taiwan Photon Source (2015) in Hsinchu, and Lulin Observatory (1999) among the astronomy facilities. Astronomy facilities are counted in their own indicator, not in operating facilities.',
      },
      unit: { zh: '個', en: 'facilities' },
      file: 'operating.json',
      layer: { kind: 'none' },
      integer: true,
      format: count,
      missing: { zh: '清單裡沒有這個國家運作中的設施', en: 'No operating facility in the lists' },
    },
    {
      id: 'operating',
      label: { zh: '運作中的設施數', en: 'Operating facilities' },
      description: {
        zh: '每個國家那一年運作中的核融合研究裝置、同步輻射光源、粒子加速器與對撞機（英文維基三個清單）。停止年份不明的不算。',
        en: 'Fusion experiments, synchrotron light sources and particle accelerators operating in each country that year (three English Wikipedia lists). Those with an unknown end date are not counted.',
      },
      unit: { zh: '個', en: 'facilities' },
      file: 'operating.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 40] } },
      integer: true,
      format: count,
      missing: { zh: '清單裡沒有這個國家運作中的設施', en: 'No operating facility in the lists' },
    },
    {
      id: 'fusion',
      label: { zh: '核融合研究裝置', en: 'Fusion experiments' },
      description: {
        zh: '那一年運作中的托卡馬克、仿星器與雷射核融合裝置。2026 年美國最多（17 個），其次是俄羅斯、中國、日本；歐洲的 JET 2023 年關閉，日本的 JT-60SA 2023 年啟用。',
        en: 'Tokamaks, stellarators and laser fusion facilities operating that year. The US has the most in 2026 (17), followed by Russia, China and Japan; Europe’s JET closed in 2023 and Japan’s JT-60SA started in 2023.',
      },
      unit: { zh: '個', en: 'facilities' },
      file: 'fusion.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 15] } },
      integer: true,
      format: count,
      missing: { zh: '清單裡沒有這個國家運作中的核融合裝置', en: 'No operating fusion experiment in the list' },
    },
    {
      id: 'light',
      label: { zh: '同步輻射光源', en: 'Light sources' },
      description: {
        zh: '那一年運作中的同步輻射光源與自由電子雷射（除役欄空白的當作還在運作）。美國、日本最多，其次是德國；台灣 2 座。',
        en: 'Synchrotron light sources and free-electron lasers operating that year (those with a blank decommissioning column are treated as operating). The US and Japan have the most, followed by Germany; Taiwan has two.',
      },
      unit: { zh: '個', en: 'facilities' },
      file: 'light.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 15] } },
      integer: true,
      format: count,
      missing: { zh: '清單裡沒有這個國家運作中的光源', en: 'No operating light source in the list' },
    },
    {
      id: 'accelerators',
      label: { zh: '粒子加速器與對撞機', en: 'Accelerators and colliders' },
      description: {
        zh: '那一年運作中的粒子物理加速器與對撞機（英文維基「List of accelerators in particle physics」，只收輸出直接用在實驗的）。CERN 在瑞士與法國的邊界上，座標在瑞士這一側，算在瑞士。',
        en: 'Particle physics accelerators and colliders operating that year (English Wikipedia’s “List of accelerators in particle physics”, which lists only those whose output is used directly in experiments). CERN straddles the Swiss–French border; its coordinates are on the Swiss side, so it counts for Switzerland.',
      },
      unit: { zh: '個', en: 'facilities' },
      file: 'accelerators.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 10, 15] } },
      integer: true,
      format: count,
      missing: { zh: '清單裡沒有這個國家運作中的加速器', en: 'No operating accelerator in the list' },
    },
    {
      id: 'astronomy',
      label: { zh: '天文設施', en: 'Astronomy facilities' },
      description: {
        zh: '那一年運作中的大型光學望遠鏡、電波望遠鏡、天文台與微中子實驗（英文維基四個清單，2026-11-07 加）。2026 年共 729 個：美國 267 個最多，其次英國 49、智利 34（阿塔卡瑪沙漠的大型天文台）、澳洲與西班牙各 27、法國 21、加拿大與德國各 20；台灣是鹿林天文台。最大的光學望遠鏡是大雙筒望遠鏡（LBT，口徑合計 11.9 m，2005）、加那利大型望遠鏡（10.4 m，2006）、凱克一號與二號（各 10 m）；阿雷西博望遠鏡 2020 年倒塌。天文台清單有很多大學的小天文台，數量不代表研究規模。',
        en: 'Large optical telescopes, radio telescopes, observatories and neutrino experiments operating that year (four English Wikipedia lists, added 7 November 2026). 729 in 2026: the US has the most (267), then the UK 49, Chile 34 (the large observatories of the Atacama), Australia and Spain 27 each, France 21, Canada and Germany 20 each; Taiwan has Lulin Observatory. The largest optical telescopes are the Large Binocular Telescope (11.9 m combined, 2005), the Gran Telescopio Canarias (10.4 m, 2006) and Keck 1 and 2 (10 m each); the Arecibo Telescope collapsed in 2020. The observatory list includes many small university observatories, so counts do not reflect research scale.',
      },
      unit: { zh: '個', en: 'facilities' },
      file: 'astronomy.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 6, 12, 25, 50] } },
      integer: true,
      format: count,
      missing: { zh: '清單裡沒有這個國家運作中的天文設施', en: 'No operating astronomy facility in the lists' },
    },
    // 2026-11-07（製作手冊第二十五批 513）TOP500 的國別分布（英文維基 TOP500 條目，pipeline/topics/top500.py）
    {
      id: 'supercomputers',
      label: { zh: '超級電腦（TOP500 的系統數）', en: 'Supercomputers (TOP500 systems)' },
      description: {
        zh: 'TOP500 是自願申報的榜：美國國家安全局 1998 年後就不再申報，中國青島 2021 年完成的 exaflops 機器 OceanLight 也沒有送榜，所以數量不等於實力。每年 6 月榜上各國的系統數（英文維基「TOP500」條目的歷年表，2007–2026 年；TOP500 官網沒有資料授權，不用）。2026 年 6 月：美國 161 台、日本 44、德國 41、中國 31、法國 21、南韓 19、義大利 18、加拿大 17、英國與台灣各 11、巴西 10。台灣 2007 年有 10 台，2010、2016、2017 年是 0 台，2024 年 6 台、2025 年 8 台、2026 年 11 台；最快的是國網中心的 Nano 4（第 33 名，Rmax 81.55 PFlop/s）。點國家看它在榜上最快的機器。',
        en: 'TOP500 relies on voluntary submissions: the US National Security Agency stopped submitting after 1998, and OceanLight, the exaflops machine completed in Qingdao, China, in 2021, was never submitted, so counts do not equal capability. Systems per country on each June list (the history table in the English Wikipedia article “TOP500”, 2007–2026; the TOP500 website has no data licence and is not used). June 2026: the US 161, Japan 44, Germany 41, China 31, France 21, South Korea 19, Italy 18, Canada 17, the UK and Taiwan 11 each, Brazil 10. Taiwan had 10 in 2007, none in 2010, 2016 and 2017, then 6 in 2024, 8 in 2025 and 11 in 2026; its fastest is Nano 4 at NCHC (rank 33, Rmax 81.55 PFlop/s). Click a country to see its fastest system on the list.',
      },
      unit: { zh: '台', en: 'systems' },
      file: 'supercomputers.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 3, 6, 10, 20, 40] } },
      integer: true,
      format: (v) => tr({ zh: `${v} 台`, en: v === 1 ? '1 system' : `${v} systems` }),
      timeAxis: { label: { zh: '每年 6 月的榜', en: 'June list of each year' }, year: (y: number) => tr({ zh: `${y} 年 6 月`, en: `June ${y}` }) },
      missing: { zh: '這一年的榜上沒有這個國家的系統', en: 'No system on that year’s list' },
    },
    // 2026-11-07（製作手冊第二十五批 516）量子處理器（英文維基「List of quantum processors」，pipeline/topics/quantum.py）
    {
      id: 'quantum-processors',
      label: { zh: '量子處理器（累計發表數）', en: 'Quantum processors announced (cumulative)' },
      description: {
        zh: '到那一年為止，這一國的製造商發表的量子處理器數（英文維基「List of quantum processors」，2011 年的 D-Wave One 起；國家是製造商總部所在國）。2026 年累計：美國 49 個（IBM 最多）、加拿大 10（D-Wave、Xanadu）、英國 7（Quantinuum 等）、中國與荷蘭各 6、奧地利、德國、芬蘭各 2、法國與日本各 1。條目自己說有些只在記者會發表、沒有實際展示；「發表」不等於「做得出來」。清單裡沒有台灣的製造商。',
        en: 'Quantum processors announced by manufacturers in each country up to that year (English Wikipedia’s “List of quantum processors”, from D-Wave One in 2011; country of the manufacturer’s headquarters). Cumulative to 2026: the US 49 (IBM the most), Canada 10 (D-Wave, Xanadu), the UK 7 (Quantinuum and others), China and the Netherlands 6 each, Austria, Germany and Finland 2 each, France and Japan 1 each. The article notes that some were only announced at press conferences without demonstrations, so “announced” does not mean “working”. The list has no manufacturer in Taiwan.',
      },
      unit: { zh: '個', en: 'processors' },
      file: 'quantum/processors.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 4, 8, 20, 40] } },
      integer: true,
      format: (v) => tr({ zh: `${v} 個`, en: `${v}` }),
      missing: { zh: '清單裡沒有這一國的製造商', en: 'No manufacturer from this country in the list' },
    },
    {
      id: 'quantum-qubits',
      label: { zh: '量子處理器最多的量子位元數', en: 'Most qubits in a quantum processor' },
      description: {
        zh: '到那一年為止，這一國的製造商發表過最多量子位元的處理器。2026 年：加拿大 5,000（D-Wave 的量子退火機，跟閘道型的位元不能直接比）、美國 1,180、中國 504、英國 200、荷蘭 64、日本 53、奧地利 24、芬蘭 20。各家的「量子位元」定義不一（物理或邏輯、退火或閘道），只能當大致的規模。',
        en: 'The most qubits in a processor announced by the country’s manufacturers up to that year. 2026: Canada 5,000 (D-Wave’s quantum annealer, not comparable with gate-based qubits), the US 1,180, China 504, the UK 200, the Netherlands 64, Japan 53, Austria 24, Finland 20. Makers define qubits differently (physical or logical, annealing or gate-based), so treat this as rough scale only.',
      },
      unit: { zh: '量子位元', en: 'qubits' },
      file: 'quantum/qubits.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 30, 60, 150, 500, 1000] } },
      integer: true,
      format: (v) => tr({ zh: `${v.toLocaleString()} 個量子位元`, en: `${v.toLocaleString()} qubits` }),
      missing: { zh: '清單裡沒有這一國的製造商', en: 'No manufacturer from this country in the list' },
    },
  ],
};
