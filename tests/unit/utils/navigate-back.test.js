import { navigateBack } from '../../../src/utils/navigate-back.js';

describe('navigateBack', () => {
    let originalState;

    beforeEach(() => {
        originalState = window.history.state;
    });

    afterEach(() => {
        Object.defineProperty(window.history, 'state', {
            value: originalState,
            writable: true,
            configurable: true,
        });
    });

    it('履歴がある場合は navigate(-1) を呼ぶこと', () => {
        Object.defineProperty(window.history, 'state', {
            value: { idx: 2 },
            writable: true,
            configurable: true,
        });

        const navigate = vi.fn();
        navigateBack(navigate);

        expect(navigate).toHaveBeenCalledWith(-1);
    });

    it('履歴インデックスが 0 の場合はダッシュボードに遷移すること', () => {
        Object.defineProperty(window.history, 'state', {
            value: { idx: 0 },
            writable: true,
            configurable: true,
        });

        const navigate = vi.fn();
        navigateBack(navigate);

        expect(navigate).toHaveBeenCalledWith('/');
    });

    it('history.state が null の場合はダッシュボードに遷移すること', () => {
        Object.defineProperty(window.history, 'state', {
            value: null,
            writable: true,
            configurable: true,
        });

        const navigate = vi.fn();
        navigateBack(navigate);

        expect(navigate).toHaveBeenCalledWith('/');
    });

    it('history.state に idx がない場合はダッシュボードに遷移すること', () => {
        Object.defineProperty(window.history, 'state', {
            value: {},
            writable: true,
            configurable: true,
        });

        const navigate = vi.fn();
        navigateBack(navigate);

        expect(navigate).toHaveBeenCalledWith('/');
    });
});
