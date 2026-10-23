import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, ScaleSpec, TopicDefinition } from './types';

/** 指數的值（0–1）寫到小數兩位，跟 V-Dem 自己的寫法一樣 */
const index = (v: number) => fixed(v, 2);
/** 圖例與折線圖刻度：0、0.2、0.35 */
const indexTick = (v: number) => fixed(v, v === 0 ? 0 : Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2);
/** 指標名稱已經有「指數」，單位只寫範圍：圖例標題是「選舉民主指數（0–1）」，不是「選舉民主指數（指數（0–1））」 */
const INDEX_UNIT = '0–1';

/**
 * 政體分類：V-Dem 的 Regimes of the World（v2x_regime），代碼就是 V-Dem 的 0–3（pipeline/topics/democracy.py 的 REGIME_NAMES）。
 * 從封閉專制排到自由民主（diverging）：專制在橘色那一側、民主在青綠那一側，越靠兩端越深。
 * 選這個方向是因為「專制暖色、民主冷色」是政體地圖常見的讀法（中國深橘、台灣深青綠），
 * 圖例也照 V-Dem 代碼由小到大、跟面量圖的圖例一樣由低到高。
 */
const REGIMES: CategoryDef[] = [
  { value: 0, label: { zh: '封閉專制', en: 'Closed autocracy' } },
  { value: 1, label: { zh: '選舉專制', en: 'Electoral autocracy' } },
  { value: 2, label: { zh: '選舉民主', en: 'Electoral democracy' } },
  { value: 3, label: { zh: '自由民主', en: 'Liberal democracy' } },
];
const regimeLabel = new Map(REGIMES.map((r) => [r.value, r.label]));

/**
 * 三個指數用同一組發散色門檻，切換時顏色可以互相比較，也跟政體分類同一個讀法：橘色偏專制、青綠偏民主。
 * 中間的中性灰跨過 0.5（政體分類裡選舉民主的門檻之一）。
 */
const DEMOCRACY_SCALE: ScaleSpec = { type: 'diverging', thresholds: [0.2, 0.35, 0.45, 0.55, 0.65, 0.8] };

