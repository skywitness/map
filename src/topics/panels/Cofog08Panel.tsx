import { useMemo } from 'react';
import { BarList, type BarListItem } from '../../charts/BarList';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { PanelExtraProps } from '../types';

/**
 * 政府在 COFOG 08「遊憩、文化與宗教」的六個分項各花多少（占 GDP），2026-11-07 製作手冊第二十七批 556：
 * 文化主題的文化服務、廣播與出版，宗教主題的宗教與其他社區服務共用（pipeline/topics/culture_spending.py 的 cofog08.json）。
 */
interface Cofog08 {
  years: number[];
  groups: string[];
  /** 國家（與 EU27_2020）→ 分項 → 占 GDP（%），跟 years 對齊 */
  values: Record<string, Record<string, (number | null)[]>>;
  /** 同上，百萬歐元 */
  amounts: Record<string, Record<string, (number | null)[]>>;
}

/** 指標 id → 這個指標是哪一個分項 */
const INDICATOR_GROUP: Record<string, string> = {
  'gov-culture': 'GF0802',
  'gov-broadcasting': 'GF0803',
  'gov-religion': 'GF0804',
};
const EU = 'EU27_2020';

const TEXT = defineMessages({
  zh: {
    title: (year: number) => `政府的遊憩、文化與宗教支出（${year} 年，占 GDP）`,
    shownInstead: (year: number, shown: number) => `${year} 年沒有資料，顯示 ${shown} 年。`,
    groups: {
      GF0801: '遊憩與運動服務',
      GF0802: '文化服務',
      GF0803: '廣播與出版',
      GF0804: '宗教與其他社區服務',
      GF0805: '這一類的研發',
      GF0806: '其他',
    } as Record<string, string>,
    aria: (country: string) => `${country}政府在遊憩、文化與宗教各分項的支出占 GDP`,
    total: (pct: string, amount: string) => `合計占 GDP ${pct}（${amount}）`,
    eu: (culture: string, broadcasting: string, religion: string) =>
      `歐盟 27 國合計：文化服務 ${culture}、廣播與出版 ${broadcasting}、宗教與其他社區服務 ${religion}。`,
    note: '聯合國的政府職能分類（COFOG）第 08 類，一般政府（中央、地方與社會安全基金）的支出合計，Eurostat 的金額除以 GDP。運動與休閒在「運動」主題。',
    amount: (v: number) => (v >= 100 ? `${fixed(v / 100, 1)} 億歐元` : `${fixed(v, 0)} 百萬歐元`),
  },
  en: {
    title: (year) => `Government spending on recreation, culture and religion (${year}, % of GDP)`,
    shownInstead: (year, shown) => `No data for ${year}; showing ${shown}.`,
    groups: {
      GF0801: 'Recreation and sport',
      GF0802: 'Cultural services',
      GF0803: 'Broadcasting and publishing',
      GF0804: 'Religious and other community services',
      GF0805: 'R&D in this area',
      GF0806: 'Other',
    },
    aria: (country) => `Government spending of ${country} on recreation, culture and religion by category, as a share of GDP`,
    total: (pct, amount) => `Total ${pct} of GDP (${amount})`,
    eu: (culture, broadcasting, religion) =>
      `EU27 total: cultural services ${culture}, broadcasting and publishing ${broadcasting}, religious and other community services ${religion}.`,
    note: 'Division 08 of the UN Classification of the Functions of Government (COFOG), total spending by general government (central, local and social security funds): Eurostat’s euro amounts divided by GDP. Recreation and sport is also in the Sports topic.',
    amount: (v) => (v >= 1000 ? `€${fixed(v / 1000, 1)} billion` : `€${fixed(v, 0)} million`),
  },
});

const pct = (v: number) => `${fixed(v, 2)}%`;

export function Cofog08({ iso3, year, countryName, indicator, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const { data, loading } = useJson<Cofog08>('topics/culture/cofog08.json');

  const view = useMemo(() => {
    const own = data?.values[iso3];
    if (!data || !own) return null;
    const at = latestIndexAtOrBefore(data.years, year, (i) => data.groups.some((g) => own[g]?.[i] != null));
    if (at < 0) return null;
    const current = INDICATOR_GROUP[indicator.id];
    const items: BarListItem[] = data.groups.flatMap((g) => {
      const v = own[g]?.[at];
      return v == null ? [] : [{ key: g, label: text.groups[g], value: v, color: g === current ? tokens.accent : tokens.context }];
    });
    const total = items.reduce((s, i) => s + i.value, 0);
    const amount = data.groups.reduce((s, g) => s + (data.amounts[iso3]?.[g]?.[at] ?? 0), 0);
    const eu = (g: string) => {
      const v = data.values[EU]?.[g]?.[at];
      return v == null ? '—' : pct(v);
    };
    return { shown: data.years[at], items, total, amount, eu };
  }, [data, iso3, year, indicator.id, text, tokens]);

  if (loading && !data) return <p className="empty">{t.loading}</p>;
  if (!view) return null;
  return (
    <section className="panel-section">
      <h3>{text.title(view.shown)}</h3>
      {view.shown !== year && <p className="note">{text.shownInstead(year, view.shown)}</p>}
      <BarList items={view.items} format={pct} ariaLabel={text.aria(countryName)} />
      <p className="note">{text.total(pct(view.total), text.amount(view.amount))}</p>
      <p className="note">{text.eu(view.eu('GF0802'), view.eu('GF0803'), view.eu('GF0804'))}</p>
      <p className="note">{text.note}</p>
    </section>
  );
}

export default function Cofog08Panel(props: PanelExtraProps) {
  return props.indicator.id in INDICATOR_GROUP ? <Cofog08 {...props} /> : null;
}
