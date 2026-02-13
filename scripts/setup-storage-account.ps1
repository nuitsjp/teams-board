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
    'AZURE_LOCATION'
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

Write-Host "セットアップが完了しました"
