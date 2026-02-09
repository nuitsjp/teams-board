## Requirements

### Requirement: .env設定読み込み関数の提供
`scripts/common/Load-EnvSettings.ps1` は `Load-EnvSettings` 関数と `Apply-EnvSettings` 関数を提供しなければならない（SHALL）。`Load-EnvSettings` はプロジェクトルートの `.env` ファイルを読み込み、キーと値のハッシュテーブルを返す。`Apply-EnvSettings` はコマンドライン引数で明示指定されていないパラメータに .env の値を適用する。

#### Scenario: .envファイルが存在する場合の読み込み
- **WHEN** プロジェクトルートに `.env` ファイルが存在する
- **THEN** `Load-EnvSettings` はファイル内の `KEY=VALUE` 形式の行をパースし、キーと値のハッシュテーブルを返す

#### Scenario: .envファイルが存在しない場合
- **WHEN** プロジェクトルートに `.env` ファイルが存在しない
- **THEN** `Load-EnvSettings` は `$null` を返す

#### Scenario: コマンドライン引数が未指定のパラメータへの.env値の適用
- **WHEN** `Apply-EnvSettings` に Settings、BoundParameters、ParameterMap を渡す
- **THEN** BoundParameters に含まれないパラメータのみ、ParameterMap に基づいて .env の値が適用される

### Requirement: Azure Storage接続関数の提供
`scripts/common/Connect-AzureStorage.ps1` は `Connect-AzureStorage` 関数を提供しなければならない（SHALL）。この関数はAzureサブスクリプション切替・Storageアカウント接続確認・アカウントキー取得を一括で実行し、アカウントキーを返す。

#### Scenario: Azure Storageへの正常接続
- **WHEN** 有効な SubscriptionId、ResourceGroupName、StorageAccountName を指定して `Connect-AzureStorage` を呼び出す
- **THEN** サブスクリプションが切り替わり、Storageアカウントの存在が確認され、アカウントキーが返される

#### Scenario: サブスクリプション切替の失敗
- **WHEN** 無効な SubscriptionId を指定して `Connect-AzureStorage` を呼び出す
- **THEN** エラーメッセージ付きの例外がスローされる

#### Scenario: Storageアカウントが見つからない場合
- **WHEN** 存在しない StorageAccountName を指定して `Connect-AzureStorage` を呼び出す
- **THEN** エラーメッセージ付きの例外がスローされる

#### Scenario: アカウントキー取得の失敗
- **WHEN** アカウントキーの取得に失敗した場合
- **THEN** エラーメッセージ付きの例外がスローされる

### Requirement: 共通関数ファイルの配置場所
共通関数ファイルは `scripts/common/` ディレクトリに配置しなければならない（MUST）。各スクリプトは `$PSScriptRoot` 基準の相対パスでドットソースする。

#### Scenario: スクリプトからの共通関数読み込み
- **WHEN** `scripts/` 直下のスクリプトが共通関数を使用する
- **THEN** `. (Join-Path $PSScriptRoot "common" "<ファイル名>.ps1")` の形式でドットソースする

### Requirement: 既存スクリプトの共通関数への移行
既存の5スクリプト（Clear-Data, Deploy-StaticFiles, New-SasToken, Show-Urls, Deploy-Infrastructure）は、Azure接続処理の重複コードを `Connect-AzureStorage` 関数の呼び出しに置き換えなければならない（MUST）。パラメータインターフェースは変更してはならない（MUST NOT）。

#### Scenario: 既存スクリプトのパラメータ互換性
- **WHEN** 移行後のスクリプトを既存のパラメータで呼び出す
- **THEN** 移行前と同じ動作結果が得られる

#### Scenario: .env読み込みと共通関数の併用
- **WHEN** 移行後のスクリプトが実行される
- **THEN** .env読み込み → Apply-EnvSettings → Connect-AzureStorage の順で処理が実行される

### Requirement: スクリプトディレクトリ構造のフラット化
`scripts/infra/` 配下の全スクリプトを `scripts/` 直下に移動し、`scripts/infra/` ディレクトリを削除しなければならない（MUST）。

#### Scenario: infra階層の廃止
- **WHEN** 移行が完了した時点で
- **THEN** `scripts/infra/` ディレクトリは存在せず、全スクリプトは `scripts/` 直下に配置されている

#### Scenario: プロジェクト内の参照パスの更新
- **WHEN** プロジェクト内に `scripts/infra/` を参照している箇所がある場合
- **THEN** 参照パスが `scripts/` に更新されている
