import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { PATENT_FIELDS } from '../innovation';
import type { PanelExtraProps } from '../types';

/** patent-fields.json（pipeline/topics/innovation_fields.py）：每國最近一年 35 個領域的公告件數，世界的比例，台灣智慧局的 IPC 前 10 名 */
interface FieldsFile {
  year: number;
  fields: string[];
  /** 世界的各領域比例（%），順序同 fields */
  world: number[];
  countries: Record<string, number[]>;
  taiwan: { year: number; source: string; top: [string, string, number][] };
}

const TEXT = defineMessages({
  zh: {
    title: (year: number) => `前 10 大技術領域（${year} 年）`,
    aria: (country: string) => `${country}專利公告最多的 10 個技術領域`,
    label: (name: string, rta: string) => `${name}（世界的 ${rta} 倍）`,
    note: (total: string) =>
      `這個國家的申請人在各國專利局公告的 ${total} 件發明專利裡各領域的比例；括號是相對專長：跟全世界的比例相比，大於 1 倍是這一國特別集中的領域。`,
    twTitle: (year: number) => `台灣：發明專利申請最多的國際專利分類（${year} 年）`,
    twAria: '台灣發明專利新申請案件數最多的 10 個國際專利分類',
    twNote:
      'WIPO 的資料沒有台灣，這裡列智慧財產局「發明專利新申請案件數依國際專利三階分類排行」的前 10 名（含外國申請人），是申請不是公告，也不是 WIPO 的 35 個技術領域，不能直接比較。',
  },
  en: {
    title: (year) => `Top 10 technology fields (${year})`,
    aria: (country) => `The 10 technology fields with the most patent publications for ${country}`,
    label: (name, rta) => `${name} (${rta}× world)`,
    note: (total) =>
      `Shares of the ${total} invention patents published for applicants from this country at offices worldwide; the figure in brackets is relative specialisation, the share compared with the world mix (above 1× means the field is unusually concentrated here).`,
    twTitle: (year) => `Taiwan: IPC classes with the most invention patent applications (${year})`,
    twAria: 'The 10 IPC classes with the most new invention patent applications in Taiwan',
    twNote:
      'Taiwan is not in the WIPO data, so this lists the top 10 IPC subclasses for new invention patent applications at Taiwan’s Intellectual Property Office (including foreign applicants). These are applications, not publications, and IPC classes rather than WIPO’s 35 fields, so they are not directly comparable.',
  },
});

export default function PatentFieldsPanel({ topic, indicator, iso3, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const show = indicator.id === 'patent-field';
  const data = useJson<FieldsFile>(show ? `topics/${topic.id}/patent-fields.json` : null).data;
  const view = useMemo(() => {
    const counts = data?.countries[iso3];
    if (!data || !counts) return null;
    const total = counts.reduce((a, b) => a + b, 0);
    if (!total) return null;
    const label = new Map(PATENT_FIELDS.map((f) => [f.id, f.label]));
    const rows = data.fields
      .map((id, i) => ({ id, share: (counts[i] / total) * 100, world: data.world[i] }))
      .sort((a, b) => b.share - a.share)
      .slice(0, 10);
    return {
      total,
      items: rows.map((r) => ({
        key: r.id,
        label: tr(label.get(r.id) ?? { zh: r.id, en: r.id }, lang),
        value: r.share,
        color: tokens.hues.blue,
        rta: r.world > 0 ? r.share / r.world : null,
      })),
    };
  }, [data, iso3, lang, tokens]);
  if (!show || !data) return null;
  if (iso3 === 'TWN') {
    const { year, top } = data.taiwan;
    return (
      <section className="panel-section">
        <h3>{text.twTitle(year)}</h3>
        <BarList
          items={top.map(([code, desc, n]) => ({ key: code, label: lang === 'zh' ? `${code} ${desc}` : code, value: n }))}
          format={(v) => fixed(v, 0)}
          ariaLabel={text.twAria}
        />
        <p className="note">{text.twNote}</p>
      </section>
    );
  }
  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title(data.year)}</h3>
      <BarList
        items={view.items.map((i) => ({ ...i, label: i.rta == null ? i.label : text.label(i.label, fixed(i.rta, 1)) }))}
        format={(v) => `${fixed(v, 1)}%`}
        ariaLabel={text.aria(countryName)}
      />
      <p className="note">{text.note(fixed(view.total, 0))}</p>
    </section>
  );
}
