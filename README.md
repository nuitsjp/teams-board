# Teams Board

社内ネットワーク内で Teams の活動状況を管理・閲覧するための、シンプルで低コストなダッシュボードである。

## プロジェクト概要

**Teams Board** は、以下の要件を満たす社内向けサービスである：

- **運用環境** — 閉域網（社内ネットワーク）に配置
- **目的** — Microsoft Teams の出席レポート（CSV）を集計・可視化し、メンバーとグループの活動状況を一元管理
- **設計方針** — バックエンドサーバーを持たず、Azure Blob Storage の静的Webサイト機能を活用し、シンプルで低コストな構造を実現

バックエンドサーバーなしで完全に静的ホスティング上で動作するため、インフラ管理の負担は最小限である。

## 参考資料

- [ドキュメントサイト](https://ssd-mkdocs-platform.github.io/teams-board/)
- [デモサイト](https://stteamsboarddevprod.z11.web.core.windows.net/)

---

## クイックスタート

### 前提条件

- Node.js 18.x 以上
- パッケージマネージャー（npm、pnpm、yarn、bun など）

**推奨**：このプロジェクトは `ni`/`nr` でコマンドを記述している。共通のパッケージマネージャーコマンドを使用できる。

### 開発環境のセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/ssd-mkdocs-platform/teams-board.git
cd teams-board

# 依存関係をインストール（postinstall スクリプトが自動実行）
ni

# 開発サーバーを起動
nr dev
```

ブラウザに **http://localhost:5173** が自動で表示される。

#### 管理者モードで開発テスト

管理者ページへのアクセスをテストする場合：

```
http://localhost:5173/?token=dev
```

ターミナルにも表示される。

---

## 技術スタック

- **React 19** + **Vite** — UI フレームワーク・ビルドツール
- **Tailwind CSS 4** — スタイリング
- **react-router-dom** — クライアント側ルーティング
- **PapaParse** — CSV パース
- **Recharts** — データ可視化
- **Vitest** + **React Testing Library** — ユニットテスト
- **Playwright** — E2E テスト
- **Azure Blob Storage** — 静的サイトホスティング

---

## よく使うコマンド

### 開発

```bash
nr dev                    # 開発サーバー起動（HMR対応）
nr build                  # 本番ビルド
nr preview                # ビルド後のプレビュー
```

### テスト

```bash
nr test                   # 全ユニットテスト実行
nr test:watch             # ウォッチモード
nr test:coverage          # カバレッジ付き実行
nr test:e2e               # E2E テスト実行
```

### コード品質

```bash
nr lint                   # JavaScript 検査（ESLint）
nr lint:text              # 日本語テキスト検査（textlint）
nr format                 # コード整形（Prettier）
```

### ドキュメント

```bash
nr mkdocs                 # ドキュメントサイト（ローカル提供）
nr mkdocs:build           # ドキュメントビルド
```

### プリコミットチェック

```bash
nr lint                   # ESLint
nr lint:text              # textlint（日本語）
nr format                 # Prettier
nr test                   # ユニットテスト
nr test:e2e               # E2E テスト
```

### コミットメッセージ

日本語で簡潔に記述してください：

```
feat: ダッシュボードに集計機能を追加
fix: CSV パーサーの文字エンコーディングバグを修正
docs: アーキテクチャドキュメントを更新
```

---

## 開発環境の設定

### 環境変数

`.env.example` をコピーして `.env.local` を作成：

```bash
cp .env.example .env.local
```

ファイルの内容：

```env
VITE_APP_TITLE=Teams Board
VITE_BLOB_BASE_URL=https://your-storage.blob.core.windows.net/
```

---

## サポート

質問やバグ報告は GitHub Issues を使用すること。

---

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されている。詳細は [LICENSE](./LICENSE) を参照すること。
