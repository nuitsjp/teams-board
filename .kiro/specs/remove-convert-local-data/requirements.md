# Requirements Document

## Introduction
`convert-local-data.mjs` スクリプトと、それが依存する `src/local-batch/` モジュール群、対応するテスト、サンプルデータ (`data/sample/`)、および関連するドキュメント参照をすべて削除する。削除後もプロジェクトのビルド・テスト・lint が正常に動作する状態を維持する。

## Requirements

### Requirement 1: エントリポイントスクリプトの削除
**Objective:** As a 開発者, I want `scripts/convert-local-data.mjs` を削除したい, so that 不要になったローカル変換スクリプトがリポジトリに残らないようにする

#### Acceptance Criteria
1. The リポジトリ shall `scripts/convert-local-data.mjs` を含まない
2. When `convert:local-data` npm スクリプトが `package.json` から削除された場合, the ビルドシステム shall 残りの npm スクリプトが正常に動作する

### Requirement 2: local-batch モジュールの削除
**Objective:** As a 開発者, I want `src/local-batch/` ディレクトリ配下の全ファイルを削除したい, so that `convert-local-data.mjs` が依存していたモジュール群が残存しないようにする

#### Acceptance Criteria
1. The リポジトリ shall `src/local-batch/` ディレクトリを含まない
2. The リポジトリ shall 以下のファイルを含まない:
   - `src/local-batch/atomic-public-data-writer.js`
   - `src/local-batch/consistency-validator.js`
   - `src/local-batch/conversion-reporter.js`
   - `src/local-batch/csv-transformer-adapter.js`
   - `src/local-batch/data-contract-validator.js`
   - `src/local-batch/local-convert-command.js`
   - `src/local-batch/local-verification-runner.js`
   - `src/local-batch/sample-dataset-reader.js`
   - `src/local-batch/session-aggregation-service.js`

### Requirement 3: 関連テストの削除
**Objective:** As a 開発者, I want `tests/local-batch/` ディレクトリと関連する統合テストを削除したい, so that 削除されたモジュールのテストが残らないようにする

#### Acceptance Criteria
1. The リポジトリ shall `tests/local-batch/` ディレクトリを含まない
2. The リポジトリ shall `tests/integration/local-conversion-pipeline.test.js` を含まない
3. When テストスイートを実行した場合, the テストランナー shall エラーなく完了する

### Requirement 4: サンプルデータの削除
**Objective:** As a 開発者, I want `data/sample/` ディレクトリ配下の全 CSV ファイルを削除したい, so that ローカル変換専用のサンプルデータがリポジトリに残らないようにする

#### Acceptance Criteria
1. The リポジトリ shall `data/sample/` ディレクトリを含まない

### Requirement 5: package.json の npm スクリプト削除
**Objective:** As a 開発者, I want `package.json` から `convert:local-data` スクリプトを削除したい, so that 存在しないスクリプトへの参照が残らないようにする

#### Acceptance Criteria
1. The `package.json` shall `convert:local-data` スクリプトエントリを含まない
2. When `pnpm run` を実行した場合, the パッケージマネージャ shall 有効なスクリプト一覧のみを表示する

### Requirement 6: ドキュメントの更新
**Objective:** As a 開発者, I want `docs/architecture.md` から `convert-local-data.mjs` および `data/sample/` への参照を削除したい, so that ドキュメントが現在のリポジトリ構成と一致するようにする

#### Acceptance Criteria
1. The `docs/architecture.md` shall `convert-local-data.mjs` への参照を含まない
2. The `docs/architecture.md` shall `data/sample/` への参照を含まない
3. The `docs/architecture.md` shall `ローカル変換実行` の説明を含まない

### Requirement 7: プロジェクト整合性の維持
**Objective:** As a 開発者, I want 削除後にプロジェクト全体の整合性が保たれることを確認したい, so that 既存機能に影響がないようにする

#### Acceptance Criteria
1. When 全テストスイートを実行した場合, the テストランナー shall すべてのテストがパスする
2. When lint を実行した場合, the linter shall 新たなエラーを報告しない
3. The リポジトリ shall `local-batch` モジュールへの import/require 参照を含まない（スペックドキュメントを除く）
