import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    CheckCircle,
    Clock,
    GraduationCap,
    Save,
    Trash2,
    User,
    Users,
} from 'lucide-react';
import { useAuth, createAuthAdapter } from '../hooks/useAuth.jsx';
import { AzureBlobStorage, DevBlobStorage } from '../services/blob-storage.js';
import { sharedDataFetcher } from '../services/shared-data-fetcher.js';
import {
    deleteMemberGroupTermDetail,
    fetchGroupTermDetail,
    fetchMemberGroupTermDetail,
    hasTermDetailContent,
    saveMemberGroupTermDetail,
    validateTermDetail,
    createEmptyTermDetail,
} from '../services/term-detail-service.js';
import {
    fetchMemberTermSummary,
    findMemberTermGroup,
} from '../services/member-term-summary.js';
import { APP_CONFIG } from '../config/app-config.js';
import { formatDuration } from '../utils/format-duration.js';
import { getFiscalPeriodFromSortKey } from '../utils/fiscal-period.js';
import { navigateBack } from '../utils/navigate-back.js';
import { TermDetailForm, TermDetailView } from '../components/TermDetailEditor.jsx';

function DetailMessage({ message }) {
    if (!message?.text) {
        return null;
    }

    return (
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
    );
}

function SessionList({ sessions }) {
    return (
        <div className="card-base overflow-hidden">
            <div className="p-6 border-b border-border-light">
                <h3 className="text-lg font-bold text-text-primary">セッション一覧</h3>
            </div>
            <div>
                {sessions.map((session) => (
                    <div
                        key={session.sessionId}
                        className="border-b border-border-light last:border-b-0 px-6 py-4 flex items-center justify-between gap-4"
                    >
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-text-primary">
                                    {session.date}
                                </span>
                                {session.title && (
                                    <span className="text-sm text-text-secondary break-words">
                                        {session.title}
                                    </span>
                                )}
                                {session.isInstructor && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 text-xs text-primary-700">
                                        <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
                                        講師
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-text-secondary shrink-0">
                            <Clock className="w-4 h-4 text-text-muted" aria-hidden="true" />
                            <span className="font-display">
                                {formatDuration(session.durationSeconds)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function MemberGroupTermDetailPage() {
    const { memberId, groupId, termKey } = useParams();
    const navigate = useNavigate();
    const auth = useAuth();
    const authAdapter = useMemo(() => createAuthAdapter(auth), [auth]);
    const canEditMemberDetail = auth.sasToken !== null;
    const blobStorage = useMemo(() => {
        if (!canEditMemberDetail) {
            return null;
        }

        if (import.meta.env.DEV && authAdapter.getSasToken() === 'dev') {
            return new DevBlobStorage();
        }

        return new AzureBlobStorage(APP_CONFIG.blobBaseUrl, authAdapter);
    }, [authAdapter, canEditMemberDetail]);

    const [summary, setSummary] = useState(null);
    const [commonDetail, setCommonDetail] = useState(null);
    const [memberDetail, setMemberDetail] = useState(null);
    const [memberDraft, setMemberDraft] = useState(createEmptyTermDetail());
    const [activeTab, setActiveTab] = useState(null);
    const [editingMemberDetail, setEditingMemberDetail] = useState(false);
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);

            const summaryResult = await fetchMemberTermSummary(sharedDataFetcher, memberId);
            if (cancelled) {
                return;
            }

            if (!summaryResult.ok) {
                setError(summaryResult.error);
                setLoading(false);
                return;
            }

            const selected = findMemberTermGroup(summaryResult.data.periods, termKey, groupId);
            if (!selected) {
                setError('指定された期またはグループの情報が見つかりません');
                setLoading(false);
                return;
            }

            const [commonResult, memberResult] = await Promise.all([
                fetchGroupTermDetail(groupId, termKey),
                fetchMemberGroupTermDetail(memberId, groupId, termKey),
            ]);
            if (cancelled) {
                return;
            }

            if (!commonResult.ok) {
                setError(`共通情報の取得に失敗しました: ${commonResult.error}`);
                setLoading(false);
                return;
            }

            if (!memberResult.ok) {
                setError(`メンバー情報の取得に失敗しました: ${memberResult.error}`);
                setLoading(false);
                return;
            }

            setSummary({
                member: summaryResult.data.member,
                period: selected.selectedPeriod,
                group: selected.selectedGroup,
            });
            setCommonDetail(commonResult.data);
            setMemberDetail(memberResult.data);
            setMemberDraft(memberResult.data ?? createEmptyTermDetail());
            setEditingMemberDetail(false);
            setDeleteDialogOpen(false);

            const hasCommonDetail = hasTermDetailContent(commonResult.data);
            const hasMemberDetail = hasTermDetailContent(memberResult.data);
            if (hasCommonDetail) {
                setActiveTab('common');
            } else if (hasMemberDetail) {
                setActiveTab('member');
            } else {
                setActiveTab(null);
            }

            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [groupId, memberId, termKey]);

    const termInfo = getFiscalPeriodFromSortKey(termKey);
    const hasCommonDetail = hasTermDetailContent(commonDetail);
    const hasMemberDetail = hasTermDetailContent(memberDetail);
    const availableTabs = [
        hasCommonDetail ? 'common' : null,
        hasMemberDetail ? 'member' : null,
    ].filter(Boolean);

    useEffect(() => {
        if (availableTabs.length === 0) {
            if (activeTab !== null) {
                setActiveTab(null);
            }
            return;
        }

        if (!availableTabs.includes(activeTab)) {
            setActiveTab(availableTabs[0]);
        }
    }, [activeTab, availableTabs]);

    const handleStartCreate = () => {
        setMessage(null);
        setMemberDraft(memberDetail ?? createEmptyTermDetail());
        setEditingMemberDetail(true);
        setActiveTab('member');
    };

    const handleCancelEdit = () => {
        setEditingMemberDetail(false);
        setMemberDraft(memberDetail ?? createEmptyTermDetail());
        setMessage(null);
    };

    const handleSaveMemberDetail = async () => {
        if (!blobStorage) {
            return;
        }

        const validationError = validateTermDetail(memberDraft);
        if (validationError) {
            setMessage({ type: 'error', text: validationError });
            return;
        }

        setSaving(true);
        setMessage(null);
        const result = await saveMemberGroupTermDetail(
            blobStorage,
            memberId,
            groupId,
            termKey,
            memberDraft
        );

        if (!result.success) {
            setSaving(false);
            setMessage({
                type: 'error',
                text: `メンバー情報の保存に失敗しました。${result.error}`,
            });
            return;
        }

        const nextDetail = {
            ...memberDraft,
            references: memberDraft.references.map((reference) => ({ ...reference })),
        };
        setSaving(false);
        setMemberDetail(nextDetail);
        setMemberDraft(nextDetail);
        setEditingMemberDetail(false);
        setActiveTab('member');
        setMessage({ type: 'success', text: 'メンバー情報を保存しました' });
    };

    const handleDeleteMemberDetail = async () => {
        if (!blobStorage) {
            return;
        }

        setSaving(true);
        setMessage(null);
        const result = await deleteMemberGroupTermDetail(
            blobStorage,
            memberId,
            groupId,
            termKey
        );

        if (!result.success) {
            setSaving(false);
            setMessage({
                type: 'error',
                text: `メンバー情報の削除に失敗しました。${result.error}`,
            });
            return;
        }

        setSaving(false);
        setDeleteDialogOpen(false);
        setMemberDetail(null);
        setMemberDraft(createEmptyTermDetail());
        setEditingMemberDetail(false);
        setActiveTab(hasCommonDetail ? 'common' : null);
        setMessage({ type: 'success', text: 'メンバー情報を削除しました' });
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-28 skeleton" />
                <div className="card-base p-8 flex items-center gap-6">
                    <div className="w-16 h-16 skeleton rounded-2xl" />
                    <div className="space-y-2">
                        <div className="h-6 w-40 skeleton" />
                        <div className="h-4 w-56 skeleton" />
                    </div>
                </div>
                {[...Array(2)].map((_, index) => (
                    <div key={index} className="card-base p-6 space-y-3">
                        <div className="h-5 w-48 skeleton" />
                        <div className="h-4 w-36 skeleton" />
                    </div>
                ))}
                <span className="sr-only">読み込み中…</span>
            </div>
        );
    }

    if (error || !summary || !termInfo) {
        return (
            <div className="space-y-4">
                <div className="mx-auto max-w-xl mt-8 card-base border-l-4 border-l-error p-4 text-red-700">
                    {error ?? '期情報の解析に失敗しました'}
                </div>
                <button
                    type="button"
                    onClick={() => navigateBack(navigate)}
                    className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-lg"
                >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    戻る
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <button
                type="button"
                onClick={() => navigateBack(navigate)}
                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg px-3 py-1.5 -ml-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                戻る
            </button>

            <DetailMessage message={message} />

            <div className="card-base rounded-t-none overflow-hidden animate-fade-in-up">
                <div className="h-1 bg-gradient-to-r from-primary-500 via-primary-400 to-accent-400" />
                <div className="p-8 space-y-3">
                    <h2 className="text-xl font-bold text-text-primary">
                        {summary.member.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                        <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-text-muted" aria-hidden="true" />
                            {summary.group.groupName}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-text-muted" aria-hidden="true" />
                            {summary.period.label}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-text-muted" aria-hidden="true" />
                            合計
                            <span className="font-display font-semibold text-text-primary">
                                {formatDuration(summary.group.totalDurationSeconds)}
                            </span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <User className="w-4 h-4 text-text-muted" aria-hidden="true" />
                            <span className="font-display font-semibold text-text-primary">
                                {summary.group.sessionCount}
                            </span>
                            回参加
                        </span>
                    </div>
                </div>
            </div>

            <div className="card-base p-6 space-y-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h3 className="text-lg font-bold text-text-primary">詳細情報</h3>
                        <p className="text-sm text-text-muted mt-1">
                            {termInfo.label} の共通情報とメンバー情報を表示します
                        </p>
                    </div>
                    {canEditMemberDetail && !hasMemberDetail && !editingMemberDetail && (
                        <button
                            type="button"
                            onClick={handleStartCreate}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
                        >
                            <Save className="w-4 h-4" aria-hidden="true" />
                            メンバー情報を追加
                        </button>
                    )}
                </div>

                {availableTabs.length > 0 && (
                    <div className="flex items-center gap-2 border-b border-border-light">
                        {hasCommonDetail && (
                            <button
                                type="button"
                                onClick={() => setActiveTab('common')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'common'
                                        ? 'border-primary-500 text-primary-700'
                                        : 'border-transparent text-text-muted hover:text-text-primary'
                                }`}
                            >
                                共通情報
                            </button>
                        )}
                        {(hasMemberDetail || editingMemberDetail) && (
                            <button
                                type="button"
                                onClick={() => setActiveTab('member')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === 'member'
                                        ? 'border-primary-500 text-primary-700'
                                        : 'border-transparent text-text-muted hover:text-text-primary'
                                }`}
                            >
                                メンバー情報
                            </button>
                        )}
                    </div>
                )}

                {availableTabs.length === 0 && !editingMemberDetail ? (
                    <div className="rounded-2xl border border-dashed border-border-light p-10 text-center space-y-3">
                        <p className="text-sm text-text-muted">
                            登録された詳細情報はありません
                        </p>
                        {canEditMemberDetail && (
                            <button
                                type="button"
                                onClick={handleStartCreate}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
                            >
                                ＋ メンバー情報を追加
                            </button>
                        )}
                    </div>
                ) : null}

                {activeTab === 'common' && hasCommonDetail && (
                    <TermDetailView detail={commonDetail} />
                )}

                {(activeTab === 'member' || editingMemberDetail) && (
                    <>
                        {editingMemberDetail ? (
                            <div className="space-y-4">
                                <TermDetailForm
                                    detail={memberDraft}
                                    onChange={setMemberDraft}
                                    disabled={saving}
                                />
                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        disabled={saving}
                                        className="rounded-lg border border-border-light px-4 py-2 text-sm text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        キャンセル
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveMemberDetail}
                                        disabled={saving}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed"
                                    >
                                        <Save className="w-4 h-4" aria-hidden="true" />
                                        {saving ? '保存中...' : '保存'}
                                    </button>
                                </div>
                            </div>
                        ) : hasMemberDetail ? (
                            <div className="space-y-4">
                                <TermDetailView detail={memberDetail} />
                                {canEditMemberDetail && (
                                    <div className="flex items-center justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setDeleteDialogOpen(true)}
                                            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                                            削除
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleStartCreate}
                                            className="rounded-lg border border-border-light px-4 py-2 text-sm text-text-primary hover:bg-surface-muted transition-colors"
                                        >
                                            編集
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </>
                )}
            </div>

            <SessionList sessions={summary.group.sessions} />

            {deleteDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40"
                        aria-hidden="true"
                        onClick={() => !saving && setDeleteDialogOpen(false)}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="member-detail-delete-title"
                        className="relative w-full max-w-md card-base p-6 animate-scale-in"
                    >
                        <h4
                            id="member-detail-delete-title"
                            className="text-lg font-bold text-text-primary"
                        >
                            メンバー情報の削除
                        </h4>
                        <p className="mt-2 text-sm text-text-muted">
                            この期のメンバー情報を削除しますか？
                        </p>
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteDialogOpen(false)}
                                disabled={saving}
                                className="rounded-lg border border-border-light px-4 py-2 text-sm text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteMemberDetail}
                                disabled={saving}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed"
                            >
                                {saving ? '削除中...' : '削除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
