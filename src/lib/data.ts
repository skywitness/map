import { useEffect, useState } from 'react';

const cache = new Map<string, Promise<unknown>>();

export function dataUrl(path: string): string {
  return `${import.meta.env.BASE_URL}data/${path}`;
}

export function fetchJson<T>(path: string): Promise<T> {
  let promise = cache.get(path) as Promise<T> | undefined;
  if (!promise) {
    promise = fetch(dataUrl(path)).then((res) => {
      if (!res.ok) throw new Error(`讀取 ${path} 失敗：HTTP ${res.status}`);
      return res.json() as Promise<T>;
    });
    promise.catch(() => cache.delete(path)); // 失敗不快取，下次重試
    cache.set(path, promise);
  }
  return promise;
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
    Promise.all(key.split('|').map((p) => fetchJson<T>(p).catch(() => null))).then(
      (data) => !cancelled && setState({ key, data }),
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  return state.key === key ? state.data : paths.map(() => null);
}
