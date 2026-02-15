import { useState, useEffect } from 'react';
import { DataFetcher } from '../services/data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';
import { SummaryCard } from '../components/SummaryCard';
import { GroupList } from '../components/GroupList';
import { MemberList } from '../components/MemberList';
import { Clock, Users, User } from 'lucide-react';

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
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card-base p-6 flex items-center space-x-5">
              <div className="w-[52px] h-[52px] skeleton rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-20 skeleton" />
                <div className="h-7 w-28 skeleton" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <div className="card-base p-6 space-y-4">
              <div className="h-5 w-32 skeleton" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 skeleton" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="card-base p-6 space-y-4">
              <div className="h-5 w-32 skeleton" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 skeleton" />
              ))}
            </div>
          </div>
        </div>
        <span className="sr-only">読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl mt-8 card-base border-l-4 border-l-error p-4 text-red-700">
        データ取得エラー: {error}
      </div>
    );
  }

  const { groups, members } = data;

  const { totalSessions, totalDuration } = groups.reduce(
    (acc, g) => ({
      totalSessions: acc.totalSessions + g.sessionIds.length,
      totalDuration: acc.totalDuration + g.totalDurationSeconds,
    }),
    { totalSessions: 0, totalDuration: 0 }
  );

  return (
    <div className="space-y-10">
      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard title="総参加時間" value={formatDuration(totalDuration)} icon={Clock} style={{ animationDelay: '0ms' }} />
        <SummaryCard title="総開催回数" value={`${totalSessions}回`} icon={Users} style={{ animationDelay: '100ms' }} />
        <SummaryCard title="参加人数" value={`${members.length}人`} icon={User} style={{ animationDelay: '200ms' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 左カラム: グループ */}
        <div className="lg:col-span-5 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <GroupList groups={groups} />
        </div>

        {/* 右カラム: メンバー一覧 */}
        <div className="lg:col-span-7 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <MemberList members={members} />
        </div>
      </div>
    </div>
  );
}
