/**
 * 在瀏覽器裡算的指標（IndicatorDef.derive，時刻主題）：App 的地圖、排名表與國家側欄都經過 derivedData()，
 * 同一個指標、同一份材料、同一個時刻拿到同一個物件，下游的 useMemo（各國數值、地圖顏色）才不會白做工。
 * 每個指標只留最近幾個時刻的結果：播放一年時每一格都是新的一天，不會越積越多。
 */
import type { ClockAt, Indicator, IndicatorData } from '../topics/types';

const KEEP = 4;
const cache = new WeakMap<object, Map<string, IndicatorData>>();

/** 指標的值跟著什麼變（derive.per）決定快取的鍵：分鐘、日期，或不隨時刻變（只看年份） */
function keyOf(per: NonNullable<Indicator['derive']>['per'], at: ClockAt): string {
  if (per === 'minute') return `m${Math.floor(at.time / 60_000)}`;
  if (per === 'day') return `d${at.day}`;
  return `y${Math.floor(at.day / 10000)}`;
}

/** 看起來是指標檔（有 years 與 values）：換主題時 useJson 還拿著上一個主題的檔，可能是時刻主題的材料 */
function isIndicatorData(source: unknown): source is IndicatorData {
  return Boolean(source && typeof source === 'object' && Array.isArray((source as IndicatorData).years) && (source as IndicatorData).values);
}

/**
 * source 要是這個指標自己的資料檔：useJson 載入新檔的期間還拿著上一個檔（換主題時是別的主題的檔），
 * App 在載入中傳 null 給 derive 的指標；一般指標拿到的不是指標檔（上一個是時刻主題的材料）時也當成還沒載入
 */
export function derivedData(indicator: Pick<Indicator, 'id' | 'derive'>, source: unknown, at: ClockAt | null): IndicatorData | null {
  const derive = indicator.derive;
  if (!derive) return isIndicatorData(source) ? source : null;
  if (!source || !at || typeof source !== 'object') return null;
  let byKey = cache.get(source);
  if (!byKey) cache.set(source, (byKey = new Map()));
  const key = `${indicator.id}|${keyOf(derive.per, at)}`;
  let data = byKey.get(key);
  if (!data) {
    // 算出來的只有一個時間點（years 是 [at.day]；'fixed' 的是第一次算的那天），App 與側欄取第 0 筆
    data = derive.values(source, at);
    byKey.set(key, data);
    // 同一個指標只留最近 KEEP 個時刻
    const mine = [...byKey.keys()].filter((k) => k.startsWith(`${indicator.id}|`));
    for (const old of mine.slice(0, Math.max(0, mine.length - KEEP))) byKey.delete(old);
  }
  return data;
}
