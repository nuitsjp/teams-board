## Why

ルート直下の `e2e-helpers/` が `e2e/` と分離されているため、E2E関連コードの探索性と責務境界が分かりづらい。E2Eテスト資産を同一ドメイン配下へ集約し、今後の保守と拡張のコストを下げる必要である。

## What Changes

- `e2e-helpers/` を `e2e/helpers/` へ再配置し、E2Eテスト本体と補助コードの配置を統一する。
- 補助モジュールの命名規約を見直し、責務が推測できる英語識別子へ統一する。
- `e2e/` 配下の spec・setup・teardown から参照する import パスを新配置へ更新する。
- テスト挙動は維持し、機能仕様・画面仕様・外部API仕様は変更しない。

## Capabilities

### New Capabilities
- `e2e-helper-organization`: E2E補助モジュールは `e2e/helpers/` 配下に集約され、E2Eテストコードから一貫した参照規則で利用できることを定義する。

### Modified Capabilities
- なし

## Impact

- 影響コード： `e2e/` 配下の spec ファイル、`e2e/global-setup.js`、`e2e/global-teardown.js`、`e2e/helpers/`（新設）
- テスト実行系： Playwright E2E の import 解決とヘルパー呼び出し経路
- 非影響： アプリ本体 (`src/`)、ランタイム機能、公開API、データフォーマット
