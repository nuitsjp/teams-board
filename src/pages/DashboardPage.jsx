import { useState, useEffect } from 'react';
import { DataFetcher } from '../services/data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';
import { SummaryCard } from '../components/SummaryCard';
import { GroupList } from '../components/GroupList';
import { MemberList } from '../components/MemberList';
import { Clock, Users, User, Loader2 } from 'lucide-react';

const fetcher = new DataFetcher();

/**
 * ダッシュボード画面 — グループ一覧とメンバー一覧を表示
 */
export function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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
    return (
      <div className="flex items-center justify-center py-20 text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        読み込み中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl mt-8 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
        データ取得エラー: {error}
      </div>
    );
  }

  const { groups, members } = data;

  const totalSessions = groups.reduce((acc, g) => acc + g.sessionIds.length, 0);
  const totalDuration = groups.reduce((acc, g) => acc + g.totalDurationSeconds, 0);

  return (
    <div className="space-y-8">
      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard
          title="総参加時間"
          value={formatDuration(totalDuration)}
          icon={Clock}
        />
        <SummaryCard
          title="総開催回数"
          value={`${totalSessions}回`}
          icon={Users}
        />
        <SummaryCard
          title="参加人数"
          value={`${members.length}人`}
          icon={User}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 左カラム: グループ */}
        <div className="lg:col-span-5">
          <GroupList groups={groups} />
        </div>

        {/* 右カラム: メンバー一覧 */}
        <div className="lg:col-span-7">
          <MemberList members={members} />
        </div>
      </div>
    </div>
  );
}
