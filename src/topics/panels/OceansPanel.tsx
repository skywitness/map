import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { EChart } from '../../charts/EChart';
import { stackedAreaOption, type StackedSeries } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed, formatLargeTick } from '../../lib/format';
import { km2, tonnes } from '../oceans';
import type { IndicatorData, PanelExtraProps } from '../types';

/**
 * 海洋與漁業的側欄（pipeline/topics/oceans.py 的 countries/<ISO3>.json 與兩個產量指標檔）：
 * - 捕撈與養殖的變化（堆疊面積）
 * - 主要的水產種類（FAO 的 ISSCAAP 物種組，最新一年）、捕撈在哪些 FAO 漁區
 * - 專屬經濟海域：組成（夏威夷、阿拉斯加…）、主權國的合計與海外領地、跟其他國家重疊主張或共同管理的海域
 * - 台灣：漁業署《漁業統計年報》各漁業種類的產量，跟 FAO 對照
 */

type FaType = 'distant' | 'offshore' | 'coastal' | 'inlandCapture' | 'marineCulture' | 'inlandCulture';

interface OceansDetail {
  eez?: {
    /** 這個地方的海域由哪幾塊組成（name 是 null 的是本土）；claim 是 Marine Regions 標為重疊主張的各方 */
    parts?: { zh: string | null; en: string | null; km2: number; claim?: string[] }[];
    /** 依 Marine Regions 的主權國欄位加總（只有有海外領地的國家） */
    sovereign?: { total: number; rank: number; of: number; territories: [string, number][] };
    /** 跟其他國家重疊主張或共同管理、沒有算進任何一方的海域 */
    shared?: { id: number; kind: 'claim' | 'joint'; zh: string | null; en: string | null; parties: string[]; km2: number }[];
    /** 這個國家是當事方之一、但照屬地算給別處的重疊主張（例如台灣周邊海域之於中國、福克蘭群島之於阿根廷） */
    claimedElsewhere?: { iso: string; km2: number; parties: string[]; zh?: string; en?: string }[];
  };
  groups?: { year: number; capture?: [string, number][]; aquaculture?: [string, number][] };
  areas?: { year: number; items: [string, number][] };
  taiwan?: {
    years: number[];
    rows: Record<FaType, number[]>;
    fao: { capture: (number | null)[]; aquaculture: (number | null)[] };
    oyster: { year: number; fao: number; fa: number };
    url: string;
  };
}

