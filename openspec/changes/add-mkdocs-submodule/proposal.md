## Why

Teams Board プロジェクトには `docs/` 配下に業務定義・機能定義等のマークダウンドキュメントが存在するが、それらをビルド・プレビューするための **MkDocs 環境が未整備**である。[ssd-mkdocs-sample](https://github.com/ssd-mkdocs-platform/ssd-mkdocs-sample) リポジトリには MkDocs Material テーマ、Mermaid→SVG→PNG 変換、PDF 出力、日本語テキスト校正（textlint）など、ドキュメント基盤として必要な環境が一式揃っている。このリポジトリを**参照元として一時的にサブモジュール登録**し、必要なファイルを**すべてカレントリポジトリに直接適用**することで、ドキュメントのローカルプレビュー・ビルド・品質チェックを可能にする。参照完了後、サブモジュールは削除する。

## What Changes

- **git サブモジュールの一時登録と削除**: `ssd-mkdocs-platform/ssd-mkdocs-sample` を参照用にサブモジュール登録し、必要ファイルの適用完了後に削除する
- **Python 環境の導入**: `pyproject.toml` を追加し、MkDocs およびプラグイン群（mkdocs-material, pymdown-extensions, mkdocs-mermaid-to-svg, mkdocs-svg-to-png, mkdocs-to-pdf, weasyprint, playwright）を uv で管理
- **mkdocs.yml の作成**: Teams Board 用に `docs/` をソースとした MkDocs 設定ファイルを作成（Material テーマ、Mermaid サポート、PDF 出力等）
- **textlint の導入**: `.textlintrc.json`、`.textlintignore` を追加し、日本語文書校正ルール（preset-japanese, preset-ja-spacing, preset-jtf-style, no-mix-dearu-desumasu, prh）を設定
- **npm scripts の追加**: `package.json` に MkDocs 関連コマンド（`mkdocs`, `mkdocs:build`, `mkdocs:build:svg`, `mkdocs:pdf`）と textlint コマンド（`lint:text`, `lint:text:fix`）を追加
- **devDependencies の追加**: textlint 本体および各種ルールプリセット（textlint-rule-preset-japanese, textlint-rule-preset-ja-spacing, textlint-rule-preset-jtf-style, textlint-rule-no-mix-dearu-desumasu, textlint-rule-prh, textlint-rule-preset-icsmedia）、@mermaid-js/mermaid-cli を追加
- **ビルドスクリプトの追加**: `scripts/mkdocs-svg.mjs`、`scripts/mkdocs-pdf.mjs` を追加
- **エディター設定の追加/更新**: `.editorconfig` の追加、`.vscode/settings.json` への textlint 設定追加、`.vscode/extensions.json` への textlint 拡張推奨追加
- **.gitattributes の追加**: 改行コード LF 統一（`* text=auto eol=lf`）
- **GitHub Actions ワークフローの追加**: textlint CI チェック（`textlint.yml`）、MkDocs サイトビルド・デプロイ（`deploy-site.yml`）、プレビュー環境クリーンアップ（`close-preview.yml`）

## Capabilities

### New Capabilities

- `mkdocs-environment`: MkDocs 環境構築（pyproject.toml、mkdocs.yml、ビルドスクリプト、npm scripts）。サブモジュールは参照用に一時登録し、適用完了後に削除する
- `textlint-setup`: textlint による日本語テキスト校正環境（設定ファイル、ルールプリセット、VS Code 連携）
- `editor-config`: エディター設定の統一（.editorconfig、.gitattributes、VS Code 設定）
- `docs-ci-workflows`: GitHub Actions ワークフロー（textlint CI、MkDocs サイトデプロイ、プレビュー環境クリーンアップ）

### Modified Capabilities

（既存の spec に対する要件変更なし）

## Impact

- **依存関係**: Python（uv 経由）が新たに必要。Node.js 側は textlint 関連パッケージが devDependencies に追加
- **CI/CD**: textlint CI ワークフロー、MkDocs デプロイワークフロー、プレビュー環境クリーンアップワークフローを追加。必要な Secret: `AZURE_SWA_API_TOKEN`
- **ソースコード**: アプリケーションコードへの変更なし。`docs/` 配下の既存ドキュメントは textlint ルールに適合するよう修正が必要になる可能性あり
- **ビルド**: 既存の Vite ビルドには影響なし。MkDocs ビルドは独立したワークフロー
- **ディスク**: Python 仮想環境 + MkDocs ビルド成果物で追加容量が必要（サブモジュールは最終的に削除）
