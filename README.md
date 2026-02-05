# study-log

Azure Blob Storage の静的サイトホスティング機能を利用した、ダッシュボード／ドリルダウン閲覧・更新システム。

## 目的

利用頻度が低くDB・常時稼働バックエンドを持つのがコストに見合わないケースにおいて、**静的ファイル配信のみ**でダッシュボード閲覧と CSV によるデータ更新を実現する。

| 目標 | 実現方法 |
|------|---------|
| 閲覧の安定 UX | 静的配信のみ（コールドスタートなし） |
| 最小コスト・最小運用 | Azure Blob Storage + `$web` コンテナのみ |
| 更新の省力化 | CSV 投入 → ブラウザ変換 → JSON 配信 |
| シンプルな権限制御 | 閉域ネットワーク ＋ SAS トークンによる簡易分離 |

## アーキテクチャ

- [アーキテクチャ概要](./docs/architecture.md)

## リポジトリ構成

```
study-log/
├── frontend/
│   ├── dashboard/          # ← メインアプリケーション
│   │   ├── public/         # $web コンテナに配置する静的ファイル
│   │   │   ├── index.html
│   │   │   ├── css/style.css
│   │   │   ├── js/main.js
│   │   │   ├── lib/papaparse.min.js
│   │   │   └── data/       # index.json, items/*.json（仮データ）
│   │   ├── src/            # ES Modules ソースコード
│   │   │   ├── core/       # AuthManager, Router
│   │   │   ├── data/       # DataFetcher, BlobWriter, IndexMerger
│   │   │   ├── logic/      # CsvTransformer
│   │   │   └── ui/         # DashboardView, DetailView, AdminPanel
│   │   └── tests/          # Vitest テスト（87件）
│   └── staticwebapp.config.json
├── backend/                # Azure Functions（別機能、本ダッシュボードでは不使用）
├── .kiro/specs/            # 仕様書（要件・設計・タスク）
└── CLAUDE.md               # AI 開発ガイドライン
```

## クイックスタート

### 前提条件

- **Node.js** v20 以上
- **npm**

### セットアップとテスト実行

```bash
cd frontend/dashboard
npm install
npm test
```

87 件の全テストが通ることを確認してください。

```
 Test Files  12 passed (12)
      Tests  87 passed (87)
```

### ローカルで画面を確認する

`public/` 配下を任意の静的サーバで配信します。

```bash
# 例: npx serve を使う場合
npx serve public
```

