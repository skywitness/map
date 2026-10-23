import { useMemo } from 'react';
import { defineMessages, tr, useLang, useT } from '../../i18n';
import { countryName, type CountryTable } from '../../lib/countries';
import { useJson } from '../../lib/data';
import { categoryScale } from '../../map/categories';
import { MAP_TOKENS } from '../../theme/tokens';
import { KINDS, ORGS, STATUS } from '../organizations';
import type { PanelExtraProps } from '../types';

/** [狀態, 開始, 結束, 種類]：狀態 m 成員、s 暫停參與、c 申請或加入中、p 夥伴或觀察員；結束 null = 至今 */
type Period = [string, string, string | null, string | null];

/** pipeline/topics/organizations.py 的 details.json */
interface DetailsFile {
  /** 資料產生的日期：今年的狀態是這一天的 */
  asOf: string;
  orgs: Record<string, { first: number; sources: string[] }>;
  /** 官網的查閱日期 */
  accessed: string;
  /** 主權國家的一部分（格陵蘭 → 丹麥）：跟著主權國家上色 */
  partOf: Record<string, string>;
  countries: Record<string, Record<string, Period[]>>;
  /** 參加時用的名稱：[中文, 英文] */
  names: Record<string, Record<string, [string, string]>>;
  notes: Record<string, Record<string, [string, string]>>;
}

/** 狀態 → 地圖的類別代碼（STATUS） */
const CODE: Record<string, number> = { m: 1, c: 2, p: 3, s: 4 };
/** 同時有好幾段時取哪一個（跟 pipeline 的 PRECEDENCE 一致） */
const PRECEDENCE = ['s', 'm', 'c', 'p'];

const TEXT = defineMessages({
  zh: {
    title: (year: number) => `${year} 年的國際組織`,
    asOf: (date: string) => `今年是 ${date} 的狀態。`,
    since: (date: string) => `${date} 起`,
    range: (from: string, to: string | null) => `${from} – ${to ?? '至今'}`,
    period: (kind: string, when: string) => `${kind}：${when}`,
    former: '目前不是成員（曾經是）',
    formerOther: '目前沒有參加',
    name: (name: string) => `名稱：${name}`,
    notMember: (list: string) => `不是成員：${list}`,
    noneAtAll: '這一年不是這 16 個組織的成員，也沒有申請或夥伴關係。',
    partOf: (parent: string) => `這裡是${parent}的一部分，隨${parent}參加各組織，地圖上不另外上色（歐盟的範圍除外）。`,
    // 簡稱是英文縮寫（WTO）時中英文之間空一格
    about: (org: string) => (/^[A-Za-z]/.test(org) ? `關於 ${org}` : `關於${org}`),
    /** 歷程裡的暫停期間（圖例的「成員（暫停參與）」太長） */
    suspended: '暫停參與',
    sources: (date: string) => `資料來源（${date} 查閱）：`,
    sep: '、',
  },
  en: {
    title: (year) => `International organisations in ${year}`,
    asOf: (date) => `The current year shows the status on ${date}.`,
    since: (date) => `since ${date}`,
    range: (from, to) => `${from} – ${to ?? 'present'}`,
    period: (kind, when) => `${kind}: ${when}`,
    former: 'Not a member now (formerly a member)',
    formerOther: 'Not taking part now',
    name: (name) => `Name used: ${name}`,
    notMember: (list) => `Not a member: ${list}`,
    noneAtAll: 'Not a member of any of these 16 organisations this year, nor an applicant or partner.',
    partOf: (parent) => `Part of ${parent}; it takes part through ${parent} and is not shaded separately (except for the EU).`,
    about: (org) => `${org} in brief`,
    suspended: 'Suspended',
    sources: (date) => `Sources (accessed ${date}): `,
    sep: '; ',
  },
});

/** 只有年或年月的日期補成第一天，才能跟完整的日期比較 */
const full = (d: string) => (d.length === 4 ? `${d}-01-01` : d.length === 7 ? `${d}-01` : d);

