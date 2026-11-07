import { BarList, type BarListItem } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { MAP_TOKENS } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

/**
 * 數位貿易壁壘的側欄（2026-11-07，製作手冊第二十七批 586；pipeline/topics/digital_trade.py 的 pillars.json）：
 * 這一國那一年五個支柱的分數（加起來是整體指數），看出「連線沒問題但支付封閉」跟「什麼都管」兩種型。
 */
interface Pillars {
  years: number[];
  pillars: Pillar[];
  countries: Record<string, (number[] | null)[]>;
}
type Pillar = 'infrastructure' | 'transactions' | 'payments' | 'ip' | 'other';

const TEXT = defineMessages({
  zh: {
    title: (y: number) => `${y} 年的分數從哪裡來`,
    name: { infrastructure: '基礎設施與連線', transactions: '電子交易', payments: '支付系統', ip: '智慧財產權', other: '其他障礙' } as Record<Pillar, string>,
    aria: (c: string) => `${c}的數位服務貿易限制指數，依五個支柱`,
    zero: '五個支柱都是 0：OECD 沒有找到限制。',
    note: '五個支柱加起來就是整體指數（0–1，越高越封閉）。有些項目是「沒有相關法律」也算限制，法規還不完整的國家分數偏高。',
  },
  en: {
    title: (y: number) => `Where the score comes from, ${y}`,
    name: { infrastructure: 'Infrastructure and connectivity', transactions: 'Electronic transactions', payments: 'Payment systems', ip: 'Intellectual property', other: 'Other barriers' } as Record<Pillar, string>,
    aria: (c: string) => `Digital Services Trade Restrictiveness Index for ${c}, by pillar`,
    zero: 'All five pillars are 0: the OECD found no restrictions.',
    note: 'The five pillars add up to the overall index (0–1, higher is more closed). Some items count the absence of a law as a restriction, so countries with incomplete regulations score higher.',
  },
});

export default function DigitalTradePanel({ topic, iso3, year, countryName }: PanelExtraProps) {
  const text = TEXT[useLang()];
  const d = useJson<Pillars>(`topics/${topic.id}/pillars.json`).data;
  const rows = d?.countries[iso3];
  if (!d || !rows) return null;
  let i = d.years.indexOf(year);
  while (i >= 0 && !rows[i]) i--;
  if (i < 0) return null;
  const items: BarListItem[] = d.pillars
    .map((p, n) => ({ key: p, label: text.name[p], value: rows[i]![n], color: MAP_TOKENS.categorical[n] }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  return (
    <section className="panel-section">
      <h3>{text.title(d.years[i])}</h3>
      {items.length ? (
        <BarList items={items} format={(v) => fixed(v, 3)} ariaLabel={text.aria(countryName)} />
      ) : (
        <p className="empty">{text.zero}</p>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
