# Research & Design Decisions

## Summary
- **Feature**: `apply-domain-model`
- **Discovery Scope**: Extension（既存システムのデータモデル置換）
- **Key Findings**:
  - 既存の AuthManager, DataFetcher, BlobWriter はインターフェース変更不要（パス非依存設計）
  - CsvTransformer は Teams出席レポート形式（UTF-16LE, TSV, 3セクション構成）への全面的な書き換えが必要
  - IndexMerger は append-only から upsert（セッション追加 + サマリ更新）への変更が必要

## Research Log

### 既存コンポーネントの変更影響度分析
- **Context**: 9コンポーネントのうちどれが変更不要か・大幅変更か特定
- **Findings**:
  - **変更不要**: AuthManager（SASトークン管理のみ）、DataFetcher（URLパス非依存）、BlobWriter（書き込みパス非依存）
  - **軽微な変更**: Router（ルート定義のみ変更 `#/` → `#/members/<id>`）
  - **大幅変更**: CsvTransformer（パース対象が全く異なる）、IndexMerger（マージ戦略変更）、DashboardView / DetailView / AdminPanel（描画内容変更）
- **Implications**: Core層・Data層の基盤は再利用可能。Logic層・UI層が変更の中心

### Teams出席レポートCSVの解析
- **Context**: CSV形式の詳細把握と変換ロジック設計
- **Findings**:
  - エンコーディング: UTF-16LE with BOM
  - 区切り: タブ（TSV）
  - 3セクション構成: 「1. 要約」「2. 参加者」「3. 会議中のアクティビティ」
  - セクションはヘッダ行（`1. 要約` 等）で区切られている
  - 「2. 参加者」セクションのカラム: 名前、初めての参加、最終退出、会議の長さ、メール、参加者 ID (UPN)、役割
  - 時間フォーマット: `X 分 Y 秒` / `X 時間 Y 分 Z 秒` / `X 時間 Y 秒`
  - 「会議のタイトル」値は `"""もくもく勉強会"" で会議中"` のようにCSVエスケープ＋Teams装飾付き
  - 一部ファイルは値がダブルクォートで囲まれている（CSVエクスポート時のバリエーション）
- **Implications**:
  - PapaParseはUTF-16LEを直接パースできない → TextDecoder でUTF-8に変換後パースが必要
  - セクション分割はPapaParseの前処理として行う必要がある
  - 時間パーサーは正規表現で3パターン対応

### SHA-256ハッシュによるID生成
- **Context**: ブラウザ環境でのSHA-256ハッシュ生成方法
- **Findings**:
  - Web Crypto API (`crypto.subtle.digest`) がすべてのモダンブラウザで利用可能
  - 非同期API（Promiseベース）
  - テスト環境（jsdom）では `crypto.subtle` が利用可能（Node.js 15+のWeb Crypto）
- **Implications**: ID生成は非同期関数になる。CsvTransformer.parse() は既に非同期なので問題なし

## Design Decisions

### Decision: CsvTransformer をTeams専用パーサーに置換
- **Context**: 既存の汎用CSVパーサーから、Teams出席レポート専用パーサーへ
- **Alternatives Considered**:
  1. 汎用パーサーを残しつつ新パーサーを追加（2クラス共存）
  2. 既存CsvTransformerを全面書き換え（1クラス）
- **Selected Approach**: Option 2 — 全面書き換え
- **Rationale**: 汎用CSVは今後使用しない。コンポーネント数を増やさず、テストも1箇所に集約できる
- **Trade-offs**: 旧フォーマットCSVのサポートを失うが、不要

### Decision: IndexMerger を DashboardIndex 集約のマージに特化
- **Context**: append-only から SessionRecord 追加に伴うサマリ更新へ
- **Alternatives Considered**:
  1. 既存 IndexMerger を修正
  2. 新クラス IndexMerger を作り直し
- **Selected Approach**: Option 1 — 既存クラスを修正（インターフェース変更）
- **Rationale**: 旧インターフェースは不要。merge() のシグネチャを変更し、StudyGroupSummary/MemberSummary の upsert ロジックを実装
- **Trade-offs**: 旧テストはすべて書き直しになるが、ドメインモデル自体が変わるので不可避

### Decision: ドリルダウン時に複数 SessionRecord を並列フェッチ
- **Context**: MemberSummary.sessionIds の各セッションを取得する方法
- **Selected Approach**: `Promise.all()` で該当する SessionRecord を並列取得
- **Rationale**: SessionRecord は不変（immutable）でキャッシュが効く。2回目以降はキャッシュヒット
- **Trade-offs**: 初回ドリルダウン時に N 回の fetch が発生。セッション数が多い場合はパフォーマンスに注意

## Risks & Mitigations
- **SHA-256 衝突リスク**: 8桁hex（32bit）で衝突確率は約 1/43億。勉強会名数・メンバー数を考えると実質無視可能
- **UTF-16LEデコード失敗**: TextDecoder('utf-16le') をブラウザがサポートしない場合 → モダンブラウザはすべて対応
- **大量セッション時のドリルダウン遅延**: SessionRecord の並列 fetch → ブラウザキャッシュで緩和。将来的にはページネーション検討
