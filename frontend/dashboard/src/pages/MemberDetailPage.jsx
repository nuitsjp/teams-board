import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DataFetcher } from '../services/data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';

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
    return <div className="loading">読み込み中...</div>;
  }

  if (error) {
    return (
      <div>
        <div className="error">{error}</div>
        <a className="back-link" onClick={() => navigate('/')}>← 一覧へ戻る</a>
      </div>
    );
  }

  return (
    <div className="member-detail-view">
      <a className="back-link" onClick={() => navigate('/')}>← 一覧へ戻る</a>
      <h2>{member.name}</h2>
      <div className="member-summary">
        合計: {formatDuration(member.totalDurationSeconds)} / {member.sessionIds.length}回
      </div>
      <ul className="attendance-list">
        {attendanceList.map((item, i) => (
          <li key={i} className="attendance-item">
            {item.date} — {item.studyGroupName} — {formatDuration(item.durationSeconds)}
          </li>
        ))}
      </ul>
    </div>
  );
}