/** FAO 的 ISSCAAP 物種組（FishStat 的英文名稱 → 中英文的短名稱）；空字串是「其他」 */
const GROUPS: Record<string, Text> = {
  'Abalones, winkles, conchs': { zh: '鮑魚與螺類', en: 'Abalones, winkles, conchs' },
  'Carps, barbels and other cyprinids': { zh: '鯉科魚類', en: 'Carps and other cyprinids' },
  'Clams, cockles, arkshells': { zh: '蛤、鳥蛤與蚶', en: 'Clams, cockles, arkshells' },
  'Cods, hakes, haddocks': { zh: '鱈類', en: 'Cods, hakes, haddocks' },
  'Crabs, sea-spiders': { zh: '蟹類', en: 'Crabs' },
  'Flounders, halibuts, soles': { zh: '比目魚（鰈、鮃、鰨）', en: 'Flounders, halibuts, soles' },
  'Freshwater crustaceans': { zh: '淡水甲殼類', en: 'Freshwater crustaceans' },
  'Freshwater molluscs': { zh: '淡水貝類', en: 'Freshwater molluscs' },
  'Frogs and other amphibians': { zh: '蛙類等兩棲類', en: 'Frogs and other amphibians' },
  'Herrings, sardines, anchovies': { zh: '鯡、沙丁魚與鯷', en: 'Herrings, sardines, anchovies' },
  'Horseshoe crabs and other arachnoids': { zh: '鱟等', en: 'Horseshoe crabs' },
  'King crabs, squat-lobsters': { zh: '帝王蟹與鎧甲蝦', en: 'King crabs, squat lobsters' },
  'Krill, planktonic crustaceans': { zh: '磷蝦等浮游甲殼類', en: 'Krill' },
  'Lobsters, spiny-rock lobsters': { zh: '龍蝦類', en: 'Lobsters' },
  'Marine fishes not identified': { zh: '未分類的海水魚', en: 'Marine fish, unidentified' },
  'Miscellaneous aquatic invertebrates': { zh: '其他水生無脊椎動物', en: 'Other aquatic invertebrates' },
  'Miscellaneous coastal fishes': { zh: '其他沿岸魚類', en: 'Other coastal fish' },
  'Miscellaneous demersal fishes': { zh: '其他底棲魚類', en: 'Other demersal fish' },
  'Miscellaneous diadromous fishes': { zh: '其他洄游魚類（虱目魚等）', en: 'Other diadromous fish (milkfish…)' },
  'Miscellaneous freshwater fishes': { zh: '其他淡水魚', en: 'Other freshwater fish' },
  'Miscellaneous marine crustaceans': { zh: '其他海水甲殼類', en: 'Other marine crustaceans' },
  'Miscellaneous marine molluscs': { zh: '其他海水軟體動物', en: 'Other marine molluscs' },
  'Miscellaneous pelagic fishes': { zh: '其他表層魚類（鯖、秋刀魚等）', en: 'Other pelagic fish (mackerels, saury…)' },
  Mussels: { zh: '貽貝', en: 'Mussels' },
  Oysters: { zh: '牡蠣', en: 'Oysters' },
  'River eels': { zh: '鰻魚', en: 'River eels' },
  'Salmons, trouts, smelts': { zh: '鮭、鱒與胡瓜魚', en: 'Salmon, trout, smelts' },
  'Scallops, pectens': { zh: '扇貝', en: 'Scallops' },
  'Sea-squirts and other tunicates': { zh: '海鞘等被囊動物', en: 'Sea squirts' },
  'Sea-urchins and other echinoderms': { zh: '海膽、海參等棘皮動物', en: 'Sea urchins, sea cucumbers' },
  Shads: { zh: '鰣類', en: 'Shads' },
  'Sharks, rays, chimaeras': { zh: '鯊、魟與銀鮫', en: 'Sharks, rays, chimaeras' },
  'Shrimps, prawns': { zh: '蝦類', en: 'Shrimps, prawns' },
  'Squids, cuttlefishes, octopuses': { zh: '魷魚、烏賊與章魚', en: 'Squids, cuttlefish, octopuses' },
  'Sturgeons, paddlefishes': { zh: '鱘類', en: 'Sturgeons' },
  'Tilapias and other cichlids': { zh: '吳郭魚等慈鯛', en: 'Tilapias and other cichlids' },
  'Tunas, bonitos, billfishes': { zh: '鮪、鰹與旗魚', en: 'Tunas, bonitos, billfishes' },
  Turtles: { zh: '龜鱉類', en: 'Turtles' },
  '': { zh: '其他', en: 'Other' },
};

/** FAO 的主要漁區（Major Fishing Areas）；01–08 是各洲的內陸水域；空字串是「其他」 */
const AREAS: Record<string, Text> = {
  '01': { zh: '非洲的內陸水域', en: 'Africa, inland waters' },
  '02': { zh: '北美洲的內陸水域', en: 'North America, inland waters' },
  '03': { zh: '南美洲的內陸水域', en: 'South America, inland waters' },
  '04': { zh: '亞洲的內陸水域', en: 'Asia, inland waters' },
  '05': { zh: '歐洲的內陸水域', en: 'Europe, inland waters' },
  '06': { zh: '大洋洲的內陸水域', en: 'Oceania, inland waters' },
  '07': { zh: '前蘇聯地區的內陸水域', en: 'Former USSR, inland waters' },
  '08': { zh: '南極洲的內陸水域', en: 'Antarctica, inland waters' },
  '18': { zh: '北冰洋', en: 'Arctic Sea' },
  '21': { zh: '西北大西洋', en: 'Atlantic, Northwest' },
  '27': { zh: '東北大西洋', en: 'Atlantic, Northeast' },
  '31': { zh: '中西大西洋', en: 'Atlantic, Western Central' },
  '34': { zh: '中東大西洋', en: 'Atlantic, Eastern Central' },
  '37': { zh: '地中海與黑海', en: 'Mediterranean and Black Sea' },
  '41': { zh: '西南大西洋', en: 'Atlantic, Southwest' },
  '47': { zh: '東南大西洋', en: 'Atlantic, Southeast' },
  '48': { zh: '南極海（大西洋區）', en: 'Atlantic, Antarctic' },
  '51': { zh: '西印度洋', en: 'Indian Ocean, Western' },
  '57': { zh: '東印度洋', en: 'Indian Ocean, Eastern' },
  '58': { zh: '南極海（印度洋區）', en: 'Indian Ocean, Antarctic' },
  '61': { zh: '西北太平洋', en: 'Pacific, Northwest' },
  '67': { zh: '東北太平洋', en: 'Pacific, Northeast' },
  '71': { zh: '中西太平洋', en: 'Pacific, Western Central' },
  '77': { zh: '中東太平洋', en: 'Pacific, Eastern Central' },
  '81': { zh: '西南太平洋', en: 'Pacific, Southwest' },
  '87': { zh: '東南太平洋', en: 'Pacific, Southeast' },
  '88': { zh: '南極海（太平洋區）', en: 'Pacific, Antarctic' },
  '98': { zh: '南極地區（未分區）', en: 'Antarctic areas, unspecified' },
  '99': { zh: '南極以外的海域（未分區）', en: 'Marine areas outside the Antarctic, unspecified' },
  '': { zh: '其他漁區', en: 'Other areas' },
};

