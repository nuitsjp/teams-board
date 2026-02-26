import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth, createAuthAdapter } from '../hooks/useAuth.jsx';
import { sharedDataFetcher } from '../services/shared-data-fetcher.js';
import { ProductionIndexFetcher, DevIndexFetcher } from '../services/index-fetcher.js';
import { AzureBlobStorage, DevBlobStorage } from '../services/blob-storage.js';
import { BlobWriter } from '../services/blob-writer.js';
import { IndexEditor } from '../services/index-editor.js';
import { APP_CONFIG } from '../config/app-config.js';
import { formatDuration } from '../utils/format-duration.js';
import { getFiscalPeriod } from '../utils/fiscal-period.js';
import {
    ArrowLeft,
    Clock,
    Calendar,
    Users,
    GraduationCap,
    ChevronDown,
    ChevronRight,
    Trash2,
    AlertCircle,
    CheckCircle,
} from 'lucide-react';

/**
 * セッションの日付と別名を分離して返す
 * 日付を先頭に固定し、別名がある場合は別要素として返す
 */
function formatSessionParts(session) {
    return { date: session.date, title: session.title || null };
}

/**
 * startedAt（ISO 8601）から YYYY-MM-DD を抽出する
 */
function extractDate(startedAt) {
    if (!startedAt) return '';
    return startedAt.slice(0, 10);
}

/**
 * グループ詳細画面 — 期別2カラムレイアウトでセッション一覧と参加者詳細を表示
 */
