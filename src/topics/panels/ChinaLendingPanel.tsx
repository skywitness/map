import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { EChart, type ChartOption } from '../../charts/EChart';
import { stackedAreaOption } from '../../charts/stackedArea';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { formatLargeNumber, formatLargeTick, usd } from '../../lib/format';
import type { IndicatorData, PanelExtraProps } from '../types';
import { TopicLink } from './TopicLink';

/**
 * 中國的海外貸款的側欄（pipeline/topics/china_lending.py 的 countries/<ISO3>.json）：
 * - 用途（OECD 部門）：累計的指標加到時間軸那一年，當年的指標只看那一年；跟著子項目（全部、貸款、贈款）
 * - 歷年的貸款、贈款、債務重整與類型不明的承諾金額（堆疊）
 * - 金額最大的 10 個項目（名稱是 AidData 的英文原文，translate="no"）
 */

interface Detail {
  years: number[];
  /** 類型 → 歷年承諾金額（百萬美元，2021 年固定美元） */
  flows: Partial<Record<FlowCode, number[]>>;
  /** 子項目 → 部門代碼（OECD 三位碼）→ 歷年 */
  sectors: Record<string, Record<string, number[]>>;
  /** 子項目 → [名稱, 承諾年份, 百萬美元, 部門, 狀態, 類型, AidData 的編號] */
  top: Record<string, [string, number, number, string, Status, FlowCode, number][]>;
}
type FlowCode = 'loan' | 'grant' | 'debt' | 'vague';
type Status = 'done' | 'ongoing' | 'pipeline';

const MILLION = 1e6;
const SECTORS_SHOWN = 8;

/** OECD DAC 的三位碼部門（AidData 的 Sector Code） */
const SECTOR_NAMES: Record<string, { zh: string; en: string }> = {
  '110': { zh: '教育', en: 'Education' },
  '120': { zh: '衛生', en: 'Health' },
  '130': { zh: '人口政策與生育健康', en: 'Population and reproductive health' },
  '140': { zh: '供水與衛生設施', en: 'Water supply and sanitation' },
  '150': { zh: '政府與公民社會', en: 'Government and civil society' },
  '160': { zh: '其他社會基礎設施與服務', en: 'Other social infrastructure and services' },
  '210': { zh: '運輸與倉儲', en: 'Transport and storage' },
  '220': { zh: '通訊', en: 'Communications' },
  '230': { zh: '能源', en: 'Energy' },
  '240': { zh: '銀行與金融服務', en: 'Banking and financial services' },
  '250': { zh: '商業與其他服務', en: 'Business and other services' },
  '310': { zh: '農林漁業', en: 'Agriculture, forestry and fishing' },
  '320': { zh: '工業、礦業與營建', en: 'Industry, mining and construction' },
  '330': { zh: '貿易政策與法規', en: 'Trade policies and regulations' },
  '410': { zh: '一般環境保護', en: 'General environmental protection' },
  '430': { zh: '其他跨部門', en: 'Other multisector' },
  '510': { zh: '一般預算支持', en: 'General budget support' },
  '520': { zh: '糧食援助與糧食安全', en: 'Food aid and food security' },
  '530': { zh: '其他商品援助', en: 'Other commodity assistance' },
  '600': { zh: '債務相關', en: 'Action relating to debt' },
  '720': { zh: '緊急救援', en: 'Emergency response' },
  '730': { zh: '災後重建', en: 'Reconstruction, relief and rehabilitation' },
  '740': { zh: '防災與整備', en: 'Disaster prevention and preparedness' },
  '998': { zh: '未分類', en: 'Unallocated or unspecified' },
};

const TEXT = defineMessages({
  zh: {
    sectorsTitle: (span: string) => `用途（${span}）`,
    span: (from: number, to: number) => (from === to ? `${to} 年` : `${from}–${to} 年累計`),
    sectorsRest: (rest: string) => `其他用途合計 ${rest}。`,
    flowsTitle: '歷年的承諾金額',
    flowsAria: (country: string) => `${country}歷年從中國官方機構得到的承諾金額，依貸款、贈款等類型堆疊`,
    loan: '貸款',
    grant: '贈款',
    debt: '債務重整',
    vague: '類型不明',
    flowsNote: '2021 年固定美元；一年只要簽下一筆大型貸款就會跳很高。',
    topTitle: (item: string) => `金額最大的 10 個項目（${item}）`,
    topAria: (country: string) => `${country}從中國官方機構得到的金額最大的項目`,
    all: '全部',
    status: { done: '已完成', ongoing: '執行中', pipeline: '已承諾、尚未動工' } as Record<Status, string>,
    meta: (year: number, sector: string, status: string, flow: string) => `${year} 年 · ${flow} · ${sector} · ${status}`,
    topNote: '名稱是 AidData 的英文原文；金額是承諾金額（2021 年固定美元），不是實際撥款。',
    noData: '這個國家沒有有金額的項目。',
    aid: '看向 OECD 申報的援助國與多邊機構給的援助（國際援助與僑匯）',
  },
  en: {
    sectorsTitle: (span) => `By purpose (${span})`,
    span: (from, to) => (from === to ? `${to}` : `${from}–${to} cumulative`),
    sectorsRest: (rest) => `Other purposes: ${rest}.`,
    flowsTitle: 'Commitments over time',
    flowsAria: (country) => `Commitments from official institutions in China to ${country} over time, stacked by type (loans, grants and other)`,
    loan: 'Loans',
    grant: 'Grants',
    debt: 'Debt rescheduling',
    vague: 'Unclear type',
    flowsNote: 'Constant 2021 US dollars; a single large loan makes a year jump.',
    topTitle: (item) => `10 largest projects (${item})`,
    topAria: (country) => `Largest projects funded by official institutions in China in ${country}`,
    all: 'all',
    status: { done: 'Completed', ongoing: 'In implementation', pipeline: 'Committed, not started' },
    meta: (year, sector, status, flow) => `${year} · ${flow} · ${sector} · ${status}`,
    topNote: 'Titles are AidData’s originals; amounts are commitments (constant 2021 US dollars), not disbursements.',
    noData: 'No records with an amount for this country.',
    aid: 'See aid from donors reporting to the OECD and multilateral institutions (Aid topic)',
  },
});

