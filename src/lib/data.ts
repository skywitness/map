import { useEffect, useState } from 'react';

const cache = new Map<string, Promise<unknown>>();

export function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}data/${path}`;
}

type Series = (number | null)[];

/**
 * 差分編碼的序列還原成跟 years 對齊的數值（格式見 DESIGN.md 第 3 節、pipeline/common.py 的 compact_series）：
 * 第一個數是十進位指數 e，之後每個數是跟前一個非 null 值的差（整數），值 = 累加 × 10^e。
 */
function decodeSeries(series: Series): Series {
  const exponent = series[0] ?? 0;
  const out: Series = new Array(series.length - 1);
  let acc = 0;
  for (let i = 1; i < series.length; i++) {
    const d = series[i];
    if (d === null) {
      out[i - 1] = null;
      continue;
    }
    acc += d;
    // 用除的（不是乘 0.01）才會跟直接寫成小數的 JSON 解析出同一個浮點數
    out[i - 1] = exponent < 0 ? acc / 10 ** -exponent : acc * 10 ** exponent;
  }
  return out;
}

function decodeRecord(record: Record<string, Series>): Record<string, Series> {
  const out: Record<string, Series> = {};
  for (const [key, series] of Object.entries(record)) out[key] = decodeSeries(series);
  return out;
}

/** 指標檔有 "encoding": "delta" 就還原；沒有的（舊格式、其他檔案）原樣回傳 */
function decode(json: unknown): unknown {
  const d = json as { encoding?: unknown; values?: Record<string, Series>; aggregates?: Record<string, Series> };
  if (!d || typeof d !== 'object' || d.encoding !== 'delta') return json;
  const { encoding: _, ...rest } = d;
  return {
    ...rest,
    ...(d.values && { values: decodeRecord(d.values) }),
    ...(d.aggregates && { aggregates: decodeRecord(d.aggregates) }),
  };
}

export function fetchJson<T>(path: string, priority?: RequestPriority): Promise<T> {
  let promise = cache.get(path) as Promise<T> | undefined;
  if (!promise) {
    promise = fetch(dataUrl(path), priority ? { priority } : undefined).then((res) => {
      // 訊息不帶語言，畫面上的「資料載入失敗」由呼叫端依介面語言加上
      if (!res.ok) throw new Error(`${path} (HTTP ${res.status})`);
      return res.json().then(decode) as Promise<T>;
    });
    promise.catch(() => cache.delete(path)); // 失敗不快取，下次重試
    cache.set(path, promise);
  }
  return promise;
}

/**
 * 閒置時一個一個預先下載（放進上面的記憶體快取，之後 useJson 立刻拿到）。
 * 開了省流量模式或 2G 網路時不做。回傳取消函式，給 useEffect 清除用。
 */
export function prefetchJson(paths: string[]): () => void {
  const connection = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /2g/.test(connection?.effectiveType ?? '')) return () => {};
  const idle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 200));
  const queue = paths.filter((p) => !cache.has(p));
  let cancelled = false;
  const next = () => {
    const path = queue.shift();
    if (cancelled || !path) return;
    idle(() => {
      if (!cancelled) fetchJson(path, 'low').then(next, next);
    });
  };
  next();
  return () => {
    cancelled = true;
  };
}

/**
 * 讀取 data/ 底下的 JSON。切換檔案時保留上一份資料直到新資料到達，
 * 畫面不會閃成空白（loading 期間由呼叫端調淡顯示）。
 */
export function useJson<T>(path: string | null): { data: T | null; loading: boolean; error: Error | null } {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: Error | null }>({
    path: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    fetchJson<T>(path).then(
      (data) => !cancelled && setState({ path, data, error: null }),
      (error: Error) => !cancelled && setState((s) => ({ ...s, path, error })),
    );
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data: state.data, loading: path !== state.path, error: state.error };
}

/** 一次讀多個檔案（例如一個主題的所有指標），還沒到的位置是 null */
export function useJsonMany<T>(paths: string[]): (T | null)[] {
  const key = paths.join('|');
  const [state, setState] = useState<{ key: string; data: (T | null)[] }>({ key: '', data: [] });

  useEffect(() => {
    let cancelled = false;
    const list = key ? key.split('|') : [];
    Promise.all(list.map((p) => fetchJson<T>(p).catch(() => null))).then(
      (data) => !cancelled && setState({ key, data }),
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  return state.key === key ? state.data : paths.map(() => null);
}
