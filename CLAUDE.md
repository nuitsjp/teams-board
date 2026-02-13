# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

You are running on Windows. Bash isn't available directly, so please use Bash (via pwsh:\*).

## Primary Directive

- Think in English, interact with the user in Japanese.
- All text, comments, and documentation must be written in Japanese.
- Class names, function names, and other identifiers must be written in English.
- Can execute GitHub CLI/Azure CLI. Will execute and verify them personally
  whenever possible.
- Do not modify files directly on the main branch.
- Create a branch with an appropriate name and switch to it before making any modifications.

## Common Commands

```bash
# 初期セットアップ
pnpm install              # 依存関係のインストール（postinstall スクリプトが自動実行）
pnpm install:clean        # クリーンインストール（キャッシュをクリアしてセットアップ）

# 開発サーバー
pnpm run dev              # 開発サーバー起動 (http://localhost:5173, HMR対応)
                          # 管理者モード: http://localhost:5173/?token=dev

# ビルド・プレビュー
pnpm run build            # 本番用ビルド (dist/ に出力)
pnpm run preview          # ビルド後のプレビュー

# テスト
pnpm test                 # Vitest で全ユニットテストを実行
pnpm run test:watch       # Vitest ウォッチモード
pnpm run test:coverage    # テストカバレッジ付きで実行
pnpm vitest run tests/logic/csv-transformer.test.js           # 単一テストファイル実行
pnpm vitest run tests/react/pages/DashboardPage.test.jsx      # React コンポーネントテスト

# E2E テスト (Playwright)
pnpm exec playwright install   # 初回のみ: ブラウザをインストール
pnpm run test:e2e              # ヘッドレスで実行
pnpm run test:e2e:headed       # ブラウザ表示で実行

# Linting・Formatting
pnpm run lint             # ESLint で JavaScript を検査
pnpm run lint:text        # textlint で日本語テキストを検査
pnpm run lint:text:fix    # textlint で日本語テキストを自動修正
pnpm run format           # Prettier でコード整形

# ドキュメンテーション（mkdocs）
pnpm run mkdocs           # ドキュメントサイトをローカルで提供
pnpm run mkdocs:build     # ドキュメントサイトをビルド
pnpm run mkdocs:build:svg # Mermaid 図を SVG に変換
pnpm run mkdocs:pdf       # PDF ドキュメントを生成
```

## Tech Stack

- **React 19** + **Vite** — JSX (no TypeScript)
- **react-router-dom** (HashRouter) — `#/` based routing
- **Tailwind CSS 4** — Utility-first CSS, カスタムデザイントークンは `src/index.css` の `@theme` で定義（プライマリ: ティール系、アクセント: アンバー系）
- **PapaParse** — Teams attendance report CSV (UTF-16LE) parser
- **recharts** — データ可視化（グラフ・チャート）
- **lucide-react** — アイコンライブラリ
- **Vitest** + **React Testing Library** — Unit tests in jsdom environment
- **Playwright** — E2E tests (Chromium only)
- **pnpm** — Package manager (`packageManager: pnpm@10.27.0`)

## Architecture

A dashboard SPA that aggregates and visualizes Microsoft Teams attendance report CSVs. Hosted on Azure Blob Storage static site hosting, operating without a backend server.

### Layer Structure

| Layer      | Path              | Responsibility                                                                     |
| ---------- | ----------------- | ---------------------------------------------------------------------------------- |
| Pages      | `src/pages/`      | Per-screen data fetching and display (Dashboard, MemberDetail, GroupDetail, Admin) |
| Components | `src/components/` | Reusable UI parts (FileDropZone, GroupList, MemberList, SummaryCard, etc.)         |
| Hooks      | `src/hooks/`      | State management (`useAuth` = SAS token auth, `useFileQueue` = file queue)         |
| Services   | `src/services/`   | I/O and domain logic (see below)                                                   |
| Utils      | `src/utils/`      | Helper functions (e.g., `format-duration` for time formatting)                     |
| Config     | `src/config/`     | Environment variable based config (`APP_CONFIG.blobBaseUrl`)                       |

### Services Layer Roles

- **CsvTransformer** — Parses Teams attendance report CSV (UTF-16LE/TSV), producing session records and index merge inputs. Uses first 8 hex digits of SHA-256 for ID generation
- **IndexMerger** — Immutably updates groups/members in `index.json` (duplicate sessionIds are skipped with warnings)
- **IndexEditor** — `index.json` のインプレース編集ロジック（グループ名変更など）
- **DataFetcher** — Fetches `data/index.json` and `data/sessions/*.json` from the static site
- **BlobWriter** — PUTs to Azure Blob Storage with SAS token
- **BlobStorage** / **IndexFetcher** — Dev/Production 切替可能な I/O 抽象化（下記参照）

### Dev/Production 抽象化パターン

`blob-storage.js` と `index-fetcher.js` は同一インターフェースで本番/開発を切り替える戦略パターンを採用:

- **`AzureBlobStorage`** / **`DevBlobStorage`** — 本番は SAS トークン付き PUT、開発は `/dev-fixtures-write` に POST
- **`ProductionIndexFetcher`** / **`DevIndexFetcher`** — 本番は Blob Storage から SAS 付き取得、開発は Vite ミドルウェア経由

開発環境では `?token=dev` でアクセスすると `Dev*` 系クラスが使用される。

### Routing

- `#/` — Dashboard overview
- `#/groups/:groupId` — Group detail
- `#/members/:memberId` — Member detail
- `#/admin` — Admin page (visible only when SAS token authenticated)

### Data Flow

