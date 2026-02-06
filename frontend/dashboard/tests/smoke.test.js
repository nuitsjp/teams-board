// スモークテスト — テスト基盤の動作確認
import { describe, it, expect } from 'vitest';

describe('テスト基盤', () => {
  it('Vitestが正常に動作すること', () => {
    expect(1 + 1).toBe(2);
  });

  it('jsdom環境でdocumentが利用可能であること', () => {
    expect(document).toBeDefined();
    expect(document.createElement).toBeTypeOf('function');
  });

  it('ES Modulesのインポートが動作すること', async () => {
    const { AuthManager } = await import('../public/js/core/auth-manager.js');
    expect(AuthManager).toBeDefined();
  });
});
