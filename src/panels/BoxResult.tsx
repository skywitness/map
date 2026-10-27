import { useT, type Messages } from '../i18n';
import { countryName, type CountryTable } from '../lib/countries';
import { fixed, formatLargeNumber, formatPercent } from '../lib/format';
import { CloseIcon } from '../map/MapIcons';

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
  const t = useT();
  const top = contributions.slice(0, TOP_N);
  const rest = contributions.slice(TOP_N);
  const restValue = rest.reduce((sum, c) => sum + c.value, 0);

  return (
    <section className="box-result" aria-label={t.boxAria(label)} aria-live="polite">
      <header>
        <span className="box-result-title">{t.boxTitle(label)}</span>
        <button type="button" className="icon-button small" onClick={onClear} aria-label={t.boxClear}>
          <CloseIcon size={14} />
        </button>
      </header>
      {total === null ? (
        <p className="box-result-value">{t.loading}</p>
      ) : contributions.length === 0 ? (
        <p className="box-result-empty">{t.boxEmpty(label)}</p>
      ) : (
        <>
          <p className="box-result-value">
            {formatLargeNumber(total)} {unit}
          </p>
          <p className="box-result-meta">
            {t.boxLand(year, t.area(landKm2))}
            {landKm2 > 0 && t.boxDensity(formatDensity(total / landKm2), unit)}
          </p>
          <ul className="box-result-list">
            {top.map((c) => (
              <li key={c.iso3 ?? 'unassigned'}>
                <span className="name">{c.iso3 ? countryName(c.iso3, countries) : t.boxUnassigned}</span>
                <span className="value">{formatLargeNumber(c.value)}</span>
                <span className="share">{c.share !== null && t.boxShare(label, formatShare(c.share, t))}</span>
              </li>
            ))}
            {rest.length > 0 && (
              <li>
                <span className="name">{t.boxOthers(rest.length, rest.every((c) => c.iso3))}</span>
                <span className="value">{formatLargeNumber(restValue)}</span>
                <span className="share" />
              </li>
            )}
          </ul>
        </>
      )}
      {grid && <p className="box-result-note">{t.boxNote(grid.epoch, grid.cellSize, label)}</p>}
    </section>
  );
}

function formatShare(share: number, t: Messages): string {
  const pct = share * 100;
  if (pct < 0.1) return t.boxShareTiny;
  return formatPercent(pct, pct < 10 ? 1 : 0);
}

/** 北極圈、沙漠這類稀疏的範圍每 km² 不到 1 人，多留幾位小數 */
function formatDensity(perKm2: number): string {
  return fixed(perKm2, perKm2 < 1 ? 2 : perKm2 < 10 ? 1 : 0);
}
