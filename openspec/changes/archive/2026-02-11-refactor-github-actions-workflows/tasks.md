## 1. test.yml を ci.yml にリネーム・書き換え

- [x] 1.1 `git mv .github/workflows/test.yml .github/workflows/ci.yml` でファイルをリネーム
- [x] 1.2 ワークフロー名を "CI" に変更
- [x] 1.3 トリガーを `push: branches: [main]` と `pull_request: branches: [main]` に設定
- [x] 1.4 パスフィルタを追加（`src/**`, `tests/**`, `e2e/**`, `package.json`, `pnpm-lock.yaml`, `vite.config.js`, `.eslintrc.cjs`, `.github/workflows/ci.yml`）
- [x] 1.5 concurrency設定を追加（`group: ci-${{ github.ref }}`, `cancel-in-progress: true`）
- [x] 1.6 testジョブを定義（Node.js 22, pnpm install, pnpm test）
- [x] 1.7 lintジョブを定義（Node.js 22, pnpm install, pnpm run lint）
- [x] 1.8 buildジョブを定義（Node.js 22, pnpm install, pnpm run build）
- [x] 1.9 3つのジョブが並列実行されるように設定（`needs` なし）

## 2. deploy.yml の大幅改修

- [x] 2.1 トリガーを `push: branches: [main]` のみに限定（pull_request削除）
- [x] 2.2 パスフィルタを追加（`src/**`, `tests/**`, `e2e/**`, `package.json`, `pnpm-lock.yaml`, `vite.config.js`, `.github/workflows/deploy.yml`）
- [x] 2.3 concurrency設定を追加（`group: deploy-prod`, `cancel-in-progress: false`）
- [x] 2.4 testジョブを削除
- [x] 2.5 lintジョブを削除
- [x] 2.6 deployジョブから `needs` と `if` 条件を削除
- [x] 2.7 環境を固定値 `prod` に変更（条件分岐削除）
- [x] 2.8 初期データ配置ステップを削除（`scripts/seed/index.json` 参照の削除）
- [x] 2.9 OIDC認証設定を確認（既存の設定を維持）

## 3. deploy-dev.yml の新規作成

- [x] 3.1 `.github/workflows/deploy-dev.yml` を新規作成
- [x] 3.2 ワークフロー名を "Deploy to Dev Environment" に設定
- [x] 3.3 トリガーを `workflow_dispatch` のみに設定（自動トリガーなし）
- [x] 3.4 concurrency設定を追加（`group: deploy-dev`, `cancel-in-progress: true`）
- [x] 3.5 deployジョブを定義（deploy.ymlのdeployジョブをベースに）
- [x] 3.6 環境を固定値 `dev` に設定
- [x] 3.7 OIDC認証設定を追加（deploy.ymlと同様）
- [x] 3.8 デプロイステップの後にE2Eテスト統合の拡張ポイントコメントを追加
- [x] 3.9 初期データ配置ステップは含めない

## 4. 検証とテスト

- [x] 4.1 変更内容をコミット
- [x] 4.2 feature branchからmainへのPRを作成
- [x] 4.3 PRでci.ymlが発火し、test/lint/buildが並列実行されることを確認
- [x] 4.4 PRでdeploy.ymlが発火**しない**ことを確認
- [x] 4.5 PRに追加のコミットをpushし、古いCI実行がキャンセルされることを確認
- [x] 4.6 ドキュメントのみの変更（README.md等）でCIが発火しないことを確認
- [x] 4.7 PRをmainブランチにマージ
- [x] 4.8 マージ後にci.ymlとdeploy.ymlの両方が発火することを確認
- [x] 4.9 deploy.ymlが本番環境（prod）にデプロイすることを確認
- [x] 4.10 GitHub Actions UIからdeploy-dev.ymlを手動実行できることを確認
- [x] 4.11 deploy-dev.ymlが開発環境（dev）にデプロイすることを確認