const FA_ROWS: { key: FaType; label: Text }[] = [
  { key: 'distant', label: { zh: '遠洋漁業', en: 'Distant-water' } },
  { key: 'offshore', label: { zh: '近海漁業', en: 'Offshore' } },
  { key: 'coastal', label: { zh: '沿岸漁業', en: 'Coastal' } },
  { key: 'inlandCapture', label: { zh: '內陸漁撈', en: 'Inland capture' } },
  { key: 'marineCulture', label: { zh: '海面養殖', en: 'Marine aquaculture' } },
  { key: 'inlandCulture', label: { zh: '內陸養殖', en: 'Inland aquaculture' } },
];
const CAPTURE_ROWS: FaType[] = ['distant', 'offshore', 'coastal', 'inlandCapture'];
const CULTURE_ROWS: FaType[] = ['marineCulture', 'inlandCulture'];

const TEXT = defineMessages({
  zh: {
    historyTitle: '捕撈與養殖的變化',
    historyAria: (country: string) => `${country}歷年的捕撈與養殖產量`,
    capture: '捕撈',
    aquaculture: '養殖',
    historyNote: 'FAO FishStat：魚、甲殼類、軟體動物等水生動物，活體重量（貝類含殼），不含海藻。',
    groupsTitle: (year: number) => `主要的水產種類（${year} 年）`,
    groupsAria: (country: string, what: string) => `${country}${what}的物種組`,
    groupsNote: '依 FAO 的 ISSCAAP 物種分類。',
    areasTitle: (year: number) => `在哪些海域捕撈（${year} 年）`,
    areasAria: (country: string) => `${country}的捕撈量，依 FAO 漁區`,
    areasNote:
      'FAO 的主要漁區（Major Fishing Areas）。捕撈量算在漁船的船旗國：遠洋漁船在別國周邊或公海捕的魚，也算在這裡。',
    eezTitle: '專屬經濟海域',
    partsAria: (country: string) => `${country}專屬經濟海域的組成`,
    mainland: (country: string) => `${country}（本土）`,
    claimNote: (parties: string) => `Marine Regions 標為重疊主張（${parties}）`,
    sovereignSummary: (country: string, total: string, rank: number, of: number) =>
      `依 Marine Regions 的主權國欄位，${country}和海外領地合計 ${total}，${of} 個主權國中第 ${rank} 名。各領地在地圖上分開計算：`,
    sovereignAria: (country: string) => `${country}與海外領地的專屬經濟海域`,
    claimedElsewhere: (territory: string, parties: string, area: string) =>
      `Marine Regions 把${territory}的海域（${area}）標為重疊主張（${parties}），照屬地欄位算在${territory}。`,
    sharedTitle: '跟其他國家重疊主張或共同管理的海域（沒有算進任何一方）',
    claim: '重疊主張',
    joint: '共同管理區',
    noPlace: '海域劃界',
    sharedItem: (what: string, place: string, parties: string, area: string) =>
      `${place}：${what}${parties ? `（${parties}）` : ''}，${area}`,
    southChinaSea: '；Marine Regions 這一塊只列出中國，沒有逐一列出其他聲索方',
    eezNote:
      'Flanders Marine Institute (2023)，Maritime Boundaries Geodatabase 第 12 版（Marine Regions）。面積含內水、群島水域與領海。Marine Regions 對任何國家、領土的法律地位與界線不表示意見；這裡照它的分類呈現，不代表本站的立場。',
    twTitle: '漁業署的統計（公噸）',
    twAria: '漁業署《漁業統計年報》的台灣漁業生產量，依漁業種類',
    colType: '漁業種類',
    captureTotal: '捕撈合計',
    cultureTotal: '養殖合計',
    faoCapture: 'FAO 捕撈',
    faoCulture: 'FAO 養殖',
    twNote: (year: number, fao: string, fa: string) =>
      `捕撈跟 FAO 幾乎一樣（每年相差幾個百分點以內）。養殖差很多，幾乎都是牡蠣：FAO 一律用活體重量（貝類含殼），${year} 年的牡蠣 ${fao}，漁業署是 ${fa}。漁業署 2025 年的數字 FAO 還沒有。`,
    twSource: '農業部漁業署《漁業統計年報》',
  },
  en: {
    historyTitle: 'Capture and aquaculture over time',
    historyAria: (country) => `Capture and aquaculture production of ${country} by year`,
    capture: 'Capture',
    aquaculture: 'Aquaculture',
    historyNote: 'FAO FishStat: fish, crustaceans, molluscs and other aquatic animals, live weight (shells included), excluding seaweed.',
    groupsTitle: (year) => `Main species groups (${year})`,
    groupsAria: (country, what) => `${what} of ${country} by species group`,
    groupsNote: 'FAO’s ISSCAAP species groups.',
    areasTitle: (year) => `Where the catch comes from (${year})`,
    areasAria: (country) => `Capture production of ${country} by FAO fishing area`,
    areasNote:
      'FAO Major Fishing Areas. Catches count for the vessel’s flag state, so fish caught by distant-water fleets off other coasts or on the high seas count here too.',
    eezTitle: 'Exclusive economic zone',
    partsAria: (country) => `Parts of the exclusive economic zone of ${country}`,
    mainland: (country) => `${country} (mainland)`,
    claimNote: (parties) => `Overlapping claim in Marine Regions (${parties})`,
    sovereignSummary: (country, total, rank, of) =>
      `Summed by Marine Regions’ sovereign field, ${country} and its overseas territories total ${total}, #${rank} of ${of} sovereign states. Each territory is counted separately on the map:`,
    sovereignAria: (country) => `Exclusive economic zones of ${country} and its overseas territories`,
    claimedElsewhere: (territory, parties, area) =>
      `Marine Regions classifies the waters of ${territory} (${area}) as an overlapping claim (${parties}); following its territory field they are counted for ${territory}.`,
    sharedTitle: 'Areas of overlapping claims or joint regimes with other countries (not counted for any party)',
    claim: 'overlapping claim',
    joint: 'joint regime',
    noPlace: 'Maritime boundary',
    sharedItem: (what, place, parties, area) => `${place}: ${what}${parties ? ` (${parties})` : ''}, ${area}`,
    southChinaSea: '; Marine Regions lists only China for this area and does not list the other claimants',
    eezNote:
      'Flanders Marine Institute (2023), Maritime Boundaries Geodatabase v12 (Marine Regions). Areas include internal, archipelagic and territorial waters. Marine Regions expresses no opinion on the legal status of any country or territory or on its boundaries; they are shown as Marine Regions classifies them, which implies no position of this site.',
    twTitle: 'Fisheries Agency statistics (tonnes)',
    twAria: 'Taiwan’s fisheries production by type, from the Fisheries Agency’s yearbook',
    colType: 'Type',
    captureTotal: 'Capture total',
    cultureTotal: 'Aquaculture total',
    faoCapture: 'FAO capture',
    faoCulture: 'FAO aquaculture',
    twNote: (year, fao, fa) =>
      `Capture matches FAO closely (within a few per cent each year). Aquaculture differs a lot, almost entirely because of oysters: FAO always uses live weight (shells included), ${fao} of oysters in ${year} against the agency’s ${fa}. FAO does not yet have the agency’s 2025 figures.`,
    twSource: 'Fisheries Agency, Ministry of Agriculture: Fisheries Statistical Yearbook',
  },
});

