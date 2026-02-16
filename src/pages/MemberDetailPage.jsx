import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DataFetcher } from '../services/data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';
import { getFiscalPeriod } from '../utils/fiscal-period.js';
import { ArrowLeft, Clock, Calendar, ChevronDown, ChevronRight } from 'lucide-react';

const fetcher = new DataFetcher();

/**
 * メンバー詳細画面 — 期別2カラムレイアウトでグループ別サマリーと出席履歴を表示
 */
export function MemberDetailPage() {
  const { memberId } = useParams();
  const [member, setMember] = useState(null);
  const [periodAttendances, setPeriodAttendances] = useState([]);
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
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

      const { groups, members } = indexResult.data;
      const found = members.find((m) => m.id === memberId);
      if (!found) {
        setError('参加者が見つかりません');
        setLoading(false);
        return;
      }

      setMember(found);

      const groupNameMap = new Map(groups.map((g) => [g.id, g.name]));

      const sessionResults = await Promise.all(
        found.sessionIds.map((sid) => fetcher.fetchSession(sid))
      );
      if (cancelled) return;

      const failedSessions = sessionResults.filter((r) => !r.ok);
      if (failedSessions.length === sessionResults.length) {
        setError('セッションデータの取得に失敗しました');
        setLoading(false);
        return;
      }

      // 第1段: 期別にグルーピング
      const periodMap = new Map();
      for (const result of sessionResults) {
        if (!result.ok) continue;
        const session = result.data;
        const attendance = session.attendances.find((a) => a.memberId === memberId);
        if (!attendance) continue;

        const period = getFiscalPeriod(session.date);
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
        periodEntry.totalDurationSeconds += attendance.durationSeconds;
        periodEntry.sessions.push({
          groupId: session.groupId,
          groupName: groupNameMap.get(session.groupId) || '不明',
          date: session.date,
          durationSeconds: attendance.durationSeconds,
        });
      }

      // 第2段: 各期内でグループ別にグルーピング
      const periods = Array.from(periodMap.values());
      for (const period of periods) {
        const groupMap = new Map();
        for (const session of period.sessions) {
          if (!groupMap.has(session.groupId)) {
            groupMap.set(session.groupId, {
              groupId: session.groupId,
              groupName: session.groupName,
              totalDurationSeconds: 0,
              sessions: [],
            });
          }
          const group = groupMap.get(session.groupId);
          group.totalDurationSeconds += session.durationSeconds;
          group.sessions.push({
            date: session.date,
            durationSeconds: session.durationSeconds,
          });
        }

        const grouped = Array.from(groupMap.values());
        for (const group of grouped) {
          group.sessions.sort((a, b) => b.date.localeCompare(a.date));
          group.sessionCount = group.sessions.length;
        }
        grouped.sort((a, b) => a.groupName.localeCompare(b.groupName, 'ja'));

        period.groupAttendances = grouped;
      }

      // 期を降順ソート（最新が先頭）
      periods.sort((a, b) => b.sortKey - a.sortKey);

      setPeriodAttendances(periods);

      // デフォルトで最新の期を選択
      if (periods.length > 0) {
        setSelectedPeriodLabel(periods[0].label);
      }

      // 選択した期のグループが1つのみの場合はデフォルトで展開
      if (periods.length > 0 && periods[0].groupAttendances.length === 1) {
        setExpandedGroups(new Set([periods[0].groupAttendances[0].groupId]));
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const selectedPeriod = periodAttendances.find((p) => p.label === selectedPeriodLabel);

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

      {/* メンバーヘッダーカード — アクセント帯付き */}
      <div className="card-base overflow-hidden animate-fade-in-up">
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
                合計 <span className="font-display font-semibold text-text-primary">{formatDuration(member.totalDurationSeconds)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-text-muted" aria-hidden="true" />
                <span className="font-display font-semibold text-text-primary">{member.sessionIds.length}</span>回参加
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 期別2カラムレイアウト */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* 左列: 期サマリーリスト */}
        <div className="space-y-2">
          {periodAttendances.map((period) => {
            const isSelected = period.label === selectedPeriodLabel;
            return (
              <button
                key={period.label}
                onClick={() => setSelectedPeriodLabel(period.label)}
                aria-pressed={isSelected}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                  isSelected
                    ? 'bg-primary-50 border-l-4 border-l-primary-500'
                    : 'hover:bg-surface-muted border-l-4 border-l-transparent'
                }`}
              >
                <div className="text-base font-bold text-text-primary">{period.label}</div>
                <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                    <span className="font-display font-semibold">{period.totalSessions}</span>回
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                    <span className="font-display">{formatDuration(period.totalDurationSeconds)}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* 右列: 選択した期のグループ別アコーディオン */}
        <div className="space-y-4">
          {selectedPeriod && selectedPeriod.groupAttendances.map((group, index) => {
            const isExpanded = expandedGroups.has(group.groupId);
            return (
              <div
                key={group.groupId}
                className="card-base overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {/* サマリーカード */}
                <button
                  onClick={() => toggleGroup(group.groupId)}
                  aria-expanded={isExpanded}
                  className="w-full p-6 flex items-center justify-between text-left hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-4">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-text-muted" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-text-muted" aria-hidden="true" />
                    )}
                    <div>
                      <h3 className="text-base font-bold text-text-primary">{group.groupName}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                          <span className="font-display font-semibold text-text-primary">{group.sessionCount}</span>回参加
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                          <span className="font-display">{formatDuration(group.totalDurationSeconds)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* 出席履歴テーブル（スムーズアコーディオン展開） */}
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
                            <tr className="border-b border-border-light bg-surface-muted text-left text-xs text-text-muted uppercase tracking-wider">
                              <th className="px-6 py-3 font-medium">日付</th>
                              <th className="px-6 py-3 font-medium text-right">参加時間</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-light">
                            {group.sessions.map((session) => (
                              <tr key={session.date} className="text-sm hover:bg-surface-muted transition-colors">
                                <td className="px-6 py-3 text-text-primary">{session.date}</td>
                                <td className="px-6 py-3 text-text-primary text-right font-medium font-display tabular-nums">
                                  {formatDuration(session.durationSeconds)}
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
    </div>
  );
}
