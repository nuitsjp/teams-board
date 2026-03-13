import { getFiscalPeriod } from '../utils/fiscal-period.js';

function extractDate(startedAt) {
    if (!startedAt) {
        return '';
    }

    return startedAt.slice(0, 10);
}

function compareDateDesc(left, right) {
    return right.date.localeCompare(left.date);
}

function compareNameJa(left, right) {
    return left.groupName.localeCompare(right.groupName, 'ja');
}

function createPeriodEntry(period) {
    return {
        label: period.label,
        termKey: String(period.sortKey),
        sortKey: period.sortKey,
        fiscalYear: period.fiscalYear,
        half: period.half,
        totalDurationSeconds: 0,
        totalInstructorSessions: 0,
        groups: [],
        groupMap: new Map(),
    };
}

function createGroupEntry(groupMeta) {
    return {
        groupId: groupMeta.groupId,
        groupName: groupMeta.groupName,
        organizerName: groupMeta.organizerName,
        totalDurationSeconds: 0,
        attendanceSessionCount: 0,
        instructorSessionCount: 0,
        sessions: [],
        sessionMap: new Map(),
    };
}

function finalizePeriods(periods) {
    for (const period of periods) {
        period.groups = Array.from(period.groupMap.values())
            .map((group) => {
                group.sessions = Array.from(group.sessionMap.values()).sort(compareDateDesc);
                group.sessionCount = group.sessions.length;
                group.hasInstructorSession = group.instructorSessionCount > 0;
                delete group.sessionMap;
                return group;
            })
            .sort(compareNameJa);

        period.totalSessions = period.groups.reduce(
            (sum, group) => sum + group.sessionCount,
            0
        );
        delete period.groupMap;
    }

    periods.sort((left, right) => right.sortKey - left.sortKey);
    return periods;
}

export function findMemberTermGroup(periods, termKey, groupId) {
    const selectedPeriod = periods.find((period) => period.termKey === String(termKey));
    if (!selectedPeriod) {
        return null;
    }

    const selectedGroup = selectedPeriod.groups.find((group) => group.groupId === groupId);
    if (!selectedGroup) {
        return null;
    }

    return { selectedPeriod, selectedGroup };
}

export async function fetchMemberTermSummary(fetcher, memberId) {
    const indexResult = await fetcher.fetchIndex();
    if (!indexResult.ok) {
        return {
            ok: false,
            error: `データ取得エラー: ${indexResult.error}`,
        };
    }

    const { groups, members, organizers = [] } = indexResult.data;
    const member = members.find((candidate) => candidate.id === memberId);
    if (!member) {
        return { ok: false, error: '参加者が見つかりません' };
    }

    const organizerMap = new Map(organizers.map((organizer) => [organizer.id, organizer.name]));
    const memberSessionRefSet = new Set(member.sessionRevisions);

    const relatedGroups = groups.filter((group) =>
        group.sessionRevisions.some((sessionRef) => memberSessionRefSet.has(sessionRef))
    );

    const sessionRefs = [];
    const sessionGroupMap = new Map();
    for (const group of relatedGroups) {
        const organizerName = group.organizerId
            ? organizerMap.get(group.organizerId) ?? null
            : null;

        for (const sessionRef of group.sessionRevisions) {
            if (!sessionGroupMap.has(sessionRef)) {
                sessionRefs.push(sessionRef);
            }

            sessionGroupMap.set(sessionRef, {
                groupId: group.id,
                groupName: group.name,
                organizerName,
            });
        }
    }

    const sessionResults = await Promise.all(
        sessionRefs.map((sessionRef) => fetcher.fetchSession(sessionRef))
    );

    const failedSessions = sessionResults.filter((result) => !result.ok);
    if (failedSessions.length === sessionResults.length && sessionResults.length > 0) {
        return { ok: false, error: 'セッションデータの取得に失敗しました' };
    }

    const periodMap = new Map();
    for (let index = 0; index < sessionResults.length; index += 1) {
        const sessionResult = sessionResults[index];
        if (!sessionResult.ok) {
            continue;
        }

        const sessionRef = sessionRefs[index];
        const groupMeta = sessionGroupMap.get(sessionRef);
        if (!groupMeta) {
            continue;
        }

        const session = sessionResult.data;
        const attendance = session.attendances.find(
            (item) => item.memberId === memberId
        );
        const isInstructor = (session.instructors ?? []).includes(memberId);
        if (!attendance && !isInstructor) {
            continue;
        }

        const date = extractDate(session.startedAt);
        const periodInfo = getFiscalPeriod(date);
        if (!periodMap.has(periodInfo.sortKey)) {
            periodMap.set(periodInfo.sortKey, createPeriodEntry(periodInfo));
        }

        const periodEntry = periodMap.get(periodInfo.sortKey);
        if (!periodEntry.groupMap.has(groupMeta.groupId)) {
            periodEntry.groupMap.set(groupMeta.groupId, createGroupEntry(groupMeta));
        }

        const groupEntry = periodEntry.groupMap.get(groupMeta.groupId);
        if (!groupEntry.sessionMap.has(session.sessionId)) {
            groupEntry.sessionMap.set(session.sessionId, {
                sessionId: session.sessionId,
                date,
                title: session.title ?? '',
                durationSeconds: 0,
                isInstructor: false,
            });
        }

        const sessionEntry = groupEntry.sessionMap.get(session.sessionId);
        if (attendance) {
            sessionEntry.durationSeconds += attendance.durationSeconds;
            if (!sessionEntry.hasAttendance) {
                sessionEntry.hasAttendance = true;
                groupEntry.attendanceSessionCount += 1;
            }
            groupEntry.totalDurationSeconds += attendance.durationSeconds;
            periodEntry.totalDurationSeconds += attendance.durationSeconds;
        }

        if (isInstructor && !sessionEntry.isInstructor) {
            sessionEntry.isInstructor = true;
            groupEntry.instructorSessionCount += 1;
            periodEntry.totalInstructorSessions += 1;
        }
    }

    const periods = finalizePeriods(Array.from(periodMap.values()));
    const totalInstructorSessions = periods.reduce(
        (sum, period) => sum + period.totalInstructorSessions,
        0
    );

    return {
        ok: true,
        data: {
            member,
            periods,
            totalInstructorSessions,
        },
    };
}
