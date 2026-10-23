import { defineMessages, tr, useLang } from '../../i18n';
import { useJson } from '../../lib/data';
import { letters, TAIWAN_OFFSET, utcText, versusTaiwan } from '../travel';
import type { PanelExtraProps } from '../types';

/** details.json（pipeline/topics/travel.py）：每個國家的時區、行車方向、插頭、電壓與頻率 */
interface Detail {
  /** [標準時間, 夏令時間或 null, 全國最早的標準時間, 最晚的標準時間, IANA 時區名稱] */
  tz?: [number, number | null, number, number, string];
  drive?: 'L' | 'R';
  /** 插頭字母，例如 "AB" */
  plugs?: string;
  volts?: number[];
  hz?: number[];
  capital?: string;
}

/** 好幾個電壓、頻率之間的分隔 */
const SLASH = { zh: '／', en: '/' };

const TAIWAN: Required<Pick<Detail, 'plugs' | 'volts' | 'hz' | 'drive'>> = { plugs: 'AB', volts: [110], hz: [60], drive: 'R' };

const TEXT = defineMessages({
  zh: {
    title: '旅行實用：跟台灣比',
    titleTaiwan: '旅行實用：台灣',
    time: '時間',
    drive: '行車方向',
    plugs: '插頭',
    power: '電壓與頻率',
    std: (utc: string, vs: string) => `標準時間 ${utc}，${vs}。`,
    taiwanTime: '標準時間 UTC+8，沒有夏令時間。',
    dst: (utc: string, vs: string) => `有夏令時間：${utc}，${vs}。`,
    noDst: '沒有夏令時間。',
    range: (from: string, to: string, zone: string) => `全國有好幾個時區（標準時間 ${from} 到 ${to}），上面是首都的時區（${zone}）。`,
    left: '靠左行駛，跟台灣相反：過馬路先看右邊，租車時駕駛座在右側。',
    right: '靠右行駛，跟台灣一樣。',
    taiwanDrive: '靠右行駛。',
    plugList: (list: string) => `${list} 型。`,
    plugSame: '跟台灣一樣，台灣的插頭可以直接插（三腳的 B 型插頭要找三孔插座）。',
    plugSome: '有些插座是 A 或 B 型，台灣的插頭可能可以直接插，但不一定每個插座都行，最好帶轉接頭。',
    plugNo: '台灣的 A、B 插頭不能直接插，要帶轉接頭。',
    taiwanPlugs: 'A、B 型（兩扁腳，B 型多一支圓形接地腳）。',
    powerList: (volts: string, hz: string) => `${volts}、${hz}。`,
    powerLow: '電壓跟台灣（110 V）差不多，台灣的電器一般可以直接用。',
    powerHigh: '電壓約是台灣的兩倍：先看電器或充電器上的標示，寫 100–240 V 的（多數手機、筆電充電器）可以直接用，只寫 110 V 的（例如吹風機、電熨斗）要用變壓器。',
    hzDiff: '頻率跟台灣（60 Hz）不同，有馬達或計時功能的電器可能受影響。',
    taiwanPower: '110 V、60 Hz（冷氣、烤箱等大型電器另有 220 V 的線路）。',
    unknown: '沒有資料。',
  },
  en: {
    title: 'Travel essentials compared with Taiwan',
    titleTaiwan: 'Travel essentials: Taiwan',
    time: 'Time',
    drive: 'Driving side',
    plugs: 'Plugs',
    power: 'Voltage and frequency',
    std: (utc, vs) => `Standard time ${utc}, ${vs}.`,
    taiwanTime: 'Standard time UTC+8, no daylight saving time.',
    dst: (utc, vs) => `Daylight saving time: ${utc}, ${vs}.`,
    noDst: 'No daylight saving time.',
    range: (from, to, zone) => `Several time zones (standard time ${from} to ${to}); the above is the capital’s (${zone}).`,
    left: 'Drives on the left, unlike Taiwan: look right first when crossing, and the driver sits on the right.',
    right: 'Drives on the right, like Taiwan.',
    taiwanDrive: 'Drives on the right.',
    plugList: (list) => `Type ${list}.`,
    plugSame: 'Same as Taiwan, so Taiwanese plugs fit (three-pin type B plugs need a three-hole socket).',
    plugSome: 'Some sockets take type A or B, so Taiwanese plugs may fit, but not every socket will; bring an adapter.',
    plugNo: 'Taiwanese type A and B plugs do not fit; bring an adapter.',
    taiwanPlugs: 'Types A and B (two flat pins; type B adds a round earth pin).',
    powerList: (volts, hz) => `${volts}, ${hz}.`,
    powerLow: 'Similar voltage to Taiwan (110 V), so Taiwanese appliances generally work.',
    powerHigh:
      'About twice Taiwan’s voltage: check the label on the appliance or charger. Those rated 100–240 V (most phone and laptop chargers) work as they are; those rated only for 110 V (hair dryers, irons) need a transformer.',
    hzDiff: 'The frequency differs from Taiwan’s 60 Hz, which may affect appliances with motors or timers.',
    taiwanPower: '110 V, 60 Hz (large appliances such as air conditioners and ovens use separate 220 V circuits).',
    unknown: 'No data.',
  },
});

