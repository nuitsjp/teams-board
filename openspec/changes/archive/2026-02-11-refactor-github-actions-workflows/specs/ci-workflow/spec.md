## ADDED Requirements

### Requirement: CI triggers on PR to main

CIワークフローは、mainブランチへのPull Request作成時および更新時に自動的に発火しなければならない（SHALL）。

#### Scenario: PR to mainでCIが発火する

- **WHEN** mainブランチへのPull Requestが作成または更新される
- **THEN** CIワークフローが自動的に開始され、test/lint/buildジョブが並列実行される

#### Scenario: 他のブランチへのPRではCIが発火しない

- **WHEN** main以外のブランチへのPull Requestが作成される
- **THEN** CIワークフローは発火しない

### Requirement: CI triggers on push to main

CIワークフローは、mainブランチへのpush時に自動的に発火しなければならない（SHALL）。

#### Scenario: mainブランチへのpushでCIが発火する

- **WHEN** mainブランチにコミットがpushされる
- **THEN** CIワークフローが自動的に開始され、test/lint/buildジョブが並列実行される

#### Scenario: feature branchへのpushでCIが発火しない（PRがない場合）

- **WHEN** feature branchにコミットがpushされるが、PRが存在しない
- **THEN** CIワークフローは発火しない

### Requirement: Path filters optimize CI execution

CIワークフローは、コードや設定ファイルに変更があった場合のみ発火しなければならない（SHALL）。対象パスは `src/**`, `tests/**`, `e2e/**`, `package.json`, `pnpm-lock.yaml`, `vite.config.js`, `.eslintrc.cjs`, `.github/workflows/ci.yml` とする。

#### Scenario: コード変更時にCIが発火する

- **WHEN** `src/` ディレクトリ内のファイルが変更されたPRが作成される
- **THEN** CIワークフローが発火する

#### Scenario: テストコード変更時にCIが発火する

- **WHEN** `tests/` または `e2e/` ディレクトリ内のファイルが変更されたPRが作成される
- **THEN** CIワークフローが発火する

#### Scenario: 設定ファイル変更時にCIが発火する

- **WHEN** `package.json`, `pnpm-lock.yaml`, `vite.config.js`, `.eslintrc.cjs` のいずれかが変更されたPRが作成される
- **THEN** CIワークフローが発火する

#### Scenario: ドキュメントのみの変更時にCIが発火しない

- **WHEN** `README.md` のみが変更されたPRが作成される
- **THEN** CIワークフローは発火しない

### Requirement: Jobs execute in parallel

test/lint/buildの3つのジョブは、互いに独立して並列実行されなければならない（SHALL）。

#### Scenario: 3ジョブが並列実行される

- **WHEN** CIワークフローが開始される
- **THEN** test, lint, buildの3ジョブが同時に開始され、互いを待たずに実行される

#### Scenario: 1つのジョブが失敗しても他のジョブは継続する

- **WHEN** testジョブが失敗する
- **THEN** lintとbuildジョブは継続して実行され、それぞれの結果を報告する

### Requirement: Concurrency controls cancel outdated runs

CIワークフローは、PR単位で実行をグループ化し、同じPRに新しいpushがあった場合は古い実行をキャンセルしなければならない（SHALL）。

#### Scenario: 新しいpushで古いCI実行がキャンセルされる

- **WHEN** PR #123に新しいコミットがpushされ、前回のCI実行がまだ進行中である
- **THEN** 前回のCI実行は自動的にキャンセルされ、新しいCI実行が開始される

#### Scenario: 異なるPRの実行は干渉しない

- **WHEN** PR #123とPR #456の両方でCIが実行されている
- **THEN** 両方のCI実行は互いに干渉せず、並行して完了する

#### Scenario: mainブランチへのpushは並列実行される

- **WHEN** mainブランチに連続して2つのコミットがpushされる
- **THEN** 両方のCI実行は並行して実行され、古い実行はキャンセルされない

### Requirement: CI workflow file is self-triggering

CIワークフロー定義ファイル（`.github/workflows/ci.yml`）自体が変更された場合、CIワークフローは発火しなければならない（SHALL）。

#### Scenario: ci.yml変更時にCIが発火する

- **WHEN** `.github/workflows/ci.yml` が変更されたPRが作成される
- **THEN** CIワークフローが発火し、変更されたワークフロー定義で実行される
