<#
.SYNOPSIS
    Azure Blob Storage ($web コンテナ) のセッションデータをクリアするスクリプト

.DESCRIPTION
    $web コンテナの data/ 配下にアップロードされたセッションデータを削除し、
    data/index.json を空の初期状態にリセットする。
    ローカルファイルには一切変更を加えない。

    対象:
      - data/sessions/*.json  → 全削除
      - data/index.json       → 空の初期状態で上書き

.PARAMETER SubscriptionId
    対象のAzureサブスクリプションID（デフォルト: 9f8bb535-5bea-4687-819e-7605b47941b5）

.PARAMETER ResourceGroupName
    リソースグループ名（デフォルト: z2-rg-usr-z23004-dev-002）

.PARAMETER StorageAccountName
    Storageアカウント名（デフォルト: strjstudylogprod）
#>
param(
    [string]$SubscriptionId = "9f8bb535-5bea-4687-819e-7605b47941b5",
    [string]$ResourceGroupName = "z2-rg-usr-z23004-dev-002",
    [string]$StorageAccountName = "strjstudylogprod"
)

$ErrorActionPreference = 'Stop'

# ============================================================
# Step 1: Azure接続
# ============================================================
Write-Host "=== Step 1: Azure接続 ===" -ForegroundColor Cyan
Write-Host "対象サブスクリプション: $SubscriptionId"
Set-AzContext -SubscriptionId $SubscriptionId | Out-Null
Write-Host "サブスクリプションを切り替えました" -ForegroundColor Green

Write-Host "Storageアカウント '$StorageAccountName' に接続しています..."
$sa = Get-AzStorageAccount -ResourceGroupName $ResourceGroupName -Name $StorageAccountName
$ctx = $sa.Context
Write-Host "Storageアカウントに接続しました" -ForegroundColor Green

# ============================================================
# Step 2: data/ 配下のBlob削除
# ============================================================
Write-Host "`n=== Step 2: data/ 配下のBlob削除 ===" -ForegroundColor Cyan

# data/ 配下のBlob一覧を取得
$blobs = Get-AzStorageBlob -Container '$web' -Prefix 'data/' -Context $ctx

if ($null -eq $blobs -or @($blobs).Count -eq 0) {
    Write-Host "data/ 配下にBlobが存在しません。スキップします。" -ForegroundColor Yellow
    $deleteCount = 0
} else {
    Write-Host "data/ 配下のBlob数: $(@($blobs).Count)"

    # data/index.json 以外のBlobを削除
    $deleteCount = 0
    foreach ($blob in $blobs) {
        if ($blob.Name -eq "data/index.json") {
            Write-Host "  [スキップ] $($blob.Name) (Step 3で上書き)"
            continue
        }
        Remove-AzStorageBlob -Blob $blob.Name -Container '$web' -Context $ctx -Force
        $deleteCount++
        Write-Host "  [削除] $($blob.Name)"
    }
    Write-Host "削除完了: $deleteCount 件のBlobを削除しました" -ForegroundColor Green
}

# ============================================================
# Step 3: 空の index.json で上書き
# ============================================================
Write-Host "`n=== Step 3: index.json の初期化 ===" -ForegroundColor Cyan

# 空のindex.jsonを一時ファイルとして生成
$updatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$indexContent = @{
    studyGroups = @()
    members     = @()
    updatedAt   = $updatedAt
} | ConvertTo-Json -Depth 2

$tempFile = Join-Path $env:TEMP "study-log-empty-index.json"
try {
    # BOMなしUTF-8で書き込み
    [System.IO.File]::WriteAllText($tempFile, $indexContent, [System.Text.UTF8Encoding]::new($false))
    Write-Host "一時ファイルを作成しました: $tempFile"

    # Azure上のdata/index.jsonを上書き
    $blobProperties = @{ ContentType = 'application/json; charset=utf-8' }
    Set-AzStorageBlobContent `
        -File $tempFile `
        -Container '$web' `
        -Blob 'data/index.json' `
        -Properties $blobProperties `
        -Context $ctx `
        -Force | Out-Null
    Write-Host "data/index.json を初期状態で上書きしました" -ForegroundColor Green
    Write-Host "  updatedAt: $updatedAt"
} finally {
    # 一時ファイルの削除
    if (Test-Path $tempFile) {
        Remove-Item $tempFile -Force
        Write-Host "一時ファイルを削除しました"
    }
}

# ============================================================
# Step 4: 結果サマリー
# ============================================================
$webEndpoint = $sa.PrimaryEndpoints.Web

Write-Host "`n=== データクリア完了 ===" -ForegroundColor Cyan
Write-Host "Storageアカウント:         $StorageAccountName"
Write-Host "削除したBlob数:            $deleteCount"
Write-Host "index.json:                初期化済み (updatedAt: $updatedAt)"
Write-Host "静的サイトURL:             $webEndpoint"
Write-Host ""
Write-Host "全ステップが正常に完了しました" -ForegroundColor Green
