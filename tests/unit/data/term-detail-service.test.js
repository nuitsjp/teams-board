import {
    buildGroupTermDetailPath,
    buildMemberGroupTermDetailPath,
    createEmptyTermDetail,
    fetchGroupTermDetail,
    hasTermDetailContent,
    serializeTermDetail,
    validateTermDetail,
} from '../../../src/services/term-detail-service.js';

describe('term-detail-service', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('空の詳細オブジェクトを生成できること', () => {
        expect(createEmptyTermDetail()).toEqual({
            purpose: '',
            learningContent: '',
            learningOutcome: '',
            references: [],
        });
    });

    it('保存パスを生成できること', () => {
        expect(buildGroupTermDetailPath('g1', '20251')).toBe(
            'data/group-term-details/g1/20251.json'
        );
        expect(buildMemberGroupTermDetailPath('m1', 'g1', '20251')).toBe(
            'data/member-group-term-details/m1/g1/20251.json'
        );
    });

    it('参考資料 URL が空の行はバリデーションエラーになること', () => {
        expect(
            validateTermDetail({
                purpose: '',
                learningContent: '',
                learningOutcome: '',
                references: [{ title: '資料', url: '' }],
            })
        ).toBe('参考資料リンクの URL を入力してください');
    });

    it('http/https 以外の URL はバリデーションエラーになること', () => {
        expect(
            validateTermDetail({
                purpose: '',
                learningContent: '',
                learningOutcome: '',
                references: [{ title: '資料', url: 'ftp://example.com' }],
            })
        ).toBe('参考資料リンクの URL は http または https で入力してください');
    });

    it('保存時に空の参考資料行を除外すること', () => {
        expect(
            serializeTermDetail({
                purpose: '  目的  ',
                learningContent: '',
                learningOutcome: '',
                references: [
                    { title: '  資料  ', url: ' https://example.com/doc ' },
                    { title: '', url: '' },
                ],
            })
        ).toEqual({
            purpose: '目的',
            learningContent: '',
            learningOutcome: '',
            references: [{ title: '資料', url: 'https://example.com/doc' }],
        });
    });

    it('内容あり判定ができること', () => {
        expect(hasTermDetailContent(null)).toBe(false);
        expect(
            hasTermDetailContent({
                purpose: '',
                learningContent: '学習内容',
                learningOutcome: '',
                references: [],
            })
        ).toBe(true);
    });

    it('詳細ファイルが存在しない場合は null を返すこと', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            status: 404,
            ok: false,
            statusText: 'Not Found',
        });

        await expect(fetchGroupTermDetail('g1', '20251')).resolves.toEqual({
            ok: true,
            data: null,
        });
    });
});
