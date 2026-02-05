<#
.SYNOPSIS
    静的ファイルをAzure Blob Storage ($web コンテナ) にアップロードする

.DESCRIPTION
    frontend/dashboard/public/ 配下の静的ファイルを $web コンテナにアップロードする。
    ファイル拡張子に基づいて適切なContent-Typeを設定し、
    ディレクトリ構造を維持してBlob名を生成する。

.PARAMETER SubscriptionId
    対象のAzureサブスクリプションID（デフォルト: 9f8bb535-5bea-4687-819e-7605b47941b5）

.PARAMETER ResourceGroupName
    リソースグループ名（デフォルト: z2-rg-usr-z23004-dev-002）

.PARAMETER StorageAccountName
    Storageアカウント名（デフォルト: strjstudylogprod）

.PARAMETER SourcePath
    アップロード元のディレクトリパス（デフォルト: frontend/dashboard/public）
#>
param(
    [string]$SubscriptionId = "9f8bb535-5bea-4687-819e-7605b47941b5",
    [string]$ResourceGroupName = "z2-rg-usr-z23004-dev-002",
    [string]$StorageAccountName = "strjstudylogprod",
    [string]$SourcePath = "frontend/dashboard/public"
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

# サブスクリプション切替
Write-Host "サブスクリプションを切り替えています..." -ForegroundColor Cyan
Set-AzContext -SubscriptionId $SubscriptionId | Out-Null

# Storageアカウントのコンテキスト取得
Write-Host "Storageアカウント '$StorageAccountName' に接続しています..." -ForegroundColor Cyan
$sa = Get-AzStorageAccount -ResourceGroupName $ResourceGroupName -Name $StorageAccountName
$ctx = $sa.Context

# ソースディレクトリの解決
$resolvedSourcePath = Resolve-Path $SourcePath -ErrorAction Stop
Write-Host "アップロード元: $resolvedSourcePath" -ForegroundColor Cyan

# ファイル一覧の取得
$files = Get-ChildItem -Path $resolvedSourcePath -Recurse -File
$totalFiles = $files.Count

if ($totalFiles -eq 0) {
    Write-Host "アップロード対象のファイルが見つかりません: $resolvedSourcePath" -ForegroundColor Yellow
    exit 0
}

Write-Host "アップロード対象: $totalFiles ファイル" -ForegroundColor Cyan
Write-Host ""

# ファイルごとにアップロード
$uploadCount = 0
foreach ($file in $files) {
    # 相対パスからBlob名を生成（パス区切りを / に変換）
    $relativePath = $file.FullName.Substring($resolvedSourcePath.Path.Length + 1)
    $blobName = $relativePath.Replace("\", "/")

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
    Write-Host "  [$uploadCount/$totalFiles] $blobName ($contentType)"
}

# 静的サイトURL取得
$webEndpoint = $sa.PrimaryEndpoints.Web

# 結果出力
Write-Host ""
Write-Host "=== アップロード完了 ===" -ForegroundColor Green
Write-Host "アップロードファイル数: $uploadCount / $totalFiles"
Write-Host "静的サイトURL: $webEndpoint"
