# Teams Board

Microsoft Teams の出席レポートを集計・可視化するダッシュボードである。グループごとの参加状況やメンバーの活動時間を一覧表示し、CSV ファイルのインポートでデータを更新できる。

- [docs](https://agreeable-pebble-0bd0b0800.2.azurestaticapps.net/)

## 技術スタック

| 要素           | 選択                           | 選定理由                                                                                                   |
| -------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| ホスティング   | Azure Blob Storage 静的サイト  | 静的コンテンツとデータを単一ストレージアカウントで管理でき、従量課金のみで低頻度運用のコストを最小化できる |
| フロントエンド | React 19 + Vite                | 宣言的 UI と高速ビルド                                                                                     |
| ルーティング   | react-router-dom（HashRouter） | 静的サイトホスティングとの相性が良いハッシュベースルーティング                                             |
| CSS            | Tailwind CSS 4                 | ユーティリティファーストで迅速なスタイリング                                                               |
| テスト         | Vitest + Playwright            | ユニットテストと E2E テストの両立                                                                          |
| データ更新認可 | SAS トークン（URL パラメーター） | 閉域ネットワーク前提のため簡易方式で十分                                                                   |

詳細は [アーキテクチャドキュメント](./docs/architecture.md) を参照のこと。

## クイックスタート

### 前提条件

- **Node.js** v20 以上
- **pnpm**（Node.js v20 以上の場合は `corepack enable` で利用可能）
- **ni**（パッケージマネージャーに依存しないコマンド。`npm i -g @antfu/ni` でインストール可能）

### セットアップとテスト実行

```bash
ni
nr test
```

Windows 環境では、`pnpm install`（`ni` 経由を含む）時に `docs/openspec` ジャンクションを自動作成する。`docs/openspec` が通常フォルダーやファイルとしてすでに存在する場合は競合としてエラー終了するため、手動で解消してから再実行すること。

全テストが pass することを確認する。

### ローカルで画面を確認する

```bash
# 開発サーバー（HMR 付き）
nr dev

# または、プロダクションビルドを確認する場合
nr build
nr preview
```

`nr dev` でブラウザが開き、ダッシュボード一覧が表示される（デフォルト： `http://localhost:5173`）。

### 開発環境で管理者モードを使用する

開発環境では、ダミートークンを使用して管理者モード（AdminPage）をテストできる。

```bash
# 開発サーバーを起動
nr dev

# ブラウザで以下のURLにアクセス
# http://localhost:5173/?token=dev
```

ダミートークン（`?token=dev`）を使用すると：

- 管理者専用機能（CSV 一括保存、グループ名編集など）にアクセスできる
- 書き込み操作は `dev-fixtures/data/` に保存される（実際の Azure Blob Storage には影響しない）
- 本番環境では無効化される（セキュリティ保証）

**実際の SAS トークンとの共存**

開発環境で実際の Azure Blob Storage SAS トークンを使用することもできる。その場合は `?token=<actual-sas-token>` でアクセスする。

**開発用データのクリーンアップ（任意）**

開発中に蓄積したテストデータをクリーンアップする場合：

```bash
# dev-fixtures/data/ 配下のデータを削除
rm -rf dev-fixtures/data/*

# または PowerShell の場合
Remove-Item -Recurse -Force dev-fixtures/data/*
```

### E2E テスト

```bash
nlx playwright install    # 初回のみ
nr test:e2e               # ヘッドレス実行
nr test:e2e:headed        # ブラウザ表示付き実行
```

### scripts 一覧

| コマンド      | 説明                                   |
| ------------- | -------------------------------------- |
| `nr dev`      | Vite 開発サーバー起動（HMR 付き）      |
| `nr build`    | プロダクションビルド（`dist/` に出力） |
| `nr preview`  | ビルド済みアプリのプレビューサーバー   |
| `nr test`     | Vitest でユニット／統合テストを実行    |
| `nr test:e2e` | Playwright E2E テストを実行            |
| `nr lint`     | ESLint で静的解析を実行                |
| `nr format`   | Prettier でコード整形を実行            |

## CI/CD パイプライン

GitHub Actions の主要ワークフローは以下の4つで構成する。

- `.github/workflows/ci-workflow.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/deploy-site.yml`
- `.github/workflows/close-preview.yml`

### ワークフロー構成

```
pull_request / push (main)
  └─ CI Workflow
      ├─ lint
      ├─ test
      └─ build
           └─ App Deployment（CI成功ゲート）
                ├─ pull_request: dev へ配信 → E2E
                └─ push(main): prod へ配信

docs 変更の pull_request / push(main)
  └─ Deploy Site
      ├─ pnpm run lint:text
      ├─ preview 配信（PR）
      └─ production 配信（main push）

pull_request_target: closed
  └─ Close Preview（冪等クリーンアップ）
```

| ワークフロー | トリガー | 説明 |
| ------------- | -------------- | ----------------------------------------------------- |
| `CI Workflow` | `pull_request: main`, `push: main`（アプリ関連変更） | `lint/test/build` のみを実行する品質検証 |
| `App Deployment` | `pull_request: main`, `push: main`（アプリ関連変更） | 対象SHAの `CI Workflow` 成功を確認後に Azure Blob Storage へ配信 |
| `Deploy Site` | `pull_request: main`, `push: main`（docs関連変更） | `pnpm run lint:text` 成功後に MkDocs を preview/production 配信 |
| `Close Preview` | `pull_request_target: closed` | プレビュー環境を冪等にクローズ（対象なしでも失敗停止しない） |

### Azure 認証

OIDC（OpenID Connect）を使用して GitHub Actions から Azure に認証する。サービスプリンシパルのシークレットは不要で、短命なトークンで安全に認証する。

### 必要な設定

#### GitHub Secrets

| シークレット名    | 説明                           |
| ----------------- | ------------------------------ |
| `AZURE_CLIENT_ID` | Azure アプリケーション ID      |
| `AZURE_TENANT_ID` | Azure テナント ID              |

#### GitHub Variables（リポジトリレベル）

| 変数名                     | 説明                               |
| -------------------------- | ---------------------------------- |
| `VITE_APP_TITLE`           | アプリタイトル                     |
| `VITE_BLOB_BASE_URL_PROD`  | 本番環境の Blob Service URL        |
| `VITE_BLOB_BASE_URL_DEV`   | 開発環境の Blob Service URL        |

#### GitHub Variables（環境レベル: prod / dev）

| 変数名                         | 説明                               |
| ------------------------------ | ---------------------------------- |
| `AZURE_SUBSCRIPTION_ID`        | Azure サブスクリプション ID        |
| `AZURE_STORAGE_ACCOUNT_NAME`   | ストレージアカウント名             |
| `AZURE_RESOURCE_GROUP_NAME`    | リソースグループ名                 |

### ロールバック

自動ロールバックは実装していない。問題が発生した場合は `git revert` で前回の安定版にリバートし、main に push すれば各配信ワークフローが再実行される。

## 仕様書

要件定義・技術設計・タスク分解は `.kiro/specs/` 配下に格納されている。

| 仕様                     | 内容                                        |
| ------------------------ | ------------------------------------------- |
| `blob-static-dashboard/` | 初期アーキテクチャ設計（Vanilla JS 版）     |
| `react-migration/`       | React + Vite への移行（要件・設計・タスク） |

## 開発ワークフロー

本リポジトリでは AI-DLC（AI Development Life Cycle）に基づく Spec-Driven Development を採用している。

```
要件定義 → 技術設計 → タスク分解 → TDD 実装
```

各フェーズで人間のレビューと承認を行い、テストを先に書いてから実装コードを書く TDD サイクルを厳守する。詳細は `CLAUDE.md` を参照のこと。

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照のこと。
