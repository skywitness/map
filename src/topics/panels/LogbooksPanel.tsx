import { useEffect, useState } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useCountryPart } from '../../lib/data';
import { fixed } from '../../lib/format';
import { NATIONS, SHIP_VIEWS, companyName, dateRange, nationColor, nationName, nationType, routeText, shipName, viewTypes, voyagesOverlay } from '../logbooks';
import type { PanelExtraProps } from '../types';

/**
 * 側欄的資料依國家分檔（pipeline/panel_parts.py 的 logbook_parts，panel/<ISO3>.json，2026-10-31；原本整份 544 KB）：
 * - voyages：這一國用到的航程 [船名, 國籍代碼, 公司, 出發地, 目的地, 開始 YYYYMMDD, 結束 YYYYMMDD, 船長]，
 *   鍵是航程的索引，就是 tracks.json 的 v
 * - near：每年經過附近（航線離國界 100 公里以內）的航程；own：每年自己的船（國籍對到的今天的國家）的航程
 */
type Voyage = [string, number, string | null, string, string, number, number, string];
interface PanelData {
  voyages: Record<string, Voyage>;
  near: Record<string, number[]>;
  own: Record<string, number[]>;
}

/** index.json 沒列的國家：沒有船經過附近、也沒有自己的船 */
const NO_VOYAGES: PanelData = { voyages: {}, near: {}, own: {} };

const SHOWN = 12;
const n0 = (v: number) => fixed(v, 0);

const TEXT = defineMessages({
  zh: {
    own: (year: number, name: string) => `${year} 年${name}的船`,
    ownCount: (n: number) => `${n0(n)} 個航程（同一艘船換了出發地或目的地算另一個航程）。`,
    near: (year: number, name: string, ships: string | null) => `${year} 年經過${name}附近的${ships ? `${ships}的` : ''}船`,
    nearNone: '這一年沒有船經過附近（航線離國界 100 公里以內）。',
    nearTotal: (n: number, years: number, first: number, last: number) =>
      `${first}–${last} 年間共 ${n0(n)} 個航程經過附近（${n0(years)} 個年份）。`,
    nearNever: '整個資料庫裡沒有船經過附近（航線離國界 100 公里以內）。',
    prev: (y: number) => `上一次：${y} 年`,
    next: (y: number) => `下一次：${y} 年`,
    captain: (name: string) => `船長 ${name}`,
    showAll: (n: number) => `顯示全部 ${n0(n)} 個`,
    showFewer: '收起',
    note: '滑到一列上，地圖標出那個航程；點一下固定標出。地名、船名照航海日誌的原文。經過附近是航線（每天正午的船位連成的直線，每 10 公里內插一點）在國界內或離國界 100 公里以內。',
  },
  en: {
    own: (year, name) => `${name} ships in ${year}`,
    ownCount: (n) => `${n0(n)} ${n === 1 ? 'voyage' : 'voyages'} (a ship starts a new voyage when its departure or destination port changes).`,
    near: (year, name, ships) => `${ships ? `${ships} ships` : 'Ships'} passing near ${name} in ${year}`,
    nearNone: 'No ship passed nearby this year (within 100 km of the country).',
    nearTotal: (n, years, first, last) =>
      `${n0(n)} ${n === 1 ? 'voyage' : 'voyages'} passed nearby between ${first} and ${last} (in ${n0(years)} ${years === 1 ? 'year' : 'years'}).`,
    nearNever: 'No ship in the database passed nearby (within 100 km of the country).',
    prev: (y) => `Previous: ${y}`,
    next: (y) => `Next: ${y}`,
    captain: (name) => `Captain ${name}`,
    showAll: (n) => `Show all ${n0(n)}`,
    showFewer: 'Show fewer',
    note: 'Hover over a row to highlight that voyage on the map; click to keep it highlighted. Place and ship names are as written in the logbooks. Passing nearby means the track (straight lines between noon positions, interpolated every 10 km) entered the country or came within 100 km of it.',
  },
});

