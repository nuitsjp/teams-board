<#
.SYNOPSIS
    blob-static-dashboard用Azureインフラストラクチャをプロビジョニングするスクリプト

.DESCRIPTION
    Azure Storage Account（静的サイトホスティング、CORS、Stored Access Policy）を
    冪等にプロビジョニングする。既存リソースの存在を確認し、Storageアカウントの設定は
    常に正しい値に強制上書きする。

.PARAMETER SubscriptionId
    対象のAzureサブスクリプションID（デフォルト: 9f8bb535-5bea-4687-819e-7605b47941b5）

.PARAMETER ResourceGroupName
    リソースグループ名（デフォルト: z2-rg-usr-z23004-dev-002）

.PARAMETER StorageAccountName
    Storageアカウント名（デフォルト: strjstudylogprod）

.PARAMETER Location
    リソースのリージョン（デフォルト: japaneast）

.PARAMETER PolicyName
    Stored Access Policyの名前（デフォルト: dashboard-admin）

.PARAMETER PolicyExpiryDays
    Stored Access Policyの有効期限日数（デフォルト: 30）
#>
param(
    [string]$SubscriptionId = "9f8bb535-5bea-4687-819e-7605b47941b5",
    [string]$ResourceGroupName = "z2-rg-usr-z23004-dev-002",
    [string]$StorageAccountName = "strjstudylogprod",
    [string]$Location = "japaneast",
    [string]$PolicyName = "dashboard-admin",
    [int]$PolicyExpiryDays = 30
)

$ErrorActionPreference = 'Stop'

# ============================================================
# Step 1: サブスクリプション切替
# ============================================================
Write-Host "=== Step 1: サブスクリプション切替 ===" -ForegroundColor Cyan
Write-Host "対象サブスクリプション: $SubscriptionId"
Set-AzContext -SubscriptionId $SubscriptionId | Out-Null
Write-Host "サブスクリプションを切り替えました" -ForegroundColor Green

# ============================================================
# Step 2: リソースグループの存在確認と作成/利用
# ============================================================
Write-Host "`n=== Step 2: リソースグループの確認 ===" -ForegroundColor Cyan
$rg = Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction SilentlyContinue

if ($null -eq $rg) {
    Write-Host "リソースグループ '$ResourceGroupName' が存在しません。新規作成します..."
    $rg = New-AzResourceGroup -Name $ResourceGroupName -Location $Location
    Write-Host "リソースグループを作成しました: $ResourceGroupName ($Location)" -ForegroundColor Green
} else {
    Write-Host "既存のリソースグループを利用します: $ResourceGroupName ($($rg.Location))" -ForegroundColor Yellow
}

# ============================================================
# Step 3: Storageアカウントの作成/設定強制上書き
# ============================================================
Write-Host "`n=== Step 3: Storageアカウントの確認 ===" -ForegroundColor Cyan
$sa = Get-AzStorageAccount -ResourceGroupName $ResourceGroupName -Name $StorageAccountName -ErrorAction SilentlyContinue

if ($null -eq $sa) {
    Write-Host "Storageアカウント '$StorageAccountName' が存在しません。新規作成します..."
    $sa = New-AzStorageAccount `
        -ResourceGroupName $ResourceGroupName `
        -Name $StorageAccountName `
        -Location $Location `
        -SkuName "Standard_LRS" `
        -Kind "StorageV2" `
        -AccessTier "Hot" `
        -MinimumTlsVersion "TLS1_2" `
        -EnableHttpsTrafficOnly $true `
        -AllowBlobPublicAccess $false
    Write-Host "Storageアカウントを作成しました: $StorageAccountName" -ForegroundColor Green
} else {
    Write-Host "既存のStorageアカウント '$StorageAccountName' の設定を強制上書きします..."
    $sa = Set-AzStorageAccount `
        -ResourceGroupName $ResourceGroupName `
        -Name $StorageAccountName `
        -SkuName "Standard_LRS" `
        -AccessTier "Hot" `
        -MinimumTlsVersion "TLS1_2" `
        -EnableHttpsTrafficOnly $true `
        -AllowBlobPublicAccess $false
    Write-Host "Storageアカウントの設定を上書きしました: StorageV2 / Standard_LRS / Hot / TLS1.2 / HTTPS only" -ForegroundColor Green
}

# ネットワークアクセス制限の設定（Azure Policy準拠: defaultAction=Deny）
Write-Host "ネットワークルールを設定しています (defaultAction=Deny, bypass=AzureServices)..."
Update-AzStorageAccountNetworkRuleSet `
    -ResourceGroupName $ResourceGroupName `
    -Name $StorageAccountName `
    -DefaultAction Deny `
    -Bypass AzureServices
