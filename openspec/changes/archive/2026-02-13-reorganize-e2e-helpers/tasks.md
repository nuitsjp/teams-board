## 1. ディレクトリ再編と命名変更

- [x] 1.1 `e2e/helpers/` ディレクトリを作成し、`e2e-helpers/fixture-manager.js` を `e2e/helpers/fixture-lifecycle.js` へ移動する
- [x] 1.2 `e2e-helpers/test-helpers.js` を `e2e/helpers/route-fixtures.js` へ移動する
- [x] 1.3 ルート直下の `e2e-helpers/` が不要になったことを確認し、残存ファイルがない状態にする

## 2. 参照更新

- [x] 2.1 `e2e/global-setup.js` と `e2e/global-teardown.js` の import を `./helpers/` 基点の新パスへ更新する
- [x] 2.2 `e2e/*.spec.js` の helper import を `./helpers/` 基点の新パスへ更新する
- [x] 2.3 `../e2e-helpers/`、`fixture-manager`、`test-helpers` の旧参照が残っていないことを検索で確認する

## 3. 検証

- [x] 3.1 `pnpm run test:e2e` を実行し、再配置と再命名後もE2Eテストが通ることを確認する
- [x] 3.2 失敗時の切り戻し手順（対象コミットの `git revert`）を実施可能な状態で記録する（`git revert <対象コミット>`）
