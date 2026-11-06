import { useEffect, useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { countryName } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import { preloadPlates } from '../plates-pb2002';
import type { WorldPanelProps } from '../types';

/**
 * 左側欄：各板塊的人口（2026-11-06，板5，參考 tectonicplatemap.org 的「Plates Ranked by Population」；
 * pipeline/topics/plates_pb2002.py 的 plates-population.json）：JRC GHS-POP 2020 年的 0.1° 網格依 PB2002 板塊分。
 */
interface PlatesPopulation {
  fields: string[];
  world: number;
  taiwan: [string, number][];
  /** [代碼, 中文名, 英文名, 大小（1 大、2 小、3 微）, 面積 km², 人口, [[國家, 人口], …]] */
  rows: [string, string, string, number, number, number, [string, number][]][];
}

const TEXT = defineMessages({
  zh: {
    intro: (world: string) =>
      `全世界 ${world} 人（JRC GHS-POP 2020 年的人口網格，每 0.1° 一格，依格子的中心點在哪一塊板塊算）。板塊的界線是 PB2002 模型的近似，國界附近、板塊邊界附近的城市可能算到隔壁那塊。`,
    taiwan: (parts: string) => `台灣：${parts}`,
    colPlate: '板塊',
    colPop: '人口',
    colDensity: '每 km²',
    caption: '各板塊的人口、占全世界的比例、人口密度與人口最多的國家',
    share: (pct: string) => `占 ${pct}%`,
    empty: (n: number) => `其他 ${n} 塊板塊幾乎沒有人住（不到 1 萬人，多半在海裡）。`,
    cls: { 1: '大板塊', 2: '小板塊', 3: '微板塊' } as Record<number, string>,
    people: (n: string) => `${n} 人`,
    sep: '、',
    note: '面積用球面算（52 塊加起來正好是地球的表面積）；大小依面積分：2,000 萬 km² 以上是大板塊、100 萬 km² 以上是小板塊，其他是微板塊。',
  },
  en: {
    intro: (world) =>
      `${world} people worldwide (the JRC GHS-POP 2020 population grid at 0.1°, each cell counted on the plate under its centre). Plate boundaries are PB2002 approximations, so cities near a border or boundary may land on the neighbouring plate.`,
    taiwan: (parts) => `Taiwan: ${parts}`,
    colPlate: 'Plate',
    colPop: 'Population',
    colDensity: 'per km²',
    caption: 'Population of each plate, share of the world, density and the most populous countries',
    share: (pct) => `${pct}% of the world`,
    empty: (n) => `The other ${n} plates have hardly anyone (under 10,000 people, mostly under the sea).`,
    cls: { 1: 'major plate', 2: 'minor plate', 3: 'microplate' },
    people: (n) => n,
    sep: ', ',
    note: 'Areas are spherical (the 52 add up to exactly the Earth’s surface); size classes are by area: over 20 million km² is major, over 1 million km² minor, the rest microplates.',
  },
});

export default function PlatesWorld(_props: WorldPanelProps) {
  const t = useT();
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<PlatesPopulation>('topics/earthquakes/plates-population.json');
  // 游標滑過時寫在哪一塊板塊（plates-pb2002.ts 的 pointer）要的兩個檔先讀好
  useEffect(preloadPlates, []);
  const view = useMemo(() => {
    if (!data) return null;
    const name = (code: string) => {
      const row = data.rows.find((r) => r[0] === code);
      return row ? (lang === 'en' ? row[2] : row[1]) : code;
    };
    const shown = data.rows.filter((r) => r[5] >= 10_000);
    return {
      intro: text.intro(formatLargeNumber(data.world)),
      taiwan: data.taiwan.length
        ? text.taiwan(data.taiwan.map(([code, n]) => `${name(code)} ${text.people(formatLargeNumber(n))}`).join(text.sep))
        : null,
      rows: shown.map((r, i) => ({
        rank: i + 1,
        code: r[0],
        name: lang === 'en' ? r[2] : r[1],
        cls: text.cls[r[3]],
        pop: formatLargeNumber(r[5]),
        share: fixed((r[5] / data.world) * 100, r[5] / data.world >= 0.01 ? 0 : 1),
        density: fixed(r[5] / r[4], r[5] / r[4] >= 10 ? 0 : 1),
        countries: r[6]
          .slice(0, 3)
          .map(([iso3]) => countryName(iso3, null, lang))
          .join(text.sep),
      })),
      rest: data.rows.length - shown.length,
    };
  }, [data, lang, text]);

  if (!view) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <p className="note">{view.intro}</p>
      {view.taiwan && <p className="note">{view.taiwan}</p>}
      <table className="mini-table" aria-label={text.caption}>
        <thead>
          <tr>
            <th scope="col">{text.colPlate}</th>
            <th scope="col" className="num">
              {text.colPop}
            </th>
            <th scope="col" className="num">
              {text.colDensity}
            </th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((r) => (
            <tr key={r.code}>
              <th scope="row">
                {r.rank}. {r.name}
                <span className="mini-table-sub">
                  {r.cls}
                  {r.countries ? ` · ${r.countries}` : ''}
                </span>
              </th>
              <td className="num">
                {r.pop}
                <span className="mini-table-sub">{text.share(r.share)}</span>
              </td>
              <td className="num">{r.density}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {view.rest > 0 && <p className="note">{text.empty(view.rest)}</p>}
      <p className="note">{text.note}</p>
    </section>
  );
}
