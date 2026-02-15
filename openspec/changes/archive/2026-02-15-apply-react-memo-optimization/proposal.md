## Why

ダッシュボード画面や管理画面で、親コンポーネントの状態変更（検索入力、ファイルキュー更新など）が発生するたびに、変化のないプレゼンテーショナルコンポーネントまで再レンダリングされている。`React.memo()` による不要な再レンダリングの抑制、`useFileQueue` の依存安定化、および `MemberList` への `startTransition` 適用により、UI の応答性を改善する。

## What Changes

- `SummaryCard`、`ProgressBar`、`FileQueueCard` に `React.memo()` を適用し、props 未変更時の再レンダリングをスキップする
- `GroupList` から `GroupRow` コンポーネントを抽出し、`React.memo()` を適用する（`GroupList` 自体は `useNavigate` フックを含むため memo 不可）
- `MemberList` から `MemberRow` コンポーネントを抽出し、`React.memo()` を適用する（`MemberList` 自体は `useNavigate` フックを含むため memo 不可）
- `MemberList` の検索入力に `useTransition` を適用し、大量メンバーのフィルタリング中も入力欄の応答性を維持する
- `useFileQueue` の `parsePendingItem` から `state.existingSessionIds`（Set）を依存配列から除外し、`useRef` で安定化する

## Capabilities

### New Capabilities

- `rerender-optimization`: プレゼンテーショナルコンポーネントの `React.memo()` 適用、リスト行コンポーネントの抽出、`useTransition` による検索入力の優先度制御、および `useFileQueue` の依存安定化を含む再レンダリング最適化

### Modified Capabilities

（既存 spec への要件変更なし。実装の内部最適化のみ。）

## Impact

- **対象ファイル**:
  - `src/components/SummaryCard.jsx` — `React.memo()` ラップ
  - `src/components/GroupList.jsx` — `GroupRow` 抽出 + `React.memo()`
  - `src/components/ProgressBar.jsx` — `React.memo()` ラップ
  - `src/components/FileQueueCard.jsx` — `React.memo()` ラップ
  - `src/components/MemberList.jsx` — `MemberRow` 抽出 + `React.memo()` + `useTransition`
  - `src/hooks/useFileQueue.js` — `parsePendingItem` の依存安定化
- **テスト**: 既存のユニットテスト・E2E テストはすべてパスすること（振る舞いの変更なし）
- **依存関係**: 追加パッケージなし（React 19 標準 API のみ使用）
- **API / データ**: 変更なし
