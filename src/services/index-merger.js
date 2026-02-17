// IndexMerger — DashboardIndex V2 のマージロジック（名前ベースマッチング）
import { ulid } from 'ulidx';
import { createSessionRef } from './session-ref.js';

export class IndexMerger {
    /**
     * 新セッション追加に伴い DashboardIndex の GroupSummary と MemberSummary を更新する
     * グループ・メンバーは名前ベースでマッチングし、不一致の場合は ULID を新規生成する
     *
     * @param {object} currentIndex - 現在の DashboardIndex（V2）
     * @param {object} parsedSession - CsvTransformer が出力した parsedSession
     * @returns {{ index: object, sessionRecord: object, warnings: string[] }}
     */
    merge(currentIndex, parsedSession) {
        const warnings = [];

        // グループの名前ベースマッチング
        const groups = currentIndex.groups.map((g) => ({
            ...g,
            sessionRevisions: [...g.sessionRevisions],
        }));
        let targetGroup = groups.find((g) => g.name === parsedSession.groupName);
        if (!targetGroup) {
            targetGroup = {
                id: ulid(),
                name: parsedSession.groupName,
                totalDurationSeconds: 0,
                sessionRevisions: [],
            };
            groups.push(targetGroup);
        }

        // sessionRef を作成（revision は常に 0）
        const sessionRef = createSessionRef(parsedSession.sessionId, 0);

        // グループにセッション追加
        const sessionTotalDuration = parsedSession.attendances.reduce(
            (sum, a) => sum + a.durationSeconds,
            0
        );
        targetGroup.totalDurationSeconds += sessionTotalDuration;
        targetGroup.sessionRevisions.push(sessionRef);

        // メンバーの名前ベースマッチングと sessionRecord の attendances 構築
        const members = currentIndex.members.map((m) => ({
            ...m,
            sessionRevisions: [...m.sessionRevisions],
        }));
        const sessionAttendances = [];

        for (const att of parsedSession.attendances) {
            let existingMember = members.find((m) => m.name === att.memberName);
            if (!existingMember) {
                existingMember = {
                    id: ulid(),
                    name: att.memberName,
                    totalDurationSeconds: 0,
                    sessionRevisions: [],
                };
                members.push(existingMember);
            }
            existingMember.totalDurationSeconds += att.durationSeconds;
            existingMember.sessionRevisions.push(sessionRef);

            sessionAttendances.push({
                memberId: existingMember.id,
                durationSeconds: att.durationSeconds,
            });
        }

        // version インクリメント
        const currentVersion = currentIndex.version ?? 0;

        const index = {
            schemaVersion: 2,
            version: currentVersion + 1,
            updatedAt: new Date().toISOString(),
            groups,
            members,
        };

        // sessionRecord を構築（resolved memberId 入り）
        const sessionRecord = {
            sessionId: parsedSession.sessionId,
            revision: 0,
            title: '',
            startedAt: parsedSession.startedAt,
            endedAt: parsedSession.endedAt,
            attendances: sessionAttendances,
            createdAt: new Date().toISOString(),
        };

        return { index, sessionRecord, warnings };
    }
}
