import { useEffect } from 'react';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useCountryPart } from '../../lib/data';
import { fixed } from '../../lib/format';
import { discharge, km, km2, OCEAN, OCEAN_FILLS, OCEAN_NAMES, RIVERS } from '../rivers';
import type { PanelExtraProps } from '../types';

/**
 * 側欄的資料依國家分檔（pipeline/panel_parts.py 的 river_parts，panel/<ISO3>.json，2026-10-31；原本整份 200 KB）：
 * 這一國的流域統計，加上它前幾大河流系統的資料
 */
interface RiversPanelData {
  country: CountryRivers;
  systems: Record<string, RiverSystem>;
}

interface CountryRivers {
  /** 有河道經過的面積（km²），比例的分母 */
  km2: number;
  /** 太平洋、大西洋、印度洋、北冰洋、內流區、南冰洋的比例（%） */
  share: number[];
  /** 國內面積最大的河流系統：[系統編號, 國內的面積 km²] */
  top: [number, number][];
  /** 國內有幾個河流系統（1 km² 以上） */
  n: number;
}

interface RiverSystem {
  zh: string | null;
  en: string | null;
  ocean: number;
  seaZh: string | null;
  seaEn: string | null;
  /** 全流域的集水面積（km²）、河口的平均流量（m³/s）、最長的河道（km） */
  A: number;
  Q: number;
  L: number;
  /** 範圍 [西, 南, 東, 北] */
  box: [number, number, number, number];
}

const SHARE_ORDER = [OCEAN.pacific, OCEAN.atlantic, OCEAN.indian, OCEAN.arctic, OCEAN.endorheic];

const pct = (v: number) => `${fixed(v, v > 0 && v < 1 ? 1 : 0)}%`;

const TEXT = defineMessages({
  zh: {
    shareTitle: '國土的河流流向哪裡',
    shareAria: (country: string, parts: string[]) => `${country}的國土流向各大洋的比例：${parts.join('、')}`,
    shareNote: (area: string) => `以 HydroRIVERS 的河道經過的 ${area} 計算（每段河道的集水面積算給它所在的國家）。`,
    systemsTitle: '國內最大的河流系統',
    systemsNote: (n: number) =>
      `依國內的流域面積排列（共 ${fixed(n, 0)} 個河流系統）。滑到名稱上會在地圖上標出整個水系，點一下把地圖移過去。`,
    unnamed: (where: string) => `未命名的河（${where}）`,
    inCountry: (area: string, total: string) => `國內 ${area}・全流域 ${total}`,
    stats: (q: string, l: string) => `河口平均流量 ${q}・最長 ${l}`,
    drains: (ocean: string, sea: string | null) => (sea ? `流入${ocean}・${sea}` : `流入${ocean}`),
    inland: '內流區',
    sep: '・',
  },
  en: {
    shareTitle: 'Where the land drains',
    shareAria: (country, parts) => `Share of ${country}'s land draining to each ocean: ${parts.join(', ')}`,
    shareNote: (area) => `Out of the ${area} drained by HydroRIVERS reaches (each reach’s catchment counts for the country it lies in).`,
    systemsTitle: 'Largest river systems in the country',
    systemsNote: (n) =>
      `By basin area inside the country (${fixed(n, 0)} river systems in all). Hover over a name to highlight the whole system on the map; click to move there.`,
    unnamed: (where) => `Unnamed river (${where})`,
    inCountry: (area, total) => `${area} here · ${total} in all`,
    stats: (q, l) => `Mean flow at mouth ${q} · longest ${l}`,
    drains: (ocean, sea) => (sea ? `To the ${ocean} · ${sea}` : `To the ${ocean}`),
    inland: 'Inland basin',
    sep: ' · ',
  },
});

export default function RiversPanel({ topic, iso3, countryName, highlightLine, focusBox }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { part: data, loading } = useCountryPart<RiversPanelData>(`topics/${topic.id}/panel`, iso3);
  const country = data?.country;
  // 換國家、關掉側欄時取消標出的水系
  useEffect(() => () => highlightLine?.(RIVERS.id, null), [iso3, highlightLine]);

  if (loading) return <p className="empty">{t.loading}</p>;
  if (!country) return null;

  const shares = SHARE_ORDER.map((code, i) => ({ code, value: country.share[i] ?? 0 })).filter((s) => s.value > 0);
  const where = (s: RiverSystem) =>
    s.ocean === OCEAN.endorheic
      ? text.inland
      : text.drains(tr(OCEAN_NAMES[s.ocean], lang), lang === 'en' ? s.seaEn : s.seaZh);

  return (
    <section className="panel-section">
      <h3>{text.shareTitle}</h3>
      <div
        className="river-share"
        role="img"
        aria-label={text.shareAria(
          countryName,
          shares.map((s) => `${tr(OCEAN_NAMES[s.code], lang)} ${pct(s.value)}`),
        )}
      >
        {shares.map((s) => (
          <span key={s.code} style={{ width: `${s.value}%`, background: OCEAN_FILLS[s.code] }} />
        ))}
      </div>
      <ul className="river-share-keys">
        {shares.map((s) => (
          <li key={s.code}>
            <span className="bar-key" style={{ background: OCEAN_FILLS[s.code] }} />
            {tr(OCEAN_NAMES[s.code], lang)} <strong>{pct(s.value)}</strong>
          </li>
        ))}
      </ul>
      <p className="note">{text.shareNote(km2(country.km2))}</p>

      {country.top.length > 0 && (
        <>
          <h3>{text.systemsTitle}</h3>
          <ol className="river-systems">
            {country.top.map(([g, area]) => {
              const s = data!.systems[String(g)];
              if (!s) return null;
              const name = lang === 'en' ? (s.en ?? s.zh) : (s.zh ?? s.en);
              const show = () => highlightLine?.(RIVERS.id, g);
              const hide = () => highlightLine?.(RIVERS.id, null);
              return (
                <li key={g}>
                  <button
                    type="button"
                    className="river-system"
                    onMouseEnter={show}
                    onMouseLeave={hide}
                    onFocus={show}
                    onBlur={hide}
                    onClick={() => {
                      show();
                      focusBox?.(s.box);
                    }}
                  >
                    <span className="bar-key" style={{ background: OCEAN_FILLS[s.ocean] }} />
                    <span className="river-system-name">{name ?? text.unnamed(where(s))}</span>
                    <span className="stat-meta">
                      {name ? `${where(s)}${text.sep}` : ''}
                      {text.inCountry(km2(area), km2(s.A))}
                    </span>
                    <span className="stat-meta">{text.stats(discharge(s.Q), km(s.L))}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="note">{text.systemsNote(country.n)}</p>
        </>
      )}
    </section>
  );
}

