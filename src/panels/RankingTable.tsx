import { useEffect, useMemo, useRef } from 'react';
import { enName, zhName, type CountryTable } from '../lib/countries';
import { formatPercent } from '../lib/format';
import type { IndicatorDef } from '../topics/types';
import { ranking } from './stats';

interface RankingTableProps {
  indicator: IndicatorDef;
  title: string;
  values: Map<string, number>;
  world: number | null;
  year: number;
  countries: CountryTable | null;
  selected: string | null;
  onSelect: (iso3: string) => void;
}

/** 地圖的表格版：每個數值都能不靠 hover 讀到，也能用鍵盤操作 */
export function RankingTable(props: RankingTableProps) {
  const { indicator, title, values, world, year, countries, selected, onSelect } = props;
  // 總量類指標排除 0（例如沒有已知 AI 叢集的國家），表格才不會一長串 0
  const rows = useMemo(
    () => ranking(values).filter(([, v]) => indicator.layer.kind === 'choropleth' || v > 0),
    [values, indicator],
  );
  const max = rows[0]?.[1] ?? 0;
  const showBars = rows.length > 0 && rows[rows.length - 1][1] >= 0;
  const showShare = indicator.shareOfWorld && world != null && world > 0;

  // 從搜尋選到的國家可能在表格很下面，捲過去
  const tableRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    tableRef.current?.querySelector('tr.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <div className="ranking">
      <table ref={tableRef}>
        <caption>
          {year} 年各國{title}排名（{rows.length} 個國家/地區）
        </caption>
        <thead>
          <tr>
            <th scope="col" className="num">名次</th>
            <th scope="col">國家/地區</th>
            <th scope="col" className="num">
              {title}
            </th>
            {showShare && <th scope="col" className="num">占全球</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(([iso3, value], i) => (
            <tr key={iso3} className={iso3 === selected ? 'is-selected' : undefined}>
              <td className="num">{i + 1}</td>
              <td>
                <button type="button" className="row-link" onClick={() => onSelect(iso3)}>
                  {zhName(iso3, countries)}
                  <span className="row-en">{enName(iso3, countries)}</span>
                </button>
              </td>
              <td className="num value-cell">
                <div className="value-wrap">
                  {showBars && (
                    <span className="value-track" aria-hidden="true">
                      <span className="value-bar" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
                    </span>
                  )}
                  {indicator.format(value)}
                </div>
              </td>
              {showShare && <td className="num">{formatPercent((value / world!) * 100, 2)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
