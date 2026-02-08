<#
.SYNOPSIS
    TeamsBoard用Azureインフラストラクチャをプロビジョニングするスクリプト

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

# local.settings.json からの設定読み込み
. (Join-Path $PSScriptRoot "Load-LocalSettings.ps1")
$localSettings = Load-LocalSettings
$applied = Apply-LocalSettings -Settings $localSettings -BoundParameters $PSBoundParameters -ParameterMap @{
    "SubscriptionId"     = "subscriptionId"
    "ResourceGroupName"  = "resourceGroupName"
    "StorageAccountName" = "storageAccountName"
    "Location"           = "location"
}
foreach ($key in $applied.Keys) {
    Set-Variable -Name $key -Value $applied[$key]
}

# ============================================================
# Step 1: サブスクリプション切替
# ============================================================
Write-Host "=== Step 1: サブスクリプション切替 ===" -ForegroundColor Cyan
Write-Host "対象サブスクリプション: $SubscriptionId"
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) { throw "サブスクリプションの切り替えに失敗しました" }
Write-Host "サブスクリプションを切り替えました" -ForegroundColor Green

# ============================================================
# Step 2: リソースグループの存在確認と作成/利用
# ============================================================
Write-Host "`n=== Step 2: リソースグループの確認 ===" -ForegroundColor Cyan
$rgJson = az group show --name $ResourceGroupName 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "リソースグループ '$ResourceGroupName' が存在しません。新規作成します..."
    az group create --name $ResourceGroupName --location $Location | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "リソースグループの作成に失敗しました" }
    Write-Host "リソースグループを作成しました: $ResourceGroupName ($Location)" -ForegroundColor Green
} else {
    $rgObj = $rgJson | ConvertFrom-Json
    Write-Host "既存のリソースグループを利用します: $ResourceGroupName ($($rgObj.location))" -ForegroundColor Yellow
}

# ============================================================
# Step 3: Storageアカウントの作成/設定強制上書き
# ============================================================
Write-Host "`n=== Step 3: Storageアカウントの確認 ===" -ForegroundColor Cyan
$saJson = az storage account show --resource-group $ResourceGroupName --name $StorageAccountName 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Storageアカウント '$StorageAccountName' が存在しません。新規作成します..."
    az storage account create `
        --resource-group $ResourceGroupName `
        --name $StorageAccountName `
        --location $Location `
        --sku "Standard_LRS" `
        --kind "StorageV2" `
        --access-tier "Hot" `
        --min-tls-version "TLS1_2" `
        --https-only true `
        --allow-blob-public-access false `
        --yes | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Storageアカウントの作成に失敗しました" }
    Write-Host "Storageアカウントを作成しました: $StorageAccountName" -ForegroundColor Green
} else {
    Write-Host "既存のStorageアカウント '$StorageAccountName' の設定を強制上書きします..."
    az storage account update `
        --resource-group $ResourceGroupName `
        --name $StorageAccountName `
        --sku "Standard_LRS" `
        --access-tier "Hot" `
        --min-tls-version "TLS1_2" `
        --https-only true `
        --allow-blob-public-access false `
        --yes | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Storageアカウントの設定更新に失敗しました" }
    Write-Host "Storageアカウントの設定を上書きしました: StorageV2 / Standard_LRS / Hot / TLS1.2 / HTTPS only" -ForegroundColor Green
}

# ネットワークルール: 静的サイトへのパブリックアクセスを許可
Write-Host "ネットワークルールを設定しています (defaultAction=Allow)..."
az storage account update `
    --resource-group $ResourceGroupName `
    --name $StorageAccountName `
    --default-action Allow | Out-Null
if ($LASTEXITCODE -ne 0) { throw "ネットワークルールの設定に失敗しました" }
Write-Host "ネットワークルールを適用しました" -ForegroundColor Green

# アカウントキーを取得（Step 4以降のデータプレーン操作に使用）
$accountKey = (az storage account keys list --resource-group $ResourceGroupName --account-name $StorageAccountName --query "[0].value" --output tsv)
if ($LASTEXITCODE -ne 0) { throw "Storageアカウントキーの取得に失敗しました" }

# ============================================================
# Step 4: 静的サイトホスティングの有効化
# ============================================================
Write-Host "`n=== Step 4: 静的サイトホスティングの有効化 ===" -ForegroundColor Cyan
az storage blob service-properties update `
    --account-name $StorageAccountName `
    --static-website `
    --index-document "index.html" `
    --404-document "index.html" `
    --account-key $accountKey | Out-Null
if ($LASTEXITCODE -ne 0) { throw "静的サイトホスティングの有効化に失敗しました" }
Write-Host "静的サイトホスティングを有効化しました (Index: index.html, Error: index.html)" -ForegroundColor Green

# エンドポイントURLの取得
$endpointsJson = az storage account show `
    --resource-group $ResourceGroupName `
    --name $StorageAccountName `
    --query "primaryEndpoints" `
    --output json
$endpoints = $endpointsJson | ConvertFrom-Json
$webEndpoint = $endpoints.web
$blobEndpoint = $endpoints.blob

Write-Host "静的サイトエンドポイント: $webEndpoint"
Write-Host "BlobサービスエンドポイントURL: $blobEndpoint"

# ============================================================
# Step 5: CORS設定
# ============================================================
Write-Host "`n=== Step 5: CORS設定 ===" -ForegroundColor Cyan

