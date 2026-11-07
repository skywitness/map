import { BarList } from '../../charts/BarList';
import { defineMessages, tr, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { useMapTokens } from '../../map/palettes';
import { SKY_CLASSES } from '../light-pollution';
import type { PanelExtraProps } from '../types';

/**
 * 光害的側欄（2026-11-07，第二十五批 489）：這一國的人口與國土在 6 級夜空亮度的比例（pipeline/topics/light_pollution.py
 * 輸出的 classes.json），顏色用地圖目前選的循序色（useMapTokens），越亮越深
 */
interface ClassesFile {
  year: number;
  classes: Record<string, { pop?: number[]; area?: number[] }>;
  world: { pop: number[]; area: number[] };
}

const TEXT = defineMessages({
  zh: {
    pop: '人口住在哪一級的夜空下',
    area: '國土的夜空亮度',
    aria: (c: string, what: string) => `${c}：${what}`,
  },
  en: {
    pop: 'Population by night-sky level',
    area: 'Land by night-sky level',
    aria: (c: string, what: string) => `${c}: ${what}`,
  },
});

/** 6 級用循序色的哪幾階（7 階裡跳過第 5 階，最亮的兩級分得開） */
const STEPS = [0, 1, 2, 3, 5, 6];

export default function LightPollutionPanel({ topic, iso3, countryName }: PanelExtraProps) {
  const lang = useLang();
  const mapTokens = useMapTokens();
  const text = TEXT[lang];
  const { data } = useJson<ClassesFile>(`topics/${topic.id}/classes.json`);
  const entry = data?.classes[iso3];
  if (!entry) return null;
  const items = (shares: number[]) =>
    shares.map((v, i) => ({ key: String(i), label: tr(SKY_CLASSES[i], lang), value: v, color: mapTokens.sequential[STEPS[i]] }));
  const format = (v: number) => `${fixed(v, v > 0 && v < 1 ? 2 : 1)}%`;
  return (
    <>
      {entry.pop && (
        <section className="panel-section">
          <h3>{text.pop}</h3>
          <BarList items={items(entry.pop)} format={format} max={100} ariaLabel={text.aria(countryName, text.pop)} />
        </section>
      )}
      {entry.area && (
        <section className="panel-section">
          <h3>{text.area}</h3>
          <BarList items={items(entry.area)} format={format} max={100} ariaLabel={text.aria(countryName, text.area)} />
        </section>
      )}
    </>
  );
}
