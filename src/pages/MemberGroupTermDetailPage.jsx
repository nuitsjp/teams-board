import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, createAuthAdapter } from '../hooks/useAuth.jsx';
import { DataFetcher } from '../services/data-fetcher.js';
import { TermDetailService } from '../services/term-detail-service.js';
import { AzureBlobStorage, DevBlobStorage } from '../services/blob-storage.js';
import { APP_CONFIG } from '../config/app-config.js';
import { formatDuration } from '../utils/format-duration.js';
import { navigateBack } from '../utils/navigate-back.js';
import { getFiscalPeriod, termKeyToLabel } from '../utils/fiscal-period.js';
import { isValidUrl } from '../utils/validate-url.js';
import {
    ArrowLeft,
    Clock,
    Calendar,
    GraduationCap,
    Plus,
    Pencil,
    Save,
    X,
    Trash2,
    ExternalLink,
    AlertCircle,
    CheckCircle,
} from 'lucide-react';

const fetcher = new DataFetcher();

/**
 * startedAt（ISO 8601）から YYYY-MM-DD を抽出する
 */
function extractDate(startedAt) {
    if (!startedAt) return '';
    return startedAt.slice(0, 10);
}

/** 詳細情報の空テンプレート */
function emptyDetail() {
    return { purpose: '', learningContent: '', learningOutcome: '', references: [] };
}

/** 詳細データが実質的に空かどうかを判定する */
function isDetailEmpty(detail) {
    if (!detail) return true;
    const hasText = detail.purpose || detail.learningContent || detail.learningOutcome;
    const hasRefs = detail.references && detail.references.length > 0;
    return !hasText && !hasRefs;
}

/**
 * メンバー・グループ・期 詳細画面
 * ルート: #/members/:memberId/groups/:groupId/terms/:termKey
 */
