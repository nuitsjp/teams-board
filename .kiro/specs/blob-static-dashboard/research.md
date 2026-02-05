# Research & Design Decisions

---
**Purpose**: 技術設計に必要な調査結果とアーキテクチャ判断の根拠を記録する。
---

## Summary
- **Feature**: `blob-static-dashboard`
- **Discovery Scope**: New Feature（グリーンフィールド）
- **Key Findings**:
  - Azure Blob Storage REST API（PUT Blob）はブラウザから直接SASトークン付きで呼び出し可能
  - 静的サイトエンドポイント（`*.web.core.windows.net`）とBlobサービスエンドポイント（`*.blob.core.windows.net`）はアクセス制御が異なる
  - PapaParseはWeb Worker対応でギガバイト級CSVもUIブロックなしに処理可能

## Research Log

### Azure Blob Storage PUT Blob REST API
- **Context**: ブラウザJavaScriptからBlobへ直接PUTする方式の実現可能性を確認
- **Sources Consulted**: [Put Blob REST API](https://learn.microsoft.com/en-us/rest/api/storageservices/put-blob)
- **Findings**:
  - エンドポイント: `PUT https://<account>.blob.core.windows.net/<container>/<blob>?<SAS>`
  - 必須ヘッダー: `x-ms-blob-type: BlockBlob`, `Content-Type`, `x-ms-version`
  - 最新安定APIバージョン: `2025-01-05`
  - SAS使用時は`Authorization`ヘッダー不要（SASがクエリパラメータとして機能）
  - `Content-Length`はブラウザのfetch APIが自動設定
- **Implications**: ブラウザから直接PUTが可能。CORSの適切な設定が前提条件

### 静的サイトエンドポイント vs Blobサービスエンドポイント
- **Context**: 閲覧用と管理者書き込み用でエンドポイントが分かれることの確認
- **Sources Consulted**: [Static website hosting in Azure Storage](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website)
- **Findings**:
  - 静的サイト: `https://<account>.z<region>.web.core.windows.net` — 常にパブリック匿名読み取り
  - Blobサービス: `https://<account>.blob.core.windows.net/$web/<path>` — アクセスレベル設定に従う
  - `$web`コンテナは静的サイトホスティング有効化時に自動作成
  - 静的サイトエンドポイントはAuthN/AuthZ非サポート
- **Implications**: 閲覧はwebエンドポイント、書き込みはblobエンドポイント+SASで明確に分離

### CORS設定
- **Context**: ブラウザからBlobサービスエンドポイントへのPUTにCORSが必要
- **Sources Consulted**: [CORS support for Azure Storage](https://learn.microsoft.com/en-us/rest/api/storageservices/cross-origin-resource-sharing--cors--support-for-the-azure-storage-services)
- **Findings**:
  - `AllowedOrigins`: 静的サイトエンドポイントのURL
  - `AllowedMethods`: `PUT, GET, HEAD`
  - `AllowedHeaders`: `x-ms-blob-type, x-ms-blob-content-type, content-type, x-ms-version`
  - `ExposedHeaders`: `x-ms-meta-*`
  - CORSルールはサービスあたり最大5個
  - PUTの前にpreflight（OPTIONS）リクエストが発生
- **Implications**: インフラ設定としてCORSルールの事前設定が必須

### CSVパースライブラリ選定
- **Context**: ブラウザ上でCSVをパースしJSONに変換するライブラリの選定
- **Sources Consulted**: [PapaParse](https://www.papaparse.com/), npm, 各種ベンチマーク
- **Findings**:
  - PapaParse v5.x: 依存関係ゼロ、Web Worker対応（`worker: true`）、ストリーミング処理対応
  - RFC 4180準拠、自動区切り文字検出、ヘッダー行対応
  - ギガバイト級ファイルもブラウザクラッシュなしで処理可能
  - 週間DL数約70万件、最も広く使われるブラウザCSVパーサー
- **Implications**: PapaParseを採用。Web Workerモードで大規模CSVにも対応可能

### SASトークンのベストプラクティス
- **Context**: 管理者への書き込み権限付与方式の設計
- **Sources Consulted**: [SAS overview](https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview)
- **Findings**:
  - Container SAS: `$web`コンテナに対しパス制限付きで発行可能
  - 必要権限: `Write (w)` + `Create (c)` + `Read (r)`（最新index取得のためReadも必要）
  - Stored Access Policyで一元管理・失効が容易（Service SASのみ対応）
  - 有効期限は短めに設定し、期限切れ時に再配布する運用
  - HTTPS必須
- **Implications**: Container SAS + Stored Access Policyの組み合わせを推奨

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| SPA + Blob直接アクセス | 単一HTMLからfetch/PUTで完結 | 最小構成、サーバ不要、デプロイ容易 | CORS設定必須、クライアント側のみでデータ検証 | 要件に最も合致 |
| SSG + API Gateway | 静的生成 + Azure Functions等 | サーバ側検証可能 | コスト増、配置ポリシー制約 | 要件の非目標 |

## Design Decisions

### Decision: フロントエンドフレームワーク不使用（Vanilla JS）
- **Context**: 静的サイトの最小構成を維持しつつ、必要な機能を実装する
- **Alternatives Considered**:
  1. React/Vue等のSPAフレームワーク — 開発効率は高いがビルドパイプラインが必要
  2. Vanilla JS + ES Modules — ビルド不要、`$web`に直接配置可能
- **Selected Approach**: Vanilla JS + ES Modules
- **Rationale**: ビルドツール不要で`$web`に直接配置可能。閉域環境でCDN依存を避けられる。機能規模が限定的でフレームワークのオーバーヘッドに見合わない
- **Trade-offs**: コンポーネント再利用性は低いが、機能規模が小さいため問題なし
- **Follow-up**: CSS設計方針は実装時に決定

### Decision: 書き込み順序の制御（index.json最後）
- **Context**: 複数ファイルの書き込みでデータ整合性を確保する
- **Alternatives Considered**:
  1. 並列PUT — 高速だが部分失敗時にindexと詳細の不整合が発生
  2. 順次PUT（raw → items → index） — 整合性が高い
- **Selected Approach**: 順次PUT（raw → items → index）、index書き込み直前に最新index取得
- **Rationale**: indexが最後に更新されることで、一般ユーザーが中間状態のデータを参照するリスクを最小化。最新index取得により他管理者の更新を反映可能
- **Trade-offs**: 書き込み時間は長くなるが、データ整合性を優先
- **Follow-up**: 同時更新の競合は運用ルールで回避（楽観的制御は初期スコープ外）

### Decision: items不変・追加のみ戦略
- **Context**: 詳細JSONのキャッシュ最適化
- **Alternatives Considered**:
  1. items更新可能 + キャッシュバスター — 柔軟だがキャッシュ効率低い
  2. items不変（追加のみ） — ブラウザキャッシュを最大限活用
- **Selected Approach**: items不変（追加のみ）
- **Rationale**: 一度作成された詳細JSONは変更しない前提とすることで、ブラウザキャッシュが永続的に有効になり閲覧UXが向上
- **Trade-offs**: 既存itemの修正にはIDを変えて新規追加する運用が必要
- **Follow-up**: 古いitemsの削除ポリシーは運用で検討

## Risks & Mitigations
- **CORS設定漏れ** — インフラ設定チェックリストに含め、デプロイ前に検証
- **SAS漏洩** — 閉域前提で許容。Stored Access Policyで失効可能
- **同時更新競合** — 運用ルール（更新は1名ずつ）で回避。将来的にETag楽観的ロックを検討
- **大規模CSV処理** — PapaParseのWeb Workerモードで対応。極端に大きいファイルはファイルサイズ上限で制御

## References
- [Put Blob REST API](https://learn.microsoft.com/en-us/rest/api/storageservices/put-blob)
- [Static website hosting in Azure Storage](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website)
- [SAS overview](https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview)
- [CORS support for Azure Storage](https://learn.microsoft.com/en-us/rest/api/storageservices/cross-origin-resource-sharing--cors--support-for-the-azure-storage-services)
- [PapaParse](https://www.papaparse.com/)
