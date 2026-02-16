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
import {
  ArrowLeft,
  Upload,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  GitMerge,
  Save,
  X,
} from 'lucide-react';
import { GroupNameEditor } from '../components/GroupNameEditor.jsx';

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
    approveDuplicate,
    selectGroup,
    setExistingSessionIds,
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
  const [savingGroupId, setSavingGroupId] = useState(null);
  const [groupMessage, setGroupMessage] = useState({ type: '', text: '' });
  const [sessionMessage, setSessionMessage] = useState({ type: '', text: '' });
  const [savingSessionId, setSavingSessionId] = useState(null);
  const [cachedIndex, setCachedIndex] = useState(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeTargetGroupId, setMergeTargetGroupId] = useState(null);
  const [merging, setMerging] = useState(false);

  // 既存セッションIDの取得とグループ一覧の取得
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const indexResult = await dataFetcher.fetchIndex();
      if (cancelled) return;
      if (indexResult.ok) {
        const sessionIds = new Set(indexResult.data.groups.flatMap((g) => g.sessionIds));
        setExistingSessionIds(sessionIds);
        setGroups(indexResult.data.groups);
        setCachedIndex(indexResult.data);

        const sessionResults = await Promise.all(
          [...sessionIds].map(async (sessionId) => ({
            sessionId,
            result: await dataFetcher.fetchSession(sessionId),
          }))
        );
        if (cancelled) return;
        const loadedSessions = sessionResults
          .filter(({ result }) => result.ok)
          .map(({ result }) => result.data)
          .sort((a, b) => b.date.localeCompare(a.date));
        setSessions(loadedSessions);
        setSessionNameInputs(
          Object.fromEntries(loadedSessions.map((session) => [session.id, session.name || '']))
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataFetcher, setExistingSessionIds]);

  useEffect(() => {
    setSelectedGroupIds((prev) => {
      const existingIdSet = new Set(groups.map((group) => group.id));
      const next = new Set([...prev].filter((id) => existingIdSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [groups]);

  // 一括保存処理
  const handleBulkSave = useCallback(async () => {
    const itemsToSave = queue.filter((item) => item.status === 'ready');
    if (itemsToSave.length === 0) return;

    setSaving(true);
    setSaveProgress({ current: 0, total: itemsToSave.length });
    setSaveStatusText(`保存中\u2026 0/${itemsToSave.length} 件`);

    const preparedItems = itemsToSave.map((item) => {
      let { sessionRecord, mergeInput } = item.parseResult;

      // グループ上書きがある場合、mergeInput / sessionRecord を上書き
      if (item.groupOverride) {
        const { groupId, groupName } = item.groupOverride;
        const newSessionId = `${groupId}-${mergeInput.date}`;
        mergeInput = { ...mergeInput, groupId, groupName, sessionId: newSessionId };
        sessionRecord = { ...sessionRecord, groupId, id: newSessionId };
      }

      return {
        itemId: item.id,
        sourcePath: `data/sources/${sessionRecord.id}.csv`,
        sessionPath: `data/sessions/${sessionRecord.id}.json`,
        sourceFile: item.file,
        sessionRecord,
        mergeInput,
      };
    });

    for (const prepared of preparedItems) {
      updateStatus(prepared.itemId, 'saving');
    }

    const sessionPathSet = new Set(preparedItems.map((prepared) => prepared.sessionPath));
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
      indexUpdater: (currentIndex, writeResults) => {
        const resultByPath = new Map(writeResults.map((writeResult) => [writeResult.path, writeResult]));
        const successfulMergeInputs = preparedItems
          .filter(
            (prepared) =>
              (resultByPath.get(prepared.sourcePath)?.success ?? false) &&
              (resultByPath.get(prepared.sessionPath)?.success ?? false)
          )
          .map((prepared) => prepared.mergeInput);

        if (successfulMergeInputs.length === 0) {
          return null;
        }

        return successfulMergeInputs.reduce(
          (index, mergeInput) => indexMerger.merge(index, mergeInput).index,
          currentIndex
        );
      },
      onItemComplete: (writeResult) => {
        if (!sessionPathSet.has(writeResult.path)) {
          return;
        }
        completedSessions += 1;
        setSaveProgress({ current: completedSessions, total: itemsToSave.length });
        setSaveStatusText(`保存中\u2026 ${completedSessions}/${itemsToSave.length} 件`);
      },
    });

    const resultByPath = new Map(result.results.map((writeResult) => [writeResult.path, writeResult]));
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
  }, [queue, updateStatus, blobWriter, indexMerger, dataFetcher]);

  // リトライ処理
  const handleRetry = useCallback(async () => {
    const failed = queue.filter((item) => item.status === 'save_failed');
    for (const item of failed) {
      updateStatus(item.id, 'ready');
    }
  }, [queue, updateStatus]);

  // グループ名保存処理
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

        // updatedAtタイムスタンプを比較
        if (cachedIndex && latestIndexResult.data.updatedAt !== cachedIndex.updatedAt) {
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
  const groupNameMap = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);

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

  const openMergeDialog = useCallback(() => {
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

  const handleMergeGroups = useCallback(async () => {
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

      if (cachedIndex && latestIndexResult.data.updatedAt !== cachedIndex.updatedAt) {
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

  const handleSaveSessionName = useCallback(
    async (sessionId, name) => {
      const target = sessions.find((session) => session.id === sessionId);
      if (!target) {
        return;
      }

      const normalizedName = name.trim();
      if (normalizedName.length > MAX_SESSION_NAME_LENGTH) {
        setSessionMessage({ type: 'error', text: 'セッション名は256文字以内で入力してください' });
        return;
      }

      const updatedSession = { ...target };
      if (normalizedName.length === 0) {
        delete updatedSession.name;
      } else {
        updatedSession.name = normalizedName;
      }

      setSavingSessionId(sessionId);
      setSessionMessage({ type: '', text: '' });

      try {
        const result = await blobWriter.executeWriteSequence({
          newItems: [
            {
              path: `data/sessions/${sessionId}.json`,
              content: JSON.stringify(updatedSession, null, 2),
              contentType: 'application/json',
            },
          ],
        });

        if (!result.allSucceeded) {
          const errorMessages = result.results
            .filter((writeResult) => !writeResult.success)
            .map((writeResult) => writeResult.error)
            .join(', ');
          setSessionMessage({
            type: 'error',
            text: `セッション名の保存に失敗しました。${errorMessages}`,
          });
          return;
        }

        setSessions((prev) =>
          prev.map((session) => {
            if (session.id !== sessionId) {
              return session;
            }
            const updated = { ...session };
            if (updatedSession.name === undefined) {
              delete updated.name;
            } else {
              updated.name = updatedSession.name;
            }
            return updated;
          })
        );
        setSessionNameInputs((prev) => ({
          ...prev,
          [sessionId]: updatedSession.name || '',
        }));
        dataFetcher.invalidateSessionCache(sessionId);
        setSessionMessage({ type: 'success', text: 'セッション名を保存しました' });
      } catch (error) {
        setSessionMessage({
          type: 'error',
          text: `セッション名の保存に失敗しました。${error.message}`,
        });
      } finally {
        setSavingSessionId(null);
      }
    },
    [blobWriter, dataFetcher, sessions]
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
        onApproveDuplicate={approveDuplicate}
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

      {/* グループ管理セクション */}
      <div className="mt-8 pt-8 border-t border-border-light">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-text-primary tracking-tight">グループ管理</h3>
            <p className="text-sm text-text-muted mt-1">
              グループ名編集と複数グループ統合ができます（グループIDは変更されません）
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
          <div className="card-base overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    選択
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    グループID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    グループ名
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    総学習時間
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    セッション数
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {groups.map((group) => (
                  <tr
                    key={group.id}
                    className={`transition-colors ${
                      selectedGroupIds.has(group.id)
                        ? 'bg-primary-50 hover:bg-primary-100'
                        : 'hover:bg-surface-muted'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-border-light text-primary-600 focus:ring-primary-500"
                        checked={selectedGroupIds.has(group.id)}
                        onChange={() => toggleGroupSelection(group.id)}
                        disabled={isGroupOperationDisabled}
                        aria-label={`${group.name} を選択`}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-text-muted font-mono">{group.id}</td>
                    <td className="px-4 py-3">
                      <GroupNameEditor
                        groupId={group.id}
                        initialName={group.name}
                        onSave={handleSaveGroupName}
                        disabled={isGroupOperationDisabled}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary text-right tabular-nums">
                      {Math.floor(group.totalDurationSeconds / 3600)}時間
                      {Math.floor((group.totalDurationSeconds % 3600) / 60)}分
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary text-right tabular-nums">
                      {group.sessionIds.length}件
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* セッション名管理セクション */}
      <div className="mt-8 pt-8 border-t border-border-light">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-text-primary tracking-tight">セッション名管理</h3>
          <p className="text-sm text-text-muted mt-1">
            セッション名を設定すると、明細画面で「セッション名 - 日付」で表示されます
          </p>
        </div>

        <div aria-live="polite">
          {sessionMessage.text && (
            <div
              className={`mb-4 p-3 rounded-xl flex items-center gap-2 animate-scale-in ${
                sessionMessage.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {sessionMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5" aria-hidden="true" />
              ) : (
                <AlertCircle className="w-5 h-5" aria-hidden="true" />
              )}
              <span className="text-sm">{sessionMessage.text}</span>
            </div>
          )}
        </div>

        {sessions.length === 0 ? (
          <p className="text-sm text-text-muted">セッションがありません</p>
        ) : (
          <div className="card-base overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    日付
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    グループ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    セッション名
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-surface-muted transition-colors">
                    <td className="px-4 py-3 text-sm text-text-primary tabular-nums">{session.date}</td>
                    <td className="px-4 py-3 text-sm text-text-primary">
                      {groupNameMap.get(session.groupId) || session.groupId}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="text"
                        value={sessionNameInputs[session.id] || ''}
                        onChange={(event) =>
                          setSessionNameInputs((prev) => ({
                            ...prev,
                            [session.id]: event.target.value,
                          }))
                        }
                        maxLength={MAX_SESSION_NAME_LENGTH}
                        className="w-full px-3 py-2 border border-border-light rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-500"
                        placeholder="未設定（空欄で日付のみ表示）"
                        aria-label={`${session.date} のセッション名`}
                        disabled={isSessionOperationDisabled}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed"
                        onClick={() => handleSaveSessionName(session.id, sessionNameInputs[session.id] || '')}
                        disabled={isSessionOperationDisabled}
                      >
                        <Save className="w-4 h-4" aria-hidden="true" />
                        保存
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    {group.sessionIds.length}件 / {Math.floor(group.totalDurationSeconds / 3600)}時間
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
