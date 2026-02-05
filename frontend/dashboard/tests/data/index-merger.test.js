// IndexMerger テスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IndexMerger } from '../../src/data/index-merger.js';

describe('IndexMerger', () => {
  let merger;

  beforeEach(() => {
    merger = new IndexMerger();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-06T12:00:00+09:00'));
  });

  it('空のindexに新規アイテムを追加できること', () => {
    const current = { items: [], updatedAt: '2026-01-01T00:00:00+09:00' };
    const newItems = [{ id: 'new-1', title: '新規', summary: { key: 'val' } }];
    const result = merger.merge(current, newItems);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('new-1');
  });

  it('既存アイテムがあるindexに新規アイテムを追加できること', () => {
    const current = {
      items: [{ id: 'old-1', title: '既存', summary: {} }],
      updatedAt: '2026-01-01T00:00:00+09:00',
    };
    const newItems = [{ id: 'new-1', title: '新規', summary: {} }];
    const result = merger.merge(current, newItems);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('old-1');
    expect(result.items[1].id).toBe('new-1');
  });

  it('マージ後のupdatedAtが現在時刻に更新されていること', () => {
    const current = { items: [], updatedAt: '2026-01-01T00:00:00+09:00' };
    const result = merger.merge(current, []);
    expect(result.updatedAt).toBe('2026-02-06T03:00:00.000Z');
  });

  it('重複IDが検出された場合に警告を含む結果を返すこと', () => {
    const current = {
      items: [{ id: 'dup-1', title: '既存', summary: {} }],
      updatedAt: '2026-01-01',
    };
    const newItems = [{ id: 'dup-1', title: '重複', summary: {} }];
    const result = merger.merge(current, newItems);
    expect(result.warnings).toBeDefined();
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('dup-1');
  });

  it('新規アイテムが空配列の場合にupdatedAtのみ更新されること', () => {
    const current = {
      items: [{ id: 'a', title: 'A', summary: {} }],
      updatedAt: '2026-01-01',
    };
    const result = merger.merge(current, []);
    expect(result.items).toHaveLength(1);
    expect(result.updatedAt).toBe('2026-02-06T03:00:00.000Z');
  });

  it('元のindexオブジェクトが変更されないこと（イミュータブル）', () => {
    const current = {
      items: [{ id: 'a', title: 'A', summary: {} }],
      updatedAt: '2026-01-01',
    };
    const original = JSON.parse(JSON.stringify(current));
    merger.merge(current, [{ id: 'b', title: 'B', summary: {} }]);
    expect(current).toEqual(original);
  });
});
