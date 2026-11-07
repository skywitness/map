import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import { decodePoints } from '../../map/overlayData';
import { elevation, lastEruption, magnitude, quakeDate, volcanoRock, volcanoType } from '../earthquakes';
import type { PanelExtraProps, PointRecord, PointsData } from '../types';

/** pipeline/topics/earthquakes.py 輸出的 deadliest.json：每個國家死亡最多的 10 次地震（NOAA，所有規模） */
interface Deadliest {
  fields: ['year', 'md', 'mag', 'deaths', 'place'];
  countries: Record<string, [number, number, number | null, number, string][]>;
}

/** volcano_extra.py 輸出的 volcano-deadliest.json：每個國家死亡最多的 8 次火山噴發（NOAA，2026-11-07 製作手冊 539） */
interface DeadliestEruptions {
  fields: ['year', 'volcano', 'vei', 'deaths', 'agent'];
  countries: Record<string, [number, string, number | null, number, string | null][]>;
}

/** quake_extra.py 輸出的 quake-costliest.json：每個國家損失最大的 8 次地震（NOAA，2026-11-07 製作手冊 540） */
interface Costliest {
  fields: ['year', 'md', 'mag', 'damage', 'houses', 'place'];
  countries: Record<string, [number, number, number | null, number, number | null, string][]>;
}

/** NOAA 的死因代碼（agent），沒列的照原文 */
const AGENTS: Record<string, { zh: string; en: string }> = {
  A: { zh: '岩屑崩落', en: 'debris avalanche' },
  E: { zh: '雷擊', en: 'lightning' },
  F: { zh: '洪水', en: 'floods' },
  G: { zh: '火山氣體', en: 'gas' },
  I: { zh: '饑荒與疾病', en: 'famine and disease' },
  L: { zh: '熔岩流', en: 'lava flows' },
  M: { zh: '泥流', en: 'lahars' },
  m: { zh: '二次泥流', en: 'secondary lahars' },
  P: { zh: '火山碎屑流', en: 'pyroclastic flows' },
  S: { zh: '地震', en: 'earthquakes' },
  T: { zh: '火山灰與火山彈', en: 'tephra' },
  W: { zh: '海嘯', en: 'tsunami' },
};

const LARGEST = 8;
const DEADLIEST = 8;
const VOLCANOES = 12;

const n0 = (v: number) => fixed(v, 0);

const TEXT = defineMessages({
  zh: {
    largest: '最大的地震',
    largestCount: (n: number) => `1900 年起規模 6 以上 ${n0(n)} 次（震央在國界內或離岸 50 公里以內）`,
    noQuakes: '1900 年起沒有規模 6 以上的地震在國界內或離岸 50 公里以內。',
    deadliest: '死亡最多的地震',
    noDeaths: 'NOAA 的重大地震資料庫沒有這個國家的地震死亡紀錄。',
    depth: (km: number) => `深度 ${n0(km)} 公里`,
    // 完整的數字：formatLargeNumber 的萬取整數，2010 年海地的 316,000 人會寫成「32 萬」
    deaths: (n: number) => `${n0(n)} 人死亡`,
    volcanoes: (n: number) => `全新世火山（${n} 座）`,
    noVolcanoes: '沒有全新世火山。',
    more: (n: number) => `還有 ${n} 座，地圖上都看得到。`,
    costliest: '損失最大的地震',
    damage: (millions: number) => `損失 ${formatLargeNumber(millions * 1e6)} 美元（當年）`,
    houses: (n: number) => `全毀 ${n0(n)} 棟`,
    eruptions: '死亡最多的火山噴發',
    noEruptions: 'NOAA 的重大火山噴發資料庫沒有這個國家的死亡紀錄。',
    year: (y: number) => (y < 0 ? `西元前 ${-y} 年` : `${y} 年`),
    causes: (list: string) => `死因：${list}`,
    listSep: '、',
    note: '日期是世界標準時間（UTC）。地名是 USGS、NOAA 與 Smithsonian 全球火山計畫的英文原名；死亡人數是 NOAA 的紀錄，地震含引發的海嘯與山崩，火山噴發含海嘯、泥流與事後的饑荒，古代的人數是推估。',
  },
  en: {
    largest: 'Largest earthquakes',
    largestCount: (n) => `${n0(n)} M6+ ${n === 1 ? 'earthquake' : 'earthquakes'} since 1900 (epicentre on land or within 50 km of the coast)`,
    noQuakes: 'No M6+ earthquakes since 1900 on land or within 50 km of the coast.',
    deadliest: 'Deadliest earthquakes',
    noDeaths: 'The NOAA Significant Earthquake Database records no earthquake deaths in this country.',
    depth: (km) => `Depth ${n0(km)} km`,
    deaths: (n) => `${n0(n)} ${n === 1 ? 'death' : 'deaths'}`,
    volcanoes: (n) => `Holocene volcanoes (${n})`,
    noVolcanoes: 'No Holocene volcanoes.',
    more: (n) => `${n} more, all shown on the map.`,
    costliest: 'Costliest earthquakes',
    damage: (millions) => `US$${formatLargeNumber(millions * 1e6)} in damage (current)`,
    houses: (n) => `${n0(n)} houses destroyed`,
    eruptions: 'Deadliest volcanic eruptions',
    noEruptions: 'The NOAA Significant Volcanic Eruptions Database records no deaths in this country.',
    year: (y) => (y < 0 ? `${-y} BCE` : String(y)),
    causes: (list) => `Causes: ${list}`,
    listSep: ', ',
    note: 'Dates are UTC. Place names are the original English names from USGS, NOAA and the Smithsonian Global Volcanism Program; deaths are NOAA records: for earthquakes they include tsunamis and landslides the quake set off, for eruptions tsunamis, lahars and later famine, and ancient tolls are estimates.',
  },
});

