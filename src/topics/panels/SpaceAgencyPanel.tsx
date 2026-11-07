import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 國家太空機構的側欄（2026-11-07，製作手冊第二十七批 603；pipeline/topics/space_agencies.py 的 space-agency-detail.json）：
 * 現在的機構名稱、最早的機構成立年份、現在的機構成立年份（不同時）、總部、員工數與網站。
 */
interface Agency {
  q?: string;
  name: string;
  zh?: string;
  founded?: number;
  since?: number;
  web?: string;
  emp?: number;
  hq?: string | null;
}

const TEXT = defineMessages({
  zh: {
    title: '國家太空機構',
    founded: (y: number) => `最早的國家太空機構 ${y} 年成立`,
    since: (y: number) => `現在的機構 ${y} 年成立`,
    hq: (v: string) => `總部：${v}`,
    emp: (v: number) => `員工約 ${fixed(v, 0)} 人`,
    web: '官方網站',
    none: '名單裡沒有這一國的國家太空機構。',
  },
  en: {
    title: 'National space agency',
    founded: (y: number) => `First national space agency founded in ${y}`,
    since: (y: number) => `Current agency founded in ${y}`,
    hq: (v: string) => `Headquarters: ${v}`,
    emp: (v: number) => `About ${fixed(v, 0)} staff`,
    web: 'Official website',
    none: 'No national space agency for this country in the list.',
  },
});

export default function SpaceAgencyPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const d = useJson<{ countries: Record<string, Agency> }>(`topics/${topic.id}/space-agency-detail.json`).data;
  if (!d) return null;
  const a = d.countries[iso3];
  if (!a) {
    return (
      <section className="panel-section">
        <h3>{text.title}</h3>
        <p className="note">{text.none}</p>
      </section>
    );
  }
  const title = lang === 'zh' && a.zh ? a.zh : a.name;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <p>
        <strong translate="no">{title}</strong>
        {lang === 'zh' && a.zh && (
          <>
            <br />
            <span className="note" translate="no">
              {a.name}
            </span>
          </>
        )}
      </p>
      <ul className="plain-list">
        {a.founded && <li>{text.founded(a.founded)}</li>}
        {a.since && <li>{text.since(a.since)}</li>}
        {a.hq && <li>{text.hq(a.hq)}</li>}
        {a.emp && <li>{text.emp(a.emp)}</li>}
        {a.web && (
          <li>
            <a href={a.web} target="_blank" rel="noopener noreferrer">
              {text.web}
            </a>
          </li>
        )}
      </ul>
    </section>
  );
}
