import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import type { Hue } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';
import InternetSpeedPanel from './InternetSpeedPanel';

/**
 * 網路速度主題的側欄（2026-11-07，第二十五批 504）：選 OECD 寬頻資料庫的指標時，先畫這一國固網寬頻依技術的比例
 * （歷年，看得到 DSL → Cable → 光纖的世代交替，與固定無線接取的成長），再接原本的測速側欄。
 * 資料是 pipeline/topics/broadband_oecd.py 輸出的 oecd/broadband-mix.json；不在 OECD 資料庫的國家只畫測速側欄
 */
interface Mix {
  years: number[];
  items: string[];
  countries: Record<string, Record<string, (number | null)[]>>;
}

/** OECD 寬頻資料庫的指標（選到這些時才畫技術的折線） */
const OECD_INDICATORS = new Set(['fixed-tech', 'fiveg', 'mobile-data', 'telecom-per-capita', 'gigabit-plans']);
const HUES: Record<string, Hue> = { fibre: 'blue', cable: 'orange', dsl: 'red', fwa: 'green', satellite: 'violet', other: 'yellow' };

const TEXT = defineMessages({
  zh: {
    title: '固網寬頻用的是哪一種技術',
    aria: (c: string) => `${c} 固網寬頻用戶依技術的比例，歷年`,
    labels: { fibre: '光纖', cable: 'Cable', dsl: 'DSL', fwa: '固定無線接取', satellite: '衛星', other: '其他' } as Record<string, string>,
    note: 'OECD 寬頻資料庫，占固網寬頻用戶的比例（%，每年年底）。',
  },
  en: {
    title: 'Which technology fixed broadband uses',
    aria: (c: string) => `Share of fixed broadband subscriptions by technology in ${c}, by year`,
    labels: { fibre: 'Fibre', cable: 'Cable', dsl: 'DSL', fwa: 'Fixed wireless', satellite: 'Satellite', other: 'Other' } as Record<string, string>,
    note: 'OECD broadband database, share of fixed broadband subscriptions (%, end of each year).',
  },
});

function MixSection({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<Mix>(`topics/${topic.id}/oecd/broadband-mix.json`);
  const own = data?.countries[iso3];
  const option = useMemo(() => {
    // 折線的刻度與 tooltip 用「固網寬頻依技術」（%），不用目前的指標（GB、美元…）
    const indicator = topic.indicators.find((i) => i.id === 'fixed-tech');
    if (!data || !own || !indicator) return null;
    const lines = data.items
      .filter((k) => own[k]?.some((v) => v != null && v > 0))
      .map((k) => ({ name: text.labels[k] ?? k, values: own[k], color: tokens.hues[HUES[k] ?? 'blue'] }));
    return timeSeriesOption({ years: data.years, lines, year: Math.min(year, data.years[data.years.length - 1]), indicator, tokens });
  }, [data, own, text, tokens, year, topic]);
  if (!option) return null;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <Chart spec={option} height={210} ariaLabel={text.aria(countryName)} />
      <p className="note">{text.note}</p>
    </section>
  );
}

export default function BroadbandPanel(props: PanelExtraProps) {
  return (
    <>
      {OECD_INDICATORS.has(props.indicator.id) && <MixSection {...props} />}
      <InternetSpeedPanel {...props} />
    </>
  );
}
