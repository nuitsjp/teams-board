import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DataFetcher } from '../services/data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';
import { navigateBack } from '../utils/navigate-back.js';
import { getFiscalPeriod } from '../utils/fiscal-period.js';
import { ArrowLeft, Clock, Calendar, GraduationCap, Building2, ChevronRight } from 'lucide-react';

const fetcher = new DataFetcher();

/**
 * startedAt（ISO 8601）から YYYY-MM-DD を抽出する
 */
function extractDate(startedAt) {
    if (!startedAt) return '';
    return startedAt.slice(0, 10);
}

/**
 * メンバー詳細画面 — 期を選択してグループ一覧を表示し、クリックで詳細画面へ遷移
 */
export function MemberDetailPage() {
    const { memberId } = useParams();
    const navigate = useNavigate();
    const [member, setMember] = useState(null);
    const [unifiedPeriods, setUnifiedPeriods] = useState([]);
    const [selectedPeriodLabel, setSelectedPeriodLabel] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const indexResult = await fetcher.fetchIndex();
            if (cancelled) return;
            if (!indexResult.ok) {
                setError(`データ取得エラー: ${indexResult.error}`);
                setLoading(false);
                return;
            }

            const { groups, members, organizers } = indexResult.data;
            const found = members.find((m) => m.id === memberId);
            if (!found) {
                setError('参加者が見つかりません');
                setLoading(false);
                return;
            }

            setMember(found);

            // 主催者名のルックアップマップ
            const organizerMap = new Map((organizers ?? []).map((o) => [o.id, o.name]));

            // sessionRef → グループ情報のマッピング
            const sessionGroupMap = new Map();
            for (const group of groups) {
                const organizerName = group.organizerId
                    ? (organizerMap.get(group.organizerId) ?? null)
                    : null;
                for (const ref of group.sessionRevisions) {
                    sessionGroupMap.set(ref, {
                        groupId: group.id,
                        groupName: group.name,
                        organizerName,
                    });
                }
            }

            const sessionResults = await Promise.all(
                found.sessionRevisions.map((ref) => fetcher.fetchSession(ref))
            );
            if (cancelled) return;

            const failedSessions = sessionResults.filter((r) => !r.ok);
            if (failedSessions.length === sessionResults.length) {
                setError('セッションデータの取得に失敗しました');
                setLoading(false);
                return;
            }

            // 期別にグルーピング（出席 + 講師を統合）
            const periodMap = new Map();

            // 出席履歴を期別に集計
            for (let i = 0; i < sessionResults.length; i++) {
                const result = sessionResults[i];
                if (!result.ok) continue;
                const session = result.data;
                const ref = found.sessionRevisions[i];
                const attendance = session.attendances.find((a) => a.memberId === memberId);
                if (!attendance) continue;

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
                        totalInstructorSessions: 0,
                        sessions: [],
                        instructorSessions: [],
                    });
                }
                const periodEntry = periodMap.get(period.label);
                periodEntry.totalSessions += 1;
                periodEntry.totalDurationSeconds += attendance.durationSeconds;
                const resolvedGroup = sessionGroupMap.get(ref);
                if (!resolvedGroup) {
                    setError(
                        `データ不整合: セッション ${session.sessionId} の所属グループが index.json に見つかりません`
                    );
                    setLoading(false);
                    return;
                }
                periodEntry.sessions.push({
                    sessionId: session.sessionId,
                    groupId: resolvedGroup.groupId,
                    groupName: resolvedGroup.groupName,
                    organizerName: resolvedGroup.organizerName,
                    date,
                    title: session.title,
                    durationSeconds: attendance.durationSeconds,
                });
            }

            // 講師履歴を期別に集計（同じ periodMap にマージ）
            for (let i = 0; i < sessionResults.length; i++) {
                const result = sessionResults[i];
                if (!result.ok) continue;
                const session = result.data;
                const instructors = session.instructors || [];
                if (!instructors.includes(memberId)) continue;

                const ref = found.sessionRevisions[i];
                const resolvedGroup = sessionGroupMap.get(ref);
                if (!resolvedGroup) continue;

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
                        totalInstructorSessions: 0,
                        sessions: [],
                        instructorSessions: [],
                    });
                }
                const periodEntry = periodMap.get(period.label);
                periodEntry.totalInstructorSessions += 1;
                periodEntry.instructorSessions.push({
                    sessionId: session.sessionId,
                    groupId: resolvedGroup.groupId,
                    groupName: resolvedGroup.groupName,
                    organizerName: resolvedGroup.organizerName,
                    date,
                    title: session.title,
                });
            }

            // 各期内でグループ別に集計（出席・講師を統合）
            const periods = Array.from(periodMap.values());
            for (const period of periods) {
                const groupMap = new Map();

                // 出席セッションをグループ別に集計
                for (const session of period.sessions) {
                    if (!groupMap.has(session.groupId)) {
                        groupMap.set(session.groupId, {
                            groupId: session.groupId,
                            groupName: session.groupName,
                            organizerName: session.organizerName,
                            totalDurationSeconds: 0,
                            sessionCount: 0,
                            hasInstructor: false,
                        });
                    }
                    const group = groupMap.get(session.groupId);
                    group.totalDurationSeconds += session.durationSeconds;
                    group.sessionCount += 1;
                }

                // 講師セッションをグループ別にマージ
                for (const session of period.instructorSessions) {
                    if (!groupMap.has(session.groupId)) {
                        groupMap.set(session.groupId, {
                            groupId: session.groupId,
                            groupName: session.groupName,
                            organizerName: session.organizerName,
                            totalDurationSeconds: 0,
                            sessionCount: 0,
                            hasInstructor: false,
                        });
                    }
                    groupMap.get(session.groupId).hasInstructor = true;
                }

                const grouped = Array.from(groupMap.values());
                grouped.sort((a, b) => a.groupName.localeCompare(b.groupName, 'ja'));
                period.groups = grouped;
            }

            // 期を降順ソート（最新が先頭）
            periods.sort((a, b) => b.sortKey - a.sortKey);

            setUnifiedPeriods(periods);

            // デフォルトで最新の期を選択
            if (periods.length > 0) {
                setSelectedPeriodLabel(periods[0].label);
            }

            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [memberId]);

    const selectedPeriod = unifiedPeriods.find((p) => p.label === selectedPeriodLabel);
    const totalInstructorSessions = unifiedPeriods.reduce(
        (sum, p) => sum + p.totalInstructorSessions,
        0
    );

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
                {[...Array(2)].map((_, i) => (
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
            {/* 戻るボタン */}
            <button
                type="button"
                onClick={() => navigateBack(navigate)}
                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg px-3 py-1.5 -ml-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                戻る
            </button>

            {/* メンバーヘッダーカード — アクセント帯付き */}
            <div className="card-base rounded-t-none overflow-hidden animate-fade-in-up">
                <div className="h-1 bg-gradient-to-r from-primary-500 via-primary-400 to-accent-400" />
                <div className="p-8 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-2xl">
                        {member.name.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-text-primary">{member.name}</h2>
                        <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-text-muted" aria-hidden="true" />
                                合計{' '}
                                <span className="font-display font-semibold text-text-primary">
                                    {formatDuration(member.totalDurationSeconds)}
                                </span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-text-muted" aria-hidden="true" />
                                <span className="font-display font-semibold text-text-primary">
                                    {member.sessionRevisions.length}
                                </span>
                                回参加
                            </span>
                            {totalInstructorSessions > 0 && (
                                <span className="flex items-center gap-1.5">
                                    <GraduationCap
                                        className="w-4 h-4 text-text-muted"
                                        aria-hidden="true"
                                    />
                                    講師{' '}
                                    <span className="font-display font-semibold text-text-primary">
                                        {totalInstructorSessions}
                                    </span>
                                    回
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 期別2カラムレイアウト */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
                {/* 左列: 期サマリーリスト */}
                <div className="space-y-4">
                    {unifiedPeriods.map((period) => {
                        const isSelected = period.label === selectedPeriodLabel;
                        return (
                            <button
                                key={period.label}
                                onClick={() => setSelectedPeriodLabel(period.label)}
                                aria-pressed={isSelected}
                                className={`w-full text-left px-4 py-3 min-h-[73px] rounded-r-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                                    isSelected
                                        ? 'bg-white shadow-sm border-l-3 border-l-primary-500'
                                        : 'hover:bg-surface-muted border-l-3 border-l-transparent'
                                }`}
                            >
                                <div className="text-base font-bold text-text-primary">
                                    {period.label}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary">
                                    {period.totalSessions > 0 && (
                                        <>
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
                                        </>
                                    )}
                                    {period.totalInstructorSessions > 0 && (
                                        <span className="flex items-center gap-1">
                                            <GraduationCap
                                                className="w-3.5 h-3.5 text-text-muted"
                                                aria-hidden="true"
                                            />
                                            講師{' '}
                                            <span className="font-display font-semibold">
                                                {period.totalInstructorSessions}
                                            </span>
                                            回
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* 右列: 選択した期のグループ一覧 */}
                <div className="space-y-3">
                    {selectedPeriod &&
                        selectedPeriod.groups.map((group, index) => (
                            <button
                                key={group.groupId}
                                onClick={() =>
                                    navigate(
                                        `/members/${memberId}/groups/${group.groupId}/terms/${selectedPeriod.sortKey}`
                                    )
                                }
                                className="w-full card-base overflow-hidden animate-fade-in-up hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                                style={{ animationDelay: `${index * 80}ms` }}
                            >
                                <div className="px-6 py-4 flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-base font-bold text-text-primary text-left">
                                            {group.groupName}
                                        </h3>
                                        {group.organizerName && (
                                            <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
                                                <Building2
                                                    className="w-3 h-3 shrink-0"
                                                    aria-hidden="true"
                                                />
                                                <span className="truncate">
                                                    {group.organizerName}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0 text-sm text-text-secondary">
                                        <span className="flex items-center gap-1.5">
                                            <Calendar
                                                className="w-3.5 h-3.5 text-text-muted"
                                                aria-hidden="true"
                                            />
                                            <span className="font-display font-semibold text-text-primary">
                                                {group.sessionCount}
                                            </span>
                                            回参加
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Clock
                                                className="w-3.5 h-3.5 text-text-muted"
                                                aria-hidden="true"
                                            />
                                            <span className="font-display">
                                                {formatDuration(group.totalDurationSeconds)}
                                            </span>
                                        </span>
                                        {group.hasInstructor && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                                                <GraduationCap
                                                    className="w-3 h-3"
                                                    aria-hidden="true"
                                                />
                                                講師
                                            </span>
                                        )}
                                        <ChevronRight
                                            className="w-4 h-4 text-text-muted"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>
                            </button>
                        ))}
                </div>
            </div>
        </div>
    );
}
