import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DataFetcher } from '../services/data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';
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
 * グループ詳細画面 — セッション一覧と参加者詳細を表示
 */
export function GroupDetailPage() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [sessionDetails, setSessionDetails] = useState([]);
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
        found.sessionIds.map((sid) => fetcher.fetchSession(sid))
      );
      if (cancelled) return;

      const failedSessions = sessionResults.filter((r) => !r.ok);
      if (failedSessions.length === sessionResults.length) {
        setError('セッションデータの取得に失敗しました');
        setLoading(false);
        return;
      }

      // セッションごとに参加者情報を構築
      const details = [];
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
        details.push({
          sessionId: session.id,
          date: session.date,
          attendeeCount: attendees.length,
          totalDurationSeconds,
          attendees,
        });
      }

      // セッションを日付降順でソート
      details.sort((a, b) => b.date.localeCompare(a.date));

      setSessionDetails(details);

      // セッションが1件のみの場合はデフォルトで展開
      if (details.length === 1) {
        setExpandedSessions(new Set([details[0].sessionId]));
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

      {/* グループヘッダーカード */}
      <div className="card-base p-8 flex items-center gap-6 animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700">
          <Users className="w-8 h-8" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">{group.name}</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-text-muted" aria-hidden="true" />
              {group.sessionIds.length}回開催
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-text-muted" aria-hidden="true" />
              合計 {formatDuration(group.totalDurationSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* セッション別サマリー＋アコーディオン */}
      <div className="space-y-4">
        {sessionDetails.map((session, index) => {
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
                className="w-full p-6 flex items-center justify-between text-left hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <div className="flex items-center gap-4">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-text-muted" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-text-muted" aria-hidden="true" />
                  )}
                  <div>
                    <h3 className="text-base font-bold text-text-primary">{session.date}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                        {session.attendeeCount}名参加
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                        {formatDuration(session.totalDurationSeconds)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              {/* 参加者テーブル（アコーディオン展開） */}
              {isExpanded && (
                <div className="border-t border-border-light">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-light bg-surface-muted text-left text-xs text-text-muted uppercase tracking-wider">
                          <th className="px-6 py-3 font-medium">名前</th>
                          <th className="px-6 py-3 font-medium text-right">参加時間</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-light">
                        {session.attendees.map((attendee) => (
                          <tr key={attendee.memberId} className="text-sm hover:bg-surface-muted transition-colors">
                            <td className="px-6 py-3 text-text-primary">{attendee.name}</td>
                            <td className="px-6 py-3 text-text-primary text-right font-medium tabular-nums">
                              {formatDuration(attendee.durationSeconds)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
