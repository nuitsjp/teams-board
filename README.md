# study-log

Azure Blob Storage の静的サイトホスティング機能を利用した、勉強会ダッシュボード／ドリルダウン閲覧・更新システム。

URL: [https://strjstudylogprod.z11.web.core.windows.net/](https://strjstudylogprod.z11.web.core.windows.net/)

管理者用URL（SASトークン付き、有効期限: 2026-03-31）: [管理者モード](https://strjstudylogprod.z11.web.core.windows.net/?token=se%3D2026-03-31T00%253A00%253A00Z%26sp%3Drcwl%26spr%3Dhttps%26sv%3D2026-02-06%26sr%3Dc%26sig%3DxF1sZpLJVwo6h7rx%252BsVRQl7fOTzidTgNJb2qy7T5JdM%253D)
<!-- token有効期限: 2026-03-31 / 権限: read,create,write,list -->

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

## クイックスタート

### 前提条件

- **Node.js** v20 以上
- **pnpm**（Node.js v20 以上の場合は `corepack enable` で利用可能）

### セットアップとテスト実行

```bash
pnpm install
pnpm test
```

全テストが pass することを確認してください。

### ローカルで画面を確認する

```bash
# 開発サーバー（HMR 付き）
pnpm run dev

# または、プロダクションビルドを確認する場合
pnpm run build
pnpm run preview
```

`pnpm run dev` でブラウザが開き、ダッシュボード一覧が表示されます（デフォルト: `http://localhost:5173`）。

### E2E テスト

```bash
pnpm exec playwright install    # 初回のみ
pnpm run test:e2e               # ヘッドレス実行
pnpm run test:e2e:headed        # ブラウザ表示付き実行
```

### pnpm scripts 一覧

| コマンド | 説明 |
|---------|------|
| `pnpm run dev` | Vite 開発サーバー起動（HMR 付き） |
| `pnpm run build` | プロダクションビルド（`dist/` に出力） |
| `pnpm run preview` | ビルド済みアプリのプレビューサーバー |
| `pnpm test` | Vitest でユニット／統合テストを実行 |
| `pnpm run test:e2e` | Playwright E2E テストを実行 |
| `pnpm run lint` | ESLint で静的解析を実行 |
| `pnpm run format` | Prettier でコード整形を実行 |

## アーキテクチャ概要

```
┌───────────────────────────────────────────────────────────┐
│  ブラウザ（React SPA）                                      │
│                                                           │
│  ┌─ Pages ──────────────────────────────────────────────┐ │
│  │  DashboardPage    MemberDetailPage    AdminPage      │ │
│  └──────┬───────────────────┬──────────────┬────────────┘ │
│         │                   │              │              │
│  ┌─ Hooks ──────────────────┼──────────────┤              │
│  │  useAuth                 │     useFileQueue            │
│  └──────────────────────────┤──────────────┤              │
│                             │              │              │
│  ┌─ Services（再利用） ──────┴──────────────┴────────────┐ │
│  │  DataFetcher    BlobWriter    IndexMerger             │ │
│  │  (GET, キャッシュ制御)  (PUT + SAS)  CsvTransformer    │ │
│  └──────────┬───────────────────────────┬────────────────┘ │
└─────────────┼───────────────────────────┼─────────────────┘
              │                           │
     GET (静的サイト EP)           PUT (Blob サービス EP)
              │                           │
     ┌────────▼───────────────────────────▼──────────┐
     │        Azure Blob Storage ($web コンテナ)       │
     │  data/index.json  data/sessions/*.json  raw/*  │
     └────────────────────────────────────────────────┘
```

### 閲覧フロー（一般ユーザー）

1. ブラウザで SPA にアクセス（ハッシュルーティング: `#/`）
2. DataFetcher が `data/index.json` をキャッシュバスター付きで取得し、勉強会グループ・メンバー一覧を表示
3. メンバーカードクリックで `#/members/<id>` に遷移し、セッション参加履歴を詳細表示

### 更新フロー（管理者）

1. `?token=<SAS>` 付き URL でアクセス → 管理者モード有効化（useAuth Hook）
2. CSV ファイルをドラッグ&ドロップまたはファイル選択で投入
3. CsvTransformer（PapaParse）が CSV → JSON に変換、プレビュー表示
4. 「一括保存」で BlobWriter が書き込み（順序: `raw/*.csv` → `data/sessions/*.json` → `data/index.json`）

## コンポーネント構成

### Pages（画面コンポーネント）

| コンポーネント | 責務 |
|---------------|------|
| DashboardPage | 勉強会グループ一覧・メンバー一覧表示、メンバーカードクリックで詳細遷移 |
| MemberDetailPage | メンバーのセッション参加履歴を日付降順で詳細表示 |
| AdminPage | CSV インポート・プレビュー・一括保存の管理者機能 |

### Hooks（カスタム Hook）

| Hook | 責務 |
|------|------|
| useAuth | SAS トークン抽出、管理者モード判定、URL からの token 除去 |
| useFileQueue | ファイルキュー状態管理（useReducer）、バリデーション、重複検出 |

### Services（ビジネスロジック層、移行前のコードを再利用）

| サービス | 責務 |
|---------|------|
| DataFetcher | JSON データ取得（index.json, session 詳細）、キャッシュバスター制御 |
| BlobWriter | Azure Blob Storage への PUT、書き込み順序制御、リトライ |
| IndexMerger | index.json のマージ、重複セッション ID 検出 |
| CsvTransformer | Teams 出席レポート CSV パース（PapaParse）、JSON 変換、UTF-16LE 対応 |

## 技術スタック

| 要素 | 選択 | 理由 |
|------|------|------|
| フレームワーク | React 19 + ReactDOM 19 | 宣言的 UI による保守性向上 |
| ビルドツール | Vite + @vitejs/plugin-react | HMR、高速ビルド、JSX 変換 |
| ルーティング | react-router-dom（HashRouter） | SPA ハッシュベースルーティング |
| CSV パーサー | PapaParse | Teams 出席レポートの UTF-16LE CSV 解析 |
| ユニットテスト | Vitest + React Testing Library | jsdom 環境、コンポーネントテスト |
| E2E テスト | Playwright | ブラウザベースの画面遷移・管理者フロー検証 |
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

プロダクションビルドを実行し、`dist/` 配下のファイルを `$web` コンテナにアップロードします。

```bash
pnpm run build
```

```bash
# PowerShell スクリプトによるデプロイ
.\scripts\infra\Deploy-StaticFiles.ps1
```

```bash
# または Azure CLI で手動デプロイ
az storage blob upload-batch \
  --account-name <ACCOUNT_NAME> \
  --destination '$web' \
  --source dist
```

> **注意**: `data/` ディレクトリはデータのライフサイクルが異なるため、デプロイスクリプトでは除外されます。

## 仕様書

要件定義・技術設計・タスク分解は `.kiro/specs/` 配下に格納されています。

| 仕様 | 内容 |
|------|------|
| `blob-static-dashboard/` | 初期アーキテクチャ設計（Vanilla JS 版） |
| `react-migration/` | React + Vite への移行（要件・設計・タスク） |

## 開発ワークフロー

本リポジトリでは AI-DLC（AI Development Life Cycle）に基づく Spec-Driven Development を採用しています。

```
要件定義 → 技術設計 → タスク分解 → TDD 実装
```

各フェーズで人間のレビューと承認を行い、テストを先に書いてから実装コードを書く TDD サイクルを厳守します。詳細は `CLAUDE.md` を参照してください。

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。
