import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DataFetcher } from '../services/data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';
import { ArrowLeft, Clock, Calendar, Loader2 } from 'lucide-react';

const fetcher = new DataFetcher();

/**
 * メンバー詳細画面 — セッション参加履歴を表示
 */
export function MemberDetailPage() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [attendanceList, setAttendanceList] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // DashboardIndex から該当メンバーのsessionIdsを取得
      const indexResult = await fetcher.fetchIndex();
      if (cancelled) return;
      if (!indexResult.ok) {
        setError(`データ取得エラー: ${indexResult.error}`);
        setLoading(false);
        return;
      }

      const { studyGroups, members } = indexResult.data;
      const found = members.find((m) => m.id === memberId);
      if (!found) {
        setError('参加者が見つかりません');
        setLoading(false);
        return;
      }

      setMember(found);

      // 勉強会名のルックアップマップ
      const groupNameMap = new Map(studyGroups.map((g) => [g.id, g.name]));

      // sessionIdsに対応するSessionRecordを並列取得
      const sessionResults = await Promise.all(
        found.sessionIds.map((sid) => fetcher.fetchSession(sid))
      );
      if (cancelled) return;

      // エラーチェック
      const failedSessions = sessionResults.filter((r) => !r.ok);
      if (failedSessions.length === sessionResults.length) {
        setError('セッションデータの取得に失敗しました');
        setLoading(false);
        return;
      }

      // 該当メンバーの出席記録を抽出して開催日降順でソート
      const list = [];
      for (const result of sessionResults) {
        if (!result.ok) continue;
        const session = result.data;
        const attendance = session.attendances.find((a) => a.memberId === memberId);
        if (attendance) {
          list.push({
            studyGroupName: groupNameMap.get(session.studyGroupId) || '不明',
            date: session.date,
            durationSeconds: attendance.durationSeconds,
          });
        }
      }
      list.sort((a, b) => b.date.localeCompare(a.date));
      setAttendanceList(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [memberId]);

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

      {/* 出席履歴テーブル */}
      <div className="bg-surface rounded-xl border border-border-light overflow-hidden">
        <div className="p-6 border-b border-border-light bg-surface-muted">
          <h3 className="text-lg font-bold text-text-primary">出席履歴</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-light bg-surface-muted text-left text-sm text-text-secondary">
                <th className="px-6 py-3 font-medium">日付</th>
                <th className="px-6 py-3 font-medium">勉強会</th>
                <th className="px-6 py-3 font-medium text-right">学習時間</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {attendanceList.map((item, i) => (
                <tr key={i} className="text-sm">
                  <td className="px-6 py-3 text-text-primary">{item.date}</td>
                  <td className="px-6 py-3 text-text-secondary">{item.studyGroupName}</td>
                  <td className="px-6 py-3 text-text-primary text-right font-medium">
                    {formatDuration(item.durationSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
