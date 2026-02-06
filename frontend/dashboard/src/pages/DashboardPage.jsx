import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataFetcher } from '../services/data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';

const fetcher = new DataFetcher();

/**
 * ダッシュボード画面 — 勉強会グループ一覧とメンバー一覧を表示
 */
export function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetcher.fetchIndex();
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
      } else {
        setData(result.data);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="loading">読み込み中...</div>;
  }

  if (error) {
    return <div className="error">データ取得エラー: {error}</div>;
  }

  const { studyGroups, members } = data;
  const sortedMembers = [...members].sort(
    (a, b) => b.totalDurationSeconds - a.totalDurationSeconds
  );

  return (
    <div>
      {/* 勉強会グループ一覧 */}
      <section className="study-groups-section">
        <h2>勉強会グループ</h2>
        {studyGroups.map((group) => (
          <div key={group.id} className="study-group-card">
            <h3>{group.name}</h3>
            <div className="study-group-info">
              {group.sessionIds.length}回 / {formatDuration(group.totalDurationSeconds)}
            </div>
          </div>
        ))}
      </section>

      {/* 参加者一覧（合計時間の降順） */}
      <section className="members-section">
        <h2>参加者</h2>
        {sortedMembers.map((member) => (
          <div
            key={member.id}
            className="member-card"
            data-member-id={member.id}
            onClick={() => navigate(`/members/${member.id}`)}
          >
            <h3>{member.name}</h3>
            <div className="member-info">
              {formatDuration(member.totalDurationSeconds)} / {member.sessionIds.length}回
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
