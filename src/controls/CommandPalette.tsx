import { lazy, Suspense, useEffect, useState } from 'react';
import type { CommandPaletteProps } from './CommandPaletteDialog';

/** 指令面板裡的一個指令（App.tsx 依目前的狀態給：看全部主題、地圖／排名表、深淺色、語言、取消選取） */
export interface PaletteAction {
  id: string;
  label: string;
  run: () => void;
}

// 對話框（搜尋、清單、鍵盤操作）第一次按 Ctrl+K 才下載（2026-10-30，首頁的程式少約 6 KB）
const Dialog = lazy(() => import('./CommandPaletteDialog'));

/**
 * 指令面板（Ctrl+K／⌘K）：這裡只聽快捷鍵、記開關；對話框本身在 CommandPaletteDialog.tsx，打開過一次之後留著
 */
export function CommandPalette(props: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Ctrl+K／⌘K：打字中也可以（輸入框裡沒有其他用途），瀏覽器自己的 Ctrl+K（網址列搜尋）讓給這裡
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.isComposing || e.altKey || e.shiftKey || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      setLoaded(true);
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return loaded ? (
    <Suspense fallback={null}>
      <Dialog {...props} open={open} setOpen={setOpen} />
    </Suspense>
  ) : null;
}
