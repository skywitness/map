import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { monthName, windName } from '../wind';
import type { PanelExtraProps } from '../types';

/**
 * pipeline/topics/wind.py 的 panel.json：各國 12 個月的 [風速（每天風速的平均，m/s）, 平均風向（風從哪個方位吹來，
 * 16 方位）, 向量平均的風速]。向量平均 ÷ 風速是風向的穩定度：季風、信風接近 1，風向常變的地方接近 0
 */
interface PanelFile {
  countries: Record<string, [number, number, number][]>;
}

/** 穩定度低於這個值不寫風向（每天的風向差很多，平均的方向沒有意義） */
const STEADY_MIN = 0.25;

const TEXT = defineMessages({
  zh: {
    title: '每個月的風（1991–2020 年平均）',
    month: '月份',
    wind: '平均風向',
    speed: '風速',
    variable: '風向不定',
    steady: (p: number) => `穩定度 ${p}%`,
    reverse: (a: string, b: string, deg: number) => `1 月吹${a}、7 月吹${b}，風向相差約 ${deg}°：冬夏換方向的季風。`,
    same: (a: string) => `1 月與 7 月都吹${a}。`,
    none: '這個國家沒有資料。',
    note: '風向是風「吹來」的方向（東北風是從東北吹向西南），箭頭指向風吹去的方向。穩定度是每天的風合起來的平均（向量）有每天風速的幾成：季風、信風接近 100%，風向常變的地方很低（低於 25% 不寫風向）。點月份換到那個月。',
  },
  en: {
    title: 'Winds by month (1991–2020 average)',
    month: 'Month',
    wind: 'Prevailing wind',
    speed: 'Speed',
    variable: 'variable',
    steady: (p) => `${p}% steady`,
    reverse: (a, b, deg) => `${a} in January and ${b} in July, about ${deg}° apart: a monsoon that turns with the seasons.`,
    same: (a) => `${a} in both January and July.`,
    none: 'No data for this country.',
    note: 'Wind direction is where the wind comes from (a north-east wind blows from the north-east towards the south-west); the arrow points where it blows to. Steadiness is the average wind vector as a share of the average daily speed: close to 100% for monsoons and trade winds, low where the direction keeps changing (below 25% no direction is given). Click a month to switch to it.',
  },
});

export default function WindPanel({ topic, iso3, year, selectYear }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const t = useT();
  const { data, error } = useJson<PanelFile>(`topics/${topic.id}/panel.json`);
  if (error) return <p className="empty">{t.loadFailed(error.message)}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  const months = data.countries[iso3];
  if (!months) return <p className="note">{text.none}</p>;

  const steady = (m: [number, number, number]) => (m[0] > 0 ? m[2] / m[0] : 0);
  const [jan, jul] = [months[0], months[6]];
  let summary: string | null = null;
  if (jan && jul && steady(jan) >= STEADY_MIN && steady(jul) >= STEADY_MIN) {
    const diff = Math.min(Math.abs(jan[1] - jul[1]), 16 - Math.abs(jan[1] - jul[1])) * 22.5;
    if (diff >= 90) summary = text.reverse(windName(jan[1]), windName(jul[1]), Math.round(diff));
    else if (diff === 0) summary = text.same(windName(jan[1]));
  }

  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {summary && <p className="wind-summary">{summary}</p>}
      <table className="wind-table">
        <thead>
          <tr>
            <th scope="col">{text.month}</th>
            <th scope="col">{text.wind}</th>
            <th scope="col" className="num">
              {text.speed}
            </th>
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => {
            const month = i + 1;
            const s = steady(m);
            const show = s >= STEADY_MIN;
            return (
              <tr key={month} className={month === year ? 'is-current' : undefined}>
                <th scope="row">
                  <button type="button" className="eclipse-more" onClick={() => selectYear?.(month)}>
                    {monthName(month)}
                  </button>
                </th>
                <td>
                  {show ? (
                    <>
                      {/* 箭頭指向風吹去的方向：風向（吹來的方位）＋ 180° */}
                      <span className="wind-arrow" aria-hidden="true" style={{ transform: `rotate(${m[1] * 22.5 + 180}deg)` }}>
                        ↑
                      </span>
                      {windName(m[1])}
                      <span className="wind-steady">{text.steady(Math.round(Math.min(1, s) * 100))}</span>
                    </>
                  ) : (
                    <span className="wind-steady">{text.variable}</span>
                  )}
                </td>
                <td className="num">{fixed(m[0], 1)} m/s</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="note">{text.note}</p>
    </section>
  );
}
