import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DataFetcher } from '../services/data-fetcher.js';
import { formatDuration } from '../utils/format-duration.js';
import { getFiscalPeriod } from '../utils/fiscal-period.js';
import { ArrowLeft, Clock, Calendar, ChevronDown, ChevronRight, GraduationCap, Building2 } from 'lucide-react';

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
 * メンバー詳細画面 — 期別2カラムレイアウトでグループ別サマリーと出席履歴を表示
 */
export function MemberDetailPage() {
  const { memberId } = useParams();
  const [member, setMember] = useState(null);
  const [unifiedPeriods, setUnifiedPeriods] = useState([]);
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

      const { groups, members, organizers } = indexResult.data;
      const found = members.find((m) => m.id === memberId);
      if (!found) {
        setError('参加者が見つかりません');
        setLoading(false);
        return;
      }

      setMember(found);

      // 主催者名のルックアップマップ
      const organizerMap = new Map((organizers ?? []).map((o) => [o.id, o.name]));

      // sessionRef → グループ情報のマッピング
      const sessionGroupMap = new Map();
      for (const group of groups) {
        const organizerName = group.organizerId ? organizerMap.get(group.organizerId) ?? null : null;
        for (const ref of group.sessionRevisions) {
          sessionGroupMap.set(ref, { groupId: group.id, groupName: group.name, organizerName });
        }
      }

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

      // 第1段: 期別にグルーピング（出席 + 講師を統合）
      const periodMap = new Map();

      // 出席履歴を期別に集計
      for (let i = 0; i < sessionResults.length; i++) {
        const result = sessionResults[i];
        if (!result.ok) continue;
        const session = result.data;
        const ref = found.sessionRevisions[i];
        const attendance = session.attendances.find((a) => a.memberId === memberId);
        if (!attendance) continue;

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
            totalInstructorSessions: 0,
            sessions: [],
            instructorSessions: [],
          });
        }
        const periodEntry = periodMap.get(period.label);
        periodEntry.totalSessions += 1;
        periodEntry.totalDurationSeconds += attendance.durationSeconds;
        const resolvedGroup = sessionGroupMap.get(ref);
        if (!resolvedGroup) {
          setError(
            `データ不整合: セッション ${session.sessionId} の所属グループが index.json に見つかりません`
          );
          setLoading(false);
          return;
        }
        periodEntry.sessions.push({
          sessionId: session.sessionId,
          groupId: resolvedGroup.groupId,
          groupName: resolvedGroup.groupName,
          organizerName: resolvedGroup.organizerName,
          date,
          title: session.title,
          durationSeconds: attendance.durationSeconds,
        });
      }

      // 講師履歴を期別に集計（同じ periodMap にマージ）
      for (let i = 0; i < sessionResults.length; i++) {
        const result = sessionResults[i];
        if (!result.ok) continue;
        const session = result.data;
        const instructors = session.instructors || [];
        if (!instructors.includes(memberId)) continue;

        const ref = found.sessionRevisions[i];
        const resolvedGroup = sessionGroupMap.get(ref);
        if (!resolvedGroup) continue;

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
            totalInstructorSessions: 0,
            sessions: [],
            instructorSessions: [],
          });
        }
        const periodEntry = periodMap.get(period.label);
        periodEntry.totalInstructorSessions += 1;
        periodEntry.instructorSessions.push({
          sessionId: session.sessionId,
          groupId: resolvedGroup.groupId,
          groupName: resolvedGroup.groupName,
          organizerName: resolvedGroup.organizerName,
          date,
          title: session.title,
        });
      }

      // 第2段: 各期内でグループ別にグルーピング（出席・講師それぞれ）
      const periods = Array.from(periodMap.values());
      for (const period of periods) {
        // 出席グループ
        const groupMap = new Map();
        for (const session of period.sessions) {
          if (!groupMap.has(session.groupId)) {
            groupMap.set(session.groupId, {
              groupId: session.groupId,
              groupName: session.groupName,
              organizerName: session.organizerName,
              totalDurationSeconds: 0,
              sessions: [],
            });
          }
          const group = groupMap.get(session.groupId);
          group.totalDurationSeconds += session.durationSeconds;
          group.sessions.push({
            sessionId: session.sessionId,
            date: session.date,
            title: session.title,
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

        // 講師グループ
        const instructorGroupMap = new Map();
        for (const session of period.instructorSessions) {
          if (!instructorGroupMap.has(session.groupId)) {
            instructorGroupMap.set(session.groupId, {
              groupId: session.groupId,
              groupName: session.groupName,
              organizerName: session.organizerName,
              sessions: [],
            });
          }
          instructorGroupMap.get(session.groupId).sessions.push({
            sessionId: session.sessionId,
            date: session.date,
            title: session.title,
          });
        }
        const instructorGrouped = Array.from(instructorGroupMap.values());
        for (const group of instructorGrouped) {
          group.sessions.sort((a, b) => b.date.localeCompare(a.date));
          group.sessionCount = group.sessions.length;
        }
        instructorGrouped.sort((a, b) => a.groupName.localeCompare(b.groupName, 'ja'));
        period.groupInstructions = instructorGrouped;
      }

      // 期を降順ソート（最新が先頭）
      periods.sort((a, b) => b.sortKey - a.sortKey);

      setUnifiedPeriods(periods);

      // デフォルトで最新の期を選択
      if (periods.length > 0) {
        setSelectedPeriodLabel(periods[0].label);
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

  const selectedPeriod = unifiedPeriods.find((p) => p.label === selectedPeriodLabel);
  const totalInstructorSessions = unifiedPeriods.reduce((sum, p) => sum + p.totalInstructorSessions, 0);

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
      <div className="card-base rounded-t-none overflow-hidden animate-fade-in-up">
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
                <span className="font-display font-semibold text-text-primary">{member.sessionRevisions.length}</span>回参加
              </span>
              {totalInstructorSessions > 0 && (
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-text-muted" aria-hidden="true" />
                  講師 <span className="font-display font-semibold text-text-primary">{totalInstructorSessions}</span>回
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 期別2カラムレイアウト（出席履歴 + 講師履歴 統合） */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* 左列: 統合期サマリーリスト */}
        <div className="space-y-2">
          {unifiedPeriods.map((period) => {
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
                  {period.totalSessions > 0 && (
                    <>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                        <span className="font-display font-semibold">{period.totalSessions}</span>回
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                        <span className="font-display">{formatDuration(period.totalDurationSeconds)}</span>
                      </span>
                    </>
                  )}
                  {period.totalInstructorSessions > 0 && (
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                      講師 <span className="font-display font-semibold">{period.totalInstructorSessions}</span>回
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 右列: 選択した期の出席 + 講師グループ別アコーディオン */}
        <div className="space-y-4">
          {/* 出席履歴アコーディオン */}
          {selectedPeriod && selectedPeriod.groupAttendances.length > 0 && (
            <div className="space-y-4" data-section="attendance">
              {selectedPeriod.groupAttendances.map((group, index) => {
                const isExpanded = expandedGroups.has(group.groupId);
                return (
                  <div
                    key={group.groupId}
                    className="card-base overflow-hidden animate-fade-in-up"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <button
                      onClick={() => toggleGroup(group.groupId)}
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
                      {group.organizerName && (
                        <span className="flex items-center gap-1 text-sm text-text-muted shrink-0">
                          <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{group.organizerName}</span>
                        </span>
                      )}
                    </button>

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
                                    日付
                                  </th>
                                  <th scope="col" className="sr-only">
                                    参加時間
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border-light">
                                {group.sessions.map((session) => {
                                  const parts = formatSessionParts(session);
                                  return (
                                    <tr
                                      key={session.sessionId}
                                      className="text-sm hover:bg-surface-muted transition-colors"
                                    >
                                      <td className="px-6 py-3">
                                        <span className="text-text-primary">{parts.date}</span>
                                        {parts.title && (
                                          <span className="ml-2 text-text-secondary">{parts.title}</span>
                                        )}
                                      </td>
                                      <td className="px-6 py-3 text-text-primary text-right font-medium font-display tabular-nums">
                                        {formatDuration(session.durationSeconds)}
                                      </td>
                                    </tr>
                                  );
                                })}
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
          )}

          {/* 講師履歴アコーディオン */}
          {selectedPeriod && selectedPeriod.groupInstructions.length > 0 && (
            <div className="space-y-4" data-section="instructor">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary-500" aria-hidden="true" />
                講師履歴
              </h3>
              {selectedPeriod.groupInstructions.map((group, index) => {
                const isExpanded = expandedGroups.has(`instructor-${group.groupId}`);
                return (
                  <div
                    key={`instructor-${group.groupId}`}
                    className="card-base overflow-hidden animate-fade-in-up"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <button
                      onClick={() => toggleGroup(`instructor-${group.groupId}`)}
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
                          <h4 className="text-base font-bold text-text-primary">{group.groupName}</h4>
                          <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                            <span className="flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                              <span className="font-display font-semibold text-text-primary">{group.sessionCount}</span>回
                            </span>
                          </div>
                        </div>
                      </div>
                      {group.organizerName && (
                        <span className="flex items-center gap-1 text-sm text-text-muted shrink-0">
                          <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{group.organizerName}</span>
                        </span>
                      )}
                    </button>

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
                                    日付
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border-light">
                                {group.sessions.map((session) => {
                                  const parts = formatSessionParts(session);
                                  return (
                                    <tr
                                      key={session.sessionId}
                                      className="text-sm hover:bg-surface-muted transition-colors"
                                    >
                                      <td className="px-6 py-3">
                                        <span className="text-text-primary">{parts.date}</span>
                                        {parts.title && (
                                          <span className="ml-2 text-text-secondary">{parts.title}</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
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
          )}
        </div>
      </div>
    </div>
  );
}