export function GroupDetailPage() {
    const { groupId } = useParams();
    const auth = useAuth();
    const authAdapter = useMemo(() => createAuthAdapter(auth), [auth]);

    // 管理者モード時のみ書き込み系サービスを初期化
    const indexFetcher = useMemo(() => {
        if (!auth.isAdmin) return null;
        if (import.meta.env.DEV && authAdapter.getSasToken() === 'dev') {
            return new DevIndexFetcher();
        }
        return new ProductionIndexFetcher(APP_CONFIG.blobBaseUrl, authAdapter);
    }, [auth.isAdmin, authAdapter]);

    const blobStorage = useMemo(() => {
        if (!auth.isAdmin) return null;
        if (import.meta.env.DEV && authAdapter.getSasToken() === 'dev') {
            return new DevBlobStorage();
        }
        return new AzureBlobStorage(APP_CONFIG.blobBaseUrl, authAdapter);
    }, [auth.isAdmin, authAdapter]);

    const blobWriter = useMemo(() => {
        if (!indexFetcher || !blobStorage) return null;
        return new BlobWriter(indexFetcher, blobStorage);
    }, [indexFetcher, blobStorage]);

    const indexEditor = useMemo(() => (auth.isAdmin ? new IndexEditor() : null), [auth.isAdmin]);

    const [group, setGroup] = useState(null);
    const [periodSessions, setPeriodSessions] = useState([]);
    const [selectedPeriodLabel, setSelectedPeriodLabel] = useState(null);
    const [expandedSessions, setExpandedSessions] = useState(new Set());
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    // 管理者機能用の状態
    const [cachedIndex, setCachedIndex] = useState(null);
    const [sessionDataMap, setSessionDataMap] = useState(new Map());
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);

            const indexResult = await sharedDataFetcher.fetchIndex();
            if (cancelled) return;
            if (!indexResult.ok) {
                setError(`データ取得エラー: ${indexResult.error}`);
                setLoading(false);
                return;
            }

            setCachedIndex(indexResult.data);

            const { groups, members } = indexResult.data;
            const found = groups.find((g) => g.id === groupId);
            if (!found) {
                setError('グループが見つかりません');
                setLoading(false);
                return;
            }

            setGroup(found);

            const memberNameMap = new Map(members.map((m) => [m.id, m.name]));

            const sessionResults = await Promise.all(
                found.sessionRevisions.map((ref) => sharedDataFetcher.fetchSession(ref))
            );
            if (cancelled) return;

            const failedSessions = sessionResults.filter((r) => !r.ok);
            if (failedSessions.length === sessionResults.length) {
                setError('セッションデータの取得に失敗しました');
                setLoading(false);
                return;
            }

            // sessionRef → セッション生データ のマップを構築
            const newSessionDataMap = new Map();

            // 期別にセッションをグルーピング
            const periodMap = new Map();
            for (let i = 0; i < sessionResults.length; i++) {
                const result = sessionResults[i];
                if (!result.ok) continue;
                const session = result.data;
                const sessionRef = found.sessionRevisions[i];
                newSessionDataMap.set(sessionRef, session);

                const totalDurationSeconds = session.attendances.reduce(
                    (acc, a) => acc + a.durationSeconds,
                    0
                );
                const attendees = session.attendances.map((a) => ({
                    memberId: a.memberId,
                    name: memberNameMap.get(a.memberId) || '不明',
                    durationSeconds: a.durationSeconds,
                }));
                // 参加者を名前の日本語ロケール順でソート
                attendees.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

                const date = extractDate(session.startedAt);
                const period = getFiscalPeriod(date);
                if (!periodMap.has(period.label)) {
                    periodMap.set(period.label, {
                        label: period.label,
                        fiscalYear: period.fiscalYear,
                        half: period.half,
                        sortKey: period.sortKey,
                        totalSessions: 0,
                        totalDurationSeconds: 0,
                        sessions: [],
                    });
                }
                const periodEntry = periodMap.get(period.label);
                periodEntry.totalSessions += 1;
                periodEntry.totalDurationSeconds += totalDurationSeconds;
                // 講師 ULID 配列からメンバー名を解決
                const instructorNames = (session.instructors || [])
                    .map((id) => memberNameMap.get(id))
                    .filter(Boolean);

                periodEntry.sessions.push({
                    sessionId: session.sessionId,
                    sessionRef,
                    date,
                    title: session.title,
                    attendeeCount: attendees.length,
                    totalDurationSeconds,
                    attendees,
                    instructorNames,
                });
            }

            setSessionDataMap(newSessionDataMap);

            // 各期内でセッションを日付降順でソート
            const periods = Array.from(periodMap.values());
            for (const period of periods) {
                period.sessions.sort((a, b) => b.date.localeCompare(a.date));
            }

            // 期を降順ソート（最新が先頭）
            periods.sort((a, b) => b.sortKey - a.sortKey);

            setPeriodSessions(periods);

            // デフォルトで最新の期を選択
            if (periods.length > 0) {
                setSelectedPeriodLabel(periods[0].label);
            }

            // 選択した期のセッションが1件のみの場合はデフォルトで展開
            if (periods.length > 0 && periods[0].sessions.length === 1) {
                setExpandedSessions(new Set([periods[0].sessions[0].sessionId]));
            }

            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [groupId, refreshKey]);

    const toggleSession = (sessionId) => {
        setExpandedSessions((prev) => {
            const next = new Set(prev);
            if (next.has(sessionId)) {
                next.delete(sessionId);
            } else {
                next.add(sessionId);
            }
            return next;
        });
    };

    // セッション削除ハンドラ
    const handleDeleteSession = useCallback(async () => {
        if (!deleteTarget || !blobWriter || !indexEditor) return;

        setDeleting(true);
        setDeleteMessage(null);

        try {
            // セッション生データを取得
            const sessionData = sessionDataMap.get(deleteTarget.sessionRef);
            if (!sessionData) {
                setDeleteMessage({
                    type: 'error',
                    text: 'セッションデータが見つかりません',
                });
                return;
            }

            // BlobWriter で保存（indexUpdater 内で楽観ロック + 再計算）
            const cachedVersion = cachedIndex?.version ?? 0;
            const targetSessionRef = deleteTarget.sessionRef;
            const result = await blobWriter.executeWriteSequence({
                newItems: [],
                indexUpdater: (latestIndex) => {
                    // 楽観ロック: BlobWriter が取得した最新 index の version を検証
                    if ((latestIndex.version ?? 0) !== cachedVersion) {
                        return null;
                    }
                    // 最新 index から削除結果を再計算
                    const { index: updatedIndex, error: editError } =
                        indexEditor.removeSessionFromGroup(
                            latestIndex,
                            groupId,
                            targetSessionRef,
                            sessionData
                        );
                    if (editError) {
                        return null;
                    }
                    return updatedIndex;
                },
            });

            if (!result.allSucceeded) {
                const errorMessages = result.results
                    .filter((r) => !r.success)
                    .map((r) => r.error)
                    .join(', ');
                setDeleteMessage({
                    type: 'error',
                    text: `削除の保存に失敗しました。${errorMessages}`,
                });
                return;
            }

            // indexUpdater が null を返した場合、index.json の PUT はスキップされる
            // → results に data/index.json が含まれない = 競合 or 編集エラー
            const indexWritten = result.results.some(
                (r) => r.path === 'data/index.json'
            );
            if (!indexWritten) {
                setDeleteMessage({
                    type: 'error',
                    text: '他のユーザーが同時に編集しています。ページを再読み込みしてください',
                });
                return;
            }

            // 成功: キャッシュ無効化 → 再取得
            sharedDataFetcher.invalidateIndexCache();
            setDeleteTarget(null);
            setRefreshKey((prev) => prev + 1);
            setDeleteMessage({
                type: 'success',
                text: 'セッションを削除しました',
            });
        } catch (err) {
            setDeleteMessage({
                type: 'error',
                text: `削除に失敗しました。${err.message}`,
            });
        } finally {
            setDeleting(false);
        }
    }, [deleteTarget, blobWriter, indexEditor, cachedIndex, sessionDataMap, groupId]);

    const selectedPeriod = periodSessions.find((p) => p.label === selectedPeriodLabel);

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
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="card-base p-6 space-y-3">
                        <div className="h-5 w-48 skeleton" />
                        <div className="h-4 w-36 skeleton" />
                    </div>
                ))}
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
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-lg"
                >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    一覧へ戻る
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 戻るボタン */}
            <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg px-3 py-1.5 -ml-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                一覧へ戻る
            </Link>

            {/* 成功/エラーメッセージ */}
            <div aria-live="polite">
                {deleteMessage && (
                    <div
                        className={`p-3 rounded-xl flex items-center gap-2 animate-scale-in ${
                            deleteMessage.type === 'success'
                                ? 'bg-green-50 text-green-800'
                                : 'bg-red-50 text-red-800'
                        }`}
                    >
                        {deleteMessage.type === 'success' ? (
                            <CheckCircle className="w-5 h-5" aria-hidden="true" />
                        ) : (
                            <AlertCircle className="w-5 h-5" aria-hidden="true" />
                        )}
                        <span className="text-sm">{deleteMessage.text}</span>
                    </div>
                )}
            </div>

            {/* グループヘッダーカード — アクセント帯付き */}
            <div className="card-base rounded-t-none overflow-hidden animate-fade-in-up">
                <div className="h-1 bg-gradient-to-r from-primary-500 via-primary-400 to-accent-400" />
                <div className="p-8 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700">
                        <Users className="w-8 h-8" aria-hidden="true" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-text-primary break-words">
                            {group.name}
                        </h2>
                        <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
                            <span className="flex items-center gap-1.5">
                                <Calendar
                                    className="w-4 h-4 text-text-muted"
                                    aria-hidden="true"
                                />
                                <span className="font-display font-semibold text-text-primary">
                                    {group.sessionRevisions.length}
                                </span>
                                回開催
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-text-muted" aria-hidden="true" />
                                合計{' '}
                                <span className="font-display font-semibold text-text-primary">
                                    {formatDuration(group.totalDurationSeconds)}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 期別2カラムレイアウト */}
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
                {/* 左列: 期サマリーリスト */}
                <div className="space-y-2">
                    {periodSessions.map((period) => {
                        const isSelected = period.label === selectedPeriodLabel;
                        return (
                            <button
                                key={period.label}
                                onClick={() => setSelectedPeriodLabel(period.label)}
                                aria-pressed={isSelected}
                                className={`w-full text-left px-4 py-3 rounded-r-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                                    isSelected
                                        ? 'bg-white shadow-sm border-l-3 border-l-primary-500'
                                        : 'hover:bg-surface-muted border-l-3 border-l-transparent'
                                }`}
                            >
                                <div className="text-base font-bold text-text-primary">
                                    {period.label}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary">
                                    <span className="flex items-center gap-1">
                                        <Calendar
                                            className="w-3.5 h-3.5 text-text-muted"
                                            aria-hidden="true"
                                        />
                                        <span className="font-display font-semibold">
                                            {period.totalSessions}
                                        </span>
                                        回
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock
                                            className="w-3.5 h-3.5 text-text-muted"
                                            aria-hidden="true"
                                        />
                                        <span className="font-display">
                                            {formatDuration(period.totalDurationSeconds)}
                                        </span>
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* 右列: 選択した期のセッション別アコーディオン */}
                <div className="space-y-4">
                    {selectedPeriod &&
                        selectedPeriod.sessions.map((session, index) => {
                            const isExpanded = expandedSessions.has(session.sessionId);
                            return (
                                <div
                                    key={session.sessionId}
                                    className="card-base overflow-hidden animate-fade-in-up"
                                    style={{ animationDelay: `${index * 80}ms` }}
                                >
                                    {/* セッションサマリーカード */}
                                    <div className="flex items-center">
                                        <button
                                            onClick={() => toggleSession(session.sessionId)}
                                            aria-expanded={isExpanded}
                                            className="flex-1 px-6 py-3.5 flex items-center justify-between text-left hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                                        >
                                            <div className="flex items-center gap-4">
                                                {isExpanded ? (
                                                    <ChevronDown
                                                        className="w-5 h-5 text-text-muted"
                                                        aria-hidden="true"
                                                    />
                                                ) : (
                                                    <ChevronRight
                                                        className="w-5 h-5 text-text-muted"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                <div>
                                                    <h3 className="text-base font-bold text-text-primary">
                                                        {(() => {
                                                            const parts =
                                                                formatSessionParts(session);
                                                            return (
                                                                <>
                                                                    <span>{parts.date}</span>
                                                                    {parts.title && (
                                                                        <span className="ml-2 font-normal text-text-secondary">
                                                                            {parts.title}
                                                                        </span>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </h3>
                                                    {session.instructorNames.length > 0 && (
                                                        <div className="flex items-center gap-1.5 mt-0.5 text-sm text-text-secondary">
                                                            <GraduationCap
                                                                className="w-3.5 h-3.5 text-text-muted"
                                                                aria-hidden="true"
                                                            />
                                                            <span>
                                                                {session.instructorNames.join(
                                                                    '、'
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                                                        <span className="flex items-center gap-1.5">
                                                            <Users
                                                                className="w-3.5 h-3.5 text-text-muted"
                                                                aria-hidden="true"
                                                            />
                                                            <span className="font-display font-semibold text-text-primary">
                                                                {session.attendeeCount}
                                                            </span>
                                                            名参加
                                                        </span>
                                                        <span className="flex items-center gap-1.5">
                                                            <Clock
                                                                className="w-3.5 h-3.5 text-text-muted"
                                                                aria-hidden="true"
                                                            />
                                                            <span className="font-display">
                                                                {formatDuration(
                                                                    session.totalDurationSeconds
                                                                )}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                        {auth.isAdmin && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setDeleteTarget({
                                                        sessionRef: session.sessionRef,
                                                        date: session.date,
                                                        title: session.title,
                                                        attendeeCount: session.attendeeCount,
                                                    })
                                                }
                                                className="mr-4 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                                                aria-label={`${session.date} のセッションを削除`}
                                            >
                                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>

                                    {/* 参加者テーブル（スムーズアコーディオン展開） */}
                                    <div
                                        className="accordion-panel"
                                        data-expanded={isExpanded}
                                        aria-hidden={!isExpanded}
                                    >
                                        <div className="accordion-panel-inner">
                                            <div className="border-t border-border-light">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr>
                                                                <th
                                                                    scope="col"
                                                                    className="sr-only"
                                                                >
                                                                    名前
                                                                </th>
                                                                <th
                                                                    scope="col"
                                                                    className="sr-only"
                                                                >
                                                                    参加時間
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border-light">
                                                            {session.attendees.map((attendee) => (
                                                                <tr
                                                                    key={attendee.memberId}
                                                                    className="text-sm hover:bg-surface-muted transition-colors"
                                                                >
                                                                    <td className="px-6 py-3 text-text-primary">
                                                                        {attendee.name}
                                                                    </td>
                                                                    <td className="px-6 py-3 text-text-primary text-right font-medium font-display tabular-nums">
                                                                        {formatDuration(
                                                                            attendee.durationSeconds
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* 削除確認ダイアログ */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40"
                        aria-hidden="true"
                        onClick={() => !deleting && setDeleteTarget(null)}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-dialog-title"
                        className="relative w-full max-w-md card-base p-6 animate-scale-in"
                    >
                        <h4
                            id="delete-dialog-title"
                            className="text-lg font-bold text-text-primary"
                        >
                            セッションの削除
                        </h4>
                        <p className="text-sm text-text-muted mt-2">
                            このセッションをグループから削除しますか？
                        </p>
                        <div className="mt-4 p-3 rounded-lg bg-surface-muted text-sm space-y-1">
                            <div className="flex items-center gap-2">
                                <Calendar
                                    className="w-4 h-4 text-text-muted"
                                    aria-hidden="true"
                                />
                                <span className="font-medium">{deleteTarget.date}</span>
                                {deleteTarget.title && (
                                    <span className="text-text-secondary">
                                        {deleteTarget.title}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-text-muted" aria-hidden="true" />
                                <span>{deleteTarget.attendeeCount}名参加</span>
                            </div>
                        </div>
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                className="px-4 py-2 rounded-lg border border-border-light text-sm text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed"
                                onClick={handleDeleteSession}
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
