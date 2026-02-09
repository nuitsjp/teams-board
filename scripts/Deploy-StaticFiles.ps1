<#
.SYNOPSIS
    静的ファイルをAzure Blob Storage ($web コンテナ) にアップロードする

.DESCRIPTION
    dist/ 配下のビルド成果物を $web コンテナにアップロードする。
    ファイル拡張子に基づいて適切なContent-Typeを設定し、
    ディレクトリ構造を維持してBlob名を生成する。
    Viteプロダクションビルド出力（React SPA）をデプロイする。
    data/ ディレクトリはデータのライフサイクルが異なるため除外される。

.PARAMETER SubscriptionId
    対象のAzureサブスクリプションID（デフォルト: 9f8bb535-5bea-4687-819e-7605b47941b5）

.PARAMETER ResourceGroupName
    リソースグループ名（デフォルト: z2-rg-usr-z23004-dev-002）

.PARAMETER StorageAccountName
    Storageアカウント名（デフォルト: strjstudylogprod）

.PARAMETER SourcePath
    アップロード元のディレクトリパス（後方互換用、単一ディレクトリ指定時に使用）

.PARAMETER SourcePaths
    アップロード元のディレクトリとBlobプレフィックスの配列。
    各要素は "ローカルパス:Blobプレフィックス" 形式。
    Blobプレフィックスが空の場合はルートにアップロード。
    例: @("dist:")
#>
param(
    [string]$SubscriptionId = "9f8bb535-5bea-4687-819e-7605b47941b5",
    [string]$ResourceGroupName = "z2-rg-usr-z23004-dev-002",
    [string]$StorageAccountName = "strjstudylogprod",
    [string]$SourcePath = "",
    [string[]]$SourcePaths = @()
)

$ErrorActionPreference = 'Stop'

# 共通関数の読み込み
. (Join-Path $PSScriptRoot "common" "Write-Log.ps1")
. (Join-Path $PSScriptRoot "common" "Load-EnvSettings.ps1")
. (Join-Path $PSScriptRoot "common" "Connect-AzureStorage.ps1")
$envSettings = Load-EnvSettings
$applied = Apply-EnvSettings -Settings $envSettings -BoundParameters $PSBoundParameters -ParameterMap @{
    "SubscriptionId"     = "AZURE_SUBSCRIPTION_ID"
    "ResourceGroupName"  = "AZURE_RESOURCE_GROUP_NAME"
    "StorageAccountName" = "AZURE_STORAGE_ACCOUNT_NAME"
}
foreach ($key in $applied.Keys) {
    Set-Variable -Name $key -Value $applied[$key]
}

# リポジトリルートをスクリプト位置から算出（scripts/ から1階層上）
$repoRoot = Split-Path $PSScriptRoot -Parent

# MIME型マッピングテーブル
$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".woff" = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"  = "font/ttf"
    ".map"  = "application/json"
}

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
    $env:VITE_BLOB_BASE_URL = "https://${StorageAccountName}.blob.core.windows.net/`$web"
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
$accountKey = Connect-AzureStorage -SubscriptionId $SubscriptionId -ResourceGroupName $ResourceGroupName -StorageAccountName $StorageAccountName

$totalUploadCount = 0
$totalFileCount = 0

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

    # ファイル一覧の取得（data/ ディレクトリを除外）
    $files = Get-ChildItem -Path $resolvedSourcePath -Recurse -File |
        Where-Object {
            $rel = $_.FullName.Substring($resolvedSourcePath.Path.Length + 1).Replace("\", "/")
            $rel -notlike "data/*"
        }
    $fileCount = @($files).Count

    if ($fileCount -eq 0) {
        Write-Warn "  アップロード対象のファイルが見つかりません: $resolvedSourcePath"
        continue
    }

    Write-Action "  アップロード対象: $fileCount ファイル"
    $totalFileCount += $fileCount

    # ファイルごとにアップロード
    $uploadCount = 0
    foreach ($file in $files) {
        # 相対パスからBlob名を生成（パス区切りを / に変換）
        $relativePath = $file.FullName.Substring($resolvedSourcePath.Path.Length + 1)
        $blobName = $relativePath.Replace("\", "/")

        # Blobプレフィックスがある場合は先頭に付与
        if ($blobPrefix -ne "") {
            $blobName = "$blobPrefix/$blobName"
        }

        # 拡張子からContent-Typeを決定
        $ext = $file.Extension.ToLower()
        $contentType = if ($mimeTypes.ContainsKey($ext)) {
            $mimeTypes[$ext]
        } else {
            "application/octet-stream"
        }

        # アップロード
        az storage blob upload `
            --file $file.FullName `
            --container-name '$web' `
            --name $blobName `
            --content-type $contentType `
            --account-name $StorageAccountName `
            --account-key $accountKey `
            --overwrite | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Blobアップロードに失敗しました: $blobName" }

        $uploadCount++
        $totalUploadCount++
        Write-Info "  [$uploadCount/$fileCount] $blobName ($contentType)"
    }
}

# 静的サイトURL取得
$webEndpoint = (az storage account show --resource-group $ResourceGroupName --name $StorageAccountName --query "primaryEndpoints.web" --output tsv)

# 結果出力
Write-Step "アップロード完了"
Write-Detail "アップロードファイル数" "$totalUploadCount / $totalFileCount"
Write-Detail "静的サイトURL" $webEndpoint