Write-Host "ネットワークアクセス制限を適用しました" -ForegroundColor Green

$ctx = $sa.Context

# ============================================================
# Step 4: 静的サイトホスティングの有効化
# ============================================================
Write-Host "`n=== Step 4: 静的サイトホスティングの有効化 ===" -ForegroundColor Cyan
Enable-AzStorageStaticWebsite `
    -Context $ctx `
    -IndexDocument "index.html" `
    -ErrorDocument404Path "index.html"
Write-Host "静的サイトホスティングを有効化しました (Index: index.html, Error: index.html)" -ForegroundColor Green

# Storageアカウント情報を再取得してエンドポイントURLを取得
$sa = Get-AzStorageAccount -ResourceGroupName $ResourceGroupName -Name $StorageAccountName
$webEndpoint = $sa.PrimaryEndpoints.Web
$blobEndpoint = $sa.PrimaryEndpoints.Blob

Write-Host "静的サイトエンドポイント: $webEndpoint"
Write-Host "BlobサービスエンドポイントURL: $blobEndpoint"

# ============================================================
# Step 5: CORS設定
# ============================================================
Write-Host "`n=== Step 5: CORS設定 ===" -ForegroundColor Cyan

# 静的サイトエンドポイントからオリジンを取得（末尾スラッシュを除去）
$allowedOrigin = $webEndpoint.TrimEnd('/')

$corsRule = @{
    AllowedOrigins  = @($allowedOrigin)
    AllowedMethods  = @("GET", "PUT", "HEAD")
    AllowedHeaders  = @("x-ms-blob-type", "x-ms-blob-content-type", "content-type", "x-ms-version")
    ExposedHeaders  = @("x-ms-meta-*")
    MaxAgeInSeconds = 3600
}

Set-AzStorageCORSRule -ServiceType Blob -CorsRules @($corsRule) -Context $ctx
Write-Host "CORS設定を適用しました" -ForegroundColor Green
Write-Host "  AllowedOrigins: $allowedOrigin"
Write-Host "  AllowedMethods: GET, PUT, HEAD"
Write-Host "  AllowedHeaders: x-ms-blob-type, x-ms-blob-content-type, content-type, x-ms-version"
Write-Host "  ExposedHeaders: x-ms-meta-*"

# ============================================================
# Step 6: Stored Access Policy の作成/更新
# ============================================================
Write-Host "`n=== Step 6: Stored Access Policy ===" -ForegroundColor Cyan

$expiryTime = (Get-Date).AddDays($PolicyExpiryDays)
$existingPolicy = Get-AzStorageContainerStoredAccessPolicy `
    -Container '$web' `
    -Policy $PolicyName `
    -Context $ctx `
    -ErrorAction SilentlyContinue

if ($null -eq $existingPolicy) {
    Write-Host "Stored Access Policy '$PolicyName' が存在しません。新規作成します..."
    New-AzStorageContainerStoredAccessPolicy `
        -Container '$web' `
        -Policy $PolicyName `
        -Permission "rcwl" `
        -ExpiryTime $expiryTime `
        -Context $ctx
    Write-Host "Stored Access Policyを作成しました: $PolicyName (権限: rcwl, 有効期限: $expiryTime)" -ForegroundColor Green
} else {
    Write-Host "既存のStored Access Policy '$PolicyName' を上書きします..."
    Set-AzStorageContainerStoredAccessPolicy `
        -Container '$web' `
        -Policy $PolicyName `
        -Permission "rcwl" `
        -ExpiryTime $expiryTime `
        -Context $ctx
    Write-Host "Stored Access Policyを更新しました: $PolicyName (権限: rcwl, 有効期限: $expiryTime)" -ForegroundColor Green
}

# ============================================================
# 完了サマリー
# ============================================================
Write-Host "`n=== プロビジョニング完了 ===" -ForegroundColor Cyan
Write-Host "リソースグループ:              $ResourceGroupName"
Write-Host "Storageアカウント:             $StorageAccountName"
Write-Host "静的サイトエンドポイント:       $webEndpoint"
Write-Host "Blobサービスエンドポイント:     $blobEndpoint"
Write-Host "Stored Access Policy:          $PolicyName (有効期限: $expiryTime)"
Write-Host ""
Write-Host "全ステップが正常に完了しました" -ForegroundColor Green
