// IndexEditor — DashboardIndex V2 の編集ロジック
import { ulid } from 'ulidx';
import { parseSessionRef, createSessionRef, sessionRefToPath } from './session-ref.js';

/**
 * organizers 配列のイミュータブルコピーを返すヘルパー
 */
function copyOrganizers(currentIndex) {
    return (currentIndex.organizers ?? []).map((o) => ({ ...o }));
}

export class IndexEditor {
    /**
     * グループ名を更新する
     * @param {object} currentIndex - 現在の DashboardIndex（V2）
     * @param {string} groupId - 対象グループの ID
     * @param {string} newName - 新しいグループ名
     * @returns {{ index: object, error?: string }}
     */
    updateGroupName(currentIndex, groupId, newName) {
        // バリデーション
        const validationError = this.validateGroupName(newName);
        if (validationError) {
            return { index: currentIndex, error: validationError };
        }

        // グループを検索
        const groupMap = new Map();
        const groups = currentIndex.groups.map((g) => {
            const copy = { ...g, sessionRevisions: [...g.sessionRevisions] };
            groupMap.set(copy.id, copy);
            return copy;
        });
        const targetGroup = groupMap.get(groupId);

        if (!targetGroup) {
            return { index: currentIndex, error: `グループID ${groupId} が見つかりません` };
        }

        // グループ名を更新
        targetGroup.name = newName;

        const currentVersion = currentIndex.version ?? 0;

        return {
            index: {
                schemaVersion: 2,
                version: currentVersion + 1,
                updatedAt: new Date().toISOString(),
                organizers: copyOrganizers(currentIndex),
                groups,
                members: currentIndex.members.map((m) => ({
                    ...m,
                    sessionRevisions: [...m.sessionRevisions],
                })),
            },
        };
    }

    /**
     * 複数グループを1つに統合する
     * @param {object} currentIndex - 現在の DashboardIndex（V2）
     * @param {string} targetGroupId - 統合先グループ ID
     * @param {string[]} selectedGroupIds - 選択されたグループ ID 一覧（統合先を含む）
     * @returns {{ index: object, error?: string }}
     */
    mergeGroups(currentIndex, targetGroupId, selectedGroupIds) {
        const validationError = this.validateMergeGroupsInput(targetGroupId, selectedGroupIds);
        if (validationError) {
            return { index: currentIndex, error: validationError };
        }

        const groupMap = new Map();
        const groups = currentIndex.groups.map((g) => {
            const copy = { ...g, sessionRevisions: [...g.sessionRevisions] };
            groupMap.set(copy.id, copy);
            return copy;
        });

        for (const groupId of selectedGroupIds) {
            if (!groupMap.has(groupId)) {
                return {
                    index: currentIndex,
                    error: `グループID ${groupId} が見つかりません`,
                };
            }
        }

        const targetGroup = groupMap.get(targetGroupId);
        const sourceGroups = selectedGroupIds
            .filter((groupId) => groupId !== targetGroupId)
            .map((groupId) => groupMap.get(groupId));

        const orderedGroups = [targetGroup, ...sourceGroups];
        const allSessionRevisions = orderedGroups.flatMap(
            (group) => group.sessionRevisions
        );
        const mergedSessionRevisions = [...new Set(allSessionRevisions)];

        const sessionDurationMap = new Map();
        for (const group of orderedGroups) {
            const groupSessionCount = group.sessionRevisions.length;
            if (groupSessionCount === 0) {
                continue;
            }
            const durationPerSession = group.totalDurationSeconds / groupSessionCount;
            for (const ref of group.sessionRevisions) {
                if (!sessionDurationMap.has(ref)) {
                    sessionDurationMap.set(ref, durationPerSession);
                }
            }
        }

        const mergedDuration = mergedSessionRevisions.reduce(
            (sum, ref) => sum + (sessionDurationMap.get(ref) ?? 0),
            0
        );
        targetGroup.sessionRevisions = mergedSessionRevisions;
        targetGroup.totalDurationSeconds = Math.round(mergedDuration);
        // 統合先グループの organizerId を保持（統合元は破棄）

        const sourceGroupIdSet = new Set(sourceGroups.map((group) => group.id));
        const filteredGroups = groups.filter((group) => !sourceGroupIdSet.has(group.id));

        const currentVersion = currentIndex.version ?? 0;

        return {
            index: {
                schemaVersion: 2,
                version: currentVersion + 1,
                updatedAt: new Date().toISOString(),
                organizers: copyOrganizers(currentIndex),
                groups: filteredGroups,
                members: currentIndex.members.map((m) => ({
                    ...m,
                    sessionRevisions: [...m.sessionRevisions],
                })),
            },
        };
    }

