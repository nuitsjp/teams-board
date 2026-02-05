# Implementation Plan

- [x] 1. (P) ダミーデータ生成スクリプトの作成
  - 検証用のダミーデータを一括生成するシェルスクリプトを作成する
  - 5件以上のダッシュボードアイテム（売上、アクセス、在庫、勤怠、プロジェクト進捗など業務系データを模擬）を生成し、各アイテムにid・title・summary（3項目以上）を含める
  - 各アイテムの詳細JSONをdata配列を含む構造で生成する
  - index.jsonにはISO 8601形式のupdatedAtタイムスタンプを設定する
  - 出力先はfrontend/dashboard/public/data/配下とし、既存データを上書きする
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. (P) Deploy-StaticFiles.ps1のsrc/ディレクトリ対応
  - main.jsのESモジュールimportが../src/を参照しており、src/ディレクトリもBlobにデプロイする必要があるため、デプロイスクリプトを修正する
  - SourcePathパラメータを配列（SourcePaths）に拡張し、public/とsrc/の両方を指定可能にする
  - src/配下のファイルはBlob上のsrc/パスにアップロードし、.jsファイルにはapplication/javascript; charset=utf-8のContent-Typeを設定する
  - 後方互換性のため既存のSourcePathパラメータも引き続き動作するようにする
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Blobデプロイの実行と基本リソース検証
- [x] 3.1 public/とsrc/のBlobデプロイ実行
  - ダミーデータ生成スクリプトを実行してデータファイルを生成する
  - az cliでpublic/配下の全ファイルを$webコンテナのルートにアップロードする
  - az cliでsrc/配下の全ファイルを$webコンテナのsrc/パスにアップロードする
  - 各ファイルのContent-Typeを拡張子に基づいて適切に設定する（json→application/json、js→application/javascript、html→text/html、css→text/css）
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.2 基本リソースのHTTPステータス検証
  - 静的サイトエンドポイントのルート（/）にアクセスしてindex.htmlがHTTP 200で返却されることを確認する
  - data/index.jsonエンドポイントがHTTP 200で正しいJSON構造（items配列、5件以上）を返却することを確認する
  - 各data/items/{id}.jsonエンドポイントが詳細データを正しく返却することを確認する
  - src/core/auth-manager.jsなどのESモジュールファイルがHTTP 200でアクセス可能なことを確認する
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. ダッシュボード表示とドリルダウンのE2E検証
- [x] 4.1 ダッシュボード一覧表示の動作検証
  - 静的サイトのルートURLにアクセスした際にDataFetcherがindex.jsonを取得し、全アイテムがカード形式で一覧表示されることを確認する
  - 各カードにアイテムのタイトルとsummary情報が表示されていることを確認する
  - ページ読み込み時にローディング表示を経てからデータが描画されることを確認する
  - index.jsonの取得に失敗するケース（存在しないパス等）でエラーメッセージが表示されることを確認する
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4.2 ドリルダウン詳細表示の動作検証
  - アイテムカードをクリックした際にハッシュが#/items/{itemId}に変更され、DetailViewに遷移することを確認する
  - DetailViewがdata/items/{itemId}.jsonを取得し、タイトルとデータテーブルを表示することを確認する
  - 「一覧へ戻る」リンクをクリックした際にダッシュボード一覧表示に戻ることを確認する
  - 存在しないアイテムIDでアクセスした際にエラーメッセージと「一覧へ戻る」リンクが表示されることを確認する
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4.3 CORS・データ整合性の総合検証
  - Originヘッダー付きリクエストでCORSヘッダー（Access-Control-Allow-Origin等）が正しく返却されることを確認する
  - デプロイしたダミーデータとBlobから取得したデータの整合性を確認する（件数、id一致）
  - 全検証結果をサマリーとして出力する（各エンドポイントのステータス、データ件数、CORS設定）
  - _Requirements: 5.4, 5.5_

