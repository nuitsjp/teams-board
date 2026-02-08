<#
.SYNOPSIS
    Stored Access Policyに紐づくContainer SASトークンを生成し、管理者用URLを出力する

.DESCRIPTION
    blob-static-dashboardの管理者向けSASトークンを生成し、
    静的サイトエンドポイントを含む完全なアクセスURLを出力する。
    SASトークンはStored Access Policyから権限を継承する。

.PARAMETER SubscriptionId
    対象のAzureサブスクリプションID（デフォルト: 9f8bb535-5bea-4687-819e-7605b47941b5）

.PARAMETER ResourceGroupName
    リソースグループ名（デフォルト: z2-rg-usr-z23004-dev-002）

.PARAMETER StorageAccountName
    Storageアカウント名（デフォルト: strjstudylogprod）

.PARAMETER PolicyName
    Stored Access Policyの名前（デフォルト: dashboard-admin）
#>
param(
    [string]$SubscriptionId = "9f8bb535-5bea-4687-819e-7605b47941b5",
    [string]$ResourceGroupName = "z2-rg-usr-z23004-dev-002",
    [string]$StorageAccountName = "strjstudylogprod",
    [string]$PolicyName = "dashboard-admin"
)

$ErrorActionPreference = 'Stop'

# .env からの設定読み込み
. (Join-Path $PSScriptRoot "Load-EnvSettings.ps1")
$envSettings = Load-EnvSettings
$applied = Apply-EnvSettings -Settings $envSettings -BoundParameters $PSBoundParameters -ParameterMap @{
    "SubscriptionId"     = "AZURE_SUBSCRIPTION_ID"
    "ResourceGroupName"  = "AZURE_RESOURCE_GROUP_NAME"
    "StorageAccountName" = "AZURE_STORAGE_ACCOUNT_NAME"
}
foreach ($key in $applied.Keys) {
    Set-Variable -Name $key -Value $applied[$key]
}

# サブスクリプション切替
Write-Host "サブスクリプションを切り替えています..." -ForegroundColor Cyan
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) { throw "サブスクリプションの切り替えに失敗しました" }

# Storageアカウントの接続確認
Write-Host "Storageアカウント '$StorageAccountName' に接続しています..." -ForegroundColor Cyan
az storage account show --resource-group $ResourceGroupName --name $StorageAccountName | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Storageアカウント '$StorageAccountName' が見つかりません" }

# アカウントキーを取得
$accountKey = (az storage account keys list --resource-group $ResourceGroupName --account-name $StorageAccountName --query "[0].value" --output tsv)
if ($LASTEXITCODE -ne 0) { throw "Storageアカウントキーの取得に失敗しました" }

# SASトークン生成（Policyから権限を継承）
Write-Host "SASトークンを生成しています (Policy: $PolicyName)..." -ForegroundColor Cyan
$sasToken = (az storage container generate-sas `
    --name '$web' `
    --policy-name $PolicyName `
    --https-only `
    --account-name $StorageAccountName `
    --account-key $accountKey `
    --output tsv)
if ($LASTEXITCODE -ne 0) { throw "SASトークンの生成に失敗しました" }

# 静的サイトエンドポイントURLの取得
$webEndpoint = (az storage account show --resource-group $ResourceGroupName --name $StorageAccountName --query "primaryEndpoints.web" --output tsv)
$webEndpoint = $webEndpoint.TrimEnd('/')

# SASトークンをURLエンコードして token= パラメータに格納
# （エンコードしないと & がURLパラメータ区切りと誤解される）
$encodedSas = [System.Uri]::EscapeDataString($sasToken)
$adminUrl = "${webEndpoint}/index.html?token=${encodedSas}"

# 結果出力
Write-Host ""
Write-Host "=== SASトークン生成完了 ===" -ForegroundColor Green
Write-Host "Storageアカウント: $StorageAccountName"
Write-Host "Policy: $PolicyName"
Write-Host ""
Write-Host "--- SASトークン ---"
Write-Host $sasToken
Write-Host ""
Write-Host "--- 管理者用URL ---"
Write-Host $adminUrl
Write-Host ""

# パイプライン出力用にURLを返す
Write-Output $adminUrl
