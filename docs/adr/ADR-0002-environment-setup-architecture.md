# ADR-0002: 環境構築プロセスの統一設計

## ステータス

提案 (2026-02-20)

## 背景

Teams Board は React SPA（アプリケーション）と MkDocs（ドキュメンテーション）の2つのビルド対象を持ち、以下の3つの実行コンテキストで環境構築が必要である。

| コンテキスト | 説明 |
|---|---|
| ローカル開発 | 開発者の PC 上での開発・テスト・ドキュメント執筆 |
| App Deployment CI | アプリケーションの lint・テスト・ビルド・デプロイ（GitHub Actions） |
| Docs Deployment CI | ドキュメントの textlint・ビルド・デプロイ（GitHub Actions） |

### 現状の問題点

1. **postinstall の不要処理**: CI 環境でもローカル専用の開発者ツール（rulesync、@playwright/cli）がグローバルインストールされる
2. **uv sync の二重実行**: Docs CI build ジョブで postinstall と明示的ステップの両方で `uv sync` が実行される
3. **Mermaid CLI の二重インストール**: devDependencies でのローカルインストールに加え、CI で `pnpm add -g` によるグローバルインストールも行われる
4. **actions/checkout のバージョン不一致**: lint ジョブは `@v4`、build ジョブは `@v5`（未リリースの可能性）
5. **App CI での不要な Python セットアップ**: アプリビルドに Python は不要だが、postinstall で `uv sync` が実行される

## 依存関係の全体像

### Node.js パッケージ（pnpm install）

#### アプリケーション依存

| パッケージ | 用途 | ローカル | App CI | Docs CI |
|---|---|:---:|:---:|:---:|
| react, react-dom | UI フレームワーク | o | o | - |
| react-router-dom | ルーティング | o | o | - |
| papaparse | CSV 解析 | o | o | - |
| lucide-react | アイコン | o | o | - |
| @tanstack/react-virtual | 仮想スクロール | o | o | - |
| ulidx | ID 生成 | o | o | - |

#### ビルド・開発ツール

