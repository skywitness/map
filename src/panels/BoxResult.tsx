import { zhName, type CountryTable } from '../lib/countries';
import { fixed, formatLargeNumber, formatPercent } from '../lib/format';

export interface BoxContribution {
  iso3: string;
  /** 該國面積落在框內的比例 */
  share: number;
  /** 估算落在框內的數量 */
  value: number;
}

interface BoxResultProps {
  label: string;
  unit: string;
  year: number;
  total: number | null;
  landKm2: number;
  contributions: BoxContribution[];
  countries: CountryTable | null;
  onClear: () => void;
}

const TOP_N = 5;

export function BoxResult({ label, unit, year, total, landKm2, contributions, countries, onClear }: BoxResultProps) {
  const top = contributions.slice(0, TOP_N);
  const rest = contributions.slice(TOP_N);
  const restValue = rest.reduce((sum, c) => sum + c.value, 0);

  return (
    <section className="box-result" aria-label={`框選範圍內的${label}`} aria-live="polite">
      <header>
        <span className="box-result-title">框選範圍內{label}（估算）</span>
        <button type="button" className="icon-button small" onClick={onClear} aria-label="清除框選">
          ×
        </button>
      </header>
      {total === null ? (
        <p className="box-result-value">載入中…</p>
      ) : contributions.length === 0 ? (
        <p className="box-result-empty">框內沒有陸地或沒有資料</p>
      ) : (
        <>
          <p className="box-result-value">
            {formatLargeNumber(total)} {unit}
          </p>
          <p className="box-result-meta">
            {year} 年 · 陸地面積 {formatArea(landKm2)} · 平均每 km² {fixed(total / landKm2, 0)} {unit}
          </p>
          <ul className="box-result-list">
            {top.map((c) => (
              <li key={c.iso3}>
                <span className="name">{zhName(c.iso3, countries)}</span>
                <span className="value">{formatLargeNumber(c.value)}</span>
                <span className="share">占該國面積 {formatShare(c.share)}</span>
              </li>
            ))}
            {rest.length > 0 && (
              <li>
                <span className="name">其他 {rest.length} 國</span>
                <span className="value">{formatLargeNumber(restValue)}</span>
                <span className="share" />
              </li>
            )}
          </ul>
        </>
      )}
      <p className="box-result-note">
        以各國平均{label}密度乘上框內面積估算，假設{label}在國內平均分布；框越小、國土越大，誤差越大。
      </p>
    </section>
  );
}

function formatShare(share: number): string {
  const pct = share * 100;
  if (pct < 0.1) return '不到 0.1%';
  return formatPercent(pct, pct < 10 ? 1 : 0);
}

function formatArea(km2: number): string {
  if (km2 >= 1e4) return `${fixed(km2 / 1e4, km2 >= 1e6 ? 0 : 1)} 萬 km²`;
  return `${fixed(km2, 0)} km²`;
}
