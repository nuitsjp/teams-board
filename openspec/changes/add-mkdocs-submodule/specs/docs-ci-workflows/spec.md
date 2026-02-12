## ADDED Requirements

### Requirement: textlint CI ワークフロー
`.github/workflows/textlint.yml` を追加し、ドキュメント変更時に textlint を CI で自動実行する。

#### Scenario: トリガー条件
- **WHEN** `docs/**/*.md`、`*.md`、`.textlintrc.json`、`package.json` のいずれかが変更された push または pull_request が発生する
- **THEN** textlint ワークフローが実行される

#### Scenario: workflow_dispatch による手動実行
- **WHEN** GitHub UI から workflow_dispatch で手動実行する
- **THEN** textlint ワークフローが実行される

#### Scenario: textlint ジョブの実行内容
- **WHEN** textlint ジョブが実行される
- **THEN** pnpm のセットアップ、Node.js のセットアップ、`pnpm install --frozen-lockfile`、`pnpm run lint:text` が順に実行される

### Requirement: MkDocs サイトデプロイワークフロー
`.github/workflows/deploy-site.yml` を追加し、MkDocs サイトのビルドとデプロイを自動実行する。

#### Scenario: トリガー条件
- **WHEN** `docs/**`、`mkdocs.yml`、`pyproject.toml`、`uv.lock`、`.github/workflows/deploy-site.yml` のいずれかが変更された push（main ブランチ）または pull_request が発生する
- **THEN** deploy-site ワークフローが実行される

#### Scenario: 本番ビルド（main push）
- **WHEN** main ブランチへの push またはワークフロー手動実行で purpose=production が選択される
- **THEN** uv sync、Mermaid CLI インストール、Playwright ブラウザインストール、PDF 依存関係インストール（fonts-noto-cjk 等）が実行され、Web ビルド（RENDER_SVG=1）と PDF ビルド（RENDER_SVG=1, RENDER_PNG=1, ENABLE_PDF=1）が生成される

#### Scenario: プレビュービルド（PR）
- **WHEN** pull_request が発生する
- **THEN** uv sync と `uv run mkdocs build` のみが実行され、簡易ビルドが生成される

#### Scenario: Azure SWA へのデプロイ
- **WHEN** ビルドが完了し、同一リポジトリからの PR である
- **THEN** `Azure/static-web-apps-deploy@v1` を使用して `site/` ディレクトリがデプロイされる。Secret `AZURE_SWA_API_TOKEN` を使用する

#### Scenario: GitHub Pages へのデプロイ
- **WHEN** 本番ビルドが完了する（main push）
- **THEN** `actions/upload-pages-artifact@v3` でアーティファクトをアップロードし、`actions/deploy-pages@v4` で GitHub Pages にデプロイされる

### Requirement: プレビュー環境クリーンアップワークフロー
`.github/workflows/close-preview.yml` を追加し、PR クローズ時に Azure SWA のプレビュー環境を削除する。

#### Scenario: PR クローズ時のクリーンアップ
- **WHEN** pull_request_target の closed イベントが発生する
- **THEN** `Azure/static-web-apps-deploy@v1` の `action: close` が実行され、プレビュー環境が削除される。Secret `AZURE_SWA_API_TOKEN` を使用する
