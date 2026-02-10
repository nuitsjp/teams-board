import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DataFetcher } from '../services/data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';
import { ArrowLeft, Clock, Calendar, Users, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

const fetcher = new DataFetcher();

/**
 * グループ詳細画面 — セッション一覧と参加者詳細を表示
 */
export function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
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
        const totalDurationSeconds = session.attendances.reduce((acc, a) => acc + a.durationSeconds, 0);
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
    return () => { cancelled = true; };
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
      <div className="flex items-center justify-center py-20 text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        読み込み中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="mx-auto max-w-xl mt-8 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error}
        </div>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          一覧へ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 戻るボタン */}
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        一覧へ戻る
      </button>

      {/* グループヘッダーカード */}
      <div className="bg-surface rounded-xl border border-border-light p-6 flex items-center gap-6">
        <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center text-primary-700 font-bold text-xl">
          <Users className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">{group.name}</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-text-muted" />
              {group.sessionIds.length}回開催
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-text-muted" />
              合計 {formatDuration(group.totalDurationSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* セッション別サマリー＋アコーディオン */}
      <div className="space-y-4">
        {sessionDetails.map((session) => {
          const isExpanded = expandedSessions.has(session.sessionId);
          return (
            <div key={session.sessionId} className="bg-surface rounded-xl border border-border-light overflow-hidden">
              {/* セッションサマリーカード */}
              <button
                onClick={() => toggleSession(session.sessionId)}
                className="w-full p-6 flex items-center justify-between text-left hover:bg-surface-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  {isExpanded
                    ? <ChevronDown className="w-5 h-5 text-text-muted" />
                    : <ChevronRight className="w-5 h-5 text-text-muted" />
                  }
                  <div>
                    <h3 className="text-base font-bold text-text-primary">{session.date}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-text-muted" />
                        {session.attendeeCount}名参加
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-text-muted" />
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
                        <tr className="border-b border-border-light bg-surface-muted text-left text-sm text-text-secondary">
                          <th className="px-6 py-3 font-medium">名前</th>
                          <th className="px-6 py-3 font-medium text-right">参加時間</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-light">
                        {session.attendees.map((attendee) => (
                          <tr key={attendee.memberId} className="text-sm">
                            <td className="px-6 py-3 text-text-primary">{attendee.name}</td>
                            <td className="px-6 py-3 text-text-primary text-right font-medium">
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