| パッケージ | 用途 | ローカル | App CI | Docs CI |
|---|---|:---:|:---:|:---:|
| vite, @vitejs/plugin-react | ビルド | o | o (build) | - |
| tailwindcss, postcss 関連 | CSS | o | o (build) | - |
| eslint, eslint-plugin-* | JavaScript lint | o | o (lint) | - |
| prettier | コード整形 | o | - | - |
| vitest, @vitest/coverage-v8 | ユニットテスト | o | o (test) | - |
| @testing-library/*, jsdom | テスト支援 | o | o (test) | - |
| @playwright/test | E2E テスト | o | o (e2e) | - |

#### ドキュメント関連

| パッケージ | 用途 | ローカル | App CI | Docs CI |
|---|---|:---:|:---:|:---:|
| @mermaid-js/mermaid-cli | Mermaid 図 → SVG 変換 | o | - | o (build/本番) |
| textlint, textlint-rule-* | 日本語テキスト lint | o | - | o (lint) |

### Python パッケージ（uv sync）

`pyproject.toml` で管理。ドキュメントビルドに必要。

| パッケージ | 用途 | ローカル | App CI | Docs CI |
|---|---|:---:|:---:|:---:|
| mkdocs | ドキュメントビルド | o | - | o (build) |
| mkdocs-material | テーマ | o | - | o (build) |
| pymdown-extensions | Markdown 拡張 | o | - | o (build) |
| mkdocs-mermaid-to-svg | Mermaid → SVG 変換 | o | - | o (build) |
| mkdocs-svg-to-png | SVG → PNG 変換 | o | - | o (build/本番) |
| mkdocs-awesome-pages-plugin | ページナビゲーション管理 | o | - | o (build) |
| mkdocs-to-pdf | PDF 出力 | o | - | o (build/本番) |
| weasyprint | PDF レンダリング | o | - | o (build/本番) |
| playwright (Python) | ブラウザ自動化（PDF 用） | o | - | o (build/本番) |

### グローバルパッケージ（ローカル開発専用）

| パッケージ | 用途 | ローカル | App CI | Docs CI |
|---|---|:---:|:---:|:---:|
| rulesync | AI ルール同期・生成 | o | - | - |
| @playwright/cli | Playwright ブラウザ管理 | o | - | - |

### システムパッケージ（Docs CI 本番ビルドのみ）

| パッケージ | 用途 |
|---|---|
| libpango-1.0-0, libcairo2 等 | WeasyPrint（PDF レンダリング）のネイティブ依存 |
| fonts-noto-cjk, fonts-noto-cjk-extra | 日本語フォント（PDF 出力用） |

### ワークスペース構成

| 構成 | 説明 | ローカル | App CI | Docs CI |
|---|---|:---:|:---:|:---:|
| docs/openspec ジャンクション | openspec ドキュメントを docs/ 配下に統合 | o | - | o (build) |

## 決定

### 設計方針

1. **セットアップロジックの一元化**: `postinstall-setup.mjs` にすべてのセットアップロジックを集約し、散在を防ぐ
2. **pnpm install による完結**: 各環境で `pnpm install` を実行するだけで環境構築が完了する
3. **環境変数による段階制御**: CI 検知と明示的なフラグで不要な処理をスキップし、パフォーマンスを確保する

### フェーズベースの postinstall 設計

`scripts/postinstall-setup.mjs` を以下の3フェーズに整理する。

```
┌─────────────────────────────────────────────────────┐
│ pnpm install                                        │
│  ├─ Node.js 依存のインストール（pnpm 本体が実行）   │
│  └─ postinstall-setup.mjs（以下のフェーズを実行）   │
│     ├─ Phase 1: ワークスペース構成（全環境）        │
│     ├─ Phase 2: Python 環境（デフォルト有効）       │
│     └─ Phase 3: 開発者ツール（ローカルのみ）        │
└─────────────────────────────────────────────────────┘
```

| フェーズ | 内容 | 実行条件 | 所要時間（目安） |
|---|---|---|---|
| 1. ワークスペース構成 | openspec ジャンクション作成 | 常時 | < 1 秒 |
| 2. Python 環境 | `uv sync`（Python パッケージの同期） | `SKIP_PYTHON_SETUP` が未設定 | 2〜10 秒 |
| 3. 開発者ツール | rulesync / @playwright/cli のグローバルインストール、rulesync generate | `CI` が未設定（ローカルのみ） | 5〜15 秒 |

#### Phase 2 のスキップ制御

App CI ではドキュメントビルド用の Python 環境が不要なため、環境変数 `SKIP_PYTHON_SETUP=true` でスキップできる。

```yaml
# App CI での使用例
- name: 依存パッケージのインストール
  run: pnpm install --frozen-lockfile
  env:
    SKIP_PYTHON_SETUP: 'true'
```

#### Phase 3 の CI 自動スキップ

GitHub Actions は `CI=true` を自動設定するため、CI 環境では Phase 3 が自動的にスキップされる。

### Mermaid CLI の統一

現状の二重インストール（devDependencies + グローバル）を解消する。

- **devDependencies のローカルインストールのみ使用**（`pnpm install` で完了）
- CI での `pnpm add -g @mermaid-js/mermaid-cli` を削除
- `mkdocs-mermaid-to-svg` プラグインは `mmdc` → `npx mmdc` の順でコマンドを解決する。`npx` はローカルの `node_modules/.bin/mmdc` を優先するため、グローバルインストール不要

### 各コンテキストでの実行フロー

#### ローカル開発

```
pnpm install
├─ Node.js 依存インストール
└─ postinstall-setup.mjs
   ├─ Phase 1: openspec ジャンクション作成
   ├─ Phase 2: uv sync（Python 環境構築）
   └─ Phase 3: rulesync + @playwright/cli インストール、rulesync generate
```

#### App Deployment CI

```
pnpm install (SKIP_PYTHON_SETUP=true)
├─ Node.js 依存インストール
└─ postinstall-setup.mjs
   ├─ Phase 1: openspec ジャンクション作成
   ├─ Phase 2: スキップ（SKIP_PYTHON_SETUP=true）
   └─ Phase 3: スキップ（CI=true）
```

#### Docs Deployment CI

```
pnpm install
├─ Node.js 依存インストール
└─ postinstall-setup.mjs
   ├─ Phase 1: openspec ジャンクション作成
   ├─ Phase 2: uv sync（Python 環境構築）
   └─ Phase 3: スキップ（CI=true）
```

### CI ワークフローの変更

#### docs-deployment.yml

| 変更箇所 | 変更内容 | 理由 |
|---|---|---|
| build: `actions/checkout@v5` | `@v4` に統一 | バージョン不一致の解消 |
| build: `uv sync` ステップ | 削除 | postinstall Phase 2 で実行済み |
| build: `pnpm add -g @mermaid-js/mermaid-cli` | 削除 | ローカルインストール + npx フォールバックで代替 |

#### app-deployment.yml

| 変更箇所 | 変更内容 | 理由 |
|---|---|---|
| 全ジョブの `pnpm install` | `SKIP_PYTHON_SETUP: 'true'` を追加 | 不要な Python セットアップのスキップ |

## 影響範囲

### 対象ファイル

- `scripts/postinstall-setup.mjs` — フェーズ分離とログ出力の追加
- `.github/workflows/docs-deployment.yml` — 冗長ステップの削除とバージョン統一
- `.github/workflows/app-deployment.yml` — Python セットアップスキップの追加

### リスク

| リスク | 対策 |
|---|---|
| `npx mmdc` が CI で動作しない | mkdocs-mermaid-to-svg プラグインが `npx mmdc` をフォールバックとして実装済み。`pnpm install` 後は `node_modules/.bin/mmdc` が存在するため、npx はローカルパッケージを使用する |
| postinstall の変更による既存動作への影響 | Phase 1・2 の処理内容は変更なし。Phase 3 は CI でのみスキップされ、ローカル開発には影響なし |

## 参考資料

- [pnpm install --ignore-scripts](https://pnpm.io/cli/install)
- [GitHub Actions: 既定の環境変数](https://docs.github.com/ja/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#default-environment-variables)
- [astral-sh/setup-uv](https://github.com/astral-sh/setup-uv)
- [mkdocs-mermaid-to-svg: コマンド解決ロジック](https://github.com/nuitsjp/mkdocs-mermaid-to-svg)
