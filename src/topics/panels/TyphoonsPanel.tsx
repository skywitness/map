import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { classColor, className, dateRange, windClass, windText } from '../typhoons';
import type { PanelExtraProps } from '../types';

/**
 * pipeline/topics/typhoons.py 輸出的 country-storms.json：每個國家 100 公里內最強、最近的颱風（各 10 個）。
 * 每一列是 [年份, 英文名稱, 中文名稱（中央氣象署）, 100 公里內的最大風速 kt, 最近距離 km（0 是中心進入國界）,
 * 第一次與最後一次在 100 公里內的日期 YYYYMMDD（UTC）, 巔峰風速 kt, 生成的海域]
 */
type Row = [number, string | null, string | null, number, number, number, number, number | null, string];
interface CountryStorms {
  fields: string[];
  countries: Record<string, { n: number; from: number; strongest: Row[]; recent: Row[] }>;
}

const n0 = (v: number) => fixed(v, 0);

const TEXT = defineMessages({
  zh: {
    strongest: '最強的颱風',
    recent: '最近的颱風',
    count: (n: number, from: number) => `${from} 年起 ${n0(n)} 個颱風經過（中心進入國界或離國界 100 公里以內，達熱帶風暴以上）`,
    none: (from: number) => `${from} 年起沒有達熱帶風暴以上的颱風在 100 公里以內經過。`,
    unnamed: '未命名',
    near: (wind: string) => `經過時 ${wind}`,
    crossed: '中心經過陸地',
    closest: (km: number) => `最近 ${n0(km)} 公里`,
    peak: (cls: string, wind: string) => `巔峰 ${cls}，${wind}`,
    note: '強度是美國機構的 1 分鐘平均風速（薩菲爾－辛普森颶風等級），經過時的風速沿路徑內插、取到 5 節；日期是世界標準時間（UTC）。中央氣象署用 10 分鐘平均風速，數字比較小。1950–60 年代的強度一般認為偏高。中文名稱來自中央氣象署颱風資料庫（1958 年起的西北太平洋颱風）。',
  },
  en: {
    strongest: 'Strongest storms',
    recent: 'Most recent storms',
    count: (n, from) =>
      `${n0(n)} ${n === 1 ? 'storm' : 'storms'} since ${from} (centre crossing the country or within 100 km of it, at tropical-storm strength or above)`,
    none: (from) => `No storm of tropical-storm strength or above has passed within 100 km since ${from}.`,
    unnamed: 'Unnamed',
    near: (wind) => `${wind} near the country`,
    crossed: 'centre crossed land',
    closest: (km) => `closest ${n0(km)} km`,
    peak: (cls, wind) => `peak ${cls}, ${wind}`,
    note: 'Intensity uses US 1-minute winds (Saffir–Simpson scale); winds near the country are interpolated along the track and rounded to 5 kt. Intensities from the 1950s and 1960s are generally thought to be too high. Dates are UTC.',
  },
});

function StormList({ rows, lang }: { rows: Row[]; lang: 'zh' | 'en' }) {
  const text = TEXT[lang];
  return (
    <ul className="plain-list">
      {rows.map(([year, name, zh, wind, km, date0, date1, peak], i) => {
        const cls = windClass(wind);
        const md0 = date0 % 10000;
        const md1 = date1 % 10000;
        const local = lang === 'zh' ? zh : null;
        return (
          <li key={`${year}-${name}-${i}`}>
            <span className="plain-title">
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  marginRight: 6,
                  borderRadius: 2,
                  background: classColor(cls),
                }}
              />
              <span className="iata">{className(cls)}</span>
              {local && `${local} `}
              {name ? <span translate="no">{name}</span> : !local && text.unnamed}
              {` · ${year}`}
            </span>
            <span className="plain-meta">
              {[text.near(windText(wind)), km === 0 ? text.crossed : text.closest(km), `${dateRange(md0, md1)} UTC`].join(' · ')}
            </span>
            {peak !== null && peak > wind && (
              <span className="plain-meta">{text.peak(className(windClass(peak)), windText(peak))}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function TyphoonsPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<CountryStorms>(`topics/${topic.id}/country-storms.json`);
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  const own = data.countries[iso3];

  return (
    <section className="panel-section">
      <h3>{text.strongest}</h3>
      {own ? (
        <>
          <p className="panel-year-note">{text.count(own.n, own.from)}</p>
          <StormList rows={own.strongest} lang={lang} />
          <h3>{text.recent}</h3>
          <StormList rows={own.recent} lang={lang} />
        </>
      ) : (
        <p className="empty">{text.none(1950)}</p>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
