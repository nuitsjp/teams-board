## ADDED Requirements

### Requirement: index.json の TTL ベースキャッシュ
DataFetcher は `fetchIndex()` の成功レスポンスをインメモリキャッシュに保存し、TTL（デフォルト 30,000ms）以内の再リクエストではキャッシュから返却する。TTL 超過時はネットワークから再取得してキャッシュを更新する。失敗レスポンス（`ok: false`）はキャッシュしない。

#### Scenario: TTL 内のキャッシュヒット
- **WHEN** `fetchIndex()` が成功した後、TTL 以内に再度 `fetchIndex()` が呼ばれる
- **THEN** ネットワークリクエストを発行せず、キャッシュされたデータを返却する

#### Scenario: TTL 超過後のキャッシュミス
- **WHEN** `fetchIndex()` が成功した後、TTL を超過してから再度 `fetchIndex()` が呼ばれる
- **THEN** 新しいネットワークリクエストを発行し、キャッシュを更新する

#### Scenario: 失敗レスポンスの非キャッシュ
- **WHEN** `fetchIndex()` がエラーレスポンス（HTTP エラーまたはネットワークエラー）を返した
- **THEN** そのレスポンスをキャッシュに保存しない
- **THEN** 次回の `fetchIndex()` 呼び出しはネットワークリクエストを発行する

### Requirement: セッション JSON の永続キャッシュ
DataFetcher は `fetchSession(sessionId)` の成功レスポンスをインメモリキャッシュに保存し、同一 sessionId の再リクエストでは常にキャッシュから返却する。セッション JSON は不変リソースのため、TTL は設けない。失敗レスポンス（`ok: false`）はキャッシュしない。

#### Scenario: セッションデータのキャッシュヒット
- **WHEN** `fetchSession('abc12345')` が成功した後、再度 `fetchSession('abc12345')` が呼ばれる
- **THEN** ネットワークリクエストを発行せず、キャッシュされたデータを返却する

#### Scenario: 異なるセッション ID はキャッシュミス
- **WHEN** `fetchSession('abc12345')` が成功した後、`fetchSession('def67890')` が呼ばれる
- **THEN** `def67890` に対して新しいネットワークリクエストを発行する

#### Scenario: セッション取得失敗時の非キャッシュ
- **WHEN** `fetchSession(sessionId)` がエラーレスポンスを返した
- **THEN** そのレスポンスをキャッシュに保存しない
- **THEN** 同一 sessionId の次回呼び出しはネットワークリクエストを発行する

### Requirement: 同一 URL リクエストの重複排除
DataFetcher は同一 URL に対する同時リクエストを 1 つの Promise に統合する。最初のリクエストが完了するまで、同じ URL への追加リクエストは新しい fetch を発行せず、最初のリクエストの Promise を共有する。Promise が解決した後、inflight エントリは削除される。

#### Scenario: 同時リクエストの統合
- **WHEN** `fetchSession('abc12345')` が応答を待っている間に、再度 `fetchSession('abc12345')` が呼ばれる
- **THEN** 2 回目の呼び出しは新しい fetch を発行しない
- **THEN** 両方の呼び出しが同一の結果を受け取る

#### Scenario: 順次リクエストは別々に処理
- **WHEN** `fetchSession('abc12345')` が完了した後に、再度 `fetchSession('abc12345')` が呼ばれる（キャッシュが無い場合）
- **THEN** 新しい fetch リクエストを発行する

#### Scenario: 異なる URL は重複排除しない
- **WHEN** `fetchSession('abc12345')` と `fetchSession('def67890')` が同時に呼ばれる
- **THEN** それぞれ別々の fetch リクエストを発行する

### Requirement: TTL のコンストラクタ設定
DataFetcher のコンストラクタは `indexTtl` オプションを受け取り、`index.json` キャッシュの TTL（ミリ秒）を設定できる。省略時はデフォルト値 30,000ms を使用する。

#### Scenario: カスタム TTL の指定
- **WHEN** `new DataFetcher({ indexTtl: 5000 })` でインスタンスを作成する
- **THEN** `index.json` のキャッシュ TTL が 5,000ms になる

#### Scenario: デフォルト TTL の使用
- **WHEN** `new DataFetcher()` でインスタンスを作成する
- **THEN** `index.json` のキャッシュ TTL がデフォルトの 30,000ms になる

### Requirement: 公開 API の後方互換性
DataFetcher の公開メソッド `fetchIndex()` と `fetchSession(sessionId)` の戻り値の型（`Promise<{ok: true, data: object} | {ok: false, error: string}>`）は変更しない。既存の呼び出し元コードは修正不要で動作する。

#### Scenario: fetchIndex の戻り値型が維持される
- **WHEN** キャッシュ導入後に `fetchIndex()` を呼び出す
- **THEN** 戻り値は `{ ok: true, data: object }` または `{ ok: false, error: string }` のいずれかである

#### Scenario: fetchSession の戻り値型が維持される
- **WHEN** キャッシュ導入後に `fetchSession(sessionId)` を呼び出す
- **THEN** 戻り値は `{ ok: true, data: object }` または `{ ok: false, error: string }` のいずれかである
