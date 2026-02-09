<#
.SYNOPSIS
    静的ファイルをAzure Blob Storage ($web コンテナ) にアップロードする

.DESCRIPTION
    dist/ 配下のビルド成果物を $web コンテナに一括アップロードする。
    az storage blob upload-batch を使用し、ディレクトリ構造を維持してデプロイする。
    Viteプロダクションビルド出力（React SPA）をデプロイする。
    data/ ディレクトリはデータのライフサイクルが異なるため除外される。

.PARAMETER EnvFile
    .env ファイルのパス（デフォルト: プロジェクトルートの .env）

.PARAMETER SourcePath
    アップロード元のディレクトリパス（後方互換用、単一ディレクトリ指定時に使用）

.PARAMETER SourcePaths
    アップロード元のディレクトリとBlobプレフィックスの配列。
    各要素は "ローカルパス:Blobプレフィックス" 形式。
    Blobプレフィックスが空の場合はルートにアップロード。
    例: @("dist:")
#>
param(
    [string]$EnvFile = "",
    [string]$SourcePath = "",
    [string[]]$SourcePaths = @()
)

$ErrorActionPreference = 'Stop'

# 共通関数の読み込み
. (Join-Path $PSScriptRoot "common" "Write-Log.ps1")
. (Join-Path $PSScriptRoot "common" "Load-EnvSettings.ps1")
. (Join-Path $PSScriptRoot "common" "Connect-AzureStorage.ps1")
Import-EnvParams -EnvPath $EnvFile

# リポジトリルートをスクリプト位置から算出（scripts/ から1階層上）
$repoRoot = Split-Path $PSScriptRoot -Parent

# SourcePaths が未指定の場合、SourcePath から構築（後方互換）
if ($SourcePaths.Count -eq 0) {
    if ($SourcePath -eq "") {
        # デフォルト: dist/ をルートにデプロイ（Viteビルド成果物）
        $SourcePaths = @(
            "dist:"
        )
    } else {
        # 従来の単一パス指定（ルートにアップロード）
        $SourcePaths = @("${SourcePath}:")
    }
}

# テスト実行・プロダクションビルド
$appRoot = $repoRoot
Push-Location $appRoot
try {
    # テスト実行
    Write-Action "テストを実行しています..."
    & pnpm run test
    if ($LASTEXITCODE -ne 0) {
        throw "テストに失敗しました (exit code: $LASTEXITCODE)。デプロイを中断します。"
    }
    Write-Success "テスト完了"

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

foreach ($sourceEntry in $SourcePaths) {
    # "ローカルパス:Blobプレフィックス" を分割
    $parts = $sourceEntry.Split(":", 2)
    $localPath = $parts[0]
    $blobPrefix = if ($parts.Count -gt 1) { $parts[1] } else { "" }

    # ソースディレクトリの解決（リポジトリルート基準）
    $fullLocalPath = if ([System.IO.Path]::IsPathRooted($localPath)) {
        $localPath
    } else {
        Join-Path $repoRoot $localPath
    }
    $resolvedSourcePath = Resolve-Path $fullLocalPath -ErrorAction Stop
    $prefixLabel = if ($blobPrefix -eq "") { "(ルート)" } else { $blobPrefix }
    Write-Action "アップロード元: $resolvedSourcePath → Blobプレフィックス: $prefixLabel"

    # data/ ディレクトリを除外（CIと同様に物理削除）
    $dataDir = Join-Path $resolvedSourcePath "data"
    if (Test-Path $dataDir) {
        Remove-Item -Path $dataDir -Recurse -Force
        Write-Info "  data/ ディレクトリを除外しました"
    }

    # upload-batch で一括アップロード
    if ($blobPrefix -ne "") {
        az storage blob upload-batch `
            --source $resolvedSourcePath `
            --destination '$web' `
            --destination-path $blobPrefix `
            --account-name $AZURE_STORAGE_ACCOUNT_NAME `
            --account-key $accountKey `
            --overwrite
    } else {
        az storage blob upload-batch `
            --source $resolvedSourcePath `
            --destination '$web' `
            --account-name $AZURE_STORAGE_ACCOUNT_NAME `
            --account-key $accountKey `
            --overwrite
    }
    if ($LASTEXITCODE -ne 0) { throw "Blobアップロードに失敗しました: $resolvedSourcePath" }
}

# 静的サイトURL取得
$webEndpoint = (az storage account show --resource-group $AZURE_RESOURCE_GROUP_NAME --name $AZURE_STORAGE_ACCOUNT_NAME --query "primaryEndpoints.web" --output tsv)

# 結果出力
Write-Step "アップロード完了"
Write-Detail "静的サイトURL" $webEndpoint
