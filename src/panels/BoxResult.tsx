import { zhName, type CountryTable } from '../lib/countries';
import { fixed, formatLargeNumber, formatPercent } from '../lib/format';

export interface BoxContribution {
  /** null 代表地圖上沒有國界的小島（1:50m 圖資沒有形狀） */
  iso3: string | null;
  /** 該國人口落在框內的比例（依網格人口算） */
  share: number | null;
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
  /** 網格人口的年份與網格大小（度），還沒載入時是 null */
  grid: { epoch: number; cellSize: number } | null;
  countries: CountryTable | null;
  onClear: () => void;
}

const TOP_N = 5;

export function BoxResult({ label, unit, year, total, landKm2, contributions, grid, countries, onClear }: BoxResultProps) {
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
        <p className="box-result-empty">框內沒有{label}資料（海洋或無人區）</p>
      ) : (
        <>
          <p className="box-result-value">
            {formatLargeNumber(total)} {unit}
          </p>
          <p className="box-result-meta">
            {year} 年 · 陸地面積 {formatArea(landKm2)}
            {landKm2 > 0 && ` · 平均每 km² ${formatDensity(total / landKm2)} ${unit}`}
          </p>
          <ul className="box-result-list">
            {top.map((c) => (
              <li key={c.iso3 ?? 'unassigned'}>
                <span className="name">{c.iso3 ? zhName(c.iso3, countries) : '地圖上沒有國界的小島'}</span>
                <span className="value">{formatLargeNumber(c.value)}</span>
                <span className="share">{c.share !== null && `占該國${label} ${formatShare(c.share)}`}</span>
              </li>
            ))}
            {rest.length > 0 && (
              <li>
                <span className="name">
                  其他 {rest.length} {rest.every((c) => c.iso3) ? '國' : '處'}
                </span>
                <span className="value">{formatLargeNumber(restValue)}</span>
                <span className="share" />
              </li>
            )}
          </ul>
        </>
      )}
      {grid && (
        <p className="box-result-note">
          {`依 GHS-POP ${grid.epoch} 年約 1 km 網格的${label}分布（彙整成 ${grid.cellSize}° 網格）估算，` +
            `再把各國調整到該年的總${label}。國內分布固定用 ${grid.epoch} 年，年份離得越遠越不準。`}
        </p>
      )}
    </section>
  );
}

function formatShare(share: number): string {
  const pct = share * 100;
  if (pct < 0.1) return '不到 0.1%';
  return formatPercent(pct, pct < 10 ? 1 : 0);
}

/** 北極圈、沙漠這類稀疏的範圍每 km² 不到 1 人，多留幾位小數 */
function formatDensity(perKm2: number): string {
  return fixed(perKm2, perKm2 < 1 ? 2 : perKm2 < 10 ? 1 : 0);
}

function formatArea(km2: number): string {
  if (km2 >= 1e4) return `${fixed(km2 / 1e4, km2 >= 1e6 ? 0 : 1)} 萬 km²`;
  return `${fixed(km2, 0)} km²`;
}
