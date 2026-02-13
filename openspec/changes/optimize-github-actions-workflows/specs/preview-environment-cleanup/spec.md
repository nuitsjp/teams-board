## ADDED Requirements

### Requirement: Preview cleanup runs only on PR close events

プレビュー環境クリーンアップワークフローは、Pull Requestのクローズイベント時のみ発火しなければならない（SHALL）。通常のpushやPR更新イベントでは発火してはならない（SHALL NOT）。

#### Scenario: PRクローズ時にクリーンアップが発火する

- **WHEN** Pull Requestがclosedになる
- **THEN** プレビュー環境クリーンアップワークフローが発火する

#### Scenario: pushやPR更新でクリーンアップが発火しない

- **WHEN** Pull Requestのsynchronizeイベントまたは通常のpushが発生する
- **THEN** プレビュー環境クリーンアップワークフローは発火しない

### Requirement: Preview cleanup is idempotent and failure-tolerant

プレビュー環境クリーンアップワークフローは、対象プレビューがすでに存在しない場合でも失敗で停止しないように設計されなければならない（SHALL）。同一PRに対する再実行でも安全に完了しなければならない（SHALL）。

#### Scenario: 既にクローズ済みプレビューに対する再実行が成功する

- **WHEN** 同一PRに対してクリーンアップワークフローを再実行する
- **THEN** ワークフローは冪等に完了し、エラーで停止しない

#### Scenario: クリーンアップ対象が存在しない場合でもワークフローが完了する

- **WHEN** 対応するプレビュー環境が既に削除されている
- **THEN** ワークフローは失敗せず完了する

### Requirement: Preview cleanup execution scope is constrained

プレビュー環境クリーンアップワークフローは、必要最小限の権限とコンテキストで実行されなければならない（SHALL）。不要なリポジトリ書き込み権限や外部入力の利用を行ってはならない（SHALL NOT）。

#### Scenario: クリーンアップに不要な書き込み権限が付与されない

- **WHEN** ワークフローのpermissions定義を確認する
- **THEN** クリーンアップ実行に不要な権限は付与されていない

#### Scenario: 実行対象の判定がPRクローズイベント情報で完結する

- **WHEN** クリーンアップ対象の決定ロジックを確認する
- **THEN** 判定はPRクローズイベント由来の情報で行われ、不要な外部入力に依存しない