    /**
     * グループ名をバリデーションする
     * @param {string} name - 検証するグループ名
     * @returns {string|null} エラーメッセージ、または null（バリデーション成功）
     */
    validateGroupName(name) {
        if (typeof name !== 'string') {
            return 'グループ名は文字列である必要があります';
        }

        if (name.length === 0 || name.trim().length === 0) {
            return 'グループ名を入力してください';
        }

        if (name.length > 256) {
            return 'グループ名は256文字以内で入力してください';
        }

        return null;
    }

    /**
     * グループからセッションを削除する（紐付け解除）
     * @param {object} currentIndex - 現在の DashboardIndex（V2）
     * @param {string} groupId - 対象グループの ID
     * @param {string} sessionRef - 削除するセッションの ref（例: "sessionId/revision"）
     * @param {object} sessionData - セッション JSON データ（attendances を含む）
     * @returns {{ index: object, error?: string }}
     */
    removeSessionFromGroup(currentIndex, groupId, sessionRef, sessionData) {
        // バリデーション
        if (!groupId || typeof groupId !== 'string') {
            return { index: currentIndex, error: 'グループIDが指定されていません' };
        }
        if (!sessionRef || typeof sessionRef !== 'string') {
            return { index: currentIndex, error: 'セッションRefが指定されていません' };
        }
        if (!sessionData || !Array.isArray(sessionData.attendances)) {
            return {
                index: currentIndex,
                error: 'セッションデータが不正です（attendances が必要です）',
            };
        }

        // グループ検索
        const groups = currentIndex.groups.map((g) => ({
            ...g,
            sessionRevisions: [...g.sessionRevisions],
        }));
        const targetGroup = groups.find((g) => g.id === groupId);
        if (!targetGroup) {
            return { index: currentIndex, error: `グループID ${groupId} が見つかりません` };
        }

        // セッション所属確認
        if (!targetGroup.sessionRevisions.includes(sessionRef)) {
            return {
                index: currentIndex,
                error: `セッション ${sessionRef} はこのグループに属していません`,
            };
        }

        // グループ更新: sessionRevisions から除去、totalDurationSeconds を再計算
        const groupSessionDuration = sessionData.attendances.reduce(
            (sum, a) => sum + a.durationSeconds,
            0
        );
        targetGroup.sessionRevisions = targetGroup.sessionRevisions.filter(
            (ref) => ref !== sessionRef
        );
        targetGroup.totalDurationSeconds = Math.max(
            0,
            targetGroup.totalDurationSeconds - groupSessionDuration
        );

        // メンバー更新（同一 memberId が複数回出現する場合に備えて合算）
        const memberDurationMap = new Map();
        for (const a of sessionData.attendances) {
            memberDurationMap.set(a.memberId, (memberDurationMap.get(a.memberId) ?? 0) + a.durationSeconds);
        }
        // 講師セット（セッション削除時に instructorCount を減算するため）
        const instructorSet = new Set(sessionData.instructors ?? []);
        const members = currentIndex.members.map((m) => {
            const isInstructor = instructorSet.has(m.id);
            if (!m.sessionRevisions.includes(sessionRef) && !isInstructor) {
                return { ...m, sessionRevisions: [...m.sessionRevisions] };
            }
            const duration = memberDurationMap.get(m.id) ?? 0;
            const updatedMember = {
                ...m,
                sessionRevisions: m.sessionRevisions.includes(sessionRef)
                    ? m.sessionRevisions.filter((ref) => ref !== sessionRef)
                    : [...m.sessionRevisions],
                totalDurationSeconds: m.sessionRevisions.includes(sessionRef)
                    ? Math.max(0, m.totalDurationSeconds - duration)
                    : m.totalDurationSeconds,
            };
            if (isInstructor) {
                updatedMember.instructorCount = Math.max(0, (m.instructorCount ?? 0) - 1);
            }
            return updatedMember;
        });

        const currentVersion = currentIndex.version ?? 0;

        return {
            index: {
                schemaVersion: 2,
                version: currentVersion + 1,
                updatedAt: new Date().toISOString(),
                organizers: copyOrganizers(currentIndex),
                groups,
                members,
            },
        };
    }

