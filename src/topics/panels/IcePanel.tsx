import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { extentText } from '../ice';
import type { PanelExtraProps } from '../types';

/**
 * pipeline/topics/ice.py 的 panel.json：每國的冰河數與面積、沿海的海平面格子數、全球海洋的平均上升速度、
 * 全球冰河的累計變化（Gt、mm 海平面，1976 年起）、每年 9 月北極與 2 月南極的海冰範圍（百萬 km²）
 */
interface PanelData {
  glaciers: Record<string, { n: number; area: number }>;
  /** [沿海的平均上升速度 mm/年, 格子數] */
  coastal: Record<string, [number, number]>;
  globalRate: number;
  global: { years: number[]; gt: number[]; mmsle: number[] };
  seaIce: Record<'N' | 'S', Record<string, number>>;
}

const n0 = (v: number) => fixed(v, 0);

const TEXT = defineMessages({
  zh: {
    glaciers: '冰河',
    count: (n: number, area: string) => `${n0(n)} 條冰河，共 ${area} km²（RGI 6.0 的輪廓）`,
    none: '沒有冰河。',
    world: (year: number, gt: string, mm: string) =>
      `全世界的冰河 1976–${year} 年共少了 ${gt} Gt，讓海平面上升約 ${mm} mm（WGMS）。`,
    seaIce: (year: number) => `${year} 年的海冰`,
    arctic: '北極 9 月',
    antarctic: '南極 2 月',
    versus: (first: string, low: string, lowYear: number) => `1979 年 ${first}；最少的一年是 ${lowYear} 年（${low}）`,
    noIce: '這一年還沒有資料。',
    seaLevel: '海平面（1993–2025）',
    rate: (v: string) => `沿海每年上升 ${v} mm`,
    coastal: (n: number) => `沿海的平均用了 ${n0(n)} 個 0.5° 格子（離國界 200 公里以內的海）。`,
    landlocked: '內陸國，沒有沿海的海。',
    global: (v: string) => `全球海洋格子的平均每年上升約 ${v} mm。`,
  },
  en: {
    glaciers: 'Glaciers',
    count: (n, area) => `${n0(n)} ${n === 1 ? 'glacier' : 'glaciers'} covering ${area} km² (RGI 6.0 outlines)`,
    none: 'No glaciers.',
    world: (year, gt, mm) => `The world’s glaciers lost ${gt} Gt from 1976 to ${year}, raising sea level by about ${mm} mm (WGMS).`,
    seaIce: (year) => `Sea ice in ${year}`,
    arctic: 'Arctic, September',
    antarctic: 'Antarctic, February',
    versus: (first, low, lowYear) => `${first} in 1979; lowest in ${lowYear} (${low})`,
    noIce: 'No data for this year yet.',
    seaLevel: 'Sea level (1993–2025)',
    rate: (v) => `Coastal sea level rises ${v} mm a year`,
    coastal: (n) => `The coastal average uses ${n0(n)} cells of 0.5° (sea within 200 km of the country).`,
    landlocked: 'Landlocked: no coastal waters.',
    global: (v) => `Sea level over all ocean cells rises about ${v} mm a year on average.`,
  },
});

export default function IcePanel({ topic, indicator, iso3, year }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<PanelData>(`topics/${topic.id}/panel.json`);
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;

  const own = data.glaciers[iso3];
  const g = data.global;
  // 冰河到 2025 年；海冰的時間軸可能到今年，全球冰河取最後一年
  const gi = Math.min(g.years.length - 1, Math.max(0, g.years.indexOf(Math.min(year, g.years[g.years.length - 1]))));
  const iceYear = indicator.id === 'sea-level' ? Number(Object.keys(data.seaIce.N).pop()) : year;

  const iceRow = (h: 'N' | 'S', label: string) => {
    const series = data.seaIce[h];
    const v = series[String(iceYear)];
    const entries = Object.entries(series).map(([y, e]) => [Number(y), e] as const);
    const low = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
    return (
      <>
        <dt>{label}</dt>
        <dd>
          {v === undefined ? (
            text.noIce
          ) : (
            <>
              <strong>{extentText(v)}</strong> · {text.versus(extentText(series['1979']), extentText(low[1]), low[0])}
            </>
          )}
        </dd>
      </>
    );
  };

  const glacierSection = (
    <section className="panel-section">
      <h3>{text.glaciers}</h3>
      {own ? <p className="panel-year-note">{text.count(own.n, fixed(own.area, own.area < 100 ? 1 : 0))}</p> : <p>{text.none}</p>}
      <p className="note">{text.world(g.years[gi], n0(-g.gt[gi]), fixed(g.mmsle[gi], 0))}</p>
    </section>
  );
  const iceSection = (
    <section className="panel-section">
      <h3>{text.seaIce(iceYear)}</h3>
      <dl className="eclipse-facts">
        {iceRow('N', text.arctic)}
        {iceRow('S', text.antarctic)}
      </dl>
    </section>
  );
  const coastal = data.coastal[iso3];
  const seaSection = (
    <section className="panel-section">
      <h3>{text.seaLevel}</h3>
      {coastal && <p className="antipode-summary">{text.rate(fixed(coastal[0], 2))}</p>}
      <p className="note">{coastal ? text.coastal(coastal[1]) : text.landlocked}</p>
      <p className="note">{text.global(fixed(data.globalRate, 1))}</p>
    </section>
  );

  // 目前的指標放在最前面
  if (indicator.id === 'sea-ice') return (<>{iceSection}{glacierSection}{seaSection}</>);
  if (indicator.id === 'sea-level') return (<>{seaSection}{glacierSection}{iceSection}</>);
  return (<>{glacierSection}{iceSection}{seaSection}</>);
}
