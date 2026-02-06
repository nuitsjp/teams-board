// AuthManager テスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthManager } from '../../public/js/core/auth-manager.js';

describe('AuthManager', () => {
  beforeEach(() => {
    // history.replaceState のモック
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  describe('SASトークン抽出', () => {
    it('tokenパラメータ付きURLからSASトークンを抽出できること', () => {
      const auth = AuthManager.initialize('https://example.com/?token=sv%3D2025-01-05%26ss%3Db%26srt%3Dco');
      expect(auth.getSasToken()).toBe('sv=2025-01-05&ss=b&srt=co');
    });

    it('tokenパラメータがないURLではnullを返すこと', () => {
      const auth = AuthManager.initialize('https://example.com/');
      expect(auth.getSasToken()).toBeNull();
    });

    it('空のtoken値ではnullを返すこと', () => {
      const auth = AuthManager.initialize('https://example.com/?token=');
      expect(auth.getSasToken()).toBeNull();
    });

    it('他のパラメータが存在してもtokenを正しく抽出できること', () => {
      const auth = AuthManager.initialize('https://example.com/?foo=bar&token=mysas123&baz=qux');
      expect(auth.getSasToken()).toBe('mysas123');
    });
  });

  describe('管理者モード', () => {
    it('トークン抽出後にisAdminMode()がtrueを返すこと', () => {
      const auth = AuthManager.initialize('https://example.com/?token=valid-sas');
      expect(auth.isAdminMode()).toBe(true);
    });

    it('トークンなしの場合にisAdminMode()がfalseを返すこと', () => {
      const auth = AuthManager.initialize('https://example.com/');
      expect(auth.isAdminMode()).toBe(false);
    });
  });

  describe('URLからのtoken除去', () => {
    it('initialize()後にhistory.replaceStateでURLからtokenが除去されること', () => {
      AuthManager.initialize('https://example.com/page?token=sas123&other=keep');
      expect(window.history.replaceState).toHaveBeenCalled();
      const call = window.history.replaceState.mock.calls[0];
      // 第3引数が新しいURL
      const newUrl = call[2];
      expect(newUrl).not.toContain('token=');
      expect(newUrl).toContain('other=keep');
    });

    it('tokenがない場合はreplaceStateが呼ばれないこと', () => {
      AuthManager.initialize('https://example.com/');
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it('tokenのみのパラメータの場合、クエリ文字列自体が除去されること', () => {
      AuthManager.initialize('https://example.com/page?token=sas123');
      const call = window.history.replaceState.mock.calls[0];
      const newUrl = call[2];
      expect(newUrl).toBe('https://example.com/page');
    });
  });
});
