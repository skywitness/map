import { lazy, Suspense, useMemo, type ComponentType, type LazyExoticComponent } from 'react';
import { EChart } from '../charts/EChart';
import { timeSeriesOption, type TimeSeriesLine } from '../charts/timeSeries';
import { useLang, useT } from '../i18n';
import { countryName, displayCode, enName, type CountryTable } from '../lib/countries';
import { useJsonMany } from '../lib/data';
import { formatPercent } from '../lib/format';
import {
  indicatorPath,
  missingReason,
  usesDimension,
  yearBin,
  type Indicator,
  type IndicatorData,
  type PanelExtraProps,
  type Topic,
} from '../topics/types';
import { categoryScale } from '../map/categories';
import { MAP_TOKENS, type Tokens } from '../theme/tokens';
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
  const { topic, indicator, item, itemLabel, iso3, year, countries, tokens, onClose, onIndicatorChange } = props;
  const files = useMemo(() => topic.indicators.map((i) => indicatorPath(topic, i, item)), [topic, item]);
  const t = useT();
  const lang = useLang();
  const label = (ind: Indicator) => (itemLabel && usesDimension(ind) ? t.itemIndicator(itemLabel, ind.label) : ind.label);
  const Extra = panelExtraFor(topic);
  const allData = useJsonMany<IndicatorData>(files);
  const name = countryName(iso3, countries);

  // 「只畫路網」「地形」這類不上色的指標不列成數值卡片（地形的數值跟平均海拔是同一份）；
  // 跟前面的指標用同一個資料檔的也不重複列（例如移民的「流向：移民來源」就是「移民人數」）
  const shown = (ind: Indicator) => ind.layer.kind !== 'none' && ind.layer.kind !== 'terrain';
  const card = (ind: Indicator, i: number) =>
    shown(ind) && !topic.indicators.slice(0, i).some((other) => shown(other) && other.file === ind.file);
  // 主題或指標寫明這個國家為什麼沒有值（台灣的外交裡的台灣、護照主題的本國護照、與美國的一致度裡的美國）時，
  // 用它取代「無資料」
  const reason = (ind: Indicator) => missingReason(topic, ind, item, iso3);
  const stats = topic.indicators.flatMap((ind, i) => (card(ind, i) ? [[ind, i] as const] : [])).map(([ind, i]) => {
    const data = allData[i];
    if (!data) return { ind, value: null, rank: null, total: 0, share: null, shownYear: null };
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
      value,
      rank: countZero || ind.layer.kind === 'categorical' || ind.unranked ? null : rankOf(values, iso3, ind.lowerIsBetter),
      total: values.size,
      // 0 的排名不顯示，占全球的 0% 也不顯示（否則卡片上只剩開頭的「 · 」）
      share: ind.shareOfWorld && value && !countZero && world ? (value / world) * 100 : null,
      shownYear,
    };
  });

  // 用 id 找：有子項目分級門檻的指標（forItem）是另一個物件
  const activeData = allData[topic.indicators.findIndex((i) => i.id === indicator.id)];
  const option = useMemo(() => {
    if (!activeData) return null;
    const own = activeData.values[iso3];
    if (!own || activeData.years.length < 2 || indicator.layer.kind === 'categorical') return null;
    const lines: TimeSeriesLine[] = [{ name, values: own, color: tokens.accent }];
    const world = activeData.aggregates?.WLD;
    if (indicator.compareWorld && world) lines.push({ name: t.world, values: world, color: tokens.context });
    return timeSeriesOption({
      years: activeData.years,
      lines,
      projectionFrom: activeData.projectionFrom,
      methodBreak: activeData.methodBreak,
      year,
      indicator,
      tokens,
      // 普查、調查隔幾年一次：畫出每個資料點，點和點之間連起來
      sparse: activeData.latestWithin !== undefined,
    });
  }, [activeData, iso3, name, indicator, year, tokens, t]);

  const activeReason = reason(indicator);
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
          ×
        </button>
      </header>

      {/* 不隨時間變化的資料（海拔）不寫年份 */}
      {!topic.timeless && (
        <p className="panel-year">
          {t.year(year)}
          {projectionFrom !== undefined && year >= projectionFrom && (
            <span className="year-tag is-projected">{t.projected}</span>
          )}
        </p>
      )}

      <div className="stats">
        {stats.map(({ ind, value, rank, total, share, shownYear }) => (
          <button
            type="button"
            key={ind.id}
            className={`stat${ind.id === indicator.id ? ' is-active' : ''}`}
            onClick={() => onIndicatorChange(ind.id)}
            aria-pressed={ind.id === indicator.id}
          >
            <span className="stat-label">{label(ind)}</span>
            <span className="stat-value">{value != null ? ind.format(value) : (reason(ind) ?? t.noData)}</span>
            <span className="stat-meta">
              {rank != null && t.rank(rank, total)}
              {share != null && t.shareOfWorld(formatPercent(share, share < 1 ? 2 : 1))}
              {!topic.timeless && shownYear !== null && shownYear !== year && value != null && t.shownYear(shownYear)}
            </span>
          </button>
        ))}
      </div>

      {/* 類別的代碼畫成折線沒有意義，改列出歷年變化；單一年份的資料也沒有變化可畫 */}
      {activeData?.years.length !== 1 && (
        <section className="panel-chart">
          <h3>{t.overTime(label(indicator))}</h3>
          {/* 有原因、而且這個國家完全沒有值時才用原因取代圖表：台灣在聯合國投票只有 1946–1971 年有值，照樣畫圖 */}
          {activeReason && !activeData?.values[iso3]?.some((v) => v != null) ? (
            <p className="empty">{activeReason}</p>
          ) : indicator.layer.kind === 'categorical' && activeData ? (
            <CategoryHistory indicator={indicator} data={activeData} iso3={iso3} />
          ) : option ? (
            <EChart option={option} height={220} ariaLabel={t.lineChartAria(name, label(indicator))} />
          ) : (
            <p className="empty">
              {!activeData ? t.loading : activeData.years.length < 2 ? t.singleSnapshotPanel : t.noCountryData}
            </p>
          )}
          {projectionFrom !== undefined && option && <p className="note">{t.dashedProjection(projectionFrom)}</p>}
          {methodBreak !== undefined && option && <p className="note">{t.methodBreak(methodBreak)}</p>}
          {note && <p className="note">{t.note(note)}</p>}
        </section>
      )}
      {/* 只有單一年份的資料沒有折線圖，附註直接接在數值卡片下面 */}
      {activeData?.years.length === 1 && note && <p className="note">{t.note(note)}</p>}

      {Extra && (
        <Suspense fallback={<p className="empty">{t.loading}</p>}>
          <Extra topic={topic} iso3={iso3} year={year} item={item} countryName={name} tokens={tokens} />
        </Suspense>
      )}
    </aside>
  );
}

/** 類別圖的歷年變化：連續相同類別的年份合併成一段，例如「2000–2003 年 心血管疾病」 */
function CategoryHistory({ indicator, data, iso3 }: { indicator: Indicator; data: IndicatorData; iso3: string }) {
  const t = useT();
  const scale = useMemo(
    () => (indicator.layer.kind === 'categorical' ? categoryScale(indicator.layer, MAP_TOKENS) : null),
    [indicator],
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
