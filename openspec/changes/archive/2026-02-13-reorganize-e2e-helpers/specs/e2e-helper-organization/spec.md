## ADDED Requirements

### Requirement: E2E補助モジュールの配置一元化

システムのE2E補助モジュールは `e2e/helpers/` 配下に配置されなければならない（SHALL）。ルート直下の `e2e-helpers/` ディレクトリは利用してはならない（MUST NOT）。

#### Scenario: 補助モジュールが `e2e/helpers/` に存在する
- **WHEN** リポジトリ内のE2E補助モジュール配置を確認する
- **THEN** 補助モジュールは `e2e/helpers/` 配下に存在する

#### Scenario: 旧ディレクトリが残存しない
- **WHEN** ルート直下のディレクトリ構成を確認する
- **THEN** `e2e-helpers/` ディレクトリは存在しない

### Requirement: E2E補助モジュールの責務ベース命名

`e2e/helpers/` 配下の補助モジュールは責務を表す英語名で命名されなければならない（SHALL）。フィクスチャのバックアップ・復元・後始末を担うモジュールは `fixture-lifecycle.js`、テスト用ルートのフィクスチャ供給を担うモジュールは `route-fixtures.js` としなければならない（MUST）。

#### Scenario: フィクスチャのライフサイクル責務が明示される
- **WHEN** フィクスチャ管理モジュール名を確認する
- **THEN** モジュール名は `fixture-lifecycle.js` である

#### Scenario: ルートフィクスチャ責務が明示される
- **WHEN** ルートスタブ用モジュール名を確認する
- **THEN** モジュール名は `route-fixtures.js` である

### Requirement: E2Eコードの補助モジュール参照規則

`e2e/` 配下の spec ファイルおよび global setup/teardown は、補助モジュールを `e2e/helpers/` からの相対パスで参照しなければならない（SHALL）。`../e2e-helpers/` を参照してはならない（MUST NOT）。

#### Scenario: global setup/teardown が新配置を参照する
- **WHEN** `e2e/global-setup.js` と `e2e/global-teardown.js` の import を確認する
- **THEN** import は `./helpers/` を基点とした相対パスで記述されている

#### Scenario: E2E spec が新配置を参照する
- **WHEN** `e2e/*.spec.js` の補助モジュール import を確認する
- **THEN** import は `./helpers/` を基点とした相対パスで記述され、`../e2e-helpers/` 参照は存在しない
