import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { EChart, type ChartOption } from '../../charts/EChart';
import { timeSeriesOption, type TimeSeriesLine } from '../../charts/timeSeries';
import { defineMessages, useLang, useT } from '../../i18n';
import { countryName as nameOf, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { formatLargeNumber, formatPercent, usd } from '../../lib/format';
import { flowSelection } from '../../map/flows';
import type { FlowFile, Indicator, IndicatorData, PanelExtraProps } from '../types';

/**
 * 國際援助與僑匯的側欄（pipeline/topics/aid.py）：
 * - 援助國：主要援助對象（流向檔的 export）、沒有分到特定國家的金額、雙邊與多邊的組成（countries/<ISO3>.json）、
 *   ODA 占 GNI 跟 DAC 合計與 0.7% 目標的比較
 * - 受援國：主要援助來源，國家（流向檔的 import）與多邊機構（multilateral，地圖上沒有位置）合在一起排
 * - 援助與僑匯、僑匯收支的歷年變化；台灣另列僑匯的組成（中央銀行國際收支）
 */

interface AidFlowFile extends FlowFile {
  /** 援助國沒有分到特定國家的金額（區域計畫、境內難民支出、行政費用…），檔案的單位 */
  unspecified: Record<string, number>;
  /** 受援國從多邊機構收到的援助：[多邊合計, [[機構代碼, 金額], …]] */
  multilateral: Record<string, [number, [string, number][]]>;
}
/** agencies.json：機構代碼 → [中文, 英文] */
type Agencies = Record<string, [string, string]>;

/** 側欄列出的對象數；流向檔每個國家存前 15 名 */
const SHOWN = 8;
/** 聯合國 1970 年決議的目標：ODA 占 GNI 0.7% */
const TARGET = 0.7;
const TAIWAN = 'TWN';

const TEXT = defineMessages({
  zh: {
    recipientsTitle: '主要援助對象（雙邊）',
    bilateralTotal: (year: number, total: string) => `${year} 年 · 給開發中國家的雙邊援助 ${total}`,
    nearest: (year: number) => `（沒有這一年的流向資料，顯示 ${year} 年）`,
    donorRest: (others: string | null, unspecified: string | null) =>
      [
        others && `其他國家合計 ${others}。`,
        unspecified && `沒有分到特定國家的 ${unspecified}：區域或全球的計畫、在捐助國境內的難民支出、行政費用等。`,
      ]
        .filter(Boolean)
        .join(''),
    mixTitle: (year: number) => `雙邊與多邊（${year} 年）`,
    bilateral: '雙邊援助（不含境內難民支出）',
    refugees: '在捐助國境內的難民支出',
    un: '聯合國機構',
    eu: '歐盟機構',
    ida: '世界銀行（國際開發協會）',
    wb: '世界銀行（其他機構）',
    rdb: '區域開發銀行',
    other: '其他國際組織',
    multiOther: '多邊（沒有細分）',
    mixNote:
      '藍色是雙邊援助（直接給受援國，或在捐助國境內的支出），紫色是給國際組織的核心捐款（由它們統籌運用）。2017 年以前是淨撥付，2018 年起是贈與等值；最新一年是初步數字，可能還沒有細分。',
    gniTitle: 'ODA 占 GNI：跟 DAC 合計與 0.7% 目標比',
    dac: 'DAC 合計',
    target: '0.7% 目標',
    gniAria: (country: string) => `${country}歷年的 ODA 占 GNI，與 DAC 合計、0.7% 目標`,
    donorsTitle: '主要援助來源',
    receivedTotal: (year: number, total: string, multi: string | null) =>
      `${year} 年 · 收到的援助合計 ${total}${multi ? `（其中多邊機構 ${multi}）` : ''}`,
    donorsLegend: '藍色是國家（雙邊，地圖上畫弧線），紫色是多邊機構（地圖上沒有位置）。',
    donorsRest: (rest: string) => `其他援助者合計 ${rest}。`,
    aidRemitTitle: '援助與僑匯',
    received: '收到的援助',
    remitIn: '僑匯收入',
    remitOut: '僑匯支出',
    aidRemitAria: (country: string) => `${country}歷年收到的援助與僑匯收入`,
    remitTitle: '僑匯的收入與支出',
    remitAria: (country: string) => `${country}歷年的僑匯收入與支出`,
    twTitle: (year: number) => `台灣的僑匯（${year} 年）`,
    twCaption: (year: number) => `台灣 ${year} 年僑匯的收入與支出，依中央銀行國際收支統計`,
    colItem: '項目',
    colIn: '收入',
    colOut: '支出',
    twTransfer: '個人移轉（家人之間的匯款）',
    twComp: '薪資（在國外短期工作的所得）',
    twTotal: '合計',
    twNote:
      '支出大多是在台移工匯回母國的錢（移工以印尼、越南、菲律賓、泰國為主，見「移民與難民」主題）。個人移轉是國際收支的「二次所得－其他部門」，薪資是「初次所得」。',
    noFlows: (year: number) => `沒有 ${year} 年的資料。`,
    withShare: (value: string, share: string) => `${value}（${share}）`,
  },
  en: {
    recipientsTitle: 'Main recipients of bilateral aid',
    bilateralTotal: (year, total) => `${year} · Bilateral aid to developing countries ${total}`,
    nearest: (year) => ` (no flow data for this year; showing ${year})`,
    donorRest: (others, unspecified) =>
      [
        others && `Other countries: ${others}.`,
        unspecified &&
          `Not allocated to a country: ${unspecified}, for regional or global programmes, refugee costs in the donor country, administrative costs and so on.`,
      ]
        .filter(Boolean)
        .join(' '),
    mixTitle: (year) => `Bilateral and multilateral (${year})`,
    bilateral: 'Bilateral aid (excl. in-donor refugee costs)',
    refugees: 'Refugee costs in the donor country',
    un: 'UN agencies',
    eu: 'EU institutions',
    ida: 'World Bank (IDA)',
    wb: 'World Bank (other)',
    rdb: 'Regional development banks',
    other: 'Other international organisations',
    multiOther: 'Multilateral (not broken down)',
    mixNote:
      'Blue is bilateral aid (given directly to recipients, or spent in the donor country); violet is core contributions to international organisations, which decide how to use them. Net disbursements until 2017, grant equivalents from 2018; the latest year is preliminary and may not be broken down yet.',
    gniTitle: 'ODA as % of GNI, against the DAC total and the 0.7% target',
    dac: 'DAC total',
    target: '0.7% target',
    gniAria: (country) => `ODA as a share of GNI in ${country} over time, with the DAC total and the 0.7% target`,
    donorsTitle: 'Main donors',
    receivedTotal: (year, total, multi) =>
      `${year} · ODA received ${total}${multi ? ` (of which from multilateral institutions ${multi})` : ''}`,
    donorsLegend: 'Blue: countries (bilateral, drawn as arcs on the map). Violet: multilateral institutions (no place on the map).',
    donorsRest: (rest) => `Other donors: ${rest}.`,
    aidRemitTitle: 'Aid and remittances',
    received: 'ODA received',
    remitIn: 'Remittances received',
    remitOut: 'Remittances paid',
    aidRemitAria: (country) => `ODA and remittances received by ${country} over time`,
    remitTitle: 'Remittances received and paid',
    remitAria: (country) => `Remittances received and paid by ${country} over time`,
    twTitle: (year) => `Taiwan’s remittances (${year})`,
    twCaption: (year) => `Remittances received and paid by Taiwan in ${year}, from the central bank’s balance of payments`,
    colItem: 'Item',
    colIn: 'Received',
    colOut: 'Paid',
    twTransfer: 'Personal transfers (between households)',
    twComp: 'Compensation of short-term workers',
    twTotal: 'Total',
    twNote:
      'Payments are mostly money sent home by migrant workers in Taiwan (mainly from Indonesia, Viet Nam, the Philippines and Thailand; see the Migration topic). Personal transfers are secondary income (other sectors) in the balance of payments; compensation is primary income.',
    noFlows: (year) => `No data for ${year}.`,
    withShare: (value, share) => `${value} (${share})`,
  },
});

type MixKey = 'bilateral' | 'refugees' | 'multilateral' | 'un' | 'eu' | 'ida' | 'wb' | 'rdb' | 'other';
const CHANNELS = ['un', 'eu', 'ida', 'wb', 'rdb', 'other'] as const;

/** 不晚於 year 的最近一年；year 比第一年還早時用第一年 */
function yearAtOrBefore(years: number[] | undefined, year: number): number | null {
  if (!years?.length) return null;
  return [...years].reverse().find((y) => y <= year) ?? years[0];
}

/** 這個序列在 year 或之前最近一個有值的年份的索引 */
function lastIndexAtOrBefore(data: IndicatorData, keys: string[], year: number): number {
  for (let i = data.years.length - 1; i >= 0; i--) {
    if (data.years[i] > year) continue;
    if (keys.some((k) => data.values[k]?.[i] != null)) return i;
  }
  return -1;
}

/** 幾個指標檔畫在同一張折線圖上：年份取聯集 */
function mergeYears(series: { data: IndicatorData | null; key: string; name: string; color: string }[]) {
  const years = [...new Set(series.flatMap((s) => (s.data && s.data.values[s.key] ? s.data.years : [])))].sort((a, b) => a - b);
  const lines: TimeSeriesLine[] = series.flatMap((s) => {
    const own = s.data?.values[s.key];
    if (!s.data || !own?.some((v) => v != null)) return [];
    const at = new Map(s.data.years.map((y, i) => [y, own[i]]));
    return [{ name: s.name, color: s.color, values: years.map((y) => at.get(y) ?? null) }];
  });
  // 頭尾都沒有值的年份去掉
  const has = (i: number) => lines.some((l) => l.values[i] != null);
  let start = 0;
  let end = years.length - 1;
  while (start < end && !has(start)) start++;
  while (end > start && !has(end)) end--;
  return { years: years.slice(start, end + 1), lines: lines.map((l) => ({ ...l, values: l.values.slice(start, end + 1) })) };
}

export default function AidPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const base = `topics/${topic.id}`;
  const countries = useJson<CountryTable>('countries.json').data;
  const agencies = useJson<Agencies>(`${base}/agencies.json`).data;
  // 這些指標檔 CountryPanel 已經載入過（同一個快取）
  const oda = useJson<IndicatorData>(`${base}/oda.json`).data;
  const odaGni = useJson<IndicatorData>(`${base}/oda-gni.json`).data;
  const received = useJson<IndicatorData>(`${base}/oda-received.json`).data;
  const remitIn = useJson<IndicatorData>(`${base}/remit-in.json`).data;
  const remitOut = useJson<IndicatorData>(`${base}/remit-out.json`).data;
  const isDonor = Boolean(oda?.values[iso3]?.some((v) => v != null));
  const detail = useJson<IndicatorData>(isDonor ? `${base}/countries/${iso3}.json` : null).data;
  // 流向檔的年份跟收到的援助一樣（1960 年起，到 DAC2A 的最新一年）
  const flowYear = yearAtOrBefore(received?.years, year);
  const flows = useJson<AidFlowFile>(flowYear ? `${base}/flows/${flowYear}.json` : null).data;
  const indicator = (id: string) => topic.indicators.find((i) => i.id === id) as Indicator;

  const money = (v: number) => usd(formatLargeNumber(v));
  /** 「12.3 億 美元（45%）」 */
  const withShare = (v: number, total: number) => {
    const share = formatPercent((v / total) * 100, v / total < 0.1 ? 1 : 0);
    return text.withShare(money(v), share);
  };
  const scale = flows?.scale ?? 1000;
  const agencyName = (code: string) => agencies?.[code]?.[lang === 'zh' ? 0 : 1] ?? code;

  const donorFlows = useMemo(() => {
    if (!flows || flows.year !== flowYear || !flows.export[iso3]) return null;
    const sel = flowSelection(flows, iso3, 'export');
    const shown = sel.links.slice(0, SHOWN);
    const unspecified = (flows.unspecified[iso3] ?? 0) * scale;
    const others = sel.total - unspecified - shown.reduce((s, l) => s + l.value, 0);
    return { sel, shown, unspecified, others };
  }, [flows, flowYear, iso3, scale]);

  const mix = useMemo(() => {
    if (!detail) return null;
    const keys: MixKey[] = ['bilateral', 'multilateral'];
    const i = lastIndexAtOrBefore(detail, keys, year);
    if (i < 0) return null;
    const v = (k: MixKey) => detail.values[k]?.[i] ?? 0;
    const bilateral = v('bilateral');
    const multilateral = v('multilateral');
    const channels = CHANNELS.map((k) => ({ key: k, value: v(k) }));
    const allocated = channels.reduce((s, c) => s + c.value, 0);
    const items: BarListItem[] = [
      { key: 'bilateral', label: text.bilateral, value: bilateral - v('refugees'), color: tokens.accent },
      { key: 'refugees', label: text.refugees, value: v('refugees'), color: tokens.accent },
      ...channels.map((c) => ({ key: c.key, label: text[c.key], value: c.value, color: tokens.hues.violet })),
      { key: 'multi-other', label: text.multiOther, value: multilateral - allocated, color: tokens.hues.violet },
    ].filter((item) => item.value > Math.max(1, (bilateral + multilateral) * 0.001));
    return { year: detail.years[i], items, total: bilateral + multilateral };
  }, [detail, year, text, tokens]);

  const gniOption = useMemo((): ChartOption | null => {
    const own = odaGni?.values[iso3];
    if (!odaGni || !own?.some((v) => v != null)) return null;
    const start = own.findIndex((v) => v != null);
    const option = timeSeriesOption({
      years: odaGni.years.slice(start),
      lines: [
        { name: countryName, values: own.slice(start), color: tokens.accent },
        { name: text.dac, values: (odaGni.aggregates?.DAC ?? []).slice(start), color: tokens.context },
      ],
      methodBreak: odaGni.methodBreak,
      year,
      indicator: indicator('oda-gni'),
      tokens,
    });
    // 0.7% 目標：一條水平虛線，右端寫「0.7% 目標」
    const series = option.series as { markLine?: { data?: unknown[] } }[];
    series[0].markLine?.data?.push({
      yAxis: TARGET,
      lineStyle: { color: tokens.hues.green, type: [6, 4], width: 1.5 },
      label: { show: true, position: 'insideEndTop', formatter: text.target, color: tokens.inkSecondary, fontSize: 11 },
    });
    // 大多數國家不到 0.7%：y 軸至少畫到 0.8%，目標線才看得到（ECharts 算座標軸範圍時不看 markLine）
    const dataMax = Math.max(...own.slice(start).map((v) => v ?? 0), ...(odaGni.aggregates?.DAC ?? []).slice(start).map((v) => v ?? 0));
    return dataMax < TARGET + 0.05 ? ({ ...option, yAxis: { ...(option.yAxis as object), max: 0.8 } } as ChartOption) : option;
  }, [odaGni, iso3, countryName, year, tokens, text, topic]);

  const recipient = useMemo(() => {
    if (!flows || flows.year !== flowYear) return null;
    const bilateral = flows.import[iso3];
    const multi = flows.multilateral[iso3];
    if (!bilateral && !multi) return null;
    const total = (bilateral?.[0] ?? 0) * scale;
    const items: BarListItem[] = [
      ...(bilateral?.[1] ?? []).map(([c, v]) => ({ key: c, label: nameOf(c, countries, lang), value: v * scale, color: tokens.accent })),
      ...(multi?.[1] ?? []).map(([c, v]) => ({ key: c, label: agencyName(c), value: v * scale, color: tokens.hues.violet })),
    ]
      .sort((a, b) => b.value - a.value)
      .slice(0, SHOWN + 2);
    const rest = total - items.reduce((s, i) => s + i.value, 0);
    return { total, multi: multi ? multi[0] * scale : null, items, rest };
  }, [flows, flowYear, iso3, scale, countries, lang, agencies, tokens]);

  // 受援國：收到的援助與僑匯收入；其他國家：僑匯的收入與支出
  const isRecipient = Boolean(received?.values[iso3]?.some((v) => v != null)) && iso3 !== TAIWAN;
  const remitChart = useMemo((): ChartOption | null => {
    const { years, lines } = isRecipient
      ? mergeYears([
          { data: received, key: iso3, name: text.received, color: tokens.accent },
          { data: remitIn, key: iso3, name: text.remitIn, color: tokens.hues.aqua },
        ])
      : mergeYears([
          { data: remitIn, key: iso3, name: text.remitIn, color: tokens.hues.aqua },
          { data: remitOut, key: iso3, name: text.remitOut, color: tokens.hues.orange },
        ]);
    if (lines.length === 0 || years.length < 2) return null;
    return timeSeriesOption({ years, lines, year, indicator: indicator('remit-in'), tokens });
  }, [isRecipient, received, remitIn, remitOut, iso3, year, tokens, text, topic]);

  const taiwan = useMemo(() => {
    if (iso3 !== TAIWAN || !detail?.values['transfer-in']) return null;
    const i = lastIndexAtOrBefore(detail, ['transfer-in'], year);
    if (i < 0) return null;
    const v = (k: string) => detail.values[k]?.[i] ?? null;
    const rows = [
      { label: text.twTransfer, in: v('transfer-in'), out: v('transfer-out') },
      { label: text.twComp, in: v('comp-in'), out: v('comp-out') },
    ];
    const sum = (k: 'in' | 'out') => (rows.every((r) => r[k] != null) ? rows.reduce((s, r) => s + (r[k] ?? 0), 0) : null);
    return { year: detail.years[i], rows, total: { in: sum('in'), out: sum('out') } };
  }, [iso3, detail, year, text]);

  if (!oda || !received || !remitIn) return <p className="empty">{t.loading}</p>;
  const yearNote = flowYear !== null && flowYear !== year ? text.nearest(flowYear) : '';

  return (
    <section className="panel-section">
      {donorFlows && (
        <div className="panel-subsection">
          <h3>{text.recipientsTitle}</h3>
          <p className="panel-year-note">
            {text.bilateralTotal(flowYear!, money(donorFlows.sel.total))}
            {yearNote}
          </p>
          {donorFlows.shown.length > 0 && (
            <BarList
              items={donorFlows.shown.map((l) => ({ key: l.iso3, label: nameOf(l.iso3, countries, lang), value: l.value }))}
              total={donorFlows.sel.total}
              format={money}
              ariaLabel={`${countryName} · ${text.recipientsTitle}`}
            />
          )}
          <p className="note">
            {text.donorRest(
              donorFlows.others > 0.5 ? withShare(donorFlows.others, donorFlows.sel.total) : null,
              donorFlows.unspecified > 0.5 ? withShare(donorFlows.unspecified, donorFlows.sel.total) : null,
            )}
          </p>
        </div>
      )}
      {/* 只有一項（台灣只申報總額，沒有多邊的細項）就不列 */}
      {mix && mix.items.length > 1 && (
        <div className="panel-subsection">
          <h3>{text.mixTitle(mix.year)}</h3>
          <BarList items={mix.items} total={mix.total} format={money} ariaLabel={`${countryName} · ${text.mixTitle(mix.year)}`} />
          <p className="note">{text.mixNote}</p>
        </div>
      )}
      {gniOption && (
        <div className="panel-subsection">
          <h3>{text.gniTitle}</h3>
          <EChart option={gniOption} height={180} ariaLabel={text.gniAria(countryName)} />
          <p className="note">{t.methodBreak(odaGni!.methodBreak!)}</p>
        </div>
      )}
      {recipient && (
        <div className="panel-subsection">
          <h3>{text.donorsTitle}</h3>
          <p className="panel-year-note">
            {text.receivedTotal(flowYear!, money(recipient.total), recipient.multi ? money(recipient.multi) : null)}
            {yearNote}
          </p>
          <BarList
            items={recipient.items}
            total={recipient.total > 0 ? recipient.total : undefined}
            format={money}
            ariaLabel={`${countryName} · ${text.donorsTitle}`}
          />
          <p className="note">
            {text.donorsLegend}
            {recipient.rest > 0.5 && recipient.total > 0 && ` ${text.donorsRest(money(recipient.rest))}`}
          </p>
        </div>
      )}
      {remitChart && (
        <div className="panel-subsection">
          <h3>{isRecipient ? text.aidRemitTitle : text.remitTitle}</h3>
          <EChart option={remitChart} height={180} ariaLabel={(isRecipient ? text.aidRemitAria : text.remitAria)(countryName)} />
        </div>
      )}
      {taiwan && (
        <div className="panel-subsection">
          <h3>{text.twTitle(taiwan.year)}</h3>
          <table className="mini-table" aria-label={text.twCaption(taiwan.year)}>
            <thead>
              <tr>
                <th scope="col">{text.colItem}</th>
                <th scope="col" className="num">{text.colIn}</th>
                <th scope="col" className="num">{text.colOut}</th>
              </tr>
            </thead>
            <tbody>
              {[...taiwan.rows, { label: text.twTotal, ...taiwan.total }].map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td className="num">{r.in != null ? money(r.in) : '—'}</td>
                  <td className="num">{r.out != null ? money(r.out) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">{text.twNote}</p>
        </div>
      )}
      {!donorFlows && !recipient && !remitChart && flowYear !== null && <p className="empty">{text.noFlows(flowYear)}</p>}
    </section>
  );
}
