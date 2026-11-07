import { useMemo } from 'react';
import { defineMessages, useLang, useT } from '../../i18n';
import { useJson } from '../../lib/data';
import { decodePoints } from '../../map/overlayData';
import { festivalFacts, festivalName, nameIsOriginal } from '../festivals';
import { calendarShort, HOLIDAY_INDICATOR_IDS, holidayFestivalLabel } from '../festivals-holidays';
import type { PanelExtraProps, PointsData } from '../types';

/** pipeline/topics/holiday_calendars.py 的 holiday-list/<ISO3>.json：[月-日, 原文名稱, 中文名稱, 英文名稱, 曆法類別, 節日] */
type HolidayRow = [string, string, string | null, string | null, number, string[]];

const HOLIDAY_TEXT = defineMessages({
  zh: {
    title: (country: string, n: number) => `${country} 2026 年的公共假日（${n} 天）`,
    date: (md: string) => `${Number(md.slice(0, 2))} 月 ${Number(md.slice(3))} 日`,
    none: 'holidays 套件沒有這個國家或地區的假日。',
    note: '不含補假；聯邦制國家只列全國層級的假日。曆法依套件裡加假日的程式判斷，「一次性」是選舉日、臨時放假這類不是每年都有的假日。',
  },
  en: {
    title: (country, n) => `Public holidays in ${country}, 2026 (${n} days)`,
    date: (md) => new Date(Date.UTC(2026, Number(md.slice(0, 2)) - 1, Number(md.slice(3)))).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    none: 'The holidays package has no holidays for this country or territory.',
    note: 'Substitute days are left out; federal countries list national holidays only. The calendar is judged from the code in the package that adds each holiday; “one-off” marks holidays such as election days or ad hoc closures that do not recur every year.',
  },
});

/** 節日與曆法的三個指標：這一國 2026 年的公共假日清單（2026-11-07，製作手冊 559） */
function HolidayList({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = HOLIDAY_TEXT[lang];
  const { data, error } = useJson<HolidayRow[]>(`topics/${topic.id}/holiday-list/${iso3}.json`);
  if (error) return <p className="empty">{text.none}</p>;
  if (!data) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      <h3>{text.title(countryName, data.length)}</h3>
      <ul className="plain-list">
        {data.map(([md, name, zh, en, cls, fams], i) => {
          // 中文介面沒有中文名稱時用英文名稱（比原文好讀），原文寫在下一行
          const own = lang === 'zh' ? (zh ?? en) : en;
          return (
            <li key={i}>
              <span className="plain-title">
                {text.date(md)}{' '}
                {own ?? (
                  <span translate="no">{name}</span>
                )}
              </span>
              {own && own !== name && (
                <span className="plain-meta" translate="no">
                  {name}
                </span>
              )}
              <span className="plain-meta">
                {[calendarShort(cls), ...fams.map(holidayFestivalLabel)].filter(Boolean).join(' · ')}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="note">{text.note}</p>
    </section>
  );
}

const TEXT = defineMessages({
  zh: {
    title: (country: string, n: number) => `${country}的節慶（${n} 個）`,
    none: 'Wikidata 與文資局的資料裡沒有這個國家的節慶。',
    note: '有月份的依月份排在前面，其他依維基百科條目數（比較有名的在前）。',
  },
  en: {
    title: (country, n) => `Festivals in ${country} (${n})`,
    none: 'Neither Wikidata nor the Taiwanese registry lists a festival here.',
    note: 'Festivals with a known month come first, by month; the rest by number of Wikipedia articles (best known first).',
  },
});

export default function FestivalsPanel(props: PanelExtraProps) {
  return HOLIDAY_INDICATOR_IDS.has(props.indicator.id) ? <HolidayList {...props} /> : <FestivalList {...props} />;
}

function FestivalList({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const t = useT();
  const text = TEXT[lang];
  const dated = useJson<PointsData>(`topics/${topic.id}/festivals.json`);
  const undated = useJson<PointsData>(`topics/${topic.id}/festivals-undated.json`);
  const rows = useMemo(() => {
    if (!dated.data || !undated.data) return null;
    const a = decodePoints(dated.data).filter((p) => p.iso3 === iso3).sort((x, y) => Number(x.m) - Number(y.m));
    const b = decodePoints(undated.data).filter((p) => p.iso3 === iso3).sort((x, y) => Number(y.sl) - Number(x.sl));
    return [...a, ...b];
  }, [dated.data, undated.data, iso3]);
  if (dated.error || undated.error) return <p className="empty">{t.loadFailed((dated.error ?? undated.error)!.message)}</p>;
  if (!rows) return <p className="empty">{t.loading}</p>;
  return (
    <section className="panel-section">
      {rows.length === 0 ? (
        <p className="empty">{text.none}</p>
      ) : (
        <>
          <h3>{text.title(countryName, rows.length)}</h3>
          <ul className="plain-list">
            {rows.slice(0, 300).map((p, i) => {
              const name = festivalName(p);
              return (
                <li key={i}>
                  {nameIsOriginal(p) ? (
                    <span className="plain-title" translate="no" lang="zh-Hant">
                      {name}
                    </span>
                  ) : (
                    <span className="plain-title">{name}</span>
                  )}
                  {lang === 'zh' && typeof p.en === 'string' && p.en !== name && (
                    <span className="plain-meta" translate="no">
                      {p.en}
                    </span>
                  )}
                  <span className="plain-meta">{festivalFacts(p)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="note">{text.note}</p>
    </section>
  );
}
