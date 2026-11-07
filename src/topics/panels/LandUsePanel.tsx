import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 土地利用的側欄（2026-11-07，第二十五批 491）：這一國那一年的土地利用結構（可耕地、永久作物、牧地、森林、其他土地，
 * 長條是占這 5 類合計的比例）。資料是 pipeline/topics/land_use.py 輸出的 structure/{iso3}.json（千公頃）
 */
interface StructureFile {
  items: string[];
  years: Record<string, (number | null)[]>;
}

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `${y} 年的土地利用`,
    labels: ['可耕地', '永久作物', '永久草地與牧地', '森林', '其他土地'],
    value: (ha: string, p: string) => `${ha} 公頃（${p}）`,
    missing: '沒有資料',
    none: '這個國家沒有土地利用的資料。',
    note: '比例是占這 5 類合計（約等於國土，不含內陸水域）。',
  },
  en: {
    title: (y: number) => `Land use in ${y}`,
    labels: ['Arable land', 'Permanent crops', 'Permanent meadows and pastures', 'Forest', 'Other land'],
    value: (ha: string, p: string) => `${ha} ha (${p})`,
    missing: 'No data',
    none: 'No land use data for this country.',
    note: 'Shares are of the total of these five classes (roughly the land area, excluding inland water).',
  },
});
const COLORS = ['yellow', 'orange', 'aqua', 'green', 'violet'] as const;

export default function LandUsePanel({ topic, iso3, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<StructureFile>(`topics/${topic.id}/structure/${iso3}.json`);
  if (error) return <p className="empty">{text.none}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  const years = Object.keys(data.years).map(Number).sort((a, b) => a - b);
  if (!years.length) return <p className="empty">{text.none}</p>;
  const y = [...years].reverse().find((v) => year == null || v <= year) ?? years[0];
  const row = data.years[String(y)];
  const total = row.reduce<number>((a, v) => a + (v ?? 0), 0);
  return (
    <section className="panel-section">
      <h3>{text.title(y)}</h3>
      <ul className="bar-list">
        {row.map((v, i) => {
          const share = v != null && total > 0 ? (v / total) * 100 : 0;
          return (
            <li key={i}>
              <span className="bar-label">{text.labels[i]}</span>
              <span className="bar-value">{v == null ? text.missing : text.value(formatLargeNumber(v * 1000), fixed(share, 1) + '%')}</span>
              <span className="bar-track" aria-hidden="true">
                <span className="bar-fill" style={{ width: `${share}%`, background: tokens.hues[COLORS[i]] }} />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="note">{text.note}</p>
    </section>
  );
}
