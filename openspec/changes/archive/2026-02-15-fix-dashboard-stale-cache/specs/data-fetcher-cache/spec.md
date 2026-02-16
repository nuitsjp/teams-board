## MODIFIED Requirements

### Requirement: index.json の TTL ベースキャッシュ

DataFetcher は `fetchIndex()` の成功レスポンスをインメモリキャッシュに保存し、TTL（デフォルト 30,000ms）以内の再リクエストではキャッシュから返却しなければならない（SHALL）。TTL 超過時はネットワークから再取得してキャッシュを更新しなければならない（SHALL）。失敗レスポンス（`ok: false`）はキャッシュしない。  
また、DataFetcher は `index.json` キャッシュを明示的に無効化する手段を提供しなければならない（MUST）。明示的に無効化された後の次回 `fetchIndex()` は、TTL 内であってもネットワークリクエストを発行しなければならない（MUST）。

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

#### Scenario: 明示的無効化後の再取得

- **WHEN** `fetchIndex()` が成功して TTL 内キャッシュが存在する状態で `invalidateIndexCache()` が呼ばれる
- **THEN** 次回の `fetchIndex()` は TTL 内であっても新しいネットワークリクエストを発行する
- **THEN** 取得成功時に新しいレスポンスでキャッシュを更新する

### Requirement: 公開 API の後方互換性

DataFetcher の公開メソッド `fetchIndex()` と `fetchSession(sessionId)` の戻り値の型（`Promise<{ok: true, data: object} | {ok: false, error: string}>`）は変更してはならない（MUST NOT）。既存の呼び出し元コードは修正不要で動作しなければならない（SHALL）。  
DataFetcher は追加の公開メソッド `invalidateIndexCache()` を提供し、既存の `fetchIndex()` / `fetchSession()` 利用を破壊してはならない（MUST NOT）。

#### Scenario: fetchIndex の戻り値型が維持される

- **WHEN** キャッシュ導入後に `fetchIndex()` を呼び出す
- **THEN** 戻り値は `{ ok: true, data: object }` または `{ ok: false, error: string }` のいずれかである

#### Scenario: fetchSession の戻り値型が維持される

- **WHEN** キャッシュ導入後に `fetchSession(sessionId)` を呼び出す
- **THEN** 戻り値は `{ ok: true, data: object }` または `{ ok: false, error: string }` のいずれかである

#### Scenario: invalidateIndexCache 追加後も既存呼び出しは動作する

- **WHEN** `invalidateIndexCache()` を呼び出した後に `fetchIndex()` と `fetchSession(sessionId)` を呼び出す
- **THEN** 既存メソッドは従来どおりの戻り値型で結果を返す
