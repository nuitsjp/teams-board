## Context

現在のコードベースでは、プレゼンテーショナルコンポーネント（`SummaryCard`、`ProgressBar`、`FileQueueCard`）が `React.memo()` なしでエクスポートされている。親コンポーネントの状態変更（ファイルキュー更新、検索入力など）が発生するたびに、props が変化していないコンポーネントも再レンダリングされている。

また、`useFileQueue` の `parsePendingItem` は依存配列に `state.existingSessionIds`（Set オブジェクト）を含んでおり、reducer が新しい state を返すたびに参照が変わるため、`useCallback` のメモ化が無効化され、`useEffect` の不要な再実行を引き起こす。

`MemberList` と `GroupList` は内部で `useNavigate` フックを使用しているため、コンポーネント全体を `React.memo()` でラップすることはできない。代わりに、リスト内の行レンダリングを個別コンポーネントに抽出して memo 化する。

### 制約

- React 19（React Compiler は未導入）
- JSX のみ（TypeScript なし）
- 既存テストの振る舞いを変更しない

## Goals / Non-Goals

**Goals:**

- props 未変更時にプレゼンテーショナルコンポーネントの再レンダリングをスキップする
- `useFileQueue` の `parsePendingItem` が不要に再生成されないようにする
- `MemberList` の検索入力中に大量のメンバーリストのフィルタリングが UI をブロックしないようにする
- 既存テスト（ユニット・E2E）を全件パスさせる

**Non-Goals:**

- パフォーマンス計測ツール（React Profiler 等）の導入
- `useMemo` / `useCallback` の全面的な見直し（今回は Issue #74 の対象のみ）
- React Compiler の導入
- コンポーネントの機能的なリファクタリング（見た目・動作の変更）

## Decisions

### 1. `SummaryCard` と `ProgressBar` は直接 `React.memo()` ラップ

**理由**: 両コンポーネントは純粋なプレゼンテーショナルコンポーネントであり、フック不使用・内部状態なし（`ProgressBar` は計算のみ）。`memo()` の効果が最大となる最もシンプルなケース。

**代替案**: `useMemo` で親側から出力をキャッシュ → 親コンポーネントに最適化責任が分散するため不採用。

### 2. `FileQueueCard` は `React.memo()` をカスタム比較関数なしで適用

**理由**: `FileQueueCard` の props のうち `item` オブジェクトは reducer が新しいオブジェクトを返すが、変更がないアイテムは同一参照が維持される（`state.queue.map` でスプレッドされるのは変更対象のアイテムのみ）。コールバック props（`onRemove` 等）は親の `useCallback` で安定化されている。したがってデフォルトの浅い比較で十分に機能する。

**代替案**: カスタム比較関数 → 保守コストが高く、props 追加時にバグの原因になるため不採用。

### 3. `GroupList` / `MemberList` は行コンポーネントを抽出して memo 化

**理由**: `GroupList` と `MemberList` は `useNavigate` フックを使用しているため、コンポーネント全体の memo 化は不可能。行レンダリング部分を `GroupRow` / `MemberRow` として切り出し、`React.memo()` を適用する。`navigate` 関数は `useNavigate` の戻り値で参照安定であるため、行コンポーネントに props として渡しても memo が有効に機能する。

**代替案**: 行コンポーネントを別ファイルに分離 → 今回は同一ファイル内で定義し、凝集度を維持する。

### 4. `MemberList` の検索に `useTransition` を適用

**理由**: `searchQuery` の状態更新を `startTransition` でラップすることで、検索入力の応答性を維持しつつ、フィルタリング処理を低優先度で実行できる。入力値の即時表示には別途 `inputValue` state を導入し、入力欄には `inputValue` をバインドする。

**代替案**: デバウンス → 固定遅延が入るため UX が劣る。`useTransition` は React のスケジューラが最適なタイミングで更新を適用するため、より自然な体験を提供する。

### 5. `useFileQueue` の `parsePendingItem` 依存安定化に `useRef` を使用

**理由**: `state.existingSessionIds` を `useRef` に格納し、reducer の `SET_EXISTING_IDS` 時に ref を更新する。`parsePendingItem` の `useCallback` 依存配列から `state.existingSessionIds` を除外し、代わりに ref 経由で最新値を読み取る。これにより `parsePendingItem` の参照が安定し、`useEffect` の不要な再実行を防止する。

**代替案**: `useReducer` の state 構造を変更して existingSessionIds を分離 → reducer の大幅な変更が必要で影響範囲が広いため不採用。

## Risks / Trade-offs

- **[memo のオーバーヘッド]** → 浅い比較のコストは微小であり、再レンダリングのコスト削減が上回る。props が頻繁に変わるコンポーネントには適用しない。
- **[useRef による最新値参照]** → `parsePendingItem` が呼ばれた時点の `existingSessionIds` を参照するため、厳密には stale な値を読む可能性がある。ただし `setExistingSessionIds` は `fetchData` 時（ページロード・保存後）にしか呼ばれず、`parsePendingItem` と同時に変更されるケースは実質的に発生しない。
- **[useTransition の isPending 未使用]** → 今回は `isPending` による視覚フィードバック（スピナー等）は追加しない。メンバー数が少ない場合は遅延がほぼ発生しないため、不要な UI 変化を避ける。
- **[行コンポーネント抽出のテスト影響]** → `GroupRow` / `MemberRow` は同一ファイル内にエクスポートなしで定義するため、既存テストの `data-testid` やクリックイベントの動作は変わらない。
