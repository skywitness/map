import { useEffect, useState } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { formatMoment } from '../../lib/clock';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { cellLonLat, countryPeak, latestOvation, observationTime, placeText, probabilities, type CellsFile } from '../aurora';
import type { PanelExtraProps } from '../types';

/** NOAA SWPC 的行星 K 指數（最近 7 天、每 3 小時一筆），跟極光預報一樣在瀏覽器裡即時讀 */
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';

interface KpRow {
  time_tag: string;
  Kp: number;
}

const TEXT = defineMessages({
  zh: {
    title: '此刻的預報',
    times: (forecast: string, observed: string) => `預報 ${forecast}（依 ${observed} 的太陽風觀測）`,
    kpTitle: '地磁活動（行星 K 指數）',
    kpNow: (kp: string, when: string, level: string) => `最近一筆 Kp ${kp}（${when}）：${level}`,
    kpMax: (kp: string) => `過去 24 小時最高 Kp ${kp}`,
    kpNote: 'Kp 是全球地磁擾動的強度（0–9，每 3 小時一筆）：越大，極光橢圓帶越往低緯度擴大；5 以上是磁暴（G1–G5）。',
    kpLoading: '讀取 NOAA 的 Kp 指數中…',
    kpFailed: '讀不到 NOAA 的 Kp 指數。',
    levels: ['平靜', '平靜', '平靜', '稍微活躍', '活躍', '小型磁暴（G1）', '中型磁暴（G2）', '強烈磁暴（G3）', '劇烈磁暴（G4）', '極端磁暴（G5）'],
    here: (name: string) => `${name}上空`,
    peak: (v: string, where: string) => `國土上空最高 ${v}（${where}）`,
    none: '此刻國土上空都看不到極光（機率 0%）。',
    capital: (v: string) => `首都上空 ${v}`,
    low: '國土都在南、北緯 35° 以內，看不到極光：極光橢圓帶繞著南北磁極，即使是大磁暴也很少到緯度 40° 以下。',
    go: '移到機率最高的地方',
    tip: (dir: string) => `想看極光：要在晚上、天氣晴朗、遠離光害的地方，往${dir}方的天空看。`,
    north: '北',
    south: '南',
  },
  en: {
    title: 'The current forecast',
    times: (forecast, observed) => `Forecast for ${forecast} (from solar-wind data at ${observed})`,
    kpTitle: 'Geomagnetic activity (planetary K-index)',
    kpNow: (kp, when, level) => `Latest Kp ${kp} (${when}): ${level}`,
    kpMax: (kp) => `Highest Kp in the past 24 hours: ${kp}`,
    kpNote: 'Kp measures global geomagnetic disturbance (0–9, every 3 hours): the higher it is, the further the auroral oval spreads towards the equator; 5 or more is a geomagnetic storm (G1–G5).',
    kpLoading: 'Loading the Kp index from NOAA…',
    kpFailed: 'Could not load the Kp index from NOAA.',
    levels: ['quiet', 'quiet', 'quiet', 'unsettled', 'active', 'minor storm (G1)', 'moderate storm (G2)', 'strong storm (G3)', 'severe storm (G4)', 'extreme storm (G5)'],
    here: (name) => `Over ${name}`,
    peak: (v, where) => `Highest over the country: ${v} (${where})`,
    none: 'No aurora over the country right now (0%).',
    capital: (v) => `Over the capital: ${v}`,
    low: 'The country lies entirely within 35° of the equator, so it does not see the aurora: the auroral ovals ring the magnetic poles and rarely reach below 40° latitude even in big storms.',
    go: 'Go to the highest probability',
    tip: (dir) => `To see the aurora: go out at night, under clear skies away from city lights, and look towards the ${dir}.`,
    north: 'north',
    south: 'south',
  },
});

/** Kp 的數值照 NOAA 的小數取到一位（4.33 → 4.3），不用 4+、5− 的寫法 */
const kpText = (v: number) => fixed(v, v % 1 ? 1 : 0);

function useKp(): { rows: KpRow[] | null; error: boolean } {
  const [state, setState] = useState<{ rows: KpRow[] | null; error: boolean }>({ rows: null, error: false });
  useEffect(() => {
    let cancelled = false;
    fetch(KP_URL, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<KpRow[]>;
      })
      .then(
        (rows) => !cancelled && setState({ rows: rows.filter((r) => Number.isFinite(r.Kp)), error: false }),
        () => !cancelled && setState({ rows: null, error: true }),
      );
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export default function AuroraPanel({ iso3, countryName, at, focusBox }: PanelExtraProps) {
  const t = useT();
  const text = TEXT[useLang()];
  const cells = useJson<CellsFile>('topics/aurora/cells.json').data;
  const kp = useKp();
  // at 是預報的時刻：每次重讀到新的預報就換，側欄跟著重畫
  const live = latestOvation();
  const prob = probabilities(live);
  if (!cells || !prob || !at) return <p className="empty">{t.loading}</p>;

  const observed = observationTime(live);
  const peak = countryPeak(cells, prob, iso3);
  const capitalCell = cells.capitals[iso3];
  const lastKp = kp.rows?.[kp.rows.length - 1];
  const dayAgo = at.time - 24 * 3600_000;
  const recent = kp.rows?.filter((r) => Date.parse(`${r.time_tag}Z`) >= dayAgo) ?? [];
  const maxKp = recent.length ? Math.max(...recent.map((r) => r.Kp)) : null;
  const peakLonLat = peak ? cellLonLat(peak[1]) : null;

  return (
    <>
      <section className="panel-section">
        <h3>{text.title}</h3>
        <p className="note">{text.times(formatMoment(at.time), observed ? formatMoment(observed) : '—')}</p>
        <p className="antipode-summary">{text.here(countryName)}</p>
        {!peak && <p>{text.low}</p>}
        {peak && peak[0] === 0 && <p>{text.none}</p>}
        {peak && peak[0] > 0 && peakLonLat && (
          <>
            <p>{text.peak(`${Math.round(peak[0])}%`, placeText(peakLonLat[0], peakLonLat[1]))}</p>
            <button
              type="button"
              className="antipode-go"
              onClick={() => focusBox?.([peakLonLat[0] - 8, peakLonLat[1] - 5, peakLonLat[0] + 8, peakLonLat[1] + 5])}
            >
              {text.go}
            </button>
          </>
        )}
        {peak && capitalCell !== undefined && <p>{text.capital(`${Math.round(prob[capitalCell])}%`)}</p>}
        {peak && <p className="note">{text.tip(peakLonLat && peakLonLat[1] < 0 ? text.south : text.north)}</p>}
      </section>
      <section className="panel-section">
        <h3>{text.kpTitle}</h3>
        {!kp.rows && !kp.error && <p className="note">{text.kpLoading}</p>}
        {kp.error && <p className="note">{text.kpFailed}</p>}
        {lastKp && (
          <p>
            {text.kpNow(
              kpText(lastKp.Kp),
              formatMoment(Date.parse(`${lastKp.time_tag}Z`)),
              text.levels[Math.min(9, Math.max(0, Math.floor(lastKp.Kp + 0.34)))],
            )}
          </p>
        )}
        {maxKp !== null && <p>{text.kpMax(kpText(maxKp))}</p>}
        <p className="note">{text.kpNote}</p>
      </section>
    </>
  );
}
