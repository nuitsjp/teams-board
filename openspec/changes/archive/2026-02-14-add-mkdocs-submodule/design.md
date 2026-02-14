## Context

Teams Board は React + Vite の SPA だが、`docs/` 配下に業務定義・機能定義等のマークダウンドキュメントが存在する。現状これらのドキュメントをビルド・プレビューする仕組みがなく、MkDocs 環境の導入が必要である。

参照元の ssd-mkdocs-sample リポジトリは以下の構成を持つ：

- **Python 側**: uv + pyproject.toml で MkDocs 関連パッケージを管理（mkdocs-material, pymdown-extensions, mermaid→SVG→PNG 変換プラグイン、 PDF 出力プラグイン）
- **Node.js 側**: pnpm で textlint（日本語校正）、@mermaid-js/mermaid-cli を管理
- **ビルドスクリプト**: `scripts/mkdocs-svg.mjs`、`scripts/mkdocs-pdf.mjs`（Node.js から uv 経由で mkdocs build を実行）
- **エディター設定**: .editorconfig、.vscode/settings.json（textlint 連携）、.vscode/extensions.json
- **GitHub Actions ワークフロー**:
  - `textlint.yml` — docs 変更時に textlint を CI で実行
  - `deploy-site.yml` — MkDocs サイトのビルド・デプロイ（Azure SWA + GitHub Pages）
  - `close-preview.yml` — PR クローズ時のプレビュー環境クリーンアップ

現プロジェクトの既存状態：

- `scripts/` ディレクトリは存在しない
- `.vscode/` ディレクトリは存在しない
- `.editorconfig`、`.gitattributes` は存在しない
- `pnpm-workspace.yaml` は存在するが `onlyBuiltDependencies` のみの設定
- `docs/` 配下にはすでにドキュメントが存在する（`index.md`、`architecture.md`、業務定義フォルダー2件）
- `.github/workflows/deploy.yml` が既存の CI/CD パイプライン（lint → test → build → deploy）。docs 関連のワークフローは未設定

## Goals / Non-Goals

**Goals:**

- ssd-mkdocs-sample の MkDocs 環境を Teams Board に完全移植する
- `pnpm run mkdocs` でドキュメントのライブプレビューができる
- `pnpm run mkdocs:build` でドキュメントの静的ビルドができる
- `pnpm run lint:text` で日本語ドキュメントの校正チェックができる
- `.editorconfig` と `.gitattributes` でエディター設定を統一する
- VS Code で textlint のリアルタイム校正が動作する
- GitHub Actions で textlint が CI チェックとして実行される
- GitHub Actions で MkDocs サイトのビルド・デプロイが実行される（Azure SWA プレビュー + GitHub Pages 本番）

**Non-Goals:**
- `docs/` 配下の既存ドキュメントの textlint ルール適合修正（別途対応）
- ssd-mkdocs-sample のサンプルドキュメント（`docs/サンプル/` 等）の移植
- rulesync の導入（ssd-mkdocs-sample 固有の機能）

## Decisions

### 1. サブモジュールの配置先: `lib/ssd-mkdocs-sample`

`lib/` ディレクトリに配置する。参照完了後にディレクトリごと削除する。`vendor/` や `external/` も検討したが、`lib/` が一般的な外部ライブラリ参照先として適切。

### 2. mkdocs.yml の nav 構成: Teams Board の既存 docs 構造に合わせる

ssd-mkdocs-sample の nav はサンプル用であるため、Teams Board の `docs/` 構造（index.md、architecture.md、業務定義フォルダー）に合わせて新規作成する。プラグイン設定やテーマ設定は参照元をベースに適用する。

### 3. pyproject.toml: 参照元をベースに project 名・description のみ変更

依存パッケージのバージョンは参照元と合わせる。`requires-python >= 3.11` を踏襲。project 名は `teams-board-docs` とする。

### 4. textlint 設定: 参照元の設定をそのまま適用

`.textlintrc.json` は参照元と同一の設定を使用する。日本語文書校正のルールプリセット（preset-japanese, preset-ja-spacing, preset-jtf-style, no-mix-dearu-desumasu, prh + icsmedia 辞書）を導入。`.textlintignore` は参照元の設定をベースに、CLAUDE.md 等のシステムファイルを追加する。

