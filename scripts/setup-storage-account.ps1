# Storage Account セットアップスクリプト
# 静的Webサイトホスティング・CORS・ロール割り当てを一括設定する
#
# 使用方法:
#   .\scripts\setup-storage-account.ps1 .env.study-log

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$EnvFile
)

$ErrorActionPreference = 'Stop'

# --- .env ファイルのパース ---
if (-not (Test-Path $EnvFile)) {
    throw ".env ファイルが見つかりません: $EnvFile"
}

$envVars = @{}
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
        $parts = $line -split '=', 2
        if ($parts.Length -eq 2) {
            $envVars[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
}

$requiredKeys = @(
    'AZURE_SUBSCRIPTION_ID',
    'AZURE_RESOURCE_GROUP_NAME',
    'AZURE_STORAGE_ACCOUNT_NAME',
    'AZURE_LOCATION',
    'GITHUB_REPOSITORY_OWNER',
    'GITHUB_REPOSITORY_NAME',
    'GITHUB_REPOSITORY_ENVIRONMENT'
)

foreach ($key in $requiredKeys) {
    if (-not $envVars.ContainsKey($key) -or -not $envVars[$key]) {
        throw ".env に必須変数が未設定です: $key"
    }
}

$subscriptionId = $envVars['AZURE_SUBSCRIPTION_ID']
$resourceGroup  = $envVars['AZURE_RESOURCE_GROUP_NAME']
$accountName    = $envVars['AZURE_STORAGE_ACCOUNT_NAME']
$location       = $envVars['AZURE_LOCATION']
$ghOwner        = $envVars['GITHUB_REPOSITORY_OWNER']
$ghRepo         = $envVars['GITHUB_REPOSITORY_NAME']
$ghEnvironment  = $envVars['GITHUB_REPOSITORY_ENVIRONMENT']
$ghFullRepo     = "$ghOwner/$ghRepo"

# --- サブスクリプション設定 ---
Write-Host "サブスクリプションを設定しています: $subscriptionId"
az account set --subscription $subscriptionId

# --- Storage Account 作成 ---
Write-Host "Storage Account を作成しています: $accountName"
az storage account create `
    --name $accountName `
    --resource-group $resourceGroup `
    --location $location `
    --sku Standard_LRS `
    --kind StorageV2

# --- 静的Webサイトホスティング有効化 ---
Write-Host "静的Webサイトホスティングを有効化しています"
az storage blob service-properties update `
    --account-name $accountName `
    --static-website `
    --index-document index.html

# --- CORS 設定 ---
Write-Host "CORS を設定しています"
az storage cors add `
    --account-name $accountName `
    --services b `
    --methods PUT `
    --origins '*' `
    --allowed-headers '*'

# --- ロール割り当て ---
Write-Host "Storage Blob Data Contributor ロールを付与しています"
$signedInUser = az ad signed-in-user show --query id --output tsv
az role assignment create `
    --assignee $signedInUser `
    --role 'Storage Blob Data Contributor' `
    --scope "/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.Storage/storageAccounts/$accountName"

# --- CI サービスプリンシパルへのロール付与 ---
# OIDC フェデレーション資格情報のサブジェクトクレームから CI 用アプリを検索
$oidcSubject = "repo:${ghFullRepo}:environment:${ghEnvironment}"
Write-Host "CI サービスプリンシパルを検索しています (subject: $oidcSubject)"
$appIds = az ad app list --display-name $ghRepo --query "[].appId" --output tsv
$ciClientId = $null
foreach ($appId in ($appIds -split "`n")) {
    $appId = $appId.Trim()
    if (-not $appId) { continue }
    $match = az ad app federated-credential list --id $appId --query "[?subject=='$oidcSubject'].subject" --output tsv
    if ($match) {
        $ciClientId = $appId
        break
    }
}
if (-not $ciClientId) {
    throw "OIDC フェデレーション資格情報に一致するアプリが見つかりません (subject: $oidcSubject)"
}

Write-Host "CI サービスプリンシパルに Storage Blob Data Contributor ロールを付与しています (Client ID: $ciClientId)"
$ciObjectId = az ad sp show --id $ciClientId --query id --output tsv
az role assignment create `
    --assignee $ciObjectId `
    --role 'Storage Blob Data Contributor' `
    --scope "/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.Storage/storageAccounts/$accountName"

# --- GitHub 環境変数の自動設定 ---
Write-Host "静的Webエンドポイントを取得しています"
$blobEndpoint = az storage account show `
    --resource-group $resourceGroup `
    --name $accountName `
    --query "primaryEndpoints.blob" `
    --output tsv
# 末尾のスラッシュを除去して $web を付与
$blobBaseUrl = $blobEndpoint.TrimEnd('/') + '/$web'

Write-Host "GitHub 環境変数を設定しています: $ghFullRepo ($ghEnvironment)"
gh variable set AZURE_SUBSCRIPTION_ID --env $ghEnvironment --repo $ghFullRepo --body $subscriptionId
gh variable set AZURE_RESOURCE_GROUP_NAME --env $ghEnvironment --repo $ghFullRepo --body $resourceGroup
gh variable set AZURE_STORAGE_ACCOUNT_NAME --env $ghEnvironment --repo $ghFullRepo --body $accountName
gh variable set VITE_BLOB_BASE_URL --env $ghEnvironment --repo $ghFullRepo --body $blobBaseUrl

Write-Host "セットアップが完了しました"