    /**
     * グループ統合入力をバリデーションする
     * @param {string} targetGroupId - 統合先グループ ID
     * @param {string[]} selectedGroupIds - 選択されたグループ ID 一覧
     * @returns {string|null}
     */
    validateMergeGroupsInput(targetGroupId, selectedGroupIds) {
        if (!Array.isArray(selectedGroupIds)) {
            return '選択グループIDは配列である必要があります';
        }

        if (selectedGroupIds.length < 2) {
            return 'グループ統合には2つ以上のグループ選択が必要です';
        }

        if (!selectedGroupIds.includes(targetGroupId)) {
            return '統合先グループは選択されたグループに含まれている必要があります';
        }

        return null;
    }

    /**
     * セッションの新リビジョンを作成する
     * @param {string} sessionRef - 現在のセッション ref（例: "sessionId/revision"）
     * @param {object} sessionData - 現在のセッションデータ
     * @param {object} updates - 更新フィールド
     * @param {string} [updates.title] - 新しいタイトル
     * @param {string[]} [updates.instructors] - 講師 ID（ULID）の配列
     * @returns {{ sessionRecord: object, newRef: string, newPath: string, error?: string }}
     */
    createSessionRevision(sessionRef, sessionData, updates = {}) {
        // instructors バリデーション
        if (updates.instructors !== undefined) {
            if (!Array.isArray(updates.instructors)) {
                return { sessionRecord: null, newRef: null, newPath: null, error: '講師は配列である必要があります' };
            }
            for (const id of updates.instructors) {
                if (typeof id !== 'string') {
                    return { sessionRecord: null, newRef: null, newPath: null, error: '講師IDは文字列である必要があります' };
                }
            }
        }

        // 新リビジョンを構築
        const { revision } = parseSessionRef(sessionRef);
        const newRevision = revision + 1;
        const newRef = createSessionRef(sessionData.sessionId, newRevision);
        const newPath = sessionRefToPath(newRef);

        const sessionRecord = {
            sessionId: sessionData.sessionId,
            revision: newRevision,
            startedAt: sessionData.startedAt,
            endedAt: sessionData.endedAt,
            attendances: sessionData.attendances,
            instructors: sessionData.instructors ?? [],
            createdAt: sessionData.createdAt,
        };

        // updates の適用
        if (updates.title !== undefined) {
            if (updates.title.length > 0) {
                sessionRecord.title = updates.title;
            }
        } else if (sessionData.title) {
            sessionRecord.title = sessionData.title;
        }

        if (updates.instructors !== undefined) {
            sessionRecord.instructors = updates.instructors;
        }

        return { sessionRecord, newRef, newPath };
    }

    /**
     * 新規メンバーを追加する（講師の手入力用）
     * @param {object} currentIndex - 現在の DashboardIndex（V2）
     * @param {string} name - メンバー名
     * @returns {{ index: object, memberId: string, error?: string }}
     */
    addMember(currentIndex, name) {
        // バリデーション
        if (typeof name !== 'string') {
            return { index: currentIndex, memberId: null, error: 'メンバー名は文字列である必要があります' };
        }
        if (name.length === 0 || name.trim().length === 0) {
            return { index: currentIndex, memberId: null, error: 'メンバー名を入力してください' };
        }
        if (name.length > 256) {
            return { index: currentIndex, memberId: null, error: 'メンバー名は256文字以内で入力してください' };
        }

        const memberId = ulid();
        const currentVersion = currentIndex.version ?? 0;

        const index = {
            schemaVersion: 2,
            version: currentVersion + 1,
            updatedAt: new Date().toISOString(),
            organizers: copyOrganizers(currentIndex),
            groups: currentIndex.groups.map((g) => ({
                ...g,
                sessionRevisions: [...g.sessionRevisions],
            })),
            members: [
                ...currentIndex.members.map((m) => ({
                    ...m,
                    sessionRevisions: [...m.sessionRevisions],
                })),
                {
                    id: memberId,
                    name,
                    totalDurationSeconds: 0,
                    instructorCount: 0,
                    sessionRevisions: [],
                },
            ],
        };

        return { index, memberId };
    }

