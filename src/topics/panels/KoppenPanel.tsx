import { useEffect } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { setClassGridOnly } from '../../map/classGridHighlight';
import { fixed } from '../../lib/format';
import { BASE_PERIOD, CLASSES, GROUPS, periodKey, periodText } from '../koppen';
import { MAP_TOKENS } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

/**
 * pipeline/topics/koppen.py 的 panel.json：每國每個時期（1901、1931、1961、1991、2041-ssp245…）各類型的面積千分比
 * [[代碼, ‰], …]（≥ 1‰ 的才列，由大到小）
 */
interface PanelData {
  periods: string[];
  countries: Record<string, Record<string, [number, number][]>>;
}

const YEARS = [1901, 1931, 1961, 1991, 2041, 2071];
const SHOWN = 8;
const pct = (permille: number) => `${fixed(permille / 10, permille < 100 ? 1 : 0)}%`;

/** 氣候帶 A–E 的顏色：跟「主要氣候帶」的類別圖一樣（地圖的類別色依序取用） */
const GROUP_COLORS = MAP_TOKENS.categorical.slice(0, GROUPS.length);

const TEXT = defineMessages({
  zh: {
    title: (period: string) => `${period} 年的氣候類型`,
    scenario: (name: string) => `推估，${name}`,
    delta: (pp: string) => `比 1991–2020 年 ${pp} 個百分點`,
    same: '跟 1991–2020 年一樣',
    newType: '1991–2020 年沒有',
    rest: (n: number, share: string) => `其他 ${n} 類，共 ${share}`,
    groups: '氣候帶的面積比例',
    sep: '、',
    none: '這個國家太小，0.1° 網格沒有格子落在國界內。',
    note: '依 0.1° 格子的面積（依緯度加權）。滑到一種類型時，地圖只亮那一類。百分點是跟 1991–2020 年比的增減；2041 年以後是推估，依上面選的排放情境。',
  },
  en: {
    title: (period) => `Climate types, ${period}`,
    scenario: (name) => `projection, ${name}`,
    delta: (pp) => `${pp} points vs 1991–2020`,
    same: 'same as 1991–2020',
    newType: 'not present in 1991–2020',
    rest: (n, share) => `${n} other ${n === 1 ? 'type' : 'types'}, ${share} in all`,
    groups: 'Share of each climate group',
    sep: ', ',
    none: 'This country is too small for the 0.1° grid: no cell centre falls inside it.',
    note: 'By the area of 0.1° cells (weighted by latitude). Hover over a type to show only that type on the map. Points are the change from 1991–2020; from 2041 on, projections under the emissions scenario chosen above.',
  },
});

export default function KoppenPanel({ topic, iso3, year, item }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<PanelData>(`topics/${topic.id}/panel.json`);
  // 滑到類型時地圖只亮那一類；換國家、關掉側欄時還原
  useEffect(() => () => setClassGridOnly(null), [iso3]);
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;

  const own = data.countries[iso3];
  const scenario = item ?? topic.dimension?.defaultOption ?? 'ssp245';
  const rows = own?.[periodKey(year, scenario)] ?? [];
  const base = new Map(own?.[String(BASE_PERIOD)] ?? []);
  const shown = rows.slice(0, SHOWN);
  const rest = rows.slice(SHOWN);
  const restShare = rest.reduce((sum, [, v]) => sum + v, 0);
  const max = rows[0]?.[1] ?? 1;
  const scenarioName = topic.dimension?.options.find((o) => o.id === scenario)?.label ?? scenario;

  const groupShares = (key: string) => {
    const g = [0, 0, 0, 0, 0];
    for (const [code, v] of own?.[key] ?? []) g[CLASSES[code - 1].group - 1] += v;
    return g;
  };

  if (!own) return <p className="note">{text.none}</p>;

  return (
    <>
      <section className="panel-section">
        <h3>{text.title(periodText(year))}</h3>
        {year > BASE_PERIOD + 29 && <p className="panel-year-note">{text.scenario(scenarioName)}</p>}
        <ul className="bar-list">
          {shown.map(([code, v]) => {
            const c = CLASSES[code - 1];
            const was = base.get(code);
            const diff = was === undefined ? null : (v - was) / 10;
            const change =
              year === BASE_PERIOD
                ? null
                : was === undefined
                  ? text.newType
                  : Math.abs(diff!) < 0.05
                    ? text.same
                    : text.delta(`${diff! > 0 ? '+' : '−'}${fixed(Math.abs(diff!), 1)}`);
            return (
              <li
                key={code}
                title={change ?? undefined}
                onPointerEnter={() => setClassGridOnly(code)}
                onPointerLeave={() => setClassGridOnly(null)}
              >
                <span className="bar-label">
                  <span className="bar-key" style={{ background: c.color }} />
                  <strong translate="no">{c.symbol}</strong> {c.label[lang]}
                </span>
                <span className="bar-value">{pct(v)}</span>
                <span className="bar-track" aria-hidden="true">
                  <span className="bar-fill" style={{ width: `${(v / max) * 100}%`, background: c.color }} />
                </span>
                {change && <span className="koppen-change">{change}</span>}
              </li>
            );
          })}
        </ul>
        {rest.length > 0 && <p className="note">{text.rest(rest.length, pct(restShare))}</p>}
      </section>
      <section className="panel-section">
        <h3>{text.groups}</h3>
        <div className="stack-bars">
          {YEARS.map((y) => {
            const key = periodKey(y, scenario);
            const g = groupShares(key);
            return (
              <div key={y} className={`stack-bar-row${y === year ? ' is-current' : ''}`}>
                <span>{periodText(y)}</span>
                <span className="stack-bar" role="img" aria-label={GROUPS.map((gr, i) => `${gr.letter} ${pct(g[i])}`).join(text.sep)}>
                  {g.map((v, i) =>
                    v > 0 ? (
                      <span
                        key={i}
                        title={`${GROUPS[i].letter} ${GROUPS[i].label[lang]} ${pct(v)}`}
                        style={{ width: `${v / 10}%`, background: GROUP_COLORS[i] }}
                      />
                    ) : null,
                  )}
                </span>
              </div>
            );
          })}
        </div>
        <p className="koppen-groups">
          {GROUPS.map((g, i) => (
            <span key={g.letter}>
              <span className="bar-key" style={{ background: GROUP_COLORS[i] }} />
              {g.letter} {g.label[lang]}
            </span>
          ))}
        </p>
        <p className="note">{text.note}</p>
      </section>
    </>
  );
}
