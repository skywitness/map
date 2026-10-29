import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import type { ChartSpec } from '../../charts/spec';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { useJson, useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Tokens } from '../../theme/tokens';
import { TWO_ESTIMATES } from '../height';
import type { Indicator, IndicatorData, PanelExtraProps } from '../types';

/** countries/<ISO3>.json（pipeline/topics/height.py）：95% 不確定區間，成人依出生年、19 歲依量測的年份 */
interface IntervalFile {
  cohorts: [number, number];
  years: [number, number];
  values: Record<string, (number | null)[]>;
}

/** taiwan.json：國健署國民營養健康狀況變遷調查各年齡組的實測，跟 NCD-RisC 對照 */
interface TaiwanRow {
  period: string;
  ages: string;
  born: [number, number];
  men: TaiwanCell;
  women: TaiwanCell;
}
interface TaiwanCell {
  n: number;
  mean: number;
  se: number;
  /** 這些人出生的那幾年在 2016 年估計裡 18 歲時的平均 */
  cohort?: { mean: number; born: [number, number] };
  /** 2020 年估計裡同一段時間、同一個年齡組的平均（16–18 歲） */
  sameAge?: { mean: number; years: [number, number] };
}
interface TaiwanFile {
  rows: TaiwanRow[];
}

type Sex = 'men' | 'women';
const SEXES: Sex[] = ['men', 'women'];

const TEXT = defineMessages({
  zh: {
    title: '男女的平均身高',
    sex: { men: '男性', women: '女性' } as Record<Sex, string>,
    world: { men: '世界男性', women: '世界女性' } as Record<Sex, string>,
    adultHead: '依出生年（18 歲時的身高）',
    adultAria: (country: string) => `${country} 1896–1996 年出生的男女在 18 歲時的平均身高，虛線是世界平均`,
    part: (sex: string, v: number, lo: number, hi: number) =>
      `${sex} ${fixed(v, 1)} 公分（95% 不確定區間 ${fixed(lo, 1)}–${fixed(hi, 1)}）`,
    born: (year: number, parts: string[]) => `${year} 年出生：${parts.join('；')}。`,
    gap: (g: number) => `男性高 ${fixed(g, 1)} 公分`,
    century: (men: number, women: number) =>
      `比 1896 年出生的男性${men >= 0 ? '高' : '矮'} ${fixed(Math.abs(men), 1)}、女性${women >= 0 ? '高' : '矮'} ${fixed(Math.abs(women), 1)} 公分`,
    worldAvg: (men: number, women: number) => `世界平均男性 ${fixed(men, 1)}、女性 ${fixed(women, 1)} 公分`,
    worldNote:
      '虛線是世界平均（用 WPP 的人口加權）：1970 年代出生以後大致持平、最近略降，因為人口成長集中在身高較矮的南亞與非洲；用 1950 年的人口當固定權重，1960 → 1996 年出生的男性多 1.7 公分。',
    teenHead: '19 歲的身高（依量測的年份）',
    teenAria: (country: string) => `${country} 1985–2019 年 19 歲男女的平均身高，虛線是世界平均`,
    teen: (year: number, parts: string[]) => `${year} 年 19 歲：${parts.join('；')}。`,
    twTitle: '跟國健署的實測對照',
    twCaption: '國健署國民營養健康狀況變遷調查各年齡組實際量的平均身高，與 NCD-RisC 的估計（公分）',
    colSurvey: '調查',
    colAges: '年齡',
    cell: (measured: number, ncd: number | undefined) => `${fixed(measured, 1)}／${ncd === undefined ? '—' : fixed(ncd, 1)}`,
    ages: (ages: string) => `${ages.replace('-', '–')} 歲`,
    period: (period: string) => period.replace('-', '–'),
    twNote:
      '斜線前是國健署國民營養健康狀況變遷調查實際量的平均（標準誤 0.25–0.67 公分），斜線後是 NCD-RisC：16–18 歲是 2020 年的估計在同一段時間（到 2019 年）16–18 歲的平均，可以直接比；19 歲以上是這些人出生的那幾年（例如 2017–2020 年 19–44 歲約是 1973–2001 年出生，資料只到 1996 年）在 2016 年的估計裡 18 歲時的平均。調查是同一段時間量不同年齡的人，量到的是現在的身高，年紀大的人會變矮（NCD-RisC 的模型估計每老 10 歲，男性矮 0.2、女性矮 0.3 公分），所以年紀越大的組差得越多。',
  },
  en: {
    title: 'Heights of men and women',
    sex: { men: 'Men', women: 'Women' },
    world: { men: 'World, men', women: 'World, women' },
    adultHead: 'By year of birth (height at 18)',
    adultAria: (country) => `Mean height at 18 of men and women born in ${country} from 1896 to 1996, with the world average as dashed lines`,
    part: (sex, v, lo, hi) => `${sex.toLowerCase()} ${fixed(v, 1)} cm (95% uncertainty interval ${fixed(lo, 1)}–${fixed(hi, 1)})`,
    born: (year, parts) => `Born in ${year}: ${parts.join('; ')}.`,
    gap: (g) => `men ${fixed(g, 1)} cm taller`,
    century: (men, women) =>
      `${fixed(Math.abs(men), 1)} cm ${men >= 0 ? 'taller' : 'shorter'} (men) and ${fixed(Math.abs(women), 1)} cm ${women >= 0 ? 'taller' : 'shorter'} (women) than those born in 1896`,
    worldAvg: (men, women) => `world average ${fixed(men, 1)} cm for men and ${fixed(women, 1)} cm for women`,
    worldNote:
      'Dashed lines are the world average (weighted by WPP population): roughly flat for those born since the 1970s and slightly down lately, because population growth is concentrated in South Asia and Africa, where people are shorter. With fixed 1950 population weights, men born in 1996 are 1.7 cm taller than those born in 1960.',
    teenHead: 'Height at 19 (by year of measurement)',
    teenAria: (country) => `Mean height of 19-year-old men and women in ${country}, 1985–2019, with the world average as dashed lines`,
    teen: (year, parts) => `Aged 19 in ${year}: ${parts.join('; ')}.`,
    twTitle: 'Compared with measured heights in Taiwan',
    twCaption: "Mean heights measured by age group in the Health Promotion Administration's Nutrition and Health Survey in Taiwan, and NCD-RisC's estimates (cm)",
    colSurvey: 'Survey',
    colAges: 'Ages',
    cell: (measured, ncd) => `${fixed(measured, 1)} / ${ncd === undefined ? '—' : fixed(ncd, 1)}`,
    ages: (ages) => ages.replace('-', '–'),
    period: (period) => period.replace('-', '–'),
    twNote:
      "Before the slash: the mean measured by the Health Promotion Administration's Nutrition and Health Survey in Taiwan (standard errors 0.25–0.67 cm). After it: NCD-RisC. For ages 16–18 this is the 2020 estimate for the same ages over the same years (up to 2019), which compares directly; for 19 and over it is the average height at 18, in the 2016 estimate, of the years these people were born (those aged 19–44 in 2017–2020 were born around 1973–2001; the data end at 1996). The survey measures people of different ages at the same time and records their current height, and people lose height as they age (NCD-RisC's model puts it at 0.2 cm for men and 0.3 cm for women per decade), so the gap widens in the older groups.",
  },
});

