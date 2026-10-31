import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { useAllPoints } from '../../lib/points';
import { fixed, formatLargeNumber, formatPercent, formatSignedPercent } from '../../lib/format';
import { CITY_LAYER, cityValue, EPOCHS, firstEpoch, growthBase } from '../cities';
import { overlayEpoch, type IndicatorData, type PanelExtraProps, type PointRecord } from '../types';

/** 一開始列出幾個城市，其他收在「顯示其餘」；再多的不列（中國有上千個） */
const SHOWN = 10;
const MAX_LISTED = 60;

/** taiwan.json（pipeline/topics/cities.py）：台灣主要的城市跟涵蓋它的縣市戶籍人口 */
interface TaiwanFile {
  year: number;
  ghslTotal: number;
  moiTotal: number;
  cities: number;
  rows: { name: string; zh: string | null; pop: number; area: number; counties: string[]; countiesEn: string[]; moi: number }[];
}

const TEXT = defineMessages({
  zh: {
    title: (country: string, year: number) => `${country}最大的城市（${year} 年）`,
    caption: (country: string, year: number) => `${country}人口最多的城市：${year} 年的人口、人口密度與 10 年來的變化`,
    summary: (year: number, n: number, total: string, share: string | null, million: number) =>
      `${year} 年有 ${n} 個城市，住了 ${total} 人${share ? `（占全國 ${share}）` : ''}${million ? `，其中 ${million} 個超過 100 萬人` : ''}。`,
    none: (year: number) => `${year} 年沒有人口 5 萬以上的城市。`,
    colCity: '城市',
    colPop: '人口',
    colDensity: '每 km²',
    colChange: (base: number) => `比 ${base} 年`,
    since: (y: number) => `${y} 年起`,
    more: (n: number, total: number) => (n < total ? `顯示其餘 ${n} 個（共 ${total} 個）` : `顯示其餘 ${n} 個`),
    method:
      '城市是每 km² 1,500 人以上的 1 km 格子連成一片、合計 5 萬人以上的連續市區，不是行政區；每一期的範圍各自劃定。名稱是 Wikidata 的中文名稱，沒有的寫 GHS-WUP 的英文名稱。',
    taiwanTitle: '台灣的城市與縣市',
    taiwan: (t: TaiwanFile, taipei: TaiwanFile['rows'][number]) =>
      `GHSL 的城市是連續的市區，不是行政區：臺北、新北、桃園、基隆的市區連成一片，算一個城市（${fixed(taipei.area, 0)} km²、${formatLargeNumber(taipei.pop)} 人）；臺中與彰化、臺南與高雄則是分開的城市。下表把 GHSL 的城市人口跟涵蓋它的縣市戶籍人口（內政部 ${t.year} 年底）放在一起。臺北這個城市幾乎等於四市的戶籍人口合計；GHSL 的人口網格配合聯合國 WPP 2024，台灣總人口 ${formatLargeNumber(t.ghslTotal)} 人，跟內政部的 ${formatLargeNumber(t.moiTotal)} 人差 ${formatPercent((t.ghslTotal / t.moiTotal - 1) * 100, 1)}；其他城市只占縣市的一部分（臺中市的山區、臺南市的鄉村都不算城市）。城市的人口 ${t.year} 年起是推估。`,
    colUcdb: (year: number) => `城市（${year} 年）`,
    colCounties: '涵蓋的縣市',
    colMoi: '戶籍人口',
    taiwanSource: '戶籍人口：內政部戶政司開放資料（村里戶數、人口數）加總成縣市。',
    listSeparator: '、',
  },
  en: {
    title: (country, year) => `Largest cities in ${country} (${year})`,
    caption: (country, year) => `Most populous cities in ${country}: population, density and change over 10 years, ${year}`,
    summary: (year, n, total, share, million) =>
      `${n} ${n === 1 ? 'city' : 'cities'} in ${year}, home to ${total} people${share ? ` (${share} of the population)` : ''}${million ? `; ${million} with more than a million` : ''}.`,
    none: (year) => `No city of 50,000 people or more in ${year}.`,
    colCity: 'City',
    colPop: 'Population',
    colDensity: 'Per km²',
    colChange: (base) => `vs ${base}`,
    since: (y) => `since ${y}`,
    more: (n, total) => (n < total ? `Show ${n} more (of ${total})` : `Show ${n} more`),
    method:
      'A city is a continuous urban area of 1 km cells with at least 1,500 people per km² and 50,000 people in total, not an administrative unit; boundaries are drawn separately for each period. Names are GHS-WUP’s English names.',
    taiwanTitle: 'Taiwan’s cities and municipalities',
    taiwan: (t, taipei) =>
      `GHSL cities are continuous urban areas, not administrative units: the built-up areas of Taipei, New Taipei, Taoyuan and Keelung form one city (${fixed(taipei.area, 0)} km², ${formatLargeNumber(taipei.pop)} people), while Taichung and Changhua, and Tainan and Kaohsiung, are separate cities. The table compares GHSL city populations with the registered population of the municipalities and counties they lie in (Ministry of the Interior, end of ${t.year}). The Taipei city has almost as many people as the four municipalities combined; the GHSL population grid is aligned with UN WPP 2024, which puts Taiwan at ${formatLargeNumber(t.ghslTotal)}, ${formatPercent((t.ghslTotal / t.moiTotal - 1) * 100, 1)} off the ${formatLargeNumber(t.moiTotal)} on the household register; the other cities cover only part of their municipality (Taichung’s mountains and rural Tainan are not urban). City populations from ${t.year} on are projections.`,
    colUcdb: (year) => `City (${year})`,
    colCounties: 'Municipalities',
    colMoi: 'Registered',
    taiwanSource: 'Registered population: Department of Household Registration open data (population by village), summed by municipality and county.',
    listSeparator: ', ',
  },
});

