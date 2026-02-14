## Context

`useFileQueue` フックは `addFiles` 呼び出し時に `useEffect` 経由で非同期パース処理を実行する。テストでは `act(() => addFiles([file]))` で同期的な dispatch をラップした後、`await vi.waitFor()` でパース完了を待機している。

しかし `vi.waitFor`（Vitest 提供）はポーリング中のステート更新を React の `act()` でラップしない。一方、他のテストファイル（`AdminPage.test.jsx`、`DashboardPage.test.jsx` 等）はすべて `@testing-library/react` の `waitFor` を使用しており、act 警告は発生していない。

## Goals / Non-Goals

**Goals:**

- 4つのテストケースで発生している `act(...)` 警告を解消する
- プロジェクト全体のテストパターンを統一する（RTL の `waitFor` に統一）

**Non-Goals:**

- プロダクションコード（`useFileQueue.js`）の変更
- テストケースの追加・削除やテストロジックの変更
- 他のテストファイルのリファクタリング

## Decisions

### `vi.waitFor` → RTL `waitFor` への置き換え

**選択**: `@testing-library/react` の `waitFor` を使用する

**理由**:
- RTL の `waitFor` はコールバック内のステート更新を自動的に `act()` でラップする
- プロジェクト内の他のすべてのテストファイルが既にこのパターンを使用している
- import 文の変更と `vi.waitFor` → `waitFor` の置き換えだけで完了する最小限の修正

**却下した代替案**:

1. **`await act(async () => { ... })` で全体をラップ** — `addFiles` から `waitFor` まですべてを1つの `act` で囲む方法。動作するが、`act` の中に長い非同期待機を入れるのは RTL のベストプラクティスに反する。
2. **`vi.waitFor` のコールバック内で `act` を呼ぶ** — 冗長になり、RTL の `waitFor` が提供する機能と重複する。

## Risks / Trade-offs

- **[リスク] RTL `waitFor` と `vi.waitFor` の挙動差異** → RTL `waitFor` はデフォルトで 1000ms タイムアウト、50ms 間隔でポーリング。現在のテストは即座にパースが完了するモックなので実質的な差異はない。
- **[リスク] import 変更による他テストへの影響** → `useFileQueue.test.jsx` のみの変更なので影響範囲は限定的。修正後にテストスイート全体を実行して確認する。
