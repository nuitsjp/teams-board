<#
.SYNOPSIS
    静的ファイルをAzure Blob Storage ($web コンテナ) にアップロードする

.DESCRIPTION
    frontend/dashboard/dist/ 配下のビルド成果物を $web コンテナにアップロードする。
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
    例: @("frontend/dashboard/dist:")
#>
param(
    [string]$SubscriptionId = "9f8bb535-5bea-4687-819e-7605b47941b5",
    [string]$ResourceGroupName = "z2-rg-usr-z23004-dev-002",
    [string]$StorageAccountName = "strjstudylogprod",
    [string]$SourcePath = "",
    [string[]]$SourcePaths = @()
)

$ErrorActionPreference = 'Stop'

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
            "frontend/dashboard/dist:"
        )
    } else {
        # 従来の単一パス指定（ルートにアップロード）
        $SourcePaths = @("${SourcePath}:")
    }
}

# プロダクションビルド実行
$dashboardDir = Join-Path (Split-Path $PSScriptRoot -Parent) "frontend/dashboard"
Write-Host "プロダクションビルドを実行しています..." -ForegroundColor Cyan
Push-Location $dashboardDir
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "ビルドに失敗しました (exit code: $LASTEXITCODE)"
    }
    Write-Host "ビルド完了" -ForegroundColor Green
} finally {
    Pop-Location
}

# サブスクリプション切替
Write-Host "サブスクリプションを切り替えています..." -ForegroundColor Cyan
Set-AzContext -SubscriptionId $SubscriptionId | Out-Null

# Storageアカウントのコンテキスト取得
Write-Host "Storageアカウント '$StorageAccountName' に接続しています..." -ForegroundColor Cyan
$sa = Get-AzStorageAccount -ResourceGroupName $ResourceGroupName -Name $StorageAccountName
$ctx = $sa.Context

$totalUploadCount = 0
$totalFileCount = 0

# リポジトリルートをスクリプト位置から算出（カレントディレクトリに依存しない）
$repoRoot = Split-Path $PSScriptRoot -Parent

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
    Write-Host "`nアップロード元: $resolvedSourcePath → Blobプレフィックス: $prefixLabel" -ForegroundColor Cyan

    # ファイル一覧の取得（data/ ディレクトリを除外）
    $files = Get-ChildItem -Path $resolvedSourcePath -Recurse -File |
        Where-Object {
            $rel = $_.FullName.Substring($resolvedSourcePath.Path.Length + 1).Replace("\", "/")
            $rel -notlike "data/*"
        }
    $fileCount = @($files).Count

    if ($fileCount -eq 0) {
        Write-Host "  アップロード対象のファイルが見つかりません: $resolvedSourcePath" -ForegroundColor Yellow
        continue
    }

    Write-Host "  アップロード対象: $fileCount ファイル" -ForegroundColor Cyan
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
        Set-AzStorageBlobContent `
            -File $file.FullName `
            -Container '$web' `
            -Blob $blobName `
            -Properties @{ ContentType = $contentType } `
            -Context $ctx `
            -Force | Out-Null

        $uploadCount++
        $totalUploadCount++
        Write-Host "  [$uploadCount/$fileCount] $blobName ($contentType)"
    }
}

# 静的サイトURL取得
$webEndpoint = $sa.PrimaryEndpoints.Web

# 結果出力
Write-Host ""
Write-Host "=== アップロード完了 ===" -ForegroundColor Green
Write-Host "アップロードファイル数: $totalUploadCount / $totalFileCount"
Write-Host "静的サイトURL: $webEndpoint"
