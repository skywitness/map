import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatPercent, formatSignedPercent } from '../../lib/format';
import type { IndicatorData, PanelExtraProps } from '../types';

/** countries/<ISO3>.json（pipeline/topics/night_lights.py 的 write_regions） */
interface CountryFile {
  /** [基準年, 最後一年] */
  years: [number, number];
  /** 燈光最多的第一級行政區，依最後一年由大到小；light、first 是 MW/sr，share 是占全國燈光的 % */
  regions: { zh: string; en: string; light: number; first: number; share: number | null }[];
}

const MW = (v: number) => `${fixed(v, v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : 3)} MW/sr`;
const change = (now: number, before: number) => (before > 0 ? formatSignedPercent((now / before - 1) * 100, 0) : '—');

const TEXT = defineMessages({
  zh: {
    trend: (first: number, last: number, country: string, world: string) =>
      `燈光總量 ${first} 到 ${last} 年的變化：${country}（世界 ${world}）`,
    title: (year: number) => `燈光最多的地區（${year} 年）`,
    caption: (country: string, year: number) => `${country}燈光最多的第一級行政區：${year} 年的燈光總量、占全國比例與變化`,
    colRegion: '地區',
    colLight: '燈光',
    colShare: '占全國',
    colChange: (first: number) => `比 ${first} 年`,
    method:
      '地區是 Natural Earth 的第一級行政區（縣市、省、州），名稱也取自它；只算地圖國界內的部分，海上的燈光不算。',
    none: '這個國家只有一個地區，或燈光太少，沒有列出地區。',
  },
  en: {
    trend: (first, last, country, world) => `Change in total light, ${first}–${last}: ${country} (world ${world})`,
    title: (year) => `Regions with the most light (${year})`,
    caption: (country, year) => `First-level regions of ${country} with the most light: total light in ${year}, share of the country and change`,
    colRegion: 'Region',
    colLight: 'Light',
    colShare: 'Share',
    colChange: (first) => `vs ${first}`,
    method:
      'Regions are Natural Earth first-level administrative divisions (counties, provinces, states), which also supply the names; only the part within the map’s country border counts, and light at sea is left out.',
    none: 'This country has only one region, or too little light, so no regions are listed.',
  },
});

export default function NightLightsPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  // 只有一個地區或燈光太少的國家沒有這個檔：404 時寫「沒有列出地區」
  const { data, error, loading } = useJson<CountryFile>(`topics/${topic.id}/countries/${iso3}.json`);
  const changes = useJson<IndicatorData>(`topics/${topic.id}/change.json`).data;

  const series = changes?.values[iso3];
  const world = changes?.aggregates?.WLD;
  const last = changes ? changes.years.length - 1 : -1;
  // change.json 的第一年是基準年的下一年
  const trend =
    changes && series && series[last] != null && world && world[last] != null
      ? text.trend(changes.years[0] - 1, changes.years[last], formatSignedPercent(series[last]!, 0), formatSignedPercent(world[last]!, 0))
      : null;

  if (loading) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      {trend && <p className="panel-year-note">{trend}</p>}
      {data && !error ? (
        <>
          <h3>{text.title(data.years[1])}</h3>
          <table className="mini-table" aria-label={text.caption(countryName, data.years[1])}>
            <thead>
              <tr>
                <th scope="col">{text.colRegion}</th>
                <th scope="col" className="num">{text.colLight}</th>
                <th scope="col" className="num">{text.colShare}</th>
                <th scope="col" className="num">{text.colChange(data.years[0])}</th>
              </tr>
            </thead>
            <tbody>
              {data.regions.map((r, i) => (
                <tr key={`${i}-${r.en}`}>
                  <th scope="row" translate="no">
                    {lang === 'zh' ? r.zh : r.en}
                  </th>
                  <td className="num">{MW(r.light)}</td>
                  <td className="num">{r.share === null ? '—' : formatPercent(r.share, r.share < 10 ? 1 : 0)}</td>
                  <td className="num">{change(r.light, r.first)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.method}</p>
        </>
      ) : (
        <p className="note">{text.none}</p>
      )}
    </section>
  );
}