ブラウザで `http://localhost:3000` を開くとダッシュボード一覧が表示されます。

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────┐
│  ブラウザ                                            │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Dashboard │  │  Detail  │  │   AdminPanel      │  │
│  │   View    │  │   View   │  │  CsvUploader      │  │
│  └────┬─────┘  └────┬─────┘  │  PreviewPanel     │  │
│       │              │        └────────┬──────────┘  │
│  ┌────┴──────────────┴────┐   ┌───────┴──────────┐  │
│  │     DataFetcher        │   │   BlobWriter      │  │
│  │  (GET, キャッシュ制御)  │   │ (PUT + SAS token) │  │
│  └────────┬───────────────┘   └───────┬──────────┘  │
└───────────┼───────────────────────────┼──────────────┘
            │                           │
   GET (静的サイト EP)           PUT (Blob サービス EP)
            │                           │
   ┌────────▼───────────────────────────▼──────────┐
   │        Azure Blob Storage ($web コンテナ)       │
   │  data/index.json  data/items/*.json  raw/*.csv │
   └────────────────────────────────────────────────┘
```

### 閲覧フロー（一般ユーザー）

1. `index.html` をブラウザで開く
2. `data/index.json` をキャッシュバスター付きで取得し一覧表示
3. アイテム選択で `data/items/<id>.json` を取得して詳細表示（不変リソース、ブラウザキャッシュ有効）

### 更新フロー（管理者）

1. `?token=<SAS>` 付き URL でアクセス → 管理者モード有効化
2. CSV ファイルをドラッグ&ドロップまたはファイル選択で投入
3. ブラウザ上で PapaParse が CSV → JSON に変換、プレビュー表示
4. 「保存を確定」で Blob に書き込み（順序: `raw/*.csv` → `data/items/*.json` → `data/index.json`）

## コンポーネント一覧

| コンポーネント | 責務 | テスト数 |
|---------------|------|---------|
| AuthManager | SAS トークン抽出、管理者モード制御、URL からの token 除去 | 9 |
| Router | ハッシュベースの画面遷移（`#/`, `#/items/<id>`） | 8 |
| DataFetcher | JSON データ取得、キャッシュバスター制御 | 8 |
| BlobWriter | SAS 付き PUT、書き込み順序制御、リトライ | 11 |
| IndexMerger | index.json のマージ、重複 ID 検出 | 6 |
| CsvTransformer | CSV パース（PapaParse）、JSON 変換 | 8 |
| DashboardView | ダッシュボード一覧表示、ローディング/エラー状態 | 5 |
| DetailView | ドリルダウン詳細表示、戻る操作 | 4 |
| AdminPanel | 管理者 UI（CSV 投入、プレビュー、進捗表示、リトライ） | 13 |

結合テスト: 閲覧フロー 6 件 + 管理者フロー 6 件 + スモークテスト 3 件

## 技術スタック

| 要素 | 選択 | 理由 |
|------|------|------|
| フロントエンド | Vanilla JS（ES Modules） | ビルドツール不要、`$web` に直接配置可能 |
| CSV パーサー | PapaParse v5.x | Web Worker 対応、依存ゼロ、ローカルファイル配置（CDN 不使用） |
| テスト | Vitest + jsdom | ES Modules ネイティブ対応、高速 |
| ホスティング | Azure Blob Storage 静的サイト | 最小コスト、閉域環境対応 |

## Azure 環境の準備

本アプリケーションを Azure にデプロイするには以下の設定が必要です。

### 1. Storage アカウントの静的サイトホスティング有効化

```bash
az storage blob service-properties update \
  --account-name <ACCOUNT_NAME> \
  --static-website \
  --index-document index.html
```

### 2. CORS 設定（Blob サービス）

管理者のブラウザから Blob サービスエンドポイントへ PUT するため、CORS ルールが必要です。

```bash
az storage cors add \
  --account-name <ACCOUNT_NAME> \
  --services b \
  --methods PUT GET HEAD \
  --origins "https://<ACCOUNT_NAME>.<ZONE>.web.core.windows.net" \
  --allowed-headers "x-ms-blob-type,x-ms-blob-content-type,content-type,x-ms-version" \
  --exposed-headers "x-ms-meta-*"
```

### 3. SAS トークン発行（管理者用）

```bash
az storage container generate-sas \
  --account-name <ACCOUNT_NAME> \
  --name '$web' \
  --permissions rwc \
  --expiry <EXPIRY_DATE> \
  --https-only
```

発行された SAS トークンを URL の `?token=` パラメータとして管理者に配布します。

### 4. デプロイ

`public/` 配下のファイルを `$web` コンテナにアップロードします。

```bash
az storage blob upload-batch \
  --account-name <ACCOUNT_NAME> \
  --destination '$web' \
  --source frontend/dashboard/public
```

## 仕様書

要件定義・技術設計・タスク分解は `.kiro/specs/blob-static-dashboard/` に格納されています。

| ファイル | 内容 |
|---------|------|
| `requirements.md` | 8 つの要件と受入基準 |
| `design.md` | アーキテクチャ設計、コンポーネント定義、データモデル |
| `tasks.md` | TDD 実装計画（全タスク完了済み） |
| `research.md` | 技術調査結果（Azure REST API、CORS、PapaParse 等） |

## 開発ワークフロー

本リポジトリでは AI-DLC（AI Development Life Cycle）に基づく Spec-Driven Development を採用しています。

```
要件定義 → 技術設計 → タスク分解 → TDD 実装
```

各フェーズで人間のレビューと承認を行い、テストを先に書いてから実装コードを書く TDD サイクルを厳守します。詳細は `CLAUDE.md` を参照してください。

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。
