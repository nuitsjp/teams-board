# Teams Board

Microsoft Teams の出席レポートを集計・可視化するダッシュボードです。グループごとの参加状況やメンバーの活動時間を一覧表示し、CSV ファイルのインポートでデータを更新できます。

> **Note**: GitHub Actions ワークフローを最適化しました。詳細は [Issue #29](https://github.com/ssd-mkdocs-platform/teams-board/issues/29) を参照してください。

## 技術スタック

| 要素 | 選択 | 選定理由 |
|------|------|----------|
| ホスティング | Azure Blob Storage 静的サイト | 静的コンテンツとデータを単一ストレージアカウントで管理でき、従量課金のみで低頻度運用のコストを最小化できる |
| フロントエンド | React 19 + Vite | 宣言的 UI と高速ビルド |
| ルーティング | react-router-dom（HashRouter） | 静的サイトホスティングとの相性が良いハッシュベースルーティング |
| CSS | Tailwind CSS 4 | ユーティリティファーストで迅速なスタイリング |
| テスト | Vitest + Playwright | ユニットテストと E2E テストの両立 |
| データ更新認可 | SAS トークン（URL パラメータ） | 閉域ネットワーク前提のため簡易方式で十分 |

詳細は [アーキテクチャドキュメント](./docs/architecture.md) を参照してください。

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
| `pnpm run infra:deploy` | Azure インフラのプロビジョニング |
| `pnpm run infra:publish` | 静的ファイルを Azure にデプロイ |
| `pnpm run infra:sas` | SAS トークンの生成 |
| `pnpm run infra:clear` | セッションデータのクリア |

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
