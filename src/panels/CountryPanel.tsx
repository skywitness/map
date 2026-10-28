import { lazy, Suspense, useMemo, type ComponentType, type LazyExoticComponent } from 'react';
import { EChart } from '../charts/EChart';
import { SectionSkeleton, Skeleton } from './Skeleton';
import { timeSeriesOption, type TimeSeriesLine } from '../charts/timeSeries';
import { useLang, useT } from '../i18n';
import { countryName, displayCode, enName, type CountryTable } from '../lib/countries';
import { useJsonMany } from '../lib/data';
import { formatPercent } from '../lib/format';
import {
  indicatorPath,
  itemLabelOf,
  missingReason,
  sameTimeAxis,
  usesDimension,
  yearBin,
  type Indicator,
  type IndicatorData,
  type PanelExtraProps,
  type Topic,
} from '../topics/types';
import { categoryScale } from '../map/categories';
import { CloseIcon } from '../map/MapIcons';
import { HUE_ORDER, type Tokens } from '../theme/tokens';
import { ComparePicker } from './ComparePicker';
import { useMapTokens } from '../map/palettes';
import { latestAt, rankOf } from './stats';

interface CountryPanelProps {
  topic: Topic;
  indicator: Indicator;
  item: string | null;
  itemLabel: string | null;
  iso3: string;
  year: number;
  countries: CountryTable | null;
  tokens: Tokens;
  onClose: () => void;
  onIndicatorChange: (id: string) => void;
  /** 一起比較的國家（網址的 cmp），折線圖與數值卡片都列出 */
  compare: string[];
  onCompareChange: (compare: string[]) => void;
  /** 主題側欄要在地圖上標出線、移動地圖時用（PanelExtraProps 的同名欄位） */
  highlightLine?: PanelExtraProps['highlightLine'];
  focusBox?: PanelExtraProps['focusBox'];
  selectYear?: PanelExtraProps['selectYear'];
}

// 每個主題的額外側欄區塊只建立一次 lazy 元件
const extraCache = new Map<string, LazyExoticComponent<ComponentType<PanelExtraProps>>>();
function panelExtraFor(topic: Topic) {
  if (!topic.panelExtra) return null;
  let component = extraCache.get(topic.id);
  if (!component) {
    component = lazy(topic.panelExtra);
    extraCache.set(topic.id, component);
  }
  return component;
}

