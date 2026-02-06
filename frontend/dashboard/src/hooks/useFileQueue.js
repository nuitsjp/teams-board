import { useReducer, useCallback, useEffect } from 'react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * ファイルキューのReducer
 */
function fileQueueReducer(state, action) {
  switch (action.type) {
    case 'ADD_FILES': {
      const newItems = action.payload.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: 'pending',
        parseResult: null,
        errors: [],
        warnings: [],
        hasDuplicate: false,
      }));
      return { ...state, queue: [...state.queue, ...newItems] };
    }
    case 'VALIDATE_START':
      return {
        ...state,
        queue: state.queue.map((item) =>
          item.id === action.payload ? { ...item, status: 'validating' } : item
        ),
      };
    case 'VALIDATE_SUCCESS':
      return {
        ...state,
        queue: state.queue.map((item) =>
          item.id === action.payload.id
            ? { ...item, status: 'ready', parseResult: action.payload.result, warnings: action.payload.result.warnings || [] }
            : item
        ),
      };
    case 'VALIDATE_ERROR':
      return {
        ...state,
        queue: state.queue.map((item) =>
          item.id === action.payload.id
            ? { ...item, status: 'error', errors: action.payload.errors }
            : item
        ),
      };
    case 'DUPLICATE_DETECTED':
      return {
        ...state,
        queue: state.queue.map((item) =>
          item.id === action.payload.id
            ? { ...item, status: 'duplicate_warning', hasDuplicate: true, parseResult: action.payload.result, warnings: action.payload.result.warnings || [] }
            : item
        ),
      };
    case 'APPROVE_DUPLICATE':
      return {
        ...state,
        queue: state.queue.map((item) =>
          item.id === action.payload && item.status === 'duplicate_warning'
            ? { ...item, status: 'ready' }
            : item
        ),
      };
    case 'REMOVE_FILE':
      return {
        ...state,
        queue: state.queue.filter((item) => item.id !== action.payload),
      };
    case 'SAVE_START':
      return {
        ...state,
        queue: state.queue.map((item) =>
          item.id === action.payload ? { ...item, status: 'saving' } : item
        ),
      };
    case 'SAVE_SUCCESS':
      return {
        ...state,
        queue: state.queue.map((item) =>
          item.id === action.payload ? { ...item, status: 'saved' } : item
        ),
      };
    case 'SAVE_FAIL':
      return {
        ...state,
        queue: state.queue.map((item) =>
          item.id === action.payload.id
            ? { ...item, status: 'save_failed', errors: action.payload.errors }
            : item
        ),
      };
    case 'SET_EXISTING_IDS':
      return { ...state, existingSessionIds: action.payload };
    case 'RESET_TO_READY':
      return {
        ...state,
        queue: state.queue.map((item) =>
          item.id === action.payload ? { ...item, status: 'ready', errors: [] } : item
        ),
      };
    default:
      return state;
  }
}

/**
 * ファイルのバリデーション
 * @param {File} file
 * @returns {string|null}
 */
function validateFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return 'CSVファイルのみ対応しています';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'ファイルサイズが10MBを超えています';
  }
  return null;
}

/**
 * ファイルキュー状態管理のカスタムHook
 * @param {object} csvTransformer - CsvTransformerインスタンス
 * @returns {object}
 */
export function useFileQueue(csvTransformer) {
  const [state, dispatch] = useReducer(fileQueueReducer, {
    queue: [],
    existingSessionIds: new Set(),
  });

  // pending状態のアイテムを自動パース
  useEffect(() => {
    const pendingItems = state.queue.filter((item) => item.status === 'pending');
    if (pendingItems.length === 0) return;

    for (const item of pendingItems) {
      // バリデーション
      const error = validateFile(item.file);
      if (error) {
        dispatch({ type: 'VALIDATE_ERROR', payload: { id: item.id, errors: [error] } });
        continue;
      }

      dispatch({ type: 'VALIDATE_START', payload: item.id });

      // 非同期パース実行
      csvTransformer.parse(item.file).then((result) => {
        if (!result.ok) {
          dispatch({ type: 'VALIDATE_ERROR', payload: { id: item.id, errors: result.errors } });
          return;
        }

        // 重複チェック
        const sessionId = result.sessionRecord.id;
        if (state.existingSessionIds.has(sessionId)) {
          dispatch({ type: 'DUPLICATE_DETECTED', payload: { id: item.id, result } });
        } else {
          dispatch({ type: 'VALIDATE_SUCCESS', payload: { id: item.id, result } });
        }
      });
    }
  }, [state.queue, state.existingSessionIds, csvTransformer]);

  const addFiles = useCallback((files) => {
    dispatch({ type: 'ADD_FILES', payload: Array.from(files) });
  }, []);

  const removeFile = useCallback((fileId) => {
    dispatch({ type: 'REMOVE_FILE', payload: fileId });
  }, []);

  const approveDuplicate = useCallback((fileId) => {
    dispatch({ type: 'APPROVE_DUPLICATE', payload: fileId });
  }, []);

  const setExistingSessionIds = useCallback((ids) => {
    dispatch({ type: 'SET_EXISTING_IDS', payload: ids });
  }, []);

  const updateStatus = useCallback((fileId, status, extra) => {
    switch (status) {
      case 'saving':
        dispatch({ type: 'SAVE_START', payload: fileId });
        break;
      case 'saved':
        dispatch({ type: 'SAVE_SUCCESS', payload: fileId });
        break;
      case 'save_failed':
        dispatch({ type: 'SAVE_FAIL', payload: { id: fileId, errors: extra?.errors || [] } });
        break;
      case 'ready':
        dispatch({ type: 'RESET_TO_READY', payload: fileId });
        break;
    }
  }, []);

  return {
    queue: state.queue,
    addFiles,
    removeFile,
    approveDuplicate,
    setExistingSessionIds,
    updateStatus,
    readyItems: state.queue.filter((item) => item.status === 'ready'),
    failedItems: state.queue.filter((item) => item.status === 'save_failed'),
  };
}
