<#
.SYNOPSIS
    静的ファイルをAzure Blob Storage ($web コンテナ) にアップロードする

.DESCRIPTION
    テスト・Lint・プロダクションビルドを実行し、dist/ 配下のビルド成果物を
    $web コンテナに一括アップロードする。CIワークフローと同等の品質チェックを
    ローカルで実行する。data/ ディレクトリはライフサイクルが異なるため除外し、
    初回デプロイ時のみシードデータを配置する。

.PARAMETER EnvFile
    .env ファイルのパス（デフォルト: プロジェクトルートの .env）
#>
param(
    [string]$EnvFile = ""
)

$ErrorActionPreference = 'Stop'

# 共通関数の読み込み
. (Join-Path $PSScriptRoot "common" "Write-Log.ps1")
. (Join-Path $PSScriptRoot "common" "Load-EnvSettings.ps1")
. (Join-Path $PSScriptRoot "common" "Connect-AzureStorage.ps1")
Import-EnvParams -EnvPath $EnvFile

# リポジトリルートをスクリプト位置から算出（scripts/ から1階層上）
$repoRoot = Split-Path $PSScriptRoot -Parent

# テスト・Lint・プロダクションビルド
Push-Location $repoRoot
try {
    # テスト実行
    Write-Action "テストを実行しています..."
    & pnpm run test
    if ($LASTEXITCODE -ne 0) {
        throw "テストに失敗しました (exit code: $LASTEXITCODE)。デプロイを中断します。"
    }
    Write-Success "テスト完了"

    # Lint実行
    Write-Action "Lintを実行しています..."
    & pnpm run lint
    if ($LASTEXITCODE -ne 0) {
        throw "Lintに失敗しました (exit code: $LASTEXITCODE)。デプロイを中断します。"
    }
    Write-Success "Lint完了"

    # プロダクションビルド実行（環境変数でBlobエンドポイントを注入）
    $env:VITE_BLOB_BASE_URL = "https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/`$web"
    Write-Action "プロダクションビルドを実行しています..."
    Write-Detail "VITE_BLOB_BASE_URL" $env:VITE_BLOB_BASE_URL
    & pnpm run build
    if ($LASTEXITCODE -ne 0) {
        throw "ビルドに失敗しました (exit code: $LASTEXITCODE)"
    }
    Write-Success "ビルド完了"
} finally {
    Pop-Location
}

# Azure接続・アカウントキー取得
$accountKey = Connect-AzureStorage -SubscriptionId $AZURE_SUBSCRIPTION_ID -ResourceGroupName $AZURE_RESOURCE_GROUP_NAME -StorageAccountName $AZURE_STORAGE_ACCOUNT_NAME

# ソースディレクトリ（dist/ 固定）
$sourcePath = Join-Path $repoRoot "dist"
Write-Action "アップロード元: $sourcePath"

# data/ ディレクトリを除外（CIと同様に物理削除）
$dataDir = Join-Path $sourcePath "data"
if (Test-Path $dataDir) {
    Remove-Item -Path $dataDir -Recurse -Force
    Write-Info "data/ ディレクトリを除外しました"
}

# upload-batch で一括アップロード
az storage blob upload-batch `
    --source $sourcePath `
    --destination '$web' `
    --account-name $AZURE_STORAGE_ACCOUNT_NAME `
    --account-key $accountKey `
    --overwrite
if ($LASTEXITCODE -ne 0) { throw "Blobアップロードに失敗しました" }

# 初期データの配置（data/index.json が存在しない場合のみ）
$existsResult = az storage blob exists `
    --container-name '$web' `
    --name 'data/index.json' `
    --account-name $AZURE_STORAGE_ACCOUNT_NAME `
    --account-key $accountKey `
    --output tsv `
    --query exists
if ($existsResult -eq "false") {
    $seedFile = Join-Path $repoRoot "scripts" "seed" "index.json"
    Write-Action "初期データを配置しています..."
    az storage blob upload `
        --file $seedFile `
        --container-name '$web' `
        --name 'data/index.json' `
        --content-type 'application/json; charset=utf-8' `
        --account-name $AZURE_STORAGE_ACCOUNT_NAME `
        --account-key $accountKey `
        --overwrite
    if ($LASTEXITCODE -ne 0) { throw "初期データのアップロードに失敗しました" }
    Write-Success "初期 data/index.json をアップロードしました"
} else {
    Write-Info "data/index.json は既に存在します。スキップしました"
}

# 静的サイトURL取得・結果出力
$webEndpoint = (az storage account show --resource-group $AZURE_RESOURCE_GROUP_NAME --name $AZURE_STORAGE_ACCOUNT_NAME --query "primaryEndpoints.web" --output tsv)
Write-Step "アップロード完了"
Write-Detail "静的サイトURL" $webEndpoint
