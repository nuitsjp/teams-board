// webcryptoポリフィル（crypto.subtle対応）
import { webcrypto } from 'crypto';
if (!globalThis.crypto?.subtle) {
  globalThis.crypto = webcrypto;
}

// React Testing Library 自動クリーンアップ
import '@testing-library/jest-dom';
