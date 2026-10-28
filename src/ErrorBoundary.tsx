import { Component, type ReactNode } from 'react';
import { messages } from './i18n';

/**
 * 最外層的錯誤畫面。程式出錯時 React 會拆掉整個畫面，沒有這一層就只剩背景色（深色模式是一片黑），
 * 使用者不知道發生什麼事；改成一段說明加「重新整理」。錯誤本身 React 會照樣印在 console。
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const t = messages();
    return (
      <div className="crash" role="alert">
        <p>{t.crashMessage}</p>
        <button type="button" onClick={() => window.location.reload()}>
          {t.crashReload}
        </button>
      </div>
    );
  }
}
