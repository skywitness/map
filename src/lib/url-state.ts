import { useCallback, useEffect, useState } from 'react';
import type { Box } from '../map/boxEstimate';

/** 畫面狀態全部放在網址參數，任何畫面都能直接複製網址分享。 */
export interface ViewState {
  topic: string | null;
  indicator: string | null;
  year: number | null;
  country: string | null;
  view: 'map' | 'table';
  /** 子項目，例如農產品代碼 */
  item: string | null;
  /** 框選範圍（原始投影座標） */
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
    box: parseBox(p.get('box')),
  };
}

function parseBox(text: string | null): Box | null {
  const nums = text?.split(',').map(Number);
  return nums && nums.length === 4 && nums.every(Number.isFinite) && nums[0] < nums[2] && nums[1] < nums[3]
    ? (nums as Box)
    : null;
}

function write(state: ViewState): void {
  const p = new URLSearchParams();
  if (state.topic) p.set('topic', state.topic);
  if (state.indicator) p.set('ind', state.indicator);
  if (state.item) p.set('item', state.item);
  if (state.year) p.set('year', String(state.year));
  if (state.country) p.set('country', state.country);
  if (state.view !== 'map') p.set('view', state.view);
  if (state.box) p.set('box', state.box.map((v) => v.toFixed(5)).join(','));
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
