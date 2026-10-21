import { useEffect, useState } from 'react';
import { applyTokens, TOKENS, type ThemeMode, type Tokens } from './tokens';

const STORAGE_KEY = 'theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function readStoredPreference(): ThemeMode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** 預設跟隨作業系統；使用者手動切換後記在 localStorage。 */
export function useTheme(): { tokens: Tokens; toggle: () => void } {
  const [preference, setPreference] = useState<ThemeMode | null>(readStoredPreference);
  const [systemDark, setSystemDark] = useState(media.matches);

  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const mode: ThemeMode = preference ?? (systemDark ? 'dark' : 'light');
  const tokens = TOKENS[mode];

  useEffect(() => {
    applyTokens(tokens);
    document.documentElement.dataset.theme = mode;
  }, [tokens, mode]);

  const toggle = () => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setPreference(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 無痕模式等情況下存不了，只影響這次瀏覽
    }
  };

  return { tokens, toggle };
}