export const democracy: TopicDefinition = {
  id: 'democracy',
  title: { zh: '民主與自由', en: 'Democracy and freedom' },
  shortTitle: { zh: '民主與自由', en: 'Democracy' },
  defaultIndicator: 'regime',
  defaultYear: 2025,
  sources: [
    {
      name: 'Coppedge, Michael, John Gerring, Carl Henrik Knutsen, Staffan I. Lindberg, Jan Teorell, David Altman, et al. 2026. "V-Dem Country-Year Dataset v16". Varieties of Democracy (V-Dem) Project',
      url: 'https://doi.org/10.23696/vdemds26',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: 'V-Dem 的指數是各國專家逐年評分、再用統計模型合成的估計值，有不確定範圍（側欄列出 68% 可信區間），分數接近的國家高低不一定有意義。殖民地與被占領的時期也有評分（例如日本統治下的台灣），是當時統治者的分數。國家依 V-Dem 自己的接續方式對到今天的國界：德國 1949–1990 年是西德、俄羅斯 1918–1990 年是蘇聯、塞爾維亞 1918–2005 年是南斯拉夫；東德、南越、南葉門、加薩走廊等在今天的地圖上沒有形狀的政體沒有放，巴勒斯坦用約旦河西岸的值。世界值是有資料國家的簡單平均（每國一樣重，不依人口加權）。V-Dem 資料是 CC BY-SA 4.0 授權，這個主題的衍生資料檔也依 CC BY-SA 4.0 分享。',
    en: "V-Dem indices are estimates: country experts rate each country every year and a statistical model combines their ratings, so every score has an uncertainty range (the side panel shows the 68% credible interval) and countries with close scores may not really differ. Colonies and occupied territories are scored too (for example Taiwan under Japanese rule), reflecting whoever governed them at the time. Countries follow V-Dem's own continuity onto today's borders: Germany in 1949–1990 is West Germany, Russia in 1918–1990 the Soviet Union, Serbia in 1918–2005 Yugoslavia; polities with no shape on today's map (East Germany, South Vietnam, South Yemen, the Gaza Strip and others) are not shown, and Palestine shows the West Bank. The world value is the simple average of countries with data (each country counts equally, not weighted by population). V-Dem data are licensed under CC BY-SA 4.0, and the derived data files for this topic are shared under CC BY-SA 4.0 as well.",
  },
  panelExtra: () => import('./panels/DemocracyPanel'),
  indicators: [
    {
      id: 'regime',
      label: { zh: '政體分類', en: 'Regime type' },
      description: {
        zh: 'V-Dem 的政體分類（Regimes of the World）。封閉專制：行政首長或國會不是由多黨選舉產生；選舉專制：有多黨選舉，但不夠自由公正，或缺乏言論、結社自由；選舉民主：選舉自由公正，也有基本的自由；自由民主：再加上法治、司法獨立與國會對行政權的制衡。滑過或點選圖例可以只看某一類。',
        en: "V-Dem's Regimes of the World classification. Closed autocracy: the chief executive or legislature is not chosen in multiparty elections. Electoral autocracy: there are multiparty elections, but they are not free and fair, or freedom of expression and association are lacking. Electoral democracy: free and fair elections with basic freedoms. Liberal democracy: in addition, the rule of law, judicial independence and legislative checks on the executive. Hover over or click the legend to show a single type.",
      },
      unit: '',
      file: 'regime.json',
      layer: { kind: 'categorical', categories: REGIMES, diverging: true },
      format: (v) => tr(regimeLabel.get(v) ?? { zh: '其他', en: 'Other' }),
    },
    {
      id: 'electoral-democracy',
      label: { zh: '選舉民主指數', en: 'Electoral democracy index' },
      description: {
        zh: '選舉民主的程度：選舉是否自由公正、成年人是否都有投票權、行政首長與國會是否由選舉產生，以及結社自由與言論自由。0 到 1，越高越民主；政體分類要 0.5 以上（加上選舉自由公正）才可能算選舉民主。',
        en: 'How far the ideal of electoral democracy is achieved: free and fair elections, universal adult suffrage, an elected executive and legislature, and freedom of association and expression. From 0 to 1, higher is more democratic; in the regime classification a country needs more than 0.5 (and free and fair elections) to count as an electoral democracy.',
      },
      unit: INDEX_UNIT,
      file: 'electoral-democracy.json',
      layer: { kind: 'choropleth', scale: DEMOCRACY_SCALE },
      format: index,
      formatTick: indexTick,
      compareWorld: true,
    },
    {
      id: 'liberal-democracy',
      label: { zh: '自由民主指數', en: 'Liberal democracy index' },
      description: {
        zh: '在選舉民主之外，再看法律之前人人平等、公民自由的保障、司法獨立，以及國會對行政權的制衡。0 到 1，越高越民主，通常比選舉民主指數低。',
        en: 'Electoral democracy plus equality before the law, protection of civil liberties, judicial independence and legislative checks on the executive. From 0 to 1, higher is more democratic; usually lower than the electoral democracy index.',
      },
      unit: INDEX_UNIT,
      file: 'liberal-democracy.json',
      layer: { kind: 'choropleth', scale: DEMOCRACY_SCALE },
      format: index,
      formatTick: indexTick,
      compareWorld: true,
    },
    {
      id: 'free-expression',
      label: { zh: '言論自由指數', en: 'Freedom of expression index' },
      description: {
        zh: '言論自由與多元資訊：政府是否尊重新聞與媒體自由，一般人能否在家裡與公開場合自由談論政治，學術與文化表達是否自由，以及媒體是否多元、敢批評政府。0 到 1，越高越自由。',
        en: 'Freedom of expression and alternative sources of information: whether the government respects press and media freedom, whether ordinary people can discuss politics freely at home and in public, academic and cultural freedom, and whether the media are diverse and willing to criticise the government. From 0 to 1, higher is freer.',
      },
      unit: INDEX_UNIT,
      file: 'free-expression.json',
      layer: { kind: 'choropleth', scale: DEMOCRACY_SCALE },
      format: index,
      formatTick: indexTick,
      compareWorld: true,
    },
  ],
};