/** 那一天的狀態（跟 pipeline 的 status() 一樣：結束日不含） */
function statusAt(periods: Period[], at: string): string | null {
  const active = new Set(periods.filter(([, s, e]) => full(s) <= at && (e === null || full(e) > at)).map((p) => p[0]));
  return PRECEDENCE.find((s) => active.has(s)) ?? null;
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** 來源連結的文字：網域，同一個網域有好幾頁時加上編號（wto.org 1、wto.org 2） */
function sourceLabels(urls: string[]): string[] {
  const hosts = urls.map(host);
  return hosts.map((h, i) =>
    hosts.filter((x) => x === h).length > 1 ? `${h} ${hosts.slice(0, i + 1).filter((x) => x === h).length}` : h,
  );
}

export default function OrganizationsPanel({ topic, iso3, year, item }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, error } = useJson<DetailsFile>(`topics/${topic.id}/details.json`);
  const countries = useJson<CountryTable>('countries.json').data;

  const scale = useMemo(() => {
    const layer = topic.indicators.find((i) => i.id === 'membership')?.layer;
    return layer?.kind === 'categorical' ? categoryScale(layer, MAP_TOKENS) : null;
  }, [topic]);
  const statusLabel = useMemo(() => new Map(STATUS.map((c) => [c.value, tr(c.label, lang)])), [lang]);

  if (error) return <p className="empty">{t.noData}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;

  // 每年 12 月 31 日的狀態；今年是資料產生當天
  const at = year < +data.asOf.slice(0, 4) ? `${year}-12-31` : data.asOf;
  const own = data.countries[iso3] ?? {};
  const pick = (pair: [string, string] | undefined) => (pair ? (lang === 'en' ? pair[1] : pair[0]) : null);
  const label = (kind: string | null, st: string) =>
    kind && KINDS[kind] ? tr(KINDS[kind], lang) : st === 's' ? text.suspended : statusLabel.get(CODE[st]);

  const rows = ORGS.map((org) => {
    const periods = (own[org.id] ?? []).filter(([, start]) => full(start) <= at);
    const st = year >= (data.orgs[org.id]?.first ?? 0) ? statusAt(periods, at) : null;
    return { org, periods, st, former: st === null && periods.length > 0 };
  });
  const current = rows.filter((r) => r.st !== null);
  const former = rows.filter((r) => r.former);
  const others = rows.filter((r) => r.st === null && !r.former);
  const selected = ORGS.find((o) => o.id === item);
  const parent = data.partOf[iso3];
  const sources = selected ? (data.orgs[selected.id]?.sources ?? []) : [];
  const labels = sourceLabels(sources);

  const row = ({ org, periods, st }: (typeof rows)[number]) => {
    const name = pick(data.names[iso3]?.[org.id]);
    const note = pick(data.notes[iso3]?.[org.id]);
    const code = st ? CODE[st] : null;
    return (
      <li key={org.id}>
        <span className="plain-title">
          {code !== null && (
            <span
              className="legend-swatch"
              style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: 6, background: scale?.color(code) ?? undefined }}
              aria-hidden="true"
            />
          )}
          {tr(org.short, lang)} · {code !== null ? statusLabel.get(code) : periods.some((p) => p[0] === 'm') ? text.former : text.formerOther}
        </span>
        {periods.map(([s, start, end, kind]) => (
          <span className="plain-meta" key={`${s}-${start}`}>
            {text.period(label(kind, s) ?? '', end === null || full(end) > at ? text.since(start) : text.range(start, end))}
          </span>
        ))}
        {name && <span className="plain-meta">{text.name(name)}</span>}
        {note && <span className="plain-meta">{note}</span>}
      </li>
    );
  };

  return (
    <section className="panel-section">
      <h3>{text.title(year)}</h3>
      {parent && <p className="note">{text.partOf(countryName(parent, countries, lang))}</p>}
      {current.length + former.length > 0 ? (
        <ul className="plain-list">
          {current.map(row)}
          {former.map(row)}
        </ul>
      ) : (
        <p className="empty">{text.noneAtAll}</p>
      )}
      {others.length > 0 && current.length + former.length > 0 && (
        <p className="note">{text.notMember(others.map((r) => tr(r.org.short, lang)).join(text.sep))}</p>
      )}
      {year >= +data.asOf.slice(0, 4) && <p className="note">{text.asOf(data.asOf)}</p>}

      {selected && (
        <>
          <h3>{text.about(tr(selected.short, lang))}</h3>
          <p className="note">{tr(selected.about, lang)}</p>
          <p className="note">
            {text.sources(data.accessed)}
            {sources.map((url, i) => (
              <span key={url}>
                {i > 0 && text.sep}
                <a href={url} target="_blank" rel="noreferrer">
                  {labels[i]}
                </a>
              </span>
            ))}
          </p>
        </>
      )}
    </section>
  );
}
