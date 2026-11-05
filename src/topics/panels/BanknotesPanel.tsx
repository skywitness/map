import { defineMessages, tr, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed, formatLargeNumber } from '../../lib/format';
import { PORTRAIT } from '../banknotes';
import type { PanelExtraProps } from '../types';

/** people.json（pipeline/topics/banknote_people.py）：[人物, 生卒年, 被紀念的理由, 面額, 正反面, 流通年份, 類別]，依面額由大到小 */
type Person = [string, string, string, string, string, string, number];
/** largest-detail.json（banknote_largest.py）：[貨幣條目, ISO 4217, 資訊框原文, 最大面額, 條目版本, 匯率, 匯率年份] */
type Largest = [string, string, string, number, number, number | null, number | null];

const TEXT = defineMessages({
  zh: {
    peopleTitle: '現在流通的鈔票上的人',
    none: '條目沒有列出這一國現在流通的鈔票人像。',
    euro: '用歐元：歐元紙鈔上沒有人像（只有建築的窗戶、門與橋）。',
    reason: '理由（維基原文）',
    note: '依英文維基「List of people on banknotes」，理由照原文；類別是依理由的關鍵字自動分的。',
    largestTitle: '最大面額的鈔票',
    largest: (v: string, code: string, usd: string | null, year: number | null) =>
      `${v} ${code}${usd ? `，約 ${usd} 美元（${year} 年官方匯率）` : ''}`,
    fromInfobox: (title: string) => `依英文維基「${title}」資訊框的常用與少用面額：`,
  },
  en: {
    peopleTitle: 'People on current banknotes',
    none: 'The article lists no current banknote portraits for this country.',
    euro: 'Uses the euro: euro banknotes show no people (only windows, gateways and bridges).',
    reason: 'Reason (as in Wikipedia)',
    note: 'From the Wikipedia “List of people on banknotes”, reasons as written; categories are assigned automatically from keywords in the reason.',
    largestTitle: 'Largest banknote',
    largest: (v: string, code: string, usd: string | null, year: number | null) =>
      `${v} ${code}${usd ? `, about US$${usd} (official ${year} rate)` : ''}`,
    fromInfobox: (title: string) => `From the infobox of the Wikipedia article “${title}”, frequently and rarely used notes: `,
  },
});

export default function BanknotesPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const people = useJson<{ countries: Record<string, Person[]> }>(`topics/${topic.id}/people.json`).data?.countries[iso3];
  const portrait = useJson<{ values: Record<string, unknown> }>(`topics/${topic.id}/portrait.json`).data;
  const largest = useJson<{ countries: Record<string, Largest> }>(`topics/${topic.id}/largest-detail.json`).data?.countries[iso3];
  const euro = !people && portrait?.values[iso3] !== undefined;
  return (
    <>
      {largest && (
        <section className="panel-section">
          <h3>{text.largestTitle}</h3>
          <p>
            {text.largest(
              fixed(largest[3], 0),
              largest[1],
              largest[5] ? (largest[3] / largest[5] < 10 ? fixed(largest[3] / largest[5], 2) : formatLargeNumber(largest[3] / largest[5])) : null,
              largest[6],
            )}
          </p>
          <p className="note">
            {text.fromInfobox(largest[0])}
            {largest[2]}
          </p>
        </section>
      )}
      <section className="panel-section">
        <h3>{text.peopleTitle}</h3>
        {people?.length ? (
          <table className="mini-table">
            <tbody>
              {people.map(([name, life, reason, denom, side, circ, cat], i) => (
                <tr key={i}>
                  <th scope="row" translate="no">
                    {denom}
                  </th>
                  <td>
                    <strong translate="no">{name}</strong>
                    {life && ` (${life})`}
                    <div className="note" title={text.reason}>
                      {reason}
                    </div>
                    <div className="note">
                      {tr(PORTRAIT.find((c) => c.value === cat)?.label ?? '', lang)} · {side} · {circ}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty">{euro ? text.euro : text.none}</p>
        )}
        <p className="note">{text.note}</p>
      </section>
    </>
  );
}
