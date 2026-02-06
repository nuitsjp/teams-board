// Router テスト — 新画面構成対応
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from '../../public/js/core/router.js';

describe('Router', () => {
  let router;

  beforeEach(() => {
    window.location.hash = '';
    router = new Router();
  });

  describe('getCurrentRoute', () => {
    it('#/ のハッシュから { view: "dashboard" } ルートを取得できること', () => {
      window.location.hash = '#/';
      expect(router.getCurrentRoute()).toEqual({ view: 'dashboard' });
    });

    it('#/members/abc12345 のハッシュから { view: "memberDetail", memberId: "abc12345" } ルートを取得できること', () => {
      window.location.hash = '#/members/abc12345';
      expect(router.getCurrentRoute()).toEqual({ view: 'memberDetail', memberId: 'abc12345' });
    });

    it('ハッシュなしの場合にデフォルトでダッシュボードルートを返すこと', () => {
      window.location.hash = '';
      expect(router.getCurrentRoute()).toEqual({ view: 'dashboard' });
    });

    it('#/members/e5d4c3b2 のようなハッシュIDを扱えること', () => {
      window.location.hash = '#/members/e5d4c3b2';
      expect(router.getCurrentRoute()).toEqual({ view: 'memberDetail', memberId: 'e5d4c3b2' });
    });

    it('旧ルート #/items/xxx はダッシュボードルートとして解釈されること', () => {
      window.location.hash = '#/items/item-001';
      expect(router.getCurrentRoute()).toEqual({ view: 'dashboard' });
    });
  });

  describe('navigate', () => {
    it('navigate()でハッシュが変更されること（dashboard）', () => {
      router.navigate({ view: 'dashboard' });
      expect(window.location.hash).toBe('#/');
    });

    it('navigate()でハッシュが変更されること（memberDetail）', () => {
      router.navigate({ view: 'memberDetail', memberId: 'abc12345' });
      expect(window.location.hash).toBe('#/members/abc12345');
    });
  });

  describe('onRouteChange', () => {
    it('onRouteChangeコールバックがルート変更時に呼び出されること', () => {
      const callback = vi.fn();
      router.onRouteChange(callback);
      router.navigate({ view: 'memberDetail', memberId: 'test-1' });
      expect(callback).toHaveBeenCalledWith({ view: 'memberDetail', memberId: 'test-1' });
    });

    it('hashchangeイベントでコールバックが発火すること', () => {
      const callback = vi.fn();
      router.onRouteChange(callback);
      window.location.hash = '#/members/event-test';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(callback).toHaveBeenCalledWith({ view: 'memberDetail', memberId: 'event-test' });
    });
  });
});
