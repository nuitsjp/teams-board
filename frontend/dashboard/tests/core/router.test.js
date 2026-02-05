// Router テスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from '../../src/core/router.js';

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

    it('#/items/abc のハッシュから { view: "detail", itemId: "abc" } ルートを取得できること', () => {
      window.location.hash = '#/items/abc';
      expect(router.getCurrentRoute()).toEqual({ view: 'detail', itemId: 'abc' });
    });

    it('ハッシュなしの場合にデフォルトでダッシュボードルートを返すこと', () => {
      window.location.hash = '';
      expect(router.getCurrentRoute()).toEqual({ view: 'dashboard' });
    });

    it('#/items/item-001 のような複合IDを扱えること', () => {
      window.location.hash = '#/items/item-001';
      expect(router.getCurrentRoute()).toEqual({ view: 'detail', itemId: 'item-001' });
    });
  });

  describe('navigate', () => {
    it('navigate()でハッシュが変更されること（dashboard）', () => {
      router.navigate({ view: 'dashboard' });
      expect(window.location.hash).toBe('#/');
    });

    it('navigate()でハッシュが変更されること（detail）', () => {
      router.navigate({ view: 'detail', itemId: 'xyz-123' });
      expect(window.location.hash).toBe('#/items/xyz-123');
    });
  });

  describe('onRouteChange', () => {
    it('onRouteChangeコールバックがルート変更時に呼び出されること', () => {
      const callback = vi.fn();
      router.onRouteChange(callback);
      router.navigate({ view: 'detail', itemId: 'test-1' });
      expect(callback).toHaveBeenCalledWith({ view: 'detail', itemId: 'test-1' });
    });

    it('hashchangeイベントでコールバックが発火すること', () => {
      const callback = vi.fn();
      router.onRouteChange(callback);
      window.location.hash = '#/items/event-test';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(callback).toHaveBeenCalledWith({ view: 'detail', itemId: 'event-test' });
    });
  });
});
