## 1. import 文の修正

- [x] 1.1 `useFileQueue.test.jsx` の import に `@testing-library/react` から `waitFor` を追加する
- [x] 1.2 `renderHook, act` の既存 import に `waitFor` を追記する形式にする

## 2. vi.waitFor → waitFor への置き換え

- [x] 2.1 `selectGroup で groupOverride が設定される` テスト内の `vi.waitFor` を `waitFor` に置き換える（66行目付近）
- [x] 2.2 `selectGroup で変更後の sessionId が既存と重複する場合` テスト内の `vi.waitFor` を `waitFor` に置き換える（99行目付近）
- [x] 2.3 `groupName が空の場合 missing_group ステータスになる` テスト内の `vi.waitFor` を `waitFor` に置き換える（125行目付近）
- [x] 2.4 `missing_group のアイテムでグループを選択すると ready になる` テスト内の `vi.waitFor` を `waitFor` に置き換える（142行目付近）

## 3. テスト実行と検証

- [x] 3.1 `pnpm vitest run tests/react/hooks/useFileQueue.test.jsx` で対象テストを実行し、全テストがパスすることを確認する
- [x] 3.2 テスト実行時に stderr に `act(...)` 警告が出力されないことを確認する
- [x] 3.3 `pnpm test` でテストスイート全体を実行し、既存テストに影響がないことを確認する
