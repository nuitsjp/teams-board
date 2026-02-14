## ADDED Requirements

### Requirement: Docs deployment workflow supports explicit execution modes

ドキュメント配信ワークフローは、preview実行とproduction実行を明示的に識別できなければならない（SHALL）。各モードは実行条件と実行ステップを分離して定義しなければならない（SHALL）。

#### Scenario: Pull Requestではpreviewモードのみ実行される

- **WHEN** ドキュメント関連変更を含むPull Requestが作成または更新される
- **THEN** preview向けのビルドと配信のみが実行され、production向け処理は実行されない

#### Scenario: mainへのpushでproductionモードが実行される

- **WHEN** mainブランチへのpushが発生する
- **THEN** production向けビルドと配信処理が実行される

### Requirement: Docs deployment trigger conditions are optimized

ドキュメント配信ワークフローは、ドキュメント配信に関係するファイル変更時のみ自動実行されなければならない（SHALL）。対象外変更では実行してはならない（SHALL NOT）。

#### Scenario: docs配下の変更でワークフローが発火する

- **WHEN** `docs/**` 配下のファイルが変更される
- **THEN** ドキュメント配信ワークフローが発火する

#### Scenario: アプリコードのみ変更時にドキュメント配信が発火しない

- **WHEN** `src/**` のみが変更され、ドキュメント配信対象ファイルに変更がない
- **THEN** ドキュメント配信ワークフローは発火しない

#### Scenario: 手動実行トリガーが存在しない

- **WHEN** ドキュメント配信ワークフローのトリガー定義を確認する
- **THEN** `workflow_dispatch` は定義されていない

### Requirement: Docs deployment reuses shared setup contract

ドキュメント配信ワークフローでNode.js、pnpm、uvのセットアップを行う場合、共通化されたセットアップ契約を再利用しなければならない（SHALL）。

#### Scenario: ドキュメント配信が共通セットアップを参照する

- **WHEN** ドキュメント配信ワークフローのセットアップ手順を確認する
- **THEN** Node.js、pnpm、uvの準備は共通化された定義を利用している

#### Scenario: 共通セットアップ変更がドキュメント配信にも反映される

- **WHEN** 共通セットアップ定義を更新する
- **THEN** ドキュメント配信ワークフローにも同じ更新内容が反映される

### Requirement: Docs deployment runs textlint first and fails fast

ドキュメント配信ワークフローは、ビルドやデプロイの前に `pnpm run lint:text` を実行しなければならない（SHALL）。textlintが失敗した場合、後続ステップを実行せずに中断しなければならない（SHALL）。

#### Scenario: ドキュメント配信の冒頭でtextlintが実行される

- **WHEN** ドキュメント配信ワークフローが開始される
- **THEN** サイトビルドより前に `pnpm run lint:text` が実行される

#### Scenario: textlint失敗時にビルドとデプロイが実行されない

- **WHEN** `pnpm run lint:text` がエラーで終了する
- **THEN** サイトビルドとデプロイの後続ステップは実行されず、ワークフローは失敗として終了する