export function MemberGroupTermDetailPage() {
    const { memberId, groupId, termKey } = useParams();
    const navigate = useNavigate();
    const auth = useAuth();
    const authAdapter = useMemo(() => createAuthAdapter(auth), [auth]);

    // BlobStorage（認証済み/開発モード）
    const blobStorage = useMemo(() => {
        if (import.meta.env.DEV && authAdapter.getSasToken() === 'dev') {
            return new DevBlobStorage();
        }
        if (authAdapter.getSasToken()) {
            return new AzureBlobStorage(APP_CONFIG.blobBaseUrl, authAdapter);
        }
        // 未認証でもメンバー情報の追加ボタンは表示されるので DevBlobStorage で対応
        if (import.meta.env.DEV) {
            return new DevBlobStorage();
        }
        return null;
    }, [authAdapter]);

    const termDetailService = useMemo(
        () => (blobStorage ? new TermDetailService(blobStorage) : null),
        [blobStorage]
    );

    const termLabel = termKeyToLabel(termKey);

    // 基本情報
    const [memberName, setMemberName] = useState('');
    const [groupName, setGroupName] = useState('');
    const [sessions, setSessions] = useState([]);
    const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);

    // 詳細情報
    const [commonDetail, setCommonDetail] = useState(null);
    const [memberDetail, setMemberDetail] = useState(null);
    const [activeTab, setActiveTab] = useState(null);

    // 編集状態
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState(emptyDetail());
    const [urlErrors, setUrlErrors] = useState([]);

    // UI状態
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // データ読み込み
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);

            const indexResult = await fetcher.fetchIndex();
            if (cancelled) return;
            if (!indexResult.ok) {
                setError(`データ取得エラー: ${indexResult.error}`);
                setLoading(false);
                return;
            }

            const { groups, members } = indexResult.data;
            const member = members.find((m) => m.id === memberId);
            const group = groups.find((g) => g.id === groupId);
            if (!member || !group) {
                setError('メンバーまたはグループが見つかりません');
                setLoading(false);
                return;
            }

            setMemberName(member.name);
            setGroupName(group.name);

            // このグループ・期のセッションを特定
            const groupSessionRefs = new Set(group.sessionRevisions);
            const memberSessionRefs = member.sessionRevisions.filter((ref) =>
                groupSessionRefs.has(ref)
            );

            const sessionResults = await Promise.all(
                memberSessionRefs.map((ref) => fetcher.fetchSession(ref))
            );
            if (cancelled) return;

            // 該当期のセッションをフィルタリング
            const termSessions = [];
            let totalDuration = 0;
            const termKeyNum = Number(termKey);

            for (let i = 0; i < sessionResults.length; i++) {
                const result = sessionResults[i];
                if (!result.ok) continue;
                const session = result.data;
                const date = extractDate(session.startedAt);
                const period = getFiscalPeriod(date);
                if (period.sortKey !== termKeyNum) continue;

                const attendance = session.attendances.find((a) => a.memberId === memberId);
                const isInstructor = (session.instructors || []).includes(memberId);
                const durationSeconds = attendance ? attendance.durationSeconds : 0;

                termSessions.push({
                    sessionId: session.sessionId,
                    date,
                    title: session.title || null,
                    durationSeconds,
                    isInstructor,
                });
                totalDuration += durationSeconds;
            }

            // 日付降順でソート
            termSessions.sort((a, b) => b.date.localeCompare(a.date));
            setSessions(termSessions);
            setTotalDurationSeconds(totalDuration);

            // 詳細情報を取得（termDetailService がなくても表示は可能）
            if (termDetailService) {
                const [commonResult, memberResult] = await Promise.all([
                    termDetailService.fetchGroupTermDetail(groupId, termKey),
                    termDetailService.fetchMemberGroupTermDetail(memberId, groupId, termKey),
                ]);
                if (cancelled) return;

                if (commonResult.ok) setCommonDetail(commonResult.data);
                if (memberResult.ok) setMemberDetail(memberResult.data);

                // 初期タブ設定
                if (memberResult.ok && !isDetailEmpty(memberResult.data)) {
                    setActiveTab('member');
                } else if (commonResult.ok && !isDetailEmpty(commonResult.data)) {
                    setActiveTab('common');
                }
            }

            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [memberId, groupId, termKey, termDetailService]);

    const hasCommon = commonDetail && !isDetailEmpty(commonDetail);
    const hasMember = memberDetail && !isDetailEmpty(memberDetail);
    const showTabs = hasCommon || hasMember;

    // 編集開始
    const startEditing = useCallback(() => {
        setEditing(true);
        setEditData(
            memberDetail
                ? { ...memberDetail, references: [...(memberDetail.references || [])] }
                : emptyDetail()
        );
        setUrlErrors([]);
        setMessage(null);
    }, [memberDetail]);

    // メンバー情報の追加ボタン
    const handleAddMemberInfo = useCallback(() => {
        setActiveTab('member');
        setEditing(true);
        setEditData(emptyDetail());
        setUrlErrors([]);
        setMessage(null);
    }, []);

    // 編集キャンセル
    const cancelEditing = useCallback(() => {
        setEditing(false);
        setEditData(emptyDetail());
        setUrlErrors([]);
    }, []);

    // URL バリデーション
    const validateUrls = useCallback((refs) => {
        const errors = [];
        for (let i = 0; i < refs.length; i++) {
            if (refs[i].url && !isValidUrl(refs[i].url)) {
                errors.push(i);
            }
        }
        return errors;
    }, []);

    // 保存
    const handleSave = useCallback(async () => {
        if (!termDetailService) return;
        const errors = validateUrls(editData.references);
        if (errors.length > 0) {
            setUrlErrors(errors);
            return;
        }

        setSaving(true);
        setMessage(null);
        try {
            // 空の参考資料を除去
            const cleanedData = {
                ...editData,
                references: editData.references.filter((r) => r.title || r.url),
            };
            const result = await termDetailService.saveMemberGroupTermDetail(
                memberId,
                groupId,
                termKey,
                cleanedData
            );
            if (result.success) {
                setMemberDetail(cleanedData);
                setEditing(false);
                setMessage({ type: 'success', text: 'メンバー情報を保存しました' });
                if (!activeTab) setActiveTab('member');
            } else {
                setMessage({ type: 'error', text: `保存に失敗しました: ${result.error}` });
            }
        } catch (err) {
            setMessage({ type: 'error', text: `保存に失敗しました: ${err.message}` });
        } finally {
            setSaving(false);
        }
    }, [termDetailService, editData, memberId, groupId, termKey, validateUrls, activeTab]);

    // 削除
    const handleDelete = useCallback(async () => {
        if (!termDetailService) return;
        setDeleting(true);
        setMessage(null);
        try {
            const result = await termDetailService.deleteMemberGroupTermDetail(
                memberId,
                groupId,
                termKey
            );
            if (result.success) {
                setMemberDetail(null);
                setEditing(false);
                setShowDeleteConfirm(false);
                setActiveTab(hasCommon ? 'common' : null);
                setMessage({ type: 'success', text: 'メンバー情報を削除しました' });
            } else {
                setMessage({ type: 'error', text: `削除に失敗しました: ${result.error}` });
            }
        } catch (err) {
            setMessage({ type: 'error', text: `削除に失敗しました: ${err.message}` });
        } finally {
            setDeleting(false);
        }
    }, [termDetailService, memberId, groupId, termKey, hasCommon]);

    // 参考資料の追加/更新/削除
    const addReference = useCallback(() => {
        setEditData((prev) => ({
            ...prev,
            references: [...prev.references, { title: '', url: '' }],
        }));
    }, []);

    const updateReference = useCallback((index, field, value) => {
        setEditData((prev) => {
            const refs = [...prev.references];
            refs[index] = { ...refs[index], [field]: value };
            return { ...prev, references: refs };
        });
        setUrlErrors((prev) => prev.filter((i) => i !== index));
    }, []);

    const removeReference = useCallback((index) => {
        setEditData((prev) => ({
            ...prev,
            references: prev.references.filter((_, i) => i !== index),
        }));
        setUrlErrors((prev) => prev.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)));
    }, []);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-28 skeleton" />
                <div className="card-base p-8 space-y-3">
                    <div className="h-6 w-48 skeleton" />
                    <div className="h-4 w-64 skeleton" />
                </div>
                <div className="card-base p-6 space-y-3">
                    <div className="h-5 w-36 skeleton" />
                    <div className="h-4 w-full skeleton" />
                    <div className="h-4 w-full skeleton" />
                </div>
                <span className="sr-only">読み込み中…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-4">
                <div className="mx-auto max-w-xl mt-8 card-base border-l-4 border-l-error p-4 text-red-700">
                    {error}
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

    /** 詳細情報の表示コンポーネント */
    const renderDetail = (detail) => {
        if (!detail || isDetailEmpty(detail)) return null;
        return (
            <div className="space-y-4">
                {detail.purpose && (
                    <div>
                        <h4 className="text-sm font-semibold text-text-secondary mb-1">
                            セッションの目的
                        </h4>
                        <p className="text-sm text-text-primary whitespace-pre-wrap">
                            {detail.purpose}
                        </p>
                    </div>
                )}
                {detail.learningContent && (
                    <div>
                        <h4 className="text-sm font-semibold text-text-secondary mb-1">学習内容</h4>
                        <p className="text-sm text-text-primary whitespace-pre-wrap">
                            {detail.learningContent}
                        </p>
                    </div>
                )}
                {detail.learningOutcome && (
                    <div>
                        <h4 className="text-sm font-semibold text-text-secondary mb-1">
                            学習の成果
                        </h4>
                        <p className="text-sm text-text-primary whitespace-pre-wrap">
                            {detail.learningOutcome}
                        </p>
                    </div>
                )}
                {detail.references && detail.references.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-text-secondary mb-1">参考資料</h4>
                        <ul className="space-y-1">
                            {detail.references.map((ref, i) => (
                                <li key={i} className="text-sm">
                                    <a
                                        href={ref.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 hover:underline"
                                    >
                                        {ref.title || ref.url}
                                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    /** 編集フォーム */
    const renderEditForm = () => (
        <div className="space-y-4">
            <div>
                <label
                    htmlFor="edit-purpose"
                    className="block text-sm font-semibold text-text-secondary mb-1"
                >
                    セッションの目的
                </label>
                <input
                    type="text"
                    id="edit-purpose"
                    value={editData.purpose}
                    onChange={(e) => setEditData((prev) => ({ ...prev, purpose: e.target.value }))}
                    className="w-full rounded-lg border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
            </div>
            <div>
                <label
                    htmlFor="edit-learningContent"
                    className="block text-sm font-semibold text-text-secondary mb-1"
                >
                    学習内容
                </label>
                <textarea
                    id="edit-learningContent"
                    value={editData.learningContent}
                    onChange={(e) =>
                        setEditData((prev) => ({ ...prev, learningContent: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
            </div>
            <div>
                <label
                    htmlFor="edit-learningOutcome"
                    className="block text-sm font-semibold text-text-secondary mb-1"
                >
                    学習の成果
                </label>
                <textarea
                    id="edit-learningOutcome"
                    value={editData.learningOutcome}
                    onChange={(e) =>
                        setEditData((prev) => ({ ...prev, learningOutcome: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-border-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
            </div>
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-text-secondary">参考資料</span>
                    <button
                        type="button"
                        onClick={addReference}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
                    >
                        <Plus className="w-3 h-3" aria-hidden="true" />
                        追加
                    </button>
                </div>
                <div className="space-y-2">
                    {editData.references.map((ref, i) => (
                        <div key={i} className="flex gap-2 items-center">
                            <input
                                type="text"
                                value={ref.title}
                                onChange={(e) => updateReference(i, 'title', e.target.value)}
                                placeholder="タイトル"
                                className="w-2/5 rounded-lg border border-border-light px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <input
                                type="url"
                                value={ref.url}
                                onChange={(e) => updateReference(i, 'url', e.target.value)}
                                placeholder="https://..."
                                className={`flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                                    urlErrors.includes(i)
                                        ? 'border-red-400 bg-red-50'
                                        : 'border-border-light'
                                }`}
                            />
                            <button
                                type="button"
                                onClick={() => removeReference(i)}
                                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                                aria-label={`参考資料 ${i + 1} を削除`}
                            >
                                <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                    {editData.references.some((_, i) => urlErrors.includes(i)) && (
                        <p className="text-xs text-red-600">
                            http または https の URL を入力してください
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="w-4 h-4" aria-hidden="true" />
                    {saving ? '保存中...' : '保存'}
                </button>
                <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg border border-border-light text-sm text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-50"
                >
                    キャンセル
                </button>
                {hasMember && (
                    <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={saving}
                        className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-red-600 text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        削除
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* 戻るボタン */}
            <button
                type="button"
                onClick={() => navigateBack(navigate)}
                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg px-3 py-1.5 -ml-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                戻る
            </button>

            {/* メッセージ */}
            <div aria-live="polite">
                {message && (
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

            {/* ヘッダーカード */}
            <div className="card-base rounded-t-none overflow-hidden animate-fade-in-up">
                <div className="h-1 bg-gradient-to-r from-primary-500 via-primary-400 to-accent-400" />
                <div className="px-8 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-base">
                            {memberName.charAt(0)}
                        </div>
                        <h2 className="text-lg font-bold text-text-primary">{memberName}</h2>
                        <span className="text-base text-text-secondary font-medium">
                            {groupName} / {termLabel}
                        </span>
                    </div>
                </div>
            </div>

            {/* 2カラムレイアウト: 詳細情報（左） + セッション一覧（右） */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 詳細情報エリア */}
                <div
                    className="card-base overflow-hidden animate-fade-in-up"
                    style={{ animationDelay: '80ms' }}
                >
                    {/* タブ */}
                    {showTabs && (
                        <div className="border-b border-border-light flex">
                            {hasCommon && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveTab('common');
                                        setEditing(false);
                                    }}
                                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                                        activeTab === 'common'
                                            ? 'border-b-2 border-primary-500 text-primary-700'
                                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
                                    }`}
                                >
                                    共通情報
                                </button>
                            )}
                            {hasMember && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveTab('member');
                                        setEditing(false);
                                    }}
                                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                                        activeTab === 'member'
                                            ? 'border-b-2 border-primary-500 text-primary-700'
                                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
                                    }`}
                                >
                                    メンバー情報
                                </button>
                            )}
                        </div>
                    )}

                    <div className="p-6">
                        {/* 両方未登録: 追加ボタン */}
                        {!showTabs && !editing && (
                            <div className="flex items-center justify-center py-8">
                                <button
                                    type="button"
                                    onClick={handleAddMemberInfo}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
                                >
                                    <Plus className="w-4 h-4" aria-hidden="true" />
                                    メンバー情報を追加
                                </button>
                            </div>
                        )}

                        {/* 共通情報タブの内容 */}
                        {activeTab === 'common' && !editing && renderDetail(commonDetail)}

                        {/* メンバー情報タブの内容 */}
                        {activeTab === 'member' && !editing && (
                            <div>
                                {renderDetail(memberDetail)}
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        onClick={startEditing}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-primary-600 hover:bg-primary-50 transition-colors"
                                    >
                                        <Pencil className="w-4 h-4" aria-hidden="true" />
                                        編集
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 編集フォーム */}
                        {editing && renderEditForm()}
                    </div>
                </div>

                {/* セッション一覧 */}
                <div
                    className="card-base overflow-hidden animate-fade-in-up"
                    style={{ animationDelay: '160ms' }}
                >
                    <div className="px-6 py-4 border-b border-border-light flex items-center justify-between">
                        <h3 className="text-base font-bold text-text-primary">セッション一覧</h3>
                        <div className="flex items-center gap-4 text-sm text-text-secondary">
                            <span className="flex items-center gap-1.5">
                                <Clock
                                    className="w-4 h-4 text-text-muted"
                                    aria-hidden="true"
                                />
                                合計{' '}
                                <span className="font-display font-semibold text-text-primary">
                                    {formatDuration(totalDurationSeconds)}
                                </span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Calendar
                                    className="w-4 h-4 text-text-muted"
                                    aria-hidden="true"
                                />
                                <span className="font-display font-semibold text-text-primary">
                                    {sessions.length}
                                </span>
                                回参加
                            </span>
                        </div>
                    </div>
                    {sessions.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border-light bg-surface-muted/50">
                                        <th
                                            scope="col"
                                            className="px-6 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider"
                                        >
                                            日付
                                        </th>
                                        <th scope="col" className="px-6 py-2" />
                                        <th
                                            scope="col"
                                            className="px-6 py-2 text-right text-xs font-semibold text-text-muted uppercase tracking-wider"
                                        >
                                            参加時間
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-6 py-2 text-center text-xs font-semibold text-text-muted uppercase tracking-wider"
                                        >
                                            役割
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light">
                                    {sessions.map((session) => (
                                        <tr
                                            key={session.sessionId}
                                            className="text-sm hover:bg-surface-muted transition-colors"
                                        >
                                            <td className="px-6 py-3 text-text-primary whitespace-nowrap">
                                                {session.date}
                                            </td>
                                            <td className="px-6 py-3 text-text-secondary text-sm">
                                                {session.title || ''}
                                            </td>
                                            <td className="px-6 py-3 text-text-primary text-right font-medium font-display tabular-nums">
                                                {formatDuration(session.durationSeconds)}
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {session.isInstructor && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                                                        <GraduationCap
                                                            className="w-3 h-3"
                                                            aria-hidden="true"
                                                        />
                                                        講師
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-6 py-8 text-center text-sm text-text-muted">
                            セッションデータはありません
                        </div>
                    )}
                </div>
            </div>

            {/* 削除確認ダイアログ */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40"
                        aria-hidden="true"
                        onClick={() => !deleting && setShowDeleteConfirm(false)}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-member-detail-title"
                        className="relative w-full max-w-md card-base p-6 animate-scale-in"
                    >
                        <h4
                            id="delete-member-detail-title"
                            className="text-lg font-bold text-text-primary"
                        >
                            メンバー情報の削除
                        </h4>
                        <p className="text-sm text-text-muted mt-2">
                            このメンバー情報を削除しますか？この操作は取り消せません。
                        </p>
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                className="px-4 py-2 rounded-lg border border-border-light text-sm text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? '削除中...' : '削除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
