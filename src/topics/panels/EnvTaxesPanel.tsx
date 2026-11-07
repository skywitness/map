import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 環境稅收與環保支出的側欄（2026-11-07，第二十五批 501）：這一國的全國環境保護支出依用途分（Eurostat，百萬歐元，
 * 8 個不重疊的用途）。資料是 pipeline/topics/env_taxes.py 輸出的 expenditure-detail.json；只有歐洲國家，其他國家不畫
 */
interface Detail {
  items: string[];
  countries: Record<string, Record<string, (number | null)[]>>;
}

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `${y} 年的環境保護支出用在哪裡`,
    labels: ['空氣與氣候', '污水', '廢棄物', '土壤與水', '生物多樣性與景觀', '噪音與輻射', '研發', '跨領域與其他'],
    value: (v: string, p: string) => `${v} 歐元（${p}）`,
    note: 'Eurostat 的全國環境保護支出，含政府、企業與家戶。',
  },
  en: {
    title: (y: number) => `Where environmental protection spending went, ${y}`,
    labels: ['Air and climate', 'Wastewater', 'Waste', 'Soil and water', 'Biodiversity and landscape', 'Noise and radiation', 'R&D', 'Cross-cutting and other'],
    value: (v: string, p: string) => `€${v} (${p})`,
    note: 'Eurostat national expenditure on environmental protection, including government, businesses and households.',
  },
});

export default function EnvTaxesPanel({ topic, iso3, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<Detail>(`topics/${topic.id}/expenditure-detail.json`);
  const own = data?.countries[iso3];
  if (!own) return null;
  const years = Object.keys(own).map(Number).sort((a, b) => a - b);
  const y = [...years].reverse().find((v) => year == null || v <= year) ?? years[0];
  const row = own[String(y)];
  const total = row.reduce<number>((a, v) => a + (v ?? 0), 0);
  const order = row.map((v, i) => ({ v: v ?? 0, i })).sort((a, b) => b.v - a.v);
  return (
    <section className="panel-section">
      <h3>{text.title(y)}</h3>
      <ul className="bar-list">
        {order.map(({ v, i }) => {
          const share = total > 0 ? (v / total) * 100 : 0;
          return (
            <li key={i}>
              <span className="bar-label">{text.labels[i]}</span>
              <span className="bar-value">{text.value(formatLargeNumber(v * 1e6), fixed(share, 1) + '%')}</span>
              <span className="bar-track" aria-hidden="true">
                <span className="bar-fill" style={{ width: `${share}%`, background: tokens.hues.aqua }} />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="note">{text.note}</p>
    </section>
  );
}
