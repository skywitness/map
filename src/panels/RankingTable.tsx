import { useEffect, useMemo, useRef } from 'react';
import { useLang, useT } from '../i18n';
import { countryName, enName, type CountryTable } from '../lib/countries';
import { formatPercent } from '../lib/format';
import { categoryScale } from '../map/categories';
import { MAP_TOKENS } from '../theme/tokens';
import type { Indicator } from '../topics/types';
import { ranking } from './stats';

interface RankingTableProps {
  indicator: Indicator;
  title: string;
  values: Map<string, number>;
  /** 用之前最近一年的值的國家，實際的資料年份（年份零散的指標，見 stats.ts 的 latestAt） */
  valueYears?: Map<string, number>;
  /** 指標檔的 latestWithin，有的話在表格下方說明 */
  latestWithin?: number;
  world: number | null;
  /** null：不隨時間變化的資料（例如海拔），標題不寫年份 */
  year: number | null;
  countries: CountryTable | null;
  selected: string | null;
  onSelect: (iso3: string) => void;
}

/** 地圖的表格版：每個數值都能不靠 hover 讀到，也能用鍵盤操作 */
export function RankingTable(props: RankingTableProps) {
  const { indicator, title, values, valueYears, latestWithin, world, year, countries, selected, onSelect } = props;
  const t = useT();
  const lang = useLang();
  // 類別圖沒有大小之分：依圖例的類別順序排，同一類（「其他」裡同一種）再依國名排，數值欄放色塊與類別名稱
  const categories = useMemo(
    () => (indicator.layer.kind === 'categorical' ? categoryScale(indicator.layer, MAP_TOKENS) : null),
    [indicator],
  );
  // 總量類指標排除 0（例如沒有已知 AI 叢集的國家），表格才不會一長串 0
  const rows = useMemo(() => {
    if (!categories) return ranking(values).filter(([, v]) => indicator.layer.kind === 'choropleth' || v > 0);
    const name = (iso3: string) => countryName(iso3, countries);
    const locale = lang === 'en' ? 'en' : 'zh-Hant-TW';
    return [...values]
      .filter(([, v]) => categories.index(v) !== null)
      .sort(
        ([a, va], [b, vb]) =>
          categories.index(va)! - categories.index(vb)! ||
          indicator.format(va).localeCompare(indicator.format(vb), locale) ||
          name(a).localeCompare(name(b), locale),
      );
  }, [values, indicator, categories, countries, lang]);
  const max = rows[0]?.[1] ?? 0;
  const showBars = !categories && rows.length > 0 && rows[rows.length - 1][1] >= 0;
  const showShare = indicator.shareOfWorld && world != null && world > 0;
  // 年份零散的指標有國家用之前的年份時，資料年份另成一欄（寫在數值旁會擠短那一列的長條，跟其他列比不準）
  const showYears = latestWithin !== undefined && (valueYears?.size ?? 0) > 0;

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
            {showYears && <th scope="col" className="num year-col">{t.dataYearCol}</th>}
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
                  {showBars && (
                    <span className="value-track" aria-hidden="true">
                      <span className="value-bar" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
                    </span>
                  )}
                  {categories && <span className="legend-swatch" style={{ background: categories.color(value)! }} />}
                  {indicator.format(value)}
                </div>
              </td>
              {showShare && <td className="num">{formatPercent((value / world!) * 100, 2)}</td>}
              {showYears && <td className="num year-col value-year">{valueYears?.get(iso3) ?? ''}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {showYears && <p className="note">{t.latestWithinHint(latestWithin)}</p>}
    </div>
  );
}
