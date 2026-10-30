import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { decodePoints } from '../../map/overlayData';
import type { Tokens } from '../../theme/tokens';
import { siteFacts, siteName } from '../co2-stations';
import type { PanelExtraProps, PointRecord, PointsData } from '../types';

/** series.json：站碼 → 第一個月與之後每個月的月平均（缺的月份是 null） */
type Series = Record<string, { first: [number, number]; v: (number | null)[] }>;

const TEXT = defineMessages({
  zh: {
    title: (country: string) => `${country}的觀測站`,
    none: 'NOAA 合作採樣網在這裡沒有固定的觀測站。',
    mean: (year: number, v: string) => `${year} 年平均 ${v}`,
    noMean: (year: number) => `${year} 年沒有完整的年平均`,
    aria: (name: string) => `${name}的二氧化碳月平均濃度`,
    note: '曲線是每週瓶採樣的月平均（ppm），一年一次的起伏是季節：北半球春天植物還沒長葉時最高、夏秋光合作用旺盛時最低。',
  },
  en: {
    title: (country) => `Stations in ${country}`,
    none: 'The NOAA cooperative network has no fixed station here.',
    mean: (year, v) => `${year} mean ${v}`,
    noMean: (year) => `No full annual mean for ${year}`,
    aria: (name) => `Monthly mean CO₂ at ${name}`,
    note: 'Curves are monthly means of weekly flask samples (ppm). The yearly wiggle is the seasons: highest in northern spring before leaves come out, lowest in summer and autumn when photosynthesis peaks.',
  },
});

const ppm = (v: number) => `${fixed(v, 1)} ppm`;

function curve(s: Series[string], year: number, tokens: Tokens, name: string): ChartSpec {
  const [y0, m0] = s.first;
  const xs = s.v.map((_v, i) => y0 + (m0 - 1 + i + 0.5) / 12);
  const first = Math.floor(xs[0]);
  const last = Math.ceil(xs[xs.length - 1]);
  const span = last - first;
  const step = span > 40 ? 10 : span > 15 ? 5 : span > 6 ? 2 : 1;
  const ticks = [];
  for (let y = Math.ceil(first / step) * step; y <= last; y += step) ticks.push(y);
  return {
    x: { type: 'value', min: first, max: last, ticks },
    y: { format: (v) => fixed(v, 0), zero: false },
    series: [{ type: 'line', name, values: s.v, xs, color: tokens.accent, width: 1.5, legend: false }],
    refs: year >= first && year < last ? [{ x: year + 0.5 }] : [],
    tooltip: (x) => {
      const i = xs.indexOf(x);
      const v = s.v[i];
      if (i < 0 || v == null) return null;
      const month = ((m0 - 1 + i) % 12) + 1;
      const yy = y0 + Math.floor((m0 - 1 + i) / 12);
      return { head: `${yy}/${month}`, rows: [{ color: tokens.accent, value: ppm(v), name }] };
    },
  };
}

export default function Co2StationsPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<PointsData>(`topics/${topic.id}/stations.json`);
  const { data: series, error: seriesError } = useJson<Series>(`topics/${topic.id}/series.json`);
  const rows = useMemo(
    () =>
      data
        ? decodePoints(data)
            .filter((p) => p.iso3 === iso3)
            // 還在採樣的在前，再依開始的年月
            .sort((a, b) => Number(b.l) - Number(a.l) || Number(a.f) - Number(b.f))
        : null,
    [data, iso3],
  );
  const err = error ?? seriesError;
  if (err) return <p className="empty">{t.loadFailed(err.message)}</p>;
  if (!rows || !series) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title(countryName)}</h3>
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <ul className="plain-list">
          {rows.map((p: PointRecord) => {
            const name = siteName(p, lang);
            const s = series[String(p.code)];
            const v = p[`y${year}`];
            return (
              <li key={String(p.code)}>
                <span className="plain-title">{name}</span>
                {lang === 'zh' && typeof p.en === 'string' && (
                  <span className="plain-meta" translate="no">
                    {p.en}
                  </span>
                )}
                <span className="plain-meta">
                  {[typeof v === 'number' ? text.mean(year, ppm(v)) : text.noMean(year), siteFacts(p)].join(' · ')}
                </span>
                {s && <Chart spec={curve(s, year, tokens, name)} height={110} ariaLabel={text.aria(name)} />}
              </li>
            );
          })}
        </ul>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
