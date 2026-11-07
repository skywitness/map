import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 森林主題（森林覆蓋率、年變化率）的側欄（2026-11-07，第二十五批 498）：只有台灣，因崩塌或風災減少的森林面積
 * （2010–2021，8 種林型合計）與最新一年的森林被害（火災、竊取、濫墾、其他）。資料是 pipeline/topics/forest_tw_loss.py
 * 輸出的 water-forest/tw-forest-loss.json（森林覆蓋的資料夾）
 */
interface TwForestLoss {
  landslide: { types: string[]; years: Record<string, (number | null)[]> };
  damage: { year: number; total: { count: number; ha: number; value: number }; causes: [string, number, number][] };
}

const TEXT = defineMessages({
  zh: {
    title: '台灣的森林因為什麼減少',
    landslide: '因崩塌或風災減少的森林覆蓋（公頃）',
    head: ['年', '面積', '其中天然闊葉林'],
    damage: (y: number) => `${y} 年的森林被害`,
    damageHead: ['原因', '件數', '面積（公頃）'],
    causes: ['火災', '竊取林木與副產物', '濫墾', '其他'],
    total: (n: number, ha: string, v: string) => `合計 ${n} 件、${ha} 公頃，損失價值約 ${v} 元。`,
    note: '崩塌與風災是農業部 2010–2021 年的統計；森林被害是林保署依各機關災害發生後 30 日內填報的彙編，火災件數跟林業統計年報的森林火災口徑不同。',
  },
  en: {
    title: 'Why Taiwan loses forest',
    landslide: 'Forest cover lost to landslides or wind (ha)',
    head: ['Year', 'Area', 'of which natural broadleaf'],
    damage: (y: number) => `Forest damage in ${y}`,
    damageHead: ['Cause', 'Cases', 'Area (ha)'],
    causes: ['Fire', 'Theft of timber and by-products', 'Illegal clearing', 'Other'],
    total: (n: number, ha: string, v: string) => `In all ${n} cases and ${ha} ha, with losses of about NT$${v}.`,
    note: 'Landslide and wind losses are Ministry of Agriculture statistics for 2010–2021; forest damage is compiled by the Forestry and Nature Conservation Agency from reports filed within 30 days, so fire counts differ from the forestry yearbook.',
  },
});
const SHOWN = ['2010', '2011', '2013', '2015', '2017', '2019', '2021'];

export default function ForestTwPanel({ iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<TwForestLoss>(iso3 === 'TWN' ? 'topics/water-forest/tw-forest-loss.json' : null);
  if (iso3 !== 'TWN' || !data) return null;
  const broad = data.landslide.types.indexOf('天然闊葉林'); // i18n-ignore（資料欄名）
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <p className="note">{text.landslide}</p>
      <table className="mini-table">
        <thead>
          <tr>
            {text.head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SHOWN.filter((y) => data.landslide.years[y]).map((y) => {
            const row = data.landslide.years[y];
            const sum = row.reduce<number>((a, v) => a + (v ?? 0), 0);
            return (
              <tr key={y}>
                <td>{y}</td>
                <td>{sum.toLocaleString('en-US')}</td>
                <td>{broad >= 0 && row[broad] != null ? row[broad]!.toLocaleString('en-US') : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="note">{text.damage(data.damage.year)}</p>
      <table className="mini-table">
        <thead>
          <tr>
            {text.damageHead.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* 原因的順序固定：火災、竊取主副產物、濫墾、其他（pipeline 的 CAUSES） */}
          {data.damage.causes.map(([cause, n, ha], i) => (
            <tr key={cause}>
              <td>{text.causes[i] ?? cause}</td>
              <td>{n}</td>
              <td>{fixed(ha, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{text.total(data.damage.total.count, fixed(data.damage.total.ha, 2), formatLargeNumber(data.damage.total.value))}</p>
      <p className="note">{text.note}</p>
    </section>
  );
}
