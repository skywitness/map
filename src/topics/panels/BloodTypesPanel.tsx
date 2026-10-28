import { useMemo } from 'react';
import { BarList } from '../../charts/BarList';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue } from '../../theme/tokens';
import type { PanelExtraProps } from '../types';

/** pipeline/topics/blood_types.py 的 types.json：每個國家 8 種血型（TYPES 的順序）、加總、出處 */
interface BloodTypesFile {
  revision: number;
  page: string;
  types: string[];
  units: Record<string, { v: (number | null)[]; sum: number; ref?: [string, string]; fv?: 1 }>;
}

/** 同一型的 Rh 陽性與陰性用同一個色相 */
const HUES: Record<string, Hue> = { O: 'blue', A: 'orange', B: 'aqua', AB: 'violet' };

const TEXT = defineMessages({
  zh: {
    title: '8 種血型',
    sep: '、',
    aria: (country: string) => `${country}的 8 種血型比例`,
    source: '出處（維基百科引用的資料）：',
    noSource: '維基百科沒有註明出處。',
    failed: '維基百科標註這個出處「未能核實」（Failed verification）。',
    sum: (v: string) => `8 種加起來是 ${v}%，不是 100%（四捨五入或原始資料不完整）。`,
    abo: '維基百科的表只有 ABO 血型，沒有分 Rh 陽性與陰性（四型的比例見上面的數值）。',
    missing: (types: string) => `${types}：表上沒有數字。`,
  },
  en: {
    title: 'The eight blood types',
    sep: ', ',
    aria: (country) => `Shares of the eight blood types in ${country}`,
    source: 'Source (cited on Wikipedia): ',
    noSource: 'No source is cited on Wikipedia.',
    failed: 'Wikipedia marks this source as “failed verification”.',
    sum: (v) => `The eight types add up to ${v}%, not 100% (rounding or incomplete original data).`,
    abo: 'Wikipedia’s table gives only ABO groups here, with no Rh split (see the figures above for the four groups).',
    missing: (types) => `${types}: no figure in the table.`,
  },
});

const pct = (v: number) => `${fixed(v, v < 1 ? 2 : 1)}%`;

/** 出處的連結文字：有標題用標題，沒有用網址的網域 */
function refLabel([title, url]: [string, string]): string {
  if (title) return title;
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function BloodTypesPanel({ topic, iso3, countryName, tokens }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<BloodTypesFile>(`topics/${topic.id}/types.json`);
  const unit = data?.units[iso3];

  const items = useMemo(() => {
    if (!data || !unit) return null;
    const groupOf = (t: string) => t.replace(/[+-]/, '');
    // 埃及這類只有 ABO 的：8 種全是 null，不畫長條，只寫說明（四型的比例在上面的數值卡片）
    return data.types.flatMap((t, i) => {
      const v = unit.v[i];
      if (v == null) return [];
      return [{ key: t, label: t.replace('-', '−'), value: v, color: tokens.hues[HUES[groupOf(t)]] }];
    });
  }, [data, unit, tokens]);

  if (!data || !unit || !items) return null;
  const missing = data.types.filter((_, i) => unit.v[i] == null);
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      {items.length > 0 ? (
        <BarList items={items} format={pct} max={Math.max(...items.map((i) => i.value))} ariaLabel={text.aria(countryName)} />
      ) : (
        <p className="note">{text.abo}</p>
      )}
      {items.length > 0 && missing.length > 0 && (
        <p className="note">
          {text.missing(missing.map((t) => t.replace('-', '−')).join(text.sep))}
        </p>
      )}
      {items.length === 8 && Math.abs(unit.sum - 100) > 0.5 && <p className="note">{text.sum(fixed(unit.sum, 1))}</p>}
      <p className="note">
        {unit.ref ? (
          <>
            {text.source}
            {unit.ref[1] ? (
              <a href={unit.ref[1]} target="_blank" rel="noreferrer" translate="no">
                {refLabel(unit.ref)}
              </a>
            ) : (
              <span translate="no">{unit.ref[0]}</span>
            )}
            {unit.fv && <> {text.failed}</>}
          </>
        ) : (
          text.noSource
        )}
      </p>
    </section>
  );
}
