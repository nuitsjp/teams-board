## Why

`useFileQueue.test.jsx` の4つのテストケースで React の `act(...)` 警告が stderr に出力されている。テスト自体はパスするが、CI ログにノイズが入り、将来的にテスト品質の劣化を見逃すリスクがある。`addFiles` 後に `useEffect` が非同期で `csvTransformer.parse()` を呼び出し、その完了時の `dispatch` が `act()` の外で発生していることが原因。

## What Changes

- `tests/react/hooks/useFileQueue.test.jsx` の非同期ステート更新を適切に `act()` でラップする
- `addFiles` 呼び出し後のパース完了待機で `waitFor` を使用し、React のステート更新サイクルを正しく処理する
- `selectGroup` 呼び出し後のアサーションについても `act()` ラップが必要か検証し、修正する

## Capabilities

### New Capabilities

なし — テストコードの修正のみで、新たな機能やスペックの追加は不要。

### Modified Capabilities

なし — プロダクションコードの振る舞いに変更はない。テストの書き方の修正のみ。

## Impact

- **対象ファイル**: `tests/react/hooks/useFileQueue.test.jsx`（テストコードのみ）
- **プロダクションコード**: 変更なし
- **CI/CD**: テスト実行時の stderr 警告が解消される
- **リスク**: 低（テストコードのみの修正、プロダクションコードは一切変更しない）
