// webcryptoポリフィル（crypto.subtle対応）
import { webcrypto } from 'crypto';
if (!globalThis.crypto?.subtle) {
  globalThis.crypto = webcrypto;
}

// ResizeObserver / window.scrollTo ポリフィル（@tanstack/react-virtual が使用）
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
window.scrollTo = () => {};

// React Testing Library 自動クリーンアップ
import '@testing-library/jest-dom';
