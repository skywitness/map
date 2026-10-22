import { useCallback, useEffect, useState } from 'react';
import { boxFromLegacyRaw, type Box } from '../map/boxEstimate';

/** 畫面狀態全部放在網址參數，任何畫面都能直接複製網址分享。 */
export interface ViewState {
  topic: string | null;
  indicator: string | null;
  year: number | null;
  country: string | null;
  view: 'map' | 'table';
  /** 子項目，例如農產品代碼 */
  item: string | null;
  /** 框選範圍（經緯度 [西, 南, 東, 北]） */
  box: Box | null;
}

function read(): ViewState {
  const p = new URLSearchParams(window.location.search);
  const year = Number(p.get('year'));
  return {
    topic: p.get('topic'),
    indicator: p.get('ind'),
    year: Number.isFinite(year) && year > 0 ? year : null,
    country: p.get('country'),
    view: p.get('view') === 'table' ? 'table' : 'map',
    item: p.get('item'),
    // bbox= 是經緯度；舊版網址的 box= 是 Equal Earth 投影座標，換算過來
    box: parseBox(p.get('bbox')) ?? legacyBox(p.get('box')),
  };
}

function parseNumbers(text: string | null): Box | null {
  const nums = text?.split(',').map(Number);
  return nums && nums.length === 4 && nums.every(Number.isFinite) ? (nums as Box) : null;
}

function parseBox(text: string | null): Box | null {
  const b = parseNumbers(text);
  return b && b[1] < b[3] && Math.abs(b[0]) <= 180 && Math.abs(b[2]) <= 180 ? b : null;
}

function legacyBox(text: string | null): Box | null {
  const b = parseNumbers(text);
  return b && b[0] < b[2] && b[1] < b[3] ? boxFromLegacyRaw(b) : null;
}

function write(state: ViewState): void {
  const p = new URLSearchParams();
  if (state.topic) p.set('topic', state.topic);
  if (state.indicator) p.set('ind', state.indicator);
  if (state.item) p.set('item', state.item);
  if (state.year) p.set('year', String(state.year));
  if (state.country) p.set('country', state.country);
  if (state.view !== 'map') p.set('view', state.view);
  if (state.box) p.set('bbox', state.box.map((v) => v.toFixed(3)).join(','));
  const query = p.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', url);
}

export function useUrlState(): [ViewState, (patch: Partial<ViewState>) => void] {
  const [state, setState] = useState<ViewState>(read);

  useEffect(() => {
    const onPop = () => setState(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => write(state), [state]);

  const update = useCallback((patch: Partial<ViewState>) => setState((s) => ({ ...s, ...patch })), []);
  return [state, update];
}
