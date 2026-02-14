## 1. アプリ配信フロー再編

- [x] 1.1 `deploy.yml` から `lint/test/build` のCI責務を独立した `ci-workflow` へ分離し、デプロイ/クリーンアップ処理を除外する
- [x] 1.2 アプリデプロイを `app-deployment` として再編し、`pull_request: main` で `dev`、`push: main` で `prod` を同一実体で分岐する
- [x] 1.3 アプリデプロイ前に対象refの `ci-workflow` 成功を検証するゲートを実装する
- [x] 1.4 Storage Account への配信ステップ（`az storage blob upload-batch`）をdev/prodで共通化し、Environment差分のみ残す
- [x] 1.5 PR向けE2Eの実行条件をアプリdevデプロイ後に限定し、main pushでは実行しない

## 2. ドキュメント配信最適化

- [x] 2.1 `deploy-site.yml` のトリガーを `pull_request: main` / `push: main` + docs関連pathsに限定する
- [x] 2.2 `docs-site-deployment` 冒頭で `pnpm run lint:text` を実行し、失敗時に後続build/deployを中断させる
- [x] 2.3 preview/production分岐を1ワークフロー内で整理し、PRはpreview配信、main pushはproduction配信に固定する
- [x] 2.4 個別 `textlint-workflow` を削除し、重複実行が発生しないことを確認する
- [x] 2.5 docs手動実行（`workflow_dispatch`）を削除し、自動トリガーのみで運用する

## 3. プレビュークリーンアップ強化

- [x] 3.1 `close-preview.yml` を `pull_request_target: closed` のみに限定する
- [x] 3.2 プレビューがすでに不存在でも失敗停止しない冪等クローズ手順を実装する
- [x] 3.3 permissionsを最小権限に調整し、不要な書き込み権限を排除する

## 4. 共通セットアップと実行制御

- [x] 4.1 Node.js/pnpm/uvセットアップをCI・アプリ配信・docs配信で再利用できる共通定義（Reusable Workflow または Composite Action）に切り出す
- [x] 4.2 各ワークフローのconcurrencyを用途別（CI:最新優先、デプロイ：整合性優先、クリーンアップ：冪等優先）に設定する
- [x] 4.3 パスフィルター対象にワークフロー定義変更を含め、実行漏れ/過剰実行を抑制する

## 5. 検証と運用文書更新

- [x] 5.1 `openspec validate optimize-github-actions-workflows --type change` を実行し、差分仕様の整合を確認する
- [ ] 5.2 PRで `pull_request: main` と `push: main` の実行経路（CI→app-deployment / docs-site-deployment）をログで確認する
  補足：5.2 はこのブランチのPR作成後に GitHub Actions 実行ログで確認する。
- [x] 5.3 運用ドキュメントに最終トリガー対応表とCIゲート条件を追記する
