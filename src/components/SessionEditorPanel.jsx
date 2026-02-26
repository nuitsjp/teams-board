import { Save, AlertCircle, CheckCircle, MousePointerClick, GraduationCap } from 'lucide-react';

const MAX_SESSION_NAME_LENGTH = 256;

/**
 * セッション編集パネル — 選択されたセッションの名前編集・講師編集（将来）を行うパネル
 */
export function SessionEditorPanel({
    session,
    sessionName,
    onSessionNameChange,
    onSave,
    saving,
    message,
}) {
    // 未選択時のプレースホルダ
    if (!session) {
        return (
            <div className="card-base p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
                <MousePointerClick
                    className="w-10 h-10 text-text-muted mb-3"
                    aria-hidden="true"
                />
                <p className="text-sm text-text-muted">
                    左のグループからセッションを選択してください
                </p>
            </div>
        );
    }

    const handleSave = () => {
        onSave(session._ref, sessionName);
    };

    const handleKeyDown = (event) => {
        // IME 変換中の Enter は無視（日本語入力の確定操作を保存と誤認しない）
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            handleSave();
        }
    };

    return (
        <div className="card-base p-5 space-y-5">
            {/* セッション情報ヘッダー */}
            <div>
                <div className="text-xs text-text-muted font-mono mb-1">{session._ref}</div>
                <div className="text-sm text-text-primary tabular-nums">
                    {session.startedAt?.slice(0, 10) ?? '日付なし'}
                </div>
            </div>

            {/* メッセージ表示 */}
            <div aria-live="polite">
                {message?.text && (
                    <div
                        className={`p-3 rounded-xl flex items-center gap-2 animate-scale-in ${
                            message.type === 'success'
                                ? 'bg-green-50 text-green-800'
                                : 'bg-red-50 text-red-800'
                        }`}
                    >
                        {message.type === 'success' ? (
                            <CheckCircle className="w-5 h-5" aria-hidden="true" />
                        ) : (
                            <AlertCircle className="w-5 h-5" aria-hidden="true" />
                        )}
                        <span className="text-sm">{message.text}</span>
                    </div>
                )}
            </div>

            {/* セッション名編集 */}
            <div>
                <label
                    htmlFor="session-name-input"
                    className="block text-sm font-medium text-text-primary mb-1.5"
                >
                    セッション名
                </label>
                <div className="flex items-center gap-2">
                    <input
                        id="session-name-input"
                        type="text"
                        value={sessionName}
                        onChange={(event) => onSessionNameChange(event.target.value)}
                        onKeyDown={handleKeyDown}
                        maxLength={MAX_SESSION_NAME_LENGTH}
                        className="flex-1 px-3 py-2 border border-border-light rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-500"
                        placeholder="未設定（空欄で日付のみ表示）"
                        aria-label={`${session.startedAt?.slice(0, 10) ?? ''} のセッション名`}
                        disabled={saving}
                    />
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        <Save className="w-4 h-4" aria-hidden="true" />
                        保存
                    </button>
                </div>
            </div>

            {/* 講師編集（将来実装の枠） */}
            <div className="pt-4 border-t border-border-light">
                <div className="flex items-center gap-2 mb-2">
                    <GraduationCap className="w-4 h-4 text-text-muted" aria-hidden="true" />
                    <span className="text-sm font-medium text-text-primary">講師</span>
                </div>
                <p className="text-xs text-text-muted">
                    この機能は今後のアップデートで実装予定です
                </p>
            </div>
        </div>
    );
}
