# Teams Board

Microsoft Teams の出席レポートを集計・可視化するダッシュボードです。グループごとの参加状況やメンバーの活動時間を一覧表示し、CSV ファイルのインポートでデータを更新できます。

## 技術スタック

| 要素           | 選択                           | 選定理由                                                                                                   |
| -------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| ホスティング   | Azure Blob Storage 静的サイト  | 静的コンテンツとデータを単一ストレージアカウントで管理でき、従量課金のみで低頻度運用のコストを最小化できる |
| フロントエンド | React 19 + Vite                | 宣言的 UI と高速ビルド                                                                                     |
| ルーティング   | react-router-dom（HashRouter） | 静的サイトホスティングとの相性が良いハッシュベースルーティング                                             |
| CSS            | Tailwind CSS 4                 | ユーティリティファーストで迅速なスタイリング                                                               |
| テスト         | Vitest + Playwright            | ユニットテストと E2E テストの両立                                                                          |
| データ更新認可 | SAS トークン（URL パラメータ） | 閉域ネットワーク前提のため簡易方式で十分                                                                   |

詳細は [アーキテクチャドキュメント](./docs/architecture.md) を参照してください。

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

全テストが pass することを確認してください。

### ローカルで画面を確認する

```bash
# 開発サーバー（HMR 付き）
nr dev

# または、プロダクションビルドを確認する場合
nr build
nr preview
```

`nr dev` でブラウザが開き、ダッシュボード一覧が表示されます（デフォルト: `http://localhost:5173`）。

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

GitHub Actions による CI/CD パイプラインが `.github/workflows/deploy.yml` に定義されています。

### ワークフロー構成

```
push (main)        → lint ─┐
                     test ─┤→ build → deploy-prod
                           │
pull_request (main) → lint ─┐
                     test ─┤→ build → deploy-dev → e2e-dev
```

| ジョブ        | トリガー       | 説明                                                  |
| ------------- | -------------- | ----------------------------------------------------- |
| `lint`        | push / PR      | ESLint による静的解析                                 |
| `test`        | push / PR      | Vitest によるユニットテスト                           |
| `build`       | push / PR      | Vite プロダクションビルド（lint + test 成功後）       |
| `deploy-prod` | push (main)    | 本番 Azure Blob Storage へデプロイ                    |
| `deploy-dev`  | PR             | 開発 Azure Blob Storage へデプロイ                    |
| `e2e-dev`     | PR             | Playwright E2E テスト（開発デプロイ後）               |

### Azure 認証

OIDC（OpenID Connect）を使用して GitHub Actions から Azure に認証します。サービスプリンシパルのシークレットは不要で、短命なトークンで安全に認証します。

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

自動ロールバックは実装していません。問題が発生した場合は `git revert` で前回の安定版にリバートし、main に push すれば CI/CD パイプラインが自動的に再デプロイします。

## 仕様書

要件定義・技術設計・タスク分解は `.kiro/specs/` 配下に格納されています。

| 仕様                     | 内容                                        |
| ------------------------ | ------------------------------------------- |
| `blob-static-dashboard/` | 初期アーキテクチャ設計（Vanilla JS 版）     |
| `react-migration/`       | React + Vite への移行（要件・設計・タスク） |

## 開発ワークフロー

本リポジトリでは AI-DLC（AI Development Life Cycle）に基づく Spec-Driven Development を採用しています。

```
要件定義 → 技術設計 → タスク分解 → TDD 実装
```

各フェーズで人間のレビューと承認を行い、テストを先に書いてから実装コードを書く TDD サイクルを厳守します。詳細は `CLAUDE.md` を参照してください。

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。