/** 身高在 140–185 公分之間：y 軸不從 0 開始，起伏才看得出來 */
function zoomY(option: ChartSpec): ChartSpec {
  return { ...option, y: { ...option.y, zero: false } };
}

/** 世界平均畫細一點的虛線（圖例也畫成虛線） */
function dashWorld(option: ChartSpec, worldNames: string[]): ChartSpec {
  return {
    ...option,
    series: option.series.map((s) => (s.type === 'line' && worldNames.includes(s.name) ? { ...s, dashed: true, width: 1.5 } : s)),
  };
}

function chart(
  years: number[],
  own: Record<Sex, (number | null)[]>,
  world: Record<Sex, (number | null)[]>,
  year: number,
  indicator: Indicator,
  tokens: Tokens,
  text: (typeof TEXT)['zh'],
): ChartSpec {
  const color: Record<Sex, string> = { men: tokens.hues.blue, women: tokens.hues.orange };
  const lines = [
    ...SEXES.map((s) => ({ name: text.sex[s], values: own[s], color: color[s] })),
    ...SEXES.map((s) => ({ name: text.world[s], values: world[s], color: color[s] })),
  ];
  return dashWorld(
    zoomY(timeSeriesOption({ years, lines, year, indicator, tokens })),
    SEXES.map((s) => text.world[s]),
  );
}

