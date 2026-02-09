## 1. 共通関数の改修（Load-EnvSettings.ps1）

- [x] 1.1 `Load-EnvSettings` に `-EnvPath` パラメータを追加。未指定時はプロジェクトルートの `.env` をデフォルトで使用。ファイルが存在しない場合はパスを含むエラーメッセージで `throw` する
- [x] 1.2 `Apply-EnvSettings` 関数を削除する
- [x] 1.3 `Import-EnvParams` 関数を新設する。内部処理: (1) `Load-EnvSettings` で `.env` を読み込み (2) 全キーを `Set-Variable -Scope 1` で呼び出し元スコープに設定 (3) `.env.example` のキー一覧をパースし、`.env` に不足キーがあればキー名を列挙してエラー
- [x] 1.4 `-EnvPath` の相対パス解決を実装（相対パスはプロジェクトルート基準、絶対パスはそのまま使用）
- [x] 1.5 `.env.example` が存在しない場合は必須キー検証をスキップする処理を実装
- [x] 1.6 ファイルヘッダー（.SYNOPSIS, .DESCRIPTION）を更新し、新しい関数構成を反映する

## 2. メインスクリプトの改修

- [x] 2.1 `Clear-Data.ps1`: `param()` から Azure パラメータ3つを削除し `-EnvFile` を追加。`.env` 読み込みボイラープレートを `Import-EnvParams -EnvPath $EnvFile` に置換。スクリプト内の `$SubscriptionId` → `$AZURE_SUBSCRIPTION_ID`、`$ResourceGroupName` → `$AZURE_RESOURCE_GROUP_NAME`、`$StorageAccountName` → `$AZURE_STORAGE_ACCOUNT_NAME` に変更。ヘッダーコメントも更新
- [x] 2.2 `Deploy-StaticFiles.ps1`: 同様の改修（`$SourcePath`, `$SourcePaths` パラメータは維持）
- [x] 2.3 `New-SasToken.ps1`: 同様の改修（`$PolicyName` パラメータは維持）
- [x] 2.4 `Show-Urls.ps1`: 同様の改修（`$PolicyName` パラメータは維持）

## 3. .env.example の整理

- [x] 3.1 `AZURE_LOCATION` が未使用であれば `.env.example` から削除する
- [x] 3.2 各キーの説明コメントが現状と整合しているか確認・更新する

## 4. 動作確認

- [x] 4.1 `.env` が存在する状態で各スクリプトを引数なしで実行し、正常動作を確認
- [x] 4.2 `.env` を一時削除し、エラーメッセージが表示されることを確認
- [x] 4.3 `-EnvFile ".env.example"` を指定し、別ファイルからの読み込みが動作することを確認
- [x] 4.4 `.env.example` に存在するキーを `.env` から1つ削除し、不足キーエラーが表示されることを確認
