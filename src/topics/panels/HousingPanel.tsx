import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { latestIndexAtOrBefore } from '../../charts/stackedArea';
import { defineMessages, tr, useLang, useT, type Text } from '../../i18n';
import { useJsonMany } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { IndicatorData, PanelExtraProps } from '../types';

interface Part {
  id: string;
  label: Text;
  hue: Hue;
}

/** 各國的住宅類型（公寓比例就是地圖指標本身的檔案），順序是畫面上的順序 */
const PARTS: (Part & { file: string })[] = [
  { id: 'detached', file: 'dwelling-detached.json', label: { zh: '獨棟', en: 'Detached house' }, hue: 'orange' },
  { id: 'semi', file: 'dwelling-semi.json', label: { zh: '雙併、連棟', en: 'Semi-detached or terraced house' }, hue: 'yellow' },
  { id: 'flat', file: 'apartment-share.json', label: { zh: '公寓、大樓', en: 'Apartment' }, hue: 'aqua' },
  { id: 'other', file: 'dwelling-other.json', label: { zh: '其他（含未分類）', en: 'Other (incl. unspecified)' }, hue: 'violet' },
];

/** 台灣官方統計只依整棟建築的總樓層分類（dwelling-taiwan.json，鍵是樓層而不是國家） */
const TAIWAN_FILE = 'dwelling-taiwan.json';
const TAIWAN_PARTS: Part[] = [
  {
    id: 'floors-1-3',
    label: { zh: '1–3 層（多為透天厝、平房）', en: '1–3 floors (mostly townhouses and bungalows)' },
    hue: 'orange',
  },
  { id: 'floors-4-5', label: { zh: '4–5 層（多為無電梯公寓）', en: '4–5 floors (mostly walk-up apartments)' }, hue: 'aqua' },
  { id: 'floors-6-10', label: { zh: '6–10 層（多為華廈）', en: '6–10 floors (mostly mid-rise apartments)' }, hue: 'blue' },
  { id: 'floors-11', label: { zh: '11 層以上（住宅大樓）', en: '11 floors or more (high-rise apartments)' }, hue: 'violet' },
];

const TEXT = defineMessages({
  zh: {
    title: '住宅類型',
    split: (year: number) => `${year} 年住宅類型的組成`,
    listAria: (country: string, year: number) => `${country} ${year} 年各類住宅的比例`,
    noData: '沒有這個國家的住宅類型資料：只有歐洲、部分 OECD 國家與台灣有。',
    taiwan: '依房屋稅籍住宅所在建築的總樓層分類（台灣官方統計沒有透天、公寓的分類），括號裡是常見的住宅型態。',
  },
  en: {
    title: 'Dwelling types',
    split: (year) => `Dwelling types, ${year}`,
    listAria: (country, year) => `Share of each dwelling type in ${country}, ${year}`,
    noData: 'No dwelling type data for this country: only Europe, some other OECD countries and Taiwan are covered.',
    taiwan:
      "Dwellings on the property tax register by the number of floors of their building (Taiwan's official statistics do not separate houses from apartments); the usual type of dwelling is in brackets.",
  },
});

const pct = (v: number) => `${fixed(v, 1)}%`;

export default function HousingPanel({ topic, iso3, year, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const taiwan = iso3 === 'TWN';
  const files = useMemo(
    () => (taiwan ? [TAIWAN_FILE, 'apartment-share.json'] : PARTS.map((p) => p.file)).map((f) => `topics/${topic.id}/${f}`),
    [topic.id, taiwan],
  );
  const loaded = useJsonMany<IndicatorData>(files);

  const view = useMemo(() => {
    if (!loaded.every(Boolean)) return null;
    const data = loaded as IndicatorData[];
    const parts = taiwan ? TAIWAN_PARTS : PARTS;
    // 每一類的序列：台灣的檔案鍵是樓層，其他國家每一類一個檔、鍵是國家
    const series = parts.map((p, i) => (taiwan ? data[0].values[p.id] : data[i].values[iso3]));
    const years = data[0].years;
    // 跟地圖一樣，沒有當年資料時用 latestWithin 年內最近一年的
    const within = data[taiwan ? 1 : 2].latestWithin ?? 0;
    const index = latestIndexAtOrBefore(years, year, (i) => series.some((s) => s?.[i] != null));
    if (index < 0 || year - years[index] > within) return { items: [], shownYear: null };
    const items = parts
      .map((p, i) => ({ key: p.id, label: tr(p.label, lang), value: series[i]?.[index] ?? 0, color: tokens.hues[p.hue] }))
      .filter((item) => item.value > 0);
    return { items, shownYear: years[index] };
  }, [loaded, taiwan, iso3, year, tokens, lang]);

  if (!view) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {view.shownYear === null ? (
        <p className="empty">{text.noData}</p>
      ) : (
        <>
          <h4>
            {text.split(view.shownYear)}
            {view.shownYear !== year && <span className="muted">{t.yearMissing(year)}</span>}
          </h4>
          <BarList items={view.items} format={pct} max={100} ariaLabel={text.listAria(countryName, view.shownYear)} />
          {taiwan && <p className="note">{text.taiwan}</p>}
        </>
      )}
    </section>
  );
}
