import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { timeSeriesOption } from '../../charts/timeSeries';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { formatLargeNumber } from '../../lib/format';
import type { Indicator, PanelExtraProps } from '../types';

/**
 * 國碼網域的側欄（2026-11-07，第二十五批 507）：每一國寫它的國碼網域；台灣另畫 TWNIC 的 .tw 與 .台灣 註冊數
 * （pipeline/topics/cctld.py 的 tw-domains.json，1998 年起每半年、近年每月一筆；折線取每年 12 月，今年取最新一個月）
 */
interface Domains {
  domains: Record<string, string>;
}
interface TwDomains {
  months: number[];
  domains: Record<string, (number | null)[]>;
}

/** TWNIC 資料裡的網域名稱（資料檔的 key），名稱見 TEXT 的 labels（同一個順序） */
const SHOWN = ['com.tw', 'ASCII.tw', 'idv.tw', '中文.tw', '中文.台灣']; // i18n-ignore

const TEXT = defineMessages({
  zh: {
    domain: (d: string) => `國碼網域：${d}`,
    twTitle: '.tw 與 .台灣 的註冊數',
    aria: '台灣 .tw 與 .台灣 網域註冊數，歷年',
    total: '合計',
    latest: (ym: string, total: string) => `${ym}：合計 ${total} 個`,
    note: 'TWNIC 統計（數位發展部開放資料）。ASCII.tw 是直接註冊在 .tw 底下的英文網域（例如 example.tw），2017 年底 9.2 萬個，2018 年底暴增到 418 萬個、2020 年底剩 91 萬個（資料沒寫原因）。',
    labels: ['com.tw', '英文.tw（直接註冊）', 'idv.tw（個人）', '中文.tw', '中文.台灣'],
  },
  en: {
    domain: (d: string) => `Country domain: ${d}`,
    twTitle: 'Registrations under .tw and .台灣', // i18n-ignore
    aria: 'Registrations under .tw and .台灣 in Taiwan, by year', // i18n-ignore
    total: 'Total',
    latest: (ym: string, total: string) => `${ym}: ${total} in total`,
    note: 'TWNIC statistics (Ministry of Digital Affairs open data). ASCII.tw means English names registered directly under .tw (such as example.tw): 92,000 at the end of 2017, jumping to 4.18 million at the end of 2018 and down to 911,000 by the end of 2020 (the data do not say why).',
    labels: ['com.tw', 'English names directly under .tw', 'idv.tw (personal)', 'Chinese names under .tw', 'Chinese names under .台灣'], // i18n-ignore
  },
});

const HUES = ['blue', 'orange', 'green', 'violet', 'aqua'] as const;

function Taiwan({ topic, year, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<TwDomains>(`topics/${topic.id}/tw-domains.json`);
  const view = useMemo(() => {
    if (!data) return null;
    // 每年取 12 月；最後一年取最新的月份
    const picks = new Map<number, number>();
    data.months.forEach((m, i) => {
      const y = Math.floor(m / 100);
      if (m % 100 === 12 || i === data.months.length - 1) picks.set(y, i);
    });
    const years = [...picks.keys()];
    const at = (s: (number | null)[]) => years.map((y) => s[picks.get(y)!] ?? null);
    const total = years.map((y) => Object.values(data.domains).reduce<number>((a, s) => a + (s[picks.get(y)!] ?? 0), 0));
    const indicator: Pick<Indicator, 'format' | 'formatTick' | 'layer' | 'integer'> = {
      format: (v: number) => formatLargeNumber(v),
      formatTick: (v: number) => formatLargeNumber(v),
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1] } },
      integer: true,
    };
    const option = timeSeriesOption({
      years,
      lines: [
        { name: text.total, values: total, color: tokens.inkSecondary },
        ...SHOWN.map((d, i) => ({ name: text.labels[i] ?? d, values: at(data.domains[d] ?? []), color: tokens.hues[HUES[i]] })),
      ],
      year: Math.min(year, years[years.length - 1]),
      indicator: indicator as Indicator,
      tokens,
    });
    const last = data.months[data.months.length - 1];
    const latestTotal = Object.values(data.domains).reduce<number>((a, s) => a + (s[s.length - 1] ?? 0), 0);
    return { option, last: `${Math.floor(last / 100)}-${String(last % 100).padStart(2, '0')}`, latestTotal };
  }, [data, text, tokens, year]);
  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.twTitle}</h3>
      <p className="note">{text.latest(view.last, formatLargeNumber(view.latestTotal))}</p>
      <Chart spec={view.option} height={220} ariaLabel={text.aria} />
      <p className="note">{text.note}</p>
    </section>
  );
}

export default function CctldPanel(props: PanelExtraProps) {
  const text = TEXT[useLang()];
  const { data } = useJson<Domains>(`topics/${props.topic.id}/cctld.json`);
  const domain = data?.domains[props.iso3];
  return (
    <>
      {domain && (
        <section className="panel-section">
          <h3>{text.domain(domain)}</h3>
        </section>
      )}
      {props.iso3 === 'TWN' && <Taiwan {...props} />}
    </>
  );
}
