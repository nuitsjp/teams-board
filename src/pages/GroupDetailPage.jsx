import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DataFetcher } from '../services/data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';
import { getFiscalPeriod } from '../utils/fiscal-period.js';
import {
  ArrowLeft,
  Clock,
  Calendar,
  Users,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const fetcher = new DataFetcher();

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
  const [group, setGroup] = useState(null);
  const [periodSessions, setPeriodSessions] = useState([]);
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState(null);
  const [expandedSessions, setExpandedSessions] = useState(new Set());
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
      const found = groups.find((g) => g.id === groupId);
      if (!found) {
        setError('グループが見つかりません');
        setLoading(false);
        return;
      }

      setGroup(found);

      const memberNameMap = new Map(members.map((m) => [m.id, m.name]));

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

      // 期別にセッションをグルーピング
      const periodMap = new Map();
      for (const result of sessionResults) {
        if (!result.ok) continue;
        const session = result.data;
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
        periodEntry.sessions.push({
          sessionId: session.sessionId,
          date,
          title: session.title,
          attendeeCount: attendees.length,
          totalDurationSeconds,
          attendees,
        });
      }

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
  }, [groupId]);

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

      {/* グループヘッダーカード — アクセント帯付き */}
      <div className="card-base rounded-t-none overflow-hidden animate-fade-in-up">
        <div className="h-1 bg-gradient-to-r from-primary-500 via-primary-400 to-accent-400" />
        <div className="p-8 flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700">
            <Users className="w-8 h-8" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary break-words">{group.name}</h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-text-muted" aria-hidden="true" />
                <span className="font-display font-semibold text-text-primary">{group.sessionRevisions.length}</span>回開催
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-text-muted" aria-hidden="true" />
                合計 <span className="font-display font-semibold text-text-primary">{formatDuration(group.totalDurationSeconds)}</span>
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

        {/* 右列: 選択した期のセッション別アコーディオン */}
        <div className="space-y-4">
          {selectedPeriod && selectedPeriod.sessions.map((session, index) => {
            const isExpanded = expandedSessions.has(session.sessionId);
            return (
              <div
                key={session.sessionId}
                className="card-base overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {/* セッションサマリーカード */}
                <button
                  onClick={() => toggleSession(session.sessionId)}
                  aria-expanded={isExpanded}
                  className="w-full px-6 py-3.5 flex items-center justify-between text-left hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-4">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-text-muted" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-text-muted" aria-hidden="true" />
                    )}
                    <div>
                      <h3 className="text-base font-bold text-text-primary">
                        {(() => {
                          const parts = formatSessionParts(session);
                          return (
                            <>
                              <span>{parts.date}</span>
                              {parts.title && (
                                <span className="ml-2 font-normal text-text-secondary">{parts.title}</span>
                              )}
                            </>
                          );
                        })()}
                      </h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                          <span className="font-display font-semibold text-text-primary">{session.attendeeCount}</span>名参加
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                          <span className="font-display">{formatDuration(session.totalDurationSeconds)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

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
                              <th scope="col" className="sr-only">
                                名前
                              </th>
                              <th scope="col" className="sr-only">
                                参加時間
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-light">
                            {session.attendees.map((attendee) => (
                              <tr key={attendee.memberId} className="text-sm hover:bg-surface-muted transition-colors">
                                <td className="px-6 py-3 text-text-primary">{attendee.name}</td>
                                <td className="px-6 py-3 text-text-primary text-right font-medium font-display tabular-nums">
                                  {formatDuration(attendee.durationSeconds)}
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
