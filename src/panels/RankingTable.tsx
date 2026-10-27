import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLang, useT } from '../i18n';
import { countryName, displayCode, enName, type CountryTable } from '../lib/countries';
import { formatPercent } from '../lib/format';
import { categoryScale } from '../map/categories';
import { MAP_TOKENS } from '../theme/tokens';
import type { Indicator } from '../topics/types';
import { ranking, rowRanks } from './stats';

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
  /** 指標的 timeAxis 改寫的年份（「1996 年出生」）：標題寫成「男性平均身高（1996 年出生）」，不寫「1996 年」 */
  yearText?: string;
  countries: CountryTable | null;
  selected: string | null;
  onSelect: (iso3: string) => void;
  /** 國名前面的小圖示（主題的 rowIcon，例如國旗主題的小國旗） */
  icon?: (props: { iso3: string }) => ReactNode;
}

/** 地圖的表格版：每個數值都能不靠 hover 讀到，也能用鍵盤操作 */
export function RankingTable(props: RankingTableProps) {
  const { indicator, title, values, valueYears, latestWithin, world, year, yearText, countries, selected, onSelect, icon: Icon } = props;
  const t = useT();
  const lang = useLang();
  // 類別圖沒有大小之分：依圖例的類別順序排，同一類（「其他」裡同一種）再依國名排，數值欄放色塊與類別名稱
  const categories = useMemo(
    () => (indicator.layer.kind === 'categorical' ? categoryScale(indicator.layer, MAP_TOKENS) : null),
    [indicator],
  );
  // 總量類指標排除 0（例如沒有已知 AI 叢集的國家），表格才不會一長串 0。
  // 同分的國家依國名排、名次相同（例如超過 WHO 指引值的人口比例有一百多國是 100%）
  const rows = useMemo(() => {
    const name = (iso3: string) => countryName(iso3, countries);
    const locale = lang === 'en' ? 'en' : 'zh-Hant-TW';
    if (!categories) {
      return ranking(values, indicator.lowerIsBetter, (a, b) => name(a).localeCompare(name(b), locale)).filter(
        ([, v]) => indicator.layer.kind === 'choropleth' || v > 0,
      );
    }
    return [...values]
      .filter(([, v]) => categories.index(v) !== null)
      .sort(
        ([a, va], [b, vb]) =>
          categories.index(va)! - categories.index(vb)! ||
          indicator.format(va).localeCompare(indicator.format(vb), locale) ||
          name(a).localeCompare(name(b), locale),
      );
  }, [values, indicator, categories, countries, lang]);
  const ranks = useMemo(() => rowRanks(rows), [rows]);
  // 沒有好壞之分的數值（例如跟台灣的時差）依數值排列，不寫名次
  const showRank = !categories && !indicator.unranked;
  // 數值越小越好的指標由小排到大，最大值在最後一列
  const max = Math.max(0, ...rows.map(([, v]) => v));
  // 數值是年份這類長短沒有意義的（指標的 rankingBars: false）不畫長條
  const showBars = !categories && indicator.rankingBars !== false && rows.length > 0 && rows.every(([, v]) => v >= 0);
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
        <caption>
          {(categories ? t.categoryCaption : showRank ? t.rankingCaption : t.valueCaption)(
            yearText ? null : year,
            yearText ? t.withYear(title, yearText) : title,
            rows.length,
          )}
        </caption>
        <thead>
          <tr>
            {showRank && <th scope="col" className="num">{t.rankCol}</th>}
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
              {showRank && <td className="num">{ranks[i]}</td>}
              <td>
                <button type="button" className="row-link" onClick={() => onSelect(iso3)}>
                  {Icon && <Icon iso3={iso3} />}
                  {countryName(iso3, countries)}
                  {/* 中文介面在國名旁附上英文名；英文介面附 ISO 代碼 */}
                  <span className="row-en">{lang === 'en' ? displayCode(iso3) : enName(iso3, countries)}</span>
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
