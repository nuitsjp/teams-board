## ADDED Requirements

### Requirement: サブモジュールの一時登録と削除
ssd-mkdocs-platform/ssd-mkdocs-sample を参照用に `lib/ssd-mkdocs-sample` にサブモジュールとして登録し、必要ファイルの適用完了後に削除する。サブモジュールは最終成果物に含まれず、カレントリポジトリに直接適用されたファイル群のみが残る。

#### Scenario: サブモジュールの登録
- **WHEN** `git submodule add` で ssd-mkdocs-sample を `lib/ssd-mkdocs-sample` に登録する
- **THEN** `lib/ssd-mkdocs-sample/` 配下に参照元リポジトリの内容が取得される

#### Scenario: サブモジュールの削除
- **WHEN** 必要ファイルの適用が完了した後にサブモジュールを削除する
- **THEN** `.gitmodules`、`.git/config` のサブモジュール設定、`lib/` ディレクトリが削除され、リポジトリにサブモジュールの痕跡が残らない

### Requirement: pyproject.toml による Python 依存管理
プロジェクトルートに `pyproject.toml` を配置し、MkDocs および関連プラグインを uv で管理する。

#### Scenario: pyproject.toml の内容
- **WHEN** `pyproject.toml` を作成する
- **THEN** project 名は `teams-board-docs`、`requires-python >= "3.11"` とし、以下の依存パッケージを含む： `mkdocs>=1.5.0`、`mkdocs-material>=9.0.0`、`pymdown-extensions>=10.0.0`、`mkdocs-mermaid-to-svg>=1.1.3`、`mkdocs-svg-to-png>=0.0.7`、`mkdocs-mermaid2-plugin>=1.1.0`、`mkdocs-to-pdf>=0.1.0`、`weasyprint>=60.0`、`playwright>=1.40.0`

#### Scenario: uv sync による環境構築
- **WHEN** `uv sync` を実行する
- **THEN** `.venv/` に Python 仮想環境が作成され、すべての依存パッケージがインストールされる

### Requirement: mkdocs.yml の作成
Teams Board の `docs/` ディレクトリをソースとした MkDocs 設定ファイルを作成する。

#### Scenario: テーマとプラグイン設定
- **WHEN** `mkdocs.yml` を作成する
- **THEN** Material テーマ（`language: ja`、`content.code.copy` feature）を使用し、以下のプラグインを含む： search、mermaid-to-svg（`enabled_if_env: RENDER_SVG`）、svg-to-png（`enabled_if_env: RENDER_PNG`）、to-pdf（`enabled_if_env: ENABLE_PDF`）

#### Scenario: nav 構成
- **WHEN** `mkdocs.yml` の nav を定義する
- **THEN** Teams Board の既存 `docs/` 構造（index.md、architecture.md、業務定義フォルダー）に合わせた構成とする

#### Scenario: Markdown 拡張
- **WHEN** `mkdocs.yml` の markdown_extensions を定義する
- **THEN** attr_list、admonition、pymdownx.details、pymdownx.tabbed、pymdownx.superfences（mermaid カスタムフェンス付き）、pymdownx.highlight、toc（permalink 付き）を含む

### Requirement: MkDocs ライブプレビュー
`pnpm run mkdocs` でドキュメントのライブプレビューサーバーを起動できる。

#### Scenario: ライブプレビューの起動
- **WHEN** `pnpm run mkdocs` を実行する
- **THEN** `uv run mkdocs serve --livereload` が実行され、ローカルサーバーが起動する

### Requirement: MkDocs 静的ビルド
`pnpm run mkdocs:build` でドキュメントの静的サイトをビルドできる。

#### Scenario: 通常ビルド
- **WHEN** `pnpm run mkdocs:build` を実行する
- **THEN** `uv run mkdocs build` が実行され、`site/` ディレクトリにビルド成果物が生成される

### Requirement: MkDocs SVG ビルドスクリプト
`scripts/mkdocs-svg.mjs` により Mermaid 図を SVG に変換するビルドを実行できる。

#### Scenario: SVG ビルドの実行
- **WHEN** `pnpm run mkdocs:build:svg` を実行する
- **THEN** `scripts/mkdocs-svg.mjs` が `RENDER_SVG=1` 環境変数付きで `uv run mkdocs build` を実行し、Mermaid 図が SVG に変換される

### Requirement: MkDocs PDF ビルドスクリプト
`scripts/mkdocs-pdf.mjs` により PDF 出力を含むビルドを実行できる。

#### Scenario: PDF ビルドの実行
- **WHEN** `pnpm run mkdocs:pdf` を実行する
- **THEN** `scripts/mkdocs-pdf.mjs` が `RENDER_SVG=1`、`RENDER_PNG=1`、`ENABLE_PDF=1` 環境変数付きで `uv run mkdocs build` を実行し、PDF ファイルが生成される

### Requirement: .gitignore への Python・MkDocs エントリ追加
既存の `.gitignore` に Python および MkDocs 関連のエントリを追加する。

#### Scenario: 追加されるエントリ
- **WHEN** `.gitignore` を更新する
- **THEN** `.venv`、`/site`、`__pycache__/`、`*.py[cod]` のエントリが追加される

### Requirement: pnpm-workspace.yaml の更新
`pnpm-workspace.yaml` に puppeteer の ignoredBuiltDependencies を追加する。

#### Scenario: puppeteer の除外設定
- **WHEN** `pnpm-workspace.yaml` を更新する
- **THEN** 既存の `onlyBuiltDependencies: [esbuild]` に加えて `ignoredBuiltDependencies: [puppeteer]` が追加される