function VoyageList({
  ids,
  data,
  dark,
  picked,
  onShow,
  onRestore,
  onPick,
}: {
  ids: number[];
  data: PanelData;
  dark: boolean;
  picked: number | null;
  onShow: (v: number) => void;
  onRestore: () => void;
  onPick: (v: number) => void;
}) {
  const lang = useLang();
  const text = TEXT[lang];
  const [all, setAll] = useState(false);
  const shown = ids.length > SHOWN && !all ? ids.slice(0, SHOWN) : ids;
  return (
    <>
      {/* 跟日食的清單同一種列（.eclipse-row）：色塊、名稱、右邊的小字，第二行另外的資訊 */}
      <ol className="eclipse-list">
        {shown.map((v) => {
          const [ship, nation, company, from, to, start, end, captain] = data.voyages[v];
          const who = [nationName(nation), companyName(company)].filter(Boolean).join(' · ');
          return (
            <li key={v}>
              <button
                type="button"
                className={`eclipse-row${picked === v ? ' is-picked' : ''}`}
                aria-pressed={picked === v}
                onMouseEnter={() => onShow(v)}
                onMouseLeave={onRestore}
                onFocus={() => onShow(v)}
                onBlur={onRestore}
                onClick={() => onPick(v)}
              >
                <span className="bar-key" style={{ background: nationColor(nation, dark) }} />
                <span className="eclipse-date" translate="no">
                  {shipName(ship)}
                </span>
                <span className="eclipse-kind">{who}</span>
                <span className="stat-meta">
                  <span translate="no">{routeText(from, to)}</span>
                  <span>{dateRange(start, end)}</span>
                  {captain && <span translate="no">{text.captain(captain)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {ids.length > SHOWN && (
        <button type="button" className="eclipse-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? text.showFewer : text.showAll(ids.length)}
        </button>
      )}
    </>
  );
}

export default function LogbooksPanel({ topic, indicator, iso3, year, countryName, tokens, highlightLine, selectYear }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { part, loading, error } = useCountryPart<PanelData>(`topics/${topic.id}/panel`, iso3);
  const [picked, setPicked] = useState<number | null>(null);
  // 指標選了某一國的船（2026-10-31）：地圖上是那一國的線圖層，清單也只列那一國的船
  const overlay = voyagesOverlay(indicator.id);
  const types = viewTypes(indicator.id);

  // 換國家、換年份、換指標：取消標出的航程（那一年的線已經不在地圖上）
  useEffect(() => {
    setPicked(null);
    return () => highlightLine?.(overlay, null);
  }, [iso3, year, highlightLine, overlay]);

  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (loading) return <p className="empty">{t.loading}</p>;
  const data = part ?? NO_VOYAGES;

  const dark = tokens.mode === 'dark';
  const nation = NATIONS.findIndex((n) => n.iso3 === iso3);
  const kept = (ids: number[]) => (types ? ids.filter((v) => types.includes(nationType(data.voyages[v][1]))) : ids);
  const own = nation >= 0 && (!types || types.includes(nationType(nation))) ? (data.own[String(year)] ?? []) : [];
  const nearByYear = Object.fromEntries(
    Object.entries(data.near)
      .map(([y, ids]) => [y, kept(ids)] as const)
      .filter(([, ids]) => ids.length > 0),
  );
  const near = nearByYear[String(year)] ?? [];
  const nearYears = Object.keys(nearByYear).map(Number);
  const nearAll = new Set(Object.values(nearByYear).flat());
  const prev = nearYears.filter((y) => y < year).pop();
  const next = nearYears.find((y) => y > year);

  const show = (v: number) => highlightLine?.(overlay, v);
  const restore = () => highlightLine?.(overlay, picked);
  const pick = (v: number) => {
    const p = picked === v ? null : v;
    setPicked(p);
    highlightLine?.(overlay, p);
  };
  const listProps = { data, dark, picked, onShow: show, onRestore: restore, onPick: pick };

  return (
    <>
      {nation >= 0 && own.length > 0 && (
        <section className="panel-section">
          <h3>{text.own(year, nationName(nation))}</h3>
          <p className="panel-year-note">{text.ownCount(own.length)}</p>
          <VoyageList ids={own} {...listProps} />
        </section>
      )}
      <section className="panel-section">
        <h3>{text.near(year, countryName, types ? (SHIP_VIEWS.find((v) => v.id === indicator.id)?.nations[lang] ?? null) : null)}</h3>
        {nearYears.length === 0 ? (
          <p className="note">{text.nearNever}</p>
        ) : (
          <>
            <p className="panel-year-note">
              {text.nearTotal(nearAll.size, nearYears.length, nearYears[0], nearYears[nearYears.length - 1])}
            </p>
            {near.length === 0 && <p className="note">{text.nearNone}</p>}
            {near.length > 0 && <VoyageList ids={near} {...listProps} />}
            {(prev !== undefined || next !== undefined) && (
              <p className="logbook-years">
                {prev !== undefined && (
                  <button type="button" className="eclipse-more" onClick={() => selectYear?.(prev)}>
                    {text.prev(prev)}
                  </button>
                )}
                {next !== undefined && (
                  <button type="button" className="eclipse-more" onClick={() => selectYear?.(next)}>
                    {text.next(next)}
                  </button>
                )}
              </p>
            )}
          </>
        )}
        <p className="note">{text.note}</p>
      </section>
    </>
  );
}