export function CountryPanel(props: CountryPanelProps) {
  const { topic, indicator, item, itemLabel, iso3, year, countries, tokens, onClose, onIndicatorChange, compare } = props;
  const { onCompareChange, highlightLine, focusBox, selectYear } = props;
  // 比較的國家的顏色：類別色依固定順序，第 1 色（藍）是這個國家自己，接著是橘、綠松、黃
  const compareColors = HUE_ORDER.slice(1, 4).map((h) => tokens.hues[h]);
  const files = useMemo(() => topic.indicators.map((i) => indicatorPath(topic, i, item)), [topic, item]);
  const t = useT();
  const lang = useLang();
  // 子項目的名稱依各指標自己的選項（指標有自己的 dimension 時，目前的子項目不一定是它的，itemLabelOf 換成它的預設）
  const label = (ind: Indicator) => {
    const own = ind.dimension ? itemLabelOf(topic, ind, item) : itemLabel;
    return own && usesDimension(ind) ? t.itemIndicator(own, ind.label) : ind.label;
  };
  const Extra = panelExtraFor(topic);
  const allData = useJsonMany<IndicatorData>(files);
  const name = countryName(iso3, countries);

  // 「只畫路網」「地形」這類不上色的指標不列成數值卡片（地形的數值跟平均海拔是同一份）；
  // 跟前面的指標用同一個資料檔的也不重複列（例如移民的「流向：移民來源」就是「移民人數」）
  const shown = (ind: Indicator) => ind.layer.kind !== 'none' && ind.layer.kind !== 'terrain' && ind.layer.kind !== 'flags';
  // 年份的意思跟目前的指標不同的（平均身高的出生年 vs 19 歲那年，指標的 timeAxis）也不列，同一個年份在那裡是另一批人
  const card = (ind: Indicator, i: number) =>
    shown(ind) &&
    sameTimeAxis(ind, indicator) &&
    !topic.indicators.slice(0, i).some((other) => shown(other) && other.file === ind.file);
  // 主題或指標寫明這個國家為什麼沒有值（台灣的外交裡的台灣、護照主題的本國護照、與美國的一致度裡的美國）時，
  // 用它取代「無資料」
  const reason = (ind: Indicator) => missingReason(topic, ind, item, iso3);
  const stats = topic.indicators.flatMap((ind, i) => (card(ind, i) ? [[ind, i] as const] : [])).map(([ind, i]) => {
    const data = allData[i];
    if (!data) return { ind, loaded: false, value: null, rank: null, total: 0, share: null, shownYear: null, others: [] };
    // 各指標涵蓋的年份不同（例如數據中心只有單一快照），沒有這一年就改用最接近的一年
    const yearIndex = nearestYearIndex(data.years, year, yearBin(ind));
    // 年份零散的指標（latestWithin）沒有當年資料時用之前最近一年的值，標出實際的資料年份
    const { values, years: valueYears } = latestAt(data, yearIndex);
    const shownYear = valueYears.get(iso3) ?? data.years[yearIndex];
    const value = values.get(iso3) ?? null;
    const world = data.aggregates?.WLD?.[yearIndex] ?? null;
    // 計數類指標（例如模型數）大多數國家是 0，0 的排名沒有意義；類別沒有大小，也不排名
    const countZero = ind.layer.kind === 'bubble' && value === 0;
    return {
      ind,
      loaded: true,
      value,
      rank: countZero || ind.layer.kind === 'categorical' || ind.unranked ? null : rankOf(values, iso3, ind.lowerIsBetter),
      total: values.size,
      // 0 的排名不顯示，占全球的 0% 也不顯示（否則卡片上只剩開頭的「 · 」）
      share: ind.shareOfWorld && value && !countZero && world ? (value / world) * 100 : null,
      shownYear,
      others: compare.map((c) => values.get(c) ?? null),
    };
  });

  // 用 id 找：有子項目分級門檻的指標（forItem）是另一個物件
  const activeData = allData[topic.indicators.findIndex((i) => i.id === indicator.id)];
  // 不上色的指標（城市地圖、發電廠地圖）跟某張數值卡片用同一個資料檔時，折線圖用那張卡片的名稱與格式
  // （「住在城市的比例的變化」，不是「城市地圖的變化」）；流向圖也一樣（「移民人數的變化」，不是「流向：移民來源的變化」）
  const chartIndicator =
    shown(indicator) && indicator.layer.kind !== 'flow'
      ? indicator
      : (topic.indicators.find((o) => shown(o) && o.layer.kind !== 'flow' && o.file === indicator.file) ?? indicator);
  const chartLabel = label(chartIndicator);
  const option = useMemo(() => {
    if (!activeData) return null;
    const own = activeData.values[iso3];
    if (!own || activeData.years.length < 2 || chartIndicator.layer.kind === 'categorical') return null;
    const lines: TimeSeriesLine[] = [{ name, values: own, color: tokens.accent }];
    compare.forEach((c, i) => {
      const series = activeData.values[c];
      if (series?.some((v) => v != null)) lines.push({ name: countryName(c, countries), values: series, color: compareColors[i] });
    });
    const world = activeData.aggregates?.WLD;
    if (chartIndicator.compareWorld && world) lines.push({ name: t.world, values: world, color: tokens.context });
    const chart = timeSeriesOption({
      years: activeData.years,
      lines,
      projectionFrom: activeData.projectionFrom,
      methodBreak: activeData.methodBreak,
      year,
      indicator: chartIndicator,
      tokens,
      // 普查、調查隔幾年一次：畫出每個資料點，點和點之間連起來
      sparse: activeData.latestWithin !== undefined,
    });
    // y 軸不從 0 開始（指標的 chartZoom，例如身高）
    return chartIndicator.chartZoom ? { ...chart, yAxis: { ...(chart.yAxis as object), scale: true } } : chart;
    // compareColors 由 tokens 算出，不必另外列
  }, [activeData, iso3, name, chartIndicator, year, tokens, t, compare, countries]);

  const activeReason = reason(indicator);
  // 可以加進比較的國家：目前指標有資料的（還沒載入時先用全部國家）
  const compareCandidates = useMemo(
    () =>
      activeData
        ? Object.entries(activeData.values).flatMap(([c, series]) => (series.some((v) => v != null) ? [c] : []))
        : Object.keys(countries ?? {}),
    [activeData, countries],
  );
  const projectionFrom = activeData?.projectionFrom;
  const methodBreak = activeData?.methodBreak;
  // 附註只有中文的話，英文介面不顯示
  const note = lang === 'en' ? activeData?.notesEn?.[iso3] : activeData?.notes?.[iso3];

  return (
    <aside className="panel" aria-label={t.panelAria(name)}>
      <header className="panel-header">
        <div>
          <h2>{name}</h2>
          <p className="panel-sub">
            {lang === 'en' ? displayCode(iso3) : `${enName(iso3, countries)} · ${displayCode(iso3)}`}
          </p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t.close}>
          <CloseIcon />
        </button>
      </header>

      {/* 不隨時間變化的資料（海拔）不寫年份 */}
      {!topic.timeless && (
        <p className="panel-year">
          {indicator.timeAxis?.year(year) ?? t.year(year)}
          {projectionFrom !== undefined && year >= projectionFrom && (
            <span className="year-tag is-projected">{t.projected}</span>
          )}
        </p>
      )}

      <div className="stats">
        {stats.map(({ ind, loaded, value, rank, total, share, shownYear, others }) => (
          <button
            type="button"
            key={ind.id}
            className={`stat${ind.id === indicator.id ? ' is-active' : ''}`}
            onClick={() => onIndicatorChange(ind.id)}
            aria-pressed={ind.id === indicator.id}
          >
            <span className="stat-label">{label(ind)}</span>
            {/* 資料還沒到時不要先寫「無資料」，畫一塊灰色 */}
            <span className="stat-value">
              {!loaded ? (
                <Skeleton width="60%" height={20} />
              ) : value != null ? (
                ind.format(value, shownYear ?? year)
              ) : (
                (reason(ind) ?? t.noData)
              )}
            </span>
            <span className="stat-meta">
              {rank != null && t.rank(rank, total)}
              {share != null && t.shareOfWorld(formatPercent(share, share < 1 ? 2 : 1))}
              {!topic.timeless && shownYear !== null && shownYear !== year && value != null && t.shownYear(shownYear)}
            </span>
            {loaded && others.length > 0 && (
              <span className="stat-compare">
                {others.map((v, i) => (
                  <span key={compare[i]} className="stat-compare-row">
                    <span className="compare-dot" style={{ background: compareColors[i] }} aria-hidden="true" />
                    <span className="stat-compare-name">{countryName(compare[i], countries)}</span>
                    <span className="stat-compare-value">{v != null ? ind.format(v, year) : '—'}</span>
                  </span>
                ))}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 再加幾個國家一起比：折線圖多畫它們的線、數值卡片多列它們的值；只有一年的資料也可以比數值 */}
      <ComparePicker
        iso3={iso3}
        compare={compare}
        colors={compareColors}
        candidates={compareCandidates}
        countries={countries}
        onChange={onCompareChange}
      />

      {/* 類別的代碼畫成折線沒有意義，改列出歷年變化；單一年份的資料也沒有變化可畫；指標的 panelChart: false 不畫 */}
      {activeData?.years.length !== 1 && indicator.panelChart !== false && (
        <section className="panel-chart">
          <h3>{t.overTime(chartLabel)}</h3>
          {/* 有原因、而且這個國家完全沒有值時才用原因取代圖表：台灣在聯合國投票只有 1946–1971 年有值，照樣畫圖 */}
          {activeReason && !activeData?.values[iso3]?.some((v) => v != null) ? (
            <p className="empty">{activeReason}</p>
          ) : indicator.layer.kind === 'categorical' && activeData ? (
            <CategoryHistory indicator={indicator} data={activeData} iso3={iso3} />
          ) : option ? (
            <EChart option={option} height={220} ariaLabel={t.lineChartAria(name, chartLabel)} />
          ) : !activeData ? (
            <div aria-busy="true">
              <span className="visually-hidden">{t.loading}</span>
              <Skeleton height={220} />
            </div>
          ) : (
            <p className="empty">{activeData.years.length < 2 ? t.singleSnapshotPanel : t.noCountryData}</p>
          )}
          {projectionFrom !== undefined && option && <p className="note">{t.dashedProjection(projectionFrom)}</p>}
          {methodBreak !== undefined && option && <p className="note">{t.methodBreak(methodBreak)}</p>}
          {note && <p className="note">{t.note(note)}</p>}
        </section>
      )}
      {/* 只有單一年份的資料沒有折線圖，附註直接接在數值卡片下面 */}
      {(activeData?.years.length === 1 || indicator.panelChart === false) && note && <p className="note">{t.note(note)}</p>}

      {Extra && (
        <Suspense fallback={<SectionSkeleton />}>
          <Extra
            topic={topic}
            indicator={indicator}
            iso3={iso3}
            year={year}
            item={item}
            countryName={name}
            tokens={tokens}
            highlightLine={highlightLine}
            focusBox={focusBox}
            selectYear={selectYear}
          />
        </Suspense>
      )}
    </aside>
  );
}

/** 類別圖的歷年變化：連續相同類別的年份合併成一段，例如「2000–2003 年 心血管疾病」 */
function CategoryHistory({ indicator, data, iso3 }: { indicator: Indicator; data: IndicatorData; iso3: string }) {
  const t = useT();
  // 有強弱的類別用使用者選的配色（palettes.ts），跟地圖一致
  const mapTokens = useMapTokens();
  const scale = useMemo(
    () => (indicator.layer.kind === 'categorical' ? categoryScale(indicator.layer, mapTokens) : null),
    [indicator, mapTokens],
  );
  const periods: { from: number; to: number; value: number }[] = [];
  (data.values[iso3] ?? []).forEach((v, i) => {
    if (v == null) return;
    const last = periods[periods.length - 1];
    if (last && last.value === v && last.to === data.years[i - 1]) last.to = data.years[i];
    else periods.push({ from: data.years[i], to: data.years[i], value: v });
  });
  if (!scale || periods.length === 0) return <p className="empty">{t.noCountryData}</p>;
  return (
    <ul className="category-history">
      {periods.map((p) => (
        <li key={p.from}>
          <span className="legend-swatch" style={{ background: scale.color(p.value) ?? undefined }} />
          <span className="category-period">{t.periodRange(p.from, p.to)}</span>
          {indicator.format(p.value)}
        </li>
      ))}
    </ul>
  );
}

/** bin：每十年一筆的指標取包含這一年的那一筆（1999 → 1990 年代），不取最接近的 2000 */
function nearestYearIndex(years: number[], year: number, bin?: number): number {
  const exact = years.indexOf(year);
  if (exact >= 0) return exact;
  if (bin) {
    const containing = years.findLastIndex((y) => y <= year && year < y + bin);
    if (containing >= 0) return containing;
  }
  let best = 0;
  years.forEach((y, i) => {
    if (Math.abs(y - year) < Math.abs(years[best] - year)) best = i;
  });
  return best;
}
