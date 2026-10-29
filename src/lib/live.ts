/**
 * 主題的即時資料（TopicDefinition.live，此刻的極光）：瀏覽器直接讀外部的網址，每 minutes 分鐘重讀一次。
 * 重讀時保留上一份，新的到了才換（畫面不閃）；讀不到時留著上一份並回報錯誤，下一輪再試。
 * 分頁在背景時不讀，回到前景時資料已經超過 minutes 就馬上重讀。
 */
import { useEffect, useState } from 'react';

export interface LiveState {
  /** 最近一次讀到的資料；還沒讀到是 null */
  data: unknown;
  error: Error | null;
}

const NONE: LiveState = { data: null, error: null };

export function useLive(def: { url: string; minutes: number } | undefined): LiveState {
  const url = def?.url ?? null;
  const minutes = def?.minutes ?? 0;
  const [state, setState] = useState<{ url: string | null; live: LiveState }>({ url: null, live: NONE });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let last = 0;
    let timer: number | undefined;
    const load = () => {
      window.clearTimeout(timer);
      last = Date.now();
      fetch(url, { cache: 'no-cache' })
        .then((res) => {
          if (!res.ok) throw new Error(`${url} (HTTP ${res.status})`);
          return res.json() as Promise<unknown>;
        })
        .then(
          (data) => !cancelled && setState({ url, live: { data, error: null } }),
          (error: Error) => !cancelled && setState((s) => ({ url, live: { data: s.url === url ? s.live.data : null, error } })),
        )
        .finally(() => {
          // 分頁在背景時不重讀，等 visibilitychange
          if (!cancelled) timer = window.setTimeout(() => document.visibilityState !== 'hidden' && load(), minutes * 60_000);
        });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > minutes * 60_000) load();
    };
    load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url, minutes]);

  return state.url === url ? state.live : NONE;
}
