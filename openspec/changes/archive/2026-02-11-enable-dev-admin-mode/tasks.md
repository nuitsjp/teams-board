## 1. Viteプラグインの拡張

- [x] 1.1 `vite.config.js`の`serveDevFixtures`プラグインにPOSTリクエストハンドラを追加
- [x] 1.2 `/dev-fixtures-write`エンドポイントのリクエストボディパース処理を実装
- [x] 1.3 `dev-fixtures/<path>`へのファイル書き込み処理を実装（`fs.promises.writeFile`）
- [x] 1.4 ディレクトリが存在しない場合の自動作成処理を実装（`fs.promises.mkdir`の`recursive: true`）
- [x] 1.5 JSON形式でのインデント付き保存を実装（`JSON.stringify(data, null, 2)`）
- [x] 1.6 エラーハンドリングを実装（ディスク容量不足、権限エラーなど）
- [x] 1.7 成功時・失敗時のレスポンス形式を実装（`{ success: true/false, error?: string }`）

## 2. useAuthの修正

- [x] 2.1 `src/hooks/useAuth.jsx`を開いて現在の実装を確認
- [x] 2.2 ダミートークン判定ロジックを追加（`token === "dev" && import.meta.env.DEV`）
- [x] 2.3 ダミートークン使用時に`isAdmin: true`を返すように修正
- [x] 2.4 本番環境では`token === "dev"`を無効化することを確認（`import.meta.env.DEV`が`false`の場合）
- [x] 2.5 実際のSASトークン使用時の動作が変わらないことを確認（既存のロジックを保持）
- [x] 2.6 開発環境でダミートークン使用時にコンソールに情報メッセージを表示（`console.info`）

## 3. BlobWriterの修正

- [x] 3.1 `src/services/BlobWriter.js`を開いて現在の実装を確認
- [x] 3.2 開発環境とダミートークンの検出ロジックを追加（`import.meta.env.DEV`と`token === "dev"`）
- [x] 3.3 モック動作用の`writeToDevFixtures`関数を実装（`POST /dev-fixtures-write`へのfetchリクエスト）
- [x] 3.4 `putBlob`関数内で開発環境かつダミートークン使用時に`writeToDevFixtures`を呼び出すように分岐
- [x] 3.5 実際のSASトークン使用時は通常のAzure Blob Storage APIを呼び出すロジックを保持
- [x] 3.6 本番環境では通常のAzure Blob Storage APIのみを使用することを確認
- [x] 3.7 モック動作初回使用時にコンソールに警告を表示（`console.warn`）
- [x] 3.8 エラー時の適切なエラーハンドリングを実装（Viteプラグインからのエラーレスポンスを伝播）

## 4. ドキュメントの更新

- [x] 4.1 `README.md`に開発用ダミートークンの使用方法を追加
- [x] 4.2 `?token=dev`でのアクセス方法を記載（`http://localhost:5173/?token=dev`）
- [x] 4.3 実際のSASトークンとの共存について説明
- [x] 4.4 `dev-fixtures/data/`のクリーンアップ方法を記載（任意）
- [x] 4.5 CLAUDE.mdに開発用管理者モードの説明を追加（必要に応じて）

## 5. テストの追加

- [x] 5.1 `tests/react/hooks/useAuth.test.jsx`を作成または更新
- [x] 5.2 開発環境でダミートークン使用時のテストケースを追加
- [x] 5.3 本番環境でダミートークンが無効化されるテストケースを追加（`import.meta.env.DEV`のモック）
- [x] 5.4 実際のSASトークン使用時のテストケースを追加
- [x] 5.5 `tests/data/BlobWriter.test.js`を作成または更新
- [x] 5.6 開発環境でのモック動作のテストケースを追加（fetchのモック）
- [x] 5.7 本番環境での通常動作のテストケースを追加
- [x] 5.8 E2Eテスト（`e2e/admin.spec.js`など）にダミートークンを使用した管理者モードのシナリオを追加
- [x] 5.9 E2Eテストで`?token=dev`でのAdminPageアクセスをテスト
- [x] 5.10 E2Eテストでグループ名編集やCSV一括保存の動作をテスト

## 6. 検証とクリーンアップ

- [ ] 6.1 開発環境（`pnpm run dev`）で`?token=dev`での管理者モードアクセスを手動テスト
- [ ] 6.2 AdminPageでグループ名編集を実行し、`dev-fixtures/data/index.json`が更新されることを確認
- [ ] 6.3 CSV一括保存を実行し、`dev-fixtures/data/sessions/`にファイルが作成されることを確認
- [ ] 6.4 書き込まれたデータがDataFetcherで正しく読み込まれることを確認
- [ ] 6.5 実際のSASトークン使用時に通常のAzure Blob Storageに書き込まれることを確認（任意）
- [ ] 6.6 本番ビルド（`pnpm run build`）を実行し、ビルドが成功することを確認
- [ ] 6.7 本番ビルドの出力（`dist/`）に開発用コードが含まれていないことを確認（手動または自動）
- [ ] 6.8 本番ビルドで`?token=dev`が無効化されることを確認（E2Eテストまたは手動）
- [ ] 6.9 ユニットテスト（`pnpm test`）とE2Eテスト（`pnpm run test:e2e`）を実行し、すべてパスすることを確認
- [x] 6.10 Lintとフォーマット（`pnpm run lint`、`pnpm run format`）を実行し、コードスタイルを確認

## 7. CI/CDとドキュメント最終確認

- [ ] 7.1 GitHub Actionsのワークフロー（`.github/workflows/deploy.yml`）が引き続き動作することを確認
- [ ] 7.2 開発ブランチへのpushで自動テストとデプロイが成功することを確認
- [ ] 7.3 READMEのドキュメントが正確で分かりやすいことを最終確認
- [ ] 7.4 コードレビュー準備（変更内容の要約、テスト結果の添付など）
- [ ] 7.5 mainブランチへのマージとデプロイ