    /**
     * 新規主催者を追加する
     * @param {object} currentIndex - 現在の DashboardIndex（V2）
     * @param {string} name - 主催者名
     * @returns {{ index: object, organizerId: string, error?: string }}
     */
    addOrganizer(currentIndex, name) {
        // バリデーション
        if (typeof name !== 'string') {
            return { index: currentIndex, organizerId: null, error: '主催者名は文字列である必要があります' };
        }
        if (name.length === 0 || name.trim().length === 0) {
            return { index: currentIndex, organizerId: null, error: '主催者名を入力してください' };
        }
        if (name.length > 256) {
            return { index: currentIndex, organizerId: null, error: '主催者名は256文字以内で入力してください' };
        }

        const organizerId = ulid();
        const currentVersion = currentIndex.version ?? 0;

        const index = {
            schemaVersion: 2,
            version: currentVersion + 1,
            updatedAt: new Date().toISOString(),
            organizers: [
                ...copyOrganizers(currentIndex),
                { id: organizerId, name },
            ],
            groups: currentIndex.groups.map((g) => ({
                ...g,
                sessionRevisions: [...g.sessionRevisions],
            })),
            members: currentIndex.members.map((m) => ({
                ...m,
                sessionRevisions: [...m.sessionRevisions],
            })),
        };

        return { index, organizerId };
    }

    /**
     * グループの主催者を設定/解除する
     * @param {object} currentIndex - 現在の DashboardIndex（V2）
     * @param {string} groupId - 対象グループの ID
     * @param {string|null} organizerId - 主催者 ID（null で解除）
     * @returns {{ index: object, error?: string }}
     */
    updateGroupOrganizer(currentIndex, groupId, organizerId) {
        // バリデーション
        if (!groupId || typeof groupId !== 'string') {
            return { index: currentIndex, error: 'グループIDが指定されていません' };
        }
        if (organizerId !== null && typeof organizerId !== 'string') {
            return { index: currentIndex, error: '主催者IDは文字列またはnullである必要があります' };
        }

        // 主催者の存在確認（null 以外の場合）
        const organizers = copyOrganizers(currentIndex);
        if (organizerId !== null) {
            const organizerExists = organizers.some((o) => o.id === organizerId);
            if (!organizerExists) {
                return { index: currentIndex, error: `主催者ID ${organizerId} が見つかりません` };
            }
        }

        // グループ検索
        const groupMap = new Map();
        const groups = currentIndex.groups.map((g) => {
            const copy = { ...g, sessionRevisions: [...g.sessionRevisions] };
            groupMap.set(copy.id, copy);
            return copy;
        });
        const targetGroup = groupMap.get(groupId);

        if (!targetGroup) {
            return { index: currentIndex, error: `グループID ${groupId} が見つかりません` };
        }

        // 主催者を設定
        targetGroup.organizerId = organizerId;

        const currentVersion = currentIndex.version ?? 0;

        return {
            index: {
                schemaVersion: 2,
                version: currentVersion + 1,
                updatedAt: new Date().toISOString(),
                organizers,
                groups,
                members: currentIndex.members.map((m) => ({
                    ...m,
                    sessionRevisions: [...m.sessionRevisions],
                })),
            },
        };
    }

    /**
     * 主催者を削除する（参照しているグループの organizerId を null にリセット）
     * @param {object} currentIndex - 現在の DashboardIndex（V2）
     * @param {string} organizerId - 削除する主催者の ID
     * @returns {{ index: object, error?: string }}
     */
    removeOrganizer(currentIndex, organizerId) {
        // バリデーション
        if (!organizerId || typeof organizerId !== 'string') {
            return { index: currentIndex, error: '主催者IDが指定されていません' };
        }

        const organizers = copyOrganizers(currentIndex);
        const organizerIndex = organizers.findIndex((o) => o.id === organizerId);
        if (organizerIndex === -1) {
            return { index: currentIndex, error: `主催者ID ${organizerId} が見つかりません` };
        }

        // 主催者を配列から除去
        organizers.splice(organizerIndex, 1);

        // 参照しているグループの organizerId を null にリセット
        const groups = currentIndex.groups.map((g) => {
            const copy = { ...g, sessionRevisions: [...g.sessionRevisions] };
            if (copy.organizerId === organizerId) {
                copy.organizerId = null;
            }
            return copy;
        });

        const currentVersion = currentIndex.version ?? 0;

        return {
            index: {
                schemaVersion: 2,
                version: currentVersion + 1,
                updatedAt: new Date().toISOString(),
                organizers,
                groups,
                members: currentIndex.members.map((m) => ({
                    ...m,
                    sessionRevisions: [...m.sessionRevisions],
                })),
            },
        };
    }
}
