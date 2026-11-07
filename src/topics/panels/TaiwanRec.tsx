import { useMemo } from 'react';
import { Chart } from '../../charts/Chart';
import { stackedAreaOption } from '../../charts/stackedArea';
import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import type { Hue, Tokens } from '../../theme/tokens';

/**
 * 「發電量」台灣側欄的再生能源憑證（T-REC）發放張數（2026-11-07，製作手冊第二十七批 621；pipeline/topics/taiwan_rec.py）：
 * 經濟部標準檢驗局的逐年、依能源類型的張數，一張 ＝ 1,000 度。顏色跟上面發電結構的同一種能源一致。
 */
interface RecFile {
  years: number[];
  types: string[];
  values: Record<string, number[]>;
}

const TYPES: Record<string, { zh: string; en: string; hue: Hue }> = {
  wind: { zh: '風力', en: 'Wind', hue: 'magenta' },
  solar: { zh: '太陽能', en: 'Solar', hue: 'yellow' },
  hydro: { zh: '水力', en: 'Hydro', hue: 'blue' },
  bio: { zh: '生質能', en: 'Bioenergy', hue: 'green' },
  geothermal: { zh: '地熱', en: 'Geothermal', hue: 'orange' },
  other: { zh: '其他', en: 'Other', hue: 'aqua' },
};

const TEXT = defineMessages({
  zh: {
    title: '再生能源憑證（T-REC）的發放張數',
    aria: '台灣歷年依能源類型的再生能源憑證發放張數，2017 年起',
    unit: (v: number) => (v >= 10000 ? `${fixed(v / 10000, 1)} 萬張` : `${fixed(v, 0)} 張`),
    tick: (v: number) => (v >= 10000 ? `${fixed(v / 10000, 0)} 萬` : fixed(v, 0)),
    note: (y: number, total: number) =>
      `經濟部標準檢驗局統計，一張憑證代表 1,000 度綠電。${y} 年發放 ${fixed(total, 0)} 張（約 ${fixed(total / 1e5, 1)} 億度）。「發放」不等於買賣或轉供，也不是綠電占發電量的比例；國際上沒有可用的各國憑證統計，只有台灣。`,
  },
  en: {
    title: 'Renewable energy certificates (T-REC) issued',
    aria: 'Taiwan renewable energy certificates issued by energy type, from 2017',
    unit: (v: number) => `${fixed(v / 1000, v < 10000 ? 1 : 0)} thousand`,
    tick: (v: number) => `${fixed(v / 1000, 0)}k`,
    note: (y: number, total: number) =>
      `Bureau of Standards, Metrology and Inspection statistics; one certificate represents 1,000 kWh of renewable electricity. In ${y}, ${fixed(total, 0)} certificates were issued (about ${fixed(total / 1e6, 2)} TWh). Issuance is not the same as trading or transfer, nor the renewable share of generation; no usable certificate statistics exist for other countries, so this is Taiwan only.`,
  },
});

export function TaiwanRec({ topicId, year, tokens }: { topicId: string; year: number; tokens: Tokens }) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<RecFile>(`topics/${topicId}/tw-rec.json`);
  const chart = useMemo(() => {
    if (!data) return null;
    const at = Math.min(Math.max(year, data.years[0]), data.years[data.years.length - 1]);
    return stackedAreaOption({
      years: data.years,
      series: data.types.map((t) => ({ name: TYPES[t]?.[lang] ?? t, values: data.values[t], color: tokens.hues[TYPES[t]?.hue ?? 'aqua'] })),
      year: at,
      format: text.unit,
      formatTick: text.tick,
    });
  }, [data, lang, text, tokens, year]);
  if (!data || !chart) return null;
  const last = data.years.length - 1;
  const total = data.types.reduce((s, t) => s + (data.values[t][last] ?? 0), 0);
  return (
    <section className="panel-section">
      <h3>{text.title}</h3>
      <Chart spec={chart} height={180} ariaLabel={text.aria} />
      <p className="note">{text.note(data.years[last], total)}</p>
    </section>
  );
}
