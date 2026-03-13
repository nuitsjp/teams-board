import { Plus, Trash2 } from 'lucide-react';

function renderSection(title, value) {
    if (!value || value.trim().length === 0) {
        return null;
    }

    return (
        <section className="space-y-2">
            <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
            <p className="text-sm leading-7 text-text-secondary whitespace-pre-wrap break-words">
                {value}
            </p>
        </section>
    );
}

export function TermDetailView({ detail, emptyMessage = '登録されていません' }) {
    const references = detail.references.filter(
        (reference) =>
            reference.title.trim().length > 0 || reference.url.trim().length > 0
    );
    const hasContent =
        detail.purpose.trim().length > 0 ||
        detail.learningContent.trim().length > 0 ||
        detail.learningOutcome.trim().length > 0 ||
        references.length > 0;

    if (!hasContent) {
        return (
            <div className="rounded-2xl border border-dashed border-border-light p-6 text-sm text-text-muted text-center">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {renderSection('セッションの目的', detail.purpose)}
            {renderSection('学習内容', detail.learningContent)}
            {renderSection('学習の成果', detail.learningOutcome)}
            {references.length > 0 && (
                <section className="space-y-3">
                    <h4 className="text-sm font-semibold text-text-primary">
                        参考資料リンク
                    </h4>
                    <ul className="space-y-2">
                        {references.map((reference, index) => (
                            <li key={`${reference.url}-${index}`}>
                                <a
                                    href={reference.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary-600 hover:text-primary-800 underline underline-offset-2 break-all"
                                >
                                    {reference.title.trim().length > 0
                                        ? reference.title
                                        : reference.url}
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

export function TermDetailForm({ detail, onChange, disabled = false }) {
    const handleReferenceChange = (index, key, value) => {
        const nextReferences = detail.references.map((reference, referenceIndex) =>
            referenceIndex === index ? { ...reference, [key]: value } : reference
        );
        onChange({ ...detail, references: nextReferences });
    };

    const handleAddReference = () => {
        onChange({
            ...detail,
            references: [...detail.references, { title: '', url: '' }],
        });
    };

    const handleRemoveReference = (index) => {
        onChange({
            ...detail,
            references: detail.references.filter(
                (_, referenceIndex) => referenceIndex !== index
            ),
        });
    };

    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <label
                    htmlFor="term-detail-purpose"
                    className="block text-sm font-medium text-text-primary"
                >
                    セッションの目的
                </label>
                <textarea
                    id="term-detail-purpose"
                    rows={3}
                    value={detail.purpose}
                    onChange={(event) =>
                        onChange({ ...detail, purpose: event.target.value })
                    }
                    disabled={disabled}
                    className="w-full rounded-xl border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-500 disabled:bg-surface-muted disabled:text-text-muted"
                />
            </div>

            <div className="space-y-2">
                <label
                    htmlFor="term-detail-learning-content"
                    className="block text-sm font-medium text-text-primary"
                >
                    学習内容
                </label>
                <textarea
                    id="term-detail-learning-content"
                    rows={5}
                    value={detail.learningContent}
                    onChange={(event) =>
                        onChange({
                            ...detail,
                            learningContent: event.target.value,
                        })
                    }
                    disabled={disabled}
                    className="w-full rounded-xl border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-500 disabled:bg-surface-muted disabled:text-text-muted"
                />
            </div>

            <div className="space-y-2">
                <label
                    htmlFor="term-detail-learning-outcome"
                    className="block text-sm font-medium text-text-primary"
                >
                    学習の成果
                </label>
                <textarea
                    id="term-detail-learning-outcome"
                    rows={5}
                    value={detail.learningOutcome}
                    onChange={(event) =>
                        onChange({
                            ...detail,
                            learningOutcome: event.target.value,
                        })
                    }
                    disabled={disabled}
                    className="w-full rounded-xl border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-500 disabled:bg-surface-muted disabled:text-text-muted"
                />
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-text-primary">
                        参考資料リンク
                    </h4>
                    <button
                        type="button"
                        onClick={handleAddReference}
                        disabled={disabled}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm text-text-primary hover:bg-surface-muted transition-colors disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        リンクを追加
                    </button>
                </div>

                {detail.references.length === 0 && (
                    <p className="text-sm text-text-muted">
                        参考資料リンクは未登録です
                    </p>
                )}

                <div className="space-y-3">
                    {detail.references.map((reference, index) => (
                        <div
                            key={`reference-${index}`}
                            className="rounded-2xl border border-border-light p-4 space-y-3"
                        >
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-text-primary">
                                    タイトル
                                </label>
                                <input
                                    type="text"
                                    value={reference.title}
                                    onChange={(event) =>
                                        handleReferenceChange(
                                            index,
                                            'title',
                                            event.target.value
                                        )
                                    }
                                    disabled={disabled}
                                    className="w-full rounded-xl border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-500 disabled:bg-surface-muted disabled:text-text-muted"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-text-primary">
                                    URL
                                </label>
                                <input
                                    type="url"
                                    value={reference.url}
                                    onChange={(event) =>
                                        handleReferenceChange(
                                            index,
                                            'url',
                                            event.target.value
                                        )
                                    }
                                    disabled={disabled}
                                    placeholder="https://example.com"
                                    className="w-full rounded-xl border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-500 disabled:bg-surface-muted disabled:text-text-muted"
                                />
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => handleRemoveReference(index)}
                                    disabled={disabled}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:text-text-muted disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                >
                                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                                    リンクを削除
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
