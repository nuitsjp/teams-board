# Requirements Document

## Introduction
Azure Blob Storage静的サイトにデプロイ済みのダッシュボードアプリケーションが、正しくBlobからインデックス情報を取得し、一覧表示（ダッシュボード）とドリルダウン（詳細表示）を行えることを検証する。検証用のダミーデータを自動生成・登録し、E2Eでのアーキテクチャ正当性を確認する。

## Requirements

### Requirement 1: ダミーデータの自動生成
**Objective:** As a 開発者, I want ダッシュボード検証に十分なダミーデータを自動生成できること, so that 手作業なしで検証環境を構築できる

#### Acceptance Criteria
1. The ダミーデータ生成スクリプト shall `index.json`と対応する個別アイテムJSONファイルを一括生成する
2. The ダミーデータ生成スクリプト shall 5件以上のダッシュボードアイテムを生成し、各アイテムに`id`、`title`、`summary`（3項目以上のキー・値ペア）を含める
3. The ダミーデータ生成スクリプト shall 各アイテムの詳細JSON（`data/items/{id}.json`）を生成し、`data`フィールドに配列データ（`内訳`等）を含む構造にする
4. The ダミーデータ生成スクリプト shall `index.json`の`updatedAt`フィールドにISO 8601形式のタイムスタンプを設定する
5. When ダミーデータ生成スクリプトを実行した場合, the スクリプト shall `frontend/dashboard/public/data/`配下にファイルを出力する

### Requirement 2: ダミーデータのBlobへのデプロイ
**Objective:** As a 開発者, I want 生成したダミーデータをAzure Blob Storageに自動デプロイできること, so that 静的サイト上で実際のデータ取得フローを検証できる

#### Acceptance Criteria
1. The デプロイ処理 shall 生成したダミーデータファイル（`index.json`および全`items/*.json`）を`$web`コンテナの適切なパスにアップロードする
2. The デプロイ処理 shall 各JSONファイルに`application/json; charset=utf-8`のContent-Typeを設定する
3. The デプロイ処理 shall 既存の`Deploy-StaticFiles.ps1`スクリプトまたは同等のaz cliコマンドで実行可能とする

### Requirement 3: ダッシュボード一覧表示の検証
**Objective:** As a 開発者, I want ダッシュボードのトップ画面がBlobから取得したindex.jsonの内容を正しく一覧表示していることを確認できること, so that DataFetcher→DashboardViewのデータフローが正しく動作していることを検証できる

#### Acceptance Criteria
1. When 静的サイトエンドポイントのルートURL（`/`）にアクセスした場合, the ダッシュボード shall `data/index.json`を取得し、全アイテムをカード形式で一覧表示する
2. The 各アイテムカード shall アイテムの`title`と`summary`の内容を表示する
3. If `data/index.json`の取得に失敗した場合, the ダッシュボード shall エラーメッセージを表示する
4. When ページを読み込んだ場合, the ダッシュボード shall ローディング表示を経てからデータを描画する

### Requirement 4: ドリルダウン詳細表示の検証
**Objective:** As a 開発者, I want ダッシュボードからアイテムをクリックして詳細画面に遷移し、個別のJSONデータが正しく表示されることを確認できること, so that Router→DetailView→DataFetcherのデータフローが正しく動作していることを検証できる

#### Acceptance Criteria
1. When アイテムカードをクリックした場合, the アプリケーション shall ハッシュを`#/items/{itemId}`に変更し、DetailViewに遷移する
2. The DetailView shall `data/items/{itemId}.json`を取得し、タイトルとデータテーブルを表示する
3. When 「一覧へ戻る」リンクをクリックした場合, the アプリケーション shall ダッシュボード一覧表示に戻る
4. If アイテムの詳細JSONの取得に失敗した場合, the DetailView shall エラーメッセージと「一覧へ戻る」リンクを表示する

### Requirement 5: E2Eアーキテクチャ検証
**Objective:** As a 開発者, I want デプロイ済みの静的サイトに対してcurlまたはブラウザアクセスで動作確認できること, so that Blobからの実データ取得→表示の全フローが正しいことを確認できる

#### Acceptance Criteria
1. The 検証手順 shall 静的サイトエンドポイントに対するHTTPリクエストでindex.htmlが正しく返却されることを確認する
2. The 検証手順 shall `data/index.json`エンドポイントが正しいJSONデータを返却し、生成したダミーデータと一致することを確認する
3. The 検証手順 shall 各`data/items/{id}.json`エンドポイントが正しいJSONデータを返却することを確認する
4. The 検証手順 shall CORSヘッダーが設定されており、静的サイトオリジンからのfetchリクエストがブロックされないことを確認する
5. When 全検証が成功した場合, the 検証結果 shall 各エンドポイントの応答ステータスとデータ整合性をサマリーとして出力する
