import { useMemo, useRef, type CSSProperties } from 'react';
import { useLang } from '../i18n';
import type { CountryTable } from '../lib/countries';
import type { AnalysisState } from '../lib/url-state';
import { useMapTokens } from '../map/palettes';
import { useElementSize } from '../map/useElementSize';
import type { Indicator, IndicatorData, Topic } from '../topics/types';
import { ChangeTab } from './ChangeTab';
import { analysable, numeric, useIndicatorFiles } from './common';
import { FilterTab } from './FilterTab';
import { MultiplesTab } from './MultiplesTab';
import { useWorldShapes, VIEW_W } from './shapes';
import { SwipeTab } from './SwipeTab';
import { TEXT } from './text';

export interface AnalysisViewProps {
  topic: Topic;
  indicator: Indicator;
  item: string | null;
  data: IndicatorData | null;
  year: number;
  countries: CountryTable | null;
  selected: string | null;
  onSelect: (iso3: string | null) => void;
  state: AnalysisState;
  onChange: (patch: Partial<AnalysisState>) => void;
}

const TABS = ['change', 'filter', 'multiples', 'swipe'] as const;

/**
 * 分析檢視（2026-10-30，網址 view=analysis）：跟「地圖」「排名表」並列，四種看法——
 * 變化（跟幾年前比）、篩選（多個條件）、並排（幾個年份或指標的小地圖）、對照（左右拉簾）。
 * 地圖是平面的 SVG（Equal Earth，shapes.ts），不用 MapLibre；這整個資料夾是自己的 chunk，切到分析才下載。
 * 點國家照樣打開側欄，時間軸照樣換年份
 */
export default function AnalysisView({ topic, indicator, item, data, year, countries, selected, onSelect, state, onChange }: AnalysisViewProps) {
  const lang = useLang();
  const T = TEXT[lang];
  const tokens = useMapTokens();
  const shapes = useWorldShapes();
  const boxRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(boxRef);
  const width = size?.width ?? 800;
  // 大地圖（變化、篩選、對照）不超過框的高度：扣掉分頁與控制列約 120px，依地圖的長寬比換成寬度上限
  const fitWidth = shapes && size ? Math.max(320, ((size.height - 120) * VIEW_W) / shapes.height) : null;
  // 同一個主題裡分析用得到的指標；篩選只能用連續的數值
  const options = useMemo(() => topic.indicators.filter(analysable), [topic]);
  const numericOptions = useMemo(() => options.filter(numeric), [options]);
  // 其他指標的檔：篩選、並排、對照用得到時才下載（變化只用目前的指標）
  const wanted = state.tab === 'change' ? [] : state.tab === 'filter' ? numericOptions : options;
  const files = useIndicatorFiles(topic, wanted, item, { indicator, data });
  const select = (iso3: string) => onSelect(iso3 === selected ? null : iso3);

  const common = { indicator, year, countries, tokens, selected, onSelect: select, state, onChange, width };
  return (
    <div className="analysis" ref={boxRef}>
      <div className="analysis-tabs" role="tablist" aria-label={T.tabsLabel}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={state.tab === tab}
            className={`analysis-tab${state.tab === tab ? ' is-active' : ''}`}
            onClick={() => onChange({ tab })}
          >
            {T.tabs[tab]}
          </button>
        ))}
        <span className="analysis-tab-note">{T.tabNotes[state.tab]}</span>
      </div>
      <div
        className="analysis-body"
        role="tabpanel"
        style={fitWidth ? ({ '--fit-width': `${Math.round(fitWidth)}px` } as CSSProperties) : undefined}
      >
        {!shapes || !data ? (
          <p className="analysis-note">{T.loading}</p>
        ) : state.tab === 'change' ? (
          data.years.length > 1 && numeric(indicator) ? (
            <ChangeTab shapes={shapes} data={data} {...common} />
          ) : (
            <p className="analysis-note">{T.timeless}</p>
          )
        ) : state.tab === 'filter' ? (
          <FilterTab shapes={shapes} options={numericOptions} files={files} {...common} />
        ) : state.tab === 'multiples' ? (
          <MultiplesTab shapes={shapes} options={options} files={files} {...common} />
        ) : (
          <SwipeTab shapes={shapes} options={options} files={files} {...common} />
        )}
      </div>
    </div>
  );
}
