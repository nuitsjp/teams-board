# ADR-0001: サーバーサイドパフォーマンス（カテゴリ3）の非適用

## ステータス

承認済み (2026-02-15)

## 背景

Teams Board は Microsoft Teams の参加者レポート CSV を集約し、会議グループ・メンバー単位の参加状況を可視化する静的サイト型ダッシュボードである。

### アーキテクチャ概要

- **フロントエンド**: React 19 + Vite による SPA
- **ホスティング**: Azure Blob Storage 静的 Web サイト機能
- **データ配信**: JSON ファイル（`data/index.json`, `data/sessions/*.json`）を Blob Storage から直接配信
- **データ更新**: 管理者が SAS トークンを使用してブラウザから直接 Blob Storage へ PUT
- **実行環境**: ブラウザのみ（サーバーサイド実行環境なし）

詳細は [`docs/architecture.md`](../architecture.md) を参照。

### Vercel React Best Practices 適用状況

本プロジェクトでは、コード品質向上のため Vercel React Best Practices（57ルール / 8カテゴリ）を参照している。

しかし、**カテゴリ3（Server-Side Performance）** の7ルールはいずれも Next.js の Server Components (RSC) や Server Actions、API Routes などサーバーサイド実行環境を前提としている。

Teams Board は静的ホスティングのみであり、サーバーサイド実行基盤を持たないため、これらのルールは技術的に適用不可能である。

## 決定

**Vercel React Best Practices カテゴリ3（Server-Side Performance）の全7ルールを本プロジェクトでは非適用とする。**

将来、SSR/SSG などサーバーサイド実行環境を導入する場合には、本決定を再評価する。

## 非適用ルール一覧と根拠

### 1. `server-auth-actions` - Server Actions の認証

**ルール概要**: Server Actions (Next.js `"use server"`) は公開エンドポイントとして扱い、各アクション内で認証・認可を検証する。

**非適用根拠**: Teams Board に Server Actions は存在しない。認証は SAS トークンによるクライアントサイド Blob Storage アクセス制御で実現している。

**将来の再検討トリガー**: Server Actions 採用時。

---

### 2. `server-cache-react` - React.cache() によるリクエスト内重複排除

**ルール概要**: サーバーサイドで `React.cache()` を使用し、同一リクエスト内での認証・DB クエリの重複実行を防ぐ。

**非適用根拠**: サーバーサイドレンダリングを行わないため、`React.cache()` のサーバー向け用途は発生しない。

**将来の再検討トリガー**: SSR/SSG 導入時。サーバーサイドでの認証・データ取得ロジックが必要になった場合。

---

### 3. `server-cache-lru` - クロスリクエスト LRU キャッシング

**ルール概要**: 複数リクエストをまたいで共有するデータに対して LRU キャッシュを使用する。

**非適用根拠**: サーバーサイド実行環境が存在しないため、クロスリクエストキャッシュを保持する場所がない。

**将来の再検討トリガー**: SSR/SSG 導入時。サーバーサイドでのデータキャッシュ戦略が必要になった場合。

---

### 4. `server-dedup-props` - RSC props での重複シリアライゼーション回避

**ルール概要**: React Server Components から Client Components へ渡す props のシリアライゼーションは参照ベースで重複排除されるため、配列変換（`.toSorted()` など）はクライアント側で行う。

**非適用根拠**: Server Components を使用していないため、RSC→Client 境界でのシリアライゼーション最適化は不要。

**将来の再検討トリガー**: Server Components 採用時。

---

### 5. `server-serialization` - RSC 境界でのシリアライゼーション最小化

**ルール概要**: Server/Client 境界で渡すデータはシリアライズされ HTML/RSC レスポンスに埋め込まれるため、必要なフィールドのみを渡す。

**非適用根拠**: Server Components を使用していないため、RSC 境界でのシリアライゼーション最適化は不要。

**将来の再検討トリガー**: Server Components 採用時。サーバーサイドでデータ整形を行う場合。

---

### 6. `server-parallel-fetching` - コンポーネント構成による並列データ取得

**ルール概要**: React Server Components ツリー内のシーケンシャル実行を避け、コンポーネント構成（composition）で並列データ取得を実現する。

**非適用根拠**: Server Components を使用していないため、サーバーサイドでのコンポーネント並列データ取得は発生しない。

**将来の再検討トリガー**: Server Components 採用時。複数コンポーネントからのデータ取得をサーバーサイドで行う場合。

---

### 7. `server-after-nonblocking` - after() による非ブロッキング操作

**ルール概要**: Next.js の `after()` を使用し、レスポンス送信後にログ・分析などの副作用を実行する。

**非適用根拠**: サーバーサイドレンダリングを行わないため、レスポンス送信後の非ブロッキング処理は発生しない。

**将来の再検討トリガー**: SSR/SSG 導入時。サーバーサイドでのログ送信・分析処理が必要になった場合。

---

## 将来の再検討ポイント

以下のいずれかの変更が発生した場合、本 ADR を再評価し、適用可能なルールを採用すること。

### 1. アーキテクチャ変更

- **SSR（Server-Side Rendering）導入**: Next.js App Router + Server Components など
- **SSG（Static Site Generation）導入**: ビルド時サーバーサイド実行

### 2. 認証・認可境界の変更

- SAS トークンから API Gateway + バックエンド認証への移行
- Server Actions の採用

### 3. データ取得方式の変更

- 静的 JSON 配信から API エンドポイント経由への移行
- サーバーサイドでのデータ集約・キャッシング

### 4. パフォーマンス要件の変化

- 初期表示速度の最適化要求（SSR/SSG による初回レンダリング高速化）
- サーバーサイドキャッシング導入による API 負荷軽減

## 影響範囲

### 対象コンポーネント

- なし（非適用のため、既存コードへの影響なし）

### ドキュメント

- 本 ADR をプロジェクトドキュメントに追加
- `docs/.pages` のナビゲーションに ADR セクションを追加

### 開発プロセス

- コードレビュー時、カテゴリ3ルールは参照対象外とする
- 将来のアーキテクチャ変更時、本 ADR を参照し再評価する

## 参考資料

- [Vercel React Best Practices - Category 3: Server-Side Performance](.rulesync/skills/vercel-react-best-practices/SKILL.md)
- [Teams Board アーキテクチャ](../architecture.md)
- [GitHub Issue #79](https://github.com/ssd-mkdocs-platform/teams-board/issues/79)
