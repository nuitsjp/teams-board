const EMPTY_TERM_DETAIL = Object.freeze({
    purpose: '',
    learningContent: '',
    learningOutcome: '',
    references: [],
});

function normalizeText(value) {
    return typeof value === 'string' ? value : '';
}

function normalizeReference(reference) {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)) {
        return { title: '', url: '' };
    }

    return {
        title: normalizeText(reference.title),
        url: normalizeText(reference.url),
    };
}

function fetchJsonWithCacheBuster(path) {
    const separator = path.includes('?') ? '&' : '?';
    return fetch(`${path}${separator}v=${Date.now()}`);
}

function cloneDetail(detail) {
    return {
        purpose: detail.purpose,
        learningContent: detail.learningContent,
        learningOutcome: detail.learningOutcome,
        references: detail.references.map((reference) => ({ ...reference })),
    };
}

export function createEmptyTermDetail() {
    return cloneDetail(EMPTY_TERM_DETAIL);
}

export function buildGroupTermDetailPath(groupId, termKey) {
    return `data/group-term-details/${groupId}/${termKey}.json`;
}

export function buildMemberGroupTermDetailPath(memberId, groupId, termKey) {
    return `data/member-group-term-details/${memberId}/${groupId}/${termKey}.json`;
}

export function normalizeTermDetail(detail) {
    if (!detail || typeof detail !== 'object' || Array.isArray(detail)) {
        return createEmptyTermDetail();
    }

    return {
        purpose: normalizeText(detail.purpose),
        learningContent: normalizeText(detail.learningContent),
        learningOutcome: normalizeText(detail.learningOutcome),
        references: Array.isArray(detail.references)
            ? detail.references.map(normalizeReference)
            : [],
    };
}

export function hasTermDetailContent(detail) {
    const normalized = normalizeTermDetail(detail);

    return (
        normalized.purpose.trim().length > 0 ||
        normalized.learningContent.trim().length > 0 ||
        normalized.learningOutcome.trim().length > 0 ||
        normalized.references.some(
            (reference) =>
                reference.title.trim().length > 0 || reference.url.trim().length > 0
        )
    );
}

export function validateTermDetail(detail) {
    const normalized = normalizeTermDetail(detail);

    for (const reference of normalized.references) {
        const hasTitle = reference.title.trim().length > 0;
        const hasUrl = reference.url.trim().length > 0;

        if (!hasTitle && !hasUrl) {
            continue;
        }

        if (!hasUrl) {
            return '参考資料リンクの URL を入力してください';
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(reference.url);
        } catch {
            return '参考資料リンクの URL は http または https で入力してください';
        }

        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return '参考資料リンクの URL は http または https で入力してください';
        }
    }

    return null;
}

export function serializeTermDetail(detail) {
    const normalized = normalizeTermDetail(detail);

    return {
        purpose: normalized.purpose.trim(),
        learningContent: normalized.learningContent.trim(),
        learningOutcome: normalized.learningOutcome.trim(),
        references: normalized.references
            .map((reference) => ({
                title: reference.title.trim(),
                url: reference.url.trim(),
            }))
            .filter(
                (reference) =>
                    reference.title.length > 0 || reference.url.length > 0
            ),
    };
}

async function fetchOptionalDetail(path) {
    try {
        const response = await fetchJsonWithCacheBuster(path);

        if (response.status === 404) {
            return { ok: true, data: null };
        }

        if (!response.ok) {
            return {
                ok: false,
                error: `HTTP ${response.status} ${response.statusText}`,
            };
        }

        const data = await response.json();
        return { ok: true, data: normalizeTermDetail(data) };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

export async function fetchGroupTermDetail(groupId, termKey) {
    return await fetchOptionalDetail(buildGroupTermDetailPath(groupId, termKey));
}

export async function fetchMemberGroupTermDetail(memberId, groupId, termKey) {
    return await fetchOptionalDetail(
        buildMemberGroupTermDetailPath(memberId, groupId, termKey)
    );
}

export async function saveGroupTermDetail(blobStorage, groupId, termKey, detail) {
    const payload = serializeTermDetail(detail);
    return await blobStorage.write(
        buildGroupTermDetailPath(groupId, termKey),
        JSON.stringify(payload, null, 2),
        'application/json'
    );
}

export async function saveMemberGroupTermDetail(
    blobStorage,
    memberId,
    groupId,
    termKey,
    detail
) {
    const payload = serializeTermDetail(detail);
    return await blobStorage.write(
        buildMemberGroupTermDetailPath(memberId, groupId, termKey),
        JSON.stringify(payload, null, 2),
        'application/json'
    );
}

export async function deleteMemberGroupTermDetail(
    blobStorage,
    memberId,
    groupId,
    termKey
) {
    return await blobStorage.delete(
        buildMemberGroupTermDetailPath(memberId, groupId, termKey)
    );
}
