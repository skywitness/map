import { defineMessages, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { fixed } from '../../lib/format';
import { TRUCK_IDS } from '../trucks';
import { dataFolder, type PanelExtraProps } from '../types';
import { TrucksSection } from './TrucksPanel';

/** car-age-detail.json（pipeline/topics/car_age.py）：每國每年五組車齡占小客車的 % */
interface CarAgeDetail {
  ages: string[];
  countries: Record<string, Record<string, number[]>>;
}

const CAR_AGE = ['car-age-20', 'car-age-new'];

const TEXT = defineMessages({
  zh: {
    title: (y: string) => `小客車的車齡（${y} 年，Eurostat）`,
    aria: '各組車齡占小客車的比例',
    bands: ['未滿 2 年', '2–5 年', '5–10 年', '10–20 年', '超過 20 年'],
  },
  en: {
    title: (y: string) => `Passenger cars by age (${y}, Eurostat)`,
    aria: 'Share of passenger cars by age band',
    bands: ['Under 2 years', '2–5 years', '5–10 years', '10–20 years', 'Over 20 years'],
  },
});

/** 汽機車的側欄：車齡的兩個指標（第二十三批 403）列五組車齡；最近一年，或時間軸那一年有資料時用那一年 */
export default function CarAgePanel(props: PanelExtraProps) {
  // 卡車與公車（第二十七批 577）：依動力的組成
  if (TRUCK_IDS.includes(props.indicator.id)) return <TrucksSection {...props} />;
  return <CarAgeSection {...props} />;
}

function CarAgeSection({ topic, indicator, iso3, year }: PanelExtraProps) {
  const text = TEXT[useLang()];
  // 汽機車併進「汽機車與電動車」（ev）後，指標檔是 ../road-safety/…：側欄的檔跟著指標的資料夾
  const folder = indicator.file.startsWith('../') ? indicator.file.split('/')[1] : dataFolder(topic);
  const d = useJson<CarAgeDetail>(`topics/${folder}/car-age-detail.json`).data;
  if (!CAR_AGE.includes(indicator.id) || !d) return null;
  const byYear = d.countries[iso3];
  if (!byYear) return null;
  const y = byYear[String(year)] ? String(year) : Object.keys(byYear).sort().at(-1)!;
  const shares = byYear[y];
  return (
    <section className="panel-section">
      <h3>{text.title(y)}</h3>
      <table className="mini-table" aria-label={text.aria}>
        <tbody>
          {shares.map((v, i) => (
            <tr key={d.ages[i]}>
              <th scope="row">{text.bands[i]}</th>
              <td className="num">{fixed(v, 1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