export default function HeightPanel({ topic, indicator, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const files = useMemo(
    () => ['men', 'women', 'men-19', 'women-19'].map((f) => `topics/${topic.id}/${f}.json`),
    [topic.id],
  );
  const loaded = useJsonMany<IndicatorData>(files);
  const own = loaded[0]?.values[iso3];
  const intervals = useJson<IntervalFile>(own ? `topics/${topic.id}/countries/${iso3}.json` : null).data;
  const taiwan = useJson<TaiwanFile>(iso3 === 'TWN' ? `topics/${topic.id}/taiwan.json` : null).data;

  const view = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const [men, women, men19, women19] = loaded as IndicatorData[];
    if (!men.values[iso3] || !women.values[iso3]) return null;
    const adultIndicator = topic.indicators.find((i) => i.id === 'men')!;
    const byBirth = indicator.timeAxis?.label === adultIndicator.timeAxis?.label;
    // 時間軸是出生年時用那一年，19 歲的指標時用最後一年出生的（1996）；19 歲的反過來
    const clamp = (years: number[], y: number) => Math.min(years[years.length - 1], Math.max(years[0], y));
    const cohort = byBirth ? clamp(men.years, year) : men.years[men.years.length - 1];
    const measured = byBirth ? men19.years[men19.years.length - 1] : clamp(men19.years, year);

    const at = (d: IndicatorData, y: number, key = iso3) => d.values[key]?.[d.years.indexOf(y)] ?? null;
    const worldAt = (d: IndicatorData, y: number) => d.aggregates?.WLD?.[d.years.indexOf(y)] ?? null;
    const interval = (key: string, first: number, y: number) => intervals?.values[key]?.[y - first] ?? null;
    const describe = (sex: Sex, v: number | null, key: string, first: number, y: number) => {
      if (v === null) return null;
      const lo = interval(`${key}-lo`, first, y);
      const hi = interval(`${key}-hi`, first, y);
      return lo === null || hi === null ? `${text.sex[sex]} ${fixed(v, 1)}` : text.part(text.sex[sex], v, lo, hi);
    };

    const m = at(men, cohort);
    const w = at(women, cohort);
    const adultParts = [
      describe('men', m, 'men', intervals?.cohorts[0] ?? 0, cohort),
      describe('women', w, 'women', intervals?.cohorts[0] ?? 0, cohort),
    ].filter((p): p is string => p !== null);
    if (m !== null && w !== null) adultParts.push(text.gap(m - w));
    const m0 = at(men, men.years[0]);
    const w0 = at(women, women.years[0]);
    if (m !== null && w !== null && m0 !== null && w0 !== null && cohort !== men.years[0]) {
      adultParts.push(text.century(m - m0, w - w0));
    }
    const wm = worldAt(men, cohort);
    const ww = worldAt(women, cohort);
    if (wm !== null && ww !== null) adultParts.push(text.worldAvg(wm, ww));

    const teenParts = [
      describe('men', at(men19, measured), 'men-19', intervals?.years[0] ?? 0, measured),
      describe('women', at(women19, measured), 'women-19', intervals?.years[0] ?? 0, measured),
    ].filter((p): p is string => p !== null);
    const wm19 = worldAt(men19, measured);
    const ww19 = worldAt(women19, measured);
    if (wm19 !== null && ww19 !== null) teenParts.push(text.worldAvg(wm19, ww19));

    const teenIndicator = topic.indicators.find((i) => i.id === 'men-19')!;
    return {
      adultSummary: text.born(cohort, adultParts),
      adultOption: chart(
        men.years,
        { men: men.values[iso3], women: women.values[iso3] },
        { men: men.aggregates?.WLD ?? [], women: women.aggregates?.WLD ?? [] },
        cohort,
        adultIndicator,
        tokens,
        text,
      ),
      teenSummary: teenParts.length ? text.teen(measured, teenParts) : null,
      teenOption: men19.values[iso3]
        ? chart(
            men19.years,
            { men: men19.values[iso3], women: women19.values[iso3] ?? [] },
            { men: men19.aggregates?.WLD ?? [], women: women19.aggregates?.WLD ?? [] },
            measured,
            teenIndicator,
            tokens,
            text,
          )
        : null,
    };
  }, [loaded, intervals, iso3, year, indicator, topic, tokens, text]);

  if (!loaded.every(Boolean)) return <p className="empty">{t.loading}</p>;
  // 沒有資料的國家（南蘇丹、科索沃）上面的數值卡片已經寫了原因
  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <h4>{text.adultHead}</h4>
      <p className="note">{view.adultSummary}</p>
      <Chart spec={view.adultOption} height={210} ariaLabel={text.adultAria(countryName)} />
      <p className="note">{text.worldNote}</p>
      {view.teenOption && (
        <>
          <h4>{text.teenHead}</h4>
          {view.teenSummary && <p className="note">{view.teenSummary}</p>}
          <Chart spec={view.teenOption} height={190} ariaLabel={text.teenAria(countryName)} />
          <p className="note">{tr(TWO_ESTIMATES, lang)}</p>
        </>
      )}
      {taiwan && (
        <>
          <h4>{text.twTitle}</h4>
          <table className="mini-table" aria-label={text.twCaption}>
            <thead>
              <tr>
                <th scope="col">{text.colSurvey}</th>
                <th scope="col">{text.colAges}</th>
                {SEXES.map((s) => (
                  <th key={s} scope="col" className="num">
                    {text.sex[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taiwan.rows.map((r) => (
                <tr key={`${r.period}-${r.ages}`}>
                  <td>{text.period(r.period)}</td>
                  <th scope="row">{text.ages(r.ages)}</th>
                  {SEXES.map((s) => (
                    <td key={s} className="num">
                      {text.cell(r[s].mean, r[s].sameAge?.mean ?? r[s].cohort?.mean)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.twNote}</p>
        </>
      )}
    </section>
  );
}