const FLOWS: FlowCode[] = ['loan', 'grant', 'debt', 'vague'];

export default function ChinaLendingPanel({ topic, indicator, iso3, year, item, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  // 有項目的國家才有明細檔（累計承諾金額在 2021 年大於 0；同一個檔 CountryPanel 已經載入過）
  const cumulative = useJson<IndicatorData>(`topics/${topic.id}/all-cumulative.json`).data;
  const hasDetail = Boolean(cumulative?.values[iso3]?.some((v) => v != null && v > 0));
  const { data: detail, loading } = useJson<Detail>(hasDetail ? `topics/${topic.id}/countries/${iso3}.json` : null);
  const current = item ?? 'all';
  const money = (millions: number) => usd(formatLargeNumber(millions * MILLION));
  const annual = indicator.id === 'annual';

  const sectors = useMemo(() => {
    const by = detail?.sectors[current];
    if (!detail || !by) return null;
    const last = detail.years.indexOf(Math.min(Math.max(year, detail.years[0]), detail.years[detail.years.length - 1]));
    const first = annual ? last : 0;
    const items: BarListItem[] = Object.entries(by)
      .map(([code, values]) => ({
        key: code,
        label: SECTOR_NAMES[code]?.[lang] ?? code,
        value: values.slice(first, last + 1).reduce((s, v) => s + v, 0),
      }))
      .filter((i) => i.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total <= 0) return { span: text.span(detail.years[first], detail.years[last]), items: [], total: 0, rest: 0 };
    const shown = items.slice(0, SECTORS_SHOWN);
    return {
      span: text.span(detail.years[first], detail.years[last]),
      items: shown,
      total,
      rest: total - shown.reduce((s, i) => s + i.value, 0),
    };
  }, [detail, current, year, annual, lang, text]);

  const flowsOption = useMemo((): ChartOption | null => {
    if (!detail) return null;
    const colors: Record<FlowCode, string> = {
      loan: tokens.accent,
      grant: tokens.hues.aqua,
      debt: tokens.hues.orange,
      vague: tokens.context,
    };
    const series = FLOWS.filter((f) => detail.flows[f]?.some((v) => v > 0)).map((f) => ({
      name: text[f],
      values: detail.flows[f]!,
      color: colors[f],
    }));
    if (series.length === 0) return null;
    return stackedAreaOption({
      years: detail.years,
      series,
      year,
      format: money,
      formatTick: (v) => usd(formatLargeTick(v * MILLION)),
      tokens,
    });
  }, [detail, year, tokens, text, lang]);

  if (!cumulative || (hasDetail && loading)) return <p className="empty">{t.loading}</p>;
  const top = detail?.top[current] ?? [];
  const itemLabel = current === 'all' ? text.all : text[current as FlowCode];

  return (
    <section className="panel-section">
      {sectors && sectors.items.length > 0 && (
        <div className="panel-subsection">
          <h3>{text.sectorsTitle(sectors.span)}</h3>
          <BarList items={sectors.items} total={sectors.total} format={money} ariaLabel={`${countryName} · ${text.sectorsTitle(sectors.span)}`} />
          {sectors.rest > 0.005 && <p className="note">{text.sectorsRest(money(sectors.rest))}</p>}
        </div>
      )}
      {flowsOption && (
        <div className="panel-subsection">
          <h3>{text.flowsTitle}</h3>
          <EChart option={flowsOption} height={180} ariaLabel={text.flowsAria(countryName)} />
          <p className="note">{text.flowsNote}</p>
        </div>
      )}
      {top.length > 0 && (
        <div className="panel-subsection">
          <h3>{text.topTitle(itemLabel)}</h3>
          <ul className="plain-list" aria-label={text.topAria(countryName)}>
            {top.map(([title, y, amount, sector, status, flow, id]) => (
              <li key={id}>
                <span className="plain-title">
                  <span translate="no" lang="en">
                    {title}
                  </span>
                </span>
                <span className="plain-meta">
                  {[money(amount), text.meta(y, SECTOR_NAMES[sector]?.[lang] ?? sector, text.status[status], text[flow])].join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          <p className="note">{text.topNote}</p>
        </div>
      )}
      {/* 範圍外的國家（台灣、高所得國家）數值卡片已經寫原因，這裡不再寫 */}
      {!flowsOption && cumulative.values[iso3] && <p className="empty">{text.noData}</p>}
      <p className="note">
        <TopicLink topic="aid" ind="oda-received" iso3={iso3}>
          {text.aid}
        </TopicLink>
      </p>
    </section>
  );
}
