import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Calendar, ChevronRight, Clock, GraduationCap } from 'lucide-react';
import { sharedDataFetcher } from '../services/shared-data-fetcher.js';
import { fetchMemberTermSummary } from '../services/member-term-summary.js';
import { formatDuration } from '../utils/format-duration.js';
import { navigateBack } from '../utils/navigate-back.js';

function GroupSummaryRow({ group, onClick }) {
    return (
        <button
            type="button"
            data-testid="member-term-group-row"
            onClick={onClick}
            className="list-accent-primary w-full p-4 px-6 hover:bg-surface-muted cursor-pointer flex justify-between items-center group border-b border-border-light last:border-b-0 last:rounded-b-2xl min-h-[73px] text-left"
        >
            <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-text-primary truncate">{group.groupName}</h3>
                {group.organizerName && (
                    <div className="flex items-center gap-1 text-xs text-text-muted mt-1">
                        <Building2 className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{group.organizerName}</span>
                    </div>
                )}
            </div>
            <div className="flex items-center text-sm text-text-secondary gap-4 shrink-0">
                {group.hasInstructorSession && (
                    <span className="flex items-center gap-1.5 bg-primary-50 text-primary-700 px-2.5 py-1 rounded-md">
                        <GraduationCap className="w-4 h-4" aria-hidden="true" />
                        <span className="font-semibold font-display">
                            {group.instructorSessionCount}
                        </span>
                        回
                    </span>
                )}
                <span className="flex items-center gap-1.5 bg-surface-muted px-2.5 py-1 rounded-md">
                    <span className="font-semibold text-text-primary font-display">
                        {group.sessionCount}
                    </span>
                    回参加
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Clock className="w-4 h-4 text-text-muted" aria-hidden="true" />
                    <span className="font-display">
                        {formatDuration(group.totalDurationSeconds)}
                    </span>
                </span>
                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary-600 transition-colors" />
            </div>
        </button>
    );
}

export function MemberDetailPage() {
    const { memberId } = useParams();
    const navigate = useNavigate();
    const [member, setMember] = useState(null);
    const [periods, setPeriods] = useState([]);
    const [selectedTermKey, setSelectedTermKey] = useState(null);
    const [totalInstructorSessions, setTotalInstructorSessions] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);

            const result = await fetchMemberTermSummary(sharedDataFetcher, memberId);
            if (cancelled) {
                return;
            }

            if (!result.ok) {
                setError(result.error);
                setLoading(false);
                return;
            }

            setMember(result.data.member);
            setPeriods(result.data.periods);
            setTotalInstructorSessions(result.data.totalInstructorSessions);
            setSelectedTermKey(result.data.periods[0]?.termKey ?? null);
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [memberId]);

    const selectedPeriod =
        periods.find((period) => period.termKey === selectedTermKey) ?? periods[0] ?? null;

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
            <button
                type="button"
                onClick={() => navigateBack(navigate)}
                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg px-3 py-1.5 -ml-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                戻る
            </button>

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
                                合計
                                <span className="font-display font-semibold text-text-primary">
                                    {formatDuration(member.totalDurationSeconds)}
                                </span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Calendar
                                    className="w-4 h-4 text-text-muted"
                                    aria-hidden="true"
                                />
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
                                    講師
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

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
                <div className="space-y-4">
                    {periods.map((period) => {
                        const isSelected = period.termKey === selectedPeriod?.termKey;
                        return (
                            <button
                                key={period.termKey}
                                type="button"
                                onClick={() => setSelectedTermKey(period.termKey)}
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
                                <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary flex-wrap">
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
                                    {period.totalInstructorSessions > 0 && (
                                        <span className="flex items-center gap-1">
                                            <GraduationCap
                                                className="w-3.5 h-3.5 text-text-muted"
                                                aria-hidden="true"
                                            />
                                            講師
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

                <div className="space-y-4">
                    {selectedPeriod && selectedPeriod.groups.length > 0 ? (
                        <div className="card-base overflow-hidden">
                            <div className="p-6 border-b border-border-light">
                                <h3 className="text-lg font-bold text-text-primary">
                                    {selectedPeriod.label} の参加グループ
                                </h3>
                                <p className="text-sm text-text-muted mt-1">
                                    グループを選択すると期詳細を表示します
                                </p>
                            </div>
                            <div>
                                {selectedPeriod.groups.map((group) => (
                                    <GroupSummaryRow
                                        key={group.groupId}
                                        group={group}
                                        onClick={() =>
                                            navigate(
                                                `/members/${memberId}/groups/${group.groupId}/terms/${selectedPeriod.termKey}`
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="card-base p-8 text-center text-text-muted">
                            この期の参加グループはありません
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
