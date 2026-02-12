## 1. Azure OIDC 認証の設定

- [ ] 1.1 Azure Portal でアプリケーション登録を作成
- [ ] 1.2 フェデレーション資格情報を追加（GitHub リポジトリ、main ブランチ用と Pull Request 用）
- [ ] 1.3 本番環境のストレージアカウントに `Storage Blob Data Contributor` ロールを付与
- [ ] 1.4 開発環境のストレージアカウントに `Storage Blob Data Contributor` ロールを付与

## 2. GitHub Secrets の設定

- [ ] 2.1 `AZURE_CLIENT_ID` を GitHub Secrets に追加
- [ ] 2.2 `AZURE_TENANT_ID` を GitHub Secrets に追加
- [ ] 2.3 `AZURE_SUBSCRIPTION_ID` を GitHub Secrets に追加
- [ ] 2.4 `AZURE_STORAGE_ACCOUNT_PROD` を GitHub Secrets に追加
- [ ] 2.5 `AZURE_STORAGE_ACCOUNT_DEV` を GitHub Secrets に追加
- [ ] 2.6 `VITE_BLOB_BASE_URL_PROD` を GitHub Secrets に追加
- [ ] 2.7 `VITE_BLOB_BASE_URL_DEV` を GitHub Secrets に追加

## 3. ワークフローファイルの基本構造作成

- [x] 3.1 `.github/workflows/deploy.yml` ファイルを作成
- [x] 3.2 ワークフロー名とトリガー設定を追加（main ブランチ push と Pull Request）
- [x] 3.3 permissions 設定を追加（id-token: write, contents: read）

## 4. CI ジョブの実装（Lint とテスト）

- [x] 4.1 lint ジョブを作成（ubuntu-latest）
- [x] 4.2 lint ジョブに checkout アクションを追加
- [x] 4.3 lint ジョブに Node.js セットアップを追加（pnpm キャッシュ有効化）
- [x] 4.4 lint ジョブに pnpm インストールを追加
- [x] 4.5 lint ジョブに依存関係インストールを追加
- [x] 4.6 lint ジョブに `pnpm run lint` を追加
- [x] 4.7 test ジョブを作成（ubuntu-latest）
- [x] 4.8 test ジョブに checkout アクションを追加
- [x] 4.9 test ジョブに Node.js セットアップを追加（pnpm キャッシュ有効化）
- [x] 4.10 test ジョブに pnpm インストールを追加
- [x] 4.11 test ジョブに依存関係インストールを追加
- [x] 4.12 test ジョブに `pnpm test` を追加

## 5. ビルドジョブの実装

- [x] 5.1 build ジョブを作成（needs:[lint, test]）
- [x] 5.2 build ジョブに checkout アクションを追加
- [x] 5.3 build ジョブに Node.js セットアップを追加（pnpm キャッシュ有効化）
- [x] 5.4 build ジョブに pnpm インストールを追加
- [x] 5.5 build ジョブに依存関係インストールを追加
- [x] 5.6 build ジョブに環境変数設定を追加（本番環境用と開発環境用で分岐）
- [x] 5.7 build ジョブに `pnpm run build` を追加
- [x] 5.8 build ジョブにビルド成果物のアップロード（upload-artifact）を追加

## 6. 本番環境デプロイジョブの実装

- [x] 6.1 deploy-prod ジョブを作成（needs: build, if: github.ref == 'refs/heads/main'）
- [x] 6.2 deploy-prod ジョブに checkout アクションを追加
- [x] 6.3 deploy-prod ジョブにビルド成果物のダウンロード（download-artifact）を追加
- [x] 6.4 deploy-prod ジョブに Azure ログインアクション（OIDC）を追加
- [x] 6.5 deploy-prod ジョブに Azure CLI を使った Blob Storage へのアップロードを追加

## 7. 開発環境デプロイジョブの実装

- [x] 7.1 deploy-dev ジョブを作成（needs: build, if: github.event_name == 'pull_request'）
- [x] 7.2 deploy-dev ジョブに checkout アクションを追加
- [x] 7.3 deploy-dev ジョブにビルド成果物のダウンロード（download-artifact）を追加
- [x] 7.4 deploy-dev ジョブに Azure ログインアクション（OIDC）を追加
- [x] 7.5 deploy-dev ジョブに Azure CLI を使った Blob Storage へのアップロードを追加

## 8. E2E テストジョブの実装（開発環境のみ）

- [x] 8.1 e2e-dev ジョブを作成（needs: deploy-dev, if: github.event_name == 'pull_request'）
- [x] 8.2 e2e-dev ジョブに checkout アクションを追加
- [x] 8.3 e2e-dev ジョブに Node.js セットアップを追加（pnpm キャッシュ有効化）
- [x] 8.4 e2e-dev ジョブに pnpm インストールを追加
- [x] 8.5 e2e-dev ジョブに依存関係インストールを追加
- [x] 8.6 e2e-dev ジョブに Playwright ブラウザのキャッシュ設定を追加
- [x] 8.7 e2e-dev ジョブに `pnpm exec playwright install` を追加
- [x] 8.8 e2e-dev ジョブに環境変数設定（VITE_BLOB_BASE_URL_DEV）を追加
- [x] 8.9 e2e-dev ジョブに `pnpm run test:e2e` を追加

## 9. テストと検証

- [ ] 9.1 テスト用ブランチで PR を作成し、開発環境デプロイワークフローが実行されることを確認
- [ ] 9.2 Lint、テスト、ビルドが成功することを確認
- [ ] 9.3 開発環境へのデプロイが成功することを確認
- [ ] 9.4 E2E テストが実行され成功することを確認
- [ ] 9.5 PR を main にマージし、本番環境デプロイワークフローが実行されることを確認
- [ ] 9.6 本番環境へのデプロイが成功することを確認
- [ ] 9.7 本番環境で E2E テストが実行されないことを確認

## 10. ドキュメント作成

- [x] 10.1 README に CI/CD パイプラインの説明を追加
- [x] 10.2 Azure OIDC 設定手順をドキュメント化
- [x] 10.3 GitHub Secrets の設定手順をドキュメント化
- [x] 10.4 ロールバック手順をドキュメント化