# 静的サイトエンドポイントからオリジンを取得（末尾スラッシュを除去）
$allowedOrigin = $webEndpoint.TrimEnd('/')

# 既存のCORSルールをクリアしてから設定
az storage cors clear --account-name $StorageAccountName --services b --account-key $accountKey | Out-Null
az storage cors add `
    --account-name $StorageAccountName `
    --services b `
    --methods GET PUT HEAD `
    --origins $allowedOrigin `
    --allowed-headers "x-ms-blob-type" "x-ms-blob-content-type" "content-type" "x-ms-version" `
    --exposed-headers "x-ms-meta-*" `
    --max-age 3600 `
    --account-key $accountKey | Out-Null
if ($LASTEXITCODE -ne 0) { throw "CORS設定に失敗しました" }
Write-Host "CORS設定を適用しました" -ForegroundColor Green
Write-Host "  AllowedOrigins: $allowedOrigin"
Write-Host "  AllowedMethods: GET, PUT, HEAD"
Write-Host "  AllowedHeaders: x-ms-blob-type, x-ms-blob-content-type, content-type, x-ms-version"
Write-Host "  ExposedHeaders: x-ms-meta-*"

# ============================================================
# Step 6: Stored Access Policy の作成/更新
# ============================================================
Write-Host "`n=== Step 6: Stored Access Policy ===" -ForegroundColor Cyan

$expiryTime = (Get-Date).AddDays($PolicyExpiryDays).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# 既存ポリシーの一覧を取得して存在チェック
$policiesJson = az storage container policy list `
    --container-name '$web' `
    --account-name $StorageAccountName `
    --account-key $accountKey `
    --output json 2>$null
$policyExists = $false
if ($LASTEXITCODE -eq 0 -and $policiesJson) {
    $policies = $policiesJson | ConvertFrom-Json
    if ($policies.PSObject.Properties.Name -contains $PolicyName) {
        $policyExists = $true
    }
}

if (-not $policyExists) {
    Write-Host "Stored Access Policy '$PolicyName' が存在しません。新規作成します..."
    az storage container policy create `
        --container-name '$web' `
        --name $PolicyName `
        --permissions rcwl `
        --expiry $expiryTime `
        --account-name $StorageAccountName `
        --account-key $accountKey | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Stored Access Policyの作成に失敗しました" }
    Write-Host "Stored Access Policyを作成しました: $PolicyName (権限: rcwl, 有効期限: $expiryTime)" -ForegroundColor Green
} else {
    Write-Host "既存のStored Access Policy '$PolicyName' を上書きします..."
    az storage container policy update `
        --container-name '$web' `
        --name $PolicyName `
        --permissions rcwl `
        --expiry $expiryTime `
        --account-name $StorageAccountName `
        --account-key $accountKey | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Stored Access Policyの更新に失敗しました" }
    Write-Host "Stored Access Policyを更新しました: $PolicyName (権限: rcwl, 有効期限: $expiryTime)" -ForegroundColor Green
}

# ============================================================
# Step 7: data/index.json の初期配置
# ============================================================
Write-Host "`n=== Step 7: data/index.json の初期配置 ===" -ForegroundColor Cyan

$existingIndex = az storage blob show `
    --container-name '$web' `
    --name 'data/index.json' `
    --account-name $StorageAccountName `
    --account-key $accountKey 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "data/index.json が存在しません。空の初期データを配置します..."
    $updatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $indexContent = @{
        groups    = @()
        members   = @()
        updatedAt = $updatedAt
    } | ConvertTo-Json -Depth 2

    $tempFile = Join-Path $env:TEMP "teams-board-empty-index.json"
    try {
        [System.IO.File]::WriteAllText($tempFile, $indexContent, [System.Text.UTF8Encoding]::new($false))
        az storage blob upload `
            --file $tempFile `
            --container-name '$web' `
            --name 'data/index.json' `
            --content-type 'application/json; charset=utf-8' `
            --account-name $StorageAccountName `
            --account-key $accountKey `
            --overwrite | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "data/index.json の配置に失敗しました" }
        Write-Host "data/index.json を初期配置しました (updatedAt: $updatedAt)" -ForegroundColor Green
    } finally {
        if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
    }
} else {
    Write-Host "data/index.json は既に存在します。スキップします。" -ForegroundColor Yellow
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
