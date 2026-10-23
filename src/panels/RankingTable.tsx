import { useEffect, useMemo, useRef } from 'react';
import { useLang, useT } from '../i18n';
import { countryName, enName, type CountryTable } from '../lib/countries';
import { formatPercent } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { Indicator } from '../topics/types';
import { ranking } from './stats';

interface RankingTableProps {
  indicator: Indicator;
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
  const t = useT();
  const lang = useLang();
  // 類別圖（例如首要死因）沒有名次，依類別分組、組內依國名排
  const categories = indicator.layer.kind === 'categorical' ? indicator.layer.categories : null;
  const hues = useMemo(() => new Map(categories?.map((c) => [c.value, MAP_TOKENS.hues[c.hue]])), [categories]);
  // 總量類指標排除 0（例如沒有已知 AI 叢集的國家），表格才不會一長串 0
  const rows = useMemo(() => {
    if (categories) {
      const order = new Map(categories.map((c, i) => [c.value, i]));
      const name = (iso3: string) => countryName(iso3, countries);
      return [...values].sort(
        ([a, va], [b, vb]) =>
          (order.get(va) ?? Infinity) - (order.get(vb) ?? Infinity) || name(a).localeCompare(name(b), lang === 'en' ? 'en' : 'zh-Hant-TW'),
      );
    }
    return ranking(values).filter(([, v]) => indicator.layer.kind === 'choropleth' || v > 0);
  }, [values, indicator, categories, countries, lang]);
  const max = rows[0]?.[1] ?? 0;
  const showBars = !categories && rows.length > 0 && rows[rows.length - 1][1] >= 0;
  const showShare = indicator.shareOfWorld && world != null && world > 0;

  // 從搜尋選到的國家可能在表格很下面，捲過去
  const tableRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    tableRef.current?.querySelector('tr.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <div className="ranking">
      <table ref={tableRef}>
        <caption>{(categories ? t.categoryCaption : t.rankingCaption)(year, title, rows.length)}</caption>
        <thead>
          <tr>
            {!categories && <th scope="col" className="num">{t.rankCol}</th>}
            <th scope="col">{t.countryCol}</th>
            <th scope="col" className="num">
              {title}
            </th>
            {showShare && <th scope="col" className="num">{t.shareCol}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(([iso3, value], i) => (
            <tr key={iso3} className={iso3 === selected ? 'is-selected' : undefined}>
              {!categories && <td className="num">{i + 1}</td>}
              <td>
                <button type="button" className="row-link" onClick={() => onSelect(iso3)}>
                  {countryName(iso3, countries)}
                  {/* 中文介面在國名旁附上英文名；英文介面附 ISO 代碼 */}
                  <span className="row-en">{lang === 'en' ? iso3 : enName(iso3, countries)}</span>
                </button>
              </td>
              <td className="num value-cell">
                <div className="value-wrap">
                  {categories && <span className="legend-swatch" style={{ background: hues.get(value) }} />}
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