### 5. package.json への統合: 既存の devDependencies にマージ

textlint と @mermaid-js/mermaid-cli を既存の devDependencies に追加する。scripts セクションに MkDocs 関連（`mkdocs`, `mkdocs:build`, `mkdocs:build:svg`, `mkdocs:pdf`）と textlint 関連（`lint:text`, `lint:text:fix`）を追加する。

### 6. .editorconfig: 参照元をそのまま適用

参照元の設定がプロジェクトの既存コーディングスタイル（indent 2/4 spaces, LF, UTF-8）と整合する。

### 7. .gitattributes: 参照元をそのまま適用

`* text=auto eol=lf` で改行コードを LF に統一する。

### 8. .vscode 設定: 新規作成

`.vscode/settings.json` に textlint 設定を追加する。`.vscode/extensions.json` に textlint 拡張の推奨を追加する。参照元の cSpell.words は Teams Board 固有のものに調整する。

### 9. pnpm-workspace.yaml: `ignoredBuiltDependencies` に puppeteer を追加

参照元では puppeteer の built dependencies を無視する設定がある。既存の `onlyBuiltDependencies: [esbuild]` と共存させる形で `ignoredBuiltDependencies: [puppeteer]` を追加する。

### 10. .gitignore への追加: Python・MkDocs 関連エントリ

既存の `.gitignore` に `.venv`、`/site`、`__pycache__/`、`*.py[cod]` 等の Python・MkDocs 関連エントリを追加する。

### 11. GitHub Actions ワークフロー: textlint.yml を追加

参照元の `textlint.yml` をベースに、Teams Board 用に追加する。`docs/**/*.md`、`*.md`、`.textlintrc.json`、`package.json` の変更時に textlint を実行する。既存の `deploy.yml`（アプリの CI/CD）とは独立したワークフローとして配置する。

### 12. GitHub Actions ワークフロー: deploy-site.yml を追加

参照元の `deploy-site.yml` をベースに、MkDocs サイトのビルド・デプロイを行うワークフローを追加する。main push で本番デプロイ（GitHub Pages）、PR でプレビューデプロイ（Azure SWA）を実行する。uv + Python 環境セットアップ、Mermaid CLI、Playwright ブラウザ、PDF 依存関係（fonts-noto-cjk 等）のインストールを含む。

### 13. GitHub Actions ワークフロー: close-preview.yml を追加

PR クローズ時に Azure SWA のプレビュー環境をクリーンアップするワークフロー。参照元をそのまま適用する。必要な Secret: `AZURE_SWA_API_TOKEN`。

## Prerequisites（手動対応・ユーザー実施）

以下はワークフローが動作するための前提条件であり、ユーザーが手動で対応する必要がある：

1. **Azure Static Web Apps リソースの作成** — Azure Portal または Azure CLI で SWA リソースを作成する
2. **AZURE_SWA_API_TOKEN の取得と登録** — SWA のデプロイトークンを取得し、GitHub リポジトリの Secrets に `AZURE_SWA_API_TOKEN` として登録する
3. **GitHub Pages の有効化** — リポジトリの Settings → Pages で GitHub Pages を有効にし、Source を GitHub Actions に設定する
4. **GitHub Environments の設定** — `github-pages` environment が deploy-site ワークフローから参照される。必要に応じて保護ルールを設定する

これらの手動対応が完了するまで、deploy-site.yml と close-preview.yml のワークフローは正常に動作しない。textlint.yml は Secret に依存しないため、即座に動作する。

## Risks / Trade-offs

- **Python ランタイムへの依存追加** → uv を使うことでインストール・管理を簡素化。Python が未インストールの環境では MkDocs 機能のみ利用不可（フロントエンド開発には影響なし）
- **textlint と既存ドキュメントの不整合** → 初回導入時に既存 `docs/` のドキュメントが textlint エラーになる可能性がある。本 change ではルール導入のみとし、既存ドキュメントの修正は別途対応する
- **サブモジュールの一時利用によるコミット履歴の汚れ** → サブモジュール追加・削除が各1コミットとなるが、機能ブランチ上で squash merge するため問題は小さい
- **参照元リポジトリのバージョン固定** → サブモジュール登録時点の最新を参照。一時利用のため、長期的な追従は不要
