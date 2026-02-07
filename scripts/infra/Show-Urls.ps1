<#
.SYNOPSIS
    利用者用URLおよび管理者用URL（SASトークン付き）を表示する

.DESCRIPTION
    静的サイトの利用者用エンドポイントURLと、
    Stored Access Policyに基づくSASトークン付きの管理者用URLを表示する。

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

# local.settings.json からの設定読み込み
. (Join-Path $PSScriptRoot "Load-LocalSettings.ps1")
$localSettings = Load-LocalSettings
$applied = Apply-LocalSettings -Settings $localSettings -BoundParameters $PSBoundParameters -ParameterMap @{
    "SubscriptionId"     = "subscriptionId"
    "ResourceGroupName"  = "resourceGroupName"
    "StorageAccountName" = "storageAccountName"
}
foreach ($key in $applied.Keys) {
    Set-Variable -Name $key -Value $applied[$key]
}

# サブスクリプション切替
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) { throw "サブスクリプションの切り替えに失敗しました" }

# Storageアカウントの接続確認
az storage account show --resource-group $ResourceGroupName --name $StorageAccountName | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Storageアカウント '$StorageAccountName' が見つかりません" }

# アカウントキーを取得
$accountKey = (az storage account keys list --resource-group $ResourceGroupName --account-name $StorageAccountName --query "[0].value" --output tsv)
if ($LASTEXITCODE -ne 0) { throw "Storageアカウントキーの取得に失敗しました" }

# SASトークン生成（Policyから権限を継承）
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

# URL組み立て
$userUrl = "${webEndpoint}/index.html"
$adminUrl = "${webEndpoint}/index.html?token=${sasToken}"

# 結果出力
Write-Host ""
Write-Host "=== ダッシュボードURL ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "--- 利用者用URL ---" -ForegroundColor Green
Write-Host $userUrl
Write-Host ""
Write-Host "--- 管理者用URL ---" -ForegroundColor Green
Write-Host $adminUrl
Write-Host ""
