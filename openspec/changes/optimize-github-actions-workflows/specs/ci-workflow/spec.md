## ADDED Requirements

### Requirement: CI workflow has single responsibility

CIワークフローは品質検証ジョブのみを含まなければならない（SHALL）。デプロイ、プレビュー環境操作、環境クローズのような配信系ジョブを含んではならない（SHALL NOT）。

#### Scenario: CI定義に配信系ジョブが存在しない

- **WHEN** CIワークフロー定義を確認する
- **THEN** lint/test/buildなどの品質検証ジョブのみが定義され、deploy系ジョブは存在しない

#### Scenario: PR向けCI実行で品質検証のみが実行される

- **WHEN** mainブランチ向けPull RequestでCIワークフローが発火する
- **THEN** 品質検証ジョブだけが実行され、デプロイ処理は実行されない

### Requirement: CI jobs reuse shared setup

CIワークフロー内でNode.js、pnpm、uvのセットアップを必要とするジョブは、共通化されたセットアップ手段を再利用しなければならない（SHALL）。ジョブごとに独立した重複セットアップ定義を持ってはならない（SHALL NOT）。

#### Scenario: 複数ジョブが同一のセットアップ定義を参照する

- **WHEN** CIワークフロー内のlint/test/buildジョブ定義を確認する
- **THEN** 各ジョブは同一の共通セットアップ定義を再利用している

#### Scenario: セットアップ更新が一箇所で反映される

- **WHEN** 共通セットアップのNode.jsバージョンを更新する
- **THEN** CIワークフロー内のすべての品質検証ジョブで同じ更新内容が適用される

### Requirement: CI result can be used as deployment gate

CIワークフローは、lint/test/buildジョブの総合結果をデプロイ可否判定に利用できる形で提供しなければならない（SHALL）。

#### Scenario: すべてのジョブ成功時にCI成功として判定される

- **WHEN** lint、test、buildの3ジョブがすべて成功する
- **THEN** CIワークフローは成功と判定され、後続デプロイのゲート条件を満たす

#### Scenario: いずれかのジョブ失敗時にCI失敗として判定される

- **WHEN** lint、test、buildのいずれか1つ以上が失敗する
- **THEN** CIワークフローは失敗と判定され、後続デプロイのゲート条件を満たさない