/** 有 iso3 欄位的點檔，依國家篩選（解碼一次，選別的國家時重用） */
function useCountryPoints(path: string, iso3: string): { points: PointRecord[] | null; error: Error | null } {
  const { data, error } = useJson<PointsData>(path);
  const decoded = useMemo(() => (data ? decodePoints(data) : null), [data]);
  const points = useMemo(() => decoded?.filter((p) => p.iso3 === iso3) ?? null, [decoded, iso3]);
  return { points, error };
}

export default function EarthquakesPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const base = `topics/${topic.id}`;
  const quakes = useCountryPoints(`${base}/quakes.json`, iso3);
  const volcanoes = useCountryPoints(`${base}/volcanoes.json`, iso3);
  const { data: deadly, error: deadlyError } = useJson<Deadliest>(`${base}/deadliest.json`);
  const { data: eruptionData, error: eruptionError } = useJson<DeadliestEruptions>(`${base}/volcano-deadliest.json`);
  const { data: costData, error: costError } = useJson<Costliest>(`${base}/quake-costliest.json`);

  const largest = useMemo(
    () =>
      quakes.points
        ? [...quakes.points].sort((a, b) => (b.mag as number) - (a.mag as number)).slice(0, LARGEST)
        : null,
    [quakes.points],
  );
  // 最近噴發過的排前面，年代不明的排最後
  const recentVolcanoes = useMemo(
    () =>
      volcanoes.points
        ? [...volcanoes.points].sort(
            (a, b) => ((b.last as number | null) ?? -Infinity) - ((a.last as number | null) ?? -Infinity),
          )
        : null,
    [volcanoes.points],
  );

  const error = quakes.error ?? volcanoes.error ?? deadlyError ?? eruptionError ?? costError;
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!largest || !recentVolcanoes || !deadly || !eruptionData || !costData) return <p className="empty">{t.loading}</p>;
  const costliest = costData.countries[iso3] ?? [];
  const deadliest = (deadly.countries[iso3] ?? []).slice(0, DEADLIEST);
  const deadlyEruptions = eruptionData.countries[iso3] ?? [];
  const causes = (agent: string | null) =>
    agent
      ? text.causes(
          [...new Set(agent.split(','))]
            .map((a) => (AGENTS[a] ? AGENTS[a][lang] : a))
            .join(text.listSep),
        )
      : null;

  return (
    <section className="panel-section">
      <h3>{text.largest}</h3>
      {quakes.points && quakes.points.length > 0 ? (
        <>
          <p className="panel-year-note">{text.largestCount(quakes.points.length)}</p>
          <ul className="plain-list">
            {largest.map((q, i) => (
              <li key={i}>
                <span className="plain-title">
                  <span className="iata">{magnitude(q.mag as number)}</span>
                  {quakeDate(q.year as number, q.md as number | null)}
                </span>
                <span className="plain-meta">
                  {[
                    typeof q.depth === 'number' ? text.depth(q.depth) : null,
                    typeof q.deaths === 'number' && q.deaths > 0 ? text.deaths(q.deaths) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {typeof q.place === 'string' && (
                  <span className="plain-meta" translate="no">
                    {q.place}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="empty">{text.noQuakes}</p>
      )}

      <h3>{text.deadliest}</h3>
      {deadliest.length > 0 ? (
        <ul className="plain-list">
          {deadliest.map(([year, md, mag, deaths, place], i) => (
            <li key={i}>
              <span className="plain-title">
                {mag !== null && <span className="iata">{magnitude(mag)}</span>}
                {quakeDate(year, md)}
              </span>
              <span className="plain-meta">{text.deaths(deaths)}</span>
              {place && (
                <span className="plain-meta" translate="no">
                  {place}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">{text.noDeaths}</p>
      )}

      {costliest.length > 0 && (
        <>
          <h3>{text.costliest}</h3>
          <ul className="plain-list">
            {costliest.map(([year, md, mag, damage, houses, place], i) => (
              <li key={i}>
                <span className="plain-title">
                  {mag !== null && <span className="iata">{magnitude(mag)}</span>}
                  {quakeDate(year, md)}
                </span>
                <span className="plain-meta">{[text.damage(damage), houses ? text.houses(houses) : null].filter(Boolean).join(' · ')}</span>
                {place && (
                  <span className="plain-meta" translate="no">
                    {place}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>{text.eruptions}</h3>
      {deadlyEruptions.length > 0 ? (
        <ul className="plain-list">
          {deadlyEruptions.map(([year, volcano, vei, deaths, agent], i) => (
            <li key={i}>
              <span className="plain-title">
                {vei !== null && <span className="iata">VEI {vei}</span>}
                {text.year(year)}
              </span>
              <span className="plain-meta">{[text.deaths(deaths), causes(agent)].filter(Boolean).join(' · ')}</span>
              {volcano && (
                <span className="plain-meta" translate="no">
                  {volcano}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">{text.noEruptions}</p>
      )}

      <h3>{text.volcanoes(recentVolcanoes.length)}</h3>
      {recentVolcanoes.length > 0 ? (
        <>
          <ul className="plain-list">
            {recentVolcanoes.slice(0, VOLCANOES).map((v) => (
              <li key={v.vn as number}>
                <span className="plain-title" translate="no">
                  {v.name}
                </span>
                <span className="plain-meta">
                  {[volcanoType(v.type), volcanoRock(v.rock), typeof v.elev === 'number' ? elevation(v.elev) : null, lastEruption(v.last)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          {recentVolcanoes.length > VOLCANOES && <p className="note">{text.more(recentVolcanoes.length - VOLCANOES)}</p>}
        </>
      ) : (
        <p className="empty">{text.noVolcanoes}</p>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
