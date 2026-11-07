import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { countryName, type CountryTable } from '../../lib/countries';
import { fixed } from '../../lib/format';
import { directionOf, OROGENS } from '../plates';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/plates_past.py 輸出的 neighbours.json（2026-11-07，製作手冊 543）：[時間（負的百萬年）, [[國家, 公里], …]] */
interface Neighbours {
  times: number[];
  countries: Record<string, [number, [string, number][]][]>;
}

/** 不是在古緯度的時間軸上時，側欄列這幾個年代的鄰居 */
const HIGHLIGHT_TIMES = [-250, -200, -150, -100, -50];

/** pipeline/topics/plates_today.py 輸出的 plate-shares.json（2026-11-07，製作手冊 542） */
interface PlateShares {
  names: Record<string, [string, string]>;
  /** plates：[板塊, 占國土 %, 那部分的速度（公分／年，NNR-MORVEL56）, 方位角] */
  countries: Record<string, { plates: [string, number, number, number][]; orogens: [string, number][] }>;
}

const TEXT = defineMessages({
  zh: {
    then: '那時的鄰居',
    thenNote: '那時在 300 公里內、今天相隔 1,000 公里以上的國家（今天就相鄰的不算）。國界是今天的，那時沒有這些國家。',
    noThen: '這個年代沒有今天相隔很遠、那時卻很近的國家。',
    noThenAny: '250 百萬年來沒有今天相隔很遠、那時卻很近的國家。',
    ago: (ma: number) => (ma >= 100 ? `${fixed(ma / 100, ma % 100 ? 1 : 0)} 億年前` : `${fixed(ma * 100, 0)} 萬年前`),
    km: (km: number) => (km < 10 ? '相連' : `${fixed(km, 0)} 公里`),
    sep: '、',
    item: (name: string, d: string) => `${name}（${d}）`,
    plates: '國土在哪些板塊上',
    orogens: '國土在哪些造山帶裡',
    noOrogens: '不在 PB2002 的造山帶裡。',
    noData: '沒有這一國的國土資料。',
    share: (v: number) => `${fixed(v, 1)}%`,
    motion: (speed: number, dir: string) => `每年 ${fixed(speed, 1)} 公分往${dir}`,
    note: '面積比例，依 PB2002（Bird 2003）的板塊與造山帶，國土是 Natural Earth 1:50m 的國界；速度是 NNR-MORVEL56（Argus 等 2011）。',
  },
  en: {
    then: 'Neighbours then',
    thenNote: 'Countries within 300 km at the time that are over 1,000 km away today (today’s neighbours are left out). Borders are today’s; these countries did not exist then.',
    noThen: 'No country that is far away today was close at this time.',
    noThenAny: 'No country that is far away today was close in the last 250 million years.',
    ago: (ma) => `${fixed(ma, 0)} million years ago`,
    km: (km) => (km < 10 ? 'joined' : `${fixed(km, 0)} km`),
    sep: ', ',
    item: (name, d) => `${name} (${d})`,
    plates: 'Plates under the country',
    orogens: 'Orogens',
    noOrogens: 'Not in any PB2002 orogen.',
    noData: 'No land data for this country.',
    share: (v) => `${fixed(v, 1)}%`,
    motion: (speed, dir) => `${fixed(speed, 1)} cm a year towards the ${dir}`,
    note: 'Shares of land area, from the PB2002 plates and orogens (Bird 2003); borders are Natural Earth 1:50m; speeds are NNR-MORVEL56 (Argus et al. 2011).',
  },
});

export default function PlatesPanel({ topic, iso3, indicator, year }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<PlateShares>(`topics/${topic.id}/plate-shares.json`);
  const { data: nb, error: nbError } = useJson<Neighbours>(`topics/${topic.id}/neighbours.json`);
  const countries = useJson<CountryTable>('countries.json').data;
  const countryLabel = (code: string) => countryName(code, countries, lang);
  const err = error ?? nbError;
  if (err) return <p className="empty">{t.loadFailed(err.message)}</p>;
  if (!data || !nb) return <p className="empty">{t.loading}</p>;
  const rows = nb.countries[iso3] ?? [];
  // 古緯度的時間軸上：那一年的鄰居；其他指標：幾個整數年代
  const onTimeline = indicator.id === 'paleolat' && year < 0;
  const shown = onTimeline ? rows.filter(([time]) => time === year) : rows.filter(([time]) => HIGHLIGHT_TIMES.includes(time));
  const neighbours = (
    <>
      <h3>{text.then}</h3>
      {shown.length > 0 ? (
        <ul className="plain-list">
          {shown.map(([time, list]) => (
            <li key={time}>
              <span className="plain-title">{text.ago(-time)}</span>
              <span className="plain-meta">{list.map(([code, km]) => text.item(countryLabel(code), text.km(km))).join(text.sep)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">{onTimeline ? text.noThen : text.noThenAny}</p>
      )}
      <p className="note">{text.thenNote}</p>
    </>
  );
  const row = data.countries[iso3];
  if (!row) return <section className="panel-section">{neighbours}</section>;
  const name = (code: string) => {
    const n = data.names[code];
    return n ? (lang === 'zh' ? n[0] : n[1]) : code;
  };
  const orogen = (key: string) => (OROGENS[key] ? OROGENS[key][lang] : key);
  return (
    <section className="panel-section">
      <h3>{text.plates}</h3>
      <ul className="plain-list">
        {row.plates.map(([code, share, speed, azimuth]) => (
          <li key={code}>
            <span className="plain-title">{name(code)}</span>
            <span className="plain-meta">
              {text.share(share)} · {text.motion(speed, directionOf(azimuth)[lang])}
            </span>
          </li>
        ))}
      </ul>
      <h3>{text.orogens}</h3>
      {row.orogens.length > 0 ? (
        <ul className="plain-list">
          {row.orogens.map(([key, share]) => (
            <li key={key}>
              <span className="plain-title">{orogen(key)}</span>
              <span className="plain-meta">{text.share(share)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">{text.noOrogens}</p>
      )}
      <p className="note">{text.note}</p>
      {neighbours}
    </section>
  );
}