/** 側欄的長條列出幾個領地 */
const SHOWN_TERRITORIES = 8;
const SOUTH_CHINA_SEA = 49003;
/** 側欄的清單寫到 km²（地圖與長條用萬、M 的大數） */
const km2Exact = (v: number) => `${fixed(v, 0)} km²`;

export default function OceansPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const base = `topics/${topic.id}`;
  const countries = useJson<CountryTable>('countries.json').data;
  const detail = useJson<OceansDetail>(`${base}/countries/${iso3}.json`);
  const [capture, aquaculture] = useJsonMany<IndicatorData>([`${base}/capture.json`, `${base}/aquaculture.json`]);
  const name = (code: string) => nameOf(code, countries, lang);
  const joinNames = (codes: string[]) => codes.map(name).join(tr({ zh: '、', en: ', ' }, lang));

  const history = useMemo(() => {
    const c = capture?.values[iso3];
    const a = aquaculture?.values[iso3];
    if (!capture || !c || !a) return null;
    // 從第一個有產量的年份畫起
    const start = capture.years.findIndex((_, i) => (c[i] ?? 0) + (a[i] ?? 0) > 0);
    if (start < 0) return null;
    const years = capture.years.slice(start);
    const series: StackedSeries[] = [
      { name: text.capture, values: c.slice(start), color: tokens.hues.orange },
      { name: text.aquaculture, values: a.slice(start), color: tokens.hues.aqua },
    ];
    return stackedAreaOption({ years, series, year, format: tonnes, formatTick: formatLargeTick, tokens });
  }, [capture, aquaculture, iso3, year, tokens, text]);

  const d = detail.data;
  if (!d && !history) return detail.loading || !capture ? <p className="empty">{t.loading}</p> : null;

  const groupItems = (list: [string, number][] | undefined): BarListItem[] =>
    (list ?? []).map(([key, value]) => ({
      key,
      label: tr(GROUPS[key] ?? { zh: key, en: key }, lang),
      value,
      color: key === '' ? tokens.context : undefined,
    }));
  const total = (items: BarListItem[]) => items.reduce((s, i) => s + i.value, 0);
  const captureItems = groupItems(d?.groups?.capture);
  const cultureItems = groupItems(d?.groups?.aquaculture);
  const areaItems: BarListItem[] = (d?.areas?.items ?? []).map(([key, value]) => ({
    key,
    label: tr(AREAS[key] ?? { zh: key, en: key }, lang),
    value,
    color: key === '' ? tokens.context : undefined,
  }));

  const eez = d?.eez;
  const sovereignItems: BarListItem[] = [];
  if (eez?.sovereign) {
    const own = eez.sovereign.total - eez.sovereign.territories.reduce((s, [, v]) => s + v, 0);
    const ranked = [
      { key: iso3, label: countryName, value: own, color: tokens.accent as string | undefined },
      ...eez.sovereign.territories.map(([code, v]) => ({ key: code, label: name(code), value: v, color: undefined })),
    ].sort((a, b) => b.value - a.value);
    const shown = ranked.filter((i, n) => i.key === iso3 || n < SHOWN_TERRITORIES);
    sovereignItems.push(...shown);
    const rest = ranked.filter((i) => !shown.includes(i)).reduce((s, i) => s + i.value, 0);
    if (rest > 0) sovereignItems.push({ key: 'rest', label: tr({ zh: '其他領地', en: 'Other territories' }, lang), value: rest, color: tokens.context });
  }
  const tw = d?.taiwan;
  const sum = (keys: FaType[], i: number) => keys.reduce((s, k) => s + (tw?.rows[k][i] ?? 0), 0);
  const n0 = (v: number | null) => (v === null ? '–' : fixed(v, 0));

  return (
    <>
      {history && (
        <section className="panel-section">
          <h3>{text.historyTitle}</h3>
          <EChart option={history} height={200} ariaLabel={text.historyAria(countryName)} />
          <p className="note">{text.historyNote}</p>
        </section>
      )}

      {d?.groups && (captureItems.length > 0 || cultureItems.length > 0) && (
        <section className="panel-section">
          <h3>{text.groupsTitle(d.groups.year)}</h3>
          {captureItems.length > 0 && (
            <>
              <h4>{`${text.capture} · ${tonnes(total(captureItems))}`}</h4>
              <BarList items={captureItems} format={tonnes} total={total(captureItems)} ariaLabel={text.groupsAria(countryName, text.capture)} />
            </>
          )}
          {cultureItems.length > 0 && (
            <>
              <h4>{`${text.aquaculture} · ${tonnes(total(cultureItems))}`}</h4>
              <BarList items={cultureItems} format={tonnes} total={total(cultureItems)} ariaLabel={text.groupsAria(countryName, text.aquaculture)} />
            </>
          )}
          <p className="note">{text.groupsNote}</p>
        </section>
      )}

      {d?.areas && areaItems.length > 0 && (
        <section className="panel-section">
          <h3>{text.areasTitle(d.areas.year)}</h3>
          <BarList items={areaItems} format={tonnes} total={total(areaItems)} ariaLabel={text.areasAria(countryName)} />
          <p className="note">{text.areasNote}</p>
        </section>
      )}

      {eez && (
        <section className="panel-section">
          <h3>{text.eezTitle}</h3>
          {eez.parts && (
            <table className="mini-table" aria-label={text.partsAria(countryName)}>
              <tbody>
                {eez.parts.map((p, i) => (
                  <tr key={i}>
                    <th scope="row">
                      {p.zh && p.en ? tr({ zh: p.zh, en: p.en }, lang) : eez.parts!.length > 1 ? text.mainland(countryName) : countryName}
                      {p.claim && <div className="note">{text.claimNote(joinNames(p.claim))}</div>}
                    </th>
                    <td className="num">{km2Exact(p.km2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {eez.sovereign && (
            <>
              <p className="panel-year-note">
                {text.sovereignSummary(countryName, km2(eez.sovereign.total), eez.sovereign.rank, eez.sovereign.of)}
              </p>
              <BarList items={sovereignItems} format={km2} total={eez.sovereign.total} ariaLabel={text.sovereignAria(countryName)} />
            </>
          )}
          {eez.claimedElsewhere?.map((c) => (
            <p key={c.iso} className="note">
              {text.claimedElsewhere(
                c.zh && c.en ? tr({ zh: `${name(c.iso)}（${c.zh}）`, en: `${name(c.iso)} (${c.en})` }, lang) : name(c.iso),
                joinNames(c.parties),
                km2Exact(c.km2),
              )}
            </p>
          ))}
          {eez.shared && (
            <>
              <h4>{text.sharedTitle}</h4>
              <ul className="note source-list">
                {eez.shared.map((s) => (
                  <li key={s.id}>
                    {text.sharedItem(
                      s.kind === 'claim' ? text.claim : text.joint,
                      s.zh && s.en ? tr({ zh: s.zh, en: s.en }, lang) : text.noPlace,
                      joinNames(s.parties),
                      km2Exact(s.km2),
                    )}
                    {s.id === SOUTH_CHINA_SEA && text.southChinaSea}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="note">{text.eezNote}</p>
        </section>
      )}

      {tw && (
        <section className="panel-section">
          <h3>{text.twTitle}</h3>
          <table className="mini-table ocean-tw" aria-label={text.twAria}>
              <thead>
                <tr>
                  <th scope="col">{text.colType}</th>
                  {tw.years.map((y) => (
                    <th key={y} scope="col" className="num">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FA_ROWS.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{tr(r.label, lang)}</th>
                    {tw.rows[r.key].map((v, i) => (
                      <td key={i} className="num">
                        {n0(v)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">{text.captureTotal}</th>
                  {tw.years.map((y, i) => (
                    <td key={y} className="num">
                      {n0(sum(CAPTURE_ROWS, i))}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{text.faoCapture}</th>
                  {tw.fao.capture.map((v, i) => (
                    <td key={i} className="num">
                      {n0(v)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{text.cultureTotal}</th>
                  {tw.years.map((y, i) => (
                    <td key={y} className="num">
                      {n0(sum(CULTURE_ROWS, i))}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{text.faoCulture}</th>
                  {tw.fao.aquaculture.map((v, i) => (
                    <td key={i} className="num">
                      {n0(v)}
                    </td>
                  ))}
                </tr>
              </tbody>
          </table>
          <p className="note">
            {text.twNote(tw.oyster.year, tonnes(tw.oyster.fao), tonnes(tw.oyster.fa))}{' '}
            <a href={tw.url} target="_blank" rel="noreferrer">
              {text.twSource}
            </a>
          </p>
        </section>
      )}
    </>
  );
}
