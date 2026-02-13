## 1. ブランチ作成とサブモジュール登録

- [x] 1.1 作業ブランチ `feature/add-mkdocs-submodule` を作成して切り替える
- [x] 1.2 `git submodule add https://github.com/ssd-mkdocs-platform/ssd-mkdocs-sample.git lib/ssd-mkdocs-sample` でサブモジュールを登録する

## 2. MkDocs 環境構築（mkdocs-environment）

- [x] 2.1 `pyproject.toml` を作成する（project 名： `teams-board-docs`、requires-python `>= 3.11`、MkDocs 関連依存パッケージ）
- [x] 2.2 `mkdocs.yml` を作成する（Material テーマ、Mermaid サポート、PDF 出力プラグイン、Teams Board の docs 構造に合わせた nav）
- [x] 2.3 `scripts/mkdocs-svg.mjs` を作成する（RENDER_SVG=1 環境変数付き mkdocs build）
- [x] 2.4 `scripts/mkdocs-pdf.mjs` を作成する（RENDER_SVG=1, RENDER_PNG=1, ENABLE_PDF=1 環境変数付き mkdocs build）
- [x] 2.5 `package.json` の scripts に `mkdocs`、`mkdocs:build`、`mkdocs:build:svg`、`mkdocs:pdf` を追加する
- [x] 2.6 `pnpm-workspace.yaml` に `ignoredBuiltDependencies: [puppeteer]` を追加する
- [x] 2.7 `.gitignore` に Python・MkDocs 関連エントリ（`.venv`、`/site`、`__pycache__/`、`*.py[cod]`）を追加する

## 3. textlint 環境構築（textlint-setup）

- [x] 3.1 `package.json` の devDependencies に textlint 関連パッケージを追加する
  - textlint、textlint-rule-no-mix-dearu-desumasu、textlint-rule-preset-icsmedia
  - textlint-rule-preset-ja-spacing、textlint-rule-preset-japanese、textlint-rule-preset-jtf-style
  - textlint-rule-prh、@mermaid-js/mermaid-cli
- [x] 3.2 `package.json` の scripts に `lint:text`、`lint:text:fix` を追加する
- [x] 3.3 `.textlintrc.json` を作成する（参照元と同一のルール設定）
- [x] 3.4 `.textlintignore` を作成する（CLAUDE.md、AGENTS.md 等のシステムファイルを除外）
- [x] 3.5 `pnpm install` を実行して依存パッケージをインストールする

## 4. エディター設定（editor-config）

- [x] 4.1 `.editorconfig` を作成する（indent_style、indent_size、end_of_line、charset、ファイルタイプ別設定）
- [x] 4.2 `.gitattributes` を作成する（`* text=auto eol=lf`）
- [x] 4.3 `.vscode/settings.json` を作成する（textlint 設定、cSpell.words）
- [x] 4.4 `.vscode/extensions.json` を作成する（textlint 拡張の推奨）

## 5. GitHub Actions ワークフロー（docs-ci-workflows）

- [x] 5.1 `.github/workflows/textlint.yml` を作成する（docs 変更時の textlint CI チェック）
- [x] 5.2 `.github/workflows/deploy-site.yml` を作成する（MkDocs サイトのビルド・デプロイ： Azure SWA プレビュー + GitHub Pages 本番）
- [x] 5.3 `.github/workflows/close-preview.yml` を作成する（PR クローズ時の Azure SWA プレビュー環境クリーンアップ）

## 6. 動作確認

- [x] 6.1 `uv sync` で Python 環境を構築し、`pnpm run mkdocs` でライブプレビューが起動することを確認する
- [x] 6.2 `pnpm run mkdocs:build` でビルドが成功することを確認する
- [x] 6.3 `pnpm run lint:text` が実行できることを確認する（既存ドキュメントのエラーは許容）

## 7. サブモジュールの削除

- [x] 7.1 参照が不要になった後、サブモジュールを削除する（`git submodule deinit`、`.gitmodules` 削除、`lib/` 削除）

## 8. 手動対応（ユーザー実施）

- [ ] 8.1 Azure Static Web Apps リソースを作成する（Azure Portal / CLI）
- [ ] 8.2 SWA デプロイトークンを取得し、GitHub Secrets に `AZURE_SWA_API_TOKEN` として登録する
- [ ] 8.3 GitHub Pages を有効にする（Settings → Pages → Source: GitHub Actions）
- [ ] 8.4 GitHub Environments で `github-pages` environment を設定する（必要に応じて保護ルールを追加）
