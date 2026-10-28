import { useMemo } from 'react';
import { useT } from '../i18n';
import { countryName, type CountryTable } from '../lib/countries';
import { ranking } from '../panels/stats';
import type { Indicator } from '../topics/types';

/** 各列幾個國家 */
const COUNT = 5;

interface ExtremesProps {
  indicator: Indicator;
  values: Map<string, number>;
  year: number;
  countryTable: CountryTable | null;
  selected: string | null;
  /** 選取那個國家、地圖飛過去（跟從搜尋選到一樣） */
  onPick: (iso3: string) => void;
}

/**
 * 寬螢幕的地圖左下角、圖例上面：數值最高、最低各 5 個國家（總量只列最多的 5 個，最少的多半是 0 的小地方）。
 * 地球儀一次只看得到半個世界，排名靠前的國家常在背面；點一下就選取、地圖轉過去。
 */
export function Extremes({ indicator, values, year, countryTable, selected, onPick }: ExtremesProps) {
  const t = useT();
  const total = indicator.layer.kind === 'bubble';
  const columns = useMemo(() => {
    const rows = ranking(values).filter(([, v]) => !total || v > 0);
    const high = { title: total ? t.extremesMost : t.extremesHigh, rows: rows.slice(0, COUNT) };
    if (total || rows.length < COUNT * 2) return [high];
    return [high, { title: t.extremesLow, rows: rows.slice(-COUNT).reverse() }];
  }, [values, total, t]);

  return (
    <section className="legend extremes" aria-label={t.extremesLabel}>
      {columns.map(({ title, rows }) => (
        <div key={title} className="extremes-column">
          <div className="extremes-title">{title}</div>
          <ol>
            {rows.map(([iso3, value]) => (
              <li key={iso3}>
                <button
                  type="button"
                  className={iso3 === selected ? 'is-selected' : undefined}
                  aria-current={iso3 === selected ? 'true' : undefined}
                  onClick={() => onPick(iso3)}
                >
                  <span className="extremes-name">{countryName(iso3, countryTable)}</span>
                  <span className="extremes-value">{indicator.format(value, year)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
