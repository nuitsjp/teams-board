import { describe, it, expect } from 'vitest';
import { isValidUrl } from '../../../src/utils/validate-url.js';

describe('isValidUrl', () => {
    describe('有効な http URL', () => {
        it('基本的な http URL を受け入れる', () => {
            expect(isValidUrl('http://example.com')).toBe(true);
        });

        it('パス付きの http URL を受け入れる', () => {
            expect(isValidUrl('http://example.com/path/to/page')).toBe(true);
        });

        it('クエリパラメータ付きの http URL を受け入れる', () => {
            expect(isValidUrl('http://example.com?key=value&foo=bar')).toBe(true);
        });

        it('ポート番号付きの http URL を受け入れる', () => {
            expect(isValidUrl('http://localhost:3000')).toBe(true);
        });
    });

    describe('有効な https URL', () => {
        it('基本的な https URL を受け入れる', () => {
            expect(isValidUrl('https://example.com')).toBe(true);
        });

        it('サブドメイン付きの https URL を受け入れる', () => {
            expect(isValidUrl('https://www.example.com')).toBe(true);
        });

        it('フラグメント付きの https URL を受け入れる', () => {
            expect(isValidUrl('https://example.com/page#section')).toBe(true);
        });

        it('パス・クエリ・フラグメントすべて含む https URL を受け入れる', () => {
            expect(isValidUrl('https://example.com/path?q=1#top')).toBe(true);
        });
    });

    describe('無効なプロトコルの URL', () => {
        it('ftp URL を拒否する', () => {
            expect(isValidUrl('ftp://example.com')).toBe(false);
        });

        it('mailto URL を拒否する', () => {
            expect(isValidUrl('mailto:user@example.com')).toBe(false);
        });

        it('javascript URL を拒否する', () => {
            expect(isValidUrl('javascript:alert(1)')).toBe(false);
        });

        it('file URL を拒否する', () => {
            expect(isValidUrl('file:///etc/passwd')).toBe(false);
        });

        it('data URL を拒否する', () => {
            expect(isValidUrl('data:text/html,<h1>test</h1>')).toBe(false);
        });
    });

    describe('空・null・undefined・非文字列の入力', () => {
        it('null を拒否する', () => {
            expect(isValidUrl(null)).toBe(false);
        });

        it('undefined を拒否する', () => {
            expect(isValidUrl(undefined)).toBe(false);
        });

        it('空文字列を拒否する', () => {
            expect(isValidUrl('')).toBe(false);
        });

        it('数値を拒否する', () => {
            expect(isValidUrl(12345)).toBe(false);
        });

        it('真偽値を拒否する', () => {
            expect(isValidUrl(true)).toBe(false);
        });

        it('オブジェクトを拒否する', () => {
            expect(isValidUrl({})).toBe(false);
        });

        it('配列を拒否する', () => {
            expect(isValidUrl([])).toBe(false);
        });
    });

    describe('不正な形式の URL', () => {
        it('プロトコルなしの文字列を拒否する', () => {
            expect(isValidUrl('example.com')).toBe(false);
        });

        it('ランダムな文字列を拒否する', () => {
            expect(isValidUrl('not a url at all')).toBe(false);
        });

        it('スキームだけの文字列を拒否する', () => {
            expect(isValidUrl('http://')).toBe(false);
        });

        it('スラッシュのみの文字列を拒否する', () => {
            expect(isValidUrl('://')).toBe(false);
        });

        it('空白のみの文字列を拒否する', () => {
            expect(isValidUrl('   ')).toBe(false);
        });
    });
});
