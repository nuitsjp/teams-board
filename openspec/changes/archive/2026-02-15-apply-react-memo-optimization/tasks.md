## 1. 単純な React.memo 適用

- [x] 1.1 `SummaryCard` を `React.memo()` でラップする（`src/components/SummaryCard.jsx`）
- [x] 1.2 `ProgressBar` を `React.memo()` でラップする（`src/components/ProgressBar.jsx`）
- [x] 1.3 `FileQueueCard` を `React.memo()` でラップする（`src/components/FileQueueCard.jsx`）

## 2. リスト行コンポーネントの抽出と memo 化

- [x] 2.1 `GroupList` から `GroupRow` コンポーネントを抽出し `React.memo()` を適用する（`src/components/GroupList.jsx`）
- [x] 2.2 `MemberList` から `MemberRow` コンポーネントを抽出し `React.memo()` を適用する（`src/components/MemberList.jsx`）

## 3. MemberList の検索に useTransition を適用

- [x] 3.1 `MemberList` に `inputValue` state と `useTransition` を導入し、検索入力の応答性を改善する（`src/components/MemberList.jsx`）

## 4. useFileQueue の依存安定化

- [x] 4.1 `useFileQueue` に `useRef` を導入し `existingSessionIds` を安定化、`parsePendingItem` の依存配列から除外する（`src/hooks/useFileQueue.js`）

## 5. 検証

- [x] 5.1 `pnpm test` で全ユニットテストがパスすることを確認する
- [x] 5.2 `pnpm run lint` で ESLint エラーがないことを確認する
- [x] 5.3 `pnpm run build` でビルドが成功することを確認する