export default function CitiesPanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  // 城市分兩個檔（cities.json 是曾經到過 30 萬人的，其餘的在 cities-more.json）：側欄的清單兩個都讀
  const { points, error } = useAllPoints(`topics/${topic.id}/cities.json`, true);
  const shares = useJson<IndicatorData>(`topics/${topic.id}/city-share.json`).data;
  const taiwan = useJson<TaiwanFile>(iso3 === 'TWN' ? `topics/${topic.id}/taiwan.json` : null).data;
  const epoch = overlayEpoch(CITY_LAYER, year) ?? EPOCHS[EPOCHS.length - 1];

  const list = useMemo(() => {
    if (!points) return [];
    return points
      .filter((p) => p.iso3 === iso3)
      .map((p) => ({ p, pop: cityValue(p, 'p', epoch), area: cityValue(p, 'a', epoch) }))
      .filter((c): c is { p: PointRecord; pop: number; area: number | null } => c.pop !== null)
      .sort((a, b) => b.pop - a.pop);
  }, [points, iso3, epoch]);

  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!points) return <p className="empty">{t.loading}</p>;

  const base = epoch > EPOCHS[0] ? Math.max(EPOCHS[0], epoch - 10) : null;
  const total = list.reduce((s, c) => s + c.pop, 0);
  const shareIndex = shares ? shares.years.indexOf(epoch) : -1;
  const share = shareIndex >= 0 ? shares?.values[iso3]?.[shareIndex] : null;
  const million = list.filter((c) => c.pop >= 1e6).length;

  const name = (p: PointRecord) =>
    lang === 'zh' && typeof p.zh === 'string' ? p.zh : <span translate="no">{String(p.name ?? '')}</span>;
  const change = (p: PointRecord, pop: number) => {
    const b = growthBase(p, epoch);
    if (b !== null && b === base) return formatSignedPercent((pop / cityValue(p, 'p', b)! - 1) * 100, 0);
    const first = firstEpoch(p);
    return first !== null && first > EPOCHS[0] ? text.since(first) : '—';
  };
  const rows = (items: typeof list) =>
    items.map(({ p, pop, area }, i) => (
      <tr key={`${i}-${String(p.name)}`}>
        <th scope="row">{name(p)}</th>
        <td className="num">{formatLargeNumber(pop)}</td>
        <td className="num">{area ? fixed(pop / area, 0) : '—'}</td>
        {base !== null && <td className="num">{change(p, pop)}</td>}
      </tr>
    ));
  const head = (
    <thead>
      <tr>
        <th scope="col">{text.colCity}</th>
        <th scope="col" className="num">{text.colPop}</th>
        <th scope="col" className="num">{text.colDensity}</th>
        {base !== null && <th scope="col" className="num">{text.colChange(base)}</th>}
      </tr>
    </thead>
  );
  const rest = list.slice(SHOWN, MAX_LISTED);

  return (
    <>
      <section className="panel-section">
        <h3>{text.title(countryName, epoch)}</h3>
        {list.length === 0 ? (
          <p className="empty">{text.none(epoch)}</p>
        ) : (
          <>
            <p className="panel-year-note">
              {text.summary(epoch, list.length, formatLargeNumber(total), typeof share === 'number' ? formatPercent(share, 1) : null, million)}
            </p>
            <table className="mini-table" aria-label={text.caption(countryName, epoch)}>
              {head}
              <tbody>{rows(list.slice(0, SHOWN))}</tbody>
            </table>
            {rest.length > 0 && (
              <details>
                <summary className="note">{text.more(rest.length, list.length - SHOWN)}</summary>
                <table className="mini-table" aria-label={text.caption(countryName, epoch)}>
                  {head}
                  <tbody>{rows(rest)}</tbody>
                </table>
              </details>
            )}
          </>
        )}
        <p className="note">{text.method}</p>
      </section>
      {iso3 === 'TWN' && taiwan && taiwan.rows.length > 0 && (
        <section className="panel-section">
          <h3>{text.taiwanTitle}</h3>
          <p className="note">{text.taiwan(taiwan, taiwan.rows[0])}</p>
          <table className="mini-table" aria-label={text.taiwanTitle}>
            <thead>
              <tr>
                <th scope="col">{text.colUcdb(taiwan.year)}</th>
                <th scope="col">{text.colCounties}</th>
                <th scope="col" className="num">{text.colMoi}</th>
              </tr>
            </thead>
            <tbody>
              {taiwan.rows.map((r) => (
                <tr key={r.name}>
                  <th scope="row">
                    {lang === 'zh' && r.zh ? r.zh : <span translate="no">{r.name}</span>} {formatLargeNumber(r.pop)}
                  </th>
                  <td>{(lang === 'zh' ? r.counties : r.countiesEn).join(text.listSeparator)}</td>
                  <td className="num">{formatLargeNumber(r.moi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.taiwanSource}</p>
        </section>
      )}
    </>
  );
}