- Read path: Static Website Endpoint → `data/index.json` (with cache buster) + `data/sessions/<id>.json` (immutable)
- Write path: CSV drop → CsvTransformer → IndexMerger → BlobWriter (PUT with SAS)
- SAS token is extracted from URL query `token` on first load, then immediately removed via `history.replaceState` and held in memory only

### Development Data

Development JSON fixtures are placed in `dev-fixtures/data/`. The Vite plugin `serveDevFixtures` (in vite.config.js) serves `/data/` requests from this directory on the dev server. Not included in `public/` since Azure Blob Storage serves this data in production.

#### Dev Fixtures Plugin Features

- **GET `/data/*`** — Serves development JSON fixtures from `dev-fixtures/` directory
- **POST `/dev-fixtures-write`** — Allows writing updated JSON during development (管理者モードのテスト用)
  - Request body: `{ "path": "data/index.json", "data": {...} }`
  - Useful for testing CSV uploads and data mutations in admin page
- **Admin Mode URL** — When dev server starts, it displays: `http://localhost:5173/?token=dev` for testing admin page

#### Development Token

The SAS token is extracted from the URL query parameter (`token`) on first load, then immediately removed via `history.replaceState` and held in memory. For development, use `?token=dev` to enable admin page testing.

### Test Structure

- `tests/data/` — DataFetcher, BlobWriter, IndexMerger tests
- `tests/logic/` — CsvTransformer tests
- `tests/react/` — React component, page, and hook tests
- `tests/fixtures/` — Test CSV fixtures
- `tests/vitest.setup.js` — webcrypto polyfill + jest-dom setup
- `e2e/` — Playwright E2E tests、2プロジェクトに分離:
  - **`readonly-tests`** — 読み取り専用テスト（並列実行可）
  - **`data-mutation-tests`** — `admin-dev-mode.spec.js`（データ変更あり、readonly-tests 完了後に実行）

### CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) runs lint and tests in parallel, then builds and deploys. `main` push → prod deployment, Pull Request → dev deployment + E2E tests. Uses OIDC authentication.

### Environment Variables (Build Time)

- `VITE_APP_TITLE` — App title (default: 'Teams Board')
- `VITE_APP_DESCRIPTION` — ヘッダーに表示するサイト説明文（任意）
- `VITE_BLOB_BASE_URL` — Blob Service Endpoint URL

## Code Style Conventions

- **Prettier**: `singleQuote: true`, `semi: true`, `trailingComma: "es5"`, `printWidth: 100`
- **EditorConfig**: インデント 4 スペース（JSON/YAML は 2 スペース）、改行 LF、UTF-8
- **ESLint**: `eslint:recommended` + `react` + `react-hooks` + `prettier`

## Development Setup

### Postinstall Configuration

Running `pnpm install` automatically executes the postinstall script (`scripts/postinstall-setup.mjs`), which initializes the development environment. Use `pnpm install:clean` to perform a clean setup if needed.

### Environment Configuration

Copy `.env.example` to `.env.local` for local development:

```bash
# フロントエンド設定（Vite）
VITE_APP_TITLE=Teams Board

# Azure インフラ設定（本番デプロイ時に必要）
AZURE_SUBSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_RESOURCE_GROUP_NAME=<your-resource-group-name>
AZURE_STORAGE_ACCOUNT_NAME=<your-storage-account-name>
```

Build-time variables (prefixed with `VITE_`) are embedded in the bundle. For development, the dev server uses default values.

## Documentation Tooling

This project uses **mkdocs** with Material theme for documentation. Documentation is built with Python using `uv` as the package manager.

### Python Dependencies

Documentation dependencies are managed via `pyproject.toml`:
- **mkdocs** — Documentation site generator
- **mkdocs-material** — Material Design theme
- **mkdocs-mermaid2-plugin** — Mermaid diagram support
- **pymdown-extensions** — Markdown extensions
- **weasyprint** — PDF generation for documentation

### Japanese Text Linting

textlint is configured (`.textlintrc.json`) to check Japanese text quality:

```bash
pnpm run lint:text        # 日本語テキストを検査
pnpm run lint:text:fix    # 自動修正
```

Linting rules:
- Consistent Japanese particles (である/ですます の混在を検査)
- Proper spacing around Japanese and English
- JTF Style Guide compliance
- ICS Media preset rules

## Documentation

### RIDW Customized Documents

業務定義・シナリオ・機能定義は `docs/` 配下に格納します（`Document/` フォルダーは使用しません）。

ドキュメント作成には `writing-documents` スキルを使用し、以下の構造に従います：

```
docs/
├── .pages
├── index.md                    # システム概要・ドメインモデル
├── 01.[業務名]/               # 業務定義フォルダ
│   ├── .pages
│   ├── [業務名].md            # 業務定義
│   ├── シナリオ/
│   │   ├── .pages
│   │   └── XX.[シナリオ名].md  # 業務シナリオ
│   └── 機能定義/
│       ├── .pages
│       └── [機能名]/           # 機能定義
│           ├── .pages
│           ├── [機能名].md
│           └── シナリオ/       # 機能シナリオ（画面機能のみ）
│               └── XX.[シナリオ名].md
```

**業務の定義**：
- 業務 = 複数の機能またはアクター間のコラボレーションを表す
- 例: CSV アップロードによるセッション登録から、メンバー/グループの参加履歴閲覧までの一連の流れ

**ドキュメント種別**：
- **業務定義** — 業務の全体像、目的、スコープ、アクティビティ図
- **業務シナリオ** — 業務に基づいた具体的なユースケース
- **機能定義** — 業務を実現するための個別機能（画面/バッチ/API）
- **機能シナリオ** — 機能の具体的な操作シナリオ（画面機能のみ作成）
