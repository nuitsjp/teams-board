import { describe, it, expect } from 'vitest';
import {
    createSessionRef,
    parseSessionRef,
    sessionRefToPath,
    incrementRevision,
    getSessionId,
    getRevision,
} from '../../src/services/session-ref.js';

describe('session-ref', () => {
    describe('createSessionRef', () => {
        it('sessionId と revision から ref 文字列を生成する', () => {
            expect(createSessionRef('01ABC', 0)).toBe('01ABC/0');
            expect(createSessionRef('01ABC', 3)).toBe('01ABC/3');
        });
    });

    describe('parseSessionRef', () => {
        it('ref 文字列を sessionId と revision にパースする', () => {
            expect(parseSessionRef('01ABC/0')).toEqual({ sessionId: '01ABC', revision: 0 });
            expect(parseSessionRef('01ABC/5')).toEqual({ sessionId: '01ABC', revision: 5 });
        });
    });

    describe('sessionRefToPath', () => {
        it('ref からファイルパスを生成する', () => {
            expect(sessionRefToPath('01ABC/0')).toBe('data/sessions/01ABC/0.json');
            expect(sessionRefToPath('01ABC/2')).toBe('data/sessions/01ABC/2.json');
        });
    });

    describe('incrementRevision', () => {
        it('ref のリビジョンを +1 した新しい ref を返す', () => {
            expect(incrementRevision('01ABC/0')).toBe('01ABC/1');
            expect(incrementRevision('01ABC/5')).toBe('01ABC/6');
        });
    });

    describe('getSessionId', () => {
        it('ref から sessionId 部分を抽出する', () => {
            expect(getSessionId('01ABC/0')).toBe('01ABC');
            expect(getSessionId('01LONGID00000000000001/3')).toBe('01LONGID00000000000001');
        });
    });

    describe('getRevision', () => {
        it('ref から revision 数値を抽出する', () => {
            expect(getRevision('01ABC/0')).toBe(0);
            expect(getRevision('01ABC/7')).toBe(7);
        });
    });
});
