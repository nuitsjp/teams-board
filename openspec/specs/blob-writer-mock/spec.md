## ADDED Requirements

### Requirement: 開発環境でのBlobWriter動作のモック化

開発環境（`import.meta.env.DEV === true`）かつダミートークン（`token === "dev"`）を使用している場合、BlobWriterは実際のAzure Blob Storageへのリクエストを送信せず、ローカルの`dev-fixtures/data/`ディレクトリに書き込まなければならない（MUST）。

#### Scenario: 開発環境でのindex.json書き込み

- **WHEN** 開発環境でダミートークン使用中に`BlobWriter.putBlob("data/index.json", indexData)`を実行する
- **THEN** 実際のAzure Blob Storage APIにHTTPリクエストを送信しない
- **THEN** `dev-fixtures/data/index.json`にデータが書き込まれる
- **THEN** 成功レスポンス（`{ success: true }`）が返される

#### Scenario: 開発環境でのsessionファイル書き込み

- **WHEN** 開発環境でダミートークン使用中に`BlobWriter.putBlob("data/sessions/abc12345.json", sessionData)`を実行する
- **THEN** `dev-fixtures/data/sessions/abc12345.json`にデータが書き込まれる
- **THEN** ディレクトリが存在しない場合は自動的に作成される

#### Scenario: 本番環境では通常の動作

- **WHEN** 本番ビルド環境でBlobWriterを使用する
- **THEN** 実際のAzure Blob Storage APIにHTTPリクエストを送信する
- **THEN** ローカルファイルシステムへの書き込みは行わない

### Requirement: Viteプラグインによる書き込み処理

ブラウザ環境から`dev-fixtures/data/`への書き込みは、Viteプラグインを経由して行わなければならない（MUST）。

#### Scenario: BlobWriterからViteプラグインへのリクエスト

- **WHEN** 開発環境でダミートークン使用中にBlobWriterが書き込みを試みる
- **THEN** BlobWriterが`POST /dev-fixtures-write`エンドポイントにリクエストを送信する
- **THEN** リクエストボディに`{ path: "data/index.json", data: {...} }`が含まれる

#### Scenario: Viteプラグインでのファイル書き込み

- **WHEN** Viteプラグインが`POST /dev-fixtures-write`リクエストを受信する
- **THEN** `dev-fixtures/<path>`にファイルを書き込む
- **THEN** ディレクトリが存在しない場合は自動作成する
- **THEN** 成功時に`{ success: true }`を返す
- **THEN** エラー時に`{ success: false, error: "..." }`を返す

### Requirement: 実際のSASトークン使用時の通常動作

開発環境において実際のAzure Blob Storage SASトークンを使用している場合、BlobWriterは通常通りAzure Blob Storageに書き込まなければならない（MUST）。

#### Scenario: 実際のSASトークンでの書き込み

- **WHEN** 開発環境で`?token=<valid-sas-token>`を使用してBlobWriterを実行する
- **THEN** 実際のAzure Blob Storage APIにHTTPリクエストを送信する
- **THEN** ローカルファイルシステムへの書き込みは行わない

### Requirement: エラーハンドリング

開発環境でのモック書き込みが失敗した場合、適切なエラーメッセージを返さなければならない（MUST）。

#### Scenario: ディレクトリ作成の失敗

- **WHEN** Viteプラグインが`dev-fixtures/data/sessions/`ディレクトリを作成できない（権限エラーなど）
- **THEN** `{ success: false, error: "ディレクトリの作成に失敗しました" }`を返す
- **THEN** BlobWriterがエラーを呼び出し元に伝播させる

#### Scenario: ファイル書き込みの失敗

- **WHEN** Viteプラグインが`dev-fixtures/data/index.json`への書き込みに失敗する（ディスク容量不足など）
- **THEN** `{ success: false, error: "ファイルの書き込みに失敗しました" }`を返す
- **THEN** コンソールにエラーログを出力する

### Requirement: 開発者への通知

開発環境でモック動作を使用している際、開発者にその旨を明確に通知しなければならない（MUST）。

#### Scenario: モック動作の警告表示

- **WHEN** 開発環境でダミートークン使用中にBlobWriterが初めて呼び出される
- **THEN** コンソールに「[開発モード] BlobWriterはdev-fixtures/data/に書き込みます」という情報メッセージが表示される
- **THEN** この警告は1回のみ表示される（重複しない）

### Requirement: DataFetcherとの統合

開発環境で書き込まれたデータは、DataFetcherで読み込めなければならない（MUST）。

#### Scenario: 書き込み後の読み込み

- **WHEN** 開発環境でダミートークン使用中に`index.json`を書き込む
- **THEN** `dev-fixtures/data/index.json`にファイルが作成される
- **THEN** DataFetcherが`/data/index.json`をリクエストする
- **THEN** Viteプラグイン（`serveDevFixtures`）が`dev-fixtures/data/index.json`を返す
- **THEN** 書き込んだデータが正しく読み込まれる

### Requirement: JSON形式の保持

書き込まれるファイルは、読みやすいJSON形式（インデント付き）で保存されなければならない（MUST）。

#### Scenario: JSON形式での保存

- **WHEN** Viteプラグインが`dev-fixtures/data/index.json`に書き込む
- **THEN** `JSON.stringify(data, null, 2)`を使用してインデント付きで保存される
- **THEN** 開発者が手動でファイルを確認・編集できる

### Requirement: Tree-shakingによるコード除去

本番ビルドには、モック動作のコードが含まれてはならない（MUST NOT）。

#### Scenario: 本番ビルドでのコード除去

- **WHEN** `pnpm run build`で本番ビルドを実行する
- **THEN** `import.meta.env.DEV`が静的に評価される
- **THEN** モック動作のコード（Viteプラグインへのリクエスト処理など）がビルド結果から除去される
- **THEN** ビルドサイズが増加しない

### Requirement: 既存のserveDevFixturesプラグインとの統合

新しい書き込み機能は、既存の`serveDevFixtures`プラグイン（`vite.config.js`）を拡張して実装しなければならない（MUST）。

#### Scenario: GETリクエストの継続サポート

- **WHEN** 開発環境でDataFetcherが`GET /data/index.json`をリクエストする
- **THEN** `serveDevFixtures`プラグインが引き続き`dev-fixtures/data/index.json`を返す
- **THEN** 既存の読み込み機能が影響を受けない

#### Scenario: POSTリクエストの新規サポート

- **WHEN** 開発環境でBlobWriterが`POST /dev-fixtures-write`をリクエストする
- **THEN** `serveDevFixtures`プラグインが新しいハンドラでこのリクエストを処理する
- **THEN** ファイルシステムへの書き込みを実行する
