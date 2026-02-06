# Requirements Document

## Project Description (Input)
現在 `.kiro/specs/apply-domain-model/requirements.md` に則って、仮データから実データへ変換できるようにJSソースを修正しました。しかし、まだAzureにデプロイしておらず、実データへの変換・置換も未実施です。そこでまずはローカルの `frontend/dashboard/public/data/index.json` などを `datasample` 配下のファイルから変換した実データで置き換えて、動作確認を行います。その際、CSVから変換するJSを呼び出してローカルで変換できるようにしたいです。可能ですか？

## Introduction
本機能は、ローカル環境で `datasample` 配下の実データを入力に変換フローを実行し、ダッシュボード公開JSONを実データへ置換したうえで画面動作を検証できる状態を定義する。

## Requirements

### Requirement 1: ローカル変換フローの起動
**Objective:** As a 開発者, I want ローカルで実データ変換フローを起動できること, so that Azureデプロイ前に変換処理の成立性を確認できる

#### Acceptance Criteria
1. When 開発者がローカル変換フローを実行した時, the StudyLog Local Data Pipeline shall `datasample` 配下の対象データを入力として取り込む
2. When 入力にCSVファイルが含まれる時, the StudyLog Local Data Pipeline shall 既存のCSV変換JavaScriptを呼び出して必要なJSONを生成する
3. If 変換に必要な入力ファイルが不足している場合, the StudyLog Local Data Pipeline shall 不足ファイルを特定したエラーを返して処理を中止する
4. The StudyLog Local Data Pipeline shall ローカル環境のみで変換処理を完結させる

### Requirement 2: フロントエンド公開データの置換
**Objective:** As a 開発者, I want 変換済み実データで公開JSONを置換できること, so that ダッシュボード表示を本番想定データで検証できる

#### Acceptance Criteria
1. When 変換が成功した時, the StudyLog Local Data Pipeline shall `frontend/dashboard/public/data` 配下の対象JSON（例: `index.json`）を実データで更新する
2. The StudyLog Local Data Pipeline shall 置換後JSONをフロントエンドが期待するデータ契約に適合させる
3. If いずれかの出力JSONの更新に失敗した場合, the StudyLog Local Data Pipeline shall 失敗したファイルを特定して不完全な置換状態を残さない
4. While 複数ファイルを更新している間, the StudyLog Local Data Pipeline shall 更新対象ごとの成功/失敗状態を追跡可能にする

### Requirement 3: 変換結果の検証可能性
**Objective:** As a 開発者, I want 生成されたJSONの品質をローカルで検証できること, so that 表示崩れや集計不整合を事前に検出できる

#### Acceptance Criteria
1. When JSON生成が完了した時, the StudyLog Local Data Pipeline shall 必須項目の欠落有無を検証する
2. If 生成データが必須スキーマを満たさない場合, the StudyLog Local Data Pipeline shall 検証エラーを報告して当該データを採用しない
3. The StudyLog Local Data Pipeline shall 集計値と明細値の整合性を検証できる結果情報を出力する
4. Where 検証エラーが存在する場合, the StudyLog Local Data Pipeline shall エラー箇所をファイル単位で提示する

### Requirement 4: ローカル画面動作確認
**Objective:** As a 開発者, I want 置換後データで画面動作を確認できること, so that 実データ移行後のユーザー体験を事前に確認できる

#### Acceptance Criteria
1. When 開発者がローカルでダッシュボード画面を開いた時, the StudyLog Frontend shall 置換後の `public/data` 配下JSONを読み込んで一覧表示する
2. When 開発者がドリルダウン対象を選択した時, the StudyLog Frontend shall 対応する詳細データを表示する
3. If 参照先JSONが欠落または不正な場合, the StudyLog Frontend shall 問題内容を示すエラーメッセージを表示する
4. The StudyLog Frontend shall ローカル動作確認に必要な最小画面遷移（一覧表示と詳細表示）を成立させる

### Requirement 5: 実行結果のレポーティング
**Objective:** As a 開発者, I want 変換実行結果を即時に把握できること, so that 失敗時の再試行や修正判断を迅速に行える

#### Acceptance Criteria
1. When ローカル変換フローが終了した時, the StudyLog Local Data Pipeline shall 実行結果を成功/失敗で明示する
2. The StudyLog Local Data Pipeline shall 更新対象ファイル一覧と処理件数を出力する
3. If 一部の変換または置換のみが失敗した場合, the StudyLog Local Data Pipeline shall 成功分と失敗分を分離して報告する
4. While エラーが解消されるまで, the StudyLog Local Data Pipeline shall 同一入力に対して再実行可能である



