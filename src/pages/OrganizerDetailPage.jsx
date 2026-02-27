import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sharedDataFetcher } from '../services/shared-data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';
import { navigateBack } from '../utils/navigate-back.js';
import { ArrowLeft, Clock, Building2, Users, ChevronRight, Calendar } from 'lucide-react';

/**
 * 主催者詳細画面 — 主催者に紐づくグループ一覧を表示
 */
export function OrganizerDetailPage() {
    const { organizerId } = useParams();
    const navigate = useNavigate();

    const [organizer, setOrganizer] = useState(null);
    const [orgGroups, setOrgGroups] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

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

            const { groups, organizers } = indexResult.data;
            const found = (organizers ?? []).find((o) => o.id === organizerId);
            if (!found) {
                setError('主催者が見つかりません');
                setLoading(false);
                return;
            }

            setOrganizer(found);
            setOrgGroups(groups.filter((g) => g.organizerId === organizerId));
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [organizerId]);

    const stats = useMemo(() => {
        const totalDurationSeconds = orgGroups.reduce(
            (acc, g) => acc + g.totalDurationSeconds,
            0
        );
        return { groupCount: orgGroups.length, totalDurationSeconds };
    }, [orgGroups]);

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

            {/* 主催者ヘッダーカード — アクセント帯付き */}
            <div className="card-base rounded-t-none overflow-hidden animate-fade-in-up">
                <div className="h-1 bg-gradient-to-r from-primary-500 via-primary-400 to-accent-400" />
                <div className="p-8 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700">
                        <Building2 className="w-8 h-8" aria-hidden="true" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-text-primary break-words">
                            {organizer.name}
                        </h2>
                        <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
                            <span className="flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-text-muted" aria-hidden="true" />
                                <span className="font-display font-semibold text-text-primary">
                                    {stats.groupCount}
                                </span>
                                グループ
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-text-muted" aria-hidden="true" />
                                合計{' '}
                                <span className="font-display font-semibold text-text-primary">
                                    {formatDuration(stats.totalDurationSeconds)}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* グループ一覧 */}
            {orgGroups.length === 0 ? (
                <div className="card-base p-6 text-center text-text-muted">
                    この主催者に紐づくグループはありません
                </div>
            ) : (
                <div className="card-base">
                    {orgGroups.map((group, index) => (
                        <div
                            key={group.id}
                            data-testid="organizer-group-row"
                            onClick={() => navigate(`/groups/${group.id}`)}
                            className="list-accent-primary p-4 px-6 hover:bg-surface-muted cursor-pointer flex justify-between items-center group animate-fade-in-up border-b border-border-light last:border-b-0 last:rounded-b-2xl min-h-[73px]"
                            style={{ animationDelay: `${index * 60}ms` }}
                        >
                            <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-text-primary truncate">
                                    {group.name}
                                </h3>
                            </div>
                            <div className="flex items-center text-sm text-text-secondary gap-4 shrink-0">
                                <span className="flex items-center gap-1.5 bg-surface-muted px-2.5 py-1 rounded-md">
                                    <Calendar
                                        className="w-4 h-4 text-text-muted"
                                        aria-hidden="true"
                                    />
                                    <span className="font-semibold text-text-primary font-display">
                                        {group.sessionRevisions.length}
                                    </span>{' '}
                                    回開催
                                </span>
                                <span className="flex items-center gap-1.5 whitespace-nowrap">
                                    <Clock
                                        className="w-4 h-4 text-text-muted"
                                        aria-hidden="true"
                                    />
                                    <span className="font-display">
                                        {formatDuration(group.totalDurationSeconds)}
                                    </span>
                                </span>
                                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary-600 transition-colors" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