export default function TravelPanel({ topic, iso3 }: PanelExtraProps) {
  const lang = useLang();
  const text = TEXT[lang];
  const { data } = useJson<Record<string, Detail>>(`topics/${topic.id}/details.json`);
  const d = data?.[iso3];
  if (!data) return null;
  const taiwan = iso3 === 'TWN';

  const time = (() => {
    if (taiwan) return [text.taiwanTime];
    if (!d?.tz) return [text.unknown];
    const [std, dst, min, max, zone] = d.tz;
    const lines = [text.std(utcText(std), versusTaiwan(std - TAIWAN_OFFSET))];
    lines.push(dst === null ? text.noDst : text.dst(utcText(dst), versusTaiwan(dst - TAIWAN_OFFSET)));
    if (min !== max) lines.push(text.range(utcText(min), utcText(max), zone));
    return lines;
  })();

  const drive = taiwan ? text.taiwanDrive : !d?.drive ? text.unknown : d.drive === 'L' ? text.left : text.right;

  const plugs = (() => {
    if (taiwan) return [text.taiwanPlugs];
    if (!d?.plugs) return [text.unknown];
    const set = new Set(d.plugs);
    const ab = [...set].filter((p) => p === 'A' || p === 'B').length;
    const advice = ab === set.size ? text.plugSame : ab > 0 ? text.plugSome : text.plugNo;
    return [text.plugList(letters(d.plugs)), advice];
  })();

  const power = (() => {
    if (taiwan) return [text.taiwanPower];
    if (!d?.volts?.length || !d.hz?.length) return [text.unknown];
    const volts = [...new Set(d.volts)].map((v) => `${v} V`).join(tr(SLASH, lang));
    const hz = d.hz.map((h) => `${h} Hz`).join(tr(SLASH, lang));
    const lines = [text.powerList(volts, hz), d.volts[0] <= 130 ? text.powerLow : text.powerHigh];
    if (d.hz.some((h) => h !== TAIWAN.hz[0])) lines.push(text.hzDiff);
    return lines;
  })();

  const rows: [string, string[]][] = [
    [text.time, time],
    [text.drive, [drive]],
    [text.plugs, plugs],
    [text.power, power],
  ];
  return (
    <section className="panel-section">
      <h3>{taiwan ? text.titleTaiwan : text.title}</h3>
      <dl className="travel-facts">
        {rows.map(([label, lines]) => (
          <div key={label}>
            <dt>{label}</dt>
            {lines.map((line) => (
              <dd key={line}>{line}</dd>
            ))}
          </div>
        ))}
      </dl>
    </section>
  );
}
