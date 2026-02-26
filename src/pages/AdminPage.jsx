import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth, createAuthAdapter } from '../hooks/useAuth.jsx';
import { useFileQueue } from '../hooks/useFileQueue.js';
import { FileDropZone } from '../components/FileDropZone.jsx';
import { FileQueueCardList } from '../components/FileQueueCardList.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { CsvTransformer } from '../services/csv-transformer.js';
import { BlobWriter } from '../services/blob-writer.js';
import { ProductionIndexFetcher, DevIndexFetcher } from '../services/index-fetcher.js';
import { AzureBlobStorage, DevBlobStorage } from '../services/blob-storage.js';
import { IndexMerger } from '../services/index-merger.js';
import { IndexEditor } from '../services/index-editor.js';
import { sharedDataFetcher } from '../services/shared-data-fetcher.js';
import { APP_CONFIG } from '../config/app-config.js';
import { createSessionRef, sessionRefToPath } from '../services/session-ref.js';
import {
  ArrowLeft,
  Upload,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  GitMerge,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { GroupNameEditor } from '../components/GroupNameEditor.jsx';
import { SessionEditorPanel } from '../components/SessionEditorPanel.jsx';

const MAX_SESSION_NAME_LENGTH = 256;

/**
 * 管理者パネル — CSVインポート・プレビュー・一括保存機能
 */
export function AdminPage() {
  const auth = useAuth();
  const authAdapter = useMemo(() => createAuthAdapter(auth), [auth]);

  const csvTransformer = useMemo(() => new CsvTransformer(), []);

  // 環境に応じてIndexFetcherとBlobStorageを注入
  const indexFetcher = useMemo(() => {
    if (import.meta.env.DEV && authAdapter.getSasToken() === 'dev') {
      return new DevIndexFetcher();
    }
    return new ProductionIndexFetcher(APP_CONFIG.blobBaseUrl, authAdapter);
  }, [authAdapter]);

  const blobStorage = useMemo(() => {
    if (import.meta.env.DEV && authAdapter.getSasToken() === 'dev') {
      return new DevBlobStorage();
    }
    return new AzureBlobStorage(APP_CONFIG.blobBaseUrl, authAdapter);
  }, [authAdapter]);

  const blobWriter = useMemo(
    () => new BlobWriter(indexFetcher, blobStorage),
    [indexFetcher, blobStorage]
  );

  const indexMerger = useMemo(() => new IndexMerger(), []);
  const indexEditor = useMemo(() => new IndexEditor(), []);
  const dataFetcher = sharedDataFetcher;

  const {
    queue,
    addFiles,
    removeFile,
    selectGroup,
    updateStatus,
    readyItems,
    failedItems,
  } = useFileQueue(csvTransformer);

  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [saveStatusText, setSaveStatusText] = useState('');

  // グループ管理機能用の状態
  const [groups, setGroups] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionNameInputs, setSessionNameInputs] = useState({});
  const [instructorInputs, setInstructorInputs] = useState({});
  const [savingGroupId, setSavingGroupId] = useState(null);
  const [groupMessage, setGroupMessage] = useState({ type: '', text: '' });
  const [sessionMessage, setSessionMessage] = useState({ type: '', text: '' });
  const [savingSessionId, setSavingSessionId] = useState(null);
  const [cachedIndex, setCachedIndex] = useState(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeTargetGroupId, setMergeTargetGroupId] = useState(null);
  const [merging, setMerging] = useState(false);
  const [expandedGroupIds, setExpandedGroupIds] = useState(new Set());
  const [selectedSessionRef, setSelectedSessionRef] = useState(null);

  // 既存セッションの取得とグループ一覧の取得（V2: sessionRevisions ベース）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const indexResult = await dataFetcher.fetchIndex();
      if (cancelled) return;
      if (indexResult.ok) {
        setGroups(indexResult.data.groups);
        setCachedIndex(indexResult.data);

        const sessionRefs = indexResult.data.groups.flatMap((g) => g.sessionRevisions);
        const uniqueRefs = [...new Set(sessionRefs)];

        const sessionResults = await Promise.all(
          uniqueRefs.map(async (ref) => ({
            ref,
            result: await dataFetcher.fetchSession(ref),
          }))
        );
        if (cancelled) return;
        const loadedSessions = sessionResults
          .filter(({ result }) => result.ok)
          .map(({ ref, result }) => ({
            ...result.data,
            _ref: ref,
          }))
          .sort((a, b) => {
            const dateA = a.startedAt?.slice(0, 10) ?? '';
            const dateB = b.startedAt?.slice(0, 10) ?? '';
            return dateB.localeCompare(dateA);
          });
        setSessions(loadedSessions);
        setSessionNameInputs(
          Object.fromEntries(
            loadedSessions.map((session) => [session._ref, session.title || ''])
          )
        );
        setInstructorInputs(
          Object.fromEntries(
            loadedSessions.map((session) => [session._ref, session.instructors ?? []])
          )
        );

      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataFetcher]);

  useEffect(() => {
    setSelectedGroupIds((prev) => {
      const existingIdSet = new Set(groups.map((group) => group.id));
      const next = new Set([...prev].filter((id) => existingIdSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [groups]);

  // 一括保存処理（V2: parsedSession → indexMerger.merge → sessionRecord）
  const handleBulkSave = useCallback(async () => {
    const itemsToSave = queue.filter((item) => item.status === 'ready');
    if (itemsToSave.length === 0) return;

    setSaving(true);
    setSaveProgress({ current: 0, total: itemsToSave.length });
    setSaveStatusText(`保存中\u2026 0/${itemsToSave.length} 件`);

    // 1. 最新 index.json を取得
    const indexResult = await indexFetcher.fetch();
    if (!indexResult.ok) {
      for (const item of itemsToSave) {
        updateStatus(item.id, 'save_failed', {
          errors: ['index.json の取得に失敗しました'],
        });
      }
      setSaving(false);
      setSaveStatusText('');
      return;
    }

    const baseVersion = indexResult.data.version ?? 0;
    let currentIndex = indexResult.data;

    // 2. 各 parsedSession を順にマージし sessionRecord を構築
    const preparedItems = [];
    for (const item of itemsToSave) {
      let { parsedSession } = item.parseResult;

      // グループ上書きがある場合は groupName を上書き
      if (item.groupOverride) {
        parsedSession = { ...parsedSession, groupName: item.groupOverride.groupName };
      }

      const { index: updatedIndex, sessionRecord } = indexMerger.merge(
        currentIndex,
        parsedSession
      );
      currentIndex = updatedIndex;

      const ref = createSessionRef(sessionRecord.sessionId, sessionRecord.revision);

      preparedItems.push({
        itemId: item.id,
        sourcePath: `data/sources/${sessionRecord.sessionId}.csv`,
        sessionPath: sessionRefToPath(ref),
        sourceFile: item.file,
        sessionRecord,
      });
    }

    for (const prepared of preparedItems) {
      updateStatus(prepared.itemId, 'saving');
    }

    const mergedIndex = currentIndex;
    const sessionPathSet = new Set(preparedItems.map((p) => p.sessionPath));
    let completedSessions = 0;

    const result = await blobWriter.executeWriteSequence({
      newItems: preparedItems.flatMap((prepared) => [
        {
          path: prepared.sourcePath,
          content: prepared.sourceFile,
          contentType: 'text/csv',
        },
        {
          path: prepared.sessionPath,
          content: JSON.stringify(prepared.sessionRecord, null, 2),
          contentType: 'application/json',
        },
      ]),
      indexUpdater: (latestIndex) => {
        // 楽観ロック: baseVersion と比較
        if ((latestIndex.version ?? 0) !== baseVersion) {
          return null;
        }
        return mergedIndex;
      },
      onItemComplete: (writeResult) => {
        if (!sessionPathSet.has(writeResult.path)) return;
        completedSessions += 1;
        setSaveProgress({ current: completedSessions, total: itemsToSave.length });
        setSaveStatusText(`保存中\u2026 ${completedSessions}/${itemsToSave.length} 件`);
      },
    });

    const resultByPath = new Map(
      result.results.map((writeResult) => [writeResult.path, writeResult])
    );
    const indexWriteResult = resultByPath.get('data/index.json');
    if (indexWriteResult?.success) {
      dataFetcher.invalidateIndexCache();
    }

    for (const prepared of preparedItems) {
      const sourceWriteResult = resultByPath.get(prepared.sourcePath);
      const sessionWriteResult = resultByPath.get(prepared.sessionPath);
      const sourceSucceeded = sourceWriteResult?.success ?? result.allSucceeded;
      const sessionSucceeded = sessionWriteResult?.success ?? result.allSucceeded;
      const errors = [];

      if (!sourceSucceeded) {
        errors.push(sourceWriteResult?.error || 'CSVソース保存に失敗しました');
      }
      if (!sessionSucceeded) {
        errors.push(sessionWriteResult?.error || 'セッションJSON保存に失敗しました');
      }
      if (errors.length === 0 && indexWriteResult && !indexWriteResult.success) {
        errors.push(indexWriteResult.error || 'index.json の保存に失敗しました');
      }

      if (errors.length === 0) {
        updateStatus(prepared.itemId, 'saved');
      } else {
        updateStatus(prepared.itemId, 'save_failed', { errors });
      }
    }

    setSaveProgress({ current: itemsToSave.length, total: itemsToSave.length });
    setSaving(false);
    setSaveStatusText('');
  }, [queue, updateStatus, blobWriter, indexMerger, indexFetcher, dataFetcher]);

  // リトライ処理
  const handleRetry = useCallback(async () => {
    const failed = queue.filter((item) => item.status === 'save_failed');
    for (const item of failed) {
      updateStatus(item.id, 'ready');
    }
  }, [queue, updateStatus]);

  // グループ名保存処理（V2: version ベース楽観ロック）
  const handleSaveGroupName = useCallback(
    async (groupId, newName) => {
      setSavingGroupId(groupId);
      setGroupMessage({ type: '', text: '' });

      try {
        // 楽観的ロック: 最新のindex.jsonを取得
        const latestIndexResult = await dataFetcher.fetchIndex();
        if (!latestIndexResult.ok) {
          setGroupMessage({
            type: 'error',
            text: '最新データの取得に失敗しました。ネットワーク接続を確認してください',
          });
          setSavingGroupId(null);
          return false;
        }

        // version を比較（楽観ロック）
        if (
          cachedIndex &&
          (latestIndexResult.data.version ?? 0) !== (cachedIndex.version ?? 0)
        ) {
          setGroupMessage({
            type: 'error',
            text: '他のユーザーが同時に編集しています。最新データを再読み込みしてください',
          });
          setSavingGroupId(null);
          return false;
        }

        // IndexEditorでindex.jsonを更新
        const { index: updatedIndex, error } = indexEditor.updateGroupName(
          latestIndexResult.data,
          groupId,
          newName
        );

        if (error) {
          setGroupMessage({ type: 'error', text: error });
          setSavingGroupId(null);
          return false;
        }

        // BlobWriterで保存
        const result = await blobWriter.executeWriteSequence({
          rawCsv: null,
          newItems: [],
          indexUpdater: () => updatedIndex,
        });

        if (!result.allSucceeded) {
          const errorMessages = result.results
            .filter((r) => !r.success)
            .map((r) => r.error)
            .join(', ');
          setGroupMessage({
            type: 'error',
            text: `保存に失敗しました。${errorMessages}`,
          });
          setSavingGroupId(null);
          return false;
        }

        // 保存成功後、最新index.jsonを再取得
        dataFetcher.invalidateIndexCache();
        const refreshedIndexResult = await dataFetcher.fetchIndex();
        if (refreshedIndexResult.ok) {
          setGroups(refreshedIndexResult.data.groups);
          setCachedIndex(refreshedIndexResult.data);
        }

        setGroupMessage({ type: 'success', text: 'グループ名を保存しました' });
        setSavingGroupId(null);
        return true;
      } catch (err) {
        setGroupMessage({
          type: 'error',
          text: `保存に失敗しました。${err.message}`,
        });
        setSavingGroupId(null);
        return false;
      }
    },
    [dataFetcher, indexEditor, blobWriter, cachedIndex]
  );

  const selectedGroups = useMemo(
    () => groups.filter((group) => selectedGroupIds.has(group.id)),
    [groups, selectedGroupIds]
  );

  const isGroupOperationDisabled = savingGroupId !== null || merging || saving;
  const isSessionOperationDisabled = savingSessionId !== null || saving || merging;

  const sessionsByGroup = useMemo(() => {
    const sessionMap = new Map(sessions.map((session) => [session._ref, session]));
    const map = new Map();
    for (const group of groups) {
      const groupSessions = group.sessionRevisions
        .map((ref) => sessionMap.get(ref))
        .filter(Boolean);
      if (groupSessions.length > 0) {
        map.set(group.id, groupSessions);
      }
    }
    return map;
  }, [groups, sessions]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session._ref === selectedSessionRef) ?? null,
    [sessions, selectedSessionRef]
  );

  const toggleGroupSelection = useCallback((groupId) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const toggleGroupAccordion = useCallback((groupId) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const openMergeDialog = useCallback(() => {
    // ボタンの disabled 属性で制御済みの防御的ガード
    /* c8 ignore next 3 */
    if (selectedGroupIds.size < 2 || isGroupOperationDisabled) {
      return;
    }
    setGroupMessage({ type: '', text: '' });
    setMergeTargetGroupId(null);
    setIsMergeDialogOpen(true);
  }, [selectedGroupIds, isGroupOperationDisabled]);

  const closeMergeDialog = useCallback(() => {
    setIsMergeDialogOpen(false);
    setMergeTargetGroupId(null);
  }, []);

  // グループ統合処理（V2: version ベース楽観ロック）
  const handleMergeGroups = useCallback(async () => {
    // ダイアログの disabled 属性で制御済みの防御的ガード
    /* c8 ignore next 3 */
    if (!mergeTargetGroupId || selectedGroupIds.size < 2) {
      return;
    }

    setMerging(true);
    setGroupMessage({ type: '', text: '' });

    try {
      const latestIndexResult = await dataFetcher.fetchIndex();
      if (!latestIndexResult.ok) {
        setGroupMessage({
          type: 'error',
          text: '最新データの取得に失敗しました。ネットワーク接続を確認してください',
        });
        return;
      }

      // version を比較（楽観ロック）
      if (
        cachedIndex &&
        (latestIndexResult.data.version ?? 0) !== (cachedIndex.version ?? 0)
      ) {
        setGroupMessage({
          type: 'error',
          text: '他のユーザーが同時に編集しています。最新データを再読み込みしてください',
        });
        return;
      }

      const { index: updatedIndex, error } = indexEditor.mergeGroups(
        latestIndexResult.data,
        mergeTargetGroupId,
        [...selectedGroupIds]
      );

      if (error) {
        setGroupMessage({ type: 'error', text: error });
        return;
      }

      const result = await blobWriter.executeWriteSequence({
        rawCsv: null,
        newItems: [],
        indexUpdater: () => updatedIndex,
      });

      if (!result.allSucceeded) {
        const errorMessages = result.results
          .filter((r) => !r.success)
          .map((r) => r.error)
          .join(', ');
        setGroupMessage({
          type: 'error',
          text: `統合の保存に失敗しました。${errorMessages}`,
        });
        return;
      }

      dataFetcher.invalidateIndexCache();
      const refreshedIndexResult = await dataFetcher.fetchIndex();
      if (refreshedIndexResult.ok) {
        setGroups(refreshedIndexResult.data.groups);
        setCachedIndex(refreshedIndexResult.data);
      }

      setSelectedGroupIds(new Set());
      closeMergeDialog();
      setGroupMessage({ type: 'success', text: 'グループを統合しました' });
    } catch (err) {
      setGroupMessage({
        type: 'error',
        text: `統合の保存に失敗しました。${err.message}`,
      });
    } finally {
      setMerging(false);
    }
  }, [
    mergeTargetGroupId,
    selectedGroupIds,
    dataFetcher,
    cachedIndex,
    indexEditor,
    blobWriter,
    closeMergeDialog,
  ]);

  // セッション保存処理（V2: 新リビジョンを作成しセッションファイルを追記）
  const handleSaveSession = useCallback(
    async (sessionRef, name, instructors = []) => {
      const target = sessions.find((session) => session._ref === sessionRef);
      if (!target) return;

      const normalizedName = name.trim();
      if (normalizedName.length > MAX_SESSION_NAME_LENGTH) {
        setSessionMessage({
          type: 'error',
          text: 'セッション名は256文字以内で入力してください',
        });
        return;
      }

      // 新リビジョンを構築
      const { sessionRecord: newSessionRecord, newRef, newPath, error: revisionError } =
        indexEditor.createSessionRevision(sessionRef, target, {
          title: normalizedName,
          instructors,
        });

      if (revisionError) {
        setSessionMessage({ type: 'error', text: revisionError });
        return;
      }

      setSavingSessionId(sessionRef);
      setSessionMessage({ type: '', text: '' });

      try {
        const result = await blobWriter.executeWriteSequence({
          newItems: [
            {
              path: newPath,
              content: JSON.stringify(newSessionRecord, null, 2),
              contentType: 'application/json',
            },
          ],
          indexUpdater: (latestIndex) => {
            // 楽観ロック: version チェック
            if (
              cachedIndex &&
              (latestIndex.version ?? 0) !== (cachedIndex.version ?? 0)
            ) {
              return null;
            }

            // sessionRevisions で旧 ref → 新 ref に置換
            const replaceRef = (refs) =>
              refs.map((r) => (r === sessionRef ? newRef : r));

            return {
              ...latestIndex,
              schemaVersion: 2,
              version: (latestIndex.version ?? 0) + 1,
              updatedAt: new Date().toISOString(),
              groups: latestIndex.groups.map((g) => ({
                ...g,
                sessionRevisions: replaceRef(g.sessionRevisions),
              })),
              members: latestIndex.members.map((m) => ({
                ...m,
                sessionRevisions: replaceRef(m.sessionRevisions),
              })),
            };
          },
        });

        if (!result.allSucceeded) {
          const errorMessages = result.results
            .filter((writeResult) => !writeResult.success)
            .map((writeResult) => writeResult.error)
            .join(', ');
          setSessionMessage({
            type: 'error',
            text: `セッションの保存に失敗しました。${errorMessages}`,
          });
          return;
        }

        // ローカル状態を更新
        setSessions((prev) =>
          prev.map((session) => {
            if (session._ref !== sessionRef) return session;
            return { ...newSessionRecord, _ref: newRef };
          })
        );
        setSessionNameInputs((prev) => {
          const next = { ...prev };
          delete next[sessionRef];
          next[newRef] = normalizedName;
          return next;
        });
        setInstructorInputs((prev) => {
          const next = { ...prev };
          delete next[sessionRef];
          next[newRef] = instructors;
          return next;
        });

        // 選択中のセッション参照を更新
        setSelectedSessionRef((prev) => (prev === sessionRef ? newRef : prev));

        // キャッシュ無効化・再取得
        dataFetcher.invalidateIndexCache();
        const refreshed = await dataFetcher.fetchIndex();
        if (refreshed.ok) {
          setGroups(refreshed.data.groups);
          setCachedIndex(refreshed.data);
        }

        setSessionMessage({ type: 'success', text: 'セッションを保存しました' });
      } catch (error) {
        setSessionMessage({
          type: 'error',
          text: `セッションの保存に失敗しました。${error.message}`,
        });
      } finally {
        setSavingSessionId(null);
      }
    },
    [blobWriter, dataFetcher, sessions, cachedIndex]
  );

  // 新規メンバー追加ハンドラ（講師の手入力用）
  const handleAddNewMember = useCallback(
    async (name) => {
      if (!cachedIndex) return null;

      const { index: newIndex, memberId, error } = indexEditor.addMember(cachedIndex, name);
      if (error) {
        setSessionMessage({ type: 'error', text: error });
        return null;
      }

      try {
        const result = await blobWriter.executeWriteSequence({
          newItems: [],
          indexUpdater: (latestIndex) => {
            if (
              cachedIndex &&
              (latestIndex.version ?? 0) !== (cachedIndex.version ?? 0)
            ) {
              return null;
            }

            // 最新の index に新メンバーを追加（同じ memberId を使用）
            return {
              ...latestIndex,
              schemaVersion: 2,
              version: (latestIndex.version ?? 0) + 1,
              updatedAt: new Date().toISOString(),
              groups: latestIndex.groups.map((g) => ({
                ...g,
                sessionRevisions: [...g.sessionRevisions],
              })),
              members: [
                ...latestIndex.members.map((m) => ({
                  ...m,
                  sessionRevisions: [...m.sessionRevisions],
                })),
                {
                  id: memberId,
                  name,
                  totalDurationSeconds: 0,
                  sessionRevisions: [],
                },
              ],
            };
          },
        });

        if (!result.allSucceeded) {
          setSessionMessage({ type: 'error', text: 'メンバーの追加に失敗しました' });
          return null;
        }

        // ローカルキャッシュを更新
        setCachedIndex(newIndex);
        dataFetcher.invalidateIndexCache();
        const refreshed = await dataFetcher.fetchIndex();
        if (refreshed.ok) {
          setCachedIndex(refreshed.data);
        }

        return memberId;
      } catch (error) {
        setSessionMessage({
          type: 'error',
          text: `メンバーの追加に失敗しました。${error.message}`,
        });
        return null;
      }
    },
    [cachedIndex, indexEditor, blobWriter, dataFetcher]
  );

  // 非管理者はダッシュボードにリダイレクト
  if (!auth.isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      {/* 戻るボタン */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg px-3 py-1.5 -ml-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        ダッシュボードへ戻る
      </Link>

      <div>
        <h2 className="text-xl font-bold text-text-primary tracking-tight">管理者パネル</h2>
        <p className="text-sm text-text-muted mt-1">CSVインポート・プレビュー・一括保存</p>
      </div>

      <FileDropZone onFilesAdded={addFiles} disabled={saving} hasFiles={queue.length > 0} />

      <FileQueueCardList
        queue={queue}
        groups={groups}
        onRemove={removeFile}
        onSelectGroup={selectGroup}
      />

      {saving ? (
        <ProgressBar
          current={saveProgress.current}
          total={saveProgress.total}
          visible={true}
          statusText={saveStatusText}
        />
      ) : (
        <div className="flex items-center gap-3">
          {readyItems.length > 0 && (
            <button
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl shadow-sm hover:bg-primary-700 transition-colors text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              onClick={handleBulkSave}
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              一括保存 ({readyItems.length}件)
            </button>
          )}

          {failedItems.length > 0 && (
            <button
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-100 text-accent-600 border border-accent-300 rounded-xl hover:bg-accent-200 transition-colors text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
              onClick={handleRetry}
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              失敗した操作をリトライ ({failedItems.length}件)
            </button>
          )}
        </div>
      )}

      {/* グループ・セッション管理セクション（2カラムレイアウト） */}
      <div className="mt-8 pt-8 border-t border-border-light">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-text-primary tracking-tight">グループ・セッション管理</h3>
            <p className="text-sm text-text-muted mt-1">
              グループの編集・統合と、セッション名の管理ができます
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl shadow-sm hover:bg-primary-700 disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed transition-colors text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            onClick={openMergeDialog}
            disabled={selectedGroupIds.size < 2 || isGroupOperationDisabled}
          >
            <GitMerge className="w-4 h-4" aria-hidden="true" />
            統合
          </button>
        </div>

        <div aria-live="polite">
          {groupMessage.text && (
            <div
              className={`mb-4 p-3 rounded-xl flex items-center gap-2 animate-scale-in ${
                groupMessage.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {groupMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5" aria-hidden="true" />
              ) : (
                <AlertCircle className="w-5 h-5" aria-hidden="true" />
              )}
              <span className="text-sm">{groupMessage.text}</span>
            </div>
          )}
        </div>

        {groups.length === 0 ? (
          <p className="text-sm text-text-muted">グループがありません</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左カラム: グループ一覧（アコーディオン） */}
            <div className="space-y-2">
              {groups.map((group) => {
                const groupSessions = sessionsByGroup.get(group.id) || [];
                const isExpanded = expandedGroupIds.has(group.id);
                const unnamedCount = groupSessions.filter((s) => !s.title).length;
                return (
                  <div key={group.id} className="card-base overflow-hidden">
                    {/* グループヘッダー */}
                    <div className="flex items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-border-light text-primary-600 focus:ring-primary-500"
                        checked={selectedGroupIds.has(group.id)}
                        onChange={() => toggleGroupSelection(group.id)}
                        disabled={isGroupOperationDisabled}
                        aria-label={`${group.name} を選択`}
                      />
                      <button
                        onClick={() => toggleGroupAccordion(group.id)}
                        aria-expanded={isExpanded}
                        aria-label={`${group.name} を展開`}
                        className="flex items-center gap-2 text-left hover:bg-surface-muted rounded-lg px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <GroupNameEditor
                          groupId={group.id}
                          initialName={group.name}
                          onSave={handleSaveGroupName}
                          disabled={isGroupOperationDisabled}
                        />
                      </div>
                      <span className="text-xs text-text-muted tabular-nums whitespace-nowrap">
                        {groupSessions.length}件
                      </span>
                      {unnamedCount > 0 && (
                        <span className="text-xs bg-accent-100 text-accent-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                          未設定 {unnamedCount}件
                        </span>
                      )}
                    </div>
                    {/* セッション一覧（アコーディオン） */}
                    <div
                      className="accordion-panel"
                      data-expanded={isExpanded}
                      aria-hidden={!isExpanded}
                    >
                      <div className="accordion-panel-inner">
                        <div className="border-t border-border-light">
                          {groupSessions.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-text-muted">セッションなし</p>
                          ) : (
                            <div className="divide-y divide-border-light">
                              {groupSessions.map((session) => {
                                const isSelected = selectedSessionRef === session._ref;
                                return (
                                  <button
                                    key={session._ref}
                                    onClick={() => {
                                      setSelectedSessionRef(session._ref);
                                      setSessionMessage({ type: '', text: '' });
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset ${
                                      isSelected
                                        ? 'bg-primary-50 border-l-3 border-l-primary-500'
                                        : 'hover:bg-surface-muted border-l-3 border-l-transparent'
                                    }`}
                                  >
                                    <div className="tabular-nums text-text-muted text-xs">
                                      {session.startedAt?.slice(0, 10) ?? ''}
                                    </div>
                                    <div className="text-text-primary truncate">
                                      {session.title || '（未設定）'}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 右カラム: セッション編集パネル */}
            <div className="lg:sticky lg:top-6 lg:self-start">
              <SessionEditorPanel
                session={selectedSession}
                sessionName={
                  selectedSessionRef ? (sessionNameInputs[selectedSessionRef] || '') : ''
                }
                onSessionNameChange={(value) =>
                  setSessionNameInputs((prev) => ({
                    ...prev,
                    [selectedSessionRef]: value,
                  }))
                }
                onSave={handleSaveSession}
                saving={isSessionOperationDisabled}
                message={sessionMessage}
                members={cachedIndex?.members ?? []}
                instructorIds={
                  selectedSessionRef ? (instructorInputs[selectedSessionRef] ?? []) : []
                }
                onInstructorChange={(ids) =>
                  setInstructorInputs((prev) => ({
                    ...prev,
                    [selectedSessionRef]: ids,
                  }))
                }
                onAddNewMember={handleAddNewMember}
              />
            </div>
          </div>
        )}
      </div>

      {isMergeDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={closeMergeDialog} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="merge-dialog-title"
            className="relative w-full max-w-xl card-base p-6 animate-scale-in"
          >
            <div className="flex items-start justify-between gap-4">
              <h4 id="merge-dialog-title" className="text-lg font-bold text-text-primary">
                統合先グループを選択
              </h4>
              <button
                type="button"
                className="p-2 rounded-lg hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                onClick={closeMergeDialog}
                aria-label="ダイアログを閉じる"
                disabled={merging}
              >
                <X className="w-4 h-4 text-text-muted" aria-hidden="true" />
              </button>
            </div>

            <p className="text-sm text-text-muted mt-2">残すグループを1つ選択してください。</p>

            <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
              {selectedGroups.map((group) => (
                <label
                  key={group.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border-light hover:bg-surface-muted cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="merge-target-group"
                      value={group.id}
                      checked={mergeTargetGroupId === group.id}
                      onChange={(event) => setMergeTargetGroupId(event.target.value)}
                      disabled={merging}
                    />
                    <div>
                      <div className="text-sm font-medium text-text-primary">{group.name}</div>
                      <div className="text-xs text-text-muted font-mono">{group.id}</div>
                    </div>
                  </div>
                  <div className="text-xs text-text-muted tabular-nums">
                    {group.sessionRevisions.length}件 /{' '}
                    {Math.floor(group.totalDurationSeconds / 3600)}時間
                    {Math.floor((group.totalDurationSeconds % 3600) / 60)}分
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-border-light text-sm text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={closeMergeDialog}
                disabled={merging}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed"
                onClick={handleMergeGroups}
                disabled={!mergeTargetGroupId || merging}
              >
                {merging ? '統合中...' : '統合実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
