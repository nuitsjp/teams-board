<#
.SYNOPSIS
    Teams Board用Azureインフラストラクチャをプロビジョニングするスクリプト

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

# 共通関数の読み込み
. (Join-Path $PSScriptRoot "common" "Write-Log.ps1")
. (Join-Path $PSScriptRoot "common" "Load-EnvSettings.ps1")
. (Join-Path $PSScriptRoot "common" "Connect-AzureStorage.ps1")
$envSettings = Load-EnvSettings
$applied = Apply-EnvSettings -Settings $envSettings -BoundParameters $PSBoundParameters -ParameterMap @{
    "SubscriptionId"     = "AZURE_SUBSCRIPTION_ID"
    "ResourceGroupName"  = "AZURE_RESOURCE_GROUP_NAME"
    "StorageAccountName" = "AZURE_STORAGE_ACCOUNT_NAME"
    "Location"           = "AZURE_LOCATION"
}
foreach ($key in $applied.Keys) {
    Set-Variable -Name $key -Value $applied[$key]
}

# ============================================================
# Step 1: サブスクリプション切替
# ============================================================
Write-Step "Step 1: サブスクリプション切替"
Write-Detail "対象サブスクリプション" $SubscriptionId
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) { throw "サブスクリプションの切り替えに失敗しました" }
Write-Success "サブスクリプションを切り替えました"

# ============================================================
# Step 2: リソースグループの存在確認と作成/利用
# ============================================================
Write-Step "Step 2: リソースグループの確認"
$rgJson = az group show --name $ResourceGroupName 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Action "リソースグループ '$ResourceGroupName' が存在しません。新規作成します..."
    az group create --name $ResourceGroupName --location $Location | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "リソースグループの作成に失敗しました" }
    Write-Success "リソースグループを作成しました: $ResourceGroupName ($Location)"
} else {
    $rgObj = $rgJson | ConvertFrom-Json
    Write-Warn "既存のリソースグループを利用します: $ResourceGroupName ($($rgObj.location))"
}

# ============================================================
# Step 3: Storageアカウントの作成/設定強制上書き
# ============================================================
Write-Step "Step 3: Storageアカウントの確認"
$saJson = az storage account show --resource-group $ResourceGroupName --name $StorageAccountName 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Action "Storageアカウント '$StorageAccountName' が存在しません。新規作成します..."
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
    Write-Success "Storageアカウントを作成しました: $StorageAccountName"
} else {
    Write-Action "既存のStorageアカウント '$StorageAccountName' の設定を強制上書きします..."
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
    Write-Success "Storageアカウントの設定を上書きしました: StorageV2 / Standard_LRS / Hot / TLS1.2 / HTTPS only"
}

# ネットワークルール: 静的サイトへのパブリックアクセスを許可
Write-Action "ネットワークルールを設定しています (defaultAction=Allow)..."
az storage account update `
    --resource-group $ResourceGroupName `
    --name $StorageAccountName `
    --default-action Allow | Out-Null
if ($LASTEXITCODE -ne 0) { throw "ネットワークルールの設定に失敗しました" }
Write-Success "ネットワークルールを適用しました"

# アカウントキーを取得（Step 4以降のデータプレーン操作に使用）
$accountKey = (az storage account keys list --resource-group $ResourceGroupName --account-name $StorageAccountName --query "[0].value" --output tsv)
if ($LASTEXITCODE -ne 0) { throw "Storageアカウントキーの取得に失敗しました" }

# ============================================================
# Step 4: 静的サイトホスティングの有効化
# ============================================================
Write-Step "Step 4: 静的サイトホスティングの有効化"
az storage blob service-properties update `
    --account-name $StorageAccountName `
    --static-website `
    --index-document "index.html" `
    --404-document "index.html" `
    --account-key $accountKey | Out-Null
if ($LASTEXITCODE -ne 0) { throw "静的サイトホスティングの有効化に失敗しました" }
Write-Success "静的サイトホスティングを有効化しました (Index: index.html, Error: index.html)"

# エンドポイントURLの取得
$endpointsJson = az storage account show `
    --resource-group $ResourceGroupName `
    --name $StorageAccountName `
    --query "primaryEndpoints" `
    --output json
$endpoints = $endpointsJson | ConvertFrom-Json
$webEndpoint = $endpoints.web
$blobEndpoint = $endpoints.blob

Write-Detail "静的サイトエンドポイント" $webEndpoint
Write-Detail "BlobサービスエンドポイントURL" $blobEndpoint

# ============================================================
# Step 5: CORS設定
# ============================================================
Write-Step "Step 5: CORS設定"

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
Write-Success "CORS設定を適用しました"
Write-Detail "AllowedOrigins" $allowedOrigin
Write-Info "  AllowedMethods: GET, PUT, HEAD"
Write-Info "  AllowedHeaders: x-ms-blob-type, x-ms-blob-content-type, content-type, x-ms-version"
Write-Info "  ExposedHeaders: x-ms-meta-*"

# ============================================================
# Step 6: Stored Access Policy の作成/更新
# ============================================================
Write-Step "Step 6: Stored Access Policy"

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
    Write-Action "Stored Access Policy '$PolicyName' が存在しません。新規作成します..."
    az storage container policy create `
        --container-name '$web' `
        --name $PolicyName `
        --permissions rcwl `
        --expiry $expiryTime `
        --account-name $StorageAccountName `
        --account-key $accountKey | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Stored Access Policyの作成に失敗しました" }
    Write-Success "Stored Access Policyを作成しました: $PolicyName (権限: rcwl, 有効期限: $expiryTime)"
} else {
    Write-Action "既存のStored Access Policy '$PolicyName' を上書きします..."
    az storage container policy update `
        --container-name '$web' `
        --name $PolicyName `
        --permissions rcwl `
        --expiry $expiryTime `
        --account-name $StorageAccountName `
        --account-key $accountKey | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Stored Access Policyの更新に失敗しました" }
    Write-Success "Stored Access Policyを更新しました: $PolicyName (権限: rcwl, 有効期限: $expiryTime)"
}

# ============================================================
# Step 7: data/index.json の初期配置
# ============================================================
Write-Step "Step 7: data/index.json の初期配置"

$existingIndex = az storage blob show `
    --container-name '$web' `
    --name 'data/index.json' `
    --account-name $StorageAccountName `
    --account-key $accountKey 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Action "data/index.json が存在しません。空の初期データを配置します..."
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
        Write-Success "data/index.json を初期配置しました (updatedAt: $updatedAt)"
    } finally {
        if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
    }
} else {
    Write-Warn "data/index.json は既に存在します。スキップします。"
}

# ============================================================
# 完了サマリー
# ============================================================
Write-Step "プロビジョニング完了"
Write-Detail "リソースグループ" $ResourceGroupName
Write-Detail "Storageアカウント" $StorageAccountName
Write-Detail "静的サイトエンドポイント" $webEndpoint
Write-Detail "Blobサービスエンドポイント" $blobEndpoint
Write-Detail "Stored Access Policy" "$PolicyName (有効期限: $expiryTime)"
Write-Info ""
Write-Success "全ステップが正常に完了しました"
