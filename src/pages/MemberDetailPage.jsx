import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DataFetcher } from '../services/data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';
import { ArrowLeft, Clock, Calendar, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

const fetcher = new DataFetcher();

/**
 * メンバー詳細画面 — グループ別サマリーと出席履歴を表示
 */
export function MemberDetailPage() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [groupAttendances, setGroupAttendances] = useState([]);
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

      // グループ別にグルーピング
      const groupMap = new Map();
      for (const result of sessionResults) {
        if (!result.ok) continue;
        const session = result.data;
        const attendance = session.attendances.find((a) => a.memberId === memberId);
        if (!attendance) continue;

        const groupId = session.groupId;
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, {
            groupId: groupId,
            groupName: groupNameMap.get(groupId) || '不明',
            totalDurationSeconds: 0,
            sessions: [],
          });
        }
        const group = groupMap.get(groupId);
        group.totalDurationSeconds += attendance.durationSeconds;
        group.sessions.push({
          date: session.date,
          durationSeconds: attendance.durationSeconds,
        });
      }

      // 各グループ内のセッションを日付降順でソート、グループ名の日本語ロケール順でソート
      const grouped = Array.from(groupMap.values());
      for (const group of grouped) {
        group.sessions.sort((a, b) => b.date.localeCompare(a.date));
        group.sessionCount = group.sessions.length;
      }
      grouped.sort((a, b) => a.groupName.localeCompare(b.groupName, 'ja'));

      setGroupAttendances(grouped);

      // グループが1つのみの場合はデフォルトで展開
      if (grouped.length === 1) {
        setExpandedGroups(new Set([grouped[0].groupId]));
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
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

      {/* メンバーヘッダーカード */}
      <div className="bg-surface rounded-xl border border-border-light p-6 flex items-center gap-6">
        <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center text-primary-700 font-bold text-xl">
          {member.name.charAt(0)}
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">{member.name}</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-text-secondary">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-text-muted" />
              合計 {formatDuration(member.totalDurationSeconds)}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-text-muted" />
              {member.sessionIds.length}回参加
            </span>
          </div>
        </div>
      </div>

      {/* グループ別サマリー＋アコーディオン */}
      <div className="space-y-4">
        {groupAttendances.map((group) => {
          const isExpanded = expandedGroups.has(group.groupId);
          return (
            <div key={group.groupId} className="bg-surface rounded-xl border border-border-light overflow-hidden">
              {/* サマリーカード */}
              <button
                onClick={() => toggleGroup(group.groupId)}
                className="w-full p-6 flex items-center justify-between text-left hover:bg-surface-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  {isExpanded
                    ? <ChevronDown className="w-5 h-5 text-text-muted" />
                    : <ChevronRight className="w-5 h-5 text-text-muted" />
                  }
                  <div>
                    <h3 className="text-base font-bold text-text-primary">{group.groupName}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-text-muted" />
                        {group.sessionCount}回参加
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-text-muted" />
                        {formatDuration(group.totalDurationSeconds)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              {/* 出席履歴テーブル（アコーディオン展開） */}
              {isExpanded && (
                <div className="border-t border-border-light">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-light bg-surface-muted text-left text-sm text-text-secondary">
                          <th className="px-6 py-3 font-medium">日付</th>
                          <th className="px-6 py-3 font-medium text-right">学習時間</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-light">
                        {group.sessions.map((session) => (
                          <tr key={session.date} className="text-sm">
                            <td className="px-6 py-3 text-text-primary">{session.date}</td>
                            <td className="px-6 py-3 text-text-primary text-right font-medium">
                              {formatDuration(session.durationSeconds)}
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
