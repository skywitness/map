import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 環境噪音的側欄（2026-11-07，第二十五批 485）：這一國應報、實報的都會區數（道路），與各都會區的道路噪音
 * Lden ≥ 55 dB 比例排名。資料是 pipeline/topics/noise.py 輸出的 aggl.json（cities：[名稱, 人口, %]，依 % 由高到低）
 */
interface AgglFile {
  year: number;
  coverage: Record<string, [number, number]>;
  cities: Record<string, [string, number, number][]>;
}

const SHOWN = 12;

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `${y} 年各都會區的道路噪音`,
    coverage: (due: number, done: number) =>
      done === due ? `${due} 個都會區都有提報。` : done === 0 ? `應提報 ${due} 個都會區，這一輪沒有提報。` : `應提報 ${due} 個都會區，有資料的 ${done} 個。`,
    head: ['都會區', '人口', 'Lden ≥ 55 dB'],
    more: (n: number) => `另外還有 ${n} 個都會區。`,
    none: '這個國家沒有都會區的噪音資料。',
  },
  en: {
    title: (y: number) => `Road noise by agglomeration, ${y}`,
    coverage: (due: number, done: number) =>
      done === due ? `All ${due} agglomerations reported.` : done === 0 ? `${due} agglomerations were due; none reported in this round.` : `${done} of ${due} agglomerations due have data.`,
    head: ['Agglomeration', 'Population', 'Lden ≥ 55 dB'],
    more: (n: number) => `${n} more agglomerations not shown.`,
    none: 'No agglomeration noise data for this country.',
  },
});

export default function NoisePanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data } = useJson<AgglFile>(`topics/${topic.id}/aggl.json`);
  if (!data) return <p className="empty">{t.loading}</p>;
  const cov = data.coverage[iso3];
  const list = data.cities[iso3] ?? [];
  if (!cov && !list.length) return <p className="empty">{text.none}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title(data.year)}</h3>
      {cov && <p className="note">{text.coverage(cov[0], cov[1])}</p>}
      {list.length > 0 && (
        <table className="mini-table">
          <thead>
            <tr>
              {text.head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.slice(0, SHOWN).map(([name, pop, share]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{formatLargeNumber(pop)}</td>
                <td>{fixed(share, 1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {list.length > SHOWN && <p className="note">{text.more(list.length - SHOWN)}</p>}
    </section>
  );
}
