# Requirements Document

## Introduction

本リポジトリは現在 `frontend/dashboard/` 配下にReact SPAのコードが格納されているが、backendが不要で単一フロントエンドアプリケーションしか存在しないにもかかわらず、`frontend/dashboard/` という2階層の入れ子構造を持っている。これを解消し、開発体験・可読性・保守性を最大化するための構造再設計を行う。

### 現状の問題点
- `frontend/dashboard/` の2階層ネストは、単一アプリ構成において冗長
- `backend/` ディレクトリが存在するが未使用で、monorepo的な構造だけが残っている
- `scripts/`（Azure運用）と `frontend/dashboard/scripts/`（ローカルバッチ実行）の名称が重複
- `frontend/dashboard/local-batch/` がsrc外のトップレベルに配置されており、ソースコードの境界が不明瞭
- `data/sample/` がリポジトリルートにあるが、利用するのはdashboardのローカルバッチのみ
- GitHub Actions、package.json等がすべて `frontend/dashboard/` 基準で動作しており、プロジェクトルートとアプリケーションルートが不一致

## Requirements

### Requirement 1: ディレクトリ階層の平坦化

**Objective:** 開発者として、`frontend/dashboard/` の2階層ネストを解消し、アプリケーションコードをルート直下で管理したい。それにより、パス指定の簡素化とプロジェクト構造の直感的な理解を実現する。

#### Acceptance Criteria
1. The リポジトリ shall `frontend/` および `frontend/dashboard/` の中間ディレクトリを排除し、アプリケーションコードをルート直下に配置する
2. When ディレクトリ構造を平坦化した後、the リポジトリ shall `package.json`、`vite.config.js`、`index.html` 等のプロジェクト設定ファイルがルート直下に存在する状態とする
3. The リポジトリ shall `src/` ディレクトリをアプリケーションソースコードの唯一のルートとして維持する（`src/components/`, `src/pages/`, `src/hooks/`, `src/services/`, `src/utils/`）
4. The リポジトリ shall 現在の `frontend/dashboard/src/` 内の全ファイルを `src/` へ移動し、内部構造（components, pages, hooks, services, utils）を変更しない

### Requirement 2: テストディレクトリの配置

**Objective:** 開発者として、テストコードの配置がソースコードとの対応関係を保ちつつ、ビルド対象と明確に分離されていることを確認したい。

#### Acceptance Criteria
1. The リポジトリ shall `tests/` ディレクトリをルート直下に配置する
2. The リポジトリ shall `tests/` 配下で現在のサブディレクトリ構造（`data/`, `fixtures/`, `integration/`, `local-batch/`, `logic/`, `react/`）を維持する
3. When Vitestを実行した場合、the テストランナー shall `tests/**/*.test.{js,jsx}` パターンで全テストを検出・実行できる
4. The リポジトリ shall E2Eテスト（`e2e/`）をルート直下に配置し、ユニットテスト（`tests/`）と分離する

### Requirement 3: 不要ディレクトリの削除

**Objective:** 開発者として、使用されていないディレクトリやファイルを削除し、リポジトリの見通しを良くしたい。

#### Acceptance Criteria
1. The リポジトリ shall `backend/` ディレクトリを削除する
2. The リポジトリ shall `frontend/` ディレクトリを完全に削除する（コンテンツ移動後）
3. If `frontend/staticwebapp.config.json` が引き続き必要な場合、the リポジトリ shall 当ファイルをルート直下へ移動する

### Requirement 4: ローカルバッチおよびスクリプトの再配置

**Objective:** 開発者として、ローカルバッチ処理コードとAzure運用スクリプトの配置場所を整理し、それぞれの役割を明確にしたい。

#### Acceptance Criteria
1. The リポジトリ shall 現在の `frontend/dashboard/local-batch/` を `src/local-batch/` へ移動し、アプリケーションソースコードの一部として管理する
2. The リポジトリ shall 現在の `frontend/dashboard/scripts/` を `scripts/` へ統合する
3. The リポジトリ shall ルート直下の `scripts/`（Azure運用スクリプト）を `scripts/infra/` へ移動し、ローカルバッチ実行スクリプトと区別する
4. When `npm run convert:local-data` を実行した場合、the 変換スクリプト shall 正常に動作する

### Requirement 5: データディレクトリの配置

**Objective:** 開発者として、サンプルデータと公開用データの配置場所を整理し、データフローの理解を容易にしたい。

#### Acceptance Criteria
1. The リポジトリ shall `data/sample/` をルート直下に維持する（ローカルバッチの入力ソースとして機能）
2. The リポジトリ shall `public/` ディレクトリをルート直下に配置する（Viteの静的アセット配信ディレクトリとして機能）
3. When ローカル変換バッチを実行した場合、the バッチ shall `data/sample/` から読み取り `public/data/` へ出力する

### Requirement 6: 設定ファイルの整合性

**Objective:** 開発者として、ディレクトリ構造変更後もビルド・テスト・CI/CDが正常に動作することを保証したい。

#### Acceptance Criteria
1. When `npm run build` を実行した場合、the Vite shall エラーなくビルドを完了し `dist/` にアウトプットを生成する
2. When `npm run test` を実行した場合、the Vitest shall 全テストを検出し実行できる
3. When GitHub ActionsのCIワークフローが実行された場合、the ワークフロー shall 新しいディレクトリ構造に基づいてテストとビルドを正常に完了する
4. The `vite.config.js` shall ルート直下の `src/` と `tests/` を正しく参照する
5. The `tailwind.config.js` shall ルート直下の `src/` を正しくスキャン対象とする
6. The `playwright.config.js` shall ルート直下の `e2e/` を正しく参照する

### Requirement 7: ドキュメントおよびメタファイルの配置

**Objective:** 開発者として、READMEやアーキテクチャドキュメント、AI開発支援設定がルート直下で適切に管理されていることを確認したい。

#### Acceptance Criteria
1. The リポジトリ shall `CLAUDE.md`、`AGENTS.md`、`README.md`、`LICENSE` をルート直下に維持する
2. The リポジトリ shall `docs/` ディレクトリをルート直下に維持する
3. The リポジトリ shall `.kiro/` ディレクトリをルート直下に維持する
4. When ディレクトリ構造変更後、the `README.md` shall 新しい構造を反映した内容に更新される
5. When ディレクトリ構造変更後、the `CLAUDE.md` shall パス参照を新しい構造に更新する
6. When ディレクトリ構造変更後、the `docs/architecture.md` shall 新しい構造を反映した内容に更新される

### Requirement 8: 目標ディレクトリ構造

**Objective:** 開発者として、最終的なリポジトリ構造が明確に定義され、一貫性のある設計になっていることを確認したい。

#### Acceptance Criteria
1. The リポジトリ shall 以下のトップレベル構造を持つ:
   - `src/` — アプリケーションソースコード（React SPA + ローカルバッチ）
   - `tests/` — ユニットテスト・統合テスト
   - `e2e/` — E2Eテスト
   - `public/` — Vite静的アセット
   - `data/` — サンプルデータ
   - `scripts/` — 各種スクリプト（`infra/` と バッチ実行スクリプト）
   - `docs/` — ドキュメント
   - `.kiro/` — スペック駆動開発設定
   - `.github/` — CI/CD設定
2. The リポジトリ shall ルート直下に `package.json`、`vite.config.js`、`index.html`、`tailwind.config.js`、`postcss.config.js`、`playwright.config.js` を配置する
3. The リポジトリ shall `backend/` および `frontend/` ディレクトリを含まない
